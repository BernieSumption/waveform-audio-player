
import { Track, Subsection } from "./Track";
import { WaveformRenderer } from "./WaveformRenderer";

const SPECIAL_MODE_DISABLE = "disable";

// the lowest and highest values of peak data in the data-peaks="csv" attributes
const PEAK_DATA_MIN = 0;
const PEAK_DATA_MAX = 999;

const CONTROLS_HTML = `
<div class="waveform-player-controls">
  <button class="waveform-player-controls-toggleplay">toggle play</button>
  <button class="waveform-player-controls-prev">prev</button>
  <button class="waveform-player-controls-next">next</button>
  <div class="waveform-player-controls-peakdata-wrapper">
    <canvas class="waveform-player-controls-peakdata"></canvas>
    <div class="waveform-player-controls-current-time">0:13</div>
    <div class="waveform-player-controls-total-time">1:03</div>
  </div>
  <span class="waveform-player-upper-unplayed"></span>
  <span class="waveform-player-lower-unplayed"></span>
  <span class="waveform-player-upper-played"></span>
  <span class="waveform-player-lower-played"></span>
  <span class="waveform-player-mouseover-upper-played"></span>
  <span class="waveform-player-mouseover-lower-played"></span>
</div>
<div class="waveform-player-show-more"></div>
`;

export class Player {


  private _tracks: Track[] = [];
  private _currentTrack: Track;
  private _trackByAudioSrc: { [audioSrc: string]: Track } = {};
  private _specialMode: string;

  private _isPlaying = false;
  private _resizeIfRequiredInterval: any;

  private _listUl: HTMLUListElement;
  private _controlsDiv: HTMLDivElement;
  private _prevButton: HTMLButtonElement;
  private _nextButton: HTMLButtonElement;
  private _currentTimeDiv: HTMLDivElement;
  private _totalTimeDiv: HTMLDivElement;
  private _upperUnplayedTest: HTMLSpanElement;
  private _lowerUnplayedTest: HTMLSpanElement;
  private _upperPlayedTest: HTMLSpanElement;
  private _lowerPlayedTest: HTMLSpanElement;
  private _mouseoverUpperPlayedTest: HTMLSpanElement;
  private _mouseoverLowerPlayedTest: HTMLSpanElement;
  private _hasHadInteraction = false;

  private _waveform: WaveformRenderer;

  public onplay: (player: Player) => void;

