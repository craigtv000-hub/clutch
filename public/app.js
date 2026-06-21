// app.js — runs in the browser.
// Polls YOUR server (not ESPN directly, which avoids browser security blocks),
// redraws the board, and wires up the "turn on alerts" button.

const $ = (id) => document.getElementById(id);

function heatColor(s){return s>=80?"var(--hot3)":s>=60?"var(--hot2)":s>=40?"var(--hot1)":"var(--dimmer)";}
function pillStyle(s){return s>=80?"background:rgba(255,58,58,.16);color:#ff7a7a":s>=60?"background:rgba(255,122,47,.16);color:#ffb07a":s>=40?"background:rgba(255,210,74,.14);color:#ffe08a":"background:var(--card2);color:var(--dim)";}

function liveCard(g){
  const m=Math.abs(g.as-g.hs), aLead=g.as>g.hs, hLead=g.hs>g.as, tie=m===0;
  const nets=(g.where||[]).map(n=>`<span class="net">${n}</span>`).join("");
  return `<div class="card ${g.score>=70?'hot':''}">
    <div class="heatbar" style="background:linear-gradient(${heatColor(g.score)},transparent)"></div>
    <div class="chead"><span class="lgtag">${g.lg}</span>
      <span class="situation ${g.must?'livec':''}">${g.situation}</span>
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

async function refresh(){
  try{
    const r=await fetch('/api/games'); const data=await r.json();
    const games=data.games||[];
    const live=games.filter(g=>g.state==='in');
    const hot=live.filter(g=>g.must);
    const watch=live.filter(g=>!g.must);
    const soon=games.filter(g=>g.state==='pre')
      .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO)).slice(0,6);

    $('hot').innerHTML=hot.length?hot.map(liveCard).join(''):`<div class="quiet">Nothing's crossed into must-watch yet. ${live.length?"We're watching the live games for you.":"No live games right now."}</div>`;
    $('livenow').innerHTML=watch.length?watch.map(liveCard).join(''):`<div class="quiet">—</div>`;
    $('ondeck').innerHTML=soon.length?soon.map(upcomingCard).join(''):`<div class="quiet">—</div>`;
    $('hotct').textContent=hot.length?hot.length+' live':'';
    $('livect').textContent=watch.length||'';
    $('deckct').textContent=soon.length||'';
    $('status').textContent=`${live.length} live · ${hot.length} must-watch · ${soon.length} soon`;
    $('updated').textContent=data.updated?new Date(data.updated).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';

    const v=$('verdict');
    if(hot.length){const t=hot[0];
      v.innerHTML=`<div class="big">⚡</div><div><h2>Turn on ${t.a} @ ${t.h} — now</h2><p>${t.situation} · ${(t.where||[]).join(' / ')}. Clutch ${t.score}.</p></div>`;
    }else if(live.length){
      v.innerHTML=`<div class="big">👀</div><div><h2>${live.length} game${live.length>1?'s':''} live — none white-knuckle yet</h2><p>We'll ping you the second one tightens up late. Top game right now: ${live[0].a} @ ${live[0].h}.</p></div>`;
    }else{
      v.innerHTML=`<div class="big">😴</div><div><h2>No live games right now</h2><p>${soon.length?`Next up: ${soon[0].a} @ ${soon[0].h}.`:'Check back when games start.'}</p></div>`;
    }
  }catch(e){ $('status').textContent='reconnecting…'; }
}

// ---------- push notifications ----------
function urlB64ToUint8(base64){
  const pad='='.repeat((4-base64.length%4)%4);
  const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(b); return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function enableAlerts(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){
      alert('This browser/device doesn’t support alerts. On iPhone: add CLUTCH to your Home Screen first, then open it from there.');return;
    }
    const reg=await navigator.serviceWorker.register('/sw.js');
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alert('Alerts blocked. Enable notifications for this site in your browser settings.');return;}
    const keyRes=await fetch('/api/vapidPublicKey'); const {key}=await keyRes.json();
    if(!key){alert('Server has no push key set yet (see launch guide step 4).');return;}
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8(key)});
    await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub)});
    const bell=$('bell'); bell.classList.add('on'); bell.textContent='🔔 Alerts on';
  }catch(e){ alert('Could not enable alerts: '+e.message); }
}
$('bell').addEventListener('click',enableAlerts);

refresh();
setInterval(refresh,20000); // auto-update every 20s while the page is open
