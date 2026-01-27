/* TamaGOTCHii — upgrades:
   - Mini-games (Coin Pop, Reaction) to earn coins
   - Cosmetics shop (buy once, equip)
   - Weather lookup by city (Open-Meteo: geocoding + forecast; no API key)
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

  feedBtn: $("#feedBtn"),
  playBtn: $("#playBtn"),
  sleepBtn: $("#sleepBtn"),
  cleanBtn: $("#cleanBtn"),
  gamesBtn: $("#gamesBtn"),

  nameInput: $("#nameInput"),
  renameBtn: $("#renameBtn"),

  toggleSound: $("#toggleSound"),
  resetBtn: $("#resetBtn"),

  // Shop UI (dynamic)
  shopBoosts: $("#shopBoosts"),
  shopCos: $("#shopCos"),
  tabBoosts: $("#tabBoosts"),
  tabCos: $("#tabCos"),

  // Mini-game modal
  gameModal: $("#gameModal"),
  closeGameModal: $("#closeGameModal"),
  gameHome: $("#gameHome"),
  gameStage: $("#gameStage"),
  backToGames: $("#backToGames"),
  coinsMini: $("#coinsMini"),
  startCoinPop: $("#startCoinPop"),
  startReaction: $("#startReaction"),

  // Weather
  cityInput: $("#cityInput"),
  weatherBtn: $("#weatherBtn"),
  weatherCity: $("#weatherCity"),
  weatherNow: $("#weatherNow"),
  weatherTemp: $("#weatherTemp"),
  weatherWind: $("#weatherWind"),
  weatherMsg: $("#weatherMsg"),
};

const STORAGE_KEY = "tamagotchii_state_v2";

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

/* ===== Audio beeps (optional) ===== */
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
const blip = () => beep(880, 0.05);
const boop = () => beep(520, 0.08);
const warn = () => beep(220, 0.12, "sawtooth", 0.06);

/* ===== State ===== */
const defaultState = () => ({
  name: "Mochi",
  createdAt: now(),
  lastTick: now(),
  asleep: false,
  coins: 10,

  hunger: 75,
  happy: 70,
  energy: 75,
  clean: 80,

  // cosmetics
  owned: {
    acc: [],      // ["cap","bow","shades"]
    shell: [],    // ["aqua","neon"]
  },
  equipped: {
    acc: "none",
    shell: "default",
  },

  // weather
  city: "",

  log: [],
});

let state = loadState() ?? defaultState();

/* ===== Persistence ===== */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // migrate from v1 if present
      const old = localStorage.getItem("tamagotchii_state_v1");
      if (old) {
        const parsedOld = JSON.parse(old);
        return { ...defaultState(), ...parsedOld };
      }
      return null;
    }
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
function renderCosmetics() {
  // accessory
  els.pet.dataset.acc = state.equipped.acc || "none";
  // shell theme
  els.device.classList.remove("shell-aqua", "shell-neon");
  if (state.equipped.shell === "aqua") els.device.classList.add("shell-aqua");
  if (state.equipped.shell === "neon") els.device.classList.add("shell-neon");
}
function renderMeta() {
  els.name.textContent = state.name;
  els.coins.textContent = String(state.coins);
  els.coinsMini.textContent = String(state.coins);
  els.mood.textContent = moodFromStats();
  els.age.textContent = formatAge(now() - state.createdAt);

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

  if (state.clean < 35) els.pet.classList.add("dirty");
}
function renderAll() {
  renderBars();
  renderLog();
  renderCosmetics();
  renderMeta();
}

/* ===== Game mechanics ===== */
function canAct() {
  if (els.gameModal && !els.gameModal.classList.contains("hidden")) {
    showBubble("busy", 700);
    boop();
    return false;
  }
  if (state.asleep) {
    showBubble("...sleeping", 900);
    boop();
    return false;
  }
  return true;
}

function applyDecay(seconds) {
  const s = seconds;

  if (state.asleep) {
    state.energy = clamp(state.energy + (s * 0.20), 0, 100);
    state.hunger = clamp(state.hunger - (s * 0.06), 0, 100);
    state.happy  = clamp(state.happy  - (s * 0.03), 0, 100);
    state.clean  = clamp(state.clean  - (s * 0.04), 0, 100);
  } else {
    state.hunger = clamp(state.hunger - (s * 0.10), 0, 100);
    state.happy  = clamp(state.happy  - (s * 0.07), 0, 100);
    state.energy = clamp(state.energy - (s * 0.06), 0, 100);
    state.clean  = clamp(state.clean  - (s * 0.05), 0, 100);
  }

  const low = Math.min(state.hunger, state.happy, state.energy, state.clean);
  if (!state.asleep && low < 18) warn();
}

function tick() {
  const t = now();
  const elapsedMs = t - state.lastTick;
  const elapsedSec = Math.max(0, elapsedMs / 1000);
  const cappedSec = Math.min(elapsedSec, 60);

  applyDecay(cappedSec);
  state.lastTick = t;

  els.clock.textContent = formatClock(new Date());
  renderAll();
  saveState();
}

/* ===== Pet actions ===== */
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
  if (els.gameModal && !els.gameModal.classList.contains("hidden")) return;

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

/* ===== Shop definitions ===== */
const boosts = [
  { key:"snack",  ico:"🍬", name:"Snack",   desc:"+Hunger, +Happy", price:5,  apply(){
    state.hunger = clamp(state.hunger + 10, 0, 100);
    state.happy  = clamp(state.happy  + 6,  0, 100);
    state.clean  = clamp(state.clean  - 2,  0, 100);
    pushLog(`Bought Snack (+Hunger, +Happy).`); showBubble("treat!"); blip();
  }},
  { key:"toy",    ico:"🪀", name:"Toy",     desc:"+Happy",          price:7,  apply(){
    state.happy  = clamp(state.happy  + 14, 0, 100);
    state.energy = clamp(state.energy - 4,  0, 100);
    pushLog(`Bought Toy (+Happy).`); showBubble("play!"); blip();
  }},
  { key:"battery",ico:"🔋", name:"Battery", desc:"+Energy",         price:6,  apply(){
    state.energy = clamp(state.energy + 16, 0, 100);
    pushLog(`Bought Battery (+Energy).`); showBubble("charged"); boop();
  }},
  { key:"soap",   ico:"🧼", name:"Soap",    desc:"+Clean",          price:4,  apply(){
    state.clean  = clamp(state.clean + 16, 0, 100);
    pushLog(`Bought Soap (+Clean).`); showBubble("fresh"); boop();
  }},
];

const cosmetics = [
  { key:"cap",   cat:"acc", ico:"🧢", name:"Cap",    desc:"Accessory", price:18 },
  { key:"bow",   cat:"acc", ico:"🎀", name:"Bow",    desc:"Accessory", price:16 },
  { key:"shades",cat:"acc", ico:"🕶️", name:"Shades", desc:"Accessory", price:20 },
  { key:"aqua",  cat:"shell", ico:"🌊", name:"Aqua Shell", desc:"Device theme", price:22 },
  { key:"neon",  cat:"shell", ico:"💚", name:"Neon Shell", desc:"Device theme", price:22 },
];

function ownsCos(item) {
  return state.owned[item.cat]?.includes(item.key);
}
function isEquippedCos(item) {
  if (item.cat === "acc") return (state.equipped.acc === item.key);
  if (item.cat === "shell") return (state.equipped.shell === item.key);
  return false;
}
function buyOrEquipCos(item) {
  if (state.asleep) { showBubble("wake first", 900); warn(); return; }

  if (!ownsCos(item)) {
    if (state.coins < item.price) {
      showBubble("no coins", 900);
      warn();
      pushLog(`Not enough coins for ${item.name}.`);
      return;
    }
    state.coins -= item.price;
    state.owned[item.cat].push(item.key);
    pushLog(`Bought cosmetic: ${item.name}.`);
    blip();
  }

  // Equip (single slot per category)
  if (item.cat === "acc") state.equipped.acc = item.key;
  if (item.cat === "shell") state.equipped.shell = item.key;

  pushLog(`Equipped: ${item.name}.`);
  showBubble("equipped");
  renderAll();
  renderShop();
  saveState();
}

function buyBoost(item) {
  if (state.asleep) { showBubble("wake first", 900); warn(); return; }
  if (state.coins < item.price) {
    showBubble("no coins", 900);
    warn();
    pushLog(`Not enough coins for ${item.name}.`);
    return;
  }
  state.coins -= item.price;
  item.apply();
  renderAll();
  renderShop();
  saveState();
}

