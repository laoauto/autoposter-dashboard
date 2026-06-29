// ============================================================
//  FB AutoPoster Dashboard — script.js
//  Replace APPS_SCRIPT_URL with your deployed Web App URL
// ============================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6qiIciYfUgfFhaCGgzlPdkon2ABOAuqNSJP1TH2m1jDpQluMz5bpJMR39ZUL5Eo_0/exec';

// ── STATE ────────────────────────────────────────────────────
let state = {
  pages: [],
  schedule: [],
  logs: [],
  currentModalPageId: null,
  settingsToggleOn: false,
  masterToggleOn: false,
};

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  refreshDashboard();
  // Auto-refresh every 60 seconds
  setInterval(refreshDashboard, 60_000);
});

// ── NAVIGATION ───────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      navigateTo(view);
    });
  });
}

function navigateTo(viewName) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`)?.classList.add('active');

  const titles = { dashboard: 'Dashboard', schedule: 'Schedule', log: 'Activity Log', settings: 'Settings' };
  document.getElementById('pageTitle').textContent = titles[viewName] || viewName;

  // Load view-specific data
  if (viewName === 'log') loadLog();
  if (viewName === 'schedule') renderScheduleView();
  if (viewName === 'settings') renderSettingsView();
}

// ── API HELPERS ──────────────────────────────────────────────
async function apiGet(action, params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(payload) {
  // Apps Script Web App: ສົ່ງ payload ຜ່ານ GET parameter ເພື່ອຫຼີກລ່ຽງ CORS
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', payload.action);
  url.searchParams.set('payload', JSON.stringify(payload));

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── DASHBOARD REFRESH ────────────────────────────────────────
async function refreshDashboard() {
  setStatus('connecting');
  try {
    const data = await apiGet('getDashboard');
    state.pages = data.pages || [];
    state.schedule = data.schedule || [];

    setStatus('online');
    updateTopStats(data);
    renderPageCards();

    if (document.getElementById('view-schedule').classList.contains('active')) {
      renderScheduleView();
    }

    // Update server time
    document.getElementById('serverTime').textContent =
      data.serverTime ? new Date(data.serverTime).toLocaleTimeString() : '';

  } catch (err) {
    setStatus('offline');
    showToast('Cannot reach backend. Check your Apps Script URL.', 'error');
    console.error(err);
  }
}

function setStatus(state) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (state === 'online') {
    dot.className = 'status-dot online';
    txt.textContent = 'Connected';
  } else if (state === 'offline') {
    dot.className = 'status-dot offline';
    txt.textContent = 'Offline';
  } else {
    dot.className = 'status-dot';
    txt.textContent = 'Connecting…';
  }
}

function updateTopStats(data) {
  document.getElementById('statPostsToday').textContent = data.totalPostsToday ?? '—';

  const activePagesCount = (data.pages || []).filter(p => p.autoPostEnabled).length;
  document.getElementById('statActivePages').textContent = `${activePagesCount} / 3`;

  const totalPending = (data.pages || []).reduce((s, p) => s + (p.pendingImages || 0), 0);
  document.getElementById('statPending').textContent = totalPending;

  const todayScheduled = (data.schedule || []).filter(s => {
    if (!s.scheduledTime) return false;
    const d = new Date(s.scheduledTime);
    const today = new Date();
    return d.toDateString() === today.toDateString() && s.status === 'PENDING';
  }).length;
  document.getElementById('statScheduled').textContent = todayScheduled;
}

// ── PAGE CARDS ───────────────────────────────────────────────
function renderPageCards() {
  const grid = document.getElementById('pagesGrid');
  if (!state.pages.length) {
    grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
    return;
  }

  grid.innerHTML = state.pages.map(page => renderPageCard(page)).join('');
}

function renderPageCard(page) {
  const postTimes = Array.isArray(page.postTimes) ? page.postTimes : ['—'];
  const pillsHtml = postTimes.map(t => `
    <span class="schedule-pill">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${t}
    </span>`).join('');

  const lastPost = page.lastPost;
  const lastPostHtml = lastPost
    ? `<div class="last-post-info">
        <div>Last: <strong>${formatRelTime(lastPost.timestamp)}</strong> · ${lastPost.status === 'SUCCESS' ? '✅' : '❌'}</div>
        ${lastPost.caption ? `<div class="last-post-caption">${escHtml(lastPost.caption)}</div>` : ''}
       </div>`
    : `<div class="last-post-info" style="color:var(--text-muted)">No posts yet</div>`;

  return `
  <div class="page-card" id="card-${page.id}">
    <div class="page-card-accent" style="background:${page.color}"></div>
    <div class="page-card-header">
      <div>
        <div class="page-card-name">${escHtml(page.name)}</div>
        <div class="page-card-voice">${escHtml(page.brandVoice || '')}</div>
      </div>
      <div class="toggle ${page.autoPostEnabled ? 'on' : ''}"
           id="toggle-${page.id}"
           onclick="handleToggle(${page.id})"
           title="${page.autoPostEnabled ? 'Auto-post ON' : 'Auto-post OFF'}">
        <div class="toggle-knob"></div>
      </div>
    </div>
    <div class="page-card-body">
      <div class="page-stat-row">
        <div class="page-stat">
          <div class="page-stat-num" style="color:${page.color}">${page.totalPosted ?? 0}</div>
          <div class="page-stat-lbl">Posted</div>
        </div>
        <div class="page-stat">
          <div class="page-stat-num">${page.pendingImages ?? 0}</div>
          <div class="page-stat-lbl">Pending</div>
        </div>
        <div class="page-stat">
          <div class="page-stat-num">${page.postsPerDay ?? 1}</div>
          <div class="page-stat-lbl">Per Day</div>
        </div>
      </div>

      <div class="schedule-pills">${pillsHtml}</div>
      ${lastPostHtml}

      <div class="page-card-actions">
        <button class="btn btn-primary btn-sm" onclick="openPostModal(${page.id})" style="flex:1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post Now
        </button>
        <button class="btn btn-ghost btn-sm" onclick="openSettingsModal(${page.id})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </button>
      </div>
    </div>
  </div>`;
}

// ── AUTO-POST TOGGLE ─────────────────────────────────────────
async function handleToggle(pageId) {
  const page = state.pages.find(p => p.id == pageId);
  if (!page) return;

  const newState = !page.autoPostEnabled;
  page.autoPostEnabled = newState; // optimistic update
  const toggleEl = document.getElementById(`toggle-${pageId}`);
  toggleEl.classList.toggle('on', newState);

  try {
    const res = await apiPost({ action: 'toggleAutoPost', pageId, enabled: newState });
    showToast(res.message || 'Toggle updated', 'success');
    refreshDashboard();
  } catch (err) {
    // Revert on error
    page.autoPostEnabled = !newState;
    toggleEl.classList.toggle('on', !newState);
    showToast('Failed to toggle auto-post: ' + err.message, 'error');
  }
}

// ── SCHEDULE VIEW ────────────────────────────────────────────
function renderScheduleView() {
  renderWeekCalendar();
  renderUpcomingPosts();
}

function renderWeekCalendar() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // Mon=0

  let html = `
  <div class="cal-header">
    <div class="cal-header-cell">Page</div>
    ${days.map((d, i) => `
      <div class="cal-header-cell ${i === todayIdx ? 'style="color:var(--accent-blue)"' : ''}">${d}</div>
    `).join('')}
  </div>`;

  state.pages.forEach(page => {
    const postTimes = Array.isArray(page.postTimes) ? page.postTimes : [];
    html += `
    <div class="cal-row">
      <div class="cal-page-label">
        <div class="cal-page-dot" style="background:${page.color}"></div>
        ${escHtml(page.name)}
      </div>
      ${days.map((_, dayIdx) => {
        if (!page.autoPostEnabled) return `<div class="cal-cell"></div>`;
        const chipsHtml = postTimes.map(t => `
          <div class="cal-time-chip" style="background:${page.color}22;color:${page.color}">${t}</div>
        `).join('');
        return `<div class="cal-cell">${chipsHtml}</div>`;
      }).join('')}
    </div>`;
  });

  document.getElementById('scheduleCalendar').innerHTML = html;
}

function renderUpcomingPosts() {
  const pending = state.schedule.filter(s => s.status === 'PENDING' && s.scheduledTime);
  pending.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  if (!pending.length) {
    document.getElementById('upcomingPosts').innerHTML =
      '<div class="empty-state">No upcoming scheduled posts. Use "Schedule Post" to add one.</div>';
    return;
  }

  const html = `<div class="upcoming-list">${pending.slice(0, 20).map(s => {
    const page = state.pages.find(p => p.id == s.pageId);
    return `
    <div class="upcoming-item">
      <div class="upcoming-time">${formatDateTime(s.scheduledTime)}</div>
      <div class="upcoming-page" style="color:${page?.color || '#fff'}">${escHtml(page?.name || `Page ${s.pageId}`)}</div>
      <div class="upcoming-caption">${escHtml(s.caption || '(AI-generated caption)')}</div>
      <span class="status-badge SKIPPED">Pending</span>
    </div>`;
  }).join('')}</div>`;

  document.getElementById('upcomingPosts').innerHTML = html;
}

// ── LOG VIEW ─────────────────────────────────────────────────
async function loadLog() {
  document.getElementById('logBody').innerHTML = '<tr><td colspan="6" class="empty-cell"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const data = await apiGet('getLog', { limit: 100 });
    state.logs = data || [];
    renderLogTable(state.logs);
  } catch (err) {
    document.getElementById('logBody').innerHTML = `<tr><td colspan="6" class="empty-cell">Error loading log: ${escHtml(err.message)}</td></tr>`;
  }
}

function filterLog() {
  const pageFilter = document.getElementById('logPageFilter').value;
  const statusFilter = document.getElementById('logStatusFilter').value;
  let filtered = state.logs;
  if (pageFilter) filtered = filtered.filter(l => String(l.pageId) === pageFilter);
  if (statusFilter) filtered = filtered.filter(l => l.status === statusFilter);
  renderLogTable(filtered);
}

function renderLogTable(logs) {
  if (!logs.length) {
    document.getElementById('logBody').innerHTML = '<tr><td colspan="6" class="empty-cell">No posts logged yet.</td></tr>';
    return;
  }

  const pageColorMap = {};
  state.pages.forEach(p => { pageColorMap[p.id] = p.color; });

  document.getElementById('logBody').innerHTML = logs.map(log => {
    const color = pageColorMap[log.pageId] || '#7a91b0';
    return `
    <tr>
      <td class="td-mono">${formatDateTime(log.timestamp)}</td>
      <td><span style="color:${color};font-weight:600">${escHtml(log.pageName || `Page ${log.pageId}`)}</span></td>
      <td class="td-mono">${escHtml(log.imageName || '—')}</td>
      <td class="td-caption" title="${escHtml(log.caption || '')}">${escHtml(log.caption || '—')}</td>
      <td><span class="status-badge ${log.status}">${log.status}</span></td>
      <td class="td-mono" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${escHtml(log.detail || '')}">${escHtml(log.detail || '—')}</td>
    </tr>`;
  }).join('');
}

// ── SETTINGS VIEW ────────────────────────────────────────────
function renderSettingsView() {
  if (!state.pages.length) {
    document.getElementById('settingsCards').innerHTML =
      '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
    return;
  }

  document.getElementById('settingsCards').innerHTML = `
  <div class="settings-cards">
    ${state.pages.map(page => `
    <div class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title" style="display:flex;align-items:center;gap:10px">
          <div style="width:10px;height:10px;border-radius:50%;background:${page.color};flex-shrink:0"></div>
          ${escHtml(page.name)}
          <span class="status-badge ${page.autoPostEnabled ? 'SUCCESS' : 'SKIPPED'}" style="margin-left:4px">
            ${page.autoPostEnabled ? 'AUTO-POST ON' : 'AUTO-POST OFF'}
          </span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openPostModal(${page.id})">Quick Post</button>
          <button class="btn btn-primary btn-sm" onclick="openSettingsModal(${page.id})">Edit Schedule</button>
        </div>
      </div>
      <div class="settings-card-body">
        <div class="settings-item">
          <div class="settings-item-label">Posts Per Day</div>
          <div class="settings-item-value">${page.postsPerDay ?? 1}</div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">Posting Times</div>
          <div class="settings-item-value">${(page.postTimes || []).join(', ') || '—'}</div>
        </div>
        <div class="settings-item">
          <div class="settings-item-label">Pending Images</div>
          <div class="settings-item-value">${page.pendingImages ?? 0} images</div>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── MODAL: PAGE POST ─────────────────────────────────────────
function openPostModal(pageId) {
  const page = state.pages.find(p => p.id == pageId);
  state.currentModalPageId = pageId;
  document.getElementById('modalPageName').textContent = `Post to: ${page?.name || 'Page'}`;
  document.getElementById('modalCaption').value = '';
  document.getElementById('modalScheduleTime').value = '';
  document.getElementById('modalPostBtn').textContent = 'Post Now';
  openModal('pageModal');
}

async function submitManualPost() {
  const pageId = state.currentModalPageId;
  const caption = document.getElementById('modalCaption').value.trim();
  const scheduleTime = document.getElementById('modalScheduleTime').value;

  const btn = document.getElementById('modalPostBtn');
  btn.disabled = true;
  btn.textContent = scheduleTime ? 'Scheduling…' : 'Posting…';

  // ── ສະແດງ Status ໃນ Card ──
  setCardStatus(pageId, 'posting', scheduleTime ? 'ກຳລັງກຳນົດເວລາ…' : 'ກຳລັງໂພດ…');

  // ຂັ້ນຕອນ 1: ດຶງຮູບ
  setCardStatus(pageId, 'posting', '📁 ກຳລັງດຶງຮູບຈາກ Drive…');
  await sleep(600);

  // ຂັ້ນຕອນ 2: Gemini AI
  if (!caption) {
    setCardStatus(pageId, 'posting', '🤖 Gemini AI ກຳລັງສ້າງ Caption…');
    await sleep(800);
  }

  // ຂັ້ນຕອນ 3: ໂພດ
  setCardStatus(pageId, 'posting', '📤 ກຳລັງໂພດໃສ່ Facebook…');

  try {
    const res = await apiPost({ action: 'manualPost', pageId, customCaption: caption, scheduleTime });
    if (res.success) {
      setCardStatus(pageId, 'success', '✅ ໂພດສຳເລັດແລ້ວ!');
      showToast(res.message || 'ໂພດສຳເລັດ!', 'success');
      closeModal('pageModal');
      setTimeout(() => {
        clearCardStatus(pageId);
        refreshDashboard();
      }, 3000);
    } else {
      setCardStatus(pageId, 'error', '❌ ' + (res.message || 'ໂພດບໍ່ສຳເລັດ'));
      showToast(res.message || 'Post failed', 'error');
      setTimeout(() => clearCardStatus(pageId), 4000);
    }
  } catch (err) {
    setCardStatus(pageId, 'error', '❌ Error: ' + err.message);
    showToast('Error: ' + err.message, 'error');
    setTimeout(() => clearCardStatus(pageId), 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = scheduleTime ? 'Schedule' : 'Post Now';
  }
}

// ── ຟັງຊັ້ນສະແດງ Status ໃນ Card ──────────────────────────────
function setCardStatus(pageId, type, message) {
  const card = document.getElementById(`card-${pageId}`);
  if (!card) return;
  let statusEl = card.querySelector('.card-live-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'card-live-status';
    const body = card.querySelector('.page-card-body');
    if (body) body.insertBefore(statusEl, body.firstChild);
  }
  const colors = { posting: '#f59e0b', success: '#10b981', error: '#ef4444' };
  statusEl.style.cssText = `
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    margin-bottom: 10px;
    background: ${colors[type]}18;
    border: 1px solid ${colors[type]}44;
    color: ${colors[type]};
    display: flex;
    align-items: center;
    gap: 8px;
    animation: pulse 1.5s infinite;
  `;
  if (type === 'posting') {
    statusEl.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> ${escHtml(message)}`;
  } else {
    statusEl.textContent = message;
    statusEl.style.animation = 'none';
  }
}

function clearCardStatus(pageId) {
  const card = document.getElementById(`card-${pageId}`);
  if (!card) return;
  const el = card.querySelector('.card-live-status');
  if (el) el.remove();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── MODAL: PAGE SETTINGS ─────────────────────────────────────
function openSettingsModal(pageId) {
  const page = state.pages.find(p => p.id == pageId);
  if (!page) return;

  document.getElementById('settingsPageId').value = pageId;
  document.getElementById('settingsModalTitle').textContent = `${page.name} — Schedule Settings`;
  document.getElementById('settingsPostsPerDay').value = page.postsPerDay || 1;

  // Populate time slots
  const times = Array.isArray(page.postTimes) && page.postTimes.length ? page.postTimes : ['09:00'];
  document.getElementById('timeSlots').innerHTML = '';
  times.forEach(t => addTimeSlot(t));

  // Toggle state
  state.settingsToggleOn = !!page.autoPostEnabled;
  document.getElementById('settingsToggle').classList.toggle('on', state.settingsToggleOn);

  openModal('settingsModal');
}

function addTimeSlot(value = '09:00', containerId = 'timeSlots') {
  const container = document.getElementById(containerId);
  const item = document.createElement('div');
  item.className = 'time-slot-item';
  item.innerHTML = `
    <input type="time" class="time-slot-input" value="${value}" />
    <button class="time-slot-remove" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(item);
}

function addMasterTimeSlot() { addTimeSlot('09:00', 'masterTimeSlots'); }

function toggleSettingsSwitch() {
  state.settingsToggleOn = !state.settingsToggleOn;
  document.getElementById('settingsToggle').classList.toggle('on', state.settingsToggleOn);
}

async function submitSettings() {
  const pageId = document.getElementById('settingsPageId').value;
  const postsPerDay = parseInt(document.getElementById('settingsPostsPerDay').value) || 1;
  const autoPostEnabled = state.settingsToggleOn;

  const timeInputs = document.querySelectorAll('#timeSlots .time-slot-input');
  const postTimes = Array.from(timeInputs).map(i => i.value).filter(Boolean);

  if (!postTimes.length) { showToast('Add at least one posting time', 'error'); return; }

  try {
    const res = await apiPost({ action: 'saveSettings', pageId, postsPerDay, postTimes, autoPostEnabled });
    if (res.success) {
      showToast(res.message || 'Settings saved!', 'success');
      closeModal('settingsModal');
      refreshDashboard();
    } else {
      showToast(res.message || 'Save failed', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ── MODAL: MASTER APPLY ──────────────────────────────────────
function openMasterModal() {
  document.getElementById('masterPostsPerDay').value = 1;
  document.getElementById('masterTimeSlots').innerHTML = '';
  addMasterTimeSlot();
  state.masterToggleOn = false;
  document.getElementById('masterToggle').classList.remove('on');
  openModal('masterModal');
}

function toggleMasterSwitch() {
  state.masterToggleOn = !state.masterToggleOn;
  document.getElementById('masterToggle').classList.toggle('on', state.masterToggleOn);
}

async function submitMasterApply() {
  const postsPerDay = parseInt(document.getElementById('masterPostsPerDay').value) || 1;
  const autoPostEnabled = state.masterToggleOn;

  const timeInputs = document.querySelectorAll('#masterTimeSlots .time-slot-input');
  const postTimes = Array.from(timeInputs).map(i => i.value).filter(Boolean);

  if (!postTimes.length) { showToast('Add at least one posting time', 'error'); return; }

  try {
    const res = await apiPost({ action: 'applyToAll', postsPerDay, postTimes, autoPostEnabled });
    if (res.success) {
      showToast('Settings applied to all 3 pages!', 'success');
      closeModal('masterModal');
      refreshDashboard();
    } else {
      showToast(res.message || 'Apply failed', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ── MODAL: MANUAL SCHEDULE ───────────────────────────────────
function openManualPostModal() {
  // Populate page names dynamically
  const select = document.getElementById('manualPageId');
  select.innerHTML = state.pages.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  document.getElementById('manualCaption').value = '';
  // Default to 1 hour from now
  const dt = new Date(Date.now() + 3_600_000);
  document.getElementById('manualScheduleTime').value = dt.toISOString().slice(0, 16);
  openModal('manualPostModal');
}

async function submitManualSchedule() {
  const pageId = document.getElementById('manualPageId').value;
  const caption = document.getElementById('manualCaption').value.trim();
  const scheduleTime = document.getElementById('manualScheduleTime').value;

  if (!scheduleTime) { showToast('Please pick a schedule time', 'error'); return; }

  try {
    const res = await apiPost({ action: 'manualPost', pageId, customCaption: caption, scheduleTime });
    if (res.success) {
      showToast(res.message || 'Post scheduled!', 'success');
      closeModal('manualPostModal');
      renderScheduleView();
    } else {
      showToast(res.message || 'Schedule failed', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ── MODAL HELPERS ────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

// ── UTILITIES ────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}