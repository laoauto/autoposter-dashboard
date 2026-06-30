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
  renderOfficeRoom();
  startIdleOfficeAnimation();
  startLiveClock();
  refreshDashboard();
  setInterval(refreshDashboard, 8000);
});

// ── LIVE CLOCK (real-time) ─────────────────────────────────────
function startLiveClock() {
  function tick() {
    const el = document.getElementById('liveClock');
    if (!el) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('lo-LA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = '🕐 ' + dateStr + ' — ' + timeStr;
  }
  tick();
  setInterval(tick, 1000);
}

// ── NAVIGATION ───────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo(item.dataset.view);
    });
  });
}

function navigateTo(viewName) {
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var navEl = document.querySelector('[data-view="' + viewName + '"]');
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var viewEl = document.getElementById('view-' + viewName);
  if (viewEl) viewEl.classList.add('active');

  var titles = {
    dashboard: 'ໜ້າຫຼັກ',
    office: 'ຫ້ອງການເຮັດວຽກ',
    gallery: 'ຮູບທີ່ໂພດແລ້ວ',
    schedule: 'ຕາຕະລາງ',
    log: 'ປະຫວັດການເຮັດວຽກ',
    settings: 'ຕັ້ງຄ່າ'
  };
  document.getElementById('pageTitle').textContent = titles[viewName] || viewName;

  if (viewName === 'log') loadLog();
  if (viewName === 'schedule') renderScheduleView();
  if (viewName === 'settings') renderSettingsView();
  if (viewName === 'gallery') renderGallery();
  if (viewName === 'office') renderOfficeRoom();
}

// ── API HELPERS ──────────────────────────────────────────────
function apiGet(action, params) {
  params = params || {};
  var url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.keys(params).forEach(function(k) { url.searchParams.set(k, params[k]); });

  return fetch(url.toString(), { method: 'GET', redirect: 'follow' }).then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function apiPost(payload) {
  var url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', payload.action);
  url.searchParams.set('payload', JSON.stringify(payload));

  return fetch(url.toString(), { method: 'GET', redirect: 'follow' }).then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

// ── DASHBOARD REFRESH ────────────────────────────────────────
function refreshDashboard() {
  setStatus('connecting');
  return apiGet('getDashboard').then(function(data) {
    state.pages = data.pages || [];
    state.schedule = data.schedule || [];

    setStatus('online');
    updateTopStats(data);
    renderPageCards();

    if (document.getElementById('view-schedule').classList.contains('active')) renderScheduleView();
    if (document.getElementById('view-gallery').classList.contains('active')) renderGallery();
    if (document.getElementById('view-office').classList.contains('active')) renderOfficeRoom();

    document.getElementById('serverTime').textContent =
      data.serverTime ? new Date(data.serverTime).toLocaleTimeString('lo-LA') : '';
  }).catch(function(err) {
    setStatus('offline');
    showToast('ບໍ່ສາມາດເຊື່ອມຕໍ່ Backend ໄດ້. ກວດ Apps Script URL.', 'error');
    console.error(err);
  });
}

function setStatus(s) {
  var dot = document.getElementById('statusDot');
  var txt = document.getElementById('statusText');
  if (s === 'online') {
    dot.className = 'status-dot online';
    txt.textContent = 'ເຊື່ອມຕໍ່ສຳເລັດ';
  } else if (s === 'offline') {
    dot.className = 'status-dot offline';
    txt.textContent = 'ບໍ່ໄດ້ເຊື່ອມຕໍ່';
  } else {
    dot.className = 'status-dot';
    txt.textContent = 'ກຳລັງເຊື່ອມຕໍ່…';
  }
}

function updateTopStats(data) {
  document.getElementById('statPostsToday').textContent = data.totalPostsToday != null ? data.totalPostsToday : '—';

  var pages = data.pages || [];
  var activePagesCount = pages.filter(function(p) { return p.autoPostEnabled; }).length;
  document.getElementById('statActivePages').textContent = activePagesCount + ' / 3';

  var totalPending = pages.reduce(function(s, p) { return s + (p.pendingImages || 0); }, 0);
  document.getElementById('statPending').textContent = totalPending;

  var schedule = data.schedule || [];
  var today = new Date();
  var todayScheduled = schedule.filter(function(s) {
    if (!s.scheduledTime) return false;
    var d = new Date(s.scheduledTime);
    return d.toDateString() === today.toDateString() && s.status === 'PENDING';
  }).length;
  document.getElementById('statScheduled').textContent = todayScheduled;

  // ── ສ້າງລາຍລະອຽດສຳລັບແຕ່ລະ Stat Card ──
  renderStatDetailPosts(pages);
  renderStatDetailPages(pages);
  renderStatDetailPending(pages);
  renderStatDetailScheduled(schedule, pages, today);
}

function renderStatDetailPosts(pages) {
  var body = document.getElementById('statDetailPostsBody');
  var rows = pages.map(function(p) {
    var lastPostTxt = p.lastPost && p.lastPost.status === 'SUCCESS' ? formatRelTime(p.lastPost.timestamp) : 'ຍັງບໍ່ມີໂພດມື້ນີ້';
    return '<div class="stat-detail-row"><span class="stat-detail-dot" style="background:' + p.color + '"></span>' +
      '<strong>' + escHtml(p.name) + '</strong> — ໂພດແລ້ວທັງໝົດ ' + (p.totalPosted || 0) + ' ຄັ້ງ · ຫຼ້າສຸດ: ' + lastPostTxt + '</div>';
  }).join('');
  body.innerHTML = rows || '<div class="stat-detail-empty">ບໍ່ມີຂໍ້ມູນ</div>';
}

function renderStatDetailPages(pages) {
  var body = document.getElementById('statDetailPagesBody');
  var rows = pages.map(function(p) {
    var statusTxt = p.autoPostEnabled ? '✅ ເປີດໂພດອັດຕະໂນມັດ' : '⏸️ ປິດໂພດອັດຕະໂນມັດ';
    return '<div class="stat-detail-row"><span class="stat-detail-dot" style="background:' + p.color + '"></span>' +
      '<strong>' + escHtml(p.name) + '</strong> — ' + statusTxt + '</div>';
  }).join('');
  body.innerHTML = rows || '<div class="stat-detail-empty">ບໍ່ມີຂໍ້ມູນ</div>';
}

function renderStatDetailPending(pages) {
  var body = document.getElementById('statDetailPendingBody');
  var rows = pages.map(function(p) {
    return '<div class="stat-detail-row"><span class="stat-detail-dot" style="background:' + p.color + '"></span>' +
      '<strong>' + escHtml(p.name) + '</strong> — ' + (p.pendingImages || 0) + ' ຮູບລໍຖ້າໂພດ</div>';
  }).join('');
  body.innerHTML = rows || '<div class="stat-detail-empty">ບໍ່ມີຂໍ້ມູນ</div>';
}

function renderStatDetailScheduled(schedule, pages, today) {
  var body = document.getElementById('statDetailScheduledBody');
  var pageNameMap = {}, pageColorMap = {};
  pages.forEach(function(p) { pageNameMap[p.id] = p.name; pageColorMap[p.id] = p.color; });

  var todayItems = schedule.filter(function(s) {
    if (!s.scheduledTime) return false;
    var d = new Date(s.scheduledTime);
    return d.toDateString() === today.toDateString() && s.status === 'PENDING';
  });

  if (!todayItems.length) {
    body.innerHTML = '<div class="stat-detail-empty">ບໍ່ມີລາຍການກຳນົດເວລາສຳລັບມື້ນີ້</div>';
    return;
  }

  body.innerHTML = todayItems.map(function(s) {
    var pname = pageNameMap[s.pageId] || ('ເພຈ ' + s.pageId);
    var color = pageColorMap[s.pageId] || '#7a91b0';
    var timeTxt = formatDateTime(s.scheduledTime);
    return '<div class="stat-detail-row"><span class="stat-detail-dot" style="background:' + color + '"></span>' +
      '<strong>' + escHtml(pname) + '</strong> — ' + timeTxt + ' (' + escHtml(s.caption ? 'ມີແຄບຊັ້ນແລ້ວ' : 'AI ຈະຂຽນແຄບຊັ້ນ') + ')</div>';
  }).join('');
}

function toggleStatDetail(panelId) {
  var panel = document.getElementById(panelId);
  var allPanels = document.querySelectorAll('.stat-detail-panel');
  var allCards = document.querySelectorAll('.stat-card-clickable');
  var wasOpen = panel.classList.contains('open');

  allPanels.forEach(function(p) { p.classList.remove('open'); });
  allCards.forEach(function(c) { c.classList.remove('open'); });

  if (!wasOpen) {
    panel.classList.add('open');
    // ໝາຍ Card ທີ່ກົງກັນວ່າເປີດຢູ່
    var cardMap = {
      statDetailPosts: 0, statDetailPages: 1, statDetailPending: 2, statDetailScheduled: 3
    };
    var idx = cardMap[panelId];
    if (idx != null && allCards[idx]) allCards[idx].classList.add('open');
  }
}


// ── PAGE CARDS ───────────────────────────────────────────────
function renderPageCards() {
  var grid = document.getElementById('pagesGrid');
  if (!state.pages.length) {
    grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>ກຳລັງໂຫຼດ…</p></div>';
    return;
  }
  grid.innerHTML = state.pages.map(renderPageCard).join('');
}

function pageLogoHtml(page, size) {
  size = size || 40;
  if (page.logoUrl) {
    return '<img src="' + escHtml(page.logoUrl) + '" alt="' + escHtml(page.name) + '" class="page-logo-img" style="width:' + size + 'px;height:' + size + 'px" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
      '<div class="page-logo-fallback" style="width:' + size + 'px;height:' + size + 'px;display:none;background:' + page.color + '">' + escHtml((page.name || '?')[0]) + '</div>';
  }
  return '<div class="page-logo-fallback" style="width:' + size + 'px;height:' + size + 'px;background:' + page.color + '">' + escHtml((page.name || '?')[0]) + '</div>';
}

function renderPageCard(page) {
  var postTimes = Array.isArray(page.postTimes) ? page.postTimes : ['—'];
  var pillsHtml = postTimes.map(function(t) {
    return '<span class="schedule-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + t + '</span>';
  }).join('');

  var lastPost = page.lastPost;
  var lastPostHtml;
  if (lastPost) {
    var clickAttr = lastPost.imageUrl ? ('onclick="openImagePreview(' + page.id + ')" style="cursor:pointer"') : '';
    var icon = lastPost.status === 'SUCCESS' ? '✅' : (lastPost.status === 'SKIPPED' ? '⏭️' : '❌');
    var viewHint = lastPost.imageUrl ? '<span class="last-post-view-hint">👁️ ກົດເບິ່ງຮູບ</span>' : '';
    var capHtml = lastPost.caption ? ('<div class="last-post-caption">' + escHtml(lastPost.caption) + '</div>') : '';
    lastPostHtml = '<div class="last-post-info" ' + clickAttr + '><div>ຫຼ້າສຸດ: <strong>' + formatRelTime(lastPost.timestamp) + '</strong> · ' + icon + ' ' + viewHint + '</div>' + capHtml + '</div>';
  } else {
    lastPostHtml = '<div class="last-post-info" style="color:var(--text-muted)">ຍັງບໍ່ມີການໂພດ</div>';
  }

  var phoneHtml = page.phone ? ('<div class="page-card-phone">📞 ' + escHtml(page.phone) + '</div>') : '';

  return '' +
  '<div class="page-card" id="card-' + page.id + '">' +
    '<div class="page-card-accent" style="background:' + page.color + '"></div>' +
    '<div class="page-card-header">' +
      '<div class="page-card-header-left">' +
        '<div class="page-logo-wrap">' + pageLogoHtml(page) + '</div>' +
        '<div>' +
          '<div class="page-card-name">' + escHtml(page.name) + '</div>' +
          '<div class="page-card-voice">' + escHtml(page.brandVoice || '') + '</div>' +
          phoneHtml +
        '</div>' +
      '</div>' +
      '<div class="toggle ' + (page.autoPostEnabled ? 'on' : '') + '" id="toggle-' + page.id + '" onclick="handleToggle(' + page.id + ')" title="' + (page.autoPostEnabled ? 'ໂພດອັດຕະໂນມັດ: ເປີດ' : 'ໂພດອັດຕະໂນມັດ: ປິດ') + '">' +
        '<div class="toggle-knob"></div>' +
      '</div>' +
    '</div>' +
    '<div class="page-card-body">' +
      '<div class="page-stat-row">' +
        '<div class="page-stat"><div class="page-stat-num" style="color:' + page.color + '">' + (page.totalPosted || 0) + '</div><div class="page-stat-lbl">ໂພດແລ້ວ</div></div>' +
        '<div class="page-stat"><div class="page-stat-num">' + (page.pendingImages || 0) + '</div><div class="page-stat-lbl">ລໍຖ້າ</div></div>' +
        '<div class="page-stat"><div class="page-stat-num">' + (page.postsPerDay || 1) + '</div><div class="page-stat-lbl">ຕໍ່ມື້</div></div>' +
      '</div>' +
      '<div class="schedule-pills">' + pillsHtml + '</div>' +
      lastPostHtml +
      '<div class="page-card-actions">' +
        '<button class="btn btn-primary btn-sm" onclick="openPostModal(' + page.id + ')" style="flex:1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>ໂພດດຽວນີ້</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="openSettingsModal(' + page.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>ຕັ້ງຄ່າ</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── AUTO-POST TOGGLE ─────────────────────────────────────────
function handleToggle(pageId) {
  var page = state.pages.find(function(p) { return p.id == pageId; });
  if (!page) return;

  var newState = !page.autoPostEnabled;
  page.autoPostEnabled = newState;
  var toggleEl = document.getElementById('toggle-' + pageId);
  toggleEl.classList.toggle('on', newState);

  apiPost({ action: 'toggleAutoPost', pageId: pageId, enabled: newState }).then(function(res) {
    showToast(res.message || 'ອັບເດດສຳເລັດ', 'success');
    refreshDashboard();
  }).catch(function(err) {
    page.autoPostEnabled = !newState;
    toggleEl.classList.toggle('on', !newState);
    showToast('ປ່ຽນສະຖານະບໍ່ສຳເລັດ: ' + err.message, 'error');
  });
}

// ── SCHEDULE VIEW ────────────────────────────────────────────
function renderScheduleView() {
  if (!state.logs.length) {
    apiGet('getLog', { limit: 100 }).then(function(data) {
      state.logs = data || [];
      renderWeekCalendar();
      renderUpcomingPosts();
    }).catch(function() {
      renderWeekCalendar();
      renderUpcomingPosts();
    });
  } else {
    renderWeekCalendar();
    renderUpcomingPosts();
  }
}

function getBlinkStatusForSlot(page, timeStr, dayIdx, todayIdx) {
  // ກວດສະຖານະພຽງສະເພາະຖັນ "ມື້ນີ້" ເທົ່ານັ້ນ; ມື້ອື່ນສະແດງສີແດງ (ລໍຖ້າ)
  if (dayIdx !== todayIdx) return 'red';

  var now = new Date();
  var parts = timeStr.split(':');
  var slotTime = new Date(now);
  slotTime.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);

  // ກວດວ່າມີໂພດສຳເລັດສຳລັບເພຈນີ້ ໃນຊ່ວງເວລາໃກ້ກັບ slot ນີ້ບໍ່ (±20 ນາທີ)
  var todayStr = now.toDateString();
  var matchedSuccess = state.logs.some(function(l) {
    var lts = l.timestamp || l[0];
    var lpid = l.pageId || l[1];
    var lstat = l.status || l[5];
    if (String(lpid) !== String(page.id) || lstat !== 'SUCCESS') return false;
    var ld = new Date(lts);
    if (ld.toDateString() !== todayStr) return false;
    var diffMin = Math.abs(ld.getTime() - slotTime.getTime()) / 60000;
    return diffMin <= 90;
  });
  if (matchedSuccess) return 'green';

  var diffMs = slotTime.getTime() - now.getTime();
  var diffMin = diffMs / 60000;

  if (diffMin <= 30 && diffMin >= -30) return 'yellow'; // ໃກ້ຮອດເວລາ
  if (diffMin < -30) return 'red'; // ເລີຍເວລາໄປແລ້ວ ບໍ່ມີຮູບ/ບໍ່ສຳເລັດ → ລໍຖ້າມື້ໃໝ່
  return 'red'; // ຍັງບໍ່ຮອດເວລາ (ໄກກວ່າ 30 ນາທີ) → ສະຖານະລໍຖ້າ
}

function renderWeekCalendar() {
  var days = ['ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ', 'ອາທິດ'];
  var today = new Date();
  var todayIdx = (today.getDay() + 6) % 7;

  var html = '<div class="cal-header"><div class="cal-header-cell">ເພຈ</div>' +
    days.map(function(d, i) {
      return '<div class="cal-header-cell' + (i === todayIdx ? '" style="color:var(--accent-blue)' : '') + '">' + d + '</div>';
    }).join('') + '</div>';

  state.pages.forEach(function(page) {
    var postTimes = Array.isArray(page.postTimes) ? page.postTimes : [];
    html += '<div class="cal-row"><div class="cal-page-label"><div class="cal-page-dot" style="background:' + page.color + '"></div>' + escHtml(page.name) + '</div>' +
      days.map(function(_, dayIdx) {
        if (!page.autoPostEnabled) return '<div class="cal-cell"></div>';
        var chips = postTimes.map(function(t) {
          var blinkStatus = getBlinkStatusForSlot(page, t, dayIdx, todayIdx);
          return '<div class="cal-time-chip" style="background:' + page.color + '22;color:' + page.color + '"><span class="blink-dot ' + blinkStatus + '"></span>' + t + '</div>';
        }).join('');
        return '<div class="cal-cell">' + chips + '</div>';
      }).join('') + '</div>';
  });

  document.getElementById('scheduleCalendar').innerHTML = html;
}

function renderUpcomingPosts() {
  var pending = state.schedule.filter(function(s) { return s.status === 'PENDING' && s.scheduledTime; });
  pending.sort(function(a, b) { return new Date(a.scheduledTime) - new Date(b.scheduledTime); });

  if (!pending.length) {
    document.getElementById('upcomingPosts').innerHTML = '<div class="empty-state">ບໍ່ມີລາຍການກຳນົດເວລາ. ກົດ "ກຳນົດເວລາໂພດ" ເພື່ອເພີ່ມ.</div>';
    return;
  }

  var html = '<div class="upcoming-list">' + pending.slice(0, 20).map(function(s) {
    var page = state.pages.find(function(p) { return p.id == s.pageId; });
    var color = page ? page.color : '#fff';
    var name = page ? page.name : ('ເພຈ ' + s.pageId);
    return '<div class="upcoming-item">' +
      '<div class="upcoming-time">' + formatDateTime(s.scheduledTime) + '</div>' +
      '<div class="upcoming-page" style="color:' + color + '">' + escHtml(name) + '</div>' +
      '<div class="upcoming-caption">' + escHtml(s.caption || '(AI ຈະຂຽນແຄບຊັ້ນໃຫ້)') + '</div>' +
      '<span class="status-badge SKIPPED">ລໍຖ້າ</span>' +
    '</div>';
  }).join('') + '</div>';

  document.getElementById('upcomingPosts').innerHTML = html;
}

// ── LOG VIEW ─────────────────────────────────────────────────
function loadLog() {
  document.getElementById('logBody').innerHTML = '<tr><td colspan="6" class="empty-cell"><div class="spinner" style="margin:0 auto"></div></td></tr>';
  populateLogPageFilter();

  apiGet('getLog', { limit: 100 }).then(function(data) {
    state.logs = data || [];
    renderLogTable(state.logs);
  }).catch(function(err) {
    document.getElementById('logBody').innerHTML = '<tr><td colspan="6" class="empty-cell">ໂຫຼດປະຫວັດບໍ່ສຳເລັດ: ' + escHtml(err.message) + '</td></tr>';
  });
}

function populateLogPageFilter() {
  var sel = document.getElementById('logPageFilter');
  if (!state.pages.length) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">ທຸກເພຈ</option>' +
    state.pages.map(function(p) { return '<option value="' + p.id + '">' + escHtml(p.name) + '</option>'; }).join('');
  sel.value = currentVal;
}

function filterLog() {
  var pageFilter = document.getElementById('logPageFilter').value;
  var statusFilter = document.getElementById('logStatusFilter').value;
  var filtered = state.logs;
  if (pageFilter) filtered = filtered.filter(function(l) { return String(l.pageId) === pageFilter; });
  if (statusFilter) filtered = filtered.filter(function(l) { return l.status === statusFilter; });
  renderLogTable(filtered);
}

var STATUS_LABEL_LAO = { SUCCESS: 'ສຳເລັດ', FAILED: 'ລົ້ມເຫຼວ', SKIPPED: 'ຂ້າມ' };

function renderLogTable(logs) {
  if (!logs.length) {
    document.getElementById('logBody').innerHTML = '<tr><td colspan="6" class="empty-cell">ຍັງບໍ່ມີປະຫວັດການໂພດ.</td></tr>';
    return;
  }

  var pageColorMap = {};
  state.pages.forEach(function(p) { pageColorMap[p.id] = p.color; });

  document.getElementById('logBody').innerHTML = logs.map(function(log) {
    var ts = log.timestamp || log[0] || '—';
    var pid = log.pageId || log[1] || '';
    var pname = log.pageName || log[2] || ('ເພຈ ' + pid);
    var cap = log.caption || log[4] || '—';
    var stat = log.status || log[5] || 'UNKNOWN';
    var det = log.detail || log[6] || '—';
    var imgUrl = log.imageUrl || log[7] || '';
    var fbUrl = log.fbPostUrl || log[8] || '';

    var color = pageColorMap[pid] || '#7a91b0';
    var statClass = stat === 'SUCCESS' ? 'SUCCESS' : (stat === 'FAILED' ? 'FAILED' : 'SKIPPED');
    var statLabel = STATUS_LABEL_LAO[stat] || stat;

    var dataAttr = encodeURIComponent(JSON.stringify({ pname: pname, ts: ts, cap: cap, imgUrl: imgUrl, fbUrl: fbUrl }));
    var thumbHtml = imgUrl
      ? '<img src="' + escHtml(imgUrl) + '" class="log-thumb" data-preview="' + dataAttr + '" onclick="openImagePreviewFromAttr(this)" alt="ຮູບ" />'
      : '<div class="log-thumb log-thumb-empty">—</div>';

    return '<tr>' +
      '<td>' + thumbHtml + '</td>' +
      '<td class="td-mono">' + formatDateTime(ts) + '</td>' +
      '<td><span style="color:' + color + ';font-weight:600">' + escHtml(String(pname)) + '</span></td>' +
      '<td class="td-caption" title="' + escHtml(String(cap)) + '">' + escHtml(String(cap)) + '</td>' +
      '<td><span class="status-badge ' + statClass + '">' + escHtml(statLabel) + '</span></td>' +
      '<td class="td-mono" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(String(det)) + '">' + escHtml(String(det)) + '</td>' +
    '</tr>';
  }).join('');
}

function openImagePreviewFromAttr(el) {
  try {
    var data = JSON.parse(decodeURIComponent(el.dataset.preview));
    openImagePreviewFromLog(data);
  } catch (e) { console.error(e); }
}

// ── GALLERY VIEW (ຮູບທີ່ໂພດແລ້ວ) ──────────────────────────────
function renderGallery() {
  var filterSel = document.getElementById('galleryPageFilter');
  if (filterSel.options.length <= 1 && state.pages.length) {
    state.pages.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      filterSel.appendChild(opt);
    });
  }

  var pageFilter = filterSel.value;
  var logs = state.logs.length ? state.logs : [];

  if (!logs.length) {
    apiGet('getLog', { limit: 100 }).then(function(data) {
      state.logs = data || [];
      renderGallery();
    }).catch(function() {
      document.getElementById('galleryGrid').innerHTML = '<div class="empty-state">ໂຫຼດຮູບບໍ່ສຳເລັດ.</div>';
    });
    return;
  }

  var pageColorMap = {};
  var pageNameMap = {};
  var pageLogoMap = {};
  state.pages.forEach(function(p) { pageColorMap[p.id] = p.color; pageNameMap[p.id] = p.name; pageLogoMap[p.id] = p.logoUrl; });

  var filtered = logs.filter(function(l) {
    var imgUrl = l.imageUrl || l[7];
    var stat = l.status || l[5];
    return imgUrl && stat === 'SUCCESS';
  });

  if (pageFilter) {
    filtered = filtered.filter(function(l) { return String(l.pageId || l[1]) === pageFilter; });
  }

  if (!filtered.length) {
    document.getElementById('galleryGrid').innerHTML = '<div class="empty-state">ຍັງບໍ່ມີຮູບທີ່ໂພດສຳເລັດ.</div>';
    return;
  }

  function renderItem(l) {
    var ts = l.timestamp || l[0];
    var pid = l.pageId || l[1];
    var pname = l.pageName || l[2] || pageNameMap[pid] || ('ເພຈ ' + pid);
    var cap = l.caption || l[4] || '';
    var imgUrl = l.imageUrl || l[7];
    var fbUrl = l.fbPostUrl || l[8] || '';
    var color = pageColorMap[pid] || '#7a91b0';
    var dataAttr = encodeURIComponent(JSON.stringify({ pname: pname, ts: ts, cap: cap, imgUrl: imgUrl, fbUrl: fbUrl }));

    return '<div class="gallery-item" data-preview="' + dataAttr + '" onclick="openImagePreviewFromAttr(this)">' +
      '<img src="' + escHtml(imgUrl) + '" class="gallery-item-img" alt="' + escHtml(pname) + '" loading="lazy" />' +
      '<div class="gallery-item-body">' +
        '<div class="gallery-item-page" style="color:' + color + '">' + escHtml(pname) + '</div>' +
        '<div class="gallery-item-time">' + formatDateTime(ts) + '</div>' +
      '</div>' +
    '</div>';
  }

  // ຖ້າເລືອກສະເພາະເພຈ → ສະແດງ Grid ປົກກະຕິ
  if (pageFilter) {
    document.getElementById('galleryGrid').innerHTML = filtered.map(renderItem).join('');
    return;
  }

  // ຖ້າ "ທຸກເພຈ" → ຈັດກຸ່ມຕາມເພຈ ພ້ອມຫົວຂໍ້ແຍກ
  var grouped = {};
  filtered.forEach(function(l) {
    var pid = l.pageId || l[1];
    if (!grouped[pid]) grouped[pid] = [];
    grouped[pid].push(l);
  });

  var html = '';
  state.pages.forEach(function(p) {
    var items = grouped[p.id];
    if (!items || !items.length) return;
    var logoHtml = p.logoUrl
      ? '<img src="' + escHtml(p.logoUrl) + '" class="gallery-section-logo" alt="" onerror="this.style.display=\'none\'" />'
      : '<span class="gallery-section-dot" style="background:' + p.color + '"></span>';
    html += '<div class="gallery-section-header">' + logoHtml +
      '<span style="color:' + p.color + '">' + escHtml(p.name) + '</span>' +
      '<span class="gallery-section-count">' + items.length + ' ຮູບ</span></div>';
    html += '<div class="gallery-section-grid">' + items.map(renderItem).join('') + '</div>';
  });

  document.getElementById('galleryGrid').innerHTML = html || '<div class="empty-state">ຍັງບໍ່ມີຮູບທີ່ໂພດສຳເລັດ.</div>';
}

// ── IMAGE PREVIEW MODAL ────────────────────────────────────────
function openImagePreview(pageId) {
  var page = state.pages.find(function(p) { return p.id == pageId; });
  if (!page || !page.lastPost) return;
  var lp = page.lastPost;
  openImagePreviewFromLog({
    pname: page.name,
    ts: lp.timestamp,
    cap: lp.caption,
    imgUrl: lp.imageUrl,
    fbUrl: lp.fbPostUrl
  });
}

function openImagePreviewFromLog(data) {
  document.getElementById('previewModalTitle').textContent = 'ຮູບທີ່ໂພດ — ' + (data.pname || '');
  document.getElementById('previewImage').src = data.imgUrl || '';
  document.getElementById('previewPageName').textContent = data.pname || '—';
  document.getElementById('previewTime').textContent = formatDateTime(data.ts);
  document.getElementById('previewCaption').textContent = data.cap || '—';

  var fbLink = document.getElementById('previewFbLink');
  if (data.fbUrl) {
    fbLink.href = data.fbUrl;
    fbLink.style.display = 'inline-flex';
  } else {
    fbLink.style.display = 'none';
  }

  openModal('imagePreviewModal');
}

// ── SETTINGS VIEW ────────────────────────────────────────────
function renderSettingsView() {
  if (!state.pages.length) {
    document.getElementById('settingsCards').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>ກຳລັງໂຫຼດ…</p></div>';
    return;
  }

  document.getElementById('settingsCards').innerHTML = '<div class="settings-cards">' +
    state.pages.map(function(page) {
      return '<div class="settings-card">' +
        '<div class="settings-card-header">' +
          '<div class="settings-card-title" style="display:flex;align-items:center;gap:10px">' +
            '<div class="settings-card-logo">' + pageLogoHtml(page, 32) + '</div>' +
            escHtml(page.name) +
            '<span class="status-badge ' + (page.autoPostEnabled ? 'SUCCESS' : 'SKIPPED') + '" style="margin-left:4px">' +
              (page.autoPostEnabled ? 'ໂພດອັດຕະໂນມັດ: ເປີດ' : 'ໂພດອັດຕະໂນມັດ: ປິດ') +
            '</span>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-ghost btn-sm" onclick="openPostModal(' + page.id + ')">ໂພດດ່ວນ</button>' +
            '<button class="btn btn-primary btn-sm" onclick="openSettingsModal(' + page.id + ')">ແກ້ໄຂການຕັ້ງຄ່າ</button>' +
          '</div>' +
        '</div>' +
        '<div class="settings-card-body">' +
          '<div class="settings-item"><div class="settings-item-label">ຈຳນວນໂພດຕໍ່ມື້</div><div class="settings-item-value">' + (page.postsPerDay || 1) + '</div></div>' +
          '<div class="settings-item"><div class="settings-item-label">ເວລາໂພດ</div><div class="settings-item-value">' + ((page.postTimes || []).join(', ') || '—') + '</div></div>' +
          '<div class="settings-item"><div class="settings-item-label">ຮູບລໍຖ້າໂພດ</div><div class="settings-item-value">' + (page.pendingImages || 0) + ' ຮູບ</div></div>' +
          '<div class="settings-item"><div class="settings-item-label">ເບີໂທຕິດຕໍ່</div><div class="settings-item-value">' + (page.phone ? escHtml(page.phone) : '—') + '</div></div>' +
          '<div class="settings-item"><div class="settings-item-label">ໂທນສຽງແບຣນ</div><div class="settings-item-value">' + (page.brandVoice ? escHtml(page.brandVoice) : '—') + '</div></div>' +
          '<div class="settings-item"><div class="settings-item-label">ໂພດແລ້ວທັງໝົດ</div><div class="settings-item-value">' + (page.totalPosted || 0) + ' ຄັ້ງ</div></div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── MODAL: PAGE POST ─────────────────────────────────────────
function openPostModal(pageId) {
  var page = state.pages.find(function(p) { return p.id == pageId; });
  state.currentModalPageId = pageId;
  document.getElementById('modalPageName').textContent = 'ໂພດໃສ່: ' + (page ? page.name : 'ເພຈ');
  document.getElementById('modalCaption').value = '';
  document.getElementById('modalScheduleTime').value = '';
  document.getElementById('modalPostBtn').textContent = 'ໂພດດຽວນີ້';
  openModal('pageModal');
}

function submitManualPost() {
  var pageId = state.currentModalPageId;
  var caption = document.getElementById('modalCaption').value.trim();
  var scheduleTime = document.getElementById('modalScheduleTime').value;

  var btn = document.getElementById('modalPostBtn');
  btn.disabled = true;
  btn.textContent = scheduleTime ? 'ກຳລັງກຳນົດເວລາ…' : 'ກຳລັງໂພດ…';

  setCardStatus(pageId, 'posting', scheduleTime ? 'ກຳລັງກຳນົດເວລາ…' : 'ກຳລັງໂພດ…');

  navigateTo('office');

  runOfficeWorkflowAnimation(pageId, !caption).then(function() {
    return apiPost({ action: 'manualPost', pageId: pageId, customCaption: caption, scheduleTime: scheduleTime });
  }).then(function(res) {
    if (res.success) {
      setCardStatus(pageId, 'success', '✅ ໂພດສຳເລັດແລ້ວ!');
      setOfficeAllDone(pageId);
      showToast(res.message || 'ໂພດສຳເລັດ!', 'success');
      closeModal('pageModal');
      setTimeout(function() {
        clearCardStatus(pageId);
        refreshDashboard();
      }, 3000);
    } else {
      setCardStatus(pageId, 'error', '❌ ' + (res.message || 'ໂພດບໍ່ສຳເລັດ'));
      setOfficeError(pageId, res.message);
      showToast(res.message || 'ໂພດບໍ່ສຳເລັດ', 'error');
      setTimeout(function() { clearCardStatus(pageId); }, 4000);
    }
  }).catch(function(err) {
    setCardStatus(pageId, 'error', '❌ Error: ' + err.message);
    setOfficeError(pageId, err.message);
    showToast('ຜິດພາດ: ' + err.message, 'error');
    setTimeout(function() { clearCardStatus(pageId); }, 4000);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = scheduleTime ? 'ກຳນົດເວລາ' : 'ໂພດດຽວນີ້';
  });
}

// ── ຟັງຊັ້ນສະແດງ Status ໃນ Card ──────────────────────────────
function setCardStatus(pageId, type, message) {
  var card = document.getElementById('card-' + pageId);
  if (!card) return;
  var statusEl = card.querySelector('.card-live-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'card-live-status';
    var body = card.querySelector('.page-card-body');
    if (body) body.insertBefore(statusEl, body.firstChild);
  }
  var colors = { posting: '#f59e0b', success: '#10b981', error: '#ef4444' };
  statusEl.style.cssText = 'padding:8px 12px;border-radius:6px;font-size:12.5px;font-weight:600;margin-bottom:10px;background:' + colors[type] + '18;border:1px solid ' + colors[type] + '44;color:' + colors[type] + ';display:flex;align-items:center;gap:8px;animation:pulse 1.5s infinite;';
  if (type === 'posting') {
    statusEl.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> ' + escHtml(message);
  } else {
    statusEl.textContent = message;
    statusEl.style.animation = 'none';
  }
}

function clearCardStatus(pageId) {
  var card = document.getElementById('card-' + pageId);
  if (!card) return;
  var el = card.querySelector('.card-live-status');
  if (el) el.remove();
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// ============================================================
//  ຫ້ອງການເຮັດວຽກ — OFFICE WORKFLOW ANIMATION
//  ປົກກະຕິ (ບໍ່ມີຄຳສັ່ງ): ພະນັກງານທຸກພະແນກຍ່າງເລາະຫຼີ້ນ (idle)
//  ເມື່ອມີຄຳສັ່ງ: ພະນັກງານຍ່າງຖືແຟ້ມເອກະສານ ເຮັດວຽກທີລະພະແນກ
// ============================================================

var OFFICE_DEPARTMENTS = [
  { key: 'fetch',   title: 'ພະແນກ 1 — ຄັງຮູບ',       subtitle: 'ດຶງຮູບຈາກ Google Drive', icon: 'folder' },
  { key: 'ai',      title: 'ພະແນກ 2 — ການຕະຫຼາດ AI',  subtitle: 'Gemini AI ຂຽນແຄບຊັ້ນ',    icon: 'brain' },
  { key: 'publish', title: 'ພະແນກ 3 — ສື່ສານ',        subtitle: 'ໂພດໃສ່ Facebook',         icon: 'send' },
  { key: 'archive', title: 'ພະແນກ 4 — ຈັດເກັບ',       subtitle: 'ຍ້າຍຮູບ + ບັນທຶກ Log',    icon: 'check' }
];

var officeIsBusy = false; // ກວດວ່າມີວຽກ Active ຢູ່ບໍ່ (ປິດ Idle ຊົ່ວຄາວ)

function characterSvg(icon, mood) {
  var skin = '#f4c89e';
  var shirt = mood === 'done' ? '#10b981' : mood === 'error' ? '#ef4444' : mood === 'working' ? '#4F46E5' : '#475569';
  var face;
  if (mood === 'done') {
    face = '<path d="M44 40 Q50 45 56 40" stroke="#1e293b" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="44" cy="36" r="1.4" fill="#1e293b"/><circle cx="56" cy="36" r="1.4" fill="#1e293b"/>';
  } else if (mood === 'error') {
    face = '<path d="M44 42 Q50 38 56 42" stroke="#1e293b" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="44" cy="36" r="1.4" fill="#1e293b"/><circle cx="56" cy="36" r="1.4" fill="#1e293b"/>';
  } else {
    face = '<circle cx="44" cy="36" r="1.4" fill="#1e293b"/><circle cx="56" cy="36" r="1.4" fill="#1e293b"/><path d="M46 42 Q50 44 54 42" stroke="#1e293b" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
  }
  var armRot = mood === 'working' ? 8 : 0;
  var folderHtml = (mood === 'working')
    ? '<rect x="58" y="48" width="16" height="12" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width="1" transform="rotate(-10 66 54)"/>'
    : '';
  return '<svg viewBox="0 0 100 100">' +
    '<rect x="10" y="72" width="80" height="8" rx="2" fill="#334155"/>' +
    '<rect x="14" y="80" width="6" height="14" fill="#1e293b"/>' +
    '<rect x="80" y="80" width="6" height="14" fill="#1e293b"/>' +
    '<rect x="38" y="50" width="24" height="18" rx="2" fill="#0f1825" stroke="#475569" stroke-width="1.5"/>' +
    '<rect x="41" y="53" width="18" height="11" fill="' + (mood === 'working' ? '#4F46E5' : '#1e3050') + '" opacity="' + (mood === 'working' ? '0.9' : '0.5') + '"/>' +
    '<rect x="47" y="68" width="6" height="4" fill="#475569"/>' +
    '<ellipse cx="50" cy="60" rx="16" ry="14" fill="' + shirt + '"/>' +
    '<circle cx="50" cy="38" r="13" fill="' + skin + '"/>' +
    '<path d="M37 34 Q37 24 50 24 Q63 24 63 34 L63 30 Q50 22 37 30 Z" fill="#3a2a1a"/>' +
    face +
    '<rect x="34" y="55" width="6" height="14" rx="3" fill="' + skin + '" transform="rotate(' + (-armRot) + ' 37 55)"/>' +
    '<rect x="60" y="55" width="6" height="14" rx="3" fill="' + skin + '" transform="rotate(' + armRot + ' 63 55)"/>' +
    folderHtml +
  '</svg>';
}

function renderOfficeRoom() {
  var room = document.getElementById('officeRoom');
  if (!room) return;

  room.innerHTML = OFFICE_DEPARTMENTS.map(function(dept, idx) {
    return '<div class="office-desk" id="desk-' + dept.key + '">' +
      '<div class="office-desk-header">' +
        '<div class="office-desk-num">' + (idx + 1) + '</div>' +
        '<div><div class="office-desk-title">' + dept.title + '</div><div class="office-desk-subtitle">' + dept.subtitle + '</div></div>' +
      '</div>' +
      '<div class="office-scene">' +
        '<div class="office-character idle-walking" id="char-' + dept.key + '">' + characterSvg(dept.icon, 'idle') + '</div>' +
        '<div class="office-status-badge idle" id="badge-' + dept.key + '">ບໍ່ມີຄຳສັ່ງ — ພັກຢູ່</div>' +
        '<div class="office-task-text" id="task-' + dept.key + '"></div>' +
        '<div class="office-progress-track"><div class="office-progress-fill" id="progress-' + dept.key + '"></div></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── ໃຫ້ພະນັກງານຍ່າງເລາະຫຼີ້ນຕອນບໍ່ມີຄຳສັ່ງ (Idle Loop) ──────────
function startIdleOfficeAnimation() {
  // ໃສ່ class idle-walking ໃຫ້ທຸກຕົວທີ່ບໍ່ໄດ້ Busy ຢູ່
  setInterval(function() {
    if (officeIsBusy) return;
    OFFICE_DEPARTMENTS.forEach(function(dept) {
      var char = document.getElementById('char-' + dept.key);
      if (char && !char.classList.contains('idle-walking')) {
        char.classList.add('idle-walking');
      }
    });
  }, 1000);
}

function setDeskState(key, mood, badgeText, badgeClass, taskText, progress) {
  var char = document.getElementById('char-' + key);
  var badge = document.getElementById('badge-' + key);
  var task = document.getElementById('task-' + key);
  var prog = document.getElementById('progress-' + key);
  var desk = document.getElementById('desk-' + key);
  if (char) {
    var dept = OFFICE_DEPARTMENTS.find(function(d) { return d.key === key; });
    char.innerHTML = characterSvg(dept.icon, mood);
    char.classList.remove('idle-walking', 'carrying');
    if (mood === 'working') {
      char.classList.add('carrying');
    }
  }
  if (badge) {
    badge.className = 'office-status-badge ' + badgeClass;
    badge.textContent = badgeText;
  }
  if (task) task.textContent = taskText || '';
  if (prog) prog.style.width = (progress || 0) + '%';
  if (desk) desk.classList.toggle('active-desk', mood === 'working');
}

function resetDeskToIdle(key) {
  var char = document.getElementById('char-' + key);
  var badge = document.getElementById('badge-' + key);
  var task = document.getElementById('task-' + key);
  var prog = document.getElementById('progress-' + key);
  var desk = document.getElementById('desk-' + key);
  if (char) {
    var dept = OFFICE_DEPARTMENTS.find(function(d) { return d.key === key; });
    char.innerHTML = characterSvg(dept.icon, 'idle');
    char.classList.remove('carrying');
    char.classList.add('idle-walking');
  }
  if (badge) { badge.className = 'office-status-badge idle'; badge.textContent = 'ບໍ່ມີຄຳສັ່ງ — ພັກຢູ່'; }
  if (task) task.textContent = '';
  if (prog) prog.style.width = '0%';
  if (desk) desk.classList.remove('active-desk');
}

function runOfficeWorkflowAnimation(pageId, usingAI) {
  var page = state.pages.find(function(p) { return p.id == pageId; });
  var pageName = page ? page.name : ('ເພຈ ' + pageId);

  officeIsBusy = true;
  renderOfficeRoom();

  return sleep(150)
    .then(function() {
      setDeskState('fetch', 'working', '📂 ກຳລັງເຮັດວຽກ', 'working', 'ກຳລັງຍ່າງໄປເອົາແຟ້ມຮູບສຳລັບ ' + pageName + '…', 30);
      return sleep(500);
    })
    .then(function() {
      setDeskState('fetch', 'working', '📂 ກຳລັງເຮັດວຽກ', 'working', 'ພົບແຟ້ມຮູບແລ້ວ ກຳລັງຖືອອກມາ…', 80);
      return sleep(500);
    })
    .then(function() {
      setDeskState('fetch', 'done', '✓ ສຳເລັດ', 'done', 'ສົ່ງແຟ້ມຮູບໄປພະແນກ AI ແລ້ວ', 100);
      if (usingAI) {
        setDeskState('ai', 'working', '🧠 ກຳລັງເຮັດວຽກ', 'working', 'ໄດ້ຮັບແຟ້ມຮູບ ກຳລັງວິເຄາະ…', 25);
        return sleep(600);
      } else {
        setDeskState('ai', 'done', 'ຂ້າມ', 'idle', 'ໃຊ້ແຄບຊັ້ນທີ່ຜູ້ໃຊ້ຂຽນເອງ', 100);
        return sleep(300);
      }
    })
    .then(function() {
      if (usingAI) {
        setDeskState('ai', 'working', '🧠 ກຳລັງເຮັດວຽກ', 'working', 'ກຳລັງຂຽນແຄບຊັ້ນພາສາລາວ…', 65);
        return sleep(700);
      }
    })
    .then(function() {
      if (usingAI) setDeskState('ai', 'done', '✓ ສຳເລັດ', 'done', 'ຂຽນແຄບຊັ້ນແລ້ວ ສົ່ງແຟ້ມຕໍ່ໄປພະແນກສື່ສານ', 100);
      setDeskState('publish', 'working', '📤 ກຳລັງເຮັດວຽກ', 'working', 'ໄດ້ຮັບແຟ້ມແລ້ວ ກຳລັງສົ່ງຂໍ້ມູນໄປ Facebook…', 40);
      return sleep(700);
    })
    .then(function() {
      setDeskState('publish', 'working', '📤 ກຳລັງເຮັດວຽກ', 'working', 'ກຳລັງລໍຖ້າຄຳຕອບຈາກ Facebook…', 85);
      return sleep(500);
    })
    .then(function() {
      setDeskState('archive', 'working', '🗂️ ກຳລັງເຮັດວຽກ', 'working', 'ກຳລັງລໍຖ້າຜົນການໂພດ…', 50);
    });
}

function setOfficeAllDone(pageId) {
  setDeskState('publish', 'done', '✓ ສຳເລັດ', 'done', 'ໂພດສຳເລັດແລ້ວ ສົ່ງແຟ້ມຕໍ່ໄປຈັດເກັບ', 100);
  setDeskState('archive', 'done', '✓ ສຳເລັດ', 'done', 'ຍ້າຍຮູບ ແລະ ບັນທຶກ Log ສຳເລັດ — ວຽກຮອບນີ້ຈົບສົມບູນ', 100);

  // ຫຼັງສຳເລັດ → ກັບເຂົ້າ Idle ຫຼັງຈາກ 4 ວິ
  setTimeout(function() {
    officeIsBusy = false;
    OFFICE_DEPARTMENTS.forEach(function(d) { resetDeskToIdle(d.key); });
  }, 4000);
}

function setOfficeError(pageId, message) {
  setDeskState('publish', 'error', '✗ ຜິດພາດ', 'error', message || 'ເກີດຂໍ້ຜິດພາດ', 100);
  setDeskState('archive', 'idle', 'ຢຸດແລ້ວ', 'idle', 'ບໍ່ໄດ້ດຳເນີນການຕໍ່ ເພາະພະແນກກ່ອນໜ້າຜິດພາດ', 0);

  setTimeout(function() {
    officeIsBusy = false;
    OFFICE_DEPARTMENTS.forEach(function(d) { resetDeskToIdle(d.key); });
  }, 5000);
}

// ── MODAL: PAGE SETTINGS ─────────────────────────────────────
function openSettingsModal(pageId) {
  var page = state.pages.find(function(p) { return p.id == pageId; });
  if (!page) return;

  document.getElementById('settingsPageId').value = pageId;
  document.getElementById('settingsModalTitle').textContent = page.name + ' — ຕັ້ງຄ່າເພຈ';
  document.getElementById('settingsPostsPerDay').value = page.postsPerDay || 1;
  document.getElementById('settingsPhone').value = page.phone || '';
  document.getElementById('settingsBrandVoice').value = page.brandVoice || '';
  document.getElementById('settingsLogoUrl').value = page.logoUrl || '';
  previewSettingsLogo();

  var times = Array.isArray(page.postTimes) && page.postTimes.length ? page.postTimes : ['09:00'];
  document.getElementById('timeSlots').innerHTML = '';
  times.forEach(function(t) { addTimeSlot(t); });

  state.settingsToggleOn = !!page.autoPostEnabled;
  document.getElementById('settingsToggle').classList.toggle('on', state.settingsToggleOn);

  openModal('settingsModal');
}

// ── ປ່ຽນລິ້ງ Google Drive ໃດໆ ໃຫ້ເປັນລິ້ງສະແດງຮູບ (thumbnail) ──
function convertDriveLink(url) {
  if (!url) return '';
  url = url.trim();
  var m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) {
    return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w300';
  }
  return url; // ບໍ່ແມ່ນລິ້ງ Drive ມາດຕະຖານ → ໃຊ້ຄືເກົ່າ
}

function previewSettingsLogo() {
  var rawUrl = document.getElementById('settingsLogoUrl').value;
  var img = document.getElementById('settingsLogoPreviewImg');
  var fallback = document.getElementById('settingsLogoPreviewFallback');
  var converted = convertDriveLink(rawUrl);
  if (converted) {
    img.src = converted;
    img.style.display = 'block';
    fallback.style.display = 'none';
    img.onerror = function() {
      img.style.display = 'none';
      fallback.style.display = 'block';
    };
  } else {
    img.style.display = 'none';
    fallback.style.display = 'block';
  }
}

function addTimeSlot(value, containerId) {
  value = value || '09:00';
  containerId = containerId || 'timeSlots';
  var container = document.getElementById(containerId);
  var item = document.createElement('div');
  item.className = 'time-slot-item';
  item.innerHTML = '<input type="time" class="time-slot-input" value="' + value + '" /><button class="time-slot-remove" onclick="this.parentElement.remove()">&times;</button>';
  container.appendChild(item);
}

function addMasterTimeSlot() { addTimeSlot('09:00', 'masterTimeSlots'); }

function toggleSettingsSwitch() {
  state.settingsToggleOn = !state.settingsToggleOn;
  document.getElementById('settingsToggle').classList.toggle('on', state.settingsToggleOn);
}

function submitSettings() {
  var pageId = document.getElementById('settingsPageId').value;
  var postsPerDay = parseInt(document.getElementById('settingsPostsPerDay').value) || 1;
  var autoPostEnabled = state.settingsToggleOn;
  var phone = document.getElementById('settingsPhone').value.trim();
  var brandVoice = document.getElementById('settingsBrandVoice').value.trim();
  var logoUrlRaw = document.getElementById('settingsLogoUrl').value.trim();
  var logoUrl = convertDriveLink(logoUrlRaw);

  var timeInputs = document.querySelectorAll('#timeSlots .time-slot-input');
  var postTimes = Array.from(timeInputs).map(function(i) { return i.value; }).filter(Boolean);

  if (!postTimes.length) { showToast('ກະລຸນາເພີ່ມເວລາໂພດຢ່າງໜ້ອຍໜຶ່ງເວລາ', 'error'); return; }

  apiPost({
    action: 'saveSettings',
    pageId: pageId,
    postsPerDay: postsPerDay,
    postTimes: postTimes,
    autoPostEnabled: autoPostEnabled,
    phone: phone,
    brandVoice: brandVoice,
    logoUrl: logoUrl
  })
    .then(function(res) {
      if (res.success) {
        showToast(res.message || 'ບັນທຶກສຳເລັດ!', 'success');
        closeModal('settingsModal');
        refreshDashboard();
      } else {
        showToast(res.message || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    })
    .catch(function(err) { showToast('ຜິດພາດ: ' + err.message, 'error'); });
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

function submitMasterApply() {
  var postsPerDay = parseInt(document.getElementById('masterPostsPerDay').value) || 1;
  var autoPostEnabled = state.masterToggleOn;

  var timeInputs = document.querySelectorAll('#masterTimeSlots .time-slot-input');
  var postTimes = Array.from(timeInputs).map(function(i) { return i.value; }).filter(Boolean);

  if (!postTimes.length) { showToast('ກະລຸນາເພີ່ມເວລາໂພດຢ່າງໜ້ອຍໜຶ່ງເວລາ', 'error'); return; }

  apiPost({ action: 'applyToAll', postsPerDay: postsPerDay, postTimes: postTimes, autoPostEnabled: autoPostEnabled })
    .then(function(res) {
      if (res.success) {
        showToast('ນຳໃຊ້ການຕັ້ງຄ່າກັບທັງ 3 ເພຈສຳເລັດ!', 'success');
        closeModal('masterModal');
        refreshDashboard();
      } else {
        showToast(res.message || 'ນຳໃຊ້ບໍ່ສຳເລັດ', 'error');
      }
    })
    .catch(function(err) { showToast('ຜິດພາດ: ' + err.message, 'error'); });
}

// ── MODAL: MANUAL SCHEDULE ───────────────────────────────────
function openManualPostModal() {
  var select = document.getElementById('manualPageId');
  select.innerHTML = state.pages.map(function(p) { return '<option value="' + p.id + '">' + escHtml(p.name) + '</option>'; }).join('');
  document.getElementById('manualCaption').value = '';
  var dt = new Date(Date.now() + 3600000);
  document.getElementById('manualScheduleTime').value = dt.toISOString().slice(0, 16);
  openModal('manualPostModal');
}

function submitManualSchedule() {
  var pageId = document.getElementById('manualPageId').value;
  var caption = document.getElementById('manualCaption').value.trim();
  var scheduleTime = document.getElementById('manualScheduleTime').value;

  if (!scheduleTime) { showToast('ກະລຸນາເລືອກວັນ ແລະ ເວລາ', 'error'); return; }

  apiPost({ action: 'manualPost', pageId: pageId, customCaption: caption, scheduleTime: scheduleTime })
    .then(function(res) {
      if (res.success) {
        showToast(res.message || 'ກຳນົດເວລາສຳເລັດ!', 'success');
        closeModal('manualPostModal');
        renderScheduleView();
      } else {
        showToast(res.message || 'ກຳນົດເວລາບໍ່ສຳເລັດ', 'error');
      }
    })
    .catch(function(err) { showToast('ຜິດພາດ: ' + err.message, 'error'); });
}

// ── MODAL HELPERS ────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST ────────────────────────────────────────────────────
var toastTimer;
function showToast(msg, type) {
  type = type || 'info';
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

// ── UTILITIES ────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRelTime(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  if (isNaN(d)) return ts;
  var diff = Date.now() - d.getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ຫາກໍ່ນີ້';
  if (mins < 60) return mins + ' ນາທີກ່ອນ';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' ຊົ່ວໂມງກ່ອນ';
  return d.toLocaleDateString('lo-LA');
}

function formatDateTime(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleString('lo-LA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}