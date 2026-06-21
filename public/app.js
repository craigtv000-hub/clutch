// app.js — runs in the browser.
// Polls YOUR server, renders the board using THIS DEVICE'S settings, and lets
// each person pick which LEAGUES they want and their own must-watch thresholds.

const $ = (id) => document.getElementById(id);

// ---------- the leagues a user can choose ----------
const LEAGUE_LIST = [
  ["nba", "🏀 NBA"],
  ["wnba", "🏀 WNBA"],
  ["ncaab", "🏀 College BB"],
  ["nfl", "🏈 NFL"],
  ["ncaaf", "🏈 College FB"],
  ["mlb", "⚾ MLB"],
  ["nhl", "🏒 NHL"],
  ["worldcup", "⚽ World Cup"],
  ["epl", "⚽ Premier League"],
  ["mls", "⚽ MLS"],
];
const ALL_LEAGUE_KEYS = LEAGUE_LIST.map(([k]) => k);

const MARGIN_PRESETS = {
  tight:  { label: "Nail-biters", baseball:1, basketball:3,  hockey:1, football:3,  soccer:1 },
  normal: { label: "Close",       baseball:1, basketball:6,  hockey:1, football:8,  soccer:1 },
  loose:  { label: "Competitive", baseball:2, basketball:10, hockey:2, football:11, soccer:2 },
};
const LATE_PRESETS = {
  veryLate: { label: "Final moments", baseballInning:9, basketballSec:120, hockeySec:120, footballSec:120, soccerMin:80 },
  late:     { label: "Crunch time",   baseballInning:8, basketballSec:300, hockeySec:300, footballSec:300, soccerMin:70 },
  early:    { label: "Second half",   baseballInning:7, basketballSec:720, hockeySec:600, footballSec:720, soccerMin:60 },
};

function defaultLeagues(){ const o={}; ALL_LEAGUE_KEYS.forEach(k=>o[k]=true); return o; }
const DEFAULT = { leagues: defaultLeagues(), marginPick: "normal", latePick: "late" };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("clutch_settings") || "{}");
    const s = Object.assign({}, DEFAULT, saved);
    s.leagues = Object.assign(defaultLeagues(), saved.leagues || {}); // ensure all keys exist
    return s;
  } catch { return { ...DEFAULT, leagues: defaultLeagues() }; }
}
function saveSettings(s) { localStorage.setItem("clutch_settings", JSON.stringify(s)); }
let settings = loadSettings();

// Expand friendly presets into the concrete thresholds the server understands.
function expand(s) {
  const m = MARGIN_PRESETS[s.marginPick] || MARGIN_PRESETS.normal;
  const l = LATE_PRESETS[s.latePick] || LATE_PRESETS.late;
  return {
    leagues: s.leagues,
    margin: { baseball:m.baseball, basketball:m.basketball, hockey:m.hockey, football:m.football, soccer:m.soccer },
    late:   { baseballInning:l.baseballInning, basketballSec:l.basketballSec, hockeySec:l.hockeySec, footballSec:l.footballSec, soccerMin:l.soccerMin },
  };
}

// ---------- client-side "must-watch" (mirrors clutch.js, for display) ----------
function clockToSeconds(s){ if(!s||!String(s).includes(":"))return 0; const [m,sec]=String(s).split(":").map(n=>parseInt(n,10)); return (m||0)*60+(sec||0); }
function soccerMinute(clock,detail,period){ const x=String(clock||detail||"").match(/(\d+)/); return x?parseInt(x[1],10):(period>=2?60:20); }
function mustWatch(g, exp) {
  if (g.state !== "in") return false;
  if (exp.leagues[g.leagueKey] === false) return false;
  const m = Math.abs(g.as - g.hs);
  const limit = exp.margin[g.sport] ?? 99;
  if (m > limit) return false;
  const L = exp.late;
  if (g.sport==="baseball")   return g.period >= L.baseballInning;
  if (g.sport==="basketball") return g.period>4 || (g.period===4 && clockToSeconds(g.clock)<=L.basketballSec);
  if (g.sport==="hockey")     return g.period>3 || (g.period===3 && clockToSeconds(g.clock)<=L.hockeySec);
  if (g.sport==="football")   return g.period>4 || (g.period===4 && clockToSeconds(g.clock)<=L.footballSec);
  if (g.sport==="soccer")     return soccerMinute(g.clock,g.detail,g.period) >= L.soccerMin;
  return false;
}

