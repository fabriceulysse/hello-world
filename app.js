// ============================================================
// Track Coach Hub — app.js
// All data stored in localStorage. No server required.
// ============================================================

const EVENTS = [
  '100m', '200m', '400m', '800m', '1500m', '1600m', '3000m', '3200m',
  '5000m', '10000m', '100m Hurdles', '110m Hurdles', '300m Hurdles',
  '400m Hurdles', 'Steeplechase', '4x100m Relay', '4x400m Relay',
  'Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault',
  'Shot Put', 'Discus', 'Javelin', 'Hammer',
  'Pentathlon', 'Heptathlon', 'Decathlon'
];

// ============================================================
// DATA LAYER
// ============================================================

const DB = {
  _get(key)     { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  _set(key, d)  { localStorage.setItem(key, JSON.stringify(d)); },
  athletes()    { return this._get('ch_athletes'); },
  saveAthletes(d){ this._set('ch_athletes', d); },
  attendance()  { return this._get('ch_attendance'); },
  saveAttendance(d){ this._set('ch_attendance', d); },
  plans()       { return this._get('ch_plans'); },
  savePlans(d)  { this._set('ch_plans', d); },
  results()     { return this._get('ch_results'); },
  saveResults(d){ this._set('ch_results', d); },
  goals()       { return this._get('ch_goals'); },
  saveGoals(d)  { this._set('ch_goals', d); },
};

// ============================================================
// HELPERS
// ============================================================

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return m + '/' + d + '/' + y;
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// APP
// ============================================================

const App = {
  _attStatuses: {},
  currentPlanDrills: [],
  selectedEvents: [],
  resultTab: 'all',
  goalTab: 'active',
  attTab: 'history',

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------

  init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });

    document.getElementById('today-date').textContent =
      new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    this._buildEventChips();
    this.navigate('dashboard');
  },

  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + page).classList.remove('hidden');
    document.querySelector('[data-page="' + page + '"]').classList.add('active');
    this._renderPage(page);
  },

  _renderPage(page) {
    if (page === 'dashboard')  this.renderDashboard();
    if (page === 'roster')     this.renderRoster();
    if (page === 'attendance') this.renderAttendance();
    if (page === 'plans')      this.renderPlans();
    if (page === 'results')    this.renderResults();
    if (page === 'goals')      this.renderGoals();
  },

  closeModal(id) { document.getElementById(id).classList.add('hidden'); },
  openModal(id)  { document.getElementById(id).classList.remove('hidden'); },

  // ----------------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------------

  renderDashboard() {
    const athletes  = DB.athletes();
    const sessions  = DB.attendance();
    const results   = DB.results();
    const goals     = DB.goals();

    const totalPRs     = results.filter(r => r.isPR).length;
    const activeGoals  = goals.filter(g => !g.achieved).length;

    document.getElementById('dashboard-stats').innerHTML =
      this._statCard(athletes.length, 'Athletes') +
      this._statCard(sessions.length, 'Sessions Logged') +
      this._statCard(totalPRs, 'Personal Records') +
      this._statCard(activeGoals, 'Active Goals');

    // Recent results
    const recentResults = [...results].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const el = document.getElementById('recent-results');
    if (!recentResults.length) {
      el.innerHTML = '<p class="text-muted text-sm">No results logged yet.</p>';
    } else {
      el.innerHTML = recentResults.map(r => {
        const a = athletes.find(x => x.id === r.athleteId);
        return '<div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<div>' +
            '<strong style="font-size:14px;">' + esc(a ? a.name : '—') + '</strong>' +
            ' <span class="event-tag">' + esc(r.event) + '</span>' +
            (r.isPR ? ' <span class="badge badge-pr">PR</span>' : '') +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-weight:600;font-size:14px;">' + esc(r.value) + '</div>' +
            '<div class="text-muted" style="font-size:11px;">' + fmt(r.date) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Active goals
    const activeList = goals.filter(g => !g.achieved).slice(0, 6);
    const gel = document.getElementById('active-goals-dash');
    if (!activeList.length) {
      gel.innerHTML = '<p class="text-muted text-sm">No active goals set.</p>';
    } else {
      gel.innerHTML = activeList.map(g => {
        const a = athletes.find(x => x.id === g.athleteId);
        return '<div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<div>' +
            '<strong style="font-size:14px;">' + esc(a ? a.name : '—') + '</strong>' +
            ' <span class="event-tag">' + esc(g.event) + '</span>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-weight:600;font-size:14px;">' + esc(g.target) + '</div>' +
            (g.deadline ? '<div class="text-muted" style="font-size:11px;">by ' + fmt(g.deadline) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Recent attendance
    const recentAtt = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const ael = document.getElementById('recent-attendance-dash');
    if (!recentAtt.length) {
      ael.innerHTML = '<p class="text-muted text-sm">No attendance recorded yet.</p>';
    } else {
      ael.innerHTML = '<table style="width:100%;font-size:14px;">' +
        '<thead><tr>' +
        '<th style="text-align:left;padding:7px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Date</th>' +
        '<th style="text-align:left;padding:7px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Type</th>' +
        '<th style="text-align:left;padding:7px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Focus / Meet</th>' +
        '<th style="text-align:left;padding:7px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Attendance</th>' +
        '</tr></thead><tbody>' +
        recentAtt.map(s => {
          const present = s.records.filter(r => r.status === 'present').length;
          return '<tr>' +
            '<td style="padding:7px 10px;border-bottom:1px solid var(--border);">' + fmt(s.date) + '</td>' +
            '<td style="padding:7px 10px;border-bottom:1px solid var(--border);"><span class="badge ' + (s.type === 'meet' ? 'badge-info' : 'badge-gray') + '">' + s.type + '</span></td>' +
            '<td style="padding:7px 10px;border-bottom:1px solid var(--border);">' + esc(s.meetName || s.focus || '—') + '</td>' +
            '<td style="padding:7px 10px;border-bottom:1px solid var(--border);">' + present + ' / ' + s.records.length + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';
    }
  },

  _statCard(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  },

  // ----------------------------------------------------------
  // ROSTER
  // ----------------------------------------------------------

  _buildEventChips() {
    const grid = document.getElementById('athlete-events-grid');
    grid.innerHTML = EVENTS.map(e =>
      '<div class="event-chip" data-event="' + esc(e) + '" onclick="App._toggleEventChip(\'' + esc(e) + '\')">' + esc(e) + '</div>'
    ).join('');
  },

  _toggleEventChip(event) {
    const chip = document.querySelector('.event-chip[data-event="' + event + '"]');
    const idx = this.selectedEvents.indexOf(event);
    if (idx === -1) {
      this.selectedEvents.push(event);
      chip.classList.add('selected');
    } else {
      this.selectedEvents.splice(idx, 1);
      chip.classList.remove('selected');
    }
  },

  renderRoster() {
    const athletes = DB.athletes();
    const results  = DB.results();
    const search   = (document.getElementById('roster-search') || {}).value || '';

    const filtered = athletes.filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );

    const tbody = document.getElementById('roster-tbody');
    const empty = document.getElementById('roster-empty');

    if (!filtered.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = filtered.map(a => {
      const prCount = results.filter(r => r.athleteId === a.id && r.isPR).length;
      const evList  = (a.events || []).slice(0, 4).map(e => '<span class="event-tag" style="margin:2px;">' + esc(e) + '</span>').join('') +
                      ((a.events || []).length > 4 ? '<span class="text-muted text-sm"> +' + ((a.events || []).length - 4) + '</span>' : '');
      return '<tr>' +
        '<td><strong>' + esc(a.name) + '</strong></td>' +
        '<td>' + esc(a.grade || '—') + '</td>' +
        '<td>' + (evList || '<span class="text-muted">—</span>') + '</td>' +
        '<td>' + (prCount > 0 ? '<span class="badge badge-pr">' + prCount + ' PR' + (prCount !== 1 ? 's' : '') + '</span>' : '—') + '</td>' +
        '<td><div class="flex gap-2">' +
          '<button class="btn btn-outline btn-sm" onclick="App.viewAthlete(\'' + a.id + '\')">View</button>' +
          '<button class="btn btn-outline btn-sm" onclick="App.openEditAthlete(\'' + a.id + '\')">Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="App.deleteAthlete(\'' + a.id + '\')">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  },

  openAddAthlete() {
    document.getElementById('athlete-id').value = '';
    document.getElementById('athlete-name').value = '';
    document.getElementById('athlete-grade').value = '';
    document.getElementById('athlete-notes').value = '';
    document.getElementById('athlete-modal-title').textContent = 'Add Athlete';
    this.selectedEvents = [];
    document.querySelectorAll('.event-chip').forEach(c => c.classList.remove('selected'));
    this.openModal('modal-athlete');
  },

  openEditAthlete(id) {
    const a = DB.athletes().find(x => x.id === id);
    if (!a) return;
    document.getElementById('athlete-id').value = a.id;
    document.getElementById('athlete-name').value = a.name;
    document.getElementById('athlete-grade').value = a.grade || '';
    document.getElementById('athlete-notes').value = a.notes || '';
    document.getElementById('athlete-modal-title').textContent = 'Edit Athlete';
    this.selectedEvents = [...(a.events || [])];
    document.querySelectorAll('.event-chip').forEach(c => {
      c.classList.toggle('selected', (a.events || []).includes(c.dataset.event));
    });
    this.openModal('modal-athlete');
  },

  saveAthlete() {
    const name = document.getElementById('athlete-name').value.trim();
    if (!name) { alert('Name is required.'); return; }

    const athletes = DB.athletes();
    const id = document.getElementById('athlete-id').value;
    const data = {
      name,
      grade:  document.getElementById('athlete-grade').value,
      events: [...this.selectedEvents],
      notes:  document.getElementById('athlete-notes').value.trim(),
    };

    if (id) {
      const idx = athletes.findIndex(a => a.id === id);
      athletes[idx] = Object.assign({}, athletes[idx], data);
    } else {
      athletes.push(Object.assign({ id: uid(), createdAt: today() }, data));
    }

    DB.saveAthletes(athletes);
    this.closeModal('modal-athlete');
    this.renderRoster();
    this._refreshAthleteSelects();
  },

  deleteAthlete(id) {
    if (!confirm('Delete this athlete and all their records? This cannot be undone.')) return;
    DB.saveAthletes(DB.athletes().filter(a => a.id !== id));
    DB.saveResults(DB.results().filter(r => r.athleteId !== id));
    DB.saveGoals(DB.goals().filter(g => g.athleteId !== id));
    DB.saveAttendance(DB.attendance().map(s => {
      s.records = s.records.filter(r => r.athleteId !== id);
      return s;
    }));
    this.renderRoster();
    this._refreshAthleteSelects();
  },

  viewAthlete(id) {
    const a = DB.athletes().find(x => x.id === id);
    if (!a) return;

    const results    = DB.results().filter(r => r.athleteId === id);
    const goals      = DB.goals().filter(g => g.athleteId === id);
    const sessions   = DB.attendance();

    let total = 0, present = 0;
    sessions.forEach(s => {
      const rec = s.records.find(r => r.athleteId === id);
      if (rec) { total++; if (rec.status === 'present') present++; }
    });

    // PRs per event
    const prsByEvent = {};
    results.filter(r => r.isPR).forEach(r => { prsByEvent[r.event] = r; });

    const prKeys = Object.keys(prsByEvent);

    let html = '<div class="grid-3 mb-2">' +
      this._statCard(total, 'Sessions') +
      this._statCard(total ? Math.round((present / total) * 100) + '%' : '—', 'Attendance Rate') +
      this._statCard(prKeys.length, 'Events w/ PR') +
      '</div>';

    html += '<div class="card mb-2" style="padding:16px;">' +
      '<div class="card-header"><span class="card-title">Profile</span></div>' +
      '<p><strong>Grade:</strong> ' + esc(a.grade || '—') + '</p>' +
      '<p class="mt-1"><strong>Events:</strong> ' + ((a.events || []).map(e => '<span class="event-tag" style="margin:2px;">' + esc(e) + '</span>').join('') || '—') + '</p>' +
      (a.notes ? '<p class="mt-1"><strong>Notes:</strong> ' + esc(a.notes) + '</p>' : '') +
      '</div>';

    if (prKeys.length) {
      html += '<div class="card mb-2" style="padding:16px;"><div class="card-header"><span class="card-title">Personal Records</span></div>' +
        '<table style="width:100%;font-size:14px;">' +
        '<thead><tr>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Event</th>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Mark</th>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Date</th>' +
        '</tr></thead><tbody>' +
        prKeys.map(evt => {
          const r = prsByEvent[evt];
          return '<tr>' +
            '<td style="padding:6px 10px;border-bottom:1px solid var(--border);"><span class="event-tag">' + esc(evt) + '</span></td>' +
            '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:700;">' + esc(r.value) + '</td>' +
            '<td style="padding:6px 10px;border-bottom:1px solid var(--border);">' + fmt(r.date) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    if (results.length) {
      const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
      html += '<div class="card mb-2" style="padding:16px;"><div class="card-header"><span class="card-title">Recent Results</span></div>' +
        '<table style="width:100%;font-size:14px;">' +
        '<thead><tr>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Date</th>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Event</th>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Mark</th>' +
        '<th style="text-align:left;padding:6px 10px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">Type</th>' +
        '</tr></thead><tbody>' +
        sorted.map(r => '<tr>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);">' + fmt(r.date) + '</td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);"><span class="event-tag">' + esc(r.event) + '</span></td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:600;">' + esc(r.value) + (r.isPR ? ' <span class="badge badge-pr">PR</span>' : '') + '</td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);"><span class="badge ' + (r.type === 'meet' ? 'badge-info' : 'badge-gray') + '">' + r.type + '</span></td>' +
        '</tr>').join('') +
        '</tbody></table></div>';
    }

    if (goals.length) {
      html += '<div class="card" style="padding:16px;"><div class="card-header"><span class="card-title">Goals</span></div>' +
        goals.map(g =>
          '<div class="goal-item ' + (g.achieved ? 'goal-achieved' : '') + '">' +
            '<div class="goal-header">' +
              '<div><span class="event-tag">' + esc(g.event) + '</span> <strong style="margin-left:6px;">' + esc(g.target) + '</strong></div>' +
              '<span class="badge ' + (g.achieved ? 'badge-success' : 'badge-warning') + '">' + (g.achieved ? 'Achieved' : 'Active') + '</span>' +
            '</div>' +
            (g.deadline ? '<div class="text-muted text-sm">Target: ' + fmt(g.deadline) + '</div>' : '') +
            (g.notes ? '<div class="text-sm mt-1">' + esc(g.notes) + '</div>' : '') +
          '</div>'
        ).join('') +
        '</div>';
    }

    document.getElementById('view-athlete-name').textContent = a.name;
    document.getElementById('view-athlete-body').innerHTML = html;
    this.openModal('modal-view-athlete');
  },

  _refreshAthleteSelects() {
    const athletes = DB.athletes();
    const opts = athletes.map(a => '<option value="' + a.id + '">' + esc(a.name) + '</option>').join('');
    ['result-athlete', 'goal-athlete'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const cur = el.value;
      el.innerHTML = '<option value="">-- Select Athlete --</option>' + opts;
      el.value = cur;
    });
    const f = document.getElementById('results-athlete-filter');
    if (f) {
      const cur = f.value;
      f.innerHTML = '<option value="">All Athletes</option>' + opts;
      f.value = cur;
    }
  },

  // ----------------------------------------------------------
  // ATTENDANCE
  // ----------------------------------------------------------

  switchAttTab(tab) {
    this.attTab = tab;
    document.querySelectorAll('#page-attendance .page-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#page-attendance .page-tab[onclick*="' + tab + '"]').classList.add('active');
    document.getElementById('att-tab-history').classList.toggle('hidden', tab !== 'history');
    document.getElementById('att-tab-summary').classList.toggle('hidden', tab !== 'summary');
    if (tab === 'summary') this._renderAttSummary();
  },

  renderAttendance() {
    const sessions = [...DB.attendance()].sort((a, b) => b.date.localeCompare(a.date));
    const tbody = document.getElementById('att-tbody');
    const empty = document.getElementById('att-empty');

    if (!sessions.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      tbody.innerHTML = sessions.map(s => {
        const present = s.records.filter(r => r.status === 'present').length;
        const absent  = s.records.filter(r => r.status === 'absent').length;
        const excused = s.records.filter(r => r.status === 'excused').length;
        const injured = s.records.filter(r => r.status === 'injured').length;
        return '<tr>' +
          '<td>' + fmt(s.date) + '</td>' +
          '<td><span class="badge ' + (s.type === 'meet' ? 'badge-info' : 'badge-gray') + '">' + s.type + '</span></td>' +
          '<td>' + esc(s.meetName || s.focus || '—') + '</td>' +
          '<td><span class="badge badge-success">' + present + '</span></td>' +
          '<td><span class="badge badge-danger">' + absent + '</span></td>' +
          '<td><span class="badge badge-warning">' + excused + '</span></td>' +
          '<td><span class="badge badge-purple">' + injured + '</span></td>' +
          '<td><div class="flex gap-2">' +
            '<button class="btn btn-outline btn-sm" onclick="App.viewAttSession(\'' + s.id + '\')">View</button>' +
            '<button class="btn btn-danger btn-sm" onclick="App.deleteAttSession(\'' + s.id + '\')">Delete</button>' +
          '</div></td>' +
        '</tr>';
      }).join('');
    }

    if (this.attTab === 'summary') this._renderAttSummary();
  },

  _renderAttSummary() {
    const athletes = DB.athletes();
    const sessions = DB.attendance();
    const tbody = document.getElementById('att-summary-tbody');
    const empty  = document.getElementById('att-summary-empty');

    if (!athletes.length) {
      tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = athletes.map(a => {
      let total = 0, present = 0, absent = 0, excused = 0, injured = 0;
      sessions.forEach(s => {
        const rec = s.records.find(r => r.athleteId === a.id);
        if (!rec) return;
        total++;
        if (rec.status === 'present') present++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'excused') excused++;
        else if (rec.status === 'injured') injured++;
      });
      const rate = total ? Math.round((present / total) * 100) : 0;
      const cls  = rate >= 90 ? 'badge-success' : rate >= 75 ? 'badge-warning' : 'badge-danger';
      return '<tr>' +
        '<td><strong>' + esc(a.name) + '</strong></td>' +
        '<td>' + total + '</td>' +
        '<td>' + present + '</td>' +
        '<td>' + absent + '</td>' +
        '<td>' + excused + '</td>' +
        '<td>' + injured + '</td>' +
        '<td><span class="badge ' + cls + '">' + (total ? rate + '%' : '—') + '</span></td>' +
      '</tr>';
    }).join('');
  },

  openTakeAttendance() {
    const athletes = DB.athletes();
    if (!athletes.length) { alert('Add athletes to the roster first.'); return; }

    document.getElementById('att-date').value = today();
    document.getElementById('att-type').value = 'practice';
    document.getElementById('att-focus').value = '';
    document.getElementById('att-meet-name').value = '';
    document.getElementById('att-meet-name-group').style.display = 'none';

    this._attStatuses = {};
    athletes.forEach(a => { this._attStatuses[a.id] = 'present'; });

    const list = document.getElementById('att-athlete-list');
    list.innerHTML = athletes.map(a =>
      '<div class="attendance-row" id="att-row-' + a.id + '">' +
        '<span class="attendance-athlete">' + esc(a.name) + '</span>' +
        '<div class="attendance-btns">' +
          '<button class="att-btn present selected" onclick="App._setAttStatus(\'' + a.id + '\', \'present\', this)">Present</button>' +
          '<button class="att-btn absent" onclick="App._setAttStatus(\'' + a.id + '\', \'absent\', this)">Absent</button>' +
          '<button class="att-btn excused" onclick="App._setAttStatus(\'' + a.id + '\', \'excused\', this)">Excused</button>' +
          '<button class="att-btn injured" onclick="App._setAttStatus(\'' + a.id + '\', \'injured\', this)">Injured</button>' +
        '</div>' +
      '</div>'
    ).join('');

    this.openModal('modal-attendance');
  },

  _setAttStatus(athleteId, status, btn) {
    this._attStatuses[athleteId] = status;
    const row = document.getElementById('att-row-' + athleteId);
    row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  },

  toggleAttMeetField() {
    const isMeet = document.getElementById('att-type').value === 'meet';
    document.getElementById('att-meet-name-group').style.display = isMeet ? 'block' : 'none';
  },

  saveAttendance() {
    const date = document.getElementById('att-date').value;
    if (!date) { alert('Date is required.'); return; }

    const athletes = DB.athletes();
    const records  = athletes.map(a => ({ athleteId: a.id, status: this._attStatuses[a.id] || 'present' }));

    const session = {
      id:       uid(),
      date,
      type:     document.getElementById('att-type').value,
      meetName: document.getElementById('att-meet-name').value.trim(),
      focus:    document.getElementById('att-focus').value.trim(),
      records,
    };

    const all = DB.attendance();
    all.push(session);
    DB.saveAttendance(all);
    this.closeModal('modal-attendance');
    this.renderAttendance();
  },

  viewAttSession(id) {
    const s = DB.attendance().find(x => x.id === id);
    if (!s) return;
    const athletes = DB.athletes();

    document.getElementById('view-att-title').textContent =
      (s.type === 'meet' ? 'Meet' : 'Practice') + ': ' + fmt(s.date) +
      (s.meetName ? ' — ' + s.meetName : s.focus ? ' — ' + s.focus : '');

    const groups = { present: [], absent: [], excused: [], injured: [] };
    s.records.forEach(r => {
      const a = athletes.find(x => x.id === r.athleteId);
      if (a && groups[r.status]) groups[r.status].push(a.name);
    });

    const labels = { present: 'Present', absent: 'Absent', excused: 'Excused', injured: 'Injured' };
    const badgeCls = { present: 'badge-success', absent: 'badge-danger', excused: 'badge-warning', injured: 'badge-purple' };

    document.getElementById('view-att-body').innerHTML = Object.keys(labels).map(k =>
      '<div class="card mb-1" style="padding:14px;">' +
        '<strong>' + labels[k] + ' (' + groups[k].length + ')</strong>' +
        '<div class="mt-1">' +
          (groups[k].length
            ? groups[k].map(n => '<span class="badge ' + badgeCls[k] + '" style="margin:2px;">' + esc(n) + '</span>').join('')
            : '<span class="text-muted text-sm">None</span>') +
        '</div>' +
      '</div>'
    ).join('');

    this.openModal('modal-view-attendance');
  },

  deleteAttSession(id) {
    if (!confirm('Delete this attendance record?')) return;
    DB.saveAttendance(DB.attendance().filter(s => s.id !== id));
    this.renderAttendance();
  },

  // ----------------------------------------------------------
  // PRACTICE PLANS
  // ----------------------------------------------------------

  renderPlans() {
    const plans = [...DB.plans()].sort((a, b) => b.date.localeCompare(a.date));
    const list  = document.getElementById('plans-list');
    const empty = document.getElementById('plans-empty');

    if (!plans.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = plans.map(p =>
      '<div class="card mb-2">' +
        '<div class="card-header">' +
          '<div>' +
            '<span style="font-weight:700;font-size:16px;">' + esc(p.title) + '</span>' +
            ' <span class="text-muted text-sm">' + fmt(p.date) + '</span>' +
            (p.focus ? ' <span class="badge badge-info" style="margin-left:6px;">' + esc(p.focus) + '</span>' : '') +
          '</div>' +
          '<div class="flex gap-2">' +
            '<button class="btn btn-outline btn-sm" onclick="App.viewPlan(\'' + p.id + '\')">View</button>' +
            '<button class="btn btn-outline btn-sm" onclick="App.openEditPlan(\'' + p.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-sm" onclick="App.deletePlan(\'' + p.id + '\')">Delete</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-3 text-sm text-muted">' +
          (p.warmup ? '<span>&#10003; Warm-up</span>' : '') +
          ((p.drills || []).length ? '<span>&#10003; ' + p.drills.length + ' drill' + (p.drills.length !== 1 ? 's' : '') + '</span>' : '') +
          (p.cooldown ? '<span>&#10003; Cool-down</span>' : '') +
        '</div>' +
      '</div>'
    ).join('');
  },

  openCreatePlan() {
    document.getElementById('plan-id').value = '';
    document.getElementById('plan-date').value = today();
    document.getElementById('plan-title').value = '';
    document.getElementById('plan-focus').value = '';
    document.getElementById('plan-warmup').value = '';
    document.getElementById('plan-cooldown').value = '';
    document.getElementById('plan-notes').value = '';
    document.getElementById('plan-modal-title').textContent = 'Create Practice Plan';
    this.currentPlanDrills = [];
    this._renderDrills();
    this.openModal('modal-plan');
  },

  openEditPlan(id) {
    const p = DB.plans().find(x => x.id === id);
    if (!p) return;
    document.getElementById('plan-id').value = p.id;
    document.getElementById('plan-date').value = p.date;
    document.getElementById('plan-title').value = p.title;
    document.getElementById('plan-focus').value = p.focus || '';
    document.getElementById('plan-warmup').value = p.warmup || '';
    document.getElementById('plan-cooldown').value = p.cooldown || '';
    document.getElementById('plan-notes').value = p.notes || '';
    document.getElementById('plan-modal-title').textContent = 'Edit Practice Plan';
    this.currentPlanDrills = [...(p.drills || [])];
    this._renderDrills();
    this.openModal('modal-plan');
  },

  addDrill() {
    const desc = document.getElementById('plan-drill-input').value.trim();
    if (!desc) return;
    const duration = document.getElementById('plan-drill-duration').value.trim();
    this.currentPlanDrills.push({ desc, duration });
    document.getElementById('plan-drill-input').value = '';
    document.getElementById('plan-drill-duration').value = '';
    this._renderDrills();
  },

  _renderDrills() {
    const list = document.getElementById('plan-drills-list');
    if (!this.currentPlanDrills.length) {
      list.innerHTML = '<p class="text-muted text-sm" style="padding:6px 0;">No drills added yet.</p>';
      return;
    }
    list.innerHTML = this.currentPlanDrills.map((d, i) =>
      '<div class="plan-drill">' +
        '<div class="plan-drill-num">' + (i + 1) + '</div>' +
        '<div style="flex:1;">' +
          '<strong style="font-size:14px;">' + esc(d.desc) + '</strong>' +
          (d.duration ? ' <span class="text-muted text-sm">' + esc(d.duration) + '</span>' : '') +
        '</div>' +
        '<button class="btn btn-outline btn-sm" onclick="App._removeDrill(' + i + ')">&#10005;</button>' +
      '</div>'
    ).join('');
  },

  _removeDrill(idx) {
    this.currentPlanDrills.splice(idx, 1);
    this._renderDrills();
  },

  savePlan() {
    const title = document.getElementById('plan-title').value.trim();
    const date  = document.getElementById('plan-date').value;
    if (!title || !date) { alert('Title and date are required.'); return; }

    const plans = DB.plans();
    const id    = document.getElementById('plan-id').value;
    const data  = {
      title,
      date,
      focus:    document.getElementById('plan-focus').value.trim(),
      warmup:   document.getElementById('plan-warmup').value.trim(),
      drills:   [...this.currentPlanDrills],
      cooldown: document.getElementById('plan-cooldown').value.trim(),
      notes:    document.getElementById('plan-notes').value.trim(),
    };

    if (id) {
      const idx = plans.findIndex(p => p.id === id);
      plans[idx] = Object.assign({}, plans[idx], data);
    } else {
      plans.push(Object.assign({ id: uid(), createdAt: today() }, data));
    }

    DB.savePlans(plans);
    this.closeModal('modal-plan');
    this.renderPlans();
  },

  deletePlan(id) {
    if (!confirm('Delete this practice plan?')) return;
    DB.savePlans(DB.plans().filter(p => p.id !== id));
    this.renderPlans();
  },

  viewPlan(id) {
    const p = DB.plans().find(x => x.id === id);
    if (!p) return;

    document.getElementById('view-plan-title').textContent = p.title + '  —  ' + fmt(p.date);

    let html = p.focus ? '<div class="mb-2"><span class="badge badge-info">' + esc(p.focus) + '</span></div>' : '';

    if (p.warmup) {
      html += '<div class="plan-section mb-2">' +
        '<div class="plan-section-header">Warm-Up</div>' +
        '<div class="plan-section-body" style="white-space:pre-wrap;">' + esc(p.warmup) + '</div>' +
        '</div>';
    }

    if ((p.drills || []).length) {
      html += '<div class="plan-section mb-2">' +
        '<div class="plan-section-header">Main Workout</div>' +
        '<div class="plan-section-body">' +
        p.drills.map((d, i) =>
          '<div class="plan-drill">' +
            '<div class="plan-drill-num">' + (i + 1) + '</div>' +
            '<div><strong>' + esc(d.desc) + '</strong>' + (d.duration ? ' <span class="text-muted text-sm">' + esc(d.duration) + '</span>' : '') + '</div>' +
          '</div>'
        ).join('') +
        '</div></div>';
    }

    if (p.cooldown) {
      html += '<div class="plan-section mb-2">' +
        '<div class="plan-section-header">Cool-Down</div>' +
        '<div class="plan-section-body" style="white-space:pre-wrap;">' + esc(p.cooldown) + '</div>' +
        '</div>';
    }

    if (p.notes) {
      html += '<div class="plan-section">' +
        '<div class="plan-section-header">Coach Notes</div>' +
        '<div class="plan-section-body" style="white-space:pre-wrap;">' + esc(p.notes) + '</div>' +
        '</div>';
    }

    document.getElementById('view-plan-body').innerHTML = html;
    this.openModal('modal-view-plan');
  },

  // ----------------------------------------------------------
  // RESULTS
  // ----------------------------------------------------------

  switchResultTab(tab) {
    this.resultTab = tab;
    document.querySelectorAll('#page-results .page-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#page-results .page-tab[onclick*="' + tab + '"]').classList.add('active');
    this.renderResults();
  },

  renderResults() {
    const athleteFilter = (document.getElementById('results-athlete-filter') || {}).value || '';
    const eventFilter   = (document.getElementById('results-event-filter') || {}).value || '';

    let results = [...DB.results()].sort((a, b) => b.date.localeCompare(a.date));

    if (this.resultTab === 'prs')   results = results.filter(r => r.isPR);
    if (this.resultTab === 'meets') results = results.filter(r => r.type === 'meet');
    if (athleteFilter) results = results.filter(r => r.athleteId === athleteFilter);
    if (eventFilter)   results = results.filter(r => r.event === eventFilter);

    const athletes = DB.athletes();
    const tbody    = document.getElementById('results-tbody');
    const empty    = document.getElementById('results-empty');

    if (!results.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      tbody.innerHTML = results.map(r => {
        const a = athletes.find(x => x.id === r.athleteId);
        const meetInfo = r.meetName
          ? esc(r.meetName) + (r.place ? ', <strong>' + ordinal(r.place) + '</strong>' : '')
          : '—';
        return '<tr>' +
          '<td>' + fmt(r.date) + '</td>' +
          '<td>' + esc(a ? a.name : '—') + '</td>' +
          '<td><span class="event-tag">' + esc(r.event) + '</span></td>' +
          '<td><strong>' + esc(r.value) + '</strong>' + (r.isPR ? ' <span class="badge badge-pr">PR</span>' : '') + '</td>' +
          '<td><span class="badge ' + (r.type === 'meet' ? 'badge-info' : 'badge-gray') + '">' + r.type + '</span></td>' +
          '<td>' + meetInfo + '</td>' +
          '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(r.notes || '') + '">' + esc(r.notes || '—') + '</td>' +
          '<td><div class="flex gap-1">' +
            '<button class="btn btn-outline btn-sm" onclick="App.togglePR(\'' + r.id + '\')" title="' + (r.isPR ? 'Unset PR' : 'Mark as PR') + '">' + (r.isPR ? '&#9733; PR' : '&#9734; PR') + '</button>' +
            '<button class="btn btn-danger btn-sm" onclick="App.deleteResult(\'' + r.id + '\')">&#10005;</button>' +
          '</div></td>' +
        '</tr>';
      }).join('');
    }

    // Refresh event filter options
    const eventSel = document.getElementById('results-event-filter');
    if (eventSel) {
      const usedEvents = [...new Set(DB.results().map(r => r.event))].sort();
      const cur = eventSel.value;
      eventSel.innerHTML = '<option value="">All Events</option>' +
        usedEvents.map(e => '<option value="' + esc(e) + '">' + esc(e) + '</option>').join('');
      eventSel.value = cur;
    }
  },

  openLogResult() {
    this._refreshAthleteSelects();
    document.getElementById('result-id').value = '';
    document.getElementById('result-date').value = today();
    document.getElementById('result-athlete').value = '';
    document.getElementById('result-event').innerHTML = '<option value="">-- Select Event --</option>';
    document.getElementById('result-value').value = '';
    document.getElementById('result-type').value = 'practice';
    document.getElementById('result-place').value = '';
    document.getElementById('result-meet').value = '';
    document.getElementById('result-notes').value = '';
    document.getElementById('result-meet-group').style.display = 'none';
    document.getElementById('result-place-group').style.display = 'none';
    this.openModal('modal-result');
  },

  updateResultEvents() {
    const id      = document.getElementById('result-athlete').value;
    const athlete = DB.athletes().find(a => a.id === id);
    const events  = (athlete && athlete.events && athlete.events.length) ? athlete.events : EVENTS;
    document.getElementById('result-event').innerHTML =
      '<option value="">-- Select Event --</option>' +
      events.map(e => '<option value="' + esc(e) + '">' + esc(e) + '</option>').join('');
  },

  toggleResultMeetFields() {
    const isMeet = document.getElementById('result-type').value === 'meet';
    document.getElementById('result-meet-group').style.display  = isMeet ? 'block' : 'none';
    document.getElementById('result-place-group').style.display = isMeet ? 'block' : 'none';
  },

  saveResult() {
    const athleteId = document.getElementById('result-athlete').value;
    const event     = document.getElementById('result-event').value;
    const value     = document.getElementById('result-value').value.trim();
    const date      = document.getElementById('result-date').value;
    if (!athleteId || !event || !value || !date) {
      alert('Date, athlete, event, and mark are all required.');
      return;
    }

    const results = DB.results();
    const id      = document.getElementById('result-id').value;
    const data    = {
      athleteId,
      event,
      value,
      date,
      type:     document.getElementById('result-type').value,
      meetName: document.getElementById('result-meet').value.trim(),
      place:    parseInt(document.getElementById('result-place').value) || null,
      notes:    document.getElementById('result-notes').value.trim(),
    };

    if (id) {
      const idx = results.findIndex(r => r.id === id);
      data.isPR = results[idx].isPR;
      results[idx] = Object.assign({}, results[idx], data);
    } else {
      results.push(Object.assign({ id: uid(), isPR: false }, data));
    }

    DB.saveResults(results);
    this.closeModal('modal-result');
    this.renderResults();
  },

  togglePR(id) {
    const results = DB.results();
    const idx = results.findIndex(r => r.id === id);
    if (idx === -1) return;
    results[idx].isPR = !results[idx].isPR;
    DB.saveResults(results);
    this.renderResults();
  },

  deleteResult(id) {
    if (!confirm('Delete this result?')) return;
    DB.saveResults(DB.results().filter(r => r.id !== id));
    this.renderResults();
  },

  // ----------------------------------------------------------
  // GOALS
  // ----------------------------------------------------------

  switchGoalTab(tab) {
    this.goalTab = tab;
    document.querySelectorAll('#page-goals .page-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#page-goals .page-tab[onclick*="' + tab + '"]').classList.add('active');
    this.renderGoals();
  },

  renderGoals() {
    const goals    = DB.goals().filter(g => this.goalTab === 'active' ? !g.achieved : g.achieved);
    const athletes = DB.athletes();
    const list     = document.getElementById('goals-list');
    const empty    = document.getElementById('goals-empty');

    if (!goals.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = goals.map(g => {
      const a = athletes.find(x => x.id === g.athleteId);
      return '<div class="goal-item ' + (g.achieved ? 'goal-achieved' : '') + '">' +
        '<div class="goal-header">' +
          '<div>' +
            '<strong style="font-size:15px;">' + esc(a ? a.name : '—') + '</strong>' +
            ' <span class="event-tag" style="margin-left:6px;">' + esc(g.event) + '</span>' +
          '</div>' +
          '<div class="flex gap-2">' +
            (!g.achieved ? '<button class="btn btn-success btn-sm" onclick="App.markGoalAchieved(\'' + g.id + '\')">&#10003; Achieved</button>' : '') +
            '<button class="btn btn-outline btn-sm" onclick="App.openEditGoal(\'' + g.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-sm" onclick="App.deleteGoal(\'' + g.id + '\')">&#10005;</button>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:20px;font-weight:700;margin:6px 0;">' + esc(g.target) + '</div>' +
        (g.deadline ? '<div class="text-muted text-sm">Target date: ' + fmt(g.deadline) + '</div>' : '') +
        (g.achievedDate ? '<div class="text-sm mt-1" style="color:var(--success);">&#10003; Achieved on ' + fmt(g.achievedDate) + '</div>' : '') +
        (g.notes ? '<div class="text-sm mt-1" style="color:var(--text-muted);">' + esc(g.notes) + '</div>' : '') +
      '</div>';
    }).join('');
  },

  openAddGoal() {
    this._refreshAthleteSelects();
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-athlete').value = '';
    document.getElementById('goal-event').innerHTML = '<option value="">-- Select Event --</option>';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-deadline').value = '';
    document.getElementById('goal-notes').value = '';
    document.getElementById('goal-modal-title').textContent = 'Set Goal';
    this.openModal('modal-goal');
  },

  openEditGoal(id) {
    this._refreshAthleteSelects();
    const g = DB.goals().find(x => x.id === id);
    if (!g) return;
    document.getElementById('goal-id').value = g.id;
    document.getElementById('goal-athlete').value = g.athleteId;
    this.updateGoalEvents();
    setTimeout(() => { document.getElementById('goal-event').value = g.event; }, 0);
    document.getElementById('goal-target').value = g.target;
    document.getElementById('goal-deadline').value = g.deadline || '';
    document.getElementById('goal-notes').value = g.notes || '';
    document.getElementById('goal-modal-title').textContent = 'Edit Goal';
    this.openModal('modal-goal');
  },

  updateGoalEvents() {
    const id      = document.getElementById('goal-athlete').value;
    const athlete = DB.athletes().find(a => a.id === id);
    const events  = (athlete && athlete.events && athlete.events.length) ? athlete.events : EVENTS;
    document.getElementById('goal-event').innerHTML =
      '<option value="">-- Select Event --</option>' +
      events.map(e => '<option value="' + esc(e) + '">' + esc(e) + '</option>').join('');
  },

  saveGoal() {
    const athleteId = document.getElementById('goal-athlete').value;
    const event     = document.getElementById('goal-event').value;
    const target    = document.getElementById('goal-target').value.trim();
    if (!athleteId || !event || !target) {
      alert('Athlete, event, and target mark are required.');
      return;
    }

    const goals = DB.goals();
    const id    = document.getElementById('goal-id').value;
    const data  = {
      athleteId,
      event,
      target,
      deadline: document.getElementById('goal-deadline').value || null,
      notes:    document.getElementById('goal-notes').value.trim(),
    };

    if (id) {
      const idx = goals.findIndex(g => g.id === id);
      goals[idx] = Object.assign({}, goals[idx], data);
    } else {
      goals.push(Object.assign({ id: uid(), achieved: false, achievedDate: null }, data));
    }

    DB.saveGoals(goals);
    this.closeModal('modal-goal');
    this.renderGoals();
  },

  markGoalAchieved(id) {
    const goals = DB.goals();
    const idx   = goals.findIndex(g => g.id === id);
    if (idx === -1) return;
    goals[idx].achieved     = true;
    goals[idx].achievedDate = today();
    DB.saveGoals(goals);
    this.renderGoals();
  },

  deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    DB.saveGoals(DB.goals().filter(g => g.id !== id));
    this.renderGoals();
  },
};

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => App.init());
