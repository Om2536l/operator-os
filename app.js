/* ═══════════════════════════════════════════════
   OPERATOR OS v4.0 — app.js
   Built by Om Lasure
═══════════════════════════════════════════════ */

/* ── YOUR GOOGLE CLIENT ID ── */
const DRIVE_CLIENT_ID = '759176550183-ncp2gsj1437c3k8kbcl8k47r6qu32n86.apps.googleusercontent.com';

/* ── PROTOCOLS ── */
const PROTOCOLS = [
  { id: 'morning_lock', label: 'Morning lock held (+60 min)' },
  { id: 'phone_off',    label: 'Phone off during lectures' },
  { id: 'no_breaks',   label: 'Pomodoro breaks — no phone' },
  { id: 'anki',        label: 'Anki done' },
  { id: 'analog_hour', label: 'Analog hour completed' },
  { id: 'sleep_park',  label: 'Phone outside bed at sleep' },
];

const MAX_TASKS = 3;

/* ══════════════════════════════════
   BOOT SEQUENCE
══════════════════════════════════ */
const BOOT_STEPS = [
  'Initialising system...',
  'Loading protocols...',
  'Syncing state...',
  'Mounting interface...',
  'Ready.',
];

function runBoot() {
  const fill   = document.getElementById('boot-bar-fill');
  const status = document.getElementById('boot-status');
  const dots   = document.querySelectorAll('.bg-dot');

  // animate dots
  dots.forEach((d, i) => {
    setTimeout(() => d.classList.add('pulse'), i * 80);
  });

  let step = 0;
  const total = BOOT_STEPS.length;

  const interval = setInterval(() => {
    if (step >= total) {
      clearInterval(interval);
      // stop pulse
      dots.forEach(d => d.classList.remove('pulse'));
      // light all dots
      dots.forEach(d => d.classList.add('lit'));
      status.textContent = 'Ready.';
      fill.style.width = '100%';
      // transition out
      setTimeout(() => {
        const boot = document.getElementById('boot-screen');
        const app  = document.getElementById('app');
        boot.classList.add('boot-out');
        app.classList.remove('app-hidden');
        app.classList.add('app-visible');
        setTimeout(() => {
          boot.style.display = 'none';
          // animate first screen in
          const homeScreen = document.getElementById('screen-home');
          homeScreen.classList.add('screen-in');
        }, 600);
      }, 400);
      return;
    }
    status.textContent = BOOT_STEPS[step];
    fill.style.width   = ((step + 1) / total * 100) + '%';
    step++;
  }, 320);
}

/* ══════════════════════════════════
   STATE
══════════════════════════════════ */
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem('operator_os_v4');
    if (raw) return JSON.parse(raw);
    // migrate from v3
    const old = localStorage.getItem('operator_os_v3');
    if (old) {
      const parsed = JSON.parse(old);
      // migrate days
      Object.keys(parsed.days || {}).forEach(k => {
        if (parsed.days[k].habits && !parsed.days[k].protocols) {
          parsed.days[k].protocols = parsed.days[k].habits;
          delete parsed.days[k].habits;
        }
        if (!parsed.days[k].tasks) parsed.days[k].tasks = [];
        if (!parsed.days[k].dailyReflections) parsed.days[k].dailyReflections = [];
      });
      if (!parsed.weeklyReflections) parsed.weeklyReflections = parsed.reflections || [];
      return parsed;
    }
  } catch(e) {}
  return {
    days: {},
    weeklyReflections: [],
    driveConnected: false,
    lastSync: null,
  };
}

function saveState() {
  try { localStorage.setItem('operator_os_v4', JSON.stringify(state)); } catch(e) {}
}

/* ── DATE HELPERS ── */
function todayKey() { return new Date().toISOString().slice(0, 10); }

function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDay(key) {
  if (!state.days[key]) {
    state.days[key] = { protocols: {}, tasks: [], focusMin: 0, sessions: 0, dailyReflections: [] };
  }
  if (!state.days[key].tasks)              state.days[key].tasks = [];
  if (!state.days[key].protocols)          state.days[key].protocols = {};
  if (!state.days[key].dailyReflections)   state.days[key].dailyReflections = [];
  return state.days[key];
}

