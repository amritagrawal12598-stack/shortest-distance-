'use strict';

// ── State ──────────────────────────────────────
const state = {
  mode: 'drive',
  selectedRoute: null,
  currentRoutes: [],
  showHeatmap: true,
  showEco: false,
  showBuddy: false,
  rerouteTimer: null,
  tick: 0,
  routeAnim: 0,
};

// ── Route Data ─────────────────────────────────
function getRoutes(mode) {
  const db = {
    drive: [
      { name:'NH-48 Express',     via:'Dhaula Kuan → NH-48',         dist:28.4, time:42, co2:3.8, crowd:78, conf:88, eco:false,
        steps:['Take Rajpath toward India Gate','Merge onto Ring Road South','Take Dhaula Kuan flyover','Enter NH-48','Exit at Cyber City toll','Arrive Cyber City, Gurugram'] },
      { name:'Outer Ring Road',   via:'Ring Road → Mahipalpur',       dist:31.2, time:48, co2:3.2, crowd:52, conf:82, eco:true,
        steps:['Head south on Janpath','Join Outer Ring Road','Continue past Mahipalpur','Take slip to Dwarka Expressway','Cross Sheetla Mata Road','Arrive Cyber City'] },
      { name:'Mehrauli Road',     via:'Aurobindo Marg → Mehrauli',    dist:33.8, time:55, co2:2.9, crowd:40, conf:75, eco:true,
        steps:['Take Aurobindo Marg south','Pass IIT Delhi','Continue on Mehrauli-Gurgaon Road','Cross Ghitorni metro','Join NH-48 at IFFCO Chowk','Arrive Cyber City'] },
      { name:'DND Flyway Alt',    via:'Noida Expressway → Elevated',  dist:38.1, time:61, co2:4.1, crowd:30, conf:70, eco:false,
        steps:['Head east to DND Flyway','Cross Yamuna into Noida','Take NH-44 south','Join Western Peripheral Expressway','Enter Gurugram via NH-48','Arrive Cyber City'] },
    ],
    transit: [
      { name:'Blue + Yellow Line',  via:'Rajiv Chowk → HUDA City Centre', dist:29.0, time:55, co2:0.4, crowd:82, conf:92, eco:true,
        steps:['Walk to Rajiv Chowk Metro','Board Blue Line westbound','Change at Dwarka Sec 21','Board Yellow Line south','Exit at HUDA City Centre','2-min cab to Cyber City'] },
      { name:'Yellow Line Direct',  via:'AIIMS → Qutab → HUDA',           dist:31.5, time:60, co2:0.3, crowd:65, conf:89, eco:true,
        steps:['Walk to Janpath Metro','Board Yellow Line southbound','Pass Hauz Khas, AIIMS','Continue to Qutab Minar','Arrive HUDA City Centre','Short walk to Cyber City'] },
      { name:'Rapid Metro Combo',   via:'Palam → Gurugram Rapid Metro',   dist:34.2, time:68, co2:0.5, crowd:48, conf:80, eco:true,
        steps:['Cab to Palam Metro','Board Airport Express → Dwarka','Switch to Green Line','Connect to Gurugram Rapid Metro','Cyber City Rapid Metro stop','Direct arrival'] },
      { name:'Bus + Metro',         via:'DTC → Central Secretariat',       dist:36.0, time:80, co2:0.6, crowd:35, conf:72, eco:true,
        steps:['DTC Bus 521 from CP','Alight at Central Secretariat','Metro Yellow Line south','HUDA City Centre terminus','Share auto to Cyber City','Arrive Cyber City'] },
    ],
    bike: [
      { name:'NH-48 Cycle Lane',    via:'Dedicated lane via Dhaula Kuan', dist:27.0, time:72, co2:0.0, crowd:20, conf:78, eco:true,
        steps:['Cycle south on Janpath track','NH-48 dedicated bike lane','Pass Hero Honda Chowk','Elevated cycling bridge at Sirhaul','Enter Cyber City bike zone','Park at bike hub'] },
      { name:'Mehrauli Trail',      via:'Ridge Road → Forest',            dist:30.1, time:85, co2:0.0, crowd:12, conf:70, eco:true,
        steps:['Ride through Lutyens Delhi','Enter Delhi Ridge Green Zone','Scenic Mehrauli forest trail','Reach Qutab junction','Join Mehrauli-Gurgaon Road','Arrive Cyber City'] },
      { name:'Ring Road Sprint',    via:'Outer Ring cycle path',          dist:29.8, time:80, co2:0.0, crowd:15, conf:74, eco:true,
        steps:['Join Outer Ring Road cycle path','Fast lane past Dilli Haat','Turn at Mahipalpur','NH-48 service road','Cyber City entry gate','Lock bike at stand'] },
      { name:'Direct Commute',      via:'Main roads fastest cycling',     dist:28.2, time:76, co2:0.0, crowd:25, conf:65, eco:true,
        steps:['Take Janpath directly south','Safdarjung Road','Join MG Road','Straight on MG Road to Gurugram','Cyber City left turn','Arrive Cyber City'] },
    ],
    walk: [
      { name:'Scenic Walk',         via:'India Gate → Lodhi Garden',  dist:5.2, time:64, co2:0.0, crowd:30, conf:95, eco:true,
        steps:['Start from Connaught Place','Walk south past India Gate','Through Lodhi Garden path','Safdarjung Road','Continue on ring path','Arrive near Hauz Khas'] },
      { name:'Direct Walk',         via:'Janpath straight',           dist:4.8, time:60, co2:0.0, crowd:40, conf:97, eco:true,
        steps:['Head south on Janpath','Pass Jantar Mantar','Continue on Baba Kharak Singh Marg','Turn at Mandi House','Continue south toward AIIMS','Arrive Lodhi Road'] },
      { name:'Park Walk',           via:'Nehru Park gardens',         dist:5.8, time:72, co2:0.0, crowd:18, conf:93, eco:true, steps:[] },
      { name:'Heritage Trail',      via:'Old Delhi + monuments',      dist:6.5, time:82, co2:0.0, crowd:22, conf:88, eco:true, steps:[] },
    ],
  };
  return (db[mode] || db.drive).map((r,i)=>({...r, rank:i+1, mode}));
}

// ── Map Renderer ───────────────────────────────
const Map = (() => {
  let canvas, ctx, W, H, raf;
  let routeProgress = 0;

  // Proportional city node positions
  const NODES = [
    {x:.50,y:.10,lbl:'Rohini'},
    {x:.50,y:.22,lbl:'Connaught Place'},   // 1 = origin
    {x:.65,y:.20,lbl:'IP Estate'},
    {x:.35,y:.30,lbl:'Karol Bagh'},
    {x:.50,y:.38,lbl:'AIIMS'},
    {x:.38,y:.48,lbl:'Dhaula Kuan'},
    {x:.60,y:.50,lbl:'Lajpat Nagar'},
    {x:.28,y:.60,lbl:'Kapashera'},
    {x:.46,y:.63,lbl:'Mehrauli'},
    {x:.64,y:.64,lbl:'Saket'},
    {x:.30,y:.73,lbl:'NH-48 North'},
    {x:.50,y:.76,lbl:'IFFCO Chowk'},
    {x:.44,y:.88,lbl:'Cyber City'},        // 12 = destination
    {x:.66,y:.82,lbl:'Sohna Rd'},
    {x:.20,y:.45,lbl:'Palam'},
    {x:.72,y:.35,lbl:'Noida'},
  ];

  const ROADS = [
    [0,1],[1,2],[1,3],[1,4],[2,6],[3,5],[4,5],[4,6],
    [5,7],[5,8],[6,9],[7,10],[8,10],[8,11],[9,11],
    [10,12],[11,12],[11,13],[3,14],[2,15],[15,6],[14,7],
  ];

  const PATHS = {
    1:[1,4,5,10,12],
    2:[1,4,5,7,10,12],
    3:[1,4,8,11,12],
    4:[1,2,6,9,11,12],
  };

  const ROUTE_COLORS = ['#3B82F6','#22C55E','#F59E0B','#6366F1'];

  const HOTSPOTS = [
    {x:.50,y:.22,r:.07,i:.85},
    {x:.38,y:.48,r:.09,i:.72},
    {x:.30,y:.73,r:.07,i:.80},
    {x:.50,y:.76,r:.05,i:.60},
  ];

  function init() {
    canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    loop();
  }

  function resize() {
    const p = canvas.parentElement;
    W = canvas.width  = p.clientWidth;
    H = canvas.height = p.clientHeight;
  }

  function px(x){ return x * W; }
  function py(y){ return y * H; }
  function nx(i){ return NODES[i].x * W; }
  function ny(i){ return NODES[i].y * H; }

  function loop() {
    state.tick++;
    if (state.currentRoutes.length && routeProgress < 1)
      routeProgress = Math.min(1, routeProgress + 0.012);
    render();
    raf = requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0,0,W,H);
    drawBg();
    drawRoads();
    if (state.showHeatmap) drawHeatmap();
    drawRoutes();
    if (state.currentRoutes.length) drawOriginDest();
    if (state.showBuddy) drawBuddies();
    drawNodeLabels();
  }

  function drawBg() {
    const g = ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#07101F');
    g.addColorStop(1,'#050D18');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(48,54,61,.4)';
    ctx.lineWidth = .5;
    const sp = 48;
    for(let x=0;x<W;x+=sp){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=sp){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  }

  function drawRoads() {
    ROADS.forEach(([a,b])=>{
      ctx.beginPath();
      ctx.moveTo(nx(a),ny(a));
      ctx.lineTo(nx(b),ny(b));
      ctx.strokeStyle = 'rgba(48,54,61,.9)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Center line
      ctx.beginPath();
      ctx.moveTo(nx(a),ny(a));
      ctx.lineTo(nx(b),ny(b));
      ctx.strokeStyle = 'rgba(28,35,51,.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawHeatmap() {
    HOTSPOTS.forEach(h=>{
      const pulse = (Math.sin(state.tick*.04)+1)*.5;
      const r = h.r * Math.min(W,H);
      const g = ctx.createRadialGradient(px(h.x),py(h.y),0,px(h.x),py(h.y),r);
      const alpha = (.05+pulse*.04)*h.i;
      const col = h.i>.7 ? `rgba(239,68,68,${alpha})` :
                  h.i>.5 ? `rgba(245,158,11,${alpha})` :
                            `rgba(34,197,94,${alpha})`;
      g.addColorStop(0,col);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();ctx.arc(px(h.x),py(h.y),r,0,Math.PI*2);
      ctx.fill();
    });
  }

  function drawRoutes() {
    if (!state.currentRoutes.length) return;
    state.currentRoutes.forEach((route,idx)=>{
      const path = PATHS[idx+1];
      if (!path) return;
      const color = ROUTE_COLORS[idx];
      const isSelected = state.selectedRoute?.rank === idx+1;
      const alpha = isSelected ? 1 : (state.selectedRoute ? .2 : .6);
      const lw = isSelected ? 4.5 : 2;

      const totalSegs = path.length-1;
      const prog = routeProgress * totalSegs;
      const fullSegs = Math.floor(prog);
      const frac = prog - fullSegs;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (isSelected) { ctx.shadowColor = color; ctx.shadowBlur = 8; }

      ctx.beginPath();
      ctx.moveTo(nx(path[0]),ny(path[0]));
      for(let i=0;i<Math.min(fullSegs,totalSegs);i++)
        ctx.lineTo(nx(path[i+1]),ny(path[i+1]));
      if (fullSegs<totalSegs) {
        const sx=nx(path[fullSegs]),sy=ny(path[fullSegs]);
        const ex=nx(path[fullSegs+1]),ey=ny(path[fullSegs+1]);
        ctx.lineTo(sx+(ex-sx)*frac,sy+(ey-sy)*frac);
      }
      ctx.stroke();

      // Moving dash on selected route
      if (isSelected && routeProgress>=1) {
        const dashProgress = (state.tick * 1.5) % 100;
        for(let i=0;i<totalSegs;i++){
          const sx=nx(path[i]),sy=ny(path[i]);
          const ex=nx(path[i+1]),ey=ny(path[i+1]);
          const segLen = Math.hypot(ex-sx,ey-sy);
          const t = ((dashProgress/100*(totalSegs*60)+i*60)%segLen)/segLen;
          if(t>=0&&t<=1){
            const dx=sx+(ex-sx)*t,dy=sy+(ey-sy)*t;
            ctx.beginPath();
            ctx.arc(dx,dy,3,0,Math.PI*2);
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = .8;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#fff';
            ctx.fill();
          }
        }
      }
      ctx.restore();
    });
  }

  function drawOriginDest() {
    const orig = NODES[1], dest = NODES[12];
    const pulse = (Math.sin(state.tick*.06)+1)*.5;

    // Origin glow
    ctx.beginPath();
    ctx.arc(px(orig.x),py(orig.y),12+pulse*5,0,Math.PI*2);
    ctx.fillStyle = `rgba(34,197,94,${.08-pulse*.05})`;
    ctx.fill();

    // Origin pin
    ctx.beginPath();
    ctx.arc(px(orig.x),py(orig.y),8,0,Math.PI*2);
    ctx.fillStyle = '#22C55E';
    ctx.shadowColor='#22C55E';ctx.shadowBlur=10;
    ctx.fill();ctx.shadowBlur=0;
    ctx.font='bold 10px Inter';
    ctx.fillStyle='#fff';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('A',px(orig.x),py(orig.y));

    // Dest glow
    ctx.beginPath();
    ctx.arc(px(dest.x),py(dest.y),12+pulse*5,0,Math.PI*2);
    ctx.fillStyle = `rgba(239,68,68,${.08-pulse*.05})`;
    ctx.fill();

    // Dest pin
    ctx.beginPath();
    ctx.arc(px(dest.x),py(dest.y),8,0,Math.PI*2);
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor='#EF4444';ctx.shadowBlur=10;
    ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#fff';
    ctx.fillText('B',px(dest.x),py(dest.y));
    ctx.textBaseline='alphabetic';
  }

  function drawBuddies() {
    const buddies = [
      {x:.46,y:.56,n:'R',c:'#3B82F6'},
      {x:.48,y:.70,n:'P',c:'#F59E0B'},
    ];
    buddies.forEach(b=>{
      const bx=px(b.x)+Math.sin(state.tick*.025)*4;
      const by=py(b.y)+Math.cos(state.tick*.03)*3;
      ctx.beginPath();
      ctx.arc(bx,by,9,0,Math.PI*2);
      ctx.fillStyle=b.c;
      ctx.shadowColor=b.c;ctx.shadowBlur=8;
      ctx.fill();ctx.shadowBlur=0;
      ctx.font='bold 8px Inter';
      ctx.fillStyle='#fff';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(b.n,bx,by);
      ctx.textBaseline='alphabetic';
    });
  }

  function drawNodeLabels() {
    const show=[1,4,5,8,10,11,12];
    ctx.font='10px Inter';
    ctx.textAlign='center';
    show.forEach(i=>{
      const x=nx(i),y=ny(i);
      ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);
      ctx.fillStyle='rgba(139,148,158,.6)';
      ctx.fill();
      ctx.fillStyle='rgba(139,148,158,.7)';
      ctx.fillText(NODES[i].lbl,x,y-9);
    });
  }

  function resetAnim() { routeProgress = 0; }

  return { init, resetAnim };
})();

// ── Build Route Cards ──────────────────────────
function buildCards(routes) {
  const wrap = document.getElementById('route-cards');
  wrap.innerHTML = '';
  document.getElementById('routes-count').textContent = `${routes.length} routes`;

  const rankLabels  = ['Shortest','Fastest','Eco-Best','Quietest'];
  const badgeClass  = ['badge-1','badge-2','badge-3','badge-4'];

  routes.forEach((r,i)=>{
    const card = document.createElement('div');
    card.className = 'route-card';
    card.id = `rc-${i}`;

    const crowdColor = r.crowd>70?'var(--red)':r.crowd>50?'var(--amber)':'var(--green)';
    const co2Str = r.co2===0 ? '0 g' : `${r.co2} kg`;

    card.innerHTML = `
      <div class="route-card-top">
        <span class="route-badge ${badgeClass[i]}">${rankLabels[i]}</span>
        ${r.eco ? '<span class="eco-chip">Eco</span>' : ''}
      </div>
      <div class="route-card-name">${r.name}</div>
      <div class="route-card-via">${r.via}</div>
      <div class="route-card-nums">
        <div class="rnum">
          <div class="rnum-val">${r.dist} km</div>
          <div class="rnum-key">Distance</div>
        </div>
        <div class="rnum">
          <div class="rnum-val">${r.time} min</div>
          <div class="rnum-key">Duration</div>
        </div>
        <div class="rnum">
          <div class="rnum-val" style="color:${r.co2===0?'var(--green)':''}">${co2Str}</div>
          <div class="rnum-key">CO₂</div>
        </div>
        <div class="rnum">
          <div class="rnum-val" style="color:${crowdColor}">${r.crowd}%</div>
          <div class="rnum-key">Crowd</div>
        </div>
      </div>
      <div class="route-card-footer">
        <div class="conf-row-inline">
          <div class="conf-bar-sm"><div class="conf-fill-sm" style="width:${r.conf}%"></div></div>
          ${r.conf}% confidence
        </div>
      </div>`;

    card.addEventListener('click', ()=> selectRoute(r, card));
    wrap.appendChild(card);

    // stagger entrance
    card.style.opacity='0';card.style.transform='translateY(8px)';
    setTimeout(()=>{
      card.style.transition='all .3s ease';
      card.style.opacity='1';card.style.transform='none';
    }, i*60);
  });
}

// ── Select Route ───────────────────────────────
function selectRoute(route, cardEl) {
  state.selectedRoute = route;
  document.querySelectorAll('.route-card').forEach(c=>c.classList.remove('selected'));
  cardEl?.classList.add('selected');

  // ETA
  const now = new Date();
  now.setMinutes(now.getMinutes()+route.time);
  const h=now.getHours(),m=now.getMinutes().toString().padStart(2,'0');
  const ampm=h>=12?'PM':'AM';
  const h12=((h-1)%12+1);
  document.getElementById('eta-value').textContent = `${h12}:${m} ${ampm}`;
  document.getElementById('eta-dist').textContent  = `${route.dist} km away`;
  const confFill = document.getElementById('conf-fill');
  if (confFill) confFill.style.width = `${route.conf}%`;
  document.getElementById('conf-pct').textContent  = `${route.conf}%`;

  // Traffic pill
  const tDot = document.getElementById('traffic-dot');
  const tTxt = document.getElementById('traffic-text');
  if (route.crowd>70){
    tDot.style.background='var(--red)'; tTxt.textContent='Heavy';
  } else if(route.crowd>50){
    tDot.style.background='var(--amber)'; tTxt.textContent='Moderate';
  } else {
    tDot.style.background='var(--green)'; tTxt.textContent='Light';
  }
  document.getElementById('crowd-pct').textContent = `${route.crowd}%`;

  // Carbon ring
  const driveEq=3.8;
  const saved=Math.max(0,driveEq-route.co2).toFixed(1);
  const pct=Math.round((saved/driveEq)*100);
  document.getElementById('carbon-pct').textContent = `${pct}%`;
  document.getElementById('saved-co2').textContent  = `${saved} kg`;
  document.getElementById('transit-co2').textContent= `${route.co2} kg`;
  const ring = document.getElementById('carbon-ring-fill');
  if(ring){
    const c=2*Math.PI*32;
    ring.style.strokeDasharray=`${(pct/100)*c} ${c}`;
  }

  // Open modal if steps
  if (route.steps && route.steps.length) openModal(route);
}

// ── Modal ──────────────────────────────────────
function openModal(route) {
  document.getElementById('modal-title').textContent = route.name;
  document.getElementById('modal-subtitle').textContent = route.via;

  const co2Str = route.co2===0?'0 g':`${route.co2} kg`;
  document.getElementById('modal-stats').innerHTML = `
    <div class="mstat"><div class="mstat-val">${route.dist} km</div><div class="mstat-key">Distance</div></div>
    <div class="mstat"><div class="mstat-val">${route.time} min</div><div class="mstat-key">Duration</div></div>
    <div class="mstat"><div class="mstat-val">${co2Str}</div><div class="mstat-key">CO₂</div></div>
    <div class="mstat"><div class="mstat-val">${route.conf}%</div><div class="mstat-key">Confidence</div></div>
  `;

  document.getElementById('modal-body').innerHTML = route.steps.map((s,i)=>`
    <div class="modal-step">
      <div class="step-num">${i+1}</div>
      <div class="step-text">${s}</div>
    </div>`).join('');

  document.getElementById('route-modal').classList.remove('hidden');
}

// ── Find Routes ────────────────────────────────
function findRoutes() {
  const from = document.getElementById('from-input').value.trim();
  const to   = document.getElementById('to-input').value.trim();
  if (!from||!to){ toast('Enter both origin and destination','warning'); return; }

  const btn = document.getElementById('find-route-btn');
  const txt = document.getElementById('btn-text');
  btn.disabled=true; txt.textContent='Searching…';

  setTimeout(()=>{
    const routes = getRoutes(state.mode);
    state.currentRoutes = routes;
    buildCards(routes);
    Map.resetAnim();
    state.selectedRoute = null;

    btn.disabled=false; txt.textContent='Find Route';
    toast(`Found ${routes.length} routes · Best: ${routes[0].name}`,'success');
    updateAITip(routes);

    // Auto-select top route after animation
    setTimeout(()=>{
      const first=document.getElementById('rc-0');
      if(first) selectRoute(routes[0],first);
    },500);

    // Reroute simulation
    setTimeout(()=> triggerReroute(), 9000);
  }, 1200);
}

// ── AI Tips ─────────────────────────────────────
function updateAITip(routes) {
  const best=routes[0];
  const now=new Date();
  const tips=[
    `Leave in <b>8 minutes</b> to beat peak traffic on MG Road — saves <b>${Math.round(best.time*.3)} min</b>.`,
    `Metro crowd eases after <b>9:30 AM</b>. Transit saves <b>${(3.8-best.co2).toFixed(1)} kg CO₂</b> today.`,
    `🔥 <b>5-day eco-streak!</b> Take a green route to extend it and earn a reward.`,
    `Rain forecast after <b>5 PM</b>. Consider leaving by <b>4:45 PM</b> to stay dry.`,
    `Cyber City parking is <b>92% full</b>. Transit saves you ₹120 in parking fees.`,
  ];
  const tip=tips[Math.floor(Math.random()*tips.length)];
  document.getElementById('ai-tip-text').innerHTML=tip;
  document.getElementById('ai-tip-time').textContent=
    `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// ── Reroute ────────────────────────────────────
function triggerReroute() {
  const el=document.getElementById('reroute-alert');
  const cd=document.getElementById('reroute-countdown');
  el.classList.remove('hidden');
  let n=10;
  const t=setInterval(()=>{
    n--;cd.textContent=n;
    if(n<=0){clearInterval(t);doReroute();}
  },1000);
  state.rerouteTimer=t;
}
function doReroute() {
  document.getElementById('reroute-alert').classList.add('hidden');
  if(state.rerouteTimer)clearInterval(state.rerouteTimer);
  toast('Rerouted — accident on NH-48 avoided. ETA updated +7 min.','warning');
  const etaEl=document.getElementById('eta-value');
  const match=etaEl.textContent.match(/(\d+):(\d+)\s*(AM|PM)/);
  if(match){
    let mins=parseInt(match[2])+7;
    const hrs=match[1];const ap=match[3];
    etaEl.textContent=`${hrs}:${mins.toString().padStart(2,'0')} ${ap}`;
  }
}

// ── Toast ──────────────────────────────────────
function toast(msg, type='info') {
  const icons={success:'✓',warning:'⚠',info:'·',error:'✕'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>{el.classList.add('toast-out');setTimeout(()=>el.remove(),200);},3500);
}

// ── Events ─────────────────────────────────────
document.getElementById('find-route-btn').addEventListener('click', findRoutes);
document.getElementById('from-input').addEventListener('keydown',e=>e.key==='Enter'&&findRoutes());
document.getElementById('to-input').addEventListener('keydown',  e=>e.key==='Enter'&&findRoutes());

document.getElementById('swap-btn').addEventListener('click',()=>{
  const f=document.getElementById('from-input');
  const t=document.getElementById('to-input');
  [f.value,t.value]=[t.value,f.value];
  toast('Swapped origin and destination','info');
});

document.getElementById('mode-tabs').addEventListener('click',e=>{
  const btn=e.target.closest('.mode-btn');
  if(!btn) return;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.mode=btn.dataset.mode;
  if(state.currentRoutes.length){
    const routes=getRoutes(state.mode);
    state.currentRoutes=routes;
    buildCards(routes);
    Map.resetAnim();
    state.selectedRoute=null;
    setTimeout(()=>{
      const first=document.getElementById('rc-0');
      if(first) selectRoute(routes[0],first);
    },400);
  }
});

// Map toggles
['toggle-heatmap','toggle-eco','toggle-buddy'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(){
    this.classList.toggle('active');
    if(id==='toggle-heatmap') state.showHeatmap=!state.showHeatmap;
    if(id==='toggle-eco')     state.showEco=!state.showEco;
    if(id==='toggle-buddy')   state.showBuddy=!state.showBuddy;
  });
});

document.getElementById('ctrl-zoom-in').addEventListener('click',()=>toast('Zoomed in','info'));
document.getElementById('ctrl-zoom-out').addEventListener('click',()=>toast('Zoomed out','info'));
document.getElementById('ctrl-locate').addEventListener('click',()=>toast('Locating… GPS signal strong','success'));

document.getElementById('reroute-now-btn').addEventListener('click', doReroute);
document.getElementById('reroute-dismiss').addEventListener('click',()=>{
  document.getElementById('reroute-alert').classList.add('hidden');
  if(state.rerouteTimer)clearInterval(state.rerouteTimer);
});

document.getElementById('modal-close-btn').addEventListener('click',()=>
  document.getElementById('route-modal').classList.add('hidden'));
document.getElementById('route-modal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) e.currentTarget.classList.add('hidden');
});
document.getElementById('btn-start-nav').addEventListener('click',()=>{
  document.getElementById('route-modal').classList.add('hidden');
  if(state.selectedRoute) toast(`Navigation started on ${state.selectedRoute.name}`,'success');
});
document.getElementById('btn-rate-route').addEventListener('click',()=>{
  document.getElementById('route-modal').classList.add('hidden');
  toast('Thanks for rating! Streak extended 🔥','success');
  const sv=document.getElementById('streak-value');
  sv.textContent=parseInt(sv.textContent)+1;
});

// ── SVG gradient inject ────────────────────────
function injectSVGGrad() {
  const svg=document.querySelector('.carbon-svg');
  if(!svg) return;
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML=`<linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#22C55E"/>
    <stop offset="100%" stop-color="#06B6D4"/>
  </linearGradient>`;
  svg.prepend(defs);
}

// ── AI tip rotation (idle) ─────────────────────
function rotateTips() {
  const tips=[
    'Leave in <b>8 minutes</b> to beat peak traffic on MG Road — saves <b>14 min</b>.',
    'Metro Blue Line is on schedule. Platform 3 at <b>63% capacity</b> right now.',
    '🌿 <b>5-day eco-streak!</b> Take transit today to keep it going.',
    '☀️ Clear skies until 4 PM — great day for a <b>bike commute</b>.',
    'NH-48 traffic easing. ETA confidence just rose to <b>94%</b>.',
  ];
  let i=0;
  setInterval(()=>{
    if(state.currentRoutes.length) return;
    i=(i+1)%tips.length;
    document.getElementById('ai-tip-text').innerHTML=tips[i];
  },5000);
}

// ── Live crowd update ──────────────────────────
function liveCrowdUpdates() {
  setInterval(()=>{
    if(!state.currentRoutes.length) return;
    const el=document.getElementById('crowd-pct');
    const cur=parseInt(el.textContent)||50;
    const next=Math.max(15,Math.min(95,cur+Math.round(Math.random()*8-4)));
    el.textContent=`${next}%`;
  },4000);
}

// ── Init ───────────────────────────────────────
window.addEventListener('load',()=>{
  Map.init();
  injectSVGGrad();
  rotateTips();
  liveCrowdUpdates();

  // Auto-load on start
  setTimeout(findRoutes, 600);
});
