const $ = id => document.getElementById(id);

/* ---------- STATE ---------- */
const state = {
  coins: 10,
  hunger: 80,
  happy: 80,
  energy: 80,
  hatOwned: false
};

/* ---------- ELEMENTS ---------- */
const pet = $("pet");
const bubble = $("bubble");
const coinsEl = $("coins");

const hunger = $("hunger");
const happy = $("happy");
const energy = $("energy");

const modal = $("modal");

/* ---------- RENDER ---------- */
function render() {
  coinsEl.textContent = state.coins;
  hunger.value = state.hunger;
  happy.value = state.happy;
  energy.value = state.energy;
}
render();

/* ---------- CORE ACTIONS ---------- */
$("feedBtn").onclick = () => {
  state.hunger = Math.min(100, state.hunger + 15);
  bubble.textContent = "Nom!";
  render();
};

$("playBtn").onclick = () => {
  state.happy = Math.min(100, state.happy + 15);
  state.coins += 1;
  bubble.textContent = "Yay!";
  render();
};

$("sleepBtn").onclick = () => {
  state.energy = Math.min(100, state.energy + 20);
  bubble.textContent = "Zzz...";
  render();
};

/* ---------- SHOP ---------- */
document.querySelector("[data-item='hat']").onclick = () => {
  if (state.hatOwned) {
    pet.dataset.hat = "hat";
    bubble.textContent = "Hat equipped!";
    return;
  }

  if (state.coins < 10) {
    bubble.textContent = "Not enough coins!";
    return;
  }

  state.coins -= 10;
  state.hatOwned = true;
  pet.dataset.hat = "hat";
  bubble.textContent = "Bought a hat!";
  render();
};

/* ---------- MINI GAME ---------- */
$("gamesBtn").onclick = () => {
  modal.classList.remove("hidden");
};

$("closeModal").onclick = () => {
  modal.classList.add("hidden");
};

$("tapBtn").onclick = () => {
  state.coins += 1;
  bubble.textContent = "+1 coin!";
  render();
};

/* ---------- WEATHER ---------- */
$("weatherBtn").onclick = async () => {
  const city = $("cityInput").value.trim();
  if (!city) return;

  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`
    ).then(r => r.json());

    if (!geo.results) throw new Error("City not found");

    const { latitude, longitude, name } = geo.results[0];

    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    ).then(r => r.json());

    const w = weather.current_weather;
    $("weatherResult").textContent =
      `${name}: ${w.temperature}°C, wind ${w.windspeed} km/h`;
  } catch {
    $("weatherResult").textContent = "Weather lookup failed";
  }
};

/* ---------- DECAY LOOP ---------- */
setInterval(() => {
  state.hunger = Math.max(0, state.hunger - 0.1);
  state.happy = Math.max(0, state.happy - 0.07);
  state.energy = Math.max(0, state.energy - 0.05);
  render();
}, 1000);