function getToday() { return getDay(todayKey()); }

/* ══════════════════════════════════
   NAVIGATION
══════════════════════════════════ */
function switchScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'screen-in');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const screen = document.getElementById('screen-' + name);
  screen.classList.add('active');
  btn.classList.add('active');

  // animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => screen.classList.add('screen-in'));
  });

  if (name === 'stats')   renderStats();
  if (name === 'reflect') renderReflect();
}

function switchReflectTab(tab, btn) {
  document.querySelectorAll('.reflect-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('reflect-daily').style.display  = tab === 'daily'  ? 'block' : 'none';
  document.getElementById('reflect-weekly').style.display = tab === 'weekly' ? 'block' : 'none';
}

/* ══════════════════════════════════
   HOME SCREEN
══════════════════════════════════ */
function renderHome() {
  renderDate();
  renderGreeting();
  renderStreak();
  renderWeekDots();
  renderWeekRing();
  renderTasks();
  renderProtocol();
}

function renderDate() {
  const d    = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('app-date').textContent = d.toLocaleDateString('en-IN', opts);
}

function renderGreeting() {
  const h    = new Date().getHours();
  let greet  = 'Good morning,';
  if (h >= 12 && h < 17) greet = 'Good afternoon,';
  else if (h >= 17)      greet = 'Good evening,';
  document.getElementById('greeting-text').textContent = greet;
}

/* ── STREAK ── */
function computeStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key  = offsetDate(d, -i);
    const day  = state.days[key];
    if (!day) break;
    const done = Object.values(day.protocols || {}).filter(Boolean).length;
    if (done < Math.ceil(PROTOCOLS.length * 0.5)) break;
    streak++;
  }
  return streak;
}

function computeBestStreak() {
  const keys = Object.keys(state.days).sort();
  let best = 0, cur = 0;
  keys.forEach(key => {
    const day  = state.days[key];
    const done = day ? Object.values(day.protocols || {}).filter(Boolean).length : 0;
    if (done >= Math.ceil(PROTOCOLS.length * 0.5)) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  });
  return best;
}

function renderStreak() {
  document.getElementById('streak-number').textContent = computeStreak();
}

function renderWeekDots() {
  const wrap   = document.getElementById('week-dots');
  wrap.innerHTML = '';
  const today  = new Date();
  const todayK = todayKey();
  for (let i = 6; i >= 0; i--) {
    const key  = offsetDate(today, -i);
    const day  = state.days[key];
    const done = day ? Object.values(day.protocols || {}).filter(Boolean).length : 0;
    const dot  = document.createElement('div');
    dot.className = 'week-dot';
    if (key === todayK)                                  dot.classList.add('today');
    else if (done >= Math.ceil(PROTOCOLS.length * 0.5)) dot.classList.add('done');
    else if (key < todayK)                               dot.classList.add('missed');
    wrap.appendChild(dot);
  }
}

function renderWeekRing() {
  const today = new Date();
  let doneDays = 0;
  for (let i = 0; i < 7; i++) {
    const key  = offsetDate(today, -i);
    const day  = state.days[key];
    const done = day ? Object.values(day.protocols || {}).filter(Boolean).length : 0;
    if (done >= Math.ceil(PROTOCOLS.length * 0.5)) doneDays++;
  }
  const pct    = Math.round((doneDays / 7) * 100);
  const CIRC   = 2 * Math.PI * 14;
  const offset = CIRC * (1 - doneDays / 7);
  document.getElementById('week-ring-fill').setAttribute('stroke-dashoffset', offset);
  document.getElementById('week-ring-fill').setAttribute('stroke-dasharray', CIRC);
  document.getElementById('week-ring-pct').textContent = pct + '%';
}

