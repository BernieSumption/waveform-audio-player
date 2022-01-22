(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
"use strict";
/// <reference path="../../typings/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
var Track_1 = require("./Track");
var shared_1 = require("./shared");
var WaveformRenderer_1 = require("./WaveformRenderer");
var base64 = require("base64-js");
var SPECIAL_MODE_DISABLE = "disable";
// the lowest and highest values of peak data in the data-peaks="csv" attributes
var PEAK_DATA_MIN = 0;
var PEAK_DATA_MAX = 999;
var CONTROLS_HTML = "\n<div class=\"waveform-player-controls\">\n  <button class=\"waveform-player-controls-toggleplay\">toggle play</button>\n  <button class=\"waveform-player-controls-prev\">prev</button>\n  <button class=\"waveform-player-controls-next\">next</button>\n  <div class=\"waveform-player-controls-peakdata-wrapper\">\n    <canvas class=\"waveform-player-controls-peakdata\"></canvas>\n    <div class=\"waveform-player-controls-current-time\">0:13</div>\n    <div class=\"waveform-player-controls-total-time\">1:03</div>\n  </div>\n  <span class=\"waveform-player-upper-unplayed\"></span>\n  <span class=\"waveform-player-lower-unplayed\"></span>\n  <span class=\"waveform-player-upper-played\"></span>\n  <span class=\"waveform-player-lower-played\"></span>\n  <span class=\"waveform-player-mouseover-upper-played\"></span>\n  <span class=\"waveform-player-mouseover-lower-played\"></span>\n</div>\n<div class=\"waveform-player-show-more\"></div>\n";
exports.ASCII_PEAK_DATA_MAP = "!#$%()*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
var Player = /** @class */ (function () {
    function Player(wrapper) {
        var _this = this;
        this.wrapper = wrapper;
        this._tracks = [];
        this._trackByAudioSrc = {};
        this._isPlaying = false;
        this._hasHadInteraction = false;
        if (!browserSupportsRequiredFeatures()) {
            return;
        }
        var match = document.location.href.match(/\bplayerMode=(\w+)(&|$)/);
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
        wrapper.addEventListener("click", function (e) { return _this._handleClick(e); }, true);
        wrapper.addEventListener("mouseover", function (e) { return _this._handleMouseoverOut(e); }, true);
        wrapper.addEventListener("mouseout", function (e) { return _this._handleMouseoverOut(e); }, true);
        var tmp = document.createElement("div");
        tmp.innerHTML = CONTROLS_HTML.trim();
        this._controlsDiv = tmp.firstChild;
        while (tmp.childNodes.length > 0) {
            wrapper.insertBefore(tmp.lastChild, wrapper.firstChild);
        }
        this._prevButton = this._controlsDiv.getElementsByClassName("waveform-player-controls-prev")[0];
        this._nextButton = this._controlsDiv.getElementsByClassName("waveform-player-controls-next")[0];
        this._currentTimeDiv = this._controlsDiv.getElementsByClassName("waveform-player-controls-current-time")[0];
        this._totalTimeDiv = this._controlsDiv.getElementsByClassName("waveform-player-controls-total-time")[0];
        this._upperUnplayedTest = this._controlsDiv.getElementsByClassName("waveform-player-upper-unplayed")[0];
        this._lowerUnplayedTest = this._controlsDiv.getElementsByClassName("waveform-player-lower-unplayed")[0];
        this._upperPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-upper-played")[0];
        this._lowerPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-lower-played")[0];
        this._mouseoverUpperPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-mouseover-upper-played")[0];
        this._mouseoverLowerPlayedTest = this._controlsDiv.getElementsByClassName("waveform-player-mouseover-lower-played")[0];
        this._waveform = new WaveformRenderer_1.WaveformRenderer(this._controlsDiv.getElementsByClassName("waveform-player-controls-peakdata")[0]);
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
    Player.prototype.setPlaying = function (playing) {
        if (this._isPlaying !== playing) {
            this._togglePlay();
        }
    };
    Player.prototype._updateColoursFromCSS = function () {
        this._waveform.setColours({
            upperUnplayed: getColour(this._upperUnplayedTest),
            lowerUnplayed: getColour(this._lowerUnplayedTest),
            upperPlayed: getColour(this._upperPlayedTest),
            lowerPlayed: getColour(this._lowerPlayedTest),
            mouseoverUpperPlayed: getColour(this._mouseoverUpperPlayedTest),
            mouseoverLowerPlayed: getColour(this._mouseoverLowerPlayedTest)
        });
        function getColour(el) {
            var style = getComputedStyle(el);
            return style ? style.color : "";
        }
    };
    Player.prototype._handlePlayingStateChange = function () {
        var isPlaying = this._currentTrack.isPlaying;
        if (this._isPlaying !== isPlaying) {
            this._isPlaying = isPlaying;
            if (isPlaying) {
                this._resizeIfRequiredInterval = setInterval(this._handleExternalStyleChange.bind(this), 1000);
                if (this.onplay) {
                    this.onplay(this);
                }
            }
            else {
                clearInterval(this._resizeIfRequiredInterval);
            }
        }
        this._handleExternalStyleChange();
        this._prevButton.disabled = this._currentTrack === this._tracks[0];
        this._nextButton.disabled = this._currentTrack === this._tracks[this._tracks.length - 1];
        this._prevButton.style.visibility = this._nextButton.style.visibility = this._tracks.length < 2 ? "hidden" : "";
    };
    Player.prototype._updateClass = function () {
        var isPlaying = this._currentTrack.isPlaying;
        var className = "waveform-player waveform-player-enabled";
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
        }
        else if (this._currentTrack.description.scrollHeight > this._listUl.clientHeight) {
            className += " waveform-player-description-truncated";
        }
        this.wrapper.className = className;
    };
    Player.prototype._handleClick = function (e) {
        this._hasHadInteraction = true;
        var el = e.target;
        while (el && el.nodeName !== "A" && el.nodeName !== "BUTTON") {
            el = el.parentNode;
        }
        var isKeyboard = !(e.screenX || e.screenY);
        if (el instanceof HTMLAnchorElement) {
            if (!isKeyboard) {
                el.blur();
            }
            var track = this._trackByAudioSrc[el.href];
            if (track) {
                e.preventDefault();
                this._selectTrack(track);
                var startTimeString = el.getAttribute("data-start-time");
                this._currentTrack.setCurrentTime(parseFloat(startTimeString) || 0);
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
                    console.error("Unrecognised button class: \"" + el.className + "\"");
            }
        }
        this._handlePlayingStateChange();
    };
    Player.prototype._handleMouseoverOut = function (e) {
        var target = e.target;
        if (target instanceof HTMLAnchorElement && target.className === "waveform-player-subsection-play" && target.href === this._currentTrack.audioSrc) {
            var startTime = parseFloat(target.getAttribute("data-start-time"));
            if (!isNaN(startTime)) {
                if (e.type === "mouseover") {
                    this._waveform.setHighlightPosition(startTime, this._currentTrack.totalTime);
                }
                else {
                    this._waveform.clearHighlightPosition();
                }
            }
        }
    };
    Player.prototype.destroy = function () {
        if (this._waveform) {
            this._waveform.destroy();
        }
    };
    Player.prototype._handleExternalStyleChange = function () {
        for (var _i = 0, _a = this._tracks; _i < _a.length; _i++) {
            var track = _a[_i];
            track.update();
        }
        this._updateColoursFromCSS();
        this._updateClass();
    };
    Player.prototype._selectTrack = function (trackToSelect, startTime) {
        if (this._currentTrack !== trackToSelect) {
            this._currentTrack = trackToSelect;
            this._waveform.setPeakData(this._currentTrack.peakData);
            for (var _i = 0, _a = this._tracks; _i < _a.length; _i++) {
                var track = _a[_i];
                if (track === trackToSelect) {
                    track.setRelativePosition(0);
                    track.setPlaying(true, true);
                    track.setActive(true);
                }
                else {
                    track.setPlaying(false, true);
                    track.setActive(false);
                }
            }
        }
        else {
            this._currentTrack.setPlaying(true);
        }
        this._handleTrackTimeUpdate();
        this._handlePlayingStateChange();
    };
    Player.prototype._selectRelativeTrack = function (offset) {
        var newIndex = this._tracks.indexOf(this._currentTrack) + offset;
        if (this._tracks[newIndex]) {
            this._selectTrack(this._tracks[newIndex]);
        }
    };
    Player.prototype._togglePlay = function () {
        if (!this._currentTrack.isPlaying) {
            this._currentTrack.restart();
            this._selectTrack(this._currentTrack);
        }
        else {
            this._currentTrack.setPlaying(false);
            this._handleTrackTimeUpdate();
            this._handlePlayingStateChange();
        }
    };
    Player.prototype._parseTracks = function () {
        var _this = this;
        var firstChild = this.wrapper.firstElementChild;
        if (firstChild instanceof HTMLUListElement) {
            this._listUl = firstChild;
        }
        else {
            console.error(".waveform-player with no ul child");
            return null;
        }
        this._listUl.className = "waveform-player-track-list";
        var tracks = [];
        for (var i = 0; i < this._listUl.childNodes.length; i++) {
            if (this._listUl.childNodes[i].nodeName !== "LI") {
                continue;
            }
            var listItem = this._listUl.childNodes[i];
            var link = void 0;
            var description = void 0;
            var elementCount = 0;
            for (var i_1 = 0; i_1 < listItem.childNodes.length; i_1++) {
                var child = listItem.childNodes[i_1];
                if (child.nodeType === Node.TEXT_NODE) {
                    if (child.nodeValue.trim() !== "") {
                        console.error("Illegal text child of track list <li> item, expected one <a> element then one <div> element", child);
                        return null;
                    }
                }
                else if (child.nodeType === Node.ELEMENT_NODE) {
                    if (elementCount === 0) {
                        if (child instanceof HTMLAnchorElement) {
                            link = child;
                        }
                        else {
                            console.error("Illegal child of track list <li> item, element " + (i_1 + 1) + " to be a <a> but it was a <" + child.nodeName.toLowerCase() + ">", child);
                            return null;
                        }
                    }
                    else if (elementCount === 1) {
                        if (child instanceof HTMLDivElement) {
                            description = child;
                        }
                        else {
                            console.error("Illegal child of track list <li> item, element index " + (i_1 + 1) + " to be a <div> but it was a <" + child.nodeName.toLowerCase() + ">", child);
                            return null;
                        }
                    }
                    else {
                        console.error("Illegal child of track list <li> item, expected only 2 child elements but found element " + (i_1 + 1) + " which is a <" + child.nodeName.toLowerCase() + ">", child);
                        return null;
                    }
                    ++elementCount;
                }
            }
            if (!link) {
                console.error("Track list <li> item gas no link child");
                return null;
            }
            link.className = "waveform-player-track-list-link";
            var peakBase64 = link.getAttribute("data-peaks");
            if (peakBase64 === null || peakBase64 === "") {
                console.error("<a href=\"" + link.href + "\"> track has no data-peaks attribute.");
                peakBase64 = "0";
            }
            var peaks = parseDataPeaksAttrbute(peakBase64, link.href);
            if (!description) {
                description = document.createElement("div");
                listItem.appendChild(description);
            }
            description.style.visibility = "hidden";
            description.className = "waveform-player-track-list-item-description";
            var subsections = this._parseDescriptionSubsections(description, link.href);
            var track = new Track_1.Track(link.href, listItem, description, peaks, subsections);
            track.ontimeupdate = this._handleTrackTimeUpdate.bind(this);
            track.onended = this._handleTrackEnded.bind(this);
            track.onbufferingchange = this._handleTrackBufferingChange.bind(this);
            tracks.push(track);
            if (this._trackByAudioSrc[link.href]) {
                console.error("More than one track has the url \"" + link.href + "\"");
            }
            this._trackByAudioSrc[link.href] = track;
        }
        // hide then re-show elements to prevent CSS fade animation being visible on startup
        requestAnimationFrame(function () {
            var descriptions = _this.wrapper.getElementsByClassName("waveform-player-track-list-item-description");
            for (var i = 0; i < descriptions.length; i++) {
                descriptions[i].style.visibility = "";
            }
        });
        return tracks;
    };
    Player.prototype._parseDescriptionSubsections = function (description, trackLink) {
        var subsections = [];
        var subsectionsEls = description.getElementsByClassName("subsection");
        var prevSubsection;
        for (var i = 0; i < subsectionsEls.length; i++) {
            var subsectionEl = subsectionsEls[i];
            var text = subsectionEl.textContent.trim().replace(/\s+/g, " ");
            // matches e.g. "1:23 - title" or "1:23 to 4:56 - title"
            var match = text.match(/^(\d:\d\d(?:\.\d+)?)\s*(?:(?:-|to)\s*(\d:\d\d(?:\.\d+)?))?\s*(?::|-)?\s*(.*)/i);
            if (!match) {
                console.error("Subsection doesn't have correct text format \"1:23 - title\" or \"1:23 to 4:56 - title\": \"" + text + "\"");
            }
            else {
                var a = document.createElement("a");
                a.href = trackLink;
                a.className = "waveform-player-subsection-play";
                while (subsectionEl.childNodes.length > 0) {
                    a.appendChild(subsectionEl.firstChild);
                }
                subsectionEl.appendChild(a);
                var subsection = {
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
        function parseTime(time) {
            if (!time) {
                return null;
            }
            var _a = time.split(":"), minutes = _a[0], seconds = _a[1];
            return parseFloat(minutes) * 60 + parseFloat(seconds);
        }
    };
    Player.prototype._onWaveformPositionSelect = function (relativePosition) {
        this._currentTrack.setRelativePosition(relativePosition);
        this._currentTrack.setPlaying(true);
        this._handlePlayingStateChange();
    };
    Player.prototype._handleTrackTimeUpdate = function (track) {
        if (track === void 0) { track = this._currentTrack; }
        if (track !== this._currentTrack) {
            return;
        }
        if (this._currentTrack.isBuffering) {
            this._currentTimeDiv.innerHTML = "loading...";
        }
        else {
            this._currentTimeDiv.innerHTML = niceTimeString(this._currentTrack.currentTime);
        }
        if (isNaN(this._currentTrack.totalTime)) {
            this._totalTimeDiv.style.opacity = "0";
        }
        else {
            this._totalTimeDiv.style.opacity = "1";
            this._totalTimeDiv.innerHTML = niceTimeString(this._currentTrack.totalTime);
            var smoothingDuration = this._currentTrack.isPlaying ? 1 : 0;
            this._waveform.setPlayheadPosition(this._currentTrack.currentTime, this._currentTrack.totalTime, smoothingDuration);
        }
        function niceTimeString(totalSeconds) {
            if (isNaN(totalSeconds)) {
                return "...";
            }
            var minutes = Math.floor(totalSeconds / 60);
            var seconds = String(Math.round(totalSeconds - (minutes * 60)));
            if (seconds.length === 1) {
                seconds = "0" + seconds;
            }
            return minutes + ":" + seconds;
        }
    };
    Player.prototype._handleTrackBufferingChange = function (track) {
        if (track !== this._currentTrack) {
            return;
        }
        this._handleTrackTimeUpdate(track);
        this._handlePlayingStateChange();
    };
    Player.prototype._handleTrackEnded = function (track) {
        if (this._currentTrack === track) {
            this._selectRelativeTrack(1);
        }
    };
    return Player;
}());
exports.Player = Player;
function parseDataPeaksAttrbute(value, href) {
    var warned = false;
    var bytes = base64.toByteArray(value);
    var peaks = shared_1.makeNumberArray(bytes.length);
    for (var i = 0; i < peaks.length; i++) {
        peaks[i] = bytes[i] / 255;
    }
    return peaks;
}
function browserSupportsRequiredFeatures() {
    var w = window;
    if (!w.HTMLAudioElement || !w.HTMLCanvasElement) {
        return false;
    }
    // features we use because we reckon they prolly ought to be supported by anything
    // that supports audio and canvas, but let's check anyway just in case.
    var fail;
    if (!("transform" in document.createElement("div").style)) {
        fail = "CSS transform";
    }
    else if (!("getComputedStyle" in window)) {
        fail = "getComputedStyle";
    }
    else if (!Array.prototype.indexOf) {
        fail = "Array.indexOf";
    }
    else if (!window.requestAnimationFrame) {
        fail = "requestAnimationFrame";
    }
    else if (!Date.now) {
        fail = "Date.now";
    }
    if (fail) {
        console.error("Unnecessary restriction: this browser support audio and canvas but not " + fail + ". User agent: " + navigator.userAgent);
        return false;
    }
    return true;
}

},{"./Track":3,"./WaveformRenderer":4,"./shared":6,"base64-js":1}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FFT_SMOOTHING_CONSTANT = 0.5; // higher values make the bars less jumpy
var FFT_BAR_RELATIVE_WIDTH = 0.9;
var FFT_BAR_COLOR = "rgba(255, 255, 255, 0.1)";
var FFT_BAR_BIN_POWER = 1.3; // each FFT bar covers this factor more frequency spectrum than the last, so 2 means one bar per octave
var FFT_MIN_DECIBELS = -70;
var FFT_MAX_DECIBELS = -20;
var GLOBAL_CONTEXT = null;
var GLOBAL_ANALYSER = null;
var SUPPORTS_AUDIO_CONTEXT = "AudioContext" in window || "webkitAudioContext" in window;
var Track = /** @class */ (function () {
    function Track(audioSrc, _listItem, _description, peakData, subsections) {
        var _this = this;
        this.audioSrc = audioSrc;
        this._listItem = _listItem;
        this._description = _description;
        this.peakData = peakData;
        this.subsections = subsections;
        this._playing = false;
        this._waitingForAudioStart = false;
        this._active = false;
        this._resumeTime = 0;
        this._buffering = false;
        this._playingLastBufferCheck = false;
        this._frequencyDomainData = null;
        this.ontimeupdate = null;
        this.onended = null;
        this.onbufferingchange = null;
        this._handleTimeUpdate = function () {
            _this._updateSubsectionDisplay();
            if (_this._audio.currentTime > 0) {
                _this._waitingForAudioStart = false;
            }
            if (_this.ontimeupdate) {
                _this.ontimeupdate(_this);
            }
        };
        this._handleEnded = function () {
            if (_this.onended) {
                _this.onended(_this);
            }
        };
        this._handleStoppedDueToError = function () {
            _this._waitingForAudioStart = true;
        };
        this._checkPlayState = function () {
            var buffering = _this._playing && _this._playingLastBufferCheck && _this.currentTime === _this._timeLastBufferCheck && !_this._audio.ended;
            if (_this._buffering !== buffering) {
                _this._buffering = buffering;
                if (_this.onbufferingchange) {
                    _this.onbufferingchange(_this);
                }
            }
            _this._playingLastBufferCheck = _this._playing;
            _this._timeLastBufferCheck = _this.currentTime;
        };
        this._nextFFTRenderScheduled = false;
        this._metaSrc = audioSrc.replace(/\.\w+$/, ".meta");
        this._audio = document.createElement("audio");
        this._audio.preload = "metadata";
        this._audio.src = audioSrc;
        this._audio.addEventListener("timeupdate", this._handleTimeUpdate);
        this._audio.addEventListener("loadedmetadata", this._handleTimeUpdate);
        this._audio.addEventListener("end", this._handleEnded);
        this._audio.addEventListener("error", this._handleStoppedDueToError);
        this._audio.addEventListener("stalled", this._handleStoppedDueToError);
        document.body.appendChild(this._audio);
        this._audio.load();
        subsections.sort(function (a, b) { return a.startTime - b.startTime; });
        this._updateClass();
        this._updateSubsectionDisplay();
        if (SUPPORTS_AUDIO_CONTEXT) {
            this._fftCanvas = document.createElement("canvas");
            this._fftCanvas.className = "waveform-player-track-fft-canvas";
            this._listItem.firstElementChild.appendChild(this._fftCanvas);
            this._fftContext = this._fftCanvas.getContext("2d");
        }
    }
    Track.prototype.setPlaying = function (playing, reset) {
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
        }
        else {
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
            }
            else {
                this._audio.pause();
                clearInterval(this._playStateDetectionInterval);
                this._checkPlayState();
            }
            this._updateClass();
        }
    };
    Track.prototype.setActive = function (active) {
        if (active !== this._active) {
            this._active = active;
            this._updateClass();
        }
    };
    Track.prototype.setRelativePosition = function (relativePosition) {
        this._resumeTime = this._audio.duration * relativePosition || 0;
        this._audio.play();
        this._audio.currentTime = this._resumeTime;
    };
    Track.prototype.setCurrentTime = function (currentTime) {
        this._audio.currentTime = currentTime || 0;
    };
    Track.prototype.restart = function () {
        this._audio.currentTime = 0;
    };
    Track.prototype.update = function () {
        this._updateDescriptionMaxHeight();
    };
    Object.defineProperty(Track.prototype, "isPlaying", {
        get: function () {
            return this._playing;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Track.prototype, "isBuffering", {
        get: function () {
            return this._buffering;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Track.prototype, "currentTime", {
        get: function () {
            return this._audio.currentTime;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Track.prototype, "totalTime", {
        get: function () {
            return this._audio.duration;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Track.prototype, "description", {
        get: function () {
            return this._description;
        },
        enumerable: true,
        configurable: true
    });
    Track.prototype._updateDescriptionMaxHeight = function () {
        var desiredHeight = 0;
        if (this._playing) {
            desiredHeight = this._description.scrollHeight;
        }
        if (this._descriptionMaxHeight !== desiredHeight) {
            this._descriptionMaxHeight = desiredHeight;
            this._description.style.maxHeight = desiredHeight + "px";
        }
    };
    Track.prototype._updateSubsectionDisplay = function () {
        var activeSubsection = null;
        for (var _i = 0, _a = this.subsections; _i < _a.length; _i++) {
            var subsction = _a[_i];
            if (activeSubsection === null && subsction.startTime <= this.currentTime && (!subsction.endTime || subsction.endTime > this.currentTime)) {
                activeSubsection = subsction;
                activeSubsection.element.className = "waveform-player-subsection waveform-player-active-subsection";
            }
            else {
                subsction.element.className = "waveform-player-subsection";
            }
        }
    };
    Track.prototype._updateClass = function () {
        var className = "waveform-player-track-list-item";
        if (this._active) {
            className += " waveform-player-track-list-item-active";
        }
        if (this._playing) {
            className += " waveform-player-track-list-item-playing";
        }
        this._listItem.className = className;
        this._updateDescriptionMaxHeight();
    };
    Track.prototype._setupAudioContext = function () {
        if (this._audioSource) {
            return;
        }
        if (GLOBAL_CONTEXT === null) {
            GLOBAL_CONTEXT = new (window["AudioContext"] || window["webkitAudioContext"])();
            GLOBAL_ANALYSER = GLOBAL_CONTEXT.createAnalyser();
            GLOBAL_ANALYSER.minDecibels = FFT_MIN_DECIBELS;
            GLOBAL_ANALYSER.maxDecibels = FFT_MAX_DECIBELS;
            GLOBAL_ANALYSER.smoothingTimeConstant = FFT_SMOOTHING_CONSTANT;
        }
        this._audioSource = GLOBAL_CONTEXT.createMediaElementSource(this._audio);
    };
    Track.prototype._startFFTRenderLoop = function () {
        var _this = this;
        var renderDelegate = function () {
            _this._renderFFT();
            if (_this._playing && !_this._nextFFTRenderScheduled) {
                _this._nextFFTRenderScheduled = true;
                requestAnimationFrame(renderDelegate);
            }
        };
        renderDelegate();
    };
    Track.prototype._renderFFT = function () {
        this._nextFFTRenderScheduled = false;
        var width = this._fftCanvas.offsetWidth;
        var height = this._fftCanvas.offsetHeight;
        if (this._fftCanvas.width !== width || this._fftCanvas.height !== height) {
            this._fftCanvas.width = width;
            this._fftCanvas.height = height;
        }
        var ctx = this._fftContext;
        ctx.clearRect(0, 0, width, height);
        if (this._playing) {
            if (!this._frequencyDomainData) {
                this._frequencyDomainData = new Uint8Array(GLOBAL_ANALYSER.frequencyBinCount);
            }
            GLOBAL_ANALYSER.getByteFrequencyData(this._frequencyDomainData);
            var bars = [];
            var binSize = 1;
            var i = 0;
            while (true) {
                var binSum = 0;
                for (var bin = 0; bin < binSize; bin++) {
                    binSum += this._frequencyDomainData[i++];
                }
                if (i > this._frequencyDomainData.length) {
                    break;
                }
                bars.push(binSum / binSize / 255);
                binSize *= FFT_BAR_BIN_POWER;
            }
            ctx.fillStyle = FFT_BAR_COLOR;
            var barWidth = width / bars.length;
            for (var i_1 = 0; i_1 < bars.length; i_1++) {
                ctx.fillRect(barWidth * i_1, height, barWidth * FFT_BAR_RELATIVE_WIDTH, -bars[i_1] * height);
                binSize *= FFT_BAR_BIN_POWER;
            }
        }
    };
    return Track;
}());
exports.Track = Track;

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shared_1 = require("./shared");
var PEAK_DATA_TRANSITION_TIME_SECONDS = 0.6;
var PEAK_RESAMPLING_PIXELS_PER_PEAK = 1;
// at "1" one waveform fades into another simultaneously across the whole peak graph
// higher values introduce a wiping effect. At 2, the wipe will be 1/2 the width of the graph
var PEAK_DATA_TRANSITION_STAGGER = 2;
// while transitioning from one waveform to another, sine waves will wibble the graph.
// Yes "wibble" is a verb. I checked.
var WIBBLE_AMPLITUDE = 0.35;
var WIBBLE_WAVELENGTH = 0.2;
var WaveformRenderer = /** @class */ (function () {
    function WaveformRenderer(_canvas) {
        this._canvas = _canvas;
        this._rawCurrentPeaks = [0];
        this._rawPreviousPeaks = [0];
        this._resampledCurrentPeaks = [0];
        this._resampledPreviousPeaks = [0];
        this._transitioningPeaks = [0];
        this._peakDataTransitionStartTime = 0;
        this._transitionProgress = 1;
        this._previousTransitionProgress = 1;
        this._previousPlayheadPosition = 0;
        this._renderLoopRunning = false;
        this._nextRenderIsScheduled = false;
        this._playheadPosition = 0;
        this._playheadSmoothing = false;
        this._playheadSmoothingStartTime = 0;
        this._playheadSmoothingDuration = 0;
        this._playheadSmoothingPlayLength = 0;
        this._hasCurrentInteraction = false;
        this._mousePosition = 0;
        this._highlightPosition = 0;
        this._colours = {
            upperUnplayed: "#DDD",
            lowerUnplayed: "#FFF",
            upperPlayed: "#AAA",
            lowerPlayed: "#CCC",
            mouseoverUpperPlayed: "#888",
            mouseoverLowerPlayed: "#AAA"
        };
        this._handleWindowResizeDelegate = this._handleWindowResize.bind(this);
        this._ctx = _canvas.getContext("2d");
        this._render();
        window.addEventListener("resize", this._handleWindowResizeDelegate);
        this._setupInteractionHandlers();
    }
    WaveformRenderer.prototype.destroy = function () {
        window.removeEventListener("resize", this._handleWindowResizeDelegate);
    };
    WaveformRenderer.prototype.setPeakData = function (peakData) {
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
    };
    // because we don't get progress update events from the audio element very often, smoothSeconds
    // is an instruction to continue playing at the expected speed for that number of seconds
    WaveformRenderer.prototype.setPlayheadPosition = function (currentTime, totalTime, smoothSeconds) {
        if (smoothSeconds === void 0) { smoothSeconds = 0; }
        this._playheadPosition = currentTime / totalTime;
        if (smoothSeconds) {
            this._playheadSmoothing = true;
            this._playheadSmoothingStartTime = Date.now();
            this._playheadSmoothingPlayLength = totalTime;
            this._playheadSmoothingDuration = smoothSeconds;
        }
        else {
            this._playheadSmoothing = false;
        }
        this._startRenderLoop();
    };
    WaveformRenderer.prototype.setHighlightPosition = function (currentTime, totalTime) {
        this._highlightPosition = currentTime / totalTime;
        this._startRenderLoop();
    };
    WaveformRenderer.prototype.clearHighlightPosition = function () {
        this._highlightPosition = 0;
        this._startRenderLoop();
    };
    WaveformRenderer.prototype.setColours = function (colours) {
        this._colours = colours;
    };
    WaveformRenderer.prototype._startRenderLoop = function () {
        if (!this._renderLoopRunning) {
            this._renderLoopRunning = true;
            this._render();
        }
    };
    WaveformRenderer.prototype._render = function () {
        this._nextRenderIsScheduled = false;
        var width = Math.ceil(this._canvas.offsetWidth * (window.devicePixelRatio || 1));
        var height = Math.ceil(this._canvas.offsetHeight * (window.devicePixelRatio || 1));
        var isResized = this._resizeCanvas(width, height);
        this._transitionProgress = Math.min(1, (Date.now() - this._peakDataTransitionStartTime) / 1000 / PEAK_DATA_TRANSITION_TIME_SECONDS);
        if (this._transitionProgress < 1 || this._previousTransitionProgress < 1 || isResized || this._rawLastRenderedPeaks !== this._rawCurrentPeaks) {
            this._redrawPeakShape(width, height);
        }
        this._redrawColors(width, height);
        if (this._transitionProgress >= 1) {
            if (this._rawQueuedPeakData) {
                this.setPeakData(this._rawQueuedPeakData);
                this._rawQueuedPeakData = null;
            }
            else {
                this._renderLoopRunning = this._playheadSmoothingIsActive;
            }
        }
        this._previousTransitionProgress = this._transitionProgress;
        if (this._renderLoopRunning && !this._nextRenderIsScheduled) {
            this._nextRenderIsScheduled = true;
            requestAnimationFrame(this._render.bind(this));
        }
    };
    WaveformRenderer.prototype._resizeCanvas = function (width, height) {
        width = Math.min(width, 10000);
        height = Math.min(height, 10000);
        var isResized = false;
        if (this._canvas.width !== width || this._canvas.height !== height) {
            this._canvas.width = width;
            this._canvas.height = height;
            isResized = true;
            this._resampledCurrentPeaks = null;
            this._resampledPreviousPeaks = null;
        }
        if (!this._resampledCurrentPeaks) {
            this._resampledCurrentPeaks = shared_1.makeNumberArray(width / PEAK_RESAMPLING_PIXELS_PER_PEAK);
            resamplePeaks(this._rawCurrentPeaks, this._resampledCurrentPeaks);
        }
        if (!this._resampledPreviousPeaks) {
            this._resampledPreviousPeaks = shared_1.makeNumberArray(width / PEAK_RESAMPLING_PIXELS_PER_PEAK);
            resamplePeaks(this._rawPreviousPeaks, this._resampledPreviousPeaks);
        }
        return isResized;
    };
    WaveformRenderer.prototype._getSmoothedPlayheadPosition = function () {
        var playheadPosition = this._playheadPosition;
        this._playheadSmoothingIsActive = false;
        if (this._playheadSmoothing) {
            var now = Date.now();
            var elapsed = (now - this._playheadSmoothingStartTime) / 1000;
            if (elapsed < this._playheadSmoothingDuration) {
                this._playheadSmoothingIsActive = true;
            }
            playheadPosition += elapsed / this._playheadSmoothingPlayLength;
        }
        return Math.min(1, Math.max(0, playheadPosition));
    };
    WaveformRenderer.prototype._redrawPeakShape = function (width, height) {
        // draw the top half of the chart, then flip the bottom half over
        this._updateTransitioningPeaks();
        var peaks = this._transitioningPeaks;
        var len = peaks.length;
        var halfHeight = Math.ceil(height / 2) + 1;
        var minWaveHeight = halfHeight - 2;
        var ctx = this._ctx;
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);
        var peakWidth = width / peaks.length;
        for (var i = 0; i < len; i++) {
            ctx.lineTo(i * peakWidth, minWaveHeight - (peaks[i] * minWaveHeight));
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
    };
    WaveformRenderer.prototype._redrawColors = function (width, height) {
        var ctx = this._ctx;
        ctx.globalCompositeOperation = "source-atop";
        var playheadPosition = this._getSmoothedPlayheadPosition();
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
        }
        else if (this._highlightPosition) {
            drawGradient(this._colours.mouseoverUpperPlayed, this._colours.mouseoverLowerPlayed, this._highlightPosition, playheadPosition);
        }
        ctx.globalCompositeOperation = "source-over";
        function drawGradient(upperColor, lowerColor, xProportionFrom, xProportionTo) {
            if (xProportionTo === void 0) { xProportionTo = 0; }
            var grd = ctx.createLinearGradient(0, 0, 0, height);
            grd.addColorStop(0, upperColor);
            grd.addColorStop(1, lowerColor);
            ctx.fillStyle = grd;
            ctx.fillRect(width * xProportionFrom, 0, width * (xProportionTo - xProportionFrom), height);
        }
    };
    WaveformRenderer.prototype._setupInteractionHandlers = function () {
        var _this = this;
        var update = function (event, isOver, isConfirm, eventPos) {
            event.preventDefault();
            _this._hasCurrentInteraction = isOver;
            var canvasPos = _this._canvas.getBoundingClientRect();
            if (eventPos) {
                _this._mousePosition = (eventPos.pageX - canvasPos.left) / canvasPos.width;
            }
            _this._startRenderLoop();
            if (isConfirm && _this.onpositionselect) {
                _this.onpositionselect(_this._mousePosition);
            }
        };
        this._canvas.addEventListener("mouseover", function (e) { return update(e, true, false, e); });
        this._canvas.addEventListener("mousemove", function (e) { return update(e, true, false, e); });
        this._canvas.addEventListener("mouseout", function (e) { return update(e, false, false, e); });
        this._canvas.addEventListener("mouseup", function (e) { return update(e, true, true, e); });
        this._canvas.addEventListener("touchstart", function (e) { return update(e, true, false, e.targetTouches[0]); });
        this._canvas.addEventListener("touchmove", function (e) { return update(e, true, false, e.targetTouches[0]); });
        this._canvas.addEventListener("touchend", function (e) { return update(e, false, true, e.targetTouches[0]); });
    };
    WaveformRenderer.prototype._handleWindowResize = function () {
        if (document.body && !(this._canvas.compareDocumentPosition(document.body) & Node.DOCUMENT_POSITION_DISCONNECTED)) {
            this._startRenderLoop();
        }
    };
    WaveformRenderer.prototype._updateTransitioningPeaks = function () {
        if (this._transitioningPeaks.length !== this._resampledCurrentPeaks.length) {
            this._transitioningPeaks = shared_1.makeNumberArray(this._resampledCurrentPeaks.length);
        }
        var previous = this._resampledPreviousPeaks;
        var current = this._resampledCurrentPeaks;
        var destination = this._transitioningPeaks;
        var len = current.length;
        var wibbleRadians = 2 * Math.PI * (1 / WIBBLE_WAVELENGTH);
        for (var i = 0; i < len; i++) {
            // stagger causes the fade from previous to next waveform to wipe from left to right
            var staggerProgress = stagger(this._transitionProgress, i, len, PEAK_DATA_TRANSITION_STAGGER);
            // wibble is a wave of sine wave modulation following the transition
            var wibble = ease(1 - Math.abs(staggerProgress * 2 - 1));
            var peak = this._resampledPreviousPeaks[i] + (current[i] - previous[i]) * ease(staggerProgress);
            peak += Math.sin(i / len * wibbleRadians) * wibble * WIBBLE_AMPLITUDE;
            destination[i] = Math.max(0, Math.min(1, peak));
        }
    };
    return WaveformRenderer;
}());
exports.WaveformRenderer = WaveformRenderer;
function ease(input) {
    if (input < 0.5) {
        return (input * input) * 2;
    }
    var inverse = 1 - input;
    return 1 - ((inverse * inverse) * 2);
}
function stagger(input, index, count, staggerAmount) {
    var delay = index / count * (1 - (1 / staggerAmount));
    return ease(Math.min(1, Math.max(0, (input - delay) * staggerAmount)));
}
function resamplePeaks(source, destination) {
    if (source.length === destination.length) {
        for (var i = 0; i < source.length; i++) {
            destination[i] = source[i];
        }
    }
    else if (source.length > destination.length) {
        // downsample taking max
        var skip = source.length / destination.length;
        var w = skip / 2;
        var pos = w;
        for (var i = 0; i < destination.length; i++) {
            var b0 = Math.floor(pos - w);
            var b1 = Math.min(Math.ceil(pos + w), source.length);
            pos += skip;
            var max = 0;
            for (var j = b0; j < b1; j++)
                max = Math.max(max, source[j]);
            destination[i] = max;
        }
    }
    else {
        // upsample using linear interpolation
        var skip = (source.length - 1) / destination.length;
        for (var i = 0; i < destination.length; i++) {
            var pos = i * skip;
            var ipos = Math.floor(pos);
            var fpos = pos - ipos;
            var p0 = Math.max(ipos, 0);
            var p1 = Math.min(ipos + 1, source.length - 1);
            var val = (1 - fpos) * source[p0] + (fpos) * source[p1];
            destination[i] = val;
        }
    }
}

},{"./shared":6}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Player_1 = require("./Player");
// Code in this file runs automatically when the script is included in the page
var WRAPPER_CLASS_NAME = "waveform-player";
var playerIdCounter = 0;
var players = {};
// This function is automatically called when the page loads. It should be
// called again whenever new waveform players are added or removed from the
// page, e.g. if you're loading new content with AJAX.
function initialiseWaveformPlayers() {
    var wrappers = document.getElementsByClassName(WRAPPER_CLASS_NAME);
    var activePlayers = {};
    for (var i = 0; i < wrappers.length; i++) {
        var wrapper = wrappers[i];
        if (wrapper instanceof HTMLDivElement) {
            if (wrapper.hasAttribute("data-disable-waveform-player"))
                continue;
            var playerId = wrapper.getAttribute("data-waveform-player-id");
            if (playerId === null) {
                playerId = String(++playerIdCounter);
                var player = new Player_1.Player(wrapper);
                player.onplay = handlePlayerPlay;
                players[playerId] = player;
                wrapper.setAttribute("data-waveform-player-id", playerId);
            }
            activePlayers[playerId] = true;
        }
        else {
            console.error(WRAPPER_CLASS_NAME + " class attribute is only supported on div elements!");
        }
    }
    for (var playerId in players) {
        if (!activePlayers[playerId]) {
            players[playerId].destroy();
            delete players[playerId];
        }
    }
}
exports.initialiseWaveformPlayers = initialiseWaveformPlayers;
function handlePlayerPlay(activePlayer) {
    for (var playerId in players) {
        if (players[playerId] !== activePlayer) {
            players[playerId].setPlaying(false);
        }
    }
}
window.initialiseWaveformPlayers = initialiseWaveformPlayers;
var initialised = false;
function initOnce() {
    if (!initialised && document.readyState !== "loading") {
        initialised = true;
        initialiseWaveformPlayers();
    }
}
document.addEventListener("readystatechange", initOnce);
initOnce();

},{"./Player":2}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makeNumberArray(length) {
    if ("Float32Array" in window) {
        return new Float32Array(length);
    }
    return new Array(length);
}
exports.makeNumberArray = makeNumberArray;

},{}]},{},[5]);