function shopItemButton({ ico, name, desc, price, tagText, disabled }) {
  const btn = document.createElement("button");
  btn.className = "shop-item";
  btn.type = "button";
  if (disabled) btn.disabled = true;

  const left = document.createElement("div");
  left.className = "shop-ico";
  left.textContent = ico;

  const mid = document.createElement("div");
  mid.className = "shop-info";
  mid.innerHTML = `<div class="shop-name">${name}</div><div class="shop-desc">${desc}</div>`;

  const right = document.createElement("div");
  right.className = "shop-price";
  right.textContent = String(price);

  btn.append(left, mid, right);

  if (tagText) {
    const tag = document.createElement("span");
    tag.className = "shop-tag";
    tag.textContent = tagText;
    mid.querySelector(".shop-name").appendChild(tag);
  }

  return btn;
}

function renderShop() {
  // boosts
  els.shopBoosts.innerHTML = "";
  boosts.forEach((b) => {
    const btn = shopItemButton({
      ico: b.ico, name: b.name, desc: b.desc, price: b.price,
      tagText: "",
      disabled: false
    });
    btn.addEventListener("click", () => buyBoost(b));
    els.shopBoosts.appendChild(btn);
  });

  // cosmetics
  els.shopCos.innerHTML = "";
  cosmetics.forEach((c) => {
    const owned = ownsCos(c);
    const equipped = isEquippedCos(c);
    const tag = equipped ? "EQUIPPED" : (owned ? "OWNED" : "");
    const price = owned ? 0 : c.price;

    const btn = shopItemButton({
      ico: c.ico, name: c.name, desc: c.desc, price,
      tagText: tag,
      disabled: false
    });

    btn.addEventListener("click", () => buyOrEquipCos(c));
    els.shopCos.appendChild(btn);
  });
}

/* ===== Tabs ===== */
function showBoosts() {
  els.tabBoosts.classList.add("active");
  els.tabCos.classList.remove("active");
  els.shopBoosts.classList.remove("hidden");
  els.shopCos.classList.add("hidden");
}
function showCos() {
  els.tabCos.classList.add("active");
  els.tabBoosts.classList.remove("active");
  els.shopCos.classList.remove("hidden");
  els.shopBoosts.classList.add("hidden");
}

/* ===== Mini-games ===== */
let activeGame = null;
let gameTimers = [];

function clearGameTimers() {
  gameTimers.forEach((t) => clearTimeout(t));
  gameTimers = [];
}

function openGameModal() {
  if (state.asleep) { showBubble("wake first", 900); boop(); return; }
  els.gameModal.classList.remove("hidden");
  els.gameHome.classList.remove("hidden");
  els.gameStage.classList.add("hidden");
  els.gameStage.innerHTML = "";
  activeGame = null;
  clearGameTimers();
  renderMeta();
}

function closeGameModal() {
  els.gameModal.classList.add("hidden");
  els.gameHome.classList.remove("hidden");
  els.gameStage.classList.add("hidden");
  els.gameStage.innerHTML = "";
  activeGame = null;
  clearGameTimers();
}

function awardCoins(n, reason) {
  const amt = Math.max(0, Math.floor(n));
  if (amt <= 0) {
    pushLog(`Mini-game ended. No coins earned.`);
    warn();
    return;
  }
  state.coins += amt;
  pushLog(`Mini-game reward: +${amt} coins (${reason}).`);
  blip();
  showBubble(`+${amt} coins`, 1000);
  renderAll();
  renderShop();
  saveState();
}

function showStage(title, rightText) {
  els.gameHome.classList.add("hidden");
  els.gameStage.classList.remove("hidden");
  els.gameStage.innerHTML = "";

  const head = document.createElement("div");
  head.className = "stage-head";
  head.innerHTML = `<div>${title}</div><div>${rightText || ""}</div>`;
  els.gameStage.appendChild(head);
}

function startCoinPop() {
  activeGame = "coinpop";
  clearGameTimers();

  let score = 0;
  let timeLeft = 10;
  const totalCells = 16;
  let currentIndex = -1;

  showStage("COIN POP", "10s");

  const box = document.createElement("div");
  box.className = "stage-box";
  box.innerHTML = `<div class="muted small">Tap the highlighted coin. Each hit = +1. Misses don’t matter.</div>`;
  els.gameStage.appendChild(box);

  const info = document.createElement("div");
  info.className = "stage-box";
  info.innerHTML = `<div>Score: <span id="cpScore">0</span> • Time: <span id="cpTime">10</span>s</div>`;
  els.gameStage.appendChild(info);

  const board = document.createElement("div");
  board.className = "coin-board";
  const buttons = [];

  for (let i = 0; i < totalCells; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coin-btn";
    btn.textContent = "·";
    btn.addEventListener("click", () => {
      if (i === currentIndex) {
        score += 1;
        $("#cpScore").textContent = String(score);
        blip();
        spawnCoin();
      } else {
        boop();
      }
    });
    buttons.push(btn);
    board.appendChild(btn);
  }

  els.gameStage.appendChild(board);

  function spawnCoin() {
    if (currentIndex >= 0) {
      buttons[currentIndex].classList.remove("on");
      buttons[currentIndex].textContent = "·";
    }
    currentIndex = Math.floor(Math.random() * totalCells);
    buttons[currentIndex].classList.add("on");
    buttons[currentIndex].textContent = "¢";
  }

  function tickDown() {
    timeLeft -= 1;
    $("#cpTime").textContent = String(timeLeft);
    if (timeLeft <= 0) {
      end();
      return;
    }
    gameTimers.push(setTimeout(tickDown, 1000));
  }

  function end() {
    clearGameTimers();
    // reward: score coins + small bonus if you scored a lot
    const bonus = score >= 10 ? 3 : (score >= 6 ? 1 : 0);
    awardCoins(score + bonus, `Coin Pop score ${score}${bonus ? ` (+${bonus} bonus)` : ""}`);
    // freeze UI
    if (currentIndex >= 0) {
      buttons[currentIndex].classList.remove("on");
      buttons[currentIndex].textContent = "·";
    }
    pushLog("Coin Pop complete.");
  }

  spawnCoin();
  gameTimers.push(setTimeout(tickDown, 1000));
}

function startReaction() {
  activeGame = "reaction";
  clearGameTimers();

  showStage("REACTION", "");

  const box = document.createElement("div");
  box.className = "stage-box";
  box.innerHTML = `<div class="muted small">Wait until it says <b>GO</b>. Then tap as fast as you can.</div>`;
  els.gameStage.appendChild(box);

  const status = document.createElement("div");
  status.className = "stage-box";
  status.innerHTML = `<div>Status: <span id="rxStatus">READY</span></div><div>Time: <span id="rxTime">—</span> ms</div>`;
  els.gameStage.appendChild(status);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "reaction-btn";
  btn.textContent = "WAIT…";
  els.gameStage.appendChild(btn);

  let phase = "waiting"; // waiting -> go -> done
  let goAt = 0;

  const delay = 900 + Math.floor(Math.random() * 1800);

  gameTimers.push(setTimeout(() => {
    phase = "go";
    goAt = performance.now();
    $("#rxStatus").textContent = "GO!";
    btn.textContent = "TAP!";
    blip();
  }, delay));

  btn.addEventListener("click", () => {
    if (phase === "waiting") {
      $("#rxStatus").textContent = "TOO SOON!";
      btn.textContent = "OOPS";
      warn();
      phase = "done";
      clearGameTimers();
      awardCoins(0, "false start");
      return;
    }
    if (phase === "go") {
      const dt = Math.max(0, Math.floor(performance.now() - goAt));
      $("#rxTime").textContent = String(dt);
      $("#rxStatus").textContent = "NICE";
      phase = "done";
      clearGameTimers();

      // reward tiers
      let reward = 1;
      if (dt <= 220) reward = 8;
      else if (dt <= 300) reward = 6;
      else if (dt <= 420) reward = 4;
      else if (dt <= 600) reward = 2;

      awardCoins(reward, `Reaction ${dt}ms`);
      btn.textContent = "DONE";
      boop();
    }
  });
}

/* ===== Weather (Open-Meteo) ===== */
function weatherCodeToText(code) {
  // WMO interpretation codes used by Open-Meteo. :contentReference[oaicite:1]{index=1}
  if (code === 0) return "Clear";
  if ([1,2,3].includes(code)) return "Cloudy";
  if ([45,48].includes(code)) return "Fog";
  if ([51,53,55,56,57].includes(code)) return "Drizzle";
  if ([61,63,65,66,67,80,81,82].includes(code)) return "Rain";
  if ([71,73,75,77,85,86].includes(code)) return "Snow";
  if ([95,96,99].includes(code)) return "Thunderstorm";
  return `Code ${code}`;
}

async function fetchWeather(city) {
  els.weatherMsg.textContent = "Fetching…";

  const q = encodeURIComponent(city);
  // Geocoding API :contentReference[oaicite:2]{index=2}
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error("Geocoding request failed");
  const geo = await geoRes.json();
  if (!geo.results || geo.results.length === 0) throw new Error("No matching city found");

  const loc = geo.results[0];
  const lat = loc.latitude;
  const lon = loc.longitude;
  const cityLabel = `${loc.name}${loc.admin1 ? ", " + loc.admin1 : ""}${loc.country ? ", " + loc.country : ""}`;

  // Forecast API current weather :contentReference[oaicite:3]{index=3}
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const wxRes = await fetch(wxUrl);
  if (!wxRes.ok) throw new Error("Weather request failed");
  const wx = await wxRes.json();
  if (!wx.current_weather) throw new Error("No current weather available");

  const cw = wx.current_weather;
  const desc = weatherCodeToText(cw.weathercode);
  const temp = `${cw.temperature}°C`;
  const wind = `${cw.windspeed} km/h`;

  els.weatherCity.textContent = cityLabel;
  els.weatherNow.textContent = desc;
  els.weatherTemp.textContent = temp;
  els.weatherWind.textContent = wind;
  els.weatherMsg.textContent = `Updated at ${cw.time?.replace("T"," ") || "now"}.`;

  state.city = city;
  pushLog(`Weather in ${loc.name}: ${desc}, ${temp}, wind ${wind}.`);
  saveState();
}

/* ===== Events ===== */
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
  localStorage.removeItem("tamagotchii_state_v1");
  state = defaultState();
  soundOn = false;
  els.toggleSound.setAttribute("aria-pressed", "false");
  els.toggleSound.textContent = "Sound: OFF";
  renderAll();
  renderShop();
  pushLog("System reset. New pet initialized.");
});

/* tabs */
els.tabBoosts.addEventListener("click", showBoosts);
els.tabCos.addEventListener("click", showCos);

/* games modal */
els.gamesBtn.addEventListener("click", openGameModal);
els.closeGameModal.addEventListener("click", closeGameModal);
els.backToGames.addEventListener("click", () => {
  clearGameTimers();
  els.gameHome.classList.remove("hidden");
  els.gameStage.classList.add("hidden");
  els.gameStage.innerHTML = "";
  activeGame = null;
});
els.startCoinPop.addEventListener("click", startCoinPop);
els.startReaction.addEventListener("click", startReaction);

/* weather */
els.weatherBtn.addEventListener("click", async () => {
  const city = (els.cityInput.value || "").trim();
  if (!city) {
    els.weatherMsg.textContent = "Type a city name first.";
    return;
  }
  try {
    await fetchWeather(city);
  } catch (e) {
    els.weatherMsg.textContent = `Weather error: ${e.message}`;
    warn();
  }
});

/* ===== Init ===== */
function init() {
  // reconcile missing fields safely
  state = { ...defaultState(), ...state };
  state.owned = state.owned || { acc:[], shell:[] };
  state.owned.acc = Array.isArray(state.owned.acc) ? state.owned.acc : [];
  state.owned.shell = Array.isArray(state.owned.shell) ? state.owned.shell : [];
  state.equipped = state.equipped || { acc:"none", shell:"default" };
  state.log = Array.isArray(state.log) ? state.log : [];
  state.lastTick = state.lastTick || now();

  // catch-up decay (cap 10 minutes)
  const deltaSec = clamp((now() - state.lastTick) / 1000, 0, 600);
  applyDecay(deltaSec);
  state.lastTick = now();

  // clock
  els.clock.textContent = formatClock(new Date());

  // weather UI restore
  if (state.city) els.cityInput.value = state.city;

  renderAll();
  renderShop();
  showBoosts();

  if (state.log.length === 0) pushLog("Boot complete. Pet ready.");

  setInterval(tick, 1000);
}

init();