/* ── TASKS ── */
function renderTasks() {
  const today  = getToday();
  const tasks  = today.tasks || [];
  const wrap   = document.getElementById('tasks-list');
  const empty  = document.getElementById('tasks-empty');
  wrap.innerHTML = '';

  if (tasks.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'task-item';
      row.innerHTML = `
        <div class="task-check${task.done ? ' done' : ''}"></div>
        <div class="task-label${task.done ? ' done' : ''}">${escapeHtml(task.label)}</div>
        <button class="task-delete" onclick="deleteTask('${task.id}',event)" title="Delete">×</button>
      `;
      row.addEventListener('click', e => {
        if (e.target.classList.contains('task-delete')) return;
        toggleTask(task.id);
      });
      wrap.appendChild(row);
    });
  }

  document.getElementById('task-input-row').style.display =
    tasks.length >= MAX_TASKS ? 'none' : 'flex';

  const done = tasks.filter(t => t.done).length;
  document.getElementById('tasks-progress').textContent =
    tasks.length === 0 ? '0 / 0' : `${done} / ${tasks.length}`;
}

function addTask() {
  const input = document.getElementById('task-input');
  const label = input.value.trim();
  if (!label) return;
  const today = getToday();
  if (today.tasks.length >= MAX_TASKS) { showToast('Max 3 tasks per day.'); return; }
  today.tasks.push({ id: 'task_' + Date.now(), label, done: false });
  saveState();
  input.value = '';
  renderTasks();
}

function toggleTask(id) {
  const today = getToday();
  const task  = today.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveState();
  renderTasks();
  if (today.tasks.length > 0 && today.tasks.every(t => t.done))
    showToast('All missions complete. ✓');
}

function deleteTask(id, e) {
  e.stopPropagation();
  const today = getToday();
  today.tasks = today.tasks.filter(t => t.id !== id);
  saveState();
  renderTasks();
}

document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

/* ── PROTOCOL ── */
function renderProtocol() {
  const wrap  = document.getElementById('checklist');
  wrap.innerHTML = '';
  const today = getToday();
  let doneCount = 0;

  PROTOCOLS.forEach(p => {
    const checked = !!today.protocols[p.id];
    if (checked) doneCount++;
    const row = document.createElement('div');
    row.className = 'check-item';
    row.innerHTML = `
      <div class="check-box${checked ? ' done' : ''}"></div>
      <div class="check-label${checked ? ' done' : ''}">${p.label}</div>
    `;
    row.addEventListener('click', () => toggleProtocol(p.id, row));
    wrap.appendChild(row);
  });

  document.getElementById('protocol-progress').textContent =
    `${doneCount} / ${PROTOCOLS.length}`;
}

function toggleProtocol(id, row) {
  const today   = getToday();
  today.protocols[id] = !today.protocols[id];
  saveState();
  const checked = today.protocols[id];
  row.querySelector('.check-box').className   = 'check-box'   + (checked ? ' done' : '');
  row.querySelector('.check-label').className = 'check-label' + (checked ? ' done' : '');
  const done = Object.values(today.protocols).filter(Boolean).length;
  document.getElementById('protocol-progress').textContent = `${done} / ${PROTOCOLS.length}`;
  renderStreak();
  renderWeekDots();
  renderWeekRing();
  if (done === PROTOCOLS.length) showToast('Full protocol complete. System holding. ✓');
}

/* ══════════════════════════════════
   FOCUS / TIMER
══════════════════════════════════ */
const CIRCUMFERENCE = 2 * Math.PI * 88;

let timer = {
  running: false, phase: 'work', remaining: 25*60,
  session: 0, interval: null, mode: '25',
  freeMinutes: 30, WORK_SEC: 25*60, BREAK_SEC: 5*60,
};