// ---------- rendering ----------
function heatColor(s){return s>=80?"var(--hot3)":s>=60?"var(--hot2)":s>=40?"var(--hot1)":"var(--dimmer)";}
function pillStyle(s){return s>=80?"background:rgba(255,58,58,.16);color:#ff7a7a":s>=60?"background:rgba(255,122,47,.16);color:#ffb07a":s>=40?"background:rgba(255,210,74,.14);color:#ffe08a":"background:var(--card2);color:var(--dim)";}

function liveCard(g, must){
  const m=Math.abs(g.as-g.hs), aLead=g.as>g.hs, hLead=g.hs>g.as, tie=m===0;
  const nets=(g.where||[]).map(n=>`<span class="net">${n}</span>`).join("");
  return `<div class="card ${g.score>=70?'hot':''}">
    <div class="heatbar" style="background:linear-gradient(${heatColor(g.score)},transparent)"></div>
    <div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation ${must?'livec':''}">${g.situation}</span>
      <span class="clutchpill" style="${pillStyle(g.score)}">🔥 ${g.score}</span></div>
    <div class="matchup">
      <div class="trow ${aLead||tie?'':'trail'}"><span class="tabbr">${g.a}</span><span class="tname">${g.an}</span><span class="tscore">${g.as}</span></div>
      <div class="trow ${hLead||tie?'':'trail'}"><span class="tabbr">${g.h}</span><span class="tname">${g.hn}</span><span class="tscore">${g.hs}</span></div>
    </div>
    <div class="where"><span class="eye">▸ Watch</span><div class="nets">${nets}</div></div>
  </div>`;
}
function upcomingCard(g){
  const nets=(g.where||[]).map(n=>`<span class="net">${n}</span>`).join("");
  const t=new Date(g.startISO).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  return `<div class="card"><div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation" style="color:var(--dim)">Scheduled</span>
      <span class="clutchpill" style="background:var(--card2);color:var(--dim)">${t}</span></div>
    <div class="matchup">
      <div class="trow"><span class="tabbr">${g.a}</span><span class="tname">${g.an}</span><span class="tscore" style="color:var(--dimmer);font-size:15px">—</span></div>
      <div class="trow"><span class="tabbr">${g.h}</span><span class="tname">${g.hn}</span><span class="tscore" style="color:var(--dimmer);font-size:15px">—</span></div>
    </div>
    <div class="where"><span class="eye">▸ Watch</span><div class="nets">${nets}</div><span class="when">${t}</span></div></div>`;
}

// Is this game today (in the viewer's local time)? Live games always count.
function isToday(iso){
  if(!iso) return false;
  const d=new Date(iso), n=new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

function finalCard(g){
  const aWin=g.as>g.hs, hWin=g.hs>g.as;
  return `<div class="card"><div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation" style="color:var(--dimmer)">Final</span></div>
    <div class="matchup">
      <div class="trow ${aWin?'':'trail'}"><span class="tabbr">${g.a}</span><span class="tname">${g.an}</span><span class="tscore">${g.as}</span></div>
      <div class="trow ${hWin?'':'trail'}"><span class="tabbr">${g.h}</span><span class="tname">${g.hn}</span><span class="tscore">${g.hs}</span></div>
    </div></div>`;
}

async function refresh(){
  try{
    const r=await fetch('/api/games'); const data=await r.json();
    const exp=expand(settings);
    const games=(data.games||[]).filter(g=>settings.leagues[g.leagueKey]!==false);
    const live=games.filter(g=>g.state==='in');                       // live is always relevant
    const hot=live.filter(g=>mustWatch(g,exp));
    const watch=live.filter(g=>!mustWatch(g,exp));
    const soon=games.filter(g=>g.state==='pre' && isToday(g.startISO)) // today's upcoming only
      .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO)).slice(0,12);
    const finals=games.filter(g=>g.state==='post' && isToday(g.startISO)) // today's finished
      .sort((a,b)=>new Date(b.startISO)-new Date(a.startISO)).slice(0,12);

    $('hot').innerHTML=hot.length?hot.map(g=>liveCard(g,true)).join(''):`<div class="quiet">Nothing's crossed into must-watch yet. ${live.length?"We're watching your leagues.":"No live games in your leagues right now."}</div>`;
    $('livenow').innerHTML=watch.length?watch.map(g=>liveCard(g,false)).join(''):`<div class="quiet">—</div>`;
    $('ondeck').innerHTML=soon.length?soon.map(upcomingCard).join(''):`<div class="quiet">Nothing else scheduled today.</div>`;
    $('finals').innerHTML=finals.length?finals.map(finalCard).join(''):`<div class="quiet">—</div>`;
    $('hotct').textContent=hot.length?hot.length+' live':'';
    $('livect').textContent=watch.length||'';
    $('deckct').textContent=soon.length||'';
    $('finalct').textContent=finals.length||'';
    $('status').textContent=`${live.length} live · ${hot.length} must-watch · ${soon.length} soon`;
    $('updated').textContent=data.updated?new Date(data.updated).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';

    const v=$('verdict');
    if(hot.length){const t=hot[0];
      v.innerHTML=`<div class="big">⚡</div><div><h2>Turn on ${t.a} @ ${t.h} — now</h2><p>${t.situation} · ${(t.where||[]).join(' / ')}. Clutch ${t.score}.</p></div>`;
    }else if(live.length){
      v.innerHTML=`<div class="big">👀</div><div><h2>${live.length} game${live.length>1?'s':''} live — none at your bar yet</h2><p>We'll ping you the second one hits it. Hottest now: ${live[0].a} @ ${live[0].h}.</p></div>`;
    }else if(soon.length){
      v.innerHTML=`<div class="big">🕐</div><div><h2>No live games yet today</h2><p>Next up: ${soon[0].a} @ ${soon[0].h}.</p></div>`;
    }else{
      v.innerHTML=`<div class="big">😴</div><div><h2>No games in your leagues today</h2><p>Check back when your leagues are in season and playing.</p></div>`;
    }
  }catch(e){ $('status').textContent='reconnecting…'; }
}

