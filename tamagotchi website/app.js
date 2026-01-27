const $ = s => document.querySelector(s);

const els = {
  pet: $("#pet"),
  bubble: $("#bubble"),
  coins: $("#coins"),
  coinsMini: $("#coinsMini"),
  mood: $("#petMood"),
  age: $("#petAge"),
  clock: $("#clock"),
  bars: {
    hunger: $("#barHunger"),
    happy: $("#barHappy"),
    energy: $("#barEnergy"),
    clean: $("#barClean")
  },
  log: $("#logList"),
  gameModal: $("#gameModal"),
  gameHome: $("#gameHome"),
  gameStage: $("#gameStage")
};

let state = {
  coins: 10,
  hunger: 80,
  happy: 80,
  energy: 80,
  clean: 80,
  created: Date.now()
};

/* ---------- helpers ---------- */
function clamp(v){ return Math.max(0,Math.min(100,v)); }

function log(msg){
  const li=document.createElement("li");
  li.textContent=msg;
  els.log.prepend(li);
}

function render(){
  els.coins.textContent=state.coins;
  els.coinsMini.textContent=state.coins;
  els.bars.hunger.style.width=state.hunger+"%";
  els.bars.happy.style.width=state.happy+"%";
  els.bars.energy.style.width=state.energy+"%";
  els.bars.clean.style.width=state.clean+"%";
}

function tick(){
  state.hunger=clamp(state.hunger-0.1);
  state.happy=clamp(state.happy-0.07);
  state.energy=clamp(state.energy-0.05);
  state.clean=clamp(state.clean-0.04);
  els.clock.textContent=new Date().toLocaleTimeString();
  render();
}

/* ---------- mini games ---------- */
function openGames(){
  els.gameModal.classList.remove("hidden");
  els.gameHome.classList.remove("hidden");
  els.gameStage.classList.add("hidden");
}

function closeGames(){
  els.gameModal.classList.add("hidden");
  els.gameStage.innerHTML="";
}

$("#gamesBtn").onclick=openGames;
$("#closeGameModal").onclick=closeGames;
$("#backToGames").onclick=()=> {
  els.gameStage.classList.add("hidden");
  els.gameHome.classList.remove("hidden");
};

$("#startCoinPop").onclick=()=>{
  els.gameHome.classList.add("hidden");
  els.gameStage.classList.remove("hidden");
  els.gameStage.innerHTML="<button id='hit'>HIT!</button>";
  let score=0;
  $("#hit").onclick=()=>score++;
  setTimeout(()=>{
    state.coins+=score;
    log(`Coin Pop: +${score}`);
    closeGames();
    render();
  },5000);
};

$("#startReaction").onclick=()=>{
  els.gameHome.classList.add("hidden");
  els.gameStage.classList.remove("hidden");
  els.gameStage.innerHTML="<div id='rx'>WAIT</div>";
  const start=Date.now()+1000+Math.random()*2000;
  const rx=$("#rx");
  const t=setInterval(()=>{
    if(Date.now()>start){
      rx.textContent="GO!";
      rx.onclick=()=>{
        const dt=Date.now()-start;
        const reward=dt<300?6:dt<500?4:2;
        state.coins+=reward;
        log(`Reaction ${dt}ms: +${reward}`);
        clearInterval(t);
        closeGames();
        render();
      };
      clearInterval(t);
    }
  },50);
};

/* ---------- buttons ---------- */
$("#feedBtn").onclick=()=>{state.hunger+=15; log("Fed"); render();};
$("#playBtn").onclick=()=>{state.happy+=15; state.coins+=1; log("Played"); render();};
$("#sleepBtn").onclick=()=>{state.energy+=20; log("Slept"); render();};
$("#cleanBtn").onclick=()=>{state.clean+=20; log("Cleaned"); render();};

/* ---------- init ---------- */
els.gameModal.classList.add("hidden");
setInterval(tick,1000);
render();