  constructor(private wrapper: HTMLElement) {
    if (!browserSupportsRequiredFeatures()) {
      return;
    }

    let match = document.location.href.match(/\bplayerMode=(\w+)(&|$)/);
    if (match) {
      this._specialMode = match[1];
    }
    if (this._specialMode === SPECIAL_MODE_DISABLE) {
      return;
    }

    this._tracks = this._parseTracks();

    if (!this._tracks || this._tracks.length === 0) {
      return;
    }

    wrapper.addEventListener("click", e => this._handleClick(e), true);
    wrapper.addEventListener("mouseover", e => this._handleMouseoverOut(e), true);
    wrapper.addEventListener("mouseout", e => this._handleMouseoverOut(e), true);

    let tmp = document.createElement("div");
    tmp.innerHTML = CONTROLS_HTML.trim();
    this._controlsDiv = tmp.firstChild as HTMLDivElement;
    while (tmp.childNodes.length > 0) {
      wrapper.insertBefore(tmp.lastChild, wrapper.firstChild);
    }
    this._prevButton = this._controlsDiv.getElementsByClassName("waveform-player-controls-prev")[0] as HTMLButtonElement;
    this._nextButton = this._controlsDiv.getElementsByClassName("waveform-player-controls-next")[0] as HTMLButtonElement;
    this._currentTimeDiv = this._controlsDiv.getElementsByClassName("waveform-player-controls-current-time")[0] as HTMLDivElement;
    this._totalTimeDiv = this._controlsDiv.getElementsByClassName("waveform-player-controls-total-time")[0] as HTMLDivElement;

    this._upperUnplayedTest = this._controlsDiv.getElementsByClassName("waveform-player-upper-unplayed")[0] as HTMLSpanElement;
    this._lowerUnplayedTest = this._controlsDiv.getElementsByClassName("waveform-player-lower-unplayed")[0] as HTMLSpanElement;
    this._upperPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-upper-played")[0] as HTMLSpanElement;
    this._lowerPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-lower-played")[0] as HTMLSpanElement;
    this._mouseoverUpperPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-mouseover-upper-played")[0] as HTMLSpanElement;
    this._mouseoverLowerPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-mouseover-lower-played")[0] as HTMLSpanElement;

    this._waveform = new WaveformRenderer(this._controlsDiv.getElementsByClassName("waveform-player-controls-peakdata")[0] as HTMLCanvasElement);
    this._waveform.onpositionselect = this._onWaveformPositionSelect.bind(this);

    this._currentTrack = this._tracks[0];
    this._currentTrack.setActive(true);
    this._waveform.setPeakData(this._currentTrack.peakData);
    this._updateColoursFromCSS();

    this._handlePlayingStateChange();
    this._handleTrackTimeUpdate();

    setTimeout(this._handleExternalStyleChange.bind(this), 10);
    setTimeout(this._handleExternalStyleChange.bind(this), 50);
    setTimeout(this._handleExternalStyleChange.bind(this), 100);
    setTimeout(this._handleExternalStyleChange.bind(this), 250);
    setTimeout(this._handleExternalStyleChange.bind(this), 500);
    setTimeout(this._handleExternalStyleChange.bind(this), 1000);
    setTimeout(this._handleExternalStyleChange.bind(this), 2000);
    setTimeout(this._handleExternalStyleChange.bind(this), 4000);
    setTimeout(this._handleExternalStyleChange.bind(this), 8000);
    setTimeout(this._handleExternalStyleChange.bind(this), 16000);
  }

  setPlaying(playing: boolean) {
    if (this._isPlaying !== playing) {
      this._togglePlay();
    }
  }

  private _updateColoursFromCSS() {
    this._waveform.setColours({
      upperUnplayed: getColour(this._upperUnplayedTest),
      lowerUnplayed: getColour(this._lowerUnplayedTest),
      upperPlayed: getColour(this._upperPlayedTest),
      lowerPlayed: getColour(this._lowerPlayedTest),
      mouseoverUpperPlayed: getColour(this._mouseoverUpperPlayedTest),
      mouseoverLowerPlayed: getColour(this._mouseoverLowerPlayedTest)
    });

    function getColour(el: HTMLElement) {
      let style = getComputedStyle(el);
      return style ? style.color : "";
    }
    
    // let sheets = document.styleSheets;
    // for (let i = 0; i < sheets.length; i++) {
    //   let rules: CSSRuleList = (sheets[i] as any).rules || (sheets[i] as any).cssRules;
    //   if (rules) {
    //     for (let j = 0; j < rules.length; j++) {
    //       let rule: CSSStyleRule = rules[j] as CSSStyleRule;
    //       switch (rule.cssText) {
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //         case ".waveform-player-upper-unplayed":
    //           this._upperUnplayedColour = rule.style.color;
    //           break;
    //       }
    //     }
    //   }
    // }
  }

  private _handlePlayingStateChange() {
    let isPlaying = this._currentTrack.isPlaying;
    if (this._isPlaying !== isPlaying) {
      this._isPlaying = isPlaying;
      if (isPlaying) {
        this._resizeIfRequiredInterval = setInterval(this._handleExternalStyleChange.bind(this), 1000);
        if (this.onplay) {
          this.onplay(this);
        }
      } else {
        clearInterval(this._resizeIfRequiredInterval);
      }
    }
    this._handleExternalStyleChange();

    this._prevButton.disabled = this._currentTrack === this._tracks[0];
    this._nextButton.disabled = this._currentTrack === this._tracks[this._tracks.length - 1];
    this._prevButton.style.visibility = this._nextButton.style.visibility = this._tracks.length < 2 ? "hidden" : "";
  }

