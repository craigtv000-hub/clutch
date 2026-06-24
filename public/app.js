// app.js
const $ = (id) => document.getElementById(id);

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
const DEFAULT = { leagues: defaultLeagues(), marginPick: "normal", latePick: "late", teamMode: "all", teams: {} };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("clutch_settings") || "{}");
    const s = Object.assign({}, DEFAULT, saved);
    s.leagues = Object.assign(defaultLeagues(), saved.leagues || {});
    s.teams = saved.teams || {};
    s.teamMode = saved.teamMode || "all";
    return s;
  } catch { return { ...DEFAULT, leagues: defaultLeagues(), teams: {} }; }
}
function saveSettings(s) { localStorage.setItem("clutch_settings", JSON.stringify(s)); }
let settings = loadSettings();

function expand(s) {
  const m = MARGIN_PRESETS[s.marginPick] || MARGIN_PRESETS.normal;
  const l = LATE_PRESETS[s.latePick] || LATE_PRESETS.late;
  return {
    leagues: s.leagues, teamMode: s.teamMode || "all", teams: s.teams || {},
    margin: { baseball:m.baseball, basketball:m.basketball, hockey:m.hockey, football:m.football, soccer:m.soccer },
    late:   { baseballInning:l.baseballInning, basketballSec:l.basketballSec, hockeySec:l.hockeySec, footballSec:l.footballSec, soccerMin:l.soccerMin },
  };
}
function isFollowed(g){ const t=settings.teams||{}; return !!(t[`${g.leagueKey}:${g.a}`]||t[`${g.leagueKey}:${g.h}`]); }
function countFollowed(){ return Object.values(settings.teams||{}).filter(Boolean).length; }

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

function heatColor(s){return s>=80?"var(--hot3)":s>=60?"var(--hot2)":s>=40?"var(--hot1)":"var(--dimmer)";}
function pillStyle(s){return s>=80?"background:rgba(255,58,58,.16);color:#ff7a7a":s>=60?"background:rgba(255,122,47,.16);color:#ffb07a":s>=40?"background:rgba(255,210,74,.14);color:#ffe08a":"background:var(--card2);color:var(--dim)";}

function watchURL(name){
  const n=(name||"").toLowerCase();
  const M=[
    [/mlb\.tv|mlb network/, "https://www.mlb.com/tv"],
    [/espn\+|espn plus/, "https://www.espn.com/espnplus/"],
    [/espn|abc/, "https://www.espn.com/watch/"],
    [/fox|fs1|fs2/, "https://www.foxsports.com/live"],
    [/peacock|nbc|usa network|universo/, "https://www.peacocktv.com/"],
    [/telemundo/, "https://www.telemundo.com/now"],
    [/tnt|tbs|trutv|max/, "https://play.max.com/"],
    [/paramount|cbs/, "https://www.paramountplus.com/"],
    [/apple/, "https://tv.apple.com/"],
    [/prime|amazon/, "https://www.amazon.com/gp/video/storefront"],
    [/\bion\b/, "https://iontelevision.com/schedule"],
    [/fubo/, "https://www.fubo.tv/"],
    [/nba tv|league pass/, "https://www.nba.com/watch"],
    [/wnba/, "https://www.wnba.com/leaguepass"],
    [/nhl/, "https://www.espn.com/watch/"],
    [/nfl/, "https://www.nfl.com/network/watch/nfl-network-live"],
  ];
  for(const [re,url] of M){ if(re.test(n)) return url; }
  if(/check listings|local|rsn/.test(n)) return null;
  return "https://www.google.com/search?q="+encodeURIComponent(name+" watch live stream");
}
function netChips(where){
  return (where||[]).map(n=>{
    const url=watchURL(n);
    return url
      ? `<a class="net" href="${url}" target="_blank" rel="noopener" style="text-decoration:none">${n} ↗</a>`
      : `<span class="net">${n}</span>`;
  }).join("");
}

