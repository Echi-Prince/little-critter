/* TamaGOTCHii — simple virtual pet
   - No libraries
   - Saves in localStorage
*/

const $ = (sel) => document.querySelector(sel);

const els = {
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

  feedBtn: $("#feedBtn"),
  playBtn: $("#playBtn"),
  sleepBtn: $("#sleepBtn"),
  cleanBtn: $("#cleanBtn"),

  nameInput: $("#nameInput"),
  renameBtn: $("#renameBtn"),

  toggleSound: $("#toggleSound"),
  resetBtn: $("#resetBtn"),
};

const STORAGE_KEY = "tamagotchii_state_v1";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const now = () => Date.now();

function formatClock(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatAge(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;
  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  const pad = (x) => String(x).padStart(2, "0");
  return `${days}d ${pad(hh)}:${pad(mm)}`;
}

/* ===== Audio: tiny beeps via WebAudio (optional) ===== */
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

function blip() { beep(880, 0.05); }
function boop() { beep(520, 0.08); }
function warn() { beep(220, 0.12, "sawtooth", 0.06); }

/* ===== State ===== */
const defaultState = () => ({
  name: "Mochi",
  createdAt: now(),
  lastTick: now(),
  asleep: false,
  coins: 10,

  hunger: 75,     // 0..100 (higher is better)
  happy: 70,
  energy: 75,
  clean: 80,

  log: [],
});

let state = loadState() ?? defaultState();

/* ===== Persistence ===== */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===== UI helpers ===== */
function pushLog(msg) {
  const stamp = formatClock(new Date());
  state.log.unshift(`[${stamp}] ${msg}`);
  state.log = state.log.slice(0, 12);
  renderLog();
  saveState();
}

function showBubble(text, ms = 1100) {
  els.bubble.textContent = text;
  els.bubble.classList.remove("hidden");
  setTimeout(() => els.bubble.classList.add("hidden"), ms);
}

function setPetClass(cls) {
  els.pet.className = `pet ${cls}`;
}

function moodFromStats() {
  // Basic heuristic:
  const low = Math.min(state.hunger, state.happy, state.energy, state.clean);
  const avg = (state.hunger + state.happy + state.energy + state.clean) / 4;

  if (state.asleep) return "Zzz…";
  if (low < 18) return "Crisis";
  if (low < 35) return "Grumpy";
  if (avg > 78) return "Radiant";
  if (avg > 60) return "Chill";
  return "Meh";
}

function renderBars() {
  const setW = (el, v) => el.style.width = `${clamp(v, 0, 100)}%`;
  setW(els.barHunger, state.hunger);
  setW(els.barHappy, state.happy);
  setW(els.barEnergy, state.energy);
  setW(els.barClean, state.clean);
}

function renderLog() {
  els.log.innerHTML = "";
  for (const line of state.log) {
    const li = document.createElement("li");
    li.textContent = line;
    els.log.appendChild(li);
  }
}

function renderMeta() {
  els.name.textContent = state.name;
  els.coins.textContent = String(state.coins);
  els.mood.textContent = moodFromStats();
  els.age.textContent = formatAge(now() - state.createdAt);

  // Pet look:
  const low = Math.min(state.hunger, state.happy, state.energy, state.clean);

  if (state.asleep) {
    setPetClass("sleep");
  } else if (low < 20) {
    setPetClass("sad");
  } else if (state.happy > 75 && state.energy > 40) {
    setPetClass("happy");
    setTimeout(() => setPetClass("idle"), 800);
  } else {
    setPetClass("idle");
  }

  // Dirty indicator
  if (state.clean < 35) els.pet.classList.add("dirty");
}

function renderAll() {
  renderBars();
  renderLog();
  renderMeta();
}

function canAct() {
  if (state.asleep) {
    showBubble("...sleeping", 900);
    boop();
    return false;
  }
  return true;
}

/* ===== Game mechanics ===== */
function applyDecay(seconds) {
  // Decay rates per minute, converted to seconds
  // When asleep: energy rises, other stats decay slower.
  const s = seconds;

  if (state.asleep) {
    state.energy = clamp(state.energy + (s * 0.20), 0, 100); // ~+12/min
    state.hunger = clamp(state.hunger - (s * 0.06), 0, 100); // -3.6/min
    state.happy  = clamp(state.happy  - (s * 0.03), 0, 100); // -1.8/min
    state.clean  = clamp(state.clean  - (s * 0.04), 0, 100); // -2.4/min
  } else {
    state.hunger = clamp(state.hunger - (s * 0.10), 0, 100); // -6/min
    state.happy  = clamp(state.happy  - (s * 0.07), 0, 100); // -4.2/min
    state.energy = clamp(state.energy - (s * 0.06), 0, 100); // -3.6/min
    state.clean  = clamp(state.clean  - (s * 0.05), 0, 100); // -3/min
  }

  // Occasional warning if in trouble
  const low = Math.min(state.hunger, state.happy, state.energy, state.clean);
  if (!state.asleep && low < 18) warn();
}

function tick() {
  const t = now();
  const elapsedMs = t - state.lastTick;
  const elapsedSec = Math.max(0, elapsedMs / 1000);

  // If tab was inactive, cap decay to avoid huge jumps
  const cappedSec = Math.min(elapsedSec, 60);

  applyDecay(cappedSec);
  state.lastTick = t;

  // Update clock
  els.clock.textContent = formatClock(new Date());

  renderAll();
  saveState();
}

/* ===== Actions ===== */
function feed() {
  if (!canAct()) return;
  blip();
  state.hunger = clamp(state.hunger + 18, 0, 100);
  state.clean = clamp(state.clean - 6, 0, 100);
  pushLog(`${state.name} munched a meal.`);
  showBubble("nom nom");
  renderAll();
}

function play() {
  if (!canAct()) return;
  blip();
  state.happy = clamp(state.happy + 20, 0, 100);
  state.energy = clamp(state.energy - 10, 0, 100);
  state.hunger = clamp(state.hunger - 6, 0, 100);
  state.coins += 2;
  pushLog(`${state.name} played and earned 2 coins.`);
  showBubble("weee!");
  renderAll();
}

function clean() {
  if (!canAct()) return;
  boop();
  state.clean = clamp(state.clean + 25, 0, 100);
  state.happy = clamp(state.happy - 2, 0, 100);
  pushLog(`${state.name} got squeaky clean.`);
  showBubble("sparkle");
  renderAll();
}

function toggleSleep() {
  if (state.asleep) {
    state.asleep = false;
    blip();
    pushLog(`${state.name} woke up.`);
    showBubble("awake!");
  } else {
    state.asleep = true;
    boop();
    pushLog(`${state.name} fell asleep.`);
    showBubble("zzz");
  }
  renderAll();
  saveState();
}

/* ===== Shop ===== */
const shop = {
  snack: { price: 5, apply: () => {
    state.hunger = clamp(state.hunger + 10, 0, 100);
    state.happy = clamp(state.happy + 6, 0, 100);
    state.clean = clamp(state.clean - 2, 0, 100);
    pushLog(`Bought Snack (+Hunger, +Happy).`);
    showBubble("treat!");
    blip();
  }},
  toy: { price: 7, apply: () => {
    state.happy = clamp(state.happy + 14, 0, 100);
    state.energy = clamp(state.energy - 4, 0, 100);
    pushLog(`Bought Toy (+Happy).`);
    showBubble("play!");
    blip();
  }},
  battery: { price: 6, apply: () => {
    state.energy = clamp(state.energy + 16, 0, 100);
    pushLog(`Bought Battery (+Energy).`);
    showBubble("charged");
    boop();
  }},
  soap: { price: 4, apply: () => {
    state.clean = clamp(state.clean + 16, 0, 100);
    pushLog(`Bought Soap (+Clean).`);
    showBubble("fresh");
    boop();
  }},
};

function buy(itemKey) {
  if (!shop[itemKey]) return;
  if (state.asleep) {
    showBubble("wake first", 1000);
    warn();
    return;
  }
  const { price, apply } = shop[itemKey];
  if (state.coins < price) {
    showBubble("no coins", 900);
    warn();
    pushLog(`Not enough coins for ${itemKey}.`);
    return;
  }
  state.coins -= price;
  apply();
  renderAll();
  saveState();
}

/* ===== Controls ===== */
els.feedBtn.addEventListener("click", feed);
els.playBtn.addEventListener("click", play);
els.sleepBtn.addEventListener("click", toggleSleep);
els.cleanBtn.addEventListener("click", clean);

els.renameBtn.addEventListener("click", () => {
  const v = (els.nameInput.value || "").trim();
  if (!v) return;
  state.name = v.slice(0, 12);
  els.nameInput.value = "";
  blip();
  pushLog(`Name changed to ${state.name}.`);
  renderAll();
  saveState();
});

els.toggleSound.addEventListener("click", async () => {
  // Some browsers require a user gesture to start AudioContext; this counts.
  soundOn = !soundOn;
  els.toggleSound.setAttribute("aria-pressed", String(soundOn));
  els.toggleSound.textContent = `Sound: ${soundOn ? "ON" : "OFF"}`;

  if (soundOn) {
    ensureAudio();
    try { await audioCtx.resume(); } catch {}
    blip();
  }
});

els.resetBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  soundOn = false;
  els.toggleSound.setAttribute("aria-pressed", "false");
  els.toggleSound.textContent = "Sound: OFF";
  renderAll();
  pushLog("System reset. New pet initialized.");
});

/* Shop buttons */
document.querySelectorAll(".shop-item").forEach((btn) => {
  btn.addEventListener("click", () => buy(btn.dataset.item));
});

/* ===== Init ===== */
function init() {
  // If state loaded, reconcile missing fields safely
  state = { ...defaultState(), ...state };
  state.log = Array.isArray(state.log) ? state.log : [];
  state.lastTick = state.lastTick || now();

  // Catch-up decay based on time since lastTick (cap to 10 minutes)
  const deltaSec = clamp((now() - state.lastTick) / 1000, 0, 600);
  applyDecay(deltaSec);
  state.lastTick = now();

  renderAll();
  if (state.log.length === 0) pushLog("Boot complete. Pet ready.");

  // Ticking loop
  els.clock.textContent = formatClock(new Date());
  setInterval(tick, 1000);
}

init();