  private _updateClass() {
    let isPlaying = this._currentTrack.isPlaying;
    let className = "waveform-player waveform-player-enabled";
    if (isPlaying) {
      className += " waveform-player-playing";
    }
    if (this._currentTrack.isBuffering) {
      className += " waveform-player-buffering";
    }
    if (this._hasHadInteraction) {
      if (isPlaying) {
        className += " waveform-player-interacted";
      }
    } else if (this._currentTrack.description.scrollHeight > this._listUl.clientHeight) {
      className += " waveform-player-description-truncated";
    }
    this.wrapper.className = className;
  }

  private _handleClick(e: MouseEvent) {
    this._hasHadInteraction = true;
    let el = e.target as Node;
    while (el && el.nodeName !== "A" && el.nodeName !== "BUTTON") {
      el = el.parentNode;
    }
    let isKeyboard = !(e.screenX || e.screenY);
    if (el instanceof HTMLAnchorElement) {
      if (!isKeyboard) {
        el.blur();
      }
      let track = this._trackByAudioSrc[el.href];
      if (track) {
        e.preventDefault();
        this._selectTrack(track);
        let startTimeString = el.getAttribute("data-start-time");
        if (startTimeString) {
          this._currentTrack.setCurrentTime(parseFloat(startTimeString));
        }
        return;
      }
    }
    if (el instanceof HTMLButtonElement) {
      if (!isKeyboard) {
        el.blur();
      }
      switch (el.className) {
        case "waveform-player-controls-toggleplay":
          this._togglePlay();
          return;
        case "waveform-player-controls-next":
          this._selectRelativeTrack(1);
          return;
        case "waveform-player-controls-prev":
          this._selectRelativeTrack(-1);
          return;
        default:
          console.error(`Unrecognised button class: "${el.className}"`);
      }
    }

    this._handlePlayingStateChange();
  }

  private _handleMouseoverOut(e: MouseEvent) {
    let target = e.target;
    if (target instanceof HTMLAnchorElement && target.className === "waveform-player-subsection-play" && target.href === this._currentTrack.audioSrc) {
      let startTime = parseFloat(target.getAttribute("data-start-time"));
      if (!isNaN(startTime)) {
        if (e.type === "mouseover") {
          this._waveform.setHighlightPosition(startTime, this._currentTrack.totalTime);
        } else {
          this._waveform.clearHighlightPosition();
        }
      }
    }
  }

  destroy() {
    if (this._waveform) {
      this._waveform.destroy();
    }
  }

  _handleExternalStyleChange() {
    for (let track of this._tracks) {
      track.update();
    }
    this._updateColoursFromCSS();
    this._updateClass();
  }

  private _selectTrack(trackToSelect: Track, startTime?: number) {
    if (this._currentTrack !== trackToSelect) {
      this._currentTrack = trackToSelect;
      this._waveform.setPeakData(this._currentTrack.peakData);
      for (let track of this._tracks) {
        if (track === trackToSelect) {
          track.setRelativePosition(0);
          track.setPlaying(true, true);
          track.setActive(true);
        } else {
          track.setPlaying(false, true);
          track.setActive(false);
        }
      }
    } else {
      this._currentTrack.setPlaying(true);
    }
    this._handleTrackTimeUpdate();
    this._handlePlayingStateChange();
  }

  private _selectRelativeTrack(offset: number) {
    let newIndex = this._tracks.indexOf(this._currentTrack) + offset;
    if (this._tracks[newIndex]) {
      this._selectTrack(this._tracks[newIndex]);
    }
  }

  private _togglePlay() {
    if (!this._currentTrack.isPlaying) {
      this._currentTrack.restart();
      this._selectTrack(this._currentTrack);
    } else {
      this._currentTrack.setPlaying(false);
      this._handleTrackTimeUpdate();
      this._handlePlayingStateChange();
    }
  }

  private _parseTracks() {
    let firstChild = this.wrapper.firstElementChild;
    if (firstChild instanceof HTMLUListElement) {
      this._listUl = firstChild;
    } else {
      console.error(".waveform-player with no ul child");
      return null;
    }
    this._listUl.className = "waveform-player-track-list";
    let tracks: Track[] = [];

    for (let i = 0; i < this._listUl.childNodes.length; i++) {
      if (this._listUl.childNodes[i].nodeName !== "LI") {
        continue;
      }
      let listItem = this._listUl.childNodes[i] as HTMLLIElement;
      let link: HTMLAnchorElement;
      let description: HTMLDivElement;
      let elementCount = 0;

      for (let i = 0; i < listItem.childNodes.length; i++) {
        let child = listItem.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          if (child.nodeValue.trim() !== "") {
            console.error("Illegal text child of track list <li> item, expected one <a> element then one <div> element", child);
            return null;
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (elementCount === 0) {
            if (child instanceof HTMLAnchorElement) {
              link = child;
            } else {
              console.error(`Illegal child of track list <li> item, element ${i + 1} to be a <a> but it was a <${child.nodeName.toLowerCase()}>`, child);
              return null;
            }
          } else if (elementCount === 1) {
            if (child instanceof HTMLDivElement) {
              description = child;
            } else {
              console.error(`Illegal child of track list <li> item, element index ${i + 1} to be a <div> but it was a <${child.nodeName.toLowerCase()}>`, child);
              return null;
            }
          } else {
            console.error(`Illegal child of track list <li> item, expected only 2 child elements but found element ${i + 1} which is a <${child.nodeName.toLowerCase()}>`, child);
            return null;
          }
          ++elementCount;
        }
      }

      if (!link) {
        console.error(`Track list <li> item gas no link child`);
        return null;
      }
      link.className = "waveform-player-track-list-link";

      let peakCSV = link.getAttribute("data-peaks");
      if (peakCSV === null || peakCSV === "") {
        console.error(`<a href="${link.href}"> track has no data-peaks attribute.`);
        peakCSV = "0";
      }
      let peaks = parseCSV(peakCSV, link.href);

      if (!description) {
        description = document.createElement("div");
        listItem.appendChild(description);
      }
      description.style.visibility = "hidden";
      description.className = "waveform-player-track-list-item-description";

      let subsections = this._parseDescriptionSubsections(description, link.href);

      let track = new Track(link.href, listItem, description, peaks, subsections);
      track.ontimeupdate = this._handleTrackTimeUpdate.bind(this);
      track.onended = this._handleTrackEnded.bind(this);
      track.onbufferingchange = this._handleTrackBufferingChange.bind(this);
      tracks.push(track);
      if (this._trackByAudioSrc[link.href]) {
        console.error(`More than one track has the url "${link.href}"`);
      }
      this._trackByAudioSrc[link.href] = track;
    }
    // hide then re-show elements to prevent CSS fade animation being visible on startup
    requestAnimationFrame(() => {
      let descriptions = this.wrapper.getElementsByClassName("waveform-player-track-list-item-description");
      for (let i = 0; i < descriptions.length; i++) {
        (descriptions[i] as HTMLDivElement).style.visibility = "";
      }
    });
    return tracks;
  }

  private _parseDescriptionSubsections(description: HTMLElement, trackLink: string) {
    let subsections: Subsection[] = [];
    let subsectionsEls = description.getElementsByClassName("subsection");
    let prevSubsection: Subsection;
    for (let i = 0; i < subsectionsEls.length; i++) {
      let subsectionEl = subsectionsEls[i] as HTMLElement;
      let text = subsectionEl.textContent.trim().replace(/\s+/g, " ");
      // matches e.g. "1:23 - title" or "1:23 to 4:56 - title"
      let match = text.match(/^(\d:\d\d)\s*(?:(?:-|to)\s*(\d:\d\d))?\s*(?::|-)?\s*(.*)/i);
      if (!match) {
        console.error(`Subsection doesn't have correct text format "1:23 - title" or "1:23 to 4:56 - title": "${text}"`);
      } else {
        let a = document.createElement("a");
        a.href = trackLink;
        a.className = "waveform-player-subsection-play";
        while (subsectionEl.childNodes.length > 0) {
          a.appendChild(subsectionEl.firstChild);
        }
        subsectionEl.appendChild(a);
        let subsection = {
          startTime: parseTime(match[1]),
          endTime: parseTime(match[2]),
          title: match[3],
          element: subsectionEl
        };
        a.setAttribute("data-start-time", String(subsection.startTime));
        subsections.push(subsection);
        if (prevSubsection && prevSubsection.endTime === null) {
          prevSubsection.endTime = subsection.startTime;
        }
        prevSubsection = subsection;
      }
    }
    return subsections;
    function parseTime(time: string) {
      if (!time) {
        return null;
      }
      let [minutes, seconds] = time.split(":");
      return parseInt(minutes) * 60 + parseInt(seconds);
    }
  }

