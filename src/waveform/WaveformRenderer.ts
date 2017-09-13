

const PEAK_DATA_TRANSITION_TIME_SECONDS = 0.6;

const PEAK_RESAMPLING_PIXELS_PER_PEAK = 1;

// at "1" one waveform fades into another simultaneously across the whole peak graph
// higher values introduce a wiping effect. At 2, the wipe will be 1/2 the width of the graph
const PEAK_DATA_TRANSITION_STAGGER = 2;

// while transitioning from one waveform to another, sine waves will wibble the graph.
// Yes "wibble" is a verb. I checked.
const WIBBLE_AMPLITUDE = 0.35;
const WIBBLE_WAVELENGTH = 0.2;

interface NumberArray {
  [key: number]: number;
  length: number;
}

export interface WaveformRendererColours {
  upperUnplayed: string;
  lowerUnplayed: string;
  upperPlayed: string;
  lowerPlayed: string;
  mouseoverUpperPlayed: string;
  mouseoverLowerPlayed: string;
}

export class WaveformRenderer {

  private _ctx: CanvasRenderingContext2D;
  private _rawCurrentPeaks: NumberArray = [0];
  private _rawPreviousPeaks: NumberArray = [0];
  private _rawLastRenderedPeaks: NumberArray;
  private _rawQueuedPeakData: NumberArray;
  private _resampledCurrentPeaks: NumberArray = [0];
  private _resampledPreviousPeaks: NumberArray = [0];
  private _transitioningPeaks: NumberArray = [0];
  private _peakDataTransitionStartTime = 0;
  private _transitionProgress = 1;
  private _previousTransitionProgress = 1;
  private _previousPlayheadPosition = 0;
  private _renderLoopRunning = false;
  private _nextRenderIsScheduled = false;

  private _playheadPosition = 0;
  private _playheadSmoothing = false;
  private _playheadSmoothingIsActive: boolean;
  private _playheadSmoothingStartTime = 0;
  private _playheadSmoothingDuration = 0;
  private _playheadSmoothingPlayLength = 0;

  private _hasCurrentInteraction = false;
  private _mousePosition: number = 0;
  private _highlightPosition: number = 0;

  private _colours: WaveformRendererColours = {
    upperUnplayed: "#DDD",
    lowerUnplayed: "#FFF",
    upperPlayed: "#AAA",
    lowerPlayed: "#CCC",
    mouseoverUpperPlayed: "#888",
    mouseoverLowerPlayed: "#AAA"
  };

  private _handleWindowResizeDelegate = this._handleWindowResize.bind(this);

  public onpositionselect: (relativePosition: number) => void;

  constructor(private _canvas: HTMLCanvasElement) {
    this._ctx = _canvas.getContext("2d");
    this._render();
    window.addEventListener("resize", this._handleWindowResizeDelegate);
    this._setupInteractionHandlers();
  }

  destroy() {
    window.removeEventListener("resize", this._handleWindowResizeDelegate);
  }

  setPeakData(peakData: NumberArray) {
    if (this._transitionProgress !== 1) {
      this._rawQueuedPeakData = peakData;
      return;
    }
    this._previousPlayheadPosition = this._getSmoothedPlayheadPosition();
    this._playheadPosition = 0;
    this._playheadSmoothing = false;
    this._rawPreviousPeaks = this._rawCurrentPeaks;
    this._resampledPreviousPeaks = this._resampledCurrentPeaks;
    this._rawCurrentPeaks = peakData;
    this._resampledCurrentPeaks = null;
    this._peakDataTransitionStartTime = Date.now();
    this._startRenderLoop();
  }

  // because we don't get progress update events from the audio element very often, smoothSeconds
  // is an instruction to continue playing at the expected speed for that number of seconds
  setPlayheadPosition(currentTime: number, totalTime: number, smoothSeconds: number = 0) {
    this._playheadPosition = currentTime / totalTime;
    if (smoothSeconds) {
      this._playheadSmoothing = true;
      this._playheadSmoothingStartTime = Date.now();
      this._playheadSmoothingPlayLength = totalTime;
      this._playheadSmoothingDuration = smoothSeconds;
    } else {
      this._playheadSmoothing = false;
    }
    this._startRenderLoop();
  }

  setHighlightPosition(currentTime: number, totalTime: number) {
    this._highlightPosition = currentTime / totalTime;
    this._startRenderLoop();
  }

  clearHighlightPosition() {
    this._highlightPosition = 0;
    this._startRenderLoop();
  }

  setColours(colours: WaveformRendererColours) {
    this._colours = colours;
  }


  private _startRenderLoop() {
    if (!this._renderLoopRunning) {
      this._renderLoopRunning = true;
      this._render();
    }
  }


