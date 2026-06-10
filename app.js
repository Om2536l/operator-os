/* ═══════════════════════════════════════════════════
   OPERATOR OS — app.js
   All state stored in localStorage.
   Google Drive sync is optional (requires OAuth setup).
═══════════════════════════════════════════════════ */

/* ── HABITS CONFIG ── */
const HABITS = [
  { id: 'morning_lock',   label: 'Morning lock held (+60 min)' },
  { id: 'lecture_mode',   label: 'Phone off during lectures' },
  { id: 'pom_breaks',     label: 'Pomodoro breaks — no phone' },
  { id: 'anki',           label: 'Anki done' },
  { id: 'phone_parked',   label: 'Phone parked at home' },
  { id: 'analog_hour',    label: 'Analog hour completed' },
  { id: 'no_scroll',      label: 'Zero unintentional scrolling' },
  { id: 'sleep_park',     label: 'Phone outside bed at sleep' },
];

/* ── STATE ── */
let state = loadState();

/* ── TIMER STATE ── */
let timer = {
  running: false,
  phase: 'work',        // 'work' | 'break' | 'free'
  remaining: 25 * 60,
  session: 0,
  totalWork: 0,
  interval: null,
  mode: '25',           // '25' | '50' | 'free'
  freeMinutes: 30,
  WORK_SEC: 25 * 60,
  BREAK_SEC: 5 * 60,
};

/* ══════════════════════════════════
   STATE PERSISTENCE
══════════════════════════════════ */
function loadState() {
  try {
    const raw = localStorage.getItem('operator_os_state');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    days: {},           // { 'YYYY-MM-DD': { habits: {id: bool}, focusMin: 0, sessions: 0 } }
    reflections: [],    // [ { week: 'YYYY-WNN', break, trigger, fix, good, date } ]
    driveConnected: false,
    lastSync: null,
  };
}

function saveState() {
  localStorage.setItem('operator_os_state', JSON.stringify(state));
}

/* ── TODAY KEY ── */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDay(key) {
  if (!state.days[key]) {
    state.days[key] = { habits: {}, focusMin: 0, sessions: 0 };
  }
  return state.days[key];
}

function getToday() { return getDay(todayKey()); }

/* ══════════════════════════════════
   NAVIGATION
══════════════════════════════════ */
function switchScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'stats')   renderStats();
  if (name === 'reflect') renderReflect();
}

/* ══════════════════════════════════
   HOME SCREEN
══════════════════════════════════ */
function renderHome() {
  renderDate();
  renderStreak();
  renderWeekDots();
  renderChecklist();
}

function renderDate() {
  const d = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('app-date').textContent = d.toLocaleDateString('en-IN', opts);
}

function renderStreak() {
  document.getElementById('streak-number').textContent = computeStreak();
}

function computeStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = offsetDate(d, -i);
    const day = state.days[key];
    if (!day) break;
    const done = Object.values(day.habits).filter(Boolean).length;
    if (done < HABITS.length * 0.5) break;
    streak++;
  }
  return streak;
}

function computeBestStreak() {
  const keys = Object.keys(state.days).sort();
  let best = 0, cur = 0;
  keys.forEach(key => {
    const day = state.days[key];
    const done = day ? Object.values(day.habits).filter(Boolean).length : 0;
    if (done >= HABITS.length * 0.5) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  });
  return best;
}

function renderWeekDots() {
  const wrap = document.getElementById('week-dots');
  wrap.innerHTML = '';
  const today = new Date();
  const todayK = todayKey();
  for (let i = 6; i >= 0; i--) {
    const key = offsetDate(today, -i);
    const day = state.days[key];
    const done = day ? Object.values(day.habits).filter(Boolean).length : 0;
    const dot = document.createElement('div');
    dot.className = 'week-dot';
    if (key === todayK) dot.classList.add('today');
    else if (day && done >= HABITS.length * 0.5) dot.classList.add('done');
    else if (key < todayK) dot.classList.add('missed');
    wrap.appendChild(dot);
  }
}

function renderChecklist() {
  const wrap = document.getElementById('checklist');
  wrap.innerHTML = '';
  const today = getToday();
  let doneCount = 0;

  HABITS.forEach(h => {
    const checked = !!today.habits[h.id];
    if (checked) doneCount++;
    const row = document.createElement('div');
    row.className = 'check-item';
    row.innerHTML = `
      <div class="check-box${checked ? ' done' : ''}"></div>
      <div class="check-label${checked ? ' done' : ''}">${h.label}</div>
    `;
    row.addEventListener('click', () => toggleHabit(h.id, row));
    wrap.appendChild(row);
  });

  document.getElementById('checklist-progress').textContent =
    `${doneCount} / ${HABITS.length}`;
}

function toggleHabit(id, row) {
  const today = getToday();
  today.habits[id] = !today.habits[id];
  saveState();
  const checked = today.habits[id];
  row.querySelector('.check-box').className = 'check-box' + (checked ? ' done' : '');
  row.querySelector('.check-label').className = 'check-label' + (checked ? ' done' : '');
  const doneCount = Object.values(today.habits).filter(Boolean).length;
  document.getElementById('checklist-progress').textContent =
    `${doneCount} / ${HABITS.length}`;
  renderStreak();
  renderWeekDots();
  if (doneCount === HABITS.length) showToast('All habits done. System holding. ✓');
}

/* ══════════════════════════════════
   FOCUS / TIMER
══════════════════════════════════ */
const CIRCUMFERENCE = 2 * Math.PI * 88;

/* ── MODE SELECTOR ── */
function setTimerMode(mode, btn) {
  if (timer.running) { showToast('Stop the timer before switching mode.'); return; }

  // update active button
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  timer.mode = mode;
  const freeInput = document.getElementById('free-timer-input');
  const pomDots   = document.getElementById('pom-dots');
  const pomLabel  = document.getElementById('pom-session-label');
  const skipBtn   = document.getElementById('btn-skip');

  if (mode === '25') {
    timer.WORK_SEC  = 25 * 60;
    timer.BREAK_SEC = 5 * 60;
    timer.phase     = 'work';
    timer.session   = 0;
    timer.remaining = timer.WORK_SEC;
    freeInput.classList.remove('visible');
    pomDots.style.display  = 'flex';
    pomLabel.style.display = 'block';
    skipBtn.style.display  = 'inline-flex';
  } else if (mode === '50') {
    timer.WORK_SEC  = 50 * 60;
    timer.BREAK_SEC = 10 * 60;
    timer.phase     = 'work';
    timer.session   = 0;
    timer.remaining = timer.WORK_SEC;
    freeInput.classList.remove('visible');
    pomDots.style.display  = 'flex';
    pomLabel.style.display = 'block';
    skipBtn.style.display  = 'inline-flex';
  } else if (mode === 'free') {
    timer.phase     = 'free';
    timer.remaining = timer.freeMinutes * 60;
    freeInput.classList.add('visible');
    pomDots.style.display  = 'none';
    pomLabel.style.display = 'none';
    skipBtn.style.display  = 'none';
    document.getElementById('free-minutes-display').textContent = timer.freeMinutes;
  }
  renderTimer();
}

function adjustFree(delta) {
  if (timer.running) { showToast('Pause first to adjust time.'); return; }
  timer.freeMinutes = Math.max(1, Math.min(180, timer.freeMinutes + delta));
  timer.remaining   = timer.freeMinutes * 60;
  document.getElementById('free-minutes-display').textContent = timer.freeMinutes;
  renderTimer();
}

/* ── RENDER ── */
function renderTimer() {
  const mins = Math.floor(timer.remaining / 60);
  const secs = timer.remaining % 60;
  document.getElementById('timer-display').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  let total;
  if (timer.mode === 'free') {
    total = timer.freeMinutes * 60;
  } else {
    total = timer.phase === 'work' ? timer.WORK_SEC : timer.BREAK_SEC;
  }
  const progress = total > 0 ? timer.remaining / total : 0;
  const offset   = CIRCUMFERENCE * (1 - progress);
  document.getElementById('timer-progress-ring').setAttribute('stroke-dashoffset', offset);
  document.getElementById('timer-progress-ring').setAttribute('stroke-dasharray', CIRCUMFERENCE);

  if (timer.mode === 'free') {
    document.getElementById('timer-phase-label').textContent = 'free focus';
  } else {
    document.getElementById('timer-phase-label').textContent =
      timer.phase === 'work' ? 'deep work' : 'recovery';
  }

  if (timer.mode !== 'free') {
    renderPomDots();
    const sessions = timer.mode === '50' ? 2 : 4;
    document.getElementById('pom-session-label').textContent =
      `session ${timer.session + 1} of ${sessions}`;
  }

  const today = getToday();
  const h = Math.floor(today.focusMin / 60);
  const m = today.focusMin % 60;
  document.getElementById('stat-focus-time').textContent = `${h}h ${m}m`;
  document.getElementById('stat-sessions').textContent   = today.sessions;
  document.getElementById('stat-goal').textContent =
    Math.round((today.sessions / 4) * 100) + '%';
}

function renderPomDots() {
  const wrap    = document.getElementById('pom-dots');
  wrap.innerHTML = '';
  const total   = timer.mode === '50' ? 2 : 4;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'pom-dot';
    if (i < timer.session)       dot.classList.add('done');
    else if (i === timer.session) dot.classList.add('current');
    wrap.appendChild(dot);
  }
}

/* ── CONTROLS ── */
function timerStart() {
  if (timer.running) return;
  timer.running = true;
  document.getElementById('btn-start').style.display = 'none';
  document.getElementById('btn-pause').style.display = 'inline-flex';
  // lock mode selector while running
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
  if (timer.phase === 'work' || timer.phase === 'free') timer.totalWork++;
  renderTimer();
}

function timerComplete() {
  clearInterval(timer.interval);
  timer.running = false;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

  if (timer.mode === 'free') {
    const today = getToday();
    today.sessions++;
    today.focusMin += timer.freeMinutes;
    saveState();
    timer.remaining = timer.freeMinutes * 60;
    showToast(`${timer.freeMinutes}min focus done. Well executed.`);
    renderTimer();
    return;
  }

  const workMins = timer.mode === '50' ? 50 : 25;
  const maxSess  = timer.mode === '50' ? 2 : 4;

  if (timer.phase === 'work') {
    const today = getToday();
    today.sessions++;
    today.focusMin += workMins;
    saveState();
    timer.session = Math.min(timer.session + 1, maxSess);
    timer.phase   = 'break';
    timer.remaining = timer.BREAK_SEC;
    showToast('Session done. Break — no phone.');
  } else {
    timer.phase     = 'work';
    timer.remaining = timer.WORK_SEC;
    showToast('Break over. Back to deep work.');
    if ('vibrate' in navigator) navigator.vibrate([100]);
  }
  renderTimer();
}

function timerSkip() {
  if (timer.mode === 'free') return;
  clearInterval(timer.interval);
  timer.running = false;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  if (timer.phase === 'work') {
    timer.phase     = 'break';
    timer.remaining = timer.BREAK_SEC;
  } else {
    timer.phase     = 'work';
    timer.remaining = timer.WORK_SEC;
    const maxSess   = timer.mode === '50' ? 2 : 4;
    timer.session   = Math.min(timer.session + 1, maxSess - 1);
  }
  renderTimer();
}

function timerReset() {
  clearInterval(timer.interval);
  timer.running = false;
  timer.session = 0;
  document.getElementById('btn-start').style.display = 'inline-flex';
  document.getElementById('btn-pause').style.display = 'none';
  document.querySelectorAll('.mode-btn').forEach(b => b.style.opacity = '1');
  if (timer.mode === 'free') {
    timer.phase     = 'free';
    timer.remaining = timer.freeMinutes * 60;
  } else {
    timer.phase     = 'work';
    timer.remaining = timer.WORK_SEC;
  }
  renderTimer();
}

/* ══════════════════════════════════
   STATS SCREEN
══════════════════════════════════ */
function renderStats() {
  const streak = computeStreak();
  const best   = computeBestStreak();
  const rate   = computeHabitRate(28);
  const focus  = computeMonthFocus();

  document.getElementById('m-streak').textContent = streak;
  document.getElementById('m-best').textContent   = best;
  document.getElementById('m-rate').textContent   = rate + '%';
  document.getElementById('m-focus').textContent  = focus + 'h';

  renderHeatmap();
  renderHabitBars();
  renderDriveStatus();
}

function computeHabitRate(days) {
  const today = new Date();
  let totalPossible = 0, totalDone = 0;
  for (let i = 0; i < days; i++) {
    const key = offsetDate(today, -i);
    const day = state.days[key];
    if (day) {
      totalPossible += HABITS.length;
      totalDone += Object.values(day.habits).filter(Boolean).length;
    }
  }
  if (totalPossible === 0) return 0;
  return Math.round((totalDone / totalPossible) * 100);
}

function computeMonthFocus() {
  const today = new Date();
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const key = offsetDate(today, -i);
    const day = state.days[key];
    if (day) total += (day.focusMin || 0);
  }
  return Math.round(total / 60);
}

function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';
  const today = new Date();
  const todayK = todayKey();

  // 4 weeks = 28 cells, start from 27 days ago
  for (let i = 27; i >= 0; i--) {
    const key = offsetDate(today, -i);
    const day = state.days[key];
    const done = day ? Object.values(day.habits).filter(Boolean).length : 0;
    const cell = document.createElement('div');
    cell.className = 'hcell';
    if (key === todayK) cell.classList.add('today-cell');
    if (done >= HABITS.length)         cell.classList.add('l4');
    else if (done >= HABITS.length * 0.75) cell.classList.add('l3');
    else if (done >= HABITS.length * 0.5)  cell.classList.add('l2');
    else if (done > 0)                      cell.classList.add('l1');
    cell.title = `${key}: ${done}/${HABITS.length} habits`;
    grid.appendChild(cell);
  }
}

function renderHabitBars() {
  const wrap = document.getElementById('habit-bars');
  wrap.innerHTML = '';
  const today = new Date();

  HABITS.forEach(h => {
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const key = offsetDate(today, -i);
      const day = state.days[key];
      if (day && day.habits[h.id]) done++;
    }
    const pct = Math.round((done / 7) * 100);
    const row = document.createElement('div');
    row.className = 'habit-bar-row';
    row.innerHTML = `
      <div class="habit-bar-top">
        <span class="habit-bar-name">${h.label}</span>
        <span class="habit-bar-pct">${pct}%</span>
      </div>
      <div class="habit-bar-track">
        <div class="habit-bar-fill" style="width:${pct}%"></div>
      </div>
    `;
    wrap.appendChild(row);
  });
}

function renderDriveStatus() {
  const dot  = document.getElementById('drive-status-dot');
  const text = document.getElementById('drive-status-text');
  if (state.driveConnected) {
    dot.className = 'connected';
    const last = state.lastSync
      ? 'Last sync: ' + new Date(state.lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : 'Connected to Google Drive';
    text.textContent = last;
  } else {
    dot.className = '';
    text.textContent = 'Not connected — tap Drive icon to connect';
  }
}

/* ══════════════════════════════════
   REFLECT SCREEN
══════════════════════════════════ */
function getWeekLabel() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const opts = { month: 'short', day: 'numeric' };
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `Week ${week} · ${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
}

function renderReflect() {
  document.getElementById('reflect-week-label').textContent = getWeekLabel();
  renderPastReflections();
}

function renderPastReflections() {
  const wrap = document.getElementById('past-reflections');
  wrap.innerHTML = '';
  const sorted = [...state.reflections].reverse().slice(0, 5);
  if (sorted.length === 0) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:0.5rem 0">No reflections saved yet.</div>';
    return;
  }
  sorted.forEach(r => {
    const el = document.createElement('div');
    el.className = 'past-reflection';
    const snippet = r.break ? r.break.slice(0, 80) + (r.break.length > 80 ? '…' : '') : 'No notes';
    el.innerHTML = `
      <div class="past-reflection-date">${r.week} · ${new Date(r.date).toLocaleDateString('en-IN')}</div>
      <div class="past-reflection-snippet">${snippet}</div>
    `;
    wrap.appendChild(el);
  });
}

function saveReflection() {
  const r = {
    week: getWeekLabel(),
    date: new Date().toISOString(),
    break:   document.getElementById('r-break').value.trim(),
    trigger: document.getElementById('r-trigger').value.trim(),
    fix:     document.getElementById('r-fix').value.trim(),
    good:    document.getElementById('r-good').value.trim(),
  };
  if (!r.break && !r.trigger && !r.fix && !r.good) {
    showToast('Write something first.'); return;
  }
  state.reflections.push(r);
  saveState();
  renderPastReflections();
  showToast('Reflection saved. System updated.');
  document.getElementById('r-break').value   = '';
  document.getElementById('r-trigger').value = '';
  document.getElementById('r-fix').value     = '';
  document.getElementById('r-good').value    = '';
}

/* ══════════════════════════════════
   GOOGLE DRIVE SYNC
══════════════════════════════════ */
const DRIVE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';  // Replace after setting up OAuth
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME = 'operator_os_data.json';

let driveToken = null;

document.getElementById('drive-btn').addEventListener('click', () => {
  if (DRIVE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
    showToast('Add your Google Client ID in app.js to enable Drive sync.');
    return;
  }
  if (!driveToken) {
    driveSignIn();
  } else {
    syncToDrive();
  }
});

function driveSignIn() {
  setSyncDot('syncing');
  const params = new URLSearchParams({
    client_id:     DRIVE_CLIENT_ID,
    redirect_uri:  location.origin + location.pathname,
    response_type: 'token',
    scope:         DRIVE_SCOPE,
    prompt:        'select_account',
  });
  const popup = window.open(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    'drive-auth', 'width=500,height=600,left=100,top=100'
  );
  const poll = setInterval(() => {
    try {
      if (popup.closed) { clearInterval(poll); setSyncDot('idle'); return; }
      const hash = new URLSearchParams(popup.location.hash.slice(1));
      const token = hash.get('access_token');
      if (token) {
        clearInterval(poll);
        popup.close();
        driveToken = token;
        state.driveConnected = true;
        saveState();
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
    const fileId = await findOrCreateFile();
    await updateFile(fileId);
    state.lastSync = new Date().toISOString();
    state.driveConnected = true;
    saveState();
    setSyncDot('synced');
    showToast('Synced to Drive ✓');
    renderDriveStatus();
  } catch(e) {
    setSyncDot('error');
    showToast('Sync failed. Check connection.');
  }
}

async function findOrCreateFile() {
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}'&spaces=drive&fields=files(id)`,
    { headers: { Authorization: `Bearer ${driveToken}` } }
  );
  const data = await search.json();
  if (data.files && data.files.length > 0) return data.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' }),
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
  if (!driveToken) {
    showToast('Connect Drive first via the header icon.');
    return;
  }
  await syncToDrive();
}

function setSyncDot(status) {
  const dot = document.getElementById('sync-dot');
  dot.className = 'sync-dot ' + status;
}

/* ══════════════════════════════════
   UTILS
══════════════════════════════════ */
function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ══════════════════════════════════
   MIDNIGHT RESET
══════════════════════════════════ */
function scheduleMidnightReset() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const ms = next - now;
  setTimeout(() => {
    renderHome();
    scheduleMidnightReset();
  }, ms);
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
function init() {
  renderHome();
  renderTimer();
  scheduleMidnightReset();
}

init();