function liveCard(g, must){
  const m=Math.abs(g.as-g.hs), aLead=g.as>g.hs, hLead=g.hs>g.as, tie=m===0;
  const nets=netChips(g.where);
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
  const nets=netChips(g.where);
  const t=new Date(g.startISO).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const day=new Date(g.startISO).toLocaleDateString('en-US',{weekday:'short'});
  return `<div class="card"><div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation" style="color:var(--dim)">${day} ${t}</span></div>
    <div class="matchup">
      <div class="trow"><span class="tabbr">${g.a}</span><span class="tname">${g.an}</span><span class="tscore" style="color:var(--dimmer);font-size:15px">—</span></div>
      <div class="trow"><span class="tabbr">${g.h}</span><span class="tname">${g.hn}</span><span class="tscore" style="color:var(--dimmer);font-size:15px">—</span></div>
    </div>
    <div class="where"><span class="eye">▸ Watch</span><div class="nets">${nets}</div><span class="when">${day} ${t}</span></div></div>`;
}
function finalCard(g){
  const aWin=g.as>g.hs, hWin=g.hs>g.as;
  const day=new Date(g.startISO).toLocaleDateString('en-US',{weekday:'short'});
  return `<div class="card"><div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation" style="color:var(--dimmer)">Final · ${day}</span></div>
    <div class="matchup">
      <div class="trow ${aWin?'':'trail'}"><span class="tabbr">${g.a}</span><span class="tname">${g.an}</span><span class="tscore">${g.as}</span></div>
      <div class="trow ${hWin?'':'trail'}"><span class="tabbr">${g.h}</span><span class="tname">${g.hn}</span><span class="tscore">${g.hs}</span></div>
    </div></div>`;
}

function inWindow(iso){
  if(!iso) return false;
  const t=new Date(iso).getTime(); if(isNaN(t)) return false;
  const now=Date.now();
  return t >= now - 36*3600*1000 && t <= now + 60*3600*1000;
}

async function refresh(){
  try{
    const r=await fetch('/api/games'); const data=await r.json();
    const exp=expand(settings);
    let games=(data.games||[]).filter(g=>settings.leagues[g.leagueKey]!==false);
    const myMode = settings.teamMode==='mine' && countFollowed()>0;
    if (myMode) games = games.filter(isFollowed);
    renderModeToggle();

    const live=games.filter(g=>g.state==='in').sort((a,b)=>b.score-a.score);
    const hot=live.filter(g=>mustWatch(g,exp));
    const watch=live.filter(g=>!mustWatch(g,exp));
    const upcoming=games.filter(g=>g.state==='pre' && inWindow(g.startISO)).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO));
    const finals=games.filter(g=>g.state==='post' && inWindow(g.startISO)).sort((a,b)=>new Date(b.startISO)-new Date(a.startISO));

    $('hot').innerHTML=hot.length?hot.map(g=>liveCard(g,true)).join(''):`<div class="quiet">Nothing's crossed into must-watch yet — we'll ping you the moment one does.</div>`;
    $('livenow').innerHTML=watch.length?watch.map(g=>liveCard(g,false)).join(''):`<div class="quiet">${hot.length?'Everything live right now is up in must-watch ☝️':'No other games live right now.'}</div>`;
    $('ondeck').innerHTML=upcoming.length?upcoming.map(upcomingCard).join(''):`<div class="quiet">${myMode?'None of your teams play soon.':'Nothing scheduled in your leagues.'}</div>`;
    $('finals').innerHTML=finals.length?finals.map(finalCard).join(''):`<div class="quiet">—</div>`;

    $('hotct').textContent=hot.length||'';
    $('livect').textContent=watch.length||'';
    $('deckct').textContent=upcoming.length||'';
    $('finalct').textContent=finals.length||'';
    $('status').textContent=`${live.length} live · ${upcoming.length} upcoming · ${finals.length} final`;
    $('updated').textContent=data.updated?new Date(data.updated).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';

    const v=$('verdict');
    if(hot.length){const t=hot[0];
      v.innerHTML=`<div class="big">⚡</div><div><h2>Turn on ${t.a} @ ${t.h} — now</h2><p>${t.situation} · ${(t.where||[]).join(' / ')}. Clutch ${t.score}.</p></div>`;
    }else if(live.length){const t=live[0];
      v.innerHTML=`<div class="big">👀</div><div><h2>${live.length} game${live.length>1?'s':''} live right now</h2><p>Hottest: ${t.a} @ ${t.h} (${t.situation}). We'll ping you when one gets close late.</p></div>`;
    }else if(upcoming.length){const t=upcoming[0];
      v.innerHTML=`<div class="big">🕐</div><div><h2>No games live yet</h2><p>Next up: ${t.a} @ ${t.h} at ${new Date(t.startISO).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}.</p></div>`;
    }else{
      v.innerHTML=`<div class="big">😴</div><div><h2>${myMode?'None of your teams are playing':'No games in your leagues right now'}</h2><p>${myMode?'Flip to "All games" up top, or follow more teams in ⚙.':'Open ⚙ to add more leagues, or check back later.'}</p></div>`;
    }
  }catch(e){ $('status').textContent='reconnecting…'; }
}

function renderModeToggle(){
  const el=$('modeToggle'); if(!el) return;
  const n=countFollowed();
  el.innerHTML=`
    <button class="modebtn ${settings.teamMode!=='mine'?'on':''}" data-m="all">All games</button>
    <button class="modebtn ${settings.teamMode==='mine'?'on':''}" data-m="mine">My teams${n?` (${n})`:''}</button>`;
  el.querySelectorAll('.modebtn').forEach(b=>{
    b.onclick=()=>{
      const m=b.dataset.m;
      if(m==='mine' && countFollowed()===0){ buildSettingsUI(); $('sheet').classList.add('open'); return; }
      settings.teamMode=m; saveSettings(settings); refresh(); pushSettings();
    };
  });
}

let TEAMS_CACHE=null;
async function loadTeams(){
  if(TEAMS_CACHE) return TEAMS_CACHE;
  try{ const r=await fetch('/api/teams'); const d=await r.json(); TEAMS_CACHE=d.teams||{}; }catch{ TEAMS_CACHE={}; }
  return TEAMS_CACHE;
}
async function buildTeamPicker(filter){
  const box=$('teamList'); if(!box) return;
  const teams=await loadTeams();
  const q=(filter||'').toLowerCase();
  let html='';
  LEAGUE_LIST.forEach(([lk,label])=>{
    if(settings.leagues[lk]===false) return;
    const list=(teams[lk]||[]).filter(t=>!q || t.name.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q));
    if(!list.length) return;
    html+=`<div class="teamleague">${label}</div><div class="seg">`;
    list.forEach(t=>{
      const key=`${lk}:${t.abbr}`;
      const on=settings.teams[key]?' on':'';
      html+=`<button class="segbtn teamchip${on}" data-key="${key}">${t.abbr}</button>`;
    });
    html+=`</div>`;
  });
  box.innerHTML=html || `<div class="quiet">No teams found yet — they load once games data syncs.</div>`;
  box.querySelectorAll('.teamchip').forEach(b=>{
    b.onclick=()=>{ const k=b.dataset.key; settings.teams[k]=!settings.teams[k]; if(!settings.teams[k]) delete settings.teams[k]; b.classList.toggle('on'); };
  });
}

function buildSettingsUI(){
  const lg=$('leagueSeg'); lg.innerHTML='';
  LEAGUE_LIST.forEach(([k,label])=>{
    const b=document.createElement('button');
    b.className='segbtn'+(settings.leagues[k]!==false?' on':'');
    b.textContent=label;
    b.onclick=()=>{settings.leagues[k]=!(settings.leagues[k]!==false);b.classList.toggle('on');buildTeamPicker($('teamSearch')?$('teamSearch').value:'');};
    lg.appendChild(b);
  });
  buildTeamPicker($('teamSearch') ? $('teamSearch').value : '');
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
const _ts=$('teamSearch'); if(_ts){ _ts.addEventListener('input',()=>buildTeamPicker(_ts.value)); }
$('gear').onclick=()=>{buildSettingsUI();$('sheet').classList.add('open');};
$('closex').onclick=()=>$('sheet').classList.remove('open');
$('sheet').onclick=(e)=>{if(e.target.id==='sheet')e.target.classList.remove('open');};
$('allBtn') && ($('allBtn').onclick=()=>{ALL_LEAGUE_KEYS.forEach(k=>settings.leagues[k]=true);buildSettingsUI();});
$('noneBtn') && ($('noneBtn').onclick=()=>{ALL_LEAGUE_KEYS.forEach(k=>settings.leagues[k]=false);buildSettingsUI();});

async function pushSettings(){
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    const sub=reg && await reg.pushManager.getSubscription();
    if(sub){ await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,settings:expand(settings)})}); }
  }catch{}
}
$('saveBtn').onclick=async ()=>{
  saveSettings(settings);
  $('sheet').classList.remove('open');
  refresh();
  pushSettings();
};

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

// native push (only inside the iOS/Android app; web skips this)
(async () => {
  try {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
    const { PushNotifications } = cap.Plugins;
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
    PushNotifications.addListener('registration', async (token) => {
      try { await fetch('/api/subscribe-native',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.value,platform:cap.getPlatform(),settings:expand(settings)})}); } catch(e){}
    });
    PushNotifications.addListener('pushNotificationActionPerformed', () => { window.location.href='/'; });
  } catch (e) {}
})();

refresh();
setInterval(refresh,20000);
