import { NumberArray } from "./shared";

const FFT_SMOOTHING_CONSTANT = 0.5; // higher values make the bars less jumpy
const FFT_BAR_RELATIVE_WIDTH = 0.9;
const FFT_BAR_COLOR = "rgba(255, 255, 255, 0.1)";
const FFT_BAR_BIN_POWER = 1.3; // each FFT bar covers this factor more frequency spectrum than the last, so 2 means one bar per octave
const FFT_MIN_DECIBELS = -70;
const FFT_MAX_DECIBELS = -20;

let GLOBAL_CONTEXT: AudioContext = null;
let GLOBAL_ANALYSER: AnalyserNode = null;
let SUPPORTS_AUDIO_CONTEXT = "AudioContext" in window || "webkitAudioContext" in window;

export interface Subsection {
  startTime: number;
  endTime: number;
  title: string;
  element: HTMLElement;
}

export class Track {

  private _playing = false;
  private _waitingForAudioStart = false;
  private _active = false;
  private _metaSrc: string;
  private _audio: HTMLAudioElement;
  private _audioSource: MediaElementAudioSourceNode;
  private _resumeTime = 0;

  private _buffering = false;
  private _playStateDetectionInterval: any;
  private _playingLastBufferCheck = false;
  private _timeLastBufferCheck: number;

  private _descriptionMaxHeight: number;

  private _fftCanvas: HTMLCanvasElement;
  private _fftContext: CanvasRenderingContext2D;
  private _frequencyDomainData: Uint8Array = null;

  public ontimeupdate: (t: Track) => void = null;
  public onended: (t: Track) => void = null;
  public onbufferingchange: (t: Track) => void = null;

  constructor(public audioSrc: string, private _listItem: HTMLLIElement, private _description: HTMLDivElement, public peakData: NumberArray, public subsections: Subsection[]) {

    this._metaSrc = audioSrc.replace(/\.\w+$/, ".meta");
    this._audio = document.createElement("audio");
    this._audio.preload = "metadata";
    this._audio.src = audioSrc;
    this._audio.addEventListener("timeupdate", this._handleTimeUpdate);
    this._audio.addEventListener("loadedmetadata", this._handleTimeUpdate);
    this._audio.addEventListener("end", this._handleEnded);
    this._audio.addEventListener("error", this._handleStoppedDueToError);
    this._audio.addEventListener("stalled", this._handleStoppedDueToError);
    document.body.appendChild(this._audio)
    this._audio.load()

    subsections.sort((a, b) => a.startTime - b.startTime);

    this._updateClass();
    this._updateSubsectionDisplay();

    if (SUPPORTS_AUDIO_CONTEXT) {
      this._fftCanvas = document.createElement("canvas");
      this._fftCanvas.className = "waveform-player-track-fft-canvas";
      this._listItem.firstElementChild.appendChild(this._fftCanvas);
      this._fftContext = this._fftCanvas.getContext("2d");
    }
  }

  setPlaying(playing: boolean, reset?: boolean) {
    if (reset) {
      this._resumeTime = 0;
    }
    if (playing) {
      if (SUPPORTS_AUDIO_CONTEXT) {
        this._setupAudioContext();
      }
      this._waitingForAudioStart = true;
      this._audio.currentTime = this._resumeTime || 0;
      this._audio.play();
    } else {
      this._resumeTime = this._audio.currentTime;
      if (this._waitingForAudioStart) {
        this._audio.src = this._audio.src;
      }
    }
    if (playing !== this._playing) {
      this._playing = playing;
      if (playing) {
        if (SUPPORTS_AUDIO_CONTEXT) {
          this._audioSource.connect(GLOBAL_ANALYSER);
          this._audioSource.connect(GLOBAL_CONTEXT.destination);
          this._startFFTRenderLoop();
        }
        this._playStateDetectionInterval = setInterval(this._checkPlayState, 1000);
        this._checkPlayState();
      } else {
        this._audio.pause();
        clearInterval(this._playStateDetectionInterval);
        this._checkPlayState();
      }
      this._updateClass();
    }
  }

  setActive(active: boolean) {
    if (active !== this._active) {
      this._active = active;
      this._updateClass();
    }
  }

  setRelativePosition(relativePosition: number) {
    this._resumeTime = this._audio.duration * relativePosition || 0;
    this._audio.play();
    this._audio.currentTime = this._resumeTime;
  }

  setCurrentTime(currentTime: number) {
    this._audio.currentTime = currentTime || 0;
  }

  restart() {
    this._audio.currentTime = 0;
  }

  update() {
    this._updateDescriptionMaxHeight();
  }

  get isPlaying() {
    return this._playing;
  }

  get isBuffering() {
    return this._buffering;
  }

  get currentTime() {
    return this._audio.currentTime;
  }

  get totalTime() {
    return this._audio.duration;
  }

  get description() {
    return this._description;
  }

  private _updateDescriptionMaxHeight() {
    let desiredHeight = 0;
    if (this._playing) {
      desiredHeight = this._description.scrollHeight;
    }

    if (this._descriptionMaxHeight !== desiredHeight) {
      this._descriptionMaxHeight = desiredHeight;
      this._description.style.maxHeight = `${desiredHeight}px`;
    }
  }

  private _updateSubsectionDisplay() {
    let activeSubsection: Subsection = null;
    for (let subsction of this.subsections) {
      if (activeSubsection === null && subsction.startTime <= this.currentTime && (!subsction.endTime || subsction.endTime > this.currentTime)) {
        activeSubsection = subsction;
        activeSubsection.element.className = "waveform-player-subsection waveform-player-active-subsection";
      } else {
        subsction.element.className = "waveform-player-subsection";
      }
    }
  }

  private _updateClass() {
    let className = "waveform-player-track-list-item";
    if (this._active) {
      className += " waveform-player-track-list-item-active";
    }
    if (this._playing) {
      className += " waveform-player-track-list-item-playing";
    }
    this._listItem.className = className;
    this._updateDescriptionMaxHeight();
  }

  private _handleTimeUpdate = () => {
    this._updateSubsectionDisplay();
    if (this._audio.currentTime > 0) {
      this._waitingForAudioStart = false;
    }
    if (this.ontimeupdate) {
      this.ontimeupdate(this);
    }
  }

  private _handleEnded = () => {
    if (this.onended) {
      this.onended(this);
    }
  }

  private _handleStoppedDueToError = () => {
    this._waitingForAudioStart = true;
  }

  private _checkPlayState = () => {
    let buffering = this._playing && this._playingLastBufferCheck && this.currentTime === this._timeLastBufferCheck && !this._audio.ended;
    if (this._buffering !== buffering) {
      this._buffering = buffering;
      if (this.onbufferingchange) {
        this.onbufferingchange(this);
      }
    }
    this._playingLastBufferCheck = this._playing;
    this._timeLastBufferCheck = this.currentTime;
  }

  private _setupAudioContext() {
    if (this._audioSource) {
      return
    }
    if (GLOBAL_CONTEXT === null) {
      GLOBAL_CONTEXT = new (window["AudioContext"] || window["webkitAudioContext"])() as AudioContext;
      GLOBAL_ANALYSER = GLOBAL_CONTEXT.createAnalyser();
      GLOBAL_ANALYSER.minDecibels = FFT_MIN_DECIBELS;
      GLOBAL_ANALYSER.maxDecibels = FFT_MAX_DECIBELS;
      GLOBAL_ANALYSER.smoothingTimeConstant = FFT_SMOOTHING_CONSTANT;
    }
    this._audioSource = GLOBAL_CONTEXT.createMediaElementSource(this._audio);
  }

  private _nextFFTRenderScheduled = false;

  private _startFFTRenderLoop() {
    let renderDelegate = () => {
      this._renderFFT();
      if (this._playing && !this._nextFFTRenderScheduled) {
        this._nextFFTRenderScheduled = true;
        requestAnimationFrame(renderDelegate);
      }
    };
    renderDelegate();
  }

  private _renderFFT() {
    this._nextFFTRenderScheduled = false;

    let width = this._fftCanvas.offsetWidth;
    let height = this._fftCanvas.offsetHeight;

    if (this._fftCanvas.width !== width || this._fftCanvas.height !== height) {
      this._fftCanvas.width = width;
      this._fftCanvas.height = height;
    }

    let ctx = this._fftContext;

    ctx.clearRect(0, 0, width, height);
    if (this._playing) {

      if (!this._frequencyDomainData) {
        this._frequencyDomainData = new Uint8Array(GLOBAL_ANALYSER.frequencyBinCount);
      }


      GLOBAL_ANALYSER.getByteFrequencyData(this._frequencyDomainData);

      let bars: number[] = [];
      let binSize = 1;
      let i = 0;
      while (true) {
        let binSum = 0;
        for (let bin = 0; bin < binSize; bin++) {
          binSum += this._frequencyDomainData[i++];
        }
        if (i > this._frequencyDomainData.length) {
          break;
        }
        bars.push(binSum / binSize / 255);
        binSize *= FFT_BAR_BIN_POWER;
      }

      ctx.fillStyle = FFT_BAR_COLOR;
      let barWidth = width / bars.length;
      for (let i = 0; i < bars.length; i++) {
        ctx.fillRect(barWidth * i, height, barWidth * FFT_BAR_RELATIVE_WIDTH, -bars[i] * height);
        binSize *= FFT_BAR_BIN_POWER;
      }
    }
  }


}