  private _onWaveformPositionSelect(relativePosition: number) {
    this._currentTrack.setRelativePosition(relativePosition);
    this._currentTrack.setPlaying(true);
    this._handlePlayingStateChange();
  }

  private _handleTrackTimeUpdate(track: Track = this._currentTrack) {

    if (track !== this._currentTrack) {
      return;
    }

    if (this._currentTrack.isBuffering) {
      this._currentTimeDiv.innerHTML = "loading...";
    } else {
      this._currentTimeDiv.innerHTML = niceTimeString(this._currentTrack.currentTime);
    }

    if (isNaN(this._currentTrack.totalTime)) {
      this._totalTimeDiv.style.opacity = "0";
    } else {
      this._totalTimeDiv.style.opacity = "1";
      this._totalTimeDiv.innerHTML = niceTimeString(this._currentTrack.totalTime);
      let smoothingDuration = this._currentTrack.isPlaying ? 1 : 0;
      this._waveform.setPlayheadPosition(this._currentTrack.currentTime, this._currentTrack.totalTime, smoothingDuration);
    }

    function niceTimeString(totalSeconds: number) {
      if (isNaN(totalSeconds)) {
        return "...";
      }
      let minutes = Math.floor(totalSeconds / 60);
      let seconds = String(Math.round(totalSeconds - (minutes * 60)));
      if (seconds.length === 1) {
        seconds = "0" + seconds;
      }
      return `${minutes}:${seconds}`;
    }
  }

  private _handleTrackBufferingChange(track: Track) {

    if (track !== this._currentTrack) {
      return;
    }

    this._handleTrackTimeUpdate(track);
    this._handlePlayingStateChange();
  }


  private _handleTrackEnded(track: Track) {
    if (this._currentTrack === track) {
      this._selectRelativeTrack(1);
    }
  }
}

function parseCSV(csv: string, href: string) {
  let warned = false;
  return csv.split(",").map(v => {
    let parsed = parseFloat(v);
    if (!warned && isNaN(parsed) || parsed > PEAK_DATA_MAX || parsed < PEAK_DATA_MIN) {
      warned = true;
      console.error(`<a href="${href}"> track's data-peaks attribute contains invalid CSV values "${parsed}"`);
    }
    parsed = parsed || 0;
    let adjusted = (parsed - PEAK_DATA_MIN) / (PEAK_DATA_MAX - PEAK_DATA_MIN);
    return Math.max(0, Math.min(1, adjusted));
  });
}

function browserSupportsRequiredFeatures() {
  let w = window as any;
  if (!w.HTMLAudioElement || !w.HTMLCanvasElement) {
    return false;
  }
  // features we use because we reckon they prolly ought to be supported by anything
  // that supports audio and canvas, but let's check anyway just in case.
  let fail: string;
  if (!("transform" in document.createElement("div").style)) {
    fail = "CSS transform";
  } else if (!("getComputedStyle" in window)) {
    fail = "getComputedStyle";
  } else if (!Array.prototype.indexOf) {
    fail = "Array.indexOf";
  } else if (!window.requestAnimationFrame) {
    fail = "requestAnimationFrame";
  } else if (!Date.now) {
    fail = "Date.now";
  }
  if (fail) {
    console.error(`Unnecessary restriction: this browser support audio and canvas but not ${fail}. User agent: ${navigator.userAgent}`);
    return false;
  }
  return true;
}
