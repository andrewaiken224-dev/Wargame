const state = {
  turn: 1,
  phase: 'planning',
  selectedUnitId: null,
  currentOrderType: 'move',
  templates: [],
  history: [],
  timelineSnapshots: [],
  units: [
    { id: 'A1', side: 'ally', x: 80, y: 90, readiness: 'Full', supply: 'Well-supplied', morale: 'Veteran', hp: 100, ap: 3, power: 7, mobility: 6, type: 'Infantry Btn' },
    { id: 'A2', side: 'ally', x: 120, y: 220, readiness: 'Reduced', supply: 'Low', morale: 'Regular', hp: 75, ap: 3, power: 6, mobility: 5, type: 'Armor Coy' },
    { id: 'E1', side: 'enemy', x: 530, y: 160, readiness: 'Full', supply: 'Well-supplied', morale: 'Regular', hp: 100, ap: 3, power: 7, mobility: 5, type: 'Motorized Btn', spotted: false },
    { id: 'E2', side: 'enemy', x: 620, y: 300, readiness: 'Minimal', supply: 'Out', morale: 'Shaken', hp: 50, ap: 3, power: 4, mobility: 4, type: 'Artillery Bty', spotted: false },
  ],
  orders: [],
  supplyDepots: [{ x: 50, y: 50, side: 'ally' }, { x: 700, y: 320, side: 'enemy' }],
};

const el = {
  map: document.getElementById('map'),
  phaseBadge: document.getElementById('phaseBadge'),
  togglePhaseBtn: document.getElementById('togglePhaseBtn'),
  resolveBtn: document.getElementById('resolveBtn'),
  nextTurnBtn: document.getElementById('nextTurnBtn'),
  turnCounter: document.getElementById('turnCounter'),
  orderQueue: document.getElementById('orderQueue'),
  actionPoints: document.getElementById('actionPoints'),
  selectionInfo: document.getElementById('selectionInfo'),
  summaryBox: document.getElementById('summaryBox'),
  historyList: document.getElementById('historyList'),
  designerForm: document.getElementById('designerForm'),
  templateList: document.getElementById('templateList'),
  orbatTree: document.getElementById('orbatTree'),
  intelPanel: document.getElementById('intelPanel'),
  analytics: document.getElementById('analytics'),
  quickActions: document.getElementById('quickActions'),
  turnDialog: document.getElementById('turnDialog'),
  dialogContent: document.getElementById('dialogContent'),
  closeDialogBtn: document.getElementById('closeDialogBtn')
};

const ORDER_COST = { move: 1, attack: 2, defend: 1, recon: 1 };

function init() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  el.map.appendChild(grid);

  renderUnits();
  wireEvents();
  refreshUI();
  captureSnapshot('Initial deployment');
}

function wireEvents() {
  el.map.addEventListener('click', onMapClick);
  el.map.addEventListener('contextmenu', onMapContext);

  document.querySelectorAll('[data-order]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentOrderType = btn.dataset.order;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a') state.currentOrderType = 'attack';
    if (e.key.toLowerCase() === 'm') state.currentOrderType = 'move';
    if (e.key.toLowerCase() === 'd') state.currentOrderType = 'defend';
    if (e.key.toLowerCase() === 'r') state.currentOrderType = 'recon';
  });

  el.togglePhaseBtn.addEventListener('click', () => {
    state.phase = state.phase === 'planning' ? 'resolution' : 'planning';
    refreshUI();
  });

  el.resolveBtn.addEventListener('click', resolveTurn);
  el.nextTurnBtn.addEventListener('click', nextTurn);
  el.closeDialogBtn.addEventListener('click', () => el.turnDialog.close());

  el.designerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(el.designerForm);
    const template = Object.fromEntries(form.entries());
    state.templates.push(template);
    renderTemplates();
  });

  el.historyList.addEventListener('click', (ev) => {
    const li = ev.target.closest('li[data-turn]');
    if (!li) return;
    const turn = Number(li.dataset.turn);
    jumpToTurn(turn);
  });
}

