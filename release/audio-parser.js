(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
"use strict";
/// <reference path="../../typings/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
var WaveformRenderer_1 = require("../player/WaveformRenderer");
var base64 = require("base64-js");
function init() {
    var previewCanvas = document.getElementById("preview-canvas");
    var waveform = new WaveformRenderer_1.WaveformRenderer(previewCanvas);
    waveform.setColours({
        upperPlayed: "#F80",
        lowerPlayed: "#FC8",
        upperUnplayed: "#F80",
        lowerUnplayed: "#FC8",
        mouseoverUpperPlayed: "#F80",
        mouseoverLowerPlayed: "#FC8"
    });
    var audioCtx = new AudioContext();
    var source;
    var fileInput = document.getElementById("file-input");
    var generateButton = document.getElementById("generate-button");
    generateButton.onclick = handleGenerateClick;
    var peakDataOutput = document.getElementById("peak-data-output");
    var playerWidthInput = document.getElementById("player-width-input");
    function handleGenerateClick() {
        if (fileInput.files.length === 0) {
            alert("No file senected!");
            return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) { return handleAudioFile(reader.result); };
        reader.readAsArrayBuffer(fileInput.files[0]);
    }
    function handleAudioFile(fileContent) {
        audioCtx.decodeAudioData(fileContent, function (buffer) { return handleAudioBuffer(buffer); }, function (e) { return alert("Error decoding audio data, are you sure that was a valid audio file? (" + e + ")"); });
    }
    function handleAudioBuffer(file) {
        if (file.numberOfChannels === 0) {
            alert("File contains no audio data!");
        }
        else if (file.numberOfChannels === 1) {
            handleAudioSampleData(file.getChannelData(0));
        }
        else {
            var l = file.getChannelData(0);
            var r = file.getChannelData(1);
            var mono = new Float32Array(Math.min(l.length, r.length));
            var len = mono.length;
            for (var i = 0; i < len; i++) {
                mono[i] = (l[i] + r[i]) / 2;
            }
            handleAudioSampleData(mono);
        }
    }
    function handleAudioSampleData(data) {
        var width = playerWidthInput.valueAsNumber;
        if (!width) {
            alert("Invalid width number entered: " + width);
            return;
        }
        previewCanvas.style.width = width + "px";
        if (width > 3000) {
            alert("That's a very wide player there. " + width + " pixels. Performance will likely be bad.");
        }
        var samples = width * 2;
        var resized = new Float32Array(samples);
        for (var i = 0; i < samples; i++) {
            var start = ~~(i / samples * data.length);
            var end = ~~((i + 1) / samples * data.length);
            var max = data[start];
            for (var j = start; j < end; j++) {
                if (data[j] > max) {
                    max = data[j];
                }
            }
            resized[i] = Math.max(0, Math.min(1, max));
        }
        waveform.setPeakData(resized);
        var bytes = new Uint8ClampedArray(samples);
        var base = "!".charCodeAt(0);
        for (var i = 0; i < samples; i++) {
            bytes[i] = resized[i] * 256;
        }
        peakDataOutput.value = base64.fromByteArray(bytes);
    }
}
init();

},{"../player/WaveformRenderer":3,"base64-js":1}],3:[function(require,module,exports){
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

},{"./shared":4}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makeNumberArray(length) {
    if ("Float32Array" in window) {
        return new Float32Array(length);
    }
    return new Array(length);
}
exports.makeNumberArray = makeNumberArray;

},{}]},{},[2]);