function setTimerMode(mode, btn) {
  if (timer.running) { showToast('Pause before switching mode.'); return; }
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  timer.mode = mode;
  const freeInput = document.getElementById('free-timer-input');
  const pomDots   = document.getElementById('pom-dots');
  const pomLabel  = document.getElementById('pom-session-label');
  const skipBtn   = document.getElementById('btn-skip');
  if (mode === '25') {
    timer.WORK_SEC = 25*60; timer.BREAK_SEC = 5*60;
    timer.phase = 'work'; timer.session = 0; timer.remaining = timer.WORK_SEC;
    freeInput.classList.remove('visible');
    pomDots.style.display = 'flex'; pomLabel.style.display = 'block'; skipBtn.style.display = 'inline-flex';
  } else if (mode === '50') {
    timer.WORK_SEC = 50*60; timer.BREAK_SEC = 10*60;
    timer.phase = 'work'; timer.session = 0; timer.remaining = timer.WORK_SEC;
    freeInput.classList.remove('visible');
    pomDots.style.display = 'flex'; pomLabel.style.display = 'block'; skipBtn.style.display = 'inline-flex';
  } else {
    timer.phase = 'free'; timer.remaining = timer.freeMinutes * 60;
    freeInput.classList.add('visible');
    pomDots.style.display = 'none'; pomLabel.style.display = 'none'; skipBtn.style.display = 'none';
    document.getElementById('free-minutes-display').textContent = timer.freeMinutes;
  }
  renderTimer();
}

function adjustFree(delta) {
  if (timer.running) { showToast('Pause first.'); return; }
  timer.freeMinutes = Math.max(1, Math.min(180, timer.freeMinutes + delta));
  timer.remaining   = timer.freeMinutes * 60;
  document.getElementById('free-minutes-display').textContent = timer.freeMinutes;
  renderTimer();
}

function renderTimer() {
  const mins = Math.floor(timer.remaining / 60);
  const secs = timer.remaining % 60;
  document.getElementById('timer-display').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  const total  = timer.mode === 'free' ? timer.freeMinutes*60
    : (timer.phase === 'work' ? timer.WORK_SEC : timer.BREAK_SEC);
  const offset = CIRCUMFERENCE * (1 - (total > 0 ? timer.remaining/total : 0));
  const ring   = document.getElementById('timer-progress-ring');
  ring.setAttribute('stroke-dashoffset', offset);
  ring.setAttribute('stroke-dasharray', CIRCUMFERENCE);
  document.getElementById('timer-phase-label').textContent =
    timer.mode === 'free' ? 'free focus' : timer.phase === 'work' ? 'deep work' : 'recovery';
  if (timer.mode !== 'free') {
    renderPomDots();
    const max = timer.mode === '50' ? 2 : 4;
    document.getElementById('pom-session-label').textContent = `session ${timer.session+1} of ${max}`;
  }
  const today = getToday();
  const h = Math.floor(today.focusMin/60), m = today.focusMin%60;
  document.getElementById('stat-focus-time').textContent = `${h}h ${m}m`;
  document.getElementById('stat-sessions').textContent   = today.sessions;
  document.getElementById('stat-goal').textContent       = Math.round((today.sessions/4)*100) + '%';
}

function renderPomDots() {
  const wrap  = document.getElementById('pom-dots');
  wrap.innerHTML = '';
  const total = timer.mode === '50' ? 2 : 4;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'pom-dot' + (i < timer.session ? ' done' : i === timer.session ? ' current' : '');
    wrap.appendChild(dot);
  }
}

function timerStart() {
  if (timer.running) return;
  timer.running = true;
  document.getElementById('btn-start').style.display = 'none';
  document.getElementById('btn-pause').style.display = 'inline-flex';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '0.4');
  timer.interval = setInterval(timerTick, 1000);
}

function timerPause() {
  timer.running = false;
  clearInterval(timer.interval);
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
}

function timerTick() {
  if (timer.remaining <= 0) { timerComplete(); return; }
  timer.remaining--;
  renderTimer();
}

function timerComplete() {
  clearInterval(timer.interval);
  timer.running = false;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  if ('vibrate' in navigator) navigator.vibrate([200,100,200]);
  if (timer.mode === 'free') {
    const today = getToday();
    today.sessions++; today.focusMin += timer.freeMinutes; saveState();
    timer.remaining = timer.freeMinutes * 60;
    showToast(`${timer.freeMinutes}min done. Well executed. ✓`);
    renderTimer(); return;
  }
  const workMins = timer.mode === '50' ? 50 : 25;
  const maxSess  = timer.mode === '50' ? 2 : 4;
  if (timer.phase === 'work') {
    const today = getToday();
    today.sessions++; today.focusMin += workMins; saveState();
    timer.session   = Math.min(timer.session+1, maxSess);
    timer.phase     = 'break'; timer.remaining = timer.BREAK_SEC;
    showToast('Session done. Break — no phone.');
  } else {
    timer.phase = 'work'; timer.remaining = timer.WORK_SEC;
    showToast('Break over. Back to deep work.');
  }
  renderTimer();
}