function renderUnits() {
  [...el.map.querySelectorAll('.unit,.order-arrow,.explosion,.capture-wave')].forEach(n => n.remove());

  for (const unit of state.units) {
    if (unit.side === 'enemy' && !unit.spotted && state.turn > 1) continue;
    const node = document.createElement('div');
    node.className = `unit ${unit.side}`;
    if (unit.id === state.selectedUnitId) node.classList.add('selected');
    if (unit.supply !== 'Well-supplied') node.classList.add('low-supply');
    node.dataset.id = unit.id;
    node.style.transform = `translate(${unit.x}px, ${unit.y}px)`;
    node.innerHTML = `<span>${unit.id}</span><span class="health"><i style="width:${unit.hp}%"></i></span>`;
    el.map.appendChild(node);
  }

  drawOrderArrows();
}

function drawOrderArrows() {
  for (const order of state.orders) {
    if (!order.target) continue;
    const unit = state.units.find(u => u.id === order.unitId);
    if (!unit) continue;
    const dx = order.target.x - unit.x;
    const dy = order.target.y - unit.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    const arrow = document.createElement('div');
    arrow.className = `order-arrow ${order.type}`;
    arrow.style.width = `${dist}px`;
    arrow.style.left = `${unit.x + 14}px`;
    arrow.style.top = `${unit.y + 14}px`;
    arrow.style.transform = `rotate(${angle}deg)`;
    el.map.appendChild(arrow);
  }
}

function onMapClick(e) {
  if (state.phase !== 'planning') return;

  const unitEl = e.target.closest('.unit');
  if (unitEl) {
    state.selectedUnitId = unitEl.dataset.id;
    refreshUI();
    return;
  }

  const unit = state.units.find(u => u.id === state.selectedUnitId);
  if (!unit || unit.side !== 'ally') return;

  const rect = el.map.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width - 28, e.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height - 28, e.clientY - rect.top));

  const cost = ORDER_COST[state.currentOrderType] || 1;
  if (unit.ap < cost) return;

  unit.ap -= cost;
  state.orders.push({ unitId: unit.id, type: state.currentOrderType, target: { x, y } });
  refreshUI();
}

function onMapContext(e) {
  e.preventDefault();
  const unitEl = e.target.closest('.unit');
  el.quickActions.innerHTML = '';
  if (!unitEl) {
    el.quickActions.classList.add('hidden');
    return;
  }

  state.selectedUnitId = unitEl.dataset.id;
  ['move', 'attack', 'defend', 'recon'].forEach(action => {
    const b = document.createElement('button');
    b.textContent = action.toUpperCase();
    b.onclick = () => {
      state.currentOrderType = action;
      el.quickActions.classList.add('hidden');
    };
    el.quickActions.appendChild(b);
  });

  el.quickActions.style.left = `${e.clientX}px`;
  el.quickActions.style.top = `${e.clientY}px`;
  el.quickActions.classList.remove('hidden');
  refreshUI();
}