// ---------- settings UI ----------
function buildSettingsUI(){
  const lg=$('leagueSeg'); lg.innerHTML='';
  LEAGUE_LIST.forEach(([k,label])=>{
    const b=document.createElement('button');
    b.className='segbtn'+(settings.leagues[k]!==false?' on':'');
    b.textContent=label;
    b.onclick=()=>{settings.leagues[k]=!(settings.leagues[k]!==false);b.classList.toggle('on');};
    lg.appendChild(b);
  });
  const ms=$('marginSeg'); ms.innerHTML='';
  Object.entries(MARGIN_PRESETS).forEach(([k,v])=>{
    const b=document.createElement('button');
    b.className='segbtn'+(settings.marginPick===k?' on':'');
    b.textContent=v.label;
    b.onclick=()=>{settings.marginPick=k;[...ms.children].forEach(c=>c.classList.remove('on'));b.classList.add('on');};
    ms.appendChild(b);
  });
  const ls=$('lateSeg'); ls.innerHTML='';
  Object.entries(LATE_PRESETS).forEach(([k,v])=>{
    const b=document.createElement('button');
    b.className='segbtn'+(settings.latePick===k?' on':'');
    b.textContent=v.label;
    b.onclick=()=>{settings.latePick=k;[...ls.children].forEach(c=>c.classList.remove('on'));b.classList.add('on');};
    ls.appendChild(b);
  });
}
$('gear').onclick=()=>{buildSettingsUI();$('sheet').classList.add('open');};
$('closex').onclick=()=>$('sheet').classList.remove('open');
$('sheet').onclick=(e)=>{if(e.target.id==='sheet')e.target.classList.remove('open');};
$('allBtn') && ($('allBtn').onclick=()=>{ALL_LEAGUE_KEYS.forEach(k=>settings.leagues[k]=true);buildSettingsUI();});
$('noneBtn') && ($('noneBtn').onclick=()=>{ALL_LEAGUE_KEYS.forEach(k=>settings.leagues[k]=false);buildSettingsUI();});
$('saveBtn').onclick=async ()=>{
  saveSettings(settings);
  $('sheet').classList.remove('open');
  refresh();
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    const sub=reg && await reg.pushManager.getSubscription();
    if(sub){ await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,settings:expand(settings)})}); }
  }catch{}
};

// ---------- push notifications ----------
function urlB64ToUint8(base64){const pad='='.repeat((4-base64.length%4)%4);const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
async function enableAlerts(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){alert('This device doesn’t support alerts. On iPhone: add CLUTCH to your Home Screen, then open it from there.');return;}
    const reg=await navigator.serviceWorker.register('/sw.js');
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alert('Alerts blocked. Enable notifications for this site in settings.');return;}
    const {key}=await (await fetch('/api/vapidPublicKey')).json();
    if(!key){alert('Server has no push key set yet.');return;}
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8(key)});
    await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub,settings:expand(settings)})});
    const bell=$('bell'); bell.classList.add('on'); bell.textContent='🔔 Alerts on';
  }catch(e){ alert('Could not enable alerts: '+e.message); }
}
$('bell').addEventListener('click',enableAlerts);
(async()=>{ try{ const reg=await navigator.serviceWorker.getRegistration(); const sub=reg&&await reg.pushManager.getSubscription(); if(sub){$('bell').classList.add('on');$('bell').textContent='🔔 Alerts on';} }catch{} })();

refresh();
setInterval(refresh,20000);