function timerSkip() {
  if (timer.mode === 'free') return;
  clearInterval(timer.interval); timer.running = false;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  const maxSess = timer.mode === '50' ? 2 : 4;
  if (timer.phase === 'work') { timer.phase = 'break'; timer.remaining = timer.BREAK_SEC; }
  else { timer.phase = 'work'; timer.remaining = timer.WORK_SEC; timer.session = Math.min(timer.session+1, maxSess-1); }
  renderTimer();
}

function timerReset() {
  clearInterval(timer.interval); timer.running = false; timer.session = 0;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  timer.phase     = timer.mode === 'free' ? 'free' : 'work';
  timer.remaining = timer.mode === 'free' ? timer.freeMinutes*60 : timer.WORK_SEC;
  renderTimer();
}

/* ══════════════════════════════════
   STATS
══════════════════════════════════ */
function renderStats() {
  document.getElementById('m-streak').textContent = computeStreak();
  document.getElementById('m-best').textContent   = computeBestStreak();
  document.getElementById('m-rate').textContent   = computeHabitRate(28) + '%';
  document.getElementById('m-focus').textContent  = computeMonthFocus() + 'h';
  renderHeatmap(); renderHabitBars(); renderDriveStatus();
}

function computeHabitRate(days) {
  const today = new Date(); let possible = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const key = offsetDate(today, -i); const day = state.days[key];
    if (day) { possible += PROTOCOLS.length; done += Object.values(day.protocols||{}).filter(Boolean).length; }
  }
  return possible === 0 ? 0 : Math.round((done/possible)*100);
}

function computeMonthFocus() {
  const today = new Date(); let total = 0;
  for (let i = 0; i < 30; i++) { const day = state.days[offsetDate(today,-i)]; if (day) total += (day.focusMin||0); }
  return Math.round(total/60);
}

function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid'); grid.innerHTML = '';
  const today = new Date(); const todayK = todayKey();
  for (let i = 27; i >= 0; i--) {
    const key  = offsetDate(today, -i);
    const day  = state.days[key];
    const done = day ? Object.values(day.protocols||{}).filter(Boolean).length : 0;
    const cell = document.createElement('div'); cell.className = 'hcell';
    if (key === todayK) cell.classList.add('today-cell');
    if      (done >= PROTOCOLS.length)            cell.classList.add('l4');
    else if (done >= PROTOCOLS.length * 0.75)     cell.classList.add('l3');
    else if (done >= PROTOCOLS.length * 0.5)      cell.classList.add('l2');
    else if (done > 0)                            cell.classList.add('l1');
    cell.title = `${key}: ${done}/${PROTOCOLS.length}`;
    grid.appendChild(cell);
  }
}

function renderHabitBars() {
  const wrap = document.getElementById('habit-bars'); wrap.innerHTML = '';
  const today = new Date();
  PROTOCOLS.forEach(p => {
    let done = 0;
    for (let i = 0; i < 7; i++) { const day = state.days[offsetDate(today,-i)]; if (day?.protocols?.[p.id]) done++; }
    const pct = Math.round((done/7)*100);
    const row = document.createElement('div'); row.className = 'habit-bar-row';
    row.innerHTML = `<div class="habit-bar-top"><span class="habit-bar-name">${p.label}</span><span class="habit-bar-pct">${pct}%</span></div><div class="habit-bar-track"><div class="habit-bar-fill" style="width:${pct}%"></div></div>`;
    wrap.appendChild(row);
  });
}

function renderDriveStatus() {
  const dot  = document.getElementById('drive-status-dot');
  const text = document.getElementById('drive-status-text');
  if (state.driveConnected) {
    dot.className = 'connected';
    text.textContent = state.lastSync
      ? 'Synced · ' + new Date(state.lastSync).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
      : 'Connected to Google Drive';
  } else { dot.className = ''; text.textContent = 'Not connected — tap Drive icon to connect'; }
}

/* ══════════════════════════════════
   REFLECT
══════════════════════════════════ */
function getWeekLabel() {
  const now   = new Date();
  const jan1  = new Date(now.getFullYear(), 0, 1);
  const week  = Math.ceil(((now-jan1)/86400000 + jan1.getDay()+1)/7);
  const start = new Date(now); start.setDate(now.getDate()-now.getDay()+1);
  const end   = new Date(start); end.setDate(start.getDate()+6);
  const opts  = {month:'short', day:'numeric'};
  return `Week ${week} · ${start.toLocaleDateString('en-IN',opts)} – ${end.toLocaleDateString('en-IN',opts)}`;
}

function renderReflect() {
  const d = new Date();
  document.getElementById('reflect-daily-date').textContent =
    d.toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'});
  document.getElementById('reflect-week-label').textContent = getWeekLabel();
  renderPastDaily();
  renderPastWeekly();
}

function saveDailyReflection() {
  const summary = document.getElementById('d-summary').value.trim();
  const notes   = document.getElementById('d-notes').value.trim();
  if (!summary && !notes) { showToast('Write something first.'); return; }
  const today = getToday();
  today.dailyReflections.push({
    date: new Date().toISOString(), summary, notes,
  });
  saveState();
  renderPastDaily();
  showToast('Daily entry saved. ✓');
  document.getElementById('d-summary').value = '';
  document.getElementById('d-notes').value   = '';
}

function renderPastDaily() {
  const wrap   = document.getElementById('past-daily'); wrap.innerHTML = '';
  const todayK = todayKey();
  // collect all daily reflections across days, most recent first
  const all = [];
  Object.keys(state.days).sort().reverse().slice(0,7).forEach(key => {
    const day = state.days[key];
    if (day?.dailyReflections?.length) {
      [...day.dailyReflections].reverse().forEach(r => all.push({key, ...r}));
    }
  });
  if (all.length === 0) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:0.4rem 0;font-family:var(--mono)">No daily entries yet.</div>';
    return;
  }
  all.slice(0,5).forEach(r => {
    const el = document.createElement('div'); el.className = 'past-reflection';
    const snippet = r.summary || r.notes || '';
    el.innerHTML = `
      <div class="past-reflection-date">${new Date(r.date).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'})}</div>
      <div class="past-reflection-snippet">${escapeHtml(snippet.slice(0,90))}${snippet.length>90?'…':''}</div>
    `;
    wrap.appendChild(el);
  });
}

function saveWeeklyReflection() {
  const r = {
    week:    getWeekLabel(), date: new Date().toISOString(),
    break:   document.getElementById('r-break').value.trim(),
    trigger: document.getElementById('r-trigger').value.trim(),
    fix:     document.getElementById('r-fix').value.trim(),
    good:    document.getElementById('r-good').value.trim(),
  };
  if (!r.break && !r.trigger && !r.fix && !r.good) { showToast('Write something first.'); return; }
  if (!state.weeklyReflections) state.weeklyReflections = [];
  state.weeklyReflections.push(r);
  saveState(); renderPastWeekly();
  showToast('Weekly reflection saved. System updated. ✓');
  ['r-break','r-trigger','r-fix','r-good'].forEach(id => document.getElementById(id).value = '');
}

function renderPastWeekly() {
  const wrap   = document.getElementById('past-reflections'); wrap.innerHTML = '';
  const sorted = [...(state.weeklyReflections||[])].reverse().slice(0,5);
  if (sorted.length === 0) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:0.4rem 0;font-family:var(--mono)">No weekly reflections yet.</div>';
    return;
  }
  sorted.forEach(r => {
    const el = document.createElement('div'); el.className = 'past-reflection';
    const snippet = r.break || '';
    el.innerHTML = `
      <div class="past-reflection-date">${r.week}</div>
      <div class="past-reflection-snippet">${escapeHtml(snippet.slice(0,90))}${snippet.length>90?'…':''}</div>
    `;
    wrap.appendChild(el);
  });
}

/* ══════════════════════════════════
   GOOGLE DRIVE — with folder + token persistence
══════════════════════════════════ */
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME = 'operator_os_data.json';
const DRIVE_FOLDER    = 'Operator OS';
let driveToken        = null;
let driveFolderId     = null;
let driveFileId       = null;

// restore token from session
function restoreToken() {
  try {
    const saved = sessionStorage.getItem('drive_token');
    const exp   = sessionStorage.getItem('drive_token_exp');
    if (saved && exp && Date.now() < parseInt(exp)) {
      driveToken = saved;
      state.driveConnected = true;
      setSyncDot('synced');
    }
  } catch(e) {}
}

function saveToken(token, expiresIn) {
  try {
    sessionStorage.setItem('drive_token', token);
    sessionStorage.setItem('drive_token_exp', Date.now() + (expiresIn - 60) * 1000);
  } catch(e) {}
}

document.getElementById('drive-btn').addEventListener('click', () => {
  if (DRIVE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
    showToast('Add your Google Client ID in app.js'); return;
  }
  driveToken ? syncToDrive() : driveSignIn();
});

function driveSignIn() {
  setSyncDot('syncing');
  const params = new URLSearchParams({
    client_id: DRIVE_CLIENT_ID,
    redirect_uri: location.origin + location.pathname,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    prompt: 'select_account',
  });
  const popup = window.open(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    'drive-auth', 'width=500,height=600,left=100,top=100'
  );
  const poll = setInterval(() => {
    try {
      if (popup.closed) { clearInterval(poll); setSyncDot('idle'); return; }
      const hash  = new URLSearchParams(popup.location.hash.slice(1));
      const token = hash.get('access_token');
      const exp   = hash.get('expires_in');
      if (token) {
        clearInterval(poll); popup.close();
        driveToken = token;
        saveToken(token, parseInt(exp || '3600'));
        state.driveConnected = true; saveState();
        setSyncDot('synced');
        showToast('Drive connected. Syncing…');
        syncToDrive();
      }
    } catch(e) {}
  }, 500);
}

async function syncToDrive() {
  if (!driveToken) { showToast('Connect Drive first.'); return; }
  setSyncDot('syncing');
  try {
    if (!driveFolderId) driveFolderId = await findOrCreateFolder();
    if (!driveFileId)   driveFileId   = await findOrCreateFile(driveFolderId);
    await updateFile(driveFileId);
    state.lastSync = new Date().toISOString();
    state.driveConnected = true; saveState();
    setSyncDot('synced');
    showToast('Synced to Drive ✓');
    renderDriveStatus();
  } catch(e) {
    setSyncDot('error');
    showToast('Sync failed. Reconnect Drive.');
    driveToken = null;
    try { sessionStorage.removeItem('drive_token'); } catch(err) {}
  }
}

async function findOrCreateFolder() {
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${driveToken}` } }
  );
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await create.json();
  return folder.id;
}

async function findOrCreateFile(folderId) {
  const res  = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${driveToken}` } }
  );
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json', parents: [folderId] }),
  });
  const file = await create.json();
  return file.id;
}

async function updateFile(fileId) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

async function exportToDrive() {
  if (!driveToken) { showToast('Connect Drive first via the header icon.'); return; }
  await syncToDrive();
}

function setSyncDot(status) {
  document.getElementById('sync-dot').className = 'sync-dot ' + status;
}

/* ══════════════════════════════════
   UTILS
══════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function scheduleMidnightReset() {
  const now  = new Date();
  const next = new Date(now); next.setHours(24,0,5,0);
  setTimeout(() => { renderHome(); scheduleMidnightReset(); }, next-now);
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
function init() {
  restoreToken();
  renderHome();
  renderTimer();
  scheduleMidnightReset();
  runBoot();
}

init();