function resolveTurn() {
  state.phase = 'resolution';
  const events = [];
  const casualties = { ally: 0, enemy: 0 };
  const territories = Math.floor(Math.random() * 2);

  for (const order of state.orders) {
    const unit = state.units.find(u => u.id === order.unitId);
    if (!unit || unit.hp <= 0) continue;

    if (order.type === 'move' || order.type === 'recon' || order.type === 'defend') {
      smoothMoveUnit(unit, order.target.x, order.target.y);
      events.push(`${unit.id} ${order.type} to (${Math.round(order.target.x)},${Math.round(order.target.y)})`);
      if (order.type === 'recon') revealEnemiesNear(unit, 170);
      if (order.type === 'defend') unit.readiness = 'Full';
    }

    if (order.type === 'attack') {
      const target = nearestEnemy(unit);
      if (target) {
        const odds = (unit.power * (unit.readiness === 'Full' ? 1.2 : 1)) / Math.max(1, target.power);
        const dmg = Math.floor(15 + odds * 15);
        target.hp = Math.max(0, target.hp - dmg);
        unit.hp = Math.max(0, unit.hp - Math.floor(5 + (1 / Math.max(odds, .3)) * 8));
        spawnExplosion(target.x + 14, target.y + 14);
        events.push(`${unit.id} attacked ${target.id} (odds ${odds.toFixed(1)}:1, -${dmg} HP)`);
        if (target.hp <= 0) {
          casualties[target.side] += 1;
          events.push(`${target.id} eliminated`);
        } else if (odds > 1.2) {
          target.x += 30;
          target.y += 20;
          events.push(`${target.id} retreated`);
        }
      }
    }
  }

  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    applySupply(unit);
  }

  if (territories > 0) {
    spawnCaptureWave(420, 260);
    events.push(`Territory shifted by ${territories} sectors`);
  }

  state.units = state.units.filter(u => u.hp > 0);
  state.orders = [];

  const summary = {
    turn: state.turn,
    events,
    casualties,
    territories,
    analytics: calcAnalytics()
  };
  state.history.push(summary);
  captureSnapshot(`Turn ${state.turn} resolved`);
  showTurnDialog(summary);

  refreshUI();
}

function nextTurn() {
  state.turn += 1;
  state.phase = 'planning';
  state.units.forEach(u => (u.ap = 3));
  el.map.classList.add('turn-fade');
  setTimeout(() => el.map.classList.remove('turn-fade'), 600);
  refreshUI();
}

function smoothMoveUnit(unit, x, y) {
  const node = [...el.map.querySelectorAll('.unit')].find(n => n.dataset.id === unit.id);
  if (!node) {
    unit.x = x;
    unit.y = y;
    return;
  }

  requestAnimationFrame(() => {
    node.style.transform = `translate(${x}px, ${y}px)`;
    unit.x = x;
    unit.y = y;
  });
}

function nearestEnemy(unit) {
  const enemies = state.units.filter(u => u.side !== unit.side);
  enemies.sort((a, b) => (Math.hypot(unit.x - a.x, unit.y - a.y) - Math.hypot(unit.x - b.x, unit.y - b.y)));
  return enemies[0];
}

function revealEnemiesNear(unit, radius) {
  for (const enemy of state.units.filter(u => u.side !== unit.side)) {
    const d = Math.hypot(unit.x - enemy.x, unit.y - enemy.y);
    if (d <= radius) enemy.spotted = true;
  }
}

function applySupply(unit) {
  const ownDepots = state.supplyDepots.filter(d => d.side === unit.side);
  const minDist = Math.min(...ownDepots.map(d => Math.hypot(unit.x - d.x, unit.y - d.y)));
  if (minDist > 320) {
    unit.supply = 'Out';
    unit.hp = Math.max(0, unit.hp - 8);
  } else if (minDist > 200) {
    unit.supply = 'Low';
  } else {
    unit.supply = 'Well-supplied';
  }
}

function spawnExplosion(x, y) {
  const e = document.createElement('div');
  e.className = 'explosion';
  e.style.left = `${x}px`;
  e.style.top = `${y}px`;
  el.map.appendChild(e);
  setTimeout(() => e.remove(), 500);
}

function spawnCaptureWave(x, y) {
  const w = document.createElement('div');
  w.className = 'capture-wave';
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
  el.map.appendChild(w);
  setTimeout(() => w.remove(), 800);
}

function showTurnDialog(summary) {
  el.dialogContent.innerHTML = `
    <p><strong>Casualties:</strong> Ally ${summary.casualties.ally}, Enemy ${summary.casualties.enemy}</p>
    <p><strong>Territory Change:</strong> ${summary.territories} sectors</p>
    <ul>${summary.events.map(e => `<li>${e}</li>`).join('')}</ul>
  `;
  el.turnDialog.showModal();
}

