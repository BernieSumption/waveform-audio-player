// define variables

import { WaveformRenderer } from "../player/WaveformRenderer";
import { ASCII_PEAK_DATA_MAP } from "../player/Player";

function init() {

  let previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement;

  let waveform = new WaveformRenderer(previewCanvas);
  waveform.setColours({
    upperPlayed: "#F80",
    lowerPlayed: "#FC8",
    upperUnplayed: "#F80",
    lowerUnplayed: "#FC8",
    mouseoverUpperPlayed: "#F80",
    mouseoverLowerPlayed: "#FC8"
  });

  let audioCtx = new AudioContext();
  let source: AudioBufferSourceNode;

  let fileInput = document.getElementById("file-input") as HTMLInputElement;

  let generateButton = document.getElementById("generate-button") as HTMLInputElement;
  generateButton.onclick = handleGenerateClick;

  let peakDataOutput = document.getElementById("peak-data-output") as HTMLTextAreaElement;
  let playerWidthInput = (document.getElementById("player-width-input") as HTMLInputElement);


  function handleGenerateClick() {
    if (fileInput.files.length === 0) {
      alert("No file senected!");
      return;
    }

    let reader = new FileReader();
    reader.onload = ev => handleAudioFile(reader.result);
    reader.readAsArrayBuffer(fileInput.files[0]);
  }

  function handleAudioFile(fileContent: ArrayBuffer) {

    audioCtx.decodeAudioData(
      fileContent,
      buffer => handleAudioBuffer(buffer),
      e => alert(`Error decoding audio data, are you sure that was a valid audio file? (${e})`)
    );

  }

  function handleAudioBuffer(file: AudioBuffer) {
    if (file.numberOfChannels === 0) {
      alert("File contains no audio data!");
    } else if (file.numberOfChannels === 1) {
      handleAudioSampleData(file.getChannelData(0));
    } else {
      let l = file.getChannelData(0);
      let r = file.getChannelData(1);
      let mono = new Float32Array(Math.min(l.length, r.length));
      let len = mono.length;
      for (let i = 0; i < len; i++) {
        mono[i] = (l[i] + r[i]) / 2;
      }
      handleAudioSampleData(mono);
    }
  }

  function handleAudioSampleData(data: Float32Array) {
    let width = playerWidthInput.valueAsNumber;
    if (!width) {
      alert("Invalid width number entered: " + width);
      return;
    }
    previewCanvas.style.width = `${width}px`;
    if (width > 3000) {
      alert(`That's a very wide player there. ${width} pixels. Performance will likely be bad.`);
    }
    let samples = width * 2;
    let resized = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let start = ~~(i / samples * data.length);
      let end = ~~((i + 1) / samples * data.length);
      let max = data[start];
      for (let j = start; j < end; j++) {
        if (data[j] > max) {
          max = data[j];
        }
      }
      resized[i] = Math.max(0, Math.min(1, max));
    }
    waveform.setPeakData(resized);
    let chars: string[] = [];
    let base = "!".charCodeAt(0);
    for (let i = 0; i < samples; i++) {
      let code = ~~Math.min(resized[i] * ASCII_PEAK_DATA_MAP.length, ASCII_PEAK_DATA_MAP.length - 1);
      chars.push(ASCII_PEAK_DATA_MAP[code]);
    }
    peakDataOutput.value = chars.join("");
  }
}

init();