/* TamaGOTCHii (stable rebuild)
   - Stats, actions, decay, event log
   - Mini-games (Coin Pop + Reaction) for coins
   - Shop: boosts + cosmetics (buy once, equip)
   - Weather by city (Open-Meteo; no key)
   - localStorage persistence
   - Modal never starts open; can close via X / ESC / click outside
*/

const $ = (sel) => document.querySelector(sel);

const els = {
  device: $("#device"),
  pet: $("#pet"),
  bubble: $("#bubble"),
  name: $("#petName"),
  mood: $("#petMood"),
  age: $("#petAge"),
  clock: $("#clock"),

  barHunger: $("#barHunger"),
  barHappy: $("#barHappy"),
  barEnergy: $("#barEnergy"),
  barClean: $("#barClean"),

  log: $("#logList"),
  coins: $("#coins"),
  coinsMini: $("#coinsMini"),

  feedBtn: $("#feedBtn"),
  playBtn: $("#playBtn"),
  sleepBtn: $("#sleepBtn"),
  cleanBtn: $("#cleanBtn"),
  gamesBtn: $("#gamesBtn"),

  nameInput: $("#nameInput"),
  renameBtn: $("#renameBtn"),

  toggleSound: $("#toggleSound"),
  resetBtn: $("#resetBtn"),

  shopBoosts: $("#shopBoosts"),
  shopCos: $("#shopCos"),
  tabBoosts: $("#tabBoosts"),
  tabCos: $("#tabCos"),

  gameModal: $("#gameModal"),
  closeGameModal: $("#closeGameModal"),
  gameHome: $("#gameHome"),
  gameStage: $("#gameStage"),
  backToGames: $("#backToGames"),
  startCoinPop: $("#startCoinPop"),
  startReaction: $("#startReaction"),

  cityInput: $("#cityInput"),
  weatherBtn: $("#weatherBtn"),
  weatherCity: $("#weatherCity"),
  weatherNow: $("#weatherNow"),
  weatherTemp: $("#weatherTemp"),
  weatherWind: $("#weatherWind"),
  weatherMsg: $("#weatherMsg"),
};

const STORAGE_KEY = "tamagotchii_state_stable_v3";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const now = () => Date.now();

function pad2(x){ return String(x).padStart(2,"0"); }
function formatClock(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function formatAge(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;
  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  return `${days}d ${pad2(hh)}:${pad2(mm)}`;
}

/* ===== Audio (optional) ===== */
let audioCtx = null;
let soundOn = false;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq = 880, dur = 0.06, type = "square", gain = 0.05) {
  if (!soundOn) return;
  ensureAudio();
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.linearRampToValueAtTime(0, t + dur);

  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
const blip = () => beep(880, 0.05