function captureSnapshot(note) {
  state.timelineSnapshots.push({
    turn: state.turn,
    note,
    units: JSON.parse(JSON.stringify(state.units))
  });
}

function jumpToTurn(turn) {
  const snap = [...state.timelineSnapshots].reverse().find(s => s.turn === turn);
  if (!snap) return;
  state.units = JSON.parse(JSON.stringify(snap.units));
  state.turn = turn;
  refreshUI();
}

function renderTemplates() {
  el.templateList.innerHTML = state.templates.map((t, idx) => `<li>#${idx + 1} ${t.baseType} ${t.echelon} (${t.special}) P:${t.power} M:${t.mobility}</li>`).join('');
}

function renderOrbat() {
  const ally = state.units.filter(u => u.side === 'ally');
  el.orbatTree.innerHTML = `
    <div>1st Division
      <ul>
        <li>1st Brigade<ul>${ally.map(u => `<li>${u.id} ${u.type}</li>`).join('')}</ul></li>
      </ul>
    </div>
  `;
}

function renderHistory() {
  el.historyList.innerHTML = state.history.map(h => `<li data-turn="${h.turn}">Turn ${h.turn}: ${h.events.length} events</li>`).join('');
}

function renderIntel() {
  const reports = state.units.filter(u => u.side === 'enemy').map(u => {
    const known = u.spotted || state.turn === 1;
    return `<div>${known ? `${u.id} ${u.type} @ (${Math.round(u.x)},${Math.round(u.y)})` : 'Unknown contact'}</div>`;
  }).join('');
  el.intelPanel.innerHTML = reports || '<div>No enemy contacts.</div>';
}

function calcAnalytics() {
  const allies = state.units.filter(u => u.side === 'ally');
  const enemies = state.units.filter(u => u.side === 'enemy');
  const sidePower = (arr) => arr.reduce((sum, u) => sum + (u.power * (u.hp / 100)), 0).toFixed(1);
  return {
    allyPower: sidePower(allies),
    enemyPower: sidePower(enemies),
    control: allies.length + enemies.length ? Math.round((allies.length / (allies.length + enemies.length)) * 100) : 50,
    avgSupply: allies.length ? (allies.filter(u => u.supply === 'Well-supplied').length / allies.length * 100).toFixed(0) : '0'
  };
}

function renderAnalytics() {
  const a = calcAnalytics();
  el.analytics.innerHTML = `
    <div>Combat Power (Allies): ${a.allyPower}</div>
    <div>Combat Power (Enemy): ${a.enemyPower}</div>
    <div>Territory Control (Allied est.): ${a.control}%</div>
    <div>Supply Efficiency: ${a.avgSupply}%</div>
  `;
}

function refreshUI() {
  el.phaseBadge.textContent = state.phase === 'planning' ? 'Planning Phase' : 'Resolution Phase';
  el.phaseBadge.className = `badge ${state.phase}`;
  el.turnCounter.textContent = `Turn ${state.turn}`;
  const selected = state.units.find(u => u.id === state.selectedUnitId);
  el.actionPoints.textContent = selected ? selected.ap : 0;
  el.selectionInfo.textContent = selected
    ? `${selected.id} | ${selected.type} | Readiness:${selected.readiness} | Supply:${selected.supply} | Morale:${selected.morale}`
    : 'No unit selected';

  el.orderQueue.innerHTML = state.orders.map(o => `<li>${o.unitId}: ${o.type.toUpperCase()} → ${Math.round(o.target.x)}, ${Math.round(o.target.y)}</li>`).join('');
  const last = state.history[state.history.length - 1];
  el.summaryBox.innerHTML = last ? `Turn ${last.turn}: Ally losses ${last.casualties.ally}, Enemy losses ${last.casualties.enemy}, Territory ${last.territories}` : 'No turns resolved yet.';

  renderUnits();
  renderTemplates();
  renderOrbat();
  renderHistory();
  renderIntel();
  renderAnalytics();
}

init();