  private _render() {

    this._nextRenderIsScheduled = false;

    let width = Math.ceil(this._canvas.offsetWidth * (window.devicePixelRatio || 1));
    let height = Math.ceil(this._canvas.offsetHeight * (window.devicePixelRatio || 1));

    let isResized = this._resizeCanvas(width, height);

    this._transitionProgress = Math.min(1, (Date.now() - this._peakDataTransitionStartTime) / 1000 / PEAK_DATA_TRANSITION_TIME_SECONDS);


    if (this._transitionProgress < 1 || this._previousTransitionProgress < 1 || isResized || this._rawLastRenderedPeaks !== this._rawCurrentPeaks) {
      this._redrawPeakShape(width, height);
    }

    this._redrawColors(width, height);



    if (this._transitionProgress >= 1) {
      if (this._rawQueuedPeakData) {
        this.setPeakData(this._rawQueuedPeakData);
        this._rawQueuedPeakData = null;
      } else {
        this._renderLoopRunning = this._playheadSmoothingIsActive;
      }
    }
    this._previousTransitionProgress = this._transitionProgress;

    if (this._renderLoopRunning && !this._nextRenderIsScheduled) {
      this._nextRenderIsScheduled = true;
      requestAnimationFrame(this._render.bind(this));
    }
  }

  private _resizeCanvas(width: number, height: number) {
    let isResized = false;
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
      isResized = true;
      this._resampledCurrentPeaks = null;
      this._resampledPreviousPeaks = null;
    }
    if (!this._resampledCurrentPeaks) {
      this._resampledCurrentPeaks = makeNumberArray(width / PEAK_RESAMPLING_PIXELS_PER_PEAK);
      resamplePeaks(this._rawCurrentPeaks, this._resampledCurrentPeaks);
    }
    if (!this._resampledPreviousPeaks) {
      this._resampledPreviousPeaks = makeNumberArray(width / PEAK_RESAMPLING_PIXELS_PER_PEAK);
      resamplePeaks(this._rawPreviousPeaks, this._resampledPreviousPeaks);
    }
    return isResized;
  }

  private _getSmoothedPlayheadPosition() {
    let playheadPosition = this._playheadPosition;

    this._playheadSmoothingIsActive = false;
    if (this._playheadSmoothing) {
      let now = Date.now();
      let elapsed = (now - this._playheadSmoothingStartTime) / 1000;
      if (elapsed < this._playheadSmoothingDuration) {
        this._playheadSmoothingIsActive = true;
      }
      playheadPosition += elapsed / this._playheadSmoothingPlayLength;
    }

    return Math.min(1, Math.max(0, playheadPosition));
  }

  private _redrawPeakShape(width: number, height: number) {

    // draw the top half of the chart, then flip the bottom half over

    this._updateTransitioningPeaks();
    let peaks = this._transitioningPeaks;
    let len = peaks.length;
    let halfHeight = Math.ceil(height / 2) + 1;
    let ctx = this._ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    let peakWidth = width / peaks.length;
    for (let i = 0; i < len; i++) {
      ctx.lineTo(i * peakWidth, halfHeight - (peaks[i] * halfHeight));
    }
    ctx.lineTo(width, halfHeight);
    ctx.closePath();
    ctx.fillStyle = "#FF0088";
    ctx.fill();

    ctx.save();
    ctx.translate(0, Math.round(height / 2));
    ctx.scale(1, -1);
    this._ctx.drawImage(this._canvas, 0, -Math.round(height / 2), width, height);
    ctx.restore();

    this._rawLastRenderedPeaks = this._rawCurrentPeaks;
  }

  private _redrawColors(width: number, height: number) {

    let ctx = this._ctx;

    ctx.globalCompositeOperation = "source-atop";

    let playheadPosition = this._getSmoothedPlayheadPosition();

    drawGradient(this._colours.upperUnplayed, this._colours.lowerUnplayed, 1);

    drawGradient(this._colours.upperPlayed, this._colours.lowerPlayed, playheadPosition);

    if (this._previousPlayheadPosition > playheadPosition && this._transitionProgress < 1) {
      // TODO restore this without lerping
      // let upperColor = rgbLerp(UPPER_PLAYED_RGB, UPPER_UNPLAYED_RGB, this._transitionProgress);
      // let lowerColor = rgbLerp(LOWER_PLAYED_RGB, LOWER_UNPLAYED_RGB, this._transitionProgress);
      // drawGradient(upperColor, lowerColor, this._previousPlayheadPosition);
    }

    if (this._hasCurrentInteraction) {
      drawGradient(this._colours.mouseoverUpperPlayed, this._colours.mouseoverLowerPlayed, this._mousePosition, playheadPosition);
    } else if (this._highlightPosition) {
      drawGradient(this._colours.mouseoverUpperPlayed, this._colours.mouseoverLowerPlayed, this._highlightPosition, playheadPosition);
    }

    ctx.globalCompositeOperation = "source-over";

    function drawGradient(upperColor: string, lowerColor: string, xProportionFrom: number, xProportionTo: number = 0) {
      let grd = ctx.createLinearGradient(0, 0, 0, height);
      grd.addColorStop(0, upperColor);
      grd.addColorStop(1, lowerColor);
      ctx.fillStyle = grd;
      ctx.fillRect(width * xProportionFrom, 0, width * (xProportionTo - xProportionFrom), height);
    }
  }

  private _setupInteractionHandlers() {

    let update = (event: Event, isOver: boolean, isConfirm: boolean, eventPos: { pageX: number }) => {
      event.preventDefault();
      this._hasCurrentInteraction = isOver;
      let canvasPos = this._canvas.getBoundingClientRect();
      if (eventPos) {
        this._mousePosition = (eventPos.pageX - canvasPos.left) / canvasPos.width;
      }
      this._startRenderLoop();
      if (isConfirm && this.onpositionselect) {
        this.onpositionselect(this._mousePosition);
      }
    };

    this._canvas.addEventListener("mouseover", e => update(e, true, false, e));
    this._canvas.addEventListener("mousemove", e => update(e, true, false, e));
    this._canvas.addEventListener("mouseout", e => update(e, false, false, e));
    this._canvas.addEventListener("mouseup", e => update(e, true, true, e));

    this._canvas.addEventListener("touchstart", e => update(e, true, false, e.targetTouches[0]));
    this._canvas.addEventListener("touchmove", e => update(e, true, false, e.targetTouches[0]));
    this._canvas.addEventListener("touchend", e => update(e, false, true, e.targetTouches[0]));
  }

  private _handleWindowResize() {
    if (document.body && !(this._canvas.compareDocumentPosition(document.body) & Node.DOCUMENT_POSITION_DISCONNECTED)) {
      this._startRenderLoop();
    }
  }

  private _updateTransitioningPeaks() {

    if (this._transitioningPeaks.length !== this._resampledCurrentPeaks.length) {
      this._transitioningPeaks = makeNumberArray(this._resampledCurrentPeaks.length);
    }

    let previous = this._resampledPreviousPeaks;
    let current = this._resampledCurrentPeaks;
    let destination = this._transitioningPeaks;
    let len = current.length;

    let wibbleRadians = 2 * Math.PI * (1 / WIBBLE_WAVELENGTH);

    for (let i = 0; i < len; i++) {

      // stagger causes the fade from previous to next waveform to wipe from left to right
      let staggerProgress = stagger(this._transitionProgress, i, len, PEAK_DATA_TRANSITION_STAGGER);

      // wibble is a wave of sine wave modulation following the transition
      let wibble = ease(1 - Math.abs(staggerProgress * 2 - 1));

      let peak = this._resampledPreviousPeaks[i] + (current[i] - previous[i]) * ease(staggerProgress);
      peak += Math.sin(i / len * wibbleRadians) * wibble * WIBBLE_AMPLITUDE;
      destination[i] = Math.max(0, Math.min(1, peak));
    }
  }
}

function ease(input: number) {
  if (input < 0.5) {
    return (input * input) * 2;
  }
  let inverse = 1 - input;
  return 1 - ((inverse * inverse) * 2);
}

function stagger(input: number, index: number, count: number, staggerAmount: number) {
  let delay = index / count * (1 - (1 / staggerAmount));
  return ease(Math.min(1, Math.max(0, (input - delay) * staggerAmount)));
}

function makeNumberArray(length: number): NumberArray {
  if ("Float32Array" in window) {
    return new Float32Array(length);
  }
  return new Array(length);
}

function resamplePeaks(source: NumberArray, destination: NumberArray) {

  if (source.length === destination.length) {
    for (let i = 0; i < source.length; i++) {
      destination[i] = source[i];
    }
  } else if (source.length > destination.length) {
    // downsample taking max
    let skip = source.length / destination.length;
    let w = skip / 2;
    let pos = w;
    for (let i = 0; i < destination.length; i++) {
      let b0 = Math.floor(pos - w);
      let b1 = Math.min(Math.ceil(pos + w), source.length);
      pos += skip;
      let max = 0;
      for (let j = b0; j < b1; j++) max = Math.max(max, source[j]);
      destination[i] = max;
    }
  } else {
    // upsample using linear interpolation
    let skip = (source.length - 1) / destination.length;
    for (let i = 0; i < destination.length; i++) {
      let pos = i * skip;
      let ipos = Math.floor(pos);
      let fpos = pos - ipos;
      let p0 = Math.max(ipos, 0);
      let p1 = Math.min(ipos + 1, source.length - 1);
      let val = (1 - fpos) * source[p0] + (fpos) * source[p1];
      destination[i] = val;
    }
  }
}
