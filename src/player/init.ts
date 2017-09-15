
import {Player} from "./Player";

// Code in this file runs automatically when the script is included in the page

const WRAPPER_CLASS_NAME = "waveform-player";

let playerIdCounter = 0;
let players: { [id: string]: Player } = {};

// This function is automatically called when the page loads. It should be
// called again whenever new waveform players are added or removed from the
// page, e.g. if you're loading new content with AJAX.
export function initialiseWaveformPlayers() {
  let wrappers = document.getElementsByClassName(WRAPPER_CLASS_NAME);
  let activePlayers: { [key: string]: boolean } = {};
  for (let i = 0; i < wrappers.length; i++) {
    let wrapper = wrappers[i];
    if (wrapper instanceof HTMLDivElement) {
      if (wrapper.hasAttribute("data-disable-waveform-player")) continue;
      let playerId = wrapper.getAttribute("data-waveform-player-id");
      if (playerId === null) {
        playerId = String(++playerIdCounter);
        let player = new Player(wrapper);
        player.onplay = handlePlayerPlay;
        players[playerId] = player;
        wrapper.setAttribute("data-waveform-player-id", playerId);
      }
      activePlayers[playerId] = true;
    } else {
      console.error(`${WRAPPER_CLASS_NAME} class attribute is only supported on div elements!`);
    }
  }
  for (let playerId in players) {
    if (!activePlayers[playerId]) {
      players[playerId].destroy();
      delete players[playerId];
    }
  }
}

function handlePlayerPlay(activePlayer: Player) {
  for (let playerId in players) {
    if (players[playerId] !== activePlayer) {
      players[playerId].setPlaying(false);
    }
  }
}

(window as any).initialiseWaveformPlayers = initialiseWaveformPlayers;

let initialised = false;
function initOnce() {
  if (!initialised && document.readyState !== "loading") {
    initialised = true;
    initialiseWaveformPlayers();
  }
}

document.addEventListener("readystatechange", initOnce);
initOnce();