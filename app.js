/* =============================================
   PATHFINDER — Application Logic
   ============================================= */

'use strict';

// ─── State ───────────────────────────────────────
const state = {
  selectedMode: 'drive',
  selectedRoute: null,
  zoom: 1,
  showHeatmap: true,
  showEco: false,
  showBuddy: false,
  animFrame: null,
  rerouteTimer: null,
  currentRoutes: [],
  streak: 5,
};

// ─── Route Data Generator ─────────────────────────
function generateRoutes(from, to, mode) {
  const modeData = {
    drive: [
      { name: 'NH-48 Express',     via: 'Dhaula Kuan → NH-48 → Cyber City', dist: 28.4, time: 42, co2: 3.8, crowd: 78, conf: 88, eco: false, steps: ['Take Rajpath toward India Gate','Merge onto Ring Road South','Take Dhaula Kuan flyover','Enter NH-48 (National Highway 48)','Exit at Cyber City toll plaza','Arrive at Cyber City, Gurugram'] },
      { name: 'Ring Road Route',   via: 'Outer Ring Road → Mahipalpur', dist: 31.2, time: 48, co2: 3.2, crowd: 52, conf: 82, eco: true, steps: ['Head south on Janpath','Join Outer Ring Road at Dilli Haat','Continue past Mahipalpur','Take slip road to Dwarka Expressway','Cross Sheetla Mata Road','Arrive at Cyber City, Gurugram'] },
      { name: 'Mehrauli Road',     via: 'Aurobindo Marg → Mehrauli', dist: 33.8, time: 55, co2: 2.9, crowd: 40, conf: 75, eco: true, steps: ['Take Aurobindo Marg south','Pass IIT Delhi campus','Continue on Mehrauli-Gurgaon Road','Cross Ghitorni metro station','Join NH-48 at IFFCO Chowk','Arrive at Cyber City, Gurugram'] },
      { name: 'DND Flyway Alt',    via: 'Noida Expressway → Elevated', dist: 38.1, time: 61, co2: 4.1, crowd: 30, conf: 70, eco: false, steps: ['Head east toward DND Flyway','Cross Yamuna into Noida','Take NH-44 south','Join Western Peripheral Expressway','Enter Gurugram from east via NH-48','Arrive at Cyber City, Gurugram'] },
    ],
    transit: [
      { name: 'Blue Line + HUDA',  via: 'Rajiv Chowk → HUDA City Centre', dist: 29.0, time: 55, co2: 0.4, crowd: 82, conf: 92, eco: true, steps: ['Walk to Rajiv Chowk Metro','Board Blue Line toward Dwarka','Change at Dwarka Sector 21 → Yellow Line','Board Yellow Line toward HUDA City Centre','Exit at HUDA City Centre Metro','Auto/cab to Cyber City (2 min)'] },
      { name: 'Yellow Line Direct',via: 'AIIMS → Qutub Minar → HUDA', dist: 31.5, time: 60, co2: 0.3, crowd: 65, conf: 89, eco: true, steps: ['Walk to Janpath Metro','Board Yellow Line southbound','Pass Green Park, Hauz Khas, AIIMS','Continue to Qutab Minar and beyond','Arrive HUDA City Centre','Short walk to Cyber City'] },
      { name: 'Rapid Metro Combo', via: 'Palam → Gurugram Rapid Metro', dist: 34.2, time: 68, co2: 0.5, crowd: 48, conf: 80, eco: true, steps: ['Cab to Palam Metro','Board Airport Express → Dwarka','Switch to Green Line','Gurugram Rapid Metro connection','Cyber City Rapid Metro station','Direct arrival at Cyber City'] },
      { name: 'Bus + Metro',       via: 'DTC → Central Secretariat', dist: 36.0, time: 80, co2: 0.6, crowd: 35, conf: 72, eco: true, steps: ['DTC Bus 521 from CP','Alight at Central Secretariat','Metro Yellow Line southbound','HUDA City Centre terminus','Share auto to Cyber City','Arrive Cyber City'] },
    ],
    bike: [
      { name: 'Cycling Track NH-48',   via: 'Dedicated lane via Dhaula Kuan', dist: 27.0, time: 72, co2: 0.0, crowd: 20, conf: 78, eco: true, steps: ['Cycle south on Janpath cycling track','Join NH-48 dedicated bike lane','Pass Hero Honda Chowk','Use elevated cycling bridge at Sirhaul','Enter Cyber City bike zone','Park at Cyber City bike hub'] },
      { name: 'Mehrauli Greens Trail', via: 'Ridge Road → Mehrauli Forest', dist: 30.1, time: 85, co2: 0.0, crowd: 12, conf: 70, eco: true, steps: ['Ride through Lutyen\'s Delhi','Enter Delhi Ridge Green Zone','Scenic Mehrauli forest trail','Reach Qutab area junction','Join Mehrauli-Gurgaon Road','Arrive Cyber City'] },
      { name: 'Ring Road Sprint',      via: 'Outer Ring Road cycle path', dist: 29.8, time: 80, co2: 0.0, crowd: 15, conf: 74, eco: true, steps: [] },
      { name: 'Aggressive Route',      via: 'Main roads, fastest cycling', dist: 28.2, time: 76, co2: 0.0, crowd: 25, conf: 65, eco: true, steps: [] },
    ],
    walk: [
      { name: 'Scenic Walk Route',    via: 'India Gate → Lodhi Garden', dist: 5.2,  time: 64,  co2: 0.0, crowd: 30, conf: 95, eco: true, steps: [] },
      { name: 'Direct Walk',          via: 'Straight path via Janpath',   dist: 4.8,  time: 60,  co2: 0.0, crowd: 40, conf: 97, eco: true, steps: [] },
      { name: 'Park Walk',            via: 'Through Nehru Park gardens',  dist: 5.8,  time: 72,  co2: 0.0, crowd: 18, conf: 93, eco: true, steps: [] },
      { name: 'Heritage Trail',       via: 'Old Delhi lanes + monuments', dist: 6.5,  time: 82,  co2: 0.0, crowd: 22, conf: 88, eco: true, steps: [] },
    ],
  };

  const routes = (modeData[mode] || modeData.drive).map((r, i) => ({
    ...r,
    rank: i + 1,
    mode,
    id: `route-${mode}-${i}`,
  }));

  // Sort by priority: distance, time, co2, crowd
  return routes.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (a.time !== b.time) return a.time - b.time;
    return a.co2 - b.co2;
  }).map((r, i) => ({ ...r, rank: i + 1 }));
}

// ─── Map Canvas Renderer ──────────────────────────
const MapRenderer = (() => {
  let canvas, ctx, W, H;
  let tick = 0;
  let routeProgress = 0;
  let targetProgress = 0;
  let animating = false;

  const COLORS = {
    rank1: '#00e5ff',
    rank2: '#10b981',
    rank3: '#f59e0b',
    rank4: '#a78bfa',
    bg:    '#050a14',
    grid:  'rgba(0,229,255,0.04)',
    node:  'rgba(0,229,255,0.5)',
  };

  // City nodes (relative 0-1 coords)
  const NODES = [
    { x: 0.42, y: 0.15, label: 'LSPN' },
    { x: 0.50, y: 0.28, label: 'CP' },
    { x: 0.60, y: 0.22, label: 'IP Est' },
    { x: 0.35, y: 0.35, label: 'Karol Bagh' },
    { x: 0.50, y: 0.40, label: 'AIIMS' },
    { x: 0.40, y: 0.50, label: 'Dhaula Kuan' },
    { x: 0.55, y: 0.52, label: 'Lajpat Nagar' },
    { x: 0.30, y: 0.60, label: 'Kapashera' },
    { x: 0.48, y: 0.62, label: 'Mehrauli' },
    { x: 0.62, y: 0.65, label: 'Saket' },
    { x: 0.32, y: 0.72, label: 'NH-48 Entry' },
    { x: 0.50, y: 0.78, label: 'IFFCO Chowk' },
    { x: 0.45, y: 0.88, label: 'Cyber City' },
    { x: 0.65, y: 0.82, label: 'Sohna Rd' },
  ];

  // Road edges [from, to]
  const ROADS = [
    [0,1],[1,2],[1,3],[1,4],[2,6],[3,5],[4,5],[4,6],
    [5,7],[5,8],[6,9],[7,10],[8,10],[8,11],[9,11],
    [10,12],[11,12],[11,13],[12,13],
  ];

  // Shortest route path node indices
  const ROUTE_PATHS = {
    rank1: [1,4,5,10,12],
    rank2: [1,4,5,7,10,12],
    rank3: [1,4,8,11,12],
    rank4: [1,2,6,9,11,12],
  };

  // Heatmap hotspots (x,y,intensity)
  const HOTSPOTS = [
    { x: 0.50, y: 0.28, r: 0.06, i: 0.9 },
    { x: 0.40, y: 0.50, r: 0.08, i: 0.7 },
    { x: 0.32, y: 0.72, r: 0.07, i: 0.8 },
    { x: 0.50, y: 0.78, r: 0.05, i: 0.6 },
    { x: 0.62, y: 0.65, r: 0.04, i: 0.5 },
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
    const container = canvas.parentElement;
    W = canvas.width  = container.clientWidth;
    H = canvas.height = container.clientHeight;
  }

  function nx(n) { return NODES[n].x * W; }
  function ny(n) { return NODES[n].y * H; }
  function px(x) { return x * W; }
  function py(y) { return y * H; }

  function loop() {
    tick++;
    draw();
    state.animFrame = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    if (state.showHeatmap) drawHeatmap();
    drawGrid();
    drawRoads();
    drawRoutes();
    if (state.showBuddy) drawBuddies();
    drawNodes();
    drawOriginDest();
  }

  function drawBackground() {
    const grad = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.7);
    grad.addColorStop(0, '#060d1f');
    grad.addColorStop(1, '#030710');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const spacing = 40;
    for (let x = 0; x < W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawHeatmap() {
    HOTSPOTS.forEach(h => {
      const t = (Math.sin(tick * 0.03) + 1) / 2;
      const alpha = 0.08 + t * 0.06;
      const r = h.r * Math.min(W, H);
      const grad = ctx.createRadialGradient(px(h.x), py(h.y), 0, px(h.x), py(h.y), r);
      const intensity = h.i;
      const col = intensity > 0.7 ? `rgba(239,68,68,${alpha * intensity})` :
                  intensity > 0.5 ? `rgba(245,158,11,${alpha * intensity})` :
                                    `rgba(16,185,129,${alpha * intensity})`;
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px(h.x), py(h.y), r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRoads() {
    ctx.lineWidth = 1.5;
    ROADS.forEach(([a, b]) => {
      ctx.strokeStyle = 'rgba(30, 60, 120, 0.5)';
      ctx.beginPath();
      ctx.moveTo(nx(a), ny(a));
      ctx.lineTo(nx(b), ny(b));
      ctx.stroke();
    });
  }

  function drawRoutes() {
    if (!state.currentRoutes.length) return;

    // Animate progress
    if (routeProgress < 1) routeProgress = Math.min(1, routeProgress + 0.015);

    const colors = [COLORS.rank1, COLORS.rank2, COLORS.rank3, COLORS.rank4];

    state.currentRoutes.forEach((route, idx) => {
      const pathKey = `rank${idx + 1}`;
      const path = ROUTE_PATHS[pathKey];
      if (!path) return;

      const color = colors[idx];
      const isSelected = state.selectedRoute && state.selectedRoute.rank === idx + 1;
      const alpha = isSelected ? 1 : (state.selectedRoute ? 0.25 : 0.7);
      const lw = isSelected ? 4 : 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      // Draw partial path based on progress
      const totalSegs = path.length - 1;
      const progress = routeProgress * totalSegs;
      const fullSegs = Math.floor(progress);
      const partial = progress - fullSegs;

      ctx.beginPath();
      ctx.moveTo(nx(path[0]), ny(path[0]));
      for (let i = 0; i < Math.min(fullSegs, totalSegs); i++) {
        ctx.lineTo(nx(path[i+1]), ny(path[i+1]));
      }
      if (fullSegs < totalSegs) {
        const sx = nx(path[fullSegs]), sy = ny(path[fullSegs]);
        const ex = nx(path[fullSegs+1]), ey = ny(path[fullSegs+1]);
        ctx.lineTo(sx + (ex - sx) * partial, sy + (ey - sy) * partial);
      }
      ctx.stroke();

      // Animated pulse on selected
      if (isSelected && routeProgress >= 1) {
        const pulse = (Math.sin(tick * 0.08) + 1) / 2;
        const lastIdx = path[path.length - 1];
        ctx.beginPath();
        ctx.arc(nx(lastIdx), ny(lastIdx), 6 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = (1 - pulse) * alpha;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  function drawNodes() {
    NODES.forEach((n, i) => {
      const x = px(n.x), y = py(n.y);
      const pulse = (Math.sin(tick * 0.04 + i * 0.8) + 1) / 2;

      ctx.beginPath();
      ctx.arc(x, y, 3 + pulse * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 229, 255, ${0.3 + pulse * 0.3})`;
      ctx.fill();

      // Label for important nodes
      if ([1, 4, 5, 10, 12].includes(i)) {
        ctx.font = '500 9px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(140, 180, 220, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, x, y - 8);
      }
    });
  }

  function drawOriginDest() {
    if (!state.currentRoutes.length) return;

    // Origin dot
    const orig = NODES[1];
    const dest = NODES[12];

    // Origin pulse
    const pulse = (Math.sin(tick * 0.07) + 1) / 2;
    ctx.beginPath();
    ctx.arc(px(orig.x), py(orig.y), 8 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(16, 185, 129, ${0.15 - pulse * 0.1})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(orig.x), py(orig.y), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', px(orig.x), py(orig.y));

    // Destination
    ctx.beginPath();
    ctx.arc(px(dest.x), py(dest.y), 8 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${0.15 - pulse * 0.1})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(dest.x), py(dest.y), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('B', px(dest.x), py(dest.y));
    ctx.textBaseline = 'alphabetic';
  }

  function drawBuddies() {
    const buddyPositions = [
      { x: 0.44, y: 0.56, name: 'Rahul', color: '#06b6d4' },
      { x: 0.48, y: 0.68, name: 'Priya', color: '#f59e0b' },
    ];
    buddyPositions.forEach(b => {
      const bx = px(b.x) + Math.sin(tick * 0.02) * 3;
      const by = py(b.y) + Math.cos(tick * 0.025) * 2;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.font = 'bold 7px Outfit';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name[0], bx, by);
      ctx.textBaseline = 'alphabetic';

      ctx.font = '8px Outfit';
      ctx.fillStyle = b.color;
      ctx.fillText(b.name, bx, by - 14);
    });
  }

  function triggerRouteAnimation() {
    routeProgress = 0;
  }

  return { init, triggerRouteAnimation, resize };
})();

// ─── Route Card Builder ───────────────────────────
function buildRouteCards(routes) {
  const container = document.getElementById('route-cards');
  container.innerHTML = '';

  routes.forEach((route, idx) => {
    const card = document.createElement('div');
    card.className = `route-card rank-${route.rank}`;
    card.id = `route-card-${idx}`;
    card.setAttribute('data-index', idx);

    const modeIcons = { drive: '🚗', transit: '🚇', bike: '🚴', walk: '🚶' };
    const rankLabels = ['Shortest', 'Fastest', 'Eco-Best', 'Least Crowd'];
    const co2Label = route.co2 === 0 ? '0 g' : `${route.co2} kg`;
    const crowdColor = route.crowd > 70 ? '#ef4444' : route.crowd > 50 ? '#f59e0b' : '#10b981';

    card.innerHTML = `
      <div class="route-card-header">
        <span class="route-rank-badge">#${route.rank} ${rankLabels[idx] || ''}</span>
        <span class="route-mode-icon">${modeIcons[route.mode] || '🚗'}</span>
      </div>
      <div class="route-name">${route.name}</div>
      <div class="route-via">${route.via}</div>
      <div class="route-stats">
        <div class="rstat"><span class="rstat-val">${route.dist} km</span><span class="rstat-label">Distance</span></div>
        <div class="rstat"><span class="rstat-val">${route.time} min</span><span class="rstat-label">ETA</span></div>
        <div class="rstat"><span class="rstat-val" style="color:${route.co2 === 0 ? '#10b981' : ''}">${co2Label}</span><span class="rstat-label">CO₂</span></div>
        <div class="rstat"><span class="rstat-val" style="color:${crowdColor}">${route.crowd}%</span><span class="rstat-label">Crowd</span></div>
      </div>
      <div class="route-confidence">
        <div class="conf-mini-bar"><div class="conf-mini-fill" style="width:${route.conf}%"></div></div>
        <span>${route.conf}% confidence</span>
      </div>
      ${route.eco ? '<div class="eco-tag">🌿 Eco-Friendly Route</div>' : ''}
    `;

    card.addEventListener('click', () => selectRoute(route, card));
    container.appendChild(card);

    // Stagger animation
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.35s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateX(0)';
    }, idx * 80);
  });
}

// ─── Select Route ─────────────────────────────────
function selectRoute(route, cardEl) {
  state.selectedRoute = route;

  // Update card styles
  document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
  if (cardEl) cardEl.classList.add('selected');

  // Update HUD
  const now = new Date();
  now.setMinutes(now.getMinutes() + route.time);
  const etaHours = now.getHours();
  const etaMins = now.getMinutes().toString().padStart(2, '0');
  const ampm = etaHours >= 12 ? 'PM' : 'AM';
  const h12 = ((etaHours - 1) % 12 + 1);
  document.getElementById('eta-value').textContent = `${h12}:${etaMins} ${ampm}`;
  document.getElementById('eta-confidence').querySelector('.conf-bar').style.width = `${route.conf}%`;
  document.getElementById('eta-confidence').querySelector('span').textContent = `${route.conf}% confidence`;

  // Traffic
  const tEl = document.getElementById('traffic-level');
  const crowd = route.crowd;
  if (crowd > 70) {
    tEl.textContent = 'Heavy';
    tEl.className = 'hud-card-value traffic-high';
  } else if (crowd > 50) {
    tEl.textContent = 'Moderate';
    tEl.className = 'hud-card-value traffic-moderate';
  } else {
    tEl.textContent = 'Light';
    tEl.className = 'hud-card-value traffic-low';
  }

  // Crowd bar
  document.getElementById('crowd-bar').style.width = `${route.crowd}%`;
  document.getElementById('crowd-sub').textContent = `Platform 3 — ${route.crowd}% full`;

  // Carbon
  const driveEq = 3.8;
  const saved = Math.max(0, driveEq - route.co2).toFixed(1);
  const pct = Math.round((saved / driveEq) * 100);
  document.getElementById('carbon-pct').textContent = `${pct}%`;
  document.getElementById('saved-co2').textContent = `${saved} kg`;
  document.getElementById('transit-co2').textContent = `${route.co2} kg`;

  // Carbon ring SVG
  const fill = document.getElementById('carbon-ring-fill');
  if (fill) {
    const circumference = 2 * Math.PI * 40;
    const dashLen = (pct / 100) * circumference;
    fill.style.strokeDasharray = `${dashLen} ${circumference}`;
  }

  // Show modal if route has steps
  if (route.steps && route.steps.length > 0) {
    openRouteModal(route);
  }

  showToast(`📍 Route selected: ${route.name}`, 'info');
}

// ─── Route Modal ──────────────────────────────────
function openRouteModal(route) {
  const modal = document.getElementById('route-modal');
  document.getElementById('modal-title').textContent = route.name;
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="modal-meta" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:4px;">
      <span style="font-size:0.82rem;color:var(--cyan)">📏 ${route.dist} km</span>
      <span style="font-size:0.82rem;color:var(--text-2)">⏱ ${route.time} min</span>
      <span style="font-size:0.82rem;color:#10b981">🌿 ${route.co2} kg CO₂</span>
      <span style="font-size:0.82rem;color:var(--text-2)">🎯 ${route.conf}% confidence</span>
    </div>
    ${route.steps.map((step, i) => `
      <div class="modal-step">
        <div class="modal-step-num">${i + 1}</div>
        <div class="modal-step-text">${step}</div>
      </div>
    `).join('')}
  `;
  modal.classList.remove('hidden');
}

// ─── Find Routes ──────────────────────────────────
function findRoutes() {
  const from = document.getElementById('from-input').value.trim();
  const to   = document.getElementById('to-input').value.trim();

  if (!from || !to) {
    showToast('⚠️ Please enter both origin and destination', 'warning');
    return;
  }

  const btn = document.getElementById('find-route-btn');
  btn.classList.add('loading');
  btn.disabled = true;
  state.selectedRoute = null;
  document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));

  // Simulate loading
  setTimeout(() => {
    const routes = generateRoutes(from, to, state.selectedMode);
    state.currentRoutes = routes;
    buildRouteCards(routes);
    MapRenderer.triggerRouteAnimation();

    btn.classList.remove('loading');
    btn.disabled = false;

    // Auto-select first route
    setTimeout(() => {
      const firstCard = document.querySelector('.route-card');
      if (firstCard) selectRoute(routes[0], firstCard);
    }, 600);

    updateAITip(routes);
    showToast(`✅ Found ${routes.length} smart routes from ${from.split(',')[0]} to ${to.split(',')[0]}`, 'success');

    // Simulate reroute alert after 8s
    setTimeout(triggerRerouteAlert, 8000);
  }, 1400);
}

// ─── AI Tip Updater ───────────────────────────────
function updateAITip(routes) {
  const now = new Date();
  const hour = now.getHours();
  const best = routes[0];

  const tips = [
    `Leave in <strong>8 minutes</strong> to avoid peak traffic on MG Road. Save <strong>${Math.round(best.time * 0.25)} min</strong>.`,
    `Metro crowd drops after <strong>9:30 AM</strong>. Taking transit now saves <strong>${(3.8 - best.co2).toFixed(1)} kg CO₂</strong>.`,
    `🔥 <strong>5-day eco-streak</strong>! Take the green route to extend it and unlock a reward.`,
    `Weather alert: Rain after 5 PM. Leave by <strong>4:45 PM</strong> to avoid delays.`,
    `Cyber City parking is <strong>92% full</strong>. Consider transit — saves ₹120 in parking.`,
  ];

  const tip = tips[Math.floor(Math.random() * tips.length)];
  document.getElementById('ai-tip-text').innerHTML = tip;
  document.getElementById('ai-tip-time').textContent = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// ─── Reroute Alert ────────────────────────────────
function triggerRerouteAlert() {
  const alert = document.getElementById('reroute-alert');
  const countdown = document.getElementById('reroute-countdown');
  alert.classList.remove('hidden');

  let count = 10;
  const timer = setInterval(() => {
    count--;
    countdown.textContent = count;
    if (count <= 0) {
      clearInterval(timer);
      doReroute();
    }
  }, 1000);
  state.rerouteTimer = timer;
}

function doReroute() {
  const alert = document.getElementById('reroute-alert');
  alert.classList.add('hidden');
  if (state.rerouteTimer) clearInterval(state.rerouteTimer);
  showToast('🔄 Rerouted! Accident on NH-48 avoided. New ETA updated.', 'warning');

  // Update ETA
  const etaEl = document.getElementById('eta-value');
  const parts = etaEl.textContent.split(':');
  if (parts.length === 2) {
    const [h, rest] = parts;
    const [m, ampm] = rest.split(' ');
    etaEl.textContent = `${h}:${(parseInt(m) + 7).toString().padStart(2,'0')} ${ampm}`;
  }
}

// ─── Toast System ─────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Swap Locations ───────────────────────────────
document.getElementById('swap-btn').addEventListener('click', () => {
  const fromEl = document.getElementById('from-input');
  const toEl   = document.getElementById('to-input');
  [fromEl.value, toEl.value] = [toEl.value, fromEl.value];
  showToast('🔄 Origin and destination swapped', 'info');
});

// ─── Mode Tabs ────────────────────────────────────
document.getElementById('mode-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.mode-tab');
  if (!tab) return;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  state.selectedMode = tab.dataset.mode;

  if (state.currentRoutes.length) {
    const routes = generateRoutes(
      document.getElementById('from-input').value,
      document.getElementById('to-input').value,
      state.selectedMode
    );
    state.currentRoutes = routes;
    buildRouteCards(routes);
    MapRenderer.triggerRouteAnimation();
    state.selectedRoute = null;
    setTimeout(() => {
      const firstCard = document.querySelector('.route-card');
      if (firstCard) selectRoute(routes[0], firstCard);
    }, 400);
  }
});

// ─── Find Route Button ────────────────────────────
document.getElementById('find-route-btn').addEventListener('click', findRoutes);
document.getElementById('from-input').addEventListener('keydown', e => { if (e.key === 'Enter') findRoutes(); });
document.getElementById('to-input').addEventListener('keydown',   e => { if (e.key === 'Enter') findRoutes(); });

// ─── Map Toggles ──────────────────────────────────
document.getElementById('toggle-heatmap').addEventListener('click', function() {
  state.showHeatmap = !state.showHeatmap;
  this.classList.toggle('active', state.showHeatmap);
});
document.getElementById('toggle-eco').addEventListener('click', function() {
  state.showEco = !state.showEco;
  this.classList.toggle('active', state.showEco);
  showToast(state.showEco ? '🌿 Eco routes highlighted' : '🌿 Eco overlay off', 'info');
});
document.getElementById('toggle-buddy').addEventListener('click', function() {
  state.showBuddy = !state.showBuddy;
  this.classList.toggle('active', state.showBuddy);
  showToast(state.showBuddy ? '👥 Buddy tracking on' : '👥 Buddy tracking off', 'info');
});

// ─── Map Zoom Controls ────────────────────────────
document.getElementById('ctrl-zoom-in').addEventListener('click', () => {
  state.zoom = Math.min(3, state.zoom + 0.25);
  showToast('🔍 Zoom: ' + (state.zoom * 100).toFixed(0) + '%', 'info');
});
document.getElementById('ctrl-zoom-out').addEventListener('click', () => {
  state.zoom = Math.max(0.5, state.zoom - 0.25);
  showToast('🔍 Zoom: ' + (state.zoom * 100).toFixed(0) + '%', 'info');
});
document.getElementById('ctrl-locate').addEventListener('click', () => {
  showToast('📍 Locating you… GPS signal strong', 'success');
});
document.getElementById('ctrl-layers').addEventListener('click', () => {
  showToast('⊞ Layer switcher coming soon', 'info');
});

// ─── Reroute Now Button ───────────────────────────
document.getElementById('reroute-now-btn').addEventListener('click', doReroute);

// ─── Modal Close ─────────────────────────────────
document.getElementById('modal-close-btn').addEventListener('click', () => {
  document.getElementById('route-modal').classList.add('hidden');
});
document.getElementById('route-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});
document.getElementById('btn-start-nav').addEventListener('click', () => {
  document.getElementById('route-modal').classList.add('hidden');
  if (state.selectedRoute) {
    showToast(`🚀 Navigation started on ${state.selectedRoute.name}!`, 'success');
  }
});
document.getElementById('btn-rate-route').addEventListener('click', () => {
  document.getElementById('route-modal').classList.add('hidden');
  showToast('😊 Thank you for rating your route! Streak extended 🔥', 'success');
  const sc = document.getElementById('streak-count');
  sc.textContent = parseInt(sc.textContent) + 1;
});

// ─── Nav Links ────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// ─── SVG Gradient for Carbon Ring ────────────────
function injectSVGDefs() {
  const svg = document.querySelector('.carbon-ring');
  if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="carbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#00e5ff"/>
    </linearGradient>`;
  svg.prepend(defs);
}

// ─── Live Clock in Header ─────────────────────────
function startLiveClock() {
  const updateTip = () => {
    const now = new Date();
    const t = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
    const tipTimeEl = document.getElementById('ai-tip-time');
    if (tipTimeEl && !state.currentRoutes.length) tipTimeEl.textContent = t;
  };
  setInterval(updateTip, 60000);
  updateTip();
}

// ─── Periodic AI Tips ─────────────────────────────
function startAITipRotation() {
  const tips = [
    'Leave in <strong>8 minutes</strong> to beat peak hour on MG Road. Save <strong>14 min</strong>.',
    '🌿 Taking transit today saves <strong>3.4 kg CO₂</strong> — equivalent to charging 280 phones!',
    '⚡ Metro Blue Line is running on time. Platform 3 crowd at <strong>63%</strong> right now.',
    '🏆 You\'re on a <strong>5-day eco-streak</strong>! Keep it up for a ₹50 cashback reward.',
    '☀️ Clear skies today. Perfect for a <strong>bike commute</strong> — saves 4.1 kg CO₂.',
    '🚦 NH-48 traffic easing up. ETA confidence just rose to <strong>94%</strong>.',
  ];
  let tipIdx = 0;
  if (!state.currentRoutes.length) {
    setInterval(() => {
      if (!state.currentRoutes.length) {
        tipIdx = (tipIdx + 1) % tips.length;
        document.getElementById('ai-tip-text').innerHTML = tips[tipIdx];
      }
    }, 6000);
  }
}

// ─── Init ─────────────────────────────────────────
window.addEventListener('load', () => {
  MapRenderer.init();
  injectSVGDefs();
  startLiveClock();
  startAITipRotation();

  // Auto-find routes on load for demo
  setTimeout(() => {
    findRoutes();
  }, 800);

  // Periodic crowd updates
  setInterval(() => {
    if (state.currentRoutes.length) {
      const delta = Math.floor(Math.random() * 10) - 5;
      const bar = document.getElementById('crowd-bar');
      if (bar) {
        const current = parseInt(bar.style.width);
        const next = Math.max(10, Math.min(95, current + delta));
        bar.style.width = `${next}%`;
        document.getElementById('crowd-sub').textContent =
          `Platform 3 — ${next}% full`;
      }
    }
  }, 5000);
});
