// JOBSMETRIX Application JavaScript v2.72.0 · 26/Jul/2026


const esc = s => ((s==null?'':s)).toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = p => `${p}-${Math.random().toString(36).slice(2,9)}`;
const fmtMoney = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays = (iso,n) => { const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

function kOpen(id){ const el=document.getElementById(id); if(el){ el.style.display='flex'; el.classList.add('open'); } }
function kClose(id){ const el=document.getElementById(id); if(el){ el.style.display='none'; el.classList.remove('open'); } if(id==='jobDetailModal' && typeof _msgUnsub==='function'){ try{_msgUnsub();}catch(e){} _msgUnsub=null; } }
window.kOpen = kOpen;
window.kClose = kClose;

// ── NAVIGATION ──
const KT_PAGES = {
  dashboard:          { el:'ktPageDashboard',          title:'🏠 Home' },
  globalNotes:        { el:'ktPageGlobalNotes',        title:'📋 Notes' },
  globalMessages:     { el:'ktPageGlobalMessages',     title:'💬 Messages' },
  globalChangeOrders: { el:'ktPageGlobalChangeOrders', title:'🔄 Change Orders' },
  jobs:               { el:'ktPageJobs',               title:'🔧 Jobs' },
  logs:               { el:'ktPageLogs',               title:'📝 Daily Logs' },
  costing:            { el:'ktPageCosting',            title:'💰 Job Costing' },
  catalog:            { el:'ktPageCatalog',            title:'📦 Cost Catalog' },
  invoicing:          { el:'ktPageInvoicing',          title:'🧾 Invoicing' },
  reports:            { el:'ktPageReports',            title:'📊 Reports & Analytics' },
  purchaseorders:     { el:'ktPagePurchaseOrders',     title:'📋 Purchase Orders' },
  calendar:           { el:'ktPageCalendar',           title:'📅 Calendar' },
  masterschedule:     { el:'ktPageMasterschedule',     title:'📊 Master Schedule' },
  time:               { el:'ktPageTime',               title:'⏱ Time Tracking' },
  documents:          { el:'ktPageDocuments',          title:'📁 Documents' },
  todos:              { el:'ktPageTodos',              title:'✅ To-Dos' },
  customers:          { el:'ktPageCustomers',          title:'👥 Customers' },
  vendors:            { el:'ktPageVendors',            title:'🏭 Vendors' },
  settings:           { el:'ktPageSettings',           title:'⚙️ Company Settings' },
};

// ── Jobs page view toggle ──
let _jobsView = 'kanban';
function switchJobsView(view) {
  _jobsView = view;
  const kanbanView = document.getElementById('jobsKanbanView');
  const listView = document.getElementById('jobsListView');
  const kanbanBtn = document.getElementById('jobsKanbanBtn');
  const listBtn = document.getElementById('jobsListBtn');
  if (kanbanView) kanbanView.style.display = view === 'kanban' ? 'block' : 'none';
  if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
  if (kanbanBtn) {
    kanbanBtn.style.background = view === 'kanban' ? 'linear-gradient(135deg,var(--amber),var(--amber2))' : 'transparent';
    kanbanBtn.style.color = view === 'kanban' ? '#fff' : 'var(--muted)';
    kanbanBtn.style.fontWeight = view === 'kanban' ? '700' : '600';
  }
  if (listBtn) {
    listBtn.style.background = view === 'list' ? 'linear-gradient(135deg,var(--amber),var(--amber2))' : 'transparent';
    listBtn.style.color = view === 'list' ? '#fff' : 'var(--muted)';
    listBtn.style.fontWeight = view === 'list' ? '700' : '600';
  }
  if (view === 'kanban') renderJobsBoard();
  if (view === 'list') conRenderList();
}
window.switchJobsView = switchJobsView;

// ── DRAG AND DROP ──
let _dragJobId = null;

// ── Closed Lost requires a reason, logged permanently to Activity ──
// Prompts (and re-prompts on empty input) only when a job is genuinely
// transitioning INTO Closed Lost from some other status — moving between
// any other two statuses, or already being Closed Lost, needs nothing.
// Returns { needed:false } when no reason is required, or
// { needed:true, aborted:bool, reason } when it is.
function getClosedLostReasonIfNeeded(prevStatus, newStatus) {
  if (newStatus !== 'Closed Lost' || prevStatus === 'Closed Lost') return { needed: false };
  while (true) {
    const input = prompt('This job is being marked Closed Lost. Please enter a reason (required):');
    if (input === null) return { needed: true, aborted: true };
    const reason = input.trim();
    if (reason) return { needed: true, aborted: false, reason };
    alert('A reason is required to mark this job Closed Lost.');
  }
}

// Logs any status change (not just Closed Lost) as a real, permanent
// Activity entry — reuses the existing 'logs' collection so it shows up
// in the Activity feed with no separate rendering pipeline needed.
function logStatusChangeActivity(jobId, prevStatus, newStatus, reason) {
  if (!conDb || !jobId) return;
  const notes = reason
    ? `Status changed: ${prevStatus || '—'} → ${newStatus}. Reason: ${reason}`
    : `Status changed: ${prevStatus || '—'} → ${newStatus}`;
  coll('jobs').doc(jobId).collection('logs').add({
    date: new Date().toISOString().split('T')[0],
    notes,
    type: 'status_change',
    fromStatus: prevStatus || '',
    toStatus: newStatus,
    reason: reason || '',
    userName: conCurrentUser?.displayName || conCurrentUser?.email || 'Unknown',
    companyId: currentCompanyId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(e => console.error('Status change log error:', e));
}

// ── Theme toggle (Blue default / Black / Light) ──
// Per-browser preference via localStorage, applied instantly on click
// (no reload needed) and re-applied before paint on every future load
// via the inline script at the top of index.html.
function setTheme(theme) {
  if (theme === 'blue') {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.removeItem('kt_theme'); } catch (e) {}
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('kt_theme', theme); } catch (e) {}
  }
  highlightActiveThemeSwatch();
}
window.setTheme = setTheme;

function highlightActiveThemeSwatch() {
  const current = document.documentElement.getAttribute('data-theme') || 'blue';
  const wrap = document.getElementById('themeToggle');
  if (!wrap) return;
  const buttons = wrap.querySelectorAll('button');
  const order = ['blue', 'black', 'light'];
  buttons.forEach((btn, i) => {
    btn.style.borderColor = order[i] === current ? 'var(--amber)' : 'var(--line)';
    btn.style.boxShadow = order[i] === current ? '0 0 0 2px var(--amber-dim)' : 'none';
  });
}
window.highlightActiveThemeSwatch = highlightActiveThemeSwatch;

function initDragDrop(boardId) {
  const board = document.getElementById(boardId);
  if (!board) return;

  let dragCard = null;
  let dragJobId = null;
  let isDragging = false;
  let startX = 0, startY = 0;
  let ghost = null;

  function getColAtPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (el.classList.contains('kt-col') && el.dataset.status) return el;
      if (el.closest && el.closest('.kt-col') && el.closest('.kt-col').dataset.status) {
        return el.closest('.kt-col');
      }
    }
    return null;
  }

  board.querySelectorAll('.kt-job-card').forEach(card => {
    // HTML5 drag API (desktop)
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', e => {
      dragJobId = card.dataset.jobId;
      _dragJobId = dragJobId;
      isDragging = true;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragJobId);
    });

    card.addEventListener('dragend', e => {
      card.classList.remove('dragging');
      board.querySelectorAll('.kt-col').forEach(c => c.classList.remove('drag-over'));
      // Delay clearing so drop handler can still read _dragJobId
      setTimeout(() => { isDragging = false; dragJobId = null; _dragJobId = null; }, 300);
    });

    // Prevent click after drag
    card.addEventListener('click', e => {
      if (isDragging) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  });

  // Drop targets
  board.querySelectorAll('.kt-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      board.querySelectorAll('.kt-col').forEach(c => c.classList.remove('drag-over'));
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      board.querySelectorAll('.kt-col').forEach(c => c.classList.remove('drag-over'));
      // Get jobId from dataTransfer (most reliable cross-browser)
      let jobId = '';
      try { jobId = e.dataTransfer.getData('text/plain'); } catch(err) {}
      if (!jobId) jobId = _dragJobId;
      if (!jobId || !conDb) {
        console.warn('Drop failed: no jobId or no db', jobId, !!conDb);
        return;
      }
      const newStatus = col.dataset.status;
      if (!newStatus) { console.warn('Drop failed: no status on col'); return; }
      const job = conJobs.find(j => j.id === jobId);
      if (job && job.status === newStatus) return; // same column, no-op
      const prevStatus = job ? job.status : '';

      const closedLost = getClosedLostReasonIfNeeded(prevStatus, newStatus);
      if (closedLost.needed && closedLost.aborted) return; // user cancelled, don't move the card

      console.log('Moving job', jobId, 'to', newStatus);
      // Optimistically update local state for instant visual feedback
      if (job) job.status = newStatus;
      conRenderBoard();
      if (typeof renderJobsBoard === 'function') renderJobsBoard();
      // Persist to Firestore
      coll('jobs').doc(jobId).update({
        status: newStatus,
        statusDate: new Date().toISOString().split('T')[0],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
      }).then(() => {
        logStatusChangeActivity(jobId, prevStatus, newStatus, closedLost.needed ? closedLost.reason : null);
      }).catch(err => {
        console.error('Firestore update failed:', err);
        alert('Could not move job: ' + err.message);
        // Revert optimistic update
        if (job) job.status = job._prevStatus || newStatus;
        conRenderBoard();
        if (typeof renderJobsBoard === 'function') renderJobsBoard();
      });
      _dragJobId = null;
    });
  });
}
window.initDragDrop = initDragDrop;

// ── Jobs page kanban board (separate from Home board) ──
let _showClosedLanes = false;

function renderJobsBoard() {
  const board = document.getElementById('jobsBoard');
  if (!board) return;
  const statusFilter = document.getElementById('jobsStatusFilter')?.value || '';
  board.innerHTML = '';

  // Determine which columns to show
  let colsToShow;
  if (statusFilter) {
    // Single-status filter: find the column that owns this status
    colsToShow = KANBAN_COLUMNS.filter(c => c.statuses.includes(statusFilter));
    if (!colsToShow.length) colsToShow = KANBAN_COLUMNS.filter(c => !c.hidden);
  } else {
    colsToShow = _showClosedLanes ? KANBAN_COLUMNS : KANBAN_COLUMNS.filter(c => !c.hidden);
  }

  colsToShow.forEach(col => {
    const jobs = conJobs.filter(j => col.statuses.includes(j.status));
    const el = document.createElement('div');
    el.className = 'kt-col';
    el.style.borderTopColor = col.color;
    el.dataset.status = col.dropStatus; // what gets written to Firestore on drop
    el.innerHTML = `<div class="kt-col-head"><span class="kt-col-head-label" style="color:${col.color}">${col.label}</span><span class="kt-col-count" style="background:${col.color}22;color:${col.color};flex-shrink:0">${jobs.length}</span></div>`;
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'kt-job-card';
      card.style.borderLeftColor = col.color;
      card.dataset.jobId = job.id;
      // Show the actual Firestore status on the card if it differs from column label
      // (e.g. a Permitting card in the To Be Scheduled column)
      const statusBadge = job.status !== col.dropStatus
        ? `<div class="kt-job-meta" style="color:${col.color};font-weight:700;font-size:.7rem">${esc(job.status)}</div>`
        : '';
      card.innerHTML = `
        <div class="kt-job-num" style="color:${col.color}">${esc(job.jobNumber||'')}</div>
        <div class="kt-job-name">${esc(job.name)}</div>
        ${statusBadge}
        ${job.client?`<div class="kt-job-meta">Customer: ${esc(job.client)}</div>`:''}
        ${job.statusDate||job.startDate?`<div class="kt-job-meta">Status Date: ${job.statusDate||job.startDate}</div>`:''}
        ${job.superintendent||job.teamLead||job.pm?`<div class="kt-job-meta">Team Lead: ${esc(job.superintendent||job.teamLead||job.pm)}</div>`:''}
        ${getJobValue(job)?`<div class="kt-job-value">$${Math.round(getJobValue(job)).toLocaleString()}</div>`:''}
      `;
      card.onclick = () => openJobDetail(job.id);
      el.appendChild(card);
    });
    if (!jobs.length) {
      const empty = document.createElement('div');
      empty.className = 'kt-col-empty';
      empty.textContent = 'No jobs';
      el.appendChild(empty);
    }
    board.appendChild(el);
  });

  // Toggle button for closed lanes
  let toggleBtn = document.getElementById('toggleClosedLanesBtn');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggleClosedLanesBtn';
    toggleBtn.style.cssText = 'margin:8px 0 0 4px;padding:4px 12px;font-size:.75rem;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;white-space:nowrap;flex-shrink:0;align-self:flex-start';
    toggleBtn.onclick = () => { _showClosedLanes = !_showClosedLanes; renderJobsBoard(); };
    board.parentElement?.insertBefore(toggleBtn, board);
  }
  toggleBtn.textContent = _showClosedLanes ? '▲ Hide Closed' : '▼ Show Closed';

  // Init drag and drop after render
  setTimeout(() => initDragDrop('jobsBoard'), 50);
}
window.renderJobsBoard = renderJobsBoard;

function ktNav(key, btn) {
  Object.values(KT_PAGES).forEach(p => {
    const el = document.getElementById(p.el);
    if(el) el.classList.remove('active');
  });
  document.querySelectorAll('.kt-nav-item').forEach(b => b.classList.remove('active'));
  const page = KT_PAGES[key];
  if(!page) return;
  const el = document.getElementById(page.el);
  if(el) el.classList.add('active');
  if(btn) btn.classList.add('active');
  const title = document.getElementById('ktPageTitle');
  if(title) title.textContent = page.title;
  // Close mobile sidebar
  document.getElementById('ktSidebar')?.classList.remove('open');
  // Trigger renders
  if(key==='globalNotes') loadGlobalNotes();
  if(key==='globalMessages') loadGlobalMessages();
  if(key==='globalChangeOrders') loadGlobalChangeOrders();
  if(key==='costing') renderJobCostDashboard();

  if(key==='jobs') {
    if(_jobsView === 'kanban') renderJobsBoard();
    else conRenderList();
  }
  if(key==='dashboard') { conRenderBoard(); conRenderStats(); renderHomeDashboard(); }
  if(key==='catalog') renderCatalog();
  if(key==='calendar') { loadGlobalPhases(); loadCalendarEvents(); buildTeamColors(); renderCalendar(); loadGCalStatus(); loadTimeOffRequests(); }
  if(key==='masterschedule') { renderMasterSchedulePage(); }
  if(key==='time') { loadTimeEntries(); renderTimeLog(); renderTodaySummary(); populateTimeFilters(); }
  if(key==='logs') { loadGlobalLogs(); renderGlobalLogs(); }
  if(key==='todos') { loadTodos(); populateTodoJobFilter(); populateTodoAssigneeFilter(); renderTodos(); }
  if(key==='customers') { loadCustomers(); renderCustomers(); }
  if(key==='vendors') { loadVendors(); renderVendors(); }
  if(key==='reports') { renderActiveReport(); }
  if(key==='purchaseorders') { loadPOs(); populatePOFilters(); renderPOs(); }
  if(key==='documents') { loadDocuments(); populateDocJobFilter(); renderDocuments(); }
  if(key==='invoicing') {
    // Render empty state immediately, then load real data
    renderInvoicingPage();
    loadAllInvoices();
  }
  if(key==='settings') { populateSettingsForm(); loadTeamMembers(); }
}

function ktFilterJobs(q) {
  q = (q||'').toLowerCase();
  document.querySelectorAll('.kt-job-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

// ── OVERRIDE conShowMain to use new JOBSMETRIX UI ──
function conShowMain(user) {
  document.getElementById('ktAuthWall').style.display = 'none';
  document.getElementById('ktApp').style.display = 'flex';
  highlightActiveThemeSwatch();
  const name = user.displayName || user.email || 'User';
  document.getElementById('ktUserName').textContent = name.split(' ')[0] || name;
  const avatarImg = document.getElementById('ktAvatarImg');
  const avatarInit = document.getElementById('ktAvatarInitial');
  if(user.photoURL) {
    avatarImg.src = user.photoURL;
    avatarImg.style.display = 'block';
    avatarInit.style.display = 'none';
  } else {
    avatarInit.textContent = (name[0]||'?').toUpperCase();
  }
  // Role label in sidebar footer
  const roleEl = document.getElementById('ktUserRole');
  if (roleEl) {
    const roleData = KYTRAC_ROLES[currentUserRole] || {};
    roleEl.textContent = currentUserRole || 'Loading...';
    if (roleData.color) roleEl.style.color = roleData.color;
  }
  const nb = document.getElementById('newJobBtn');
  const so = document.getElementById('signOutBtn');
  if(nb) nb.style.display = 'inline-flex';
  if(so) so.style.display = 'inline-flex';
  // Preload customers so picker works from any tab
  if (typeof loadCustomers === 'function') setTimeout(loadCustomers, 500);
}

function conShowAuthWall() {
  document.getElementById('ktAuthWall').style.display = 'flex';
  document.getElementById('ktApp').style.display = 'none';
}

// ── OVERRIDE conRenderBoard to use kt-board classes ──
// ── OVERRIDE conRenderList to use both list page targets ──
// ── OVERRIDE Firebase auth reveal ──
function ktRevealSignIn() {
  const loading = document.getElementById('ktAuthLoading');
  const btn = document.getElementById('ktSignInBtn');
  if(loading) loading.style.display = 'none';
  if(btn) { btn.disabled = false; btn.textContent = ''; btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google'; }
}



// ════════════════════════════════════════════════════
// ── MODULE 6: CONSTRUCTION JOB HUB ──
// ── Firebase Firestore + Google Auth ──
// ════════════════════════════════════════════════════

// Firebase config
const CON_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoFC2N0rrgwO-vY8SCPb3J-jKgSLYn5BQ",
  authDomain: "kytrac-72d91.firebaseapp.com",
  projectId: "kytrac-72d91",
  storageBucket: "kytrac-72d91.firebasestorage.app",
  messagingSenderId: "1061786207687",
  appId: "1:1061786207687:web:219bce6739311f43b205e2"
};

// Approved users whitelist — add all team members here
// ── ROLE DEFINITIONS ──
const KYTRAC_ROLES = {
  'Owner': {
    label: 'Owner/Admin',
    color: '#f59e0b',
    level: 100,
    permissions: ['all']
  },
  'Project Manager': {
    label: 'Project Manager',
    color: '#3b82f6',
    level: 90,
    permissions: ['jobs','invoicing','costing','catalog','logs','phases','subs','estimates','changeorders','schedule','dailylogs']
  },
  'Office Manager': {
    label: 'Office Manager',
    color: '#8b5cf6',
    level: 70,
    permissions: ['jobs','invoicing','logs','phases','subs','schedule','dailylogs','catalog']
  },
  'Accounting': {
    label: 'Accounting',
    color: '#10b981',
    level: 60,
    permissions: ['invoicing','costing','catalog_read']
  },
  'Marketing/Office Staff': {
    label: 'Marketing/Office Staff',
    color: '#6366f1',
    level: 40,
    permissions: ['jobs_read','leads']
  },
  'Sales': {
    label: 'Sales',
    color: '#f97316',
    level: 50,
    permissions: ['jobs_sales','estimates','changeorders']
  },
  'Superintendent': {
    label: 'Superintendent',
    color: '#0891b2',
    level: 55,
    permissions: ['jobs_assigned','phases','subs','schedule','dailylogs','logs']
  },
  'Team Lead': {
    label: 'Team Lead',
    color: '#06b6d4',
    level: 45,
    permissions: ['jobs_assigned','phases','dailylogs','logs']
  },
  'Field Technician': {
    label: 'Field Technician',
    color: '#6b7280',
    level: 20,
    permissions: ['logs_assigned']
  }
};

// Current user role (loaded from Firestore)
let currentUserRole = null;
let currentUserTeamData = null;

// Calendar personal event colors per team member
const CAL_USER_COLORS = [
  '#3b82f6', // blue - Travis
  '#8b5cf6', // purple - Jason
  '#06b6d4', // cyan - Gonzolo
  '#ec4899', // pink
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7', // violet
  '#14b8a6', // teal
];

let calendarEvents = []; // personal/team events
let _teamColors = {}; // email -> color

// A person can be LABELED with a limited role (e.g. "Sales", for
// reporting/display purposes - who's actually doing sales work) while
// still having full Owner-level permissions underneath, via a per-person
// override on their team record. Real use case: Jason - role label
// "Sales" to reflect what he actually does day to day, but retains full
// access per the TDX Holdings transition.
function hasPermission(perm) {
  if (currentUserTeamData?.fullAccessOverride) return true;
  if (!currentUserRole) return false;
  const role = KYTRAC_ROLES[currentUserRole];
  if (!role) return false;
  if (role.permissions.includes('all')) return true;
  return role.permissions.includes(perm);
}

function isOwnerOrAdmin() {
  if (currentUserTeamData?.fullAccessOverride) return true;
  return currentUserRole === 'Owner' || currentUserRole === 'Project Manager';
}

// Legacy - kept for auth check but role system handles access
const CON_APPROVED_EMAILS = [];

let conApp = null, conDb = null, conAuth = null, conFunctions = null;
let conCurrentUser = null;
let currentCompanyId = null; // Set after login — all Firestore paths scoped under companies/{currentCompanyId}/
let isCompanyOwnerByEmail = false; // true when login email matches the company's ownerEmail


// Helper: add companyId to any subcollection document
function subDoc(data) {
  return { ...data, companyId: currentCompanyId };
}

// Helper: returns a Firestore CollectionReference scoped to the current company
function coll(name) {
  if (!currentCompanyId) throw new Error('No company loaded — cannot access collection: ' + name);
  return conDb.collection('companies').doc(currentCompanyId).collection(name);
}
let conCurrentJobId = null;
let conEditingJobId = null;
let conJobs = [];
let conFirebaseReady = false;

// ── Status migration map (old → new Firestore values) ──────────────────────
const STATUS_MIGRATION_MAP = {
  'Hipshot Needed':     'New Lead',
  'Estimating':         'Building Estimate',
  'Contracted':         'Approved',
  'Design Phase':       'To Be Scheduled',
  'Work In Progress':   'In Progress',
  'Invoicing':          'Complete',
  'Pending Payment':    'Complete',
  'Delinquent':         'Complete',
  'Closed Hipshot Sent':'Closed Lost',
  'Closed Won':         'Closed Completed',
};

// ── Canonical status definitions (Firestore values) ────────────────────────
// All valid status strings that may be written to Firestore.
const KYTRAC_STATUSES = [
  {name:'New Lead',           color:'#f97316', group:'estimates'},
  {name:'Appointment Set',    color:'#f97316', group:'estimates'},
  {name:'Building Estimate',  color:'#d97706', group:'estimates'},
  {name:'Submitted',          color:'#d97706', group:'estimates'},
  {name:'Approved',           color:'#16a34a', group:'active'},
  {name:'To Be Scheduled',    color:'#0d9488', group:'active'},
  {name:'Permitting',         color:'#0d9488', group:'active'},
  {name:'Scheduled',          color:'#3b82f6', group:'active'},
  {name:'In Progress',        color:'#3b82f6', group:'active'},
  {name:'Inspection Pending', color:'#ef4444', group:'active'},
  {name:'Complete',           color:'#7c3aed', group:'finance'},
  {name:'Closed Completed',   color:'#6b7280', group:'closed'},
  {name:'Closed Lost',        color:'#6b7280', group:'closed'},
];

// ── Kanban column definitions ───────────────────────────────────────────────
// Columns are what renders on the board. One column can contain multiple
// Firestore status values (e.g. "To Be Scheduled" column shows both
// 'To Be Scheduled' and 'Permitting' jobs).
// dropStatus: the value written to Firestore when a card is dropped here.
// hidden: true means filtered out of the default board view.
const KANBAN_COLUMNS = [
  {label:'New Lead',          color:'#f97316', statuses:['New Lead'],           dropStatus:'New Lead',          group:'estimates', hidden:false},
  {label:'Appointment Set',   color:'#f97316', statuses:['Appointment Set'],     dropStatus:'Appointment Set',   group:'estimates', hidden:false},
  {label:'Building Estimate', color:'#d97706', statuses:['Building Estimate'],   dropStatus:'Building Estimate', group:'estimates', hidden:false},
  {label:'Submitted',         color:'#d97706', statuses:['Submitted'],           dropStatus:'Submitted',         group:'estimates', hidden:false},
  {label:'Approved',          color:'#16a34a', statuses:['Approved'],            dropStatus:'Approved',          group:'active',   hidden:false},
  {label:'To Be Scheduled',   color:'#0d9488', statuses:['To Be Scheduled','Permitting'], dropStatus:'To Be Scheduled', group:'active', hidden:false},
  {label:'Scheduled',         color:'#3b82f6', statuses:['Scheduled'],           dropStatus:'Scheduled',         group:'active',   hidden:false},
  {label:'In Progress',       color:'#3b82f6', statuses:['In Progress'],         dropStatus:'In Progress',       group:'active',   hidden:false},
  {label:'Inspection Pending',color:'#ef4444', statuses:['Inspection Pending'],  dropStatus:'Inspection Pending',group:'active',   hidden:false},
  {label:'Complete',          color:'#7c3aed', statuses:['Complete'],            dropStatus:'Complete',          group:'finance',  hidden:false},
  {label:'Closed Completed',  color:'#6b7280', statuses:['Closed Completed'],    dropStatus:'Closed Completed',  group:'closed',   hidden:true},
  {label:'Closed Lost',       color:'#6b7280', statuses:['Closed Lost'],         dropStatus:'Closed Lost',       group:'closed',   hidden:true},
];

// Pipeline strip bucket → which Firestore statuses belong to each group
const PIPELINE_BUCKETS = {
  estimates: ['New Lead', 'Appointment Set'],
  bidding:   ['Building Estimate', 'Submitted'],
  approved:  ['Approved'],
  scheduled: ['To Be Scheduled', 'Permitting', 'Scheduled'],
  inprogress:['In Progress', 'Inspection Pending'],
  closing:   ['Complete'],
};

// Flat list of all "in-flight" statuses (excludes Closed lanes and Estimates)
const ACTIVE_STATUSES = [
  ...PIPELINE_BUCKETS.approved,
  ...PIPELINE_BUCKETS.scheduled,
  ...PIPELINE_BUCKETS.inprogress,
];
// All non-closed statuses (used for schedule, logs, etc.)
const ALL_OPEN_STATUSES = [
  ...PIPELINE_BUCKETS.estimates,
  ...PIPELINE_BUCKETS.bidding,
  ...PIPELINE_BUCKETS.approved,
  ...PIPELINE_BUCKETS.scheduled,
  ...PIPELINE_BUCKETS.inprogress,
  ...PIPELINE_BUCKETS.closing,
];
const CON_JOB_STATUSES = KYTRAC_STATUSES.map(s => s.name);

// ── Run status migration on load ────────────────────────────────────────────
// Rewrites any legacy status values in conJobs to new canonical values.
// Does NOT write to Firestore — display-only remap. Firestore migration
// happens lazily when a job is next saved/moved.
function migrateJobStatuses(jobs) {
  jobs.forEach(j => {
    if (STATUS_MIGRATION_MAP[j.status]) {
      j.status = STATUS_MIGRATION_MAP[j.status];
    }
  });
}

function conLoadFirebase() {
  if (conFirebaseReady) return;
  // Load Firebase SDKs in sequence — app MUST load before auth and firestore
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions-compat.js'
  ];
  if (typeof firebase !== 'undefined' && firebase.apps !== undefined) { conInitFirebase(); return; }
  function loadNext(i) {
    if (i >= scripts.length) { conInitFirebase(); return; }
    const s = document.createElement('script');
    s.src = scripts[i];
    s.onload = () => loadNext(i + 1);
    s.onerror = () => {
      console.error('Failed to load Firebase script:', scripts[i]);
      // Show error to user
      const loader = document.getElementById('conSignInLoading');
      if (loader) loader.innerHTML = '<div style="color:#ef5350;font-size:.9rem">⚠️ Could not connect to JOBSMETRIX.<br>Check your internet connection and reload.</div>';
    };
    document.head.appendChild(s);
  }
  loadNext(0);
}

// conShowAuthWall and conShowMain overridden by JOBSMETRIX UI versions below

function conSignIn() {
  if (!conFirebaseReady) {
    const btn = document.getElementById('conSignInBtn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }
    setTimeout(conSignIn, 1000);
    return;
  }
  // Set flag so onAuthStateChanged null bounce doesn't flash the auth wall
  window._signingIn = true;
  const btn = document.getElementById('conSignInBtn');
  if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

  const provider = new firebase.auth.GoogleAuthProvider();
  conAuth.signInWithPopup(provider).catch(e => {
    window._signingIn = false;
    if (btn) { btn.textContent = 'Sign in with Google'; btn.disabled = false; }
    if (e.code !== 'auth/popup-closed-by-user') alert('Sign-in failed: ' + e.message);
  });
}

function conSignOut() {
  if (conAuth) conAuth.signOut();
}

function conGenJobNumber() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 900) + 100);
  return 'JOB-' + year + '-' + num;
}

function openNewJobModal() {
  conEditingJobId = null;
  document.getElementById('jobModalTitle').textContent = 'New Job';
  ['jobName','jobClient','jobPhone','jobEmail','jobAddress','jobNotes','jobContractValue','jobEstCost','jobSuperintendent','jobPM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('jobStatus').value = 'New Lead';
  document.getElementById('jobType').value = 'Residential Remodel';
  document.getElementById('jobStartDate').value = '';
  document.getElementById('jobEndDate').value = '';
  kOpen('newJobModal');
}

function saveJob(openEstimate) {
  const name = document.getElementById('jobName').value.trim();
  const client = document.getElementById('jobClient').value.trim();
  if (!name || !client) { alert('Job name and client name are required.'); return; }

  const newStatus = document.getElementById('jobStatus').value;
  let closedLostReason = null;
  if (conEditingJobId) {
    const existingJob = conJobs.find(j => j.id === conEditingJobId);
    const prevStatus = existingJob ? existingJob.status : '';
    const closedLost = getClosedLostReasonIfNeeded(prevStatus, newStatus);
    if (closedLost.needed) {
      if (closedLost.aborted) return; // user cancelled — don't save any changes
      closedLostReason = closedLost.reason;
    }
  }

  const data = {
    name, client,
    phone: document.getElementById('jobPhone').value.trim(),
    email: document.getElementById('jobEmail').value.trim(),
    address: document.getElementById('jobAddress').value.trim(),
    status: newStatus,
    statusDate: new Date().toISOString().split('T')[0],
    type: document.getElementById('jobType').value,
    contractValue: parseFloat(document.getElementById('jobContractValue').value) || 0,
    estCost: parseFloat(document.getElementById('jobEstCost').value) || 0,
    startDate: document.getElementById('jobStartDate').value,
    endDate: document.getElementById('jobEndDate').value,
    superintendent: document.getElementById('jobSuperintendent').value.trim(),
    pm: document.getElementById('jobPM').value.trim(),
    notes: document.getElementById('jobNotes').value.trim(),
    crew: getSelectedCrew(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
  };

  if (conEditingJobId) {
    const existingJob = conJobs.find(j => j.id === conEditingJobId);
    const prevStatus = existingJob ? existingJob.status : '';
    coll('jobs').doc(conEditingJobId).update(data)
      .then(() => {
        kClose('newJobModal');
        if (prevStatus && prevStatus !== newStatus) {
          logStatusChangeActivity(conEditingJobId, prevStatus, newStatus, closedLostReason);
        }
      })
      .catch(e => alert('Error saving: ' + e.message));
  } else {
    data.jobNumber = conGenJobNumber();
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = conCurrentUser ? conCurrentUser.email : 'unknown';
    data.actualCost = 0;
    coll('jobs').add(subDoc(data))
      .then(ref => {
        kClose('newJobModal');
        // Auto-open job detail to estimate tab
        setTimeout(() => {
          const tabToOpen = openEstimate ? 'estimate' : 'dashboard';
          openJobDetail(ref.id);
          setTimeout(() => {
            const tabBtn = document.querySelector('#jobDetailModal .con-subtab');
            if (openEstimate) {
              // Click the Estimate tab
              document.querySelectorAll('#jobDetailModal .con-subtab').forEach(btn => {
                if (btn.textContent.includes('Estimate')) btn.click();
              });
            }
          }, 400);
        }, 300);
      })
      .catch(e => alert('Error saving: ' + e.message));
  }
}

function openNewJobForCustomer(customerId) {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return;
  prefillNewJobForCustomerData(customer);
}
window.openNewJobForCustomer = openNewJobForCustomer;

// Pre-fills and opens the New Job modal from a plain customer-like object
// ({id, name, phone, email, address}). Does not depend on the customer
// already being present in the allCustomers local cache, so it's safe to
// call immediately after a Firestore write resolves, before onSnapshot
// has caught up.
function prefillNewJobForCustomerData(customer) {
  if (!customer) return;
  conEditingJobId = null;
  document.getElementById('jobModalTitle').textContent = 'New Job';
  // Pre-fill from customer
  document.getElementById('jobName').value = customer.name + ' — ';
  document.getElementById('jobClient').value = customer.name;
  document.getElementById('jobPhone').value = customer.phone || '';
  document.getElementById('jobEmail').value = customer.email || '';
  document.getElementById('jobAddress').value = customer.address || '';
  document.getElementById('jobStatus').value = 'New Lead';
  document.getElementById('jobType').value = 'Residential Remodel';
  document.getElementById('jobContractValue').value = '';
  document.getElementById('jobEstCost').value = '';
  document.getElementById('jobStartDate').value = '';
  document.getElementById('jobEndDate').value = '';
  document.getElementById('jobNotes').value = '';
  const superEl = document.getElementById('jobSuperintendent');
  const pmEl = document.getElementById('jobPM');
  if (superEl) superEl.innerHTML = getTeamMemberOpts();
  if (pmEl) pmEl.innerHTML = getTeamMemberOpts();
  // Switch to Jobs page and open modal
  ktNav('jobs', null);
  kOpen('newJobModal');
  // Focus on job name so user can type the job description
  setTimeout(() => {
    const nameEl = document.getElementById('jobName');
    if (nameEl) { nameEl.focus(); nameEl.setSelectionRange(nameEl.value.length, nameEl.value.length); }
  }, 200);
}
window.prefillNewJobForCustomerData = prefillNewJobForCustomerData;

function conRenderBoard() {
  const board = document.getElementById('conBoard');
  if (!board) return;
  board.innerHTML = '';
  // Home board: show active lanes only (no closed)
  KANBAN_COLUMNS.filter(c => !c.hidden).forEach(col => {
    const jobs = conJobs.filter(j => col.statuses.includes(j.status));
    const el = document.createElement('div');
    el.className = 'con-col';
    el.style.borderTopColor = col.color;
    el.innerHTML = `<div class="con-col-head" style="color:${col.color}">${col.label} <span class="con-col-count" style="background:${col.color}22;color:${col.color}">${jobs.length}</span></div>`;
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.style.borderLeftColor = col.color;
      const statusDate = job.statusDate || job.startDate || '';
      const teamLead = job.superintendent || job.teamLead || '';
      const statusBadge = job.status !== col.dropStatus
        ? `<div class="job-card-meta" style="color:${col.color};font-weight:700;font-size:.68rem">${job.status}</div>`
        : '';
      card.innerHTML = `
        <div class="job-card-num" style="color:${col.color}">${job.jobNumber || ''}</div>
        <div class="job-card-name">${job.name}</div>
        ${statusBadge}
        ${job.client ? `<div class="job-card-meta">👤 ${job.client}</div>` : ''}
        ${teamLead ? `<div class="job-card-meta">👷 ${teamLead}</div>` : ''}
        ${statusDate ? `<div class="job-card-meta">📅 ${statusDate}</div>` : ''}
        ${getJobValue(job) ? `<div class="job-card-value">$${Math.round(getJobValue(job)).toLocaleString()}</div>` : ''}
      `;
      card.onclick = () => openJobDetail(job.id);
      el.appendChild(card);
    });
    if (!jobs.length) {
      const empty = document.createElement('div');
      empty.className = 'kt-col-empty';
      empty.textContent = 'No jobs';
      el.appendChild(empty);
    }
    board.appendChild(el);
  });
}

let _jobsListSortCol = null;
let _jobsListSortDir = 'asc'; // 'asc' or 'desc'

function sortJobsList(col) {
  if (_jobsListSortCol === col) {
    _jobsListSortDir = (_jobsListSortDir === 'asc') ? 'desc' : 'asc';
  } else {
    _jobsListSortCol = col;
    _jobsListSortDir = 'asc';
  }
  conRenderList();
}
window.sortJobsList = sortJobsList;

function _jobsListSortValue(job, col) {
  switch (col) {
    case 'jobNumber': {
      // Job numbers are often like "1065" or "JOB-2026-123" or "TEST_Job".
      // Try numeric compare first (strip non-digits), fall back to string.
      const raw = job.jobNumber || '';
      const numMatch = raw.match(/\d+/);
      return numMatch ? parseInt(numMatch[0], 10) : raw.toLowerCase();
    }
    case 'name': return (job.name || '').toLowerCase();
    case 'client': return (job.client || '').toLowerCase();
    case 'status': {
      const idx = CON_JOB_STATUSES.indexOf(job.status);
      return idx === -1 ? 999 : idx;
    }
    case 'contractValue': return getJobValue(job);
    case 'statusDate': return job.statusDate || job.startDate || '';
    case 'salesRep': return (job.superintendent || job.pm || '').toLowerCase();
    default: return '';
  }
}

function _updateSortArrows() {
  ['jobNumber','name','client','status','contractValue','statusDate','salesRep'].forEach(col => {
    const el = document.getElementById('sortArrow_' + col);
    if (!el) return;
    if (_jobsListSortCol === col) {
      el.textContent = _jobsListSortDir === 'asc' ? '▲' : '▼';
    } else {
      el.textContent = '';
    }
  });
}

function conRenderList() {
  const tbody = document.getElementById('conListBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let jobsToRender = conJobs.slice();
  if (_jobsListSortCol) {
    const col = _jobsListSortCol;
    const dir = _jobsListSortDir === 'asc' ? 1 : -1;
    jobsToRender.sort((a, b) => {
      const va = _jobsListSortValue(a, col);
      const vb = _jobsListSortValue(b, col);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }
  _updateSortArrows();

  jobsToRender.forEach(job => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'cursor:pointer';
    tr.onclick = () => openJobDetail(job.id);
    const val = getJobValue(job) ? '$' + Math.round(getJobValue(job)).toLocaleString() : '—';
    tr.innerHTML = `
      <td style="color:var(--amber);font-weight:700;white-space:nowrap">${job.jobNumber || '—'}</td>
      <td style="font-weight:600">${esc(job.name)}</td>
      <td class="hide-mobile">${esc(job.client)}</td>
      <td><span style="background:var(--amber-light);color:var(--amber);padding:3px 8px;border-radius:8px;font-size:.78rem;white-space:nowrap">${esc(job.status)}</span></td>
      <td class="hide-mobile" style="color:#a3f2d2">${val}</td>
      <td class="hide-mobile">${job.startDate || '—'}</td>
      <td class="hide-mobile">${esc(job.superintendent || job.pm || '—')}</td>
      <td>›</td>
    `;
    tbody.appendChild(tr);
  });
}

function getJobValue(job) {
  return Number(job.contractValue || job.approvedOrders || job.pendingOrders || 0);
}

function conRenderStats() {
  const closedStatuses = ['Closed Completed','Closed Lost'];
  const active = conJobs.filter(j => !closedStatuses.includes(j.status));

  // ── Helper: set tile value and color ──
  function setTile(valId, tileId, value, color, topColor) {
    const v = document.getElementById(valId);
    const t = document.getElementById(tileId);
    if (v) { v.textContent = value; v.style.color = color; }
    if (t) t.style.borderTopColor = topColor || color;
  }

  // ── Row 1: Operations ──

  // Active Jobs — amber (neutral count)
  setTile('statActiveJobs', 'statActiveJobsTile', active.length, '#4d8dff', '#4d8dff');

  // Avg Margin
  const margins = active.filter(j => getJobValue(j) > 0 && j.estCost > 0)
    .map(j => (getJobValue(j) - j.estCost) / getJobValue(j) * 100);
  const avgMargin = margins.length ? margins.reduce((a,b) => a+b,0) / margins.length : 0;
  const marginColor = avgMargin >= 20 ? '#1dbb87' : avgMargin >= 15 ? '#f59e0b' : '#ef5350';
  setTile('statAvgMargin', 'statAvgMarginTile', avgMargin.toFixed(1) + '%', marginColor);

  // Estimates Pending — proposals in 'pending' status
  const estPending = conJobs.reduce((count, j) => {
    // We don't have proposals loaded globally — use job status as proxy
    return count;
  }, 0);
  // Load proposals pending count async
  if (conDb && currentCompanyId) {
    let pendingCount = 0;
    const pendingPromises = conJobs.map(j =>
      coll('jobs').doc(j.id).collection('proposals')
        .where('status','==','pending').get()
        .then(s => { pendingCount += s.size; })
        .catch(() => {})
    );
    Promise.all(pendingPromises).then(() => {
      const epColor = pendingCount === 0 ? '#1dbb87' : pendingCount <= 2 ? '#f59e0b' : '#ef5350';
      setTile('statEstPending', 'statEstPendingTile', pendingCount, epColor);
    });
  }

  // Close Rate — approved ÷ (approved + declined) proposals
  if (conDb) {
    let approved = 0, total = 0;
    const crPromises = conJobs.map(j =>
      coll('jobs').doc(j.id).collection('proposals').get()
        .then(s => s.forEach(d => {
          const st = d.data().status;
          if (st === 'approved') { approved++; total++; }
          else if (st === 'declined') total++;
        })).catch(() => {})
    );
    Promise.all(crPromises).then(() => {
      const rate = total > 0 ? Math.round(approved / total * 100) : null;
      const crColor = rate === null ? '#94a3b8' : rate >= 50 ? '#1dbb87' : rate >= 30 ? '#f59e0b' : '#ef5350';
      setTile('statCloseRate', 'statCloseRateTile', rate !== null ? rate + '%' : '—', crColor);
    });
  }

  // Unprocessed COs
  if (conDb) {
    let unprocessed = 0;
    const coPromises = conJobs.map(j =>
      coll('jobs').doc(j.id).collection('changeorders').get()
        .then(s => s.forEach(d => {
          const st = (d.data().status || '').toLowerCase();
          if (!['approved','declined','rejected','paid','invoiced'].includes(st)) unprocessed++;
        })).catch(() => {})
    );
    Promise.all(coPromises).then(() => {
      const coColor = unprocessed === 0 ? '#1dbb87' : unprocessed <= 2 ? '#f59e0b' : '#ef5350';
      setTile('statUnprocessedCO', 'statUnprocessedCOTile', unprocessed, coColor);
      setNavBadge('navCOBadge', unprocessed);
    });
  }

  // Logs Today — color signal
  const logsEl = document.getElementById('statLogsToday');
  if (logsEl && conDb) {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      conDb.collectionGroup('logs').where('date','==',today).get().catch(() => null),
      coll('timeEntries').where('date','==',today).where('clockOut','!=',null).get().catch(() => null)
    ]).then(([logsSnap, timeSnap]) => {
      const logCount = logsSnap ? logsSnap.size : 0;
      const clockedOutCount = timeSnap ? new Set(timeSnap.docs.map(d => d.data().userId)).size : 0;
      let logsColor = '#1dbb87', logsVal = logCount.toString();
      if (clockedOutCount > 0) {
        if (logCount === 0) { logsColor = '#ef5350'; logsVal = '⚠ 0'; }
        else if (logCount < clockedOutCount) { logsColor = '#f59e0b'; logsVal = `${logCount}/${clockedOutCount}`; }
      }
      setTile('statLogsToday', 'statLogsTile', logsVal, logsColor);
    }).catch(() => { if (logsEl) logsEl.textContent = '—'; });
  }

  // ── Row 2: Money ──

  // Contract Value — amber (reference)
  const totalContract = active.reduce((s,j) => s + getJobValue(j), 0);
  setTile('statContractTotal', 'statContractWrap',
    '$' + Math.round(totalContract).toLocaleString(), '#f59e0b');

  // Avg Job Value
  const avgJobVal = active.length ? totalContract / active.length : 0;
  const ajvColor = avgJobVal >= 8000 ? '#1dbb87' : avgJobVal >= 3000 ? '#f59e0b' : '#ef5350';
  setTile('statAvgJobVal', 'statAvgJobValTile',
    avgJobVal ? '$' + Math.round(avgJobVal).toLocaleString() : '—', ajvColor);

  // Outstanding Invoices — sum unpaid across all jobs
  if (conDb) {
    let outstanding = 0;
    const invPromises = conJobs.map(j =>
      coll('jobs').doc(j.id).collection('invoices').get()
        .then(s => s.forEach(d => {
          const inv = d.data();
          if (inv.status !== 'Paid') outstanding += (inv.total || 0) - (inv.amtPaid || 0);
        })).catch(() => {})
    );
    Promise.all(invPromises).then(() => {
      const outColor = outstanding === 0 ? '#1dbb87' : outstanding <= 10000 ? '#f59e0b' : '#ef5350';
      setTile('statOutstanding', 'statOutstandingTile',
        outstanding > 0 ? '$' + Math.round(outstanding).toLocaleString() : '$0', outColor);
    });
  }

  // QBO MTD numbers — load from cached Firestore doc (written by daily Cloud Function)
  if (conDb && currentCompanyId) {
    coll('kpiCache').doc('mtd').get().then(doc => {
      if (!doc.exists) {
        // No cache yet — show dashes
        ['statCollectedMTD','statSpentMTD','statNetMTD'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '—';
        });
        return;
      }
      const d = doc.data();
      const collected = d.collectedMTD || 0;
      const spent = d.spentMTD || 0;
      const net = collected - spent;

      setTile('statCollectedMTD', 'statCollectedTile',
        '$' + Math.round(collected).toLocaleString(), '#1dbb87');
      setTile('statSpentMTD', 'statSpentTile',
        '$' + Math.round(spent).toLocaleString(), '#f59e0b');

      const netColor = net > 0 ? '#1dbb87' : net < 0 ? '#ef5350' : '#f59e0b';
      setTile('statNetMTD', 'statNetTile',
        (net >= 0 ? '+$' : '-$') + Math.abs(Math.round(net)).toLocaleString(), netColor);
    }).catch(() => {});
  }
}

function conRenderSchedule() {
  const el = document.getElementById('conScheduleList');
  if (!el) return;
  const jobsWithDates = conJobs.filter(j => j.startDate && ACTIVE_STATUSES.includes(j.status));
  if (!jobsWithDates.length) { el.innerHTML = '<p class="muted">No active jobs with scheduled dates.</p>'; return; }
  el.innerHTML = jobsWithDates.sort((a,b) => a.startDate.localeCompare(b.startDate)).map(j => `
    <div class="fin-row">
      <div>
        <div style="font-weight:700">${j.name}</div>
        <div class="small muted">${j.client} · ${j.status}</div>
      </div>
      <div style="text-align:right">
        <div class="small" style="color:var(--amber)">${j.startDate} → ${j.endDate || 'TBD'}</div>
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════
// ── JOBTREAD CSV IMPORT (financials by job number) ──
// Privacy: customer-name columns are never read or stored.
// Join key: job number parsed from invoice document strings.
// ════════════════════════════════════════════════════

// RFC-4180-ish CSV parser: handles quotes, escaped quotes, embedded newlines/commas.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(c => c && c.trim())).map(r => {
    const o = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] || '').trim(); });
    return o;
  });
}

// "Customer Invoice 1065-124" -> "1065", "Invoice 1-11" -> "1"
function jobNumFromInvoice(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*-\s*\d+/);
  return m ? m[1] : null;
}

function num(v) { return parseFloat(String(v||'').replace(/[$,]/g,'')) || 0; }

function detectImportType(headers) {
  const h = headers.map(x => x.toLowerCase());
  const has = (...cols) => cols.every(c => h.includes(c));
  if (has('document name') && h.includes('amount') && h.includes('source')) return 'payments';
  // Invoices carry State/City/County; Orders do not — that's the clean discriminator.
  if (has('document','total','subtotal') && h.includes('city') && h.includes('county')) return 'invoices';
  if (has('document','total','subtotal') && h.includes('close message') && !h.includes('city')) return 'orders';
  if (has('document','ext price') && h.includes('job')) return 'costitems';
  if (has('document','vendor') && h.includes('total')) return 'vendorbills';
  if (has('hours (decimal)','job') && h.includes('user')) return 'timeentries';
  return null;
}

// Burdened hourly rates (Standard / Overtime) from JobTread team rate cards.
// Editable later via Settings; missing people fall back to LABOR_DEFAULT_RATE.
const LABOR_DEFAULT_RATE = 36.91; // blended, derived from JobTread ground truth
let LABOR_RATES = {
  'Gonzalo Domingo': { std: 40.42, ot: 60.63 },
  'Shane Martin':    { std: 45.07, ot: 67.61 },
  'Jason Hudson':    { std: 51.80, ot: 77.70 },
  'Eric Leezy':      { std: 37.90, ot: 56.84 },
  'Kam Bradley':     { std: 37.90, ot: 56.84 },
  'Lucas Martin':    { std: 34.36, ot: 51.55 },
  'Troy Miller':     { std: 49.15, ot: 73.73 },
  'Dave Howell':     { std: 31.70, ot: 47.56 },
  // Field techs — burdened rates derived from JobTread labor totals (no rate card on file).
  // Ordering per Travis: Mike Morris paid above Rosalio/Francisco; Tyler treated as base tech.
  'Rosalio Tomas':   { std: 22.00, ot: 33.00, derived: true },
  'Francisco Tomas': { std: 22.00, ot: 33.00, derived: true },
  'Tyler Rallo':     { std: 22.00, ot: 33.00, derived: true },
  'Mike Morris':     { std: 26.00, ot: 39.00, derived: true }
};

function laborRateFor(user, type) {
  const card = LABOR_RATES[user];
  const isOT = (type||'').toLowerCase().startsWith('over');
  if (!card) return { rate: LABOR_DEFAULT_RATE, estimated: true };
  return { rate: isOT ? (card.ot || card.std) : card.std, estimated: !!card.derived };
}


let _pendingImport = null;

let _importResultId = 'importResult';
async function handleImportFiles(fileList, resultId) {
  if (resultId) _importResultId = resultId;
  const files = Array.from(fileList || []);
  const out = document.getElementById(_importResultId);
  if (!files.length || !out) return;
  out.innerHTML = '<div class="small muted">Reading ' + files.length + ' file(s)…</div>';

  const collected = {};   // jobNum -> total paid
  const invoicedByFile = { invoices:{}, costitems:{} };
  const approved = {};    // jobNum -> approved contract (orders)
  const billCost = {};    // jobNum -> vendor bill cost (non-void)
  const laborCost = {};   // jobNum -> labor cost from time entries
  const laborEstimated = {}; // jobNum -> true if any hours used a fallback rate
  const seen = [];
  const unknownFiles = [];

  // Job number from a document string like "Proposal 1065-1", "Expense 1065-6", "Order 1065-1"
  const jobNumFromDoc = s => { const m = String(s||'').match(/(\d+)\s*-\s*\d+/); return m ? m[1] : null; };
  // Job number from Time Entries "Job" column like "1065-30474Highway161-Rehab"
  const jobNumFromJobCol = s => { const m = String(s||'').match(/^\s*(\d+)/); return m ? m[1] : null; };

  for (const file of files) {
    let text;
    try { text = await file.text(); } catch(e) { unknownFiles.push(file.name + ' (unreadable)'); continue; }
    const objs = csvToObjects(text);
    if (!objs.length) { unknownFiles.push(file.name + ' (empty)'); continue; }
    const type = detectImportType(Object.keys(objs[0]));
    if (!type) { unknownFiles.push(file.name + ' (unrecognized headers)'); continue; }

    const countsAsInvoiced = st => { const s = (st||'').toLowerCase(); return s !== 'draft' && s !== 'void' && s !== 'canceled' && s !== 'cancelled'; };

    if (type === 'payments') {
      objs.forEach(o => { const jn = jobNumFromInvoice(o['Document Name']); if (jn) collected[jn] = (collected[jn]||0) + num(o['Amount']); });
    } else if (type === 'invoices') {
      objs.forEach(o => { if (!countsAsInvoiced(o['Status'])) return; const jn = jobNumFromDoc(o['Document']); if (jn) invoicedByFile.invoices[jn] = (invoicedByFile.invoices[jn]||0) + num(o['Total']); });
    } else if (type === 'costitems') {
      objs.forEach(o => { if (!countsAsInvoiced(o['Status'])) return; const jn = jobNumFromDoc(o['Document']); if (jn) invoicedByFile.costitems[jn] = (invoicedByFile.costitems[jn]||0) + num(o['Ext Price']); });
    } else if (type === 'orders') {
      // Approved Price = sum of Approved orders (base proposal + approved change orders)
      objs.forEach(o => { if ((o['Status']||'') !== 'Approved') return; const jn = jobNumFromDoc(o['Document']); if (jn) approved[jn] = (approved[jn]||0) + num(o['Total']); });
    } else if (type === 'vendorbills') {
      objs.forEach(o => { if ((o['Status']||'') === 'Void') return; const jn = jobNumFromDoc(o['Document']); if (jn) billCost[jn] = (billCost[jn]||0) + num(o['Total']); });
    } else if (type === 'timeentries') {
      // Labor cost = hours × per-person burdened rate (Standard/Overtime). Never reads name/email as identity beyond rate lookup.
      objs.forEach(o => {
        const jn = jobNumFromJobCol(o['Job']); if (!jn) return;
        const hrs = num(o['Hours (Decimal)']); if (!hrs) return;
        const { rate, estimated } = laborRateFor((o['User']||'').trim(), o['Type']);
        laborCost[jn] = (laborCost[jn]||0) + hrs * rate;
        if (estimated) laborEstimated[jn] = true;
      });
    }
    seen.push({ name: file.name, type, rows: objs.length });
  }

  const invoiced = { ...invoicedByFile.costitems, ...invoicedByFile.invoices };

  const allJobNums = new Set([
    ...Object.keys(collected), ...Object.keys(invoiced),
    ...Object.keys(approved), ...Object.keys(billCost), ...Object.keys(laborCost)
  ]);
  const updates = [];
  const unmatched = [];
  allJobNums.forEach(jn => {
    const job = conJobs.find(j => String(j.jobNumber) === String(jn));
    if (!job) { unmatched.push(jn); return; }
    const u = { job, jobNum: jn };
    if (collected[jn] !== undefined) u.collected = Math.round(collected[jn]*100)/100;
    if (invoiced[jn] !== undefined) u.invoiced = Math.round(invoiced[jn]*100)/100;
    if (approved[jn] !== undefined) u.approvedPrice = Math.round(approved[jn]*100)/100;
    // Actual cost = vendor bills + labor (either may be absent)
    const bc = billCost[jn], lc = laborCost[jn];
    if (bc !== undefined || lc !== undefined) {
      u.billCost = bc !== undefined ? Math.round(bc*100)/100 : undefined;
      u.laborCost = lc !== undefined ? Math.round(lc*100)/100 : undefined;
      u.actualCost = Math.round(((bc||0) + (lc||0))*100)/100;
      if (laborEstimated[jn]) u.laborEstimated = true;
    }
    updates.push(u);
  });
  updates.sort((a,b) => Number(a.jobNum) - Number(b.jobNum));

  _pendingImport = updates;
  const fmtM = v => v===undefined?'—':'$'+Math.round(v).toLocaleString();

  // Portfolio roll-up (better than JobTread: see the whole book at once)
  let portApproved=0, portCost=0, portJobs=0, negJobs=[];
  updates.forEach(u => {
    if (u.approvedPrice!==undefined && u.actualCost!==undefined) {
      portApproved += u.approvedPrice; portCost += u.actualCost; portJobs++;
      const m = u.approvedPrice>0 ? (u.approvedPrice-u.actualCost)/u.approvedPrice*100 : 0;
      if (m < 0) negJobs.push({ jn:u.jobNum, m });
    }
  });
  const portMargin = portApproved>0 ? (portApproved-portCost)/portApproved*100 : 0;

  let html = '<div style="border:1px solid var(--line);border-radius:10px;padding:14px">';
  html += '<div style="font-weight:800;margin-bottom:8px">Import preview</div>';
  seen.forEach(s => { html += '<div class="small" style="color:#a3f2d2">✓ ' + esc(s.name) + ' — ' + s.type + ' (' + s.rows + ' rows)</div>'; });
  unknownFiles.forEach(u => { html += '<div class="small" style="color:#fca5a5">✗ ' + esc(u) + '</div>'; });
  html += '<div style="height:1px;background:var(--line);margin:10px 0"></div>';

  // Portfolio card
  if (portJobs > 0) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">'
      + '<div class="kt-card" style="padding:10px 12px"><div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;font-weight:700">Portfolio Approved</div><div style="font-size:1.1rem;font-weight:900;color:#a3f2d2">'+fmtM(portApproved)+'</div></div>'
      + '<div class="kt-card" style="padding:10px 12px"><div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;font-weight:700">Portfolio Cost</div><div style="font-size:1.1rem;font-weight:900">'+fmtM(portCost)+'</div></div>'
      + '<div class="kt-card" style="padding:10px 12px"><div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;font-weight:700">Blended Margin</div><div style="font-size:1.1rem;font-weight:900;color:'+(portMargin>=0?'#a3f2d2':'#fca5a5')+'">'+portMargin.toFixed(1)+'%</div></div>'
      + '<div class="kt-card" style="padding:10px 12px"><div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;font-weight:700">Jobs Underwater</div><div style="font-size:1.1rem;font-weight:900;color:'+(negJobs.length?'#fca5a5':'#a3f2d2')+'">'+negJobs.length+'</div></div>'
      + '</div>';
    if (negJobs.length) {
      negJobs.sort((a,b)=>a.m-b.m);
      html += '<div style="font-size:.74rem;color:#fca5a5;margin-bottom:10px">⚠ Negative-margin jobs: '
        + negJobs.slice(0,15).map(n=>'#'+n.jn+' ('+n.m.toFixed(0)+'%)').join(', ') + (negJobs.length>15?'…':'') + '</div>';
    }
  }

  html += '<div class="small muted" style="margin-bottom:8px">' + updates.length + ' job(s) matched'
        + (unmatched.length ? ' · ' + unmatched.length + ' unmatched job #: ' + unmatched.slice(0,12).join(', ') + (unmatched.length>12?'…':'') : '') + '</div>';

  if (updates.length) {
    html += '<div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px">';
    html += '<div style="display:grid;grid-template-columns:60px 1fr 1fr 1fr 1fr;gap:6px;padding:7px 10px;font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)"><span>Job#</span><span style="text-align:right">Approved</span><span style="text-align:right">Cost</span><span style="text-align:right">Collected</span><span style="text-align:right">Margin</span></div>';
    updates.slice(0,300).forEach(u => {
      const m = (u.approvedPrice!==undefined && u.actualCost!==undefined && u.approvedPrice>0)
        ? (u.approvedPrice-u.actualCost)/u.approvedPrice*100 : null;
      html += '<div style="display:grid;grid-template-columns:60px 1fr 1fr 1fr 1fr;gap:6px;padding:6px 10px;font-size:.8rem;border-bottom:1px solid rgba(110,145,210,.06)">'
            + '<span style="color:var(--amber);font-weight:700">' + esc(u.jobNum) + (u.laborEstimated?' <span title="labor partially estimated" style="color:#f59e0b">~</span>':'') + '</span>'
            + '<span style="text-align:right">' + fmtM(u.approvedPrice) + '</span>'
            + '<span style="text-align:right">' + fmtM(u.actualCost) + '</span>'
            + '<span style="text-align:right">' + fmtM(u.collected) + '</span>'
            + '<span style="text-align:right;font-weight:700;color:'+(m===null?'var(--muted)':(m>=0?'#a3f2d2':'#fca5a5'))+'">' + (m===null?'—':m.toFixed(1)+'%') + '</span></div>';
    });
    html += '</div>';
    html += '<div style="font-size:.68rem;color:var(--muted);margin-top:6px">~ = labor cost partially estimated (missing rate card)</div>';
    html += '<div style="margin-top:12px"><button class="btn-amber" onclick="commitImport()" style="padding:9px 18px;font-weight:700">✓ Apply to ' + updates.length + ' job(s)</button>'
          + '<button class="btn" onclick="document.getElementById(_importResultId).innerHTML=\'\';_pendingImport=null" style="margin-left:8px;padding:9px 18px">Cancel</button></div>';
  } else {
    html += '<div class="small" style="color:#fca5a5">No matching jobs. Confirm job numbers in JOBSMETRIX match your estimates.</div>';
  }
  html += '</div>';
  out.innerHTML = html;
}

async function commitImport() {
  if (!_pendingImport || !_pendingImport.length || !conDb) return;
  const out = document.getElementById(_importResultId);
  const total = _pendingImport.length;
  let done = 0, failed = 0, firstError = '';
  if (out) out.innerHTML = '<div class="small muted">Applying… 0/' + total + '</div>';

  for (const u of _pendingImport) {
    const patch = { financialsSyncedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (u.collected !== undefined) patch.collected = u.collected;
    if (u.invoiced !== undefined) patch.invoiced = u.invoiced;
    if (u.approvedPrice !== undefined) patch.contractValue = u.approvedPrice;
    if (u.actualCost !== undefined) patch.actualCost = u.actualCost;
    if (u.laborCost !== undefined) patch.laborCost = u.laborCost;
    if (u.billCost !== undefined) patch.billCost = u.billCost;
    if (u.laborEstimated) patch.laborEstimated = true;
    try {
      await coll('jobs').doc(u.job.id).update(patch);
      const j = conJobs.find(x => x.id === u.job.id);
      if (j) {
        if (u.collected!==undefined) j.collected = u.collected;
        if (u.invoiced!==undefined) j.invoiced = u.invoiced;
        if (u.approvedPrice!==undefined) j.contractValue = u.approvedPrice;
        if (u.actualCost!==undefined) j.actualCost = u.actualCost;
        if (u.laborCost!==undefined) j.laborCost = u.laborCost;
        if (u.billCost!==undefined) j.billCost = u.billCost;
      }
      done++;
    } catch(e) {
      failed++;
      if (!firstError) firstError = (e && e.message) ? e.message : String(e);
    }
    // Update every iteration so it never looks frozen
    if (out) out.innerHTML = '<div class="small muted">Applying… ' + (done+failed) + '/' + total + (failed ? ' · ' + failed + ' failed' : '') + '</div>';
  }

  if (out) {
    if (done === 0 && failed > 0) {
      out.innerHTML = '<div style="border:1px solid rgba(239,83,80,.35);background:rgba(239,83,80,.08);border-radius:10px;padding:14px">'
        + '<div style="font-weight:800;color:#fca5a5">✗ Import failed — no jobs updated</div>'
        + '<div class="small muted" style="margin-top:6px">All ' + failed + ' writes were rejected. This is almost always a Firestore permissions issue — your role may not have write access to jobs.</div>'
        + '<div class="small" style="margin-top:6px;color:#fca5a5;font-family:monospace;word-break:break-word">' + esc(firstError || 'unknown error') + '</div></div>';
    } else {
      out.innerHTML = '<div style="border:1px solid rgba(29,187,135,.3);background:rgba(29,187,135,.08);border-radius:10px;padding:14px">'
        + '<div style="font-weight:800;color:#a3f2d2">✓ Import complete</div>'
        + '<div class="small muted" style="margin-top:4px">' + done + ' job(s) updated' + (failed?', '+failed+' failed ('+esc(firstError)+')':'') + '. Reopen any job to see refreshed financials.</div></div>';
    }
  }
  _pendingImport = null;
  if (conCurrentJobId) { const j = conJobs.find(x=>x.id===conCurrentJobId); if (j) refreshJobFinancials(j); }
}

// ════════════════════════════════════════════════════
// ── TEAM CACHE + shared option helpers ──
// ════════════════════════════════════════════════════
let allTeamMembers = [];
// Real-time typeahead against the actual team roster (allTeamMembers,
// already loaded at app startup via loadTeamCache) — not a native
// <datalist>, since Safari/iOS has a real history of not supporting that
// reliably. Still a free-text input underneath (not select-only), since a
// Superintendent/PM might occasionally be someone not yet added to the
// team roster.
function filterNameAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;
  const query = input.value.trim().toLowerCase();

  const matches = allTeamMembers.filter(m => {
    const name = m.name || m.displayName || m.email || '';
    return name && name.toLowerCase().includes(query);
  });

  if (!matches.length) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; return; }

  dropdown.innerHTML = matches.map(m => {
    const name = m.name || m.displayName || m.email || '';
    return `<div class="name-autocomplete-item" onmousedown="selectNameAutocomplete('${inputId}','${dropdownId}','${esc(name).replace(/'/g,"\\'")}')">${esc(name)}${m.role ? `<span class="role-tag">${esc(m.role)}</span>` : ''}</div>`;
  }).join('');
  dropdown.style.display = 'block';
}
window.filterNameAutocomplete = filterNameAutocomplete;

function selectNameAutocomplete(inputId, dropdownId, name) {
  const input = document.getElementById(inputId);
  if (input) input.value = name;
  hideNameAutocomplete(dropdownId);
}
window.selectNameAutocomplete = selectNameAutocomplete;

function hideNameAutocomplete(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) dropdown.style.display = 'none';
}
window.hideNameAutocomplete = hideNameAutocomplete;

function loadTeamCache() {
  if (!conDb) return;
  coll('settings').doc('team').get()
    .then(doc => {
      const members = doc.exists ? extractTeamMembers(doc.data()) : {};
      allTeamMembers = Object.values(members);
    })
    .catch(() => { allTeamMembers = []; });
}
// <option> HTML for team members (value = name). Optional selected + placeholder.
function getTeamMemberOpts(selected, placeholder) {
  let html = '<option value="">' + (placeholder || '— Select —') + '</option>';
  allTeamMembers.forEach(m => {
    const name = m.name || m.displayName || m.email || '';
    if (!name) return;
    html += '<option value="' + esc(name) + '"' + (name === selected ? ' selected' : '') + '>' + esc(name) + (m.role ? ' · ' + esc(m.role) : '') + '</option>';
  });
  return html;
}
// value = email variant
function getTeamMemberOptsEmail(selected, placeholder) {
  let html = '<option value="">' + (placeholder || '— Unassigned —') + '</option>';
  allTeamMembers.forEach(m => {
    const email = m.email || '';
    const name = m.name || m.displayName || email;
    if (!email) return;
    html += '<option value="' + esc(email) + '"' + (email === selected ? ' selected' : '') + '>' + esc(name) + '</option>';
  });
  return html;
}

// ════════════════════════════════════════════════════
// ── PER-JOB TO-DOS ──
// ════════════════════════════════════════════════════
function renderJobTodos(jobId) {
  // Populate assignee dropdown
  const asgn = document.getElementById('jobTodoAssignee');
  if (asgn) asgn.innerHTML = getTeamMemberOptsEmail('', 'Assign to…');

  const list = document.getElementById('jobTodoList');
  const stats = document.getElementById('jobTodoStats');
  if (!list) return;
  const today = new Date().toISOString().split('T')[0];
  const todos = (allTodos || []).filter(t => t.jobId === jobId);
  const open = todos.filter(t => !t.done).length;
  const done = todos.filter(t => t.done).length;
  const overdue = todos.filter(t => !t.done && t.dueDate && t.dueDate < today).length;
  if (stats) stats.innerHTML = `<span>${open} open</span><span>${done} completed</span>` + (overdue ? `<span style="color:#fca5a5">${overdue} overdue</span>` : '');

  if (!todos.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No to-dos for this job yet. Add one above.</div>';
    return;
  }
  todos.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = a.priority==='high'?0:a.priority==='med'?1:2, pb = b.priority==='high'?0:b.priority==='med'?1:2;
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : b.dueDate ? 1 : 0;
  });
  const pColors = { high:'#ef5350', med:'#f97316', normal:'var(--amber-border)' };
  list.innerHTML = todos.map(todo => {
    const pColor = pColors[todo.priority] || 'var(--amber-border)';
    const isOverdue = !todo.done && todo.dueDate && todo.dueDate < today;
    return `<div class="todo-item ${todo.done?'done':''}" style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px">
      <div onclick="toggleTodo('${todo.id}',${!todo.done})" style="width:22px;height:22px;border-radius:6px;border:2px solid ${pColor};${todo.done?'background:'+pColor:''};cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;color:#04121f;font-weight:900">${todo.done?'✓':''}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.9rem;font-weight:${todo.done?'400':'600'};color:${todo.done?'var(--muted)':'#eaf0fb'};${todo.done?'text-decoration:line-through':''}">${esc(todo.text||'')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:5px">
          ${todo.priority==='high'?'<span style="font-size:.68rem;background:#ef535022;color:#fca5a5;border-radius:999px;padding:1px 7px;font-weight:700">HIGH</span>':''}
          ${todo.priority==='med'?'<span style="font-size:.68rem;background:#f9731622;color:#fed7aa;border-radius:999px;padding:1px 7px;font-weight:700">MED</span>':''}
          ${todo.assignee?`<span style="font-size:.72rem;color:var(--muted)">👤 ${esc(todo.assigneeName||todo.assignee)}</span>`:''}
          ${todo.dueDate?`<span style="font-size:.72rem;color:${isOverdue?'#fca5a5':'var(--muted)'}">📅 ${todo.dueDate}${isOverdue?' ⚠️':''}</span>`:''}
        </div>
      </div>
      <button onclick="deleteTodo('${todo.id}')" style="background:none;border:none;color:rgba(239,83,80,.5);cursor:pointer;font-size:.95rem;flex-shrink:0">🗑</button>
    </div>`;
  }).join('');
}

function addJobTodo() {
  const input = document.getElementById('jobTodoInput');
  const text = (input?.value || '').trim();
  if (!text) { input?.focus(); return; }
  if (!conDb || !conCurrentJobId) return;
  const asgnEl = document.getElementById('jobTodoAssignee');
  const asgnEmail = asgnEl?.value || '';
  const asgnName = asgnEmail ? (asgnEl.options[asgnEl.selectedIndex]?.text || '') : '';
  const job = conJobs.find(j => j.id === conCurrentJobId);
  coll('todos').add({
    text,
    priority: document.getElementById('jobTodoPriority')?.value || 'normal',
    dueDate: document.getElementById('jobTodoDue')?.value || '',
    jobId: conCurrentJobId,
    jobName: job?.name || '',
    assignee: asgnEmail,
    assigneeName: asgnName,
    done: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
    createdByName: conCurrentUser?.displayName || conCurrentUser?.email || ''
  }).then(() => {
    if (input) input.value = '';
    const due = document.getElementById('jobTodoDue'); if (due) due.value = '';
    // allTodos updates via snapshot; re-render shortly after
    setTimeout(() => renderJobTodos(conCurrentJobId), 400);
  }).catch(e => alert('Error: ' + e.message));
}

// ════════════════════════════════════════════════════
// ── SELECTIONS (customer material/finish choices) ──
// Stored at jobs/{id}/selections
// ════════════════════════════════════════════════════
const SELECTION_ROOMS = ['Exterior','Kitchen','Living','Dining','Entry','Hallway','Bedroom 1','Bedroom 2','Bedroom 3','Bathroom 1','Bathroom 2','Bathroom 3','Basement','Garage','Global','Other'];
let _selections = [];
function loadSelections(jobId) {
  const list = document.getElementById('selectionsList');
  if (!list) return;
  list.innerHTML = '<div class="small muted" style="padding:12px">Loading selections…</div>';
  coll('jobs').doc(jobId).collection('selections').get()
    .then(snap => { _selections = []; snap.forEach(d => _selections.push({ id:d.id, ...d.data() })); renderSelections(); })
    .catch(() => { _selections = []; renderSelections(); });
}
function renderSelections() {
  const list = document.getElementById('selectionsList');
  const sum = document.getElementById('selectionsSummary');
  if (!list) return;
  const total = _selections.length;
  const chosen = _selections.filter(s => s.status === 'Selected' || s.status === 'Approved' || s.status === 'Ordered').length;
  if (sum) sum.innerHTML = `<span>${total} item(s)</span><span style="color:#a3f2d2">${chosen} chosen</span><span>${total-chosen} pending</span>`;
  if (!total) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No selections yet. Add materials and finishes the customer needs to choose.</div>';
    return;
  }
  // Group by room
  const byRoom = {};
  _selections.forEach(s => { const r = s.room || 'Other'; (byRoom[r] = byRoom[r] || []).push(s); });
  const statusColor = { Pending:'#f59e0b', Selected:'#4d8dff', Approved:'#1dbb87', Ordered:'#8b5cf6' };
  list.innerHTML = Object.keys(byRoom).map(room => {
    const items = byRoom[room].map(s => {
      const c = statusColor[s.status] || '#8ea3c8';
      return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(110,145,210,.07)">
        <div><div style="font-weight:700;font-size:.86rem">${esc(s.item||'')}</div>
          <div style="font-size:.74rem;color:var(--muted)">${esc(s.choice||'Not yet chosen')}${s.cost?` · $${Number(s.cost).toLocaleString()}`:''}</div></div>
        <span style="font-size:.68rem;font-weight:700;color:${c};background:${c}22;border-radius:999px;padding:2px 9px">${esc(s.status||'Pending')}</span>
        <button onclick="deleteSelection('${s.id}')" style="background:none;border:none;color:rgba(239,83,80,.5);cursor:pointer">🗑</button>
      </div>`;
    }).join('');
    return `<div class="kt-card" style="padding:14px 16px;margin-bottom:12px">
      <div style="font-weight:800;font-size:.92rem;margin-bottom:6px;color:var(--amber)">${esc(room)}</div>${items}</div>`;
  }).join('');
}
function openAddSelection() {
  const room = prompt('Room (e.g. Kitchen, Bathroom 1, Exterior):', 'Kitchen');
  if (room === null) return;
  const item = prompt('What needs to be selected? (e.g. Flooring, Countertop, Paint color):');
  if (!item) return;
  const choice = prompt('Customer\'s choice (leave blank if not chosen yet):') || '';
  if (!conDb || !conCurrentJobId) return;
  coll('jobs').doc(conCurrentJobId).collection('selections').add({
    room: room || 'Other', item, choice, status: choice ? 'Selected' : 'Pending', cost: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => loadSelections(conCurrentJobId)).catch(e => alert('Error: ' + e.message));
}
function deleteSelection(id) {
  if (!conDb || !conCurrentJobId || !confirm('Delete this selection?')) return;
  coll('jobs').doc(conCurrentJobId).collection('selections').doc(id).delete()
    .then(() => loadSelections(conCurrentJobId)).catch(e => alert('Error: ' + e.message));
}

// ════════════════════════════════════════════════════
// ── SPECIFICATIONS (scope pulled from the estimate) ──
// Read-only view grouped by room/trade from estimate line items.
// ════════════════════════════════════════════════════
function loadSpecifications(jobId) {
  const list = document.getElementById('specificationsList');
  if (!list) return;
  list.innerHTML = '<div class="small muted" style="padding:12px">Building specifications from the estimate…</div>';
  const jobRef = coll('jobs').doc(jobId);
  const items = [];
  jobRef.collection('estimateGroups').get().then(async groupSnap => {
    for (const g of groupSnap.docs) {
      const gName = g.data().name || 'General';
      const direct = await jobRef.collection('estimateGroups').doc(g.id).collection('items').get();
      direct.forEach(d => items.push({ group:gName, ...d.data() }));
      const subs = await jobRef.collection('estimateGroups').doc(g.id).collection('subgroups').get();
      for (const s of subs.docs) {
        const sName = s.data().name || '';
        const it = await jobRef.collection('estimateGroups').doc(g.id).collection('subgroups').doc(s.id).collection('items').get();
        it.forEach(d => items.push({ group:gName, subgroup:sName, ...d.data() }));
      }
    }
    renderSpecifications(items);
  }).catch(() => renderSpecifications([]));
}
function renderSpecifications(items) {
  const list = document.getElementById('specificationsList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No estimate line items to build specifications from. Build the estimate first.</div>';
    return;
  }
  // Group by room (fallback to subgroup, then group), then by trade
  const byRoom = {};
  items.forEach(it => {
    const room = it.room || it.subgroup || it.group || 'General';
    (byRoom[room] = byRoom[room] || []).push(it);
  });
  list.innerHTML = Object.keys(byRoom).sort().map(room => {
    const rows = byRoom[room].map(it => {
      const desc = it.description || it.name || it.desc || '';
      const spec = it.specifications || it.spec || '';
      const qty = it.qty ? `${it.qty}${it.unit?' '+it.unit:''}` : '';
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07)">
        <div><div style="font-size:.85rem;font-weight:600">${esc(desc)}</div>
          ${spec?`<div style="font-size:.74rem;color:var(--muted)">${esc(spec)}</div>`:''}
          ${it.trade?`<span style="font-size:.68rem;color:var(--amber)">${esc(it.trade)}</span>`:''}</div>
        <div style="font-size:.78rem;color:var(--muted);white-space:nowrap">${esc(qty)}</div>
      </div>`;
    }).join('');
    return `<div class="kt-card" style="padding:14px 16px;margin-bottom:12px">
      <div style="font-weight:800;font-size:.92rem;margin-bottom:6px;color:var(--amber)">${esc(room)} <span style="color:var(--muted);font-weight:400">· ${byRoom[room].length} item(s)</span></div>${rows}</div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
// ── PLANS (blueprint/drawing uploads) ──
// Stored as documents with category 'Plan' + jobId.
// ════════════════════════════════════════════════════
function loadPlans(jobId) {
  const list = document.getElementById('plansList');
  if (!list) return;
  list.innerHTML = '<div class="small muted" style="padding:12px">Loading plans…</div>';
  coll('documents').where('jobId','==',jobId).where('category','==','Plan').get()
    .then(snap => { const plans = []; snap.forEach(d => plans.push({ id:d.id, ...d.data() })); renderPlans(plans); })
    .catch(() => renderPlans([]));
}
function renderPlans(plans) {
  const list = document.getElementById('plansList');
  if (!list) return;
  if (!plans.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No plans uploaded yet. Upload blueprints or site drawings for the crew.</div>';
    return;
  }
  list.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">' +
    plans.map(p => {
      const isImg = (p.type||'').startsWith('image/') && p.dataUrl;
      const thumb = isImg
        ? `<img src="${p.dataUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0" />`
        : `<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:rgba(110,145,210,.08);border-radius:8px 8px 0 0">📄</div>`;
      const open = p.dataUrl ? `onclick="window.open('${p.dataUrl}','_blank')" style="cursor:pointer"` : '';
      return `<div class="kt-card" style="padding:0;overflow:clip" ${open}>
        ${thumb}
        <div style="padding:8px 10px">
          <div style="font-size:.78rem;font-weight:700;white-space:nowrap;overflow:clip;text-overflow:ellipsis">${esc(p.name||'Plan')}</div>
          <div style="font-size:.68rem;color:var(--muted)">${p.uploadedDate||''}</div>
        </div></div>`;
    }).join('') + '</div>';
}
async function handlePlanUpload(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !conDb || !conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const list = document.getElementById('plansList');
  if (list) list.innerHTML = '<div class="small muted" style="padding:12px">Uploading…</div>';
  for (const file of files) {
    try {
      let dataUrl = null;
      if (file.size <= DOC_SIZE_LIMIT) dataUrl = await fileToBase64(file);
      else if (!confirm(`"${file.name}" is over 500KB and can't be stored yet. Save name only?`)) continue;
      await coll('documents').add({
        name: file.name, type: file.type||'application/octet-stream', size: file.size,
        category: 'Plan', jobId: conCurrentJobId, jobName: job?.name || '', dataUrl,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploadedDate: new Date().toISOString().split('T')[0],
        uploadedBy: conCurrentUser?.email || ''
      });
    } catch(e) { alert('Error uploading ' + file.name + ': ' + e.message); }
  }
  document.getElementById('planUpload').value = '';
  loadPlans(conCurrentJobId);
}

// ════════════════════════════════════════════════════
// ── JOB MESSAGES (internal team thread) ──
// Stored at jobs/{id}/messages, real-time via onSnapshot.
// ════════════════════════════════════════════════════
let _msgUnsub = null;
let _msgJobId = null;

// ── Message Routing (@mentions + customer-message default routing) ────
// Rule (per Travis): customer-facing messages (from the Customer Portal)
// always route to the Owner by default, UNLESS a specific team member is
// @mentioned in the message text - in which case that person gets it
// instead. Internal team messages only trigger a notification when
// someone is explicitly @mentioned (no default routing - avoids SMS'ing
// Travis on every internal chat message).
//
// Mention matching is intentionally simple for v1: "@FirstName" matched
// case-insensitively against the first word of each team member's name.
// Real autocomplete UI can be layered on later; this is enough to make
// the actual routing work correctly today.
//
// NOTE: this only determines WHO should be notified and writes that onto
// the message doc (notifyTargets, notifyStatus:'pending'). The actual SMS
// send happens server-side via the Cloud Function in /functions - it
// can't run client-side since the Twilio auth token must never be
// shipped to the browser.
function parseMentions(text, teamMembers) {
  if (!text) return [];
  const mentionTokens = (text.match(/@([A-Za-z][\w'-]*)/g) || []).map(t => t.slice(1).toLowerCase());
  if (!mentionTokens.length) return [];
  return teamMembers.filter(m => {
    const firstName = (m.name || '').trim().split(/\s+/)[0]?.toLowerCase();
    return firstName && mentionTokens.includes(firstName);
  });
}

function computeNotifyTargets(text, teamMembers, opts) {
  opts = opts || {};
  const mentioned = parseMentions(text, teamMembers);
  const owner = teamMembers.find(m => m.role === 'Owner');

  // Always notify the Owner on every message — no message gets missed.
  // @mentioned team members are added on top of that.
  // If the message IS from the owner themselves, skip their own notification.
  const targets = [];

  // Add owner first (unless they sent the message)
  if (owner && owner.phone) {
    const senderEmail = opts.senderEmail || '';
    if (senderEmail.toLowerCase() !== (owner.email || '').toLowerCase()) {
      targets.push({ name: owner.name, email: owner.email, phone: owner.phone });
    }
  }

  // Add @mentioned people (deduplicated, skip if already in targets)
  mentioned.forEach(m => {
    if (!targets.find(t => t.email === m.email)) {
      targets.push({ name: m.name, email: m.email, phone: m.phone || '' });
    }
  });

  return targets;
}

// Fetches the current team roster as a flat array (helper for message
// sends, which need it fresh rather than relying on whatever's cached).
function fetchTeamMembersFlat(dbRef, companyId) {
  const ref = companyId
    ? dbRef.collection('companies').doc(companyId).collection('settings').doc('team')
    : dbRef.collection('settings').doc('team');
  return ref.get().then(doc => {
    const members = doc.exists ? extractTeamMembers(doc.data()) : {};
    return Object.values(members);
  }).catch(() => []);
}

function loadJobMessages(jobId) {
  _msgJobId = jobId;
  const listEl = document.getElementById('messagesList');
  if (listEl) listEl.innerHTML = '<div class="small muted" style="padding:12px">Loading messages…</div>';
  // Detach any prior listener before attaching a new one
  if (_msgUnsub) { try { _msgUnsub(); } catch(e){} _msgUnsub = null; }
  if (!conDb) return;
  _msgUnsub = coll('jobs').doc(jobId).collection('messages').orderBy('createdAt','asc')
    .onSnapshot(snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id:d.id, ...d.data() }));
      renderJobMessages(msgs);
    }, () => {
      // Fallback without orderBy if index/ordering unavailable
      coll('jobs').doc(jobId).collection('messages').onSnapshot(snap => {
        const msgs = [];
        snap.forEach(d => msgs.push({ id:d.id, ...d.data() }));
        msgs.sort((a,b) => (a.createdMs||0) - (b.createdMs||0));
        renderJobMessages(msgs);
      });
    });
}

function renderJobMessages(msgs) {
  const listEl = document.getElementById('messagesList');
  if (!listEl) return;
  if (!msgs.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No messages yet. Start the conversation below.</div>';
    return;
  }
  const myEmail = conCurrentUser?.email || '';
  listEl.innerHTML = msgs.map(m => {
    const mine = m.authorEmail === myEmail;
    const when = m.createdMs ? new Date(m.createdMs).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
    return `<div style="display:flex;flex-direction:column;align-items:${mine?'flex-end':'flex-start'}">
      <div style="max-width:78%;background:${mine?'rgba(217,119,6,.14)':'rgba(110,145,210,.09)'};border:1px solid ${mine?'rgba(217,119,6,.28)':'rgba(110,145,210,.16)'};border-radius:${mine?'14px 14px 4px 14px':'14px 14px 14px 4px'};padding:9px 13px">
        <div style="font-size:.7rem;color:var(--amber);font-weight:700;margin-bottom:3px">${esc(m.authorName||m.authorEmail||'Unknown')}</div>
        <div style="font-size:.88rem;color:#eaf0fb;white-space:pre-wrap;word-break:break-word">${esc(m.text||'')}</div>
        ${m.visibleToCustomer ? `<div style="font-size:.66rem;color:#34d399;margin-top:4px">📤 Visible to customer</div>` : ''}
        ${(m.notifyTargets && m.notifyTargets.length) ? `<div style="font-size:.68rem;color:#60a5fa;margin-top:5px">📲 ${m.notifyStatus==='sent'?'Texted':'Texting'} ${m.notifyTargets.map(t=>esc(t.name)).join(', ')}</div>` : ''}
      </div>
      <div style="font-size:.66rem;color:var(--muted);margin-top:3px;padding:0 4px">${when}</div>
    </div>`;
  }).join('');
  // Scroll to newest
  listEl.scrollTop = listEl.scrollHeight;
}

// ── @mention dropdown ─────────────────────────────────────────────────────
let _mentionTeamCache = [];

async function handleMentionInput(textarea) {
  const val = textarea.value;
  const cursor = textarea.selectionStart;
  // Find the @ token before the cursor
  const beforeCursor = val.slice(0, cursor);
  const match = beforeCursor.match(/@([A-Za-z][\w'-]*)$/);
  const dropdown = document.getElementById('mentionDropdown');
  if (!dropdown) return;

  if (!match) {
    dropdown.style.display = 'none';
    return;
  }

  const query = match[1].toLowerCase();

  // Load team members once and cache
  if (!_mentionTeamCache.length) {
    _mentionTeamCache = await fetchTeamMembersFlat(conDb, currentCompanyId);
  }

  const matches = _mentionTeamCache.filter(m => {
    const first = (m.name || m.email || '').split(' ')[0].toLowerCase();
    return first.startsWith(query);
  });

  if (!matches.length) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.style.display = 'block';
  dropdown.innerHTML = matches.map(m => {
    const name = m.name || m.email;
    const first = name.split(' ')[0];
    const hasPhone = !!m.phone;
    return `<div onclick="insertMention('${esc(first)}')"
      style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.05)"
      onmouseover="this.style.background='rgba(245,158,11,.12)'"
      onmouseout="this.style.background='transparent'">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;flex-shrink:0">${esc(first[0].toUpperCase())}</div>
      <div>
        <div style="font-weight:700;font-size:.85rem">${esc(name)}</div>
        <div style="font-size:.7rem;color:${hasPhone ? '#4ade80' : 'var(--muted)'}">${hasPhone ? '📱 Will receive SMS' : 'No phone — in-app only'}</div>
      </div>
    </div>`;
  }).join('');
}

function insertMention(firstName) {
  const textarea = document.getElementById('messageInput');
  const dropdown = document.getElementById('mentionDropdown');
  if (!textarea) return;

  const val = textarea.value;
  const cursor = textarea.selectionStart;
  const beforeCursor = val.slice(0, cursor);
  // Replace the partial @mention with the full name
  const newBefore = beforeCursor.replace(/@([A-Za-z][\w'-]*)$/, `@${firstName} `);
  textarea.value = newBefore + val.slice(cursor);
  // Move cursor to after inserted mention
  const newPos = newBefore.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
  if (dropdown) dropdown.style.display = 'none';
}
window.insertMention = insertMention;
window.handleMentionInput = handleMentionInput;

// Close dropdown if clicking outside
document.addEventListener('click', e => {
  const dropdown = document.getElementById('mentionDropdown');
  const textarea = document.getElementById('messageInput');
  if (dropdown && !dropdown.contains(e.target) && e.target !== textarea) {
    dropdown.style.display = 'none';
  }
});

function sendJobMessage() {
  const input = document.getElementById('messageInput');
  const text = (input?.value || '').trim();
  if (!text || !conDb || !conCurrentJobId) return;
  const replyToCustomer = document.getElementById('msgReplyToCustomer')?.checked || false;
  if (input) input.value = '';
  const replyCheckbox = document.getElementById('msgReplyToCustomer');
  if (replyCheckbox) replyCheckbox.checked = false;

  const job = conJobs.find(j => j.id === conCurrentJobId);

  fetchTeamMembersFlat(conDb, currentCompanyId).then(teamMembers => {
    let notifyTargets = computeNotifyTargets(text, teamMembers, { fromCustomer: false, senderEmail: conCurrentUser?.email || '' });
    // If this is a reply to the customer, also notify (text) the customer
    // directly at the phone number on file for this job - separate from
    // the @mention team-routing logic above, both can fire together.
    if (replyToCustomer && job?.phone) {
      notifyTargets = [...notifyTargets, { name: job.client || 'Customer', email: '', phone: job.phone }];
    }
    const data = {
      text,
      authorEmail: conCurrentUser?.email || '',
      authorName: conCurrentUser?.displayName || conCurrentUser?.email || 'Unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdMs: Date.now(),
      companyId: currentCompanyId,
      fromCustomer: false,
      visibleToCustomer: replyToCustomer,
      notifyTargets,
      notifyStatus: notifyTargets.length ? 'pending' : 'none'
    };
    coll('jobs').doc(conCurrentJobId).collection('messages').add(data)
      .catch(e => { alert('Error sending: ' + e.message); if (input) input.value = text; });
  });
}

// ════════════════════════════════════════════════════
// ── JOB REPORTS (budget vs actual) ──
// ════════════════════════════════════════════════════
function renderJobReports(jobId) {
  const el = document.getElementById('reportsContent');
  if (!el) return;
  const job = conJobs.find(j => j.id === jobId);
  if (!job) { el.innerHTML = '<div class="small muted">Job not found.</div>'; return; }

  const fmt = v => '$' + Number(v||0).toLocaleString(undefined,{maximumFractionDigits:0});
  const pct = v => (v||0).toFixed(1) + '%';

  const contract = getJobValue(job);
  const approvedCO = (Array.isArray(conCOs)?conCOs:[]).filter(c=>c.status==='Approved').reduce((s,c)=>s+Number(c.amount||0),0);
  const contractTotal = contract + approvedCO;
  const estCost = job.estCost || 0;
  const actualCost = job.actualCost || 0;
  const collected = (typeof job.collected === 'number') ? job.collected : 0;
  const invoiced = (typeof job.invoiced === 'number') ? job.invoiced : 0;

  const estProfit = contractTotal - estCost;
  const estMargin = contractTotal > 0 ? estProfit/contractTotal*100 : 0;
  const actualProfit = contractTotal - actualCost;
  const actualMargin = contractTotal > 0 ? actualProfit/contractTotal*100 : 0;
  const costVariance = estCost - actualCost; // positive = under budget
  const marginDelta = actualMargin - estMargin;

  // Warnings for missing data so the numbers aren't silently misleading
  const warnings = [];
  if (!contract) warnings.push('No contract/approved price set — import the budget CSV or set it on the job.');
  if (!estCost) warnings.push('No estimated cost — open the Estimate tab or sync from estimate.');
  if (!actualCost) warnings.push('No actual cost recorded yet — enter it in Financials as bills come in.');

  const row = (label, budget, actual, variance, varGood) => `
    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:10px;padding:11px 14px;border-bottom:1px solid rgba(110,145,210,.08);align-items:center">
      <div style="font-weight:600;font-size:.86rem">${label}</div>
      <div style="text-align:right;font-size:.86rem">${budget}</div>
      <div style="text-align:right;font-size:.86rem">${actual}</div>
      <div style="text-align:right;font-size:.86rem;font-weight:700;color:${variance==null?'var(--muted)':(varGood?'#a3f2d2':'#fca5a5')}">${variance==null?'—':variance}</div>
    </div>`;

  let html = '';

  if (warnings.length) {
    html += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:12px 14px;margin-bottom:16px">'
      + '<div style="font-weight:700;color:#fcd34d;font-size:.82rem;margin-bottom:5px">⚠ Some figures are incomplete</div>'
      + warnings.map(w => '<div style="font-size:.78rem;color:var(--muted)">• ' + esc(w) + '</div>').join('') + '</div>';
  }

  // Headline cards
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">';
  const card = (label, val, color) => `<div class="kt-card" style="padding:14px 16px"><div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700">${label}</div><div style="font-size:1.3rem;font-weight:900;color:${color||'#eaf0fb'};margin-top:4px">${val}</div></div>`;
  html += card('Contract (+ COs)', fmt(contractTotal), '#a3f2d2');
  html += card('Projected Margin', pct(estMargin), estMargin>=0?'#a3f2d2':'#fca5a5');
  html += card('Actual Margin', actualCost?pct(actualMargin):'—', actualMargin>=0?'#a3f2d2':'#fca5a5');
  html += card('Margin Δ', actualCost?(marginDelta>=0?'+':'')+pct(marginDelta):'—', marginDelta>=0?'#a3f2d2':'#fca5a5');
  html += '</div>';

  // Budget vs Actual table
  html += '<div class="kt-card" style="padding:0;overflow:clip;margin-bottom:16px">';
  html += '<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:10px;padding:11px 14px;background:rgba(110,145,210,.06);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--muted)"><div>Line</div><div style="text-align:right">Budget</div><div style="text-align:right">Actual</div><div style="text-align:right">Variance</div></div>';
  html += row('Cost', fmt(estCost), actualCost?fmt(actualCost):'—', actualCost?fmt(costVariance):null, costVariance>=0);
  html += row('Gross Profit', fmt(estProfit), actualCost?fmt(actualProfit):'—', actualCost?fmt(actualProfit-estProfit):null, (actualProfit-estProfit)>=0);
  html += row('Margin %', pct(estMargin), actualCost?pct(actualMargin):'—', actualCost?((marginDelta>=0?'+':'')+pct(marginDelta)):null, marginDelta>=0);
  html += '</div>';

  // Billing progress
  const billedPct = contractTotal>0 ? Math.min(invoiced/contractTotal*100,100) : 0;
  const collectedPct = contractTotal>0 ? Math.min(collected/contractTotal*100,100) : 0;
  html += '<div class="kt-card" style="padding:16px">';
  html += '<div style="font-weight:800;font-size:.92rem;margin-bottom:12px">💵 Billing Progress</div>';
  html += `<div style="font-size:.78rem;color:var(--muted);margin-bottom:4px">Invoiced: ${fmt(invoiced)} of ${fmt(contractTotal)} (${pct(billedPct)})</div>`;
  html += `<div style="height:9px;background:rgba(110,145,210,.12);border-radius:6px;overflow:clip;margin-bottom:12px"><div style="height:100%;width:${billedPct}%;background:#4d8dff"></div></div>`;
  html += `<div style="font-size:.78rem;color:var(--muted);margin-bottom:4px">Collected: ${fmt(collected)} of ${fmt(contractTotal)} (${pct(collectedPct)})</div>`;
  html += `<div style="height:9px;background:rgba(110,145,210,.12);border-radius:6px;overflow:clip"><div style="height:100%;width:${collectedPct}%;background:#1dbb87"></div></div>`;
  html += '</div>';

  html += '<div id="laborHoursReport" style="margin-top:16px"></div>';

  el.innerHTML = html;
  renderLaborHoursSection(jobId);
}

// ── Labor Hours: estimated (from Labor line items in the estimate) vs
// actual (from clocked/logged time entries), red/yellow/green. Estimated
// hours come straight from the estimate — no separate hours field needed,
// since Labor-costType line items already store qty as hours. ──
function isLaborItem(t) { return t.costType !== 'Subcontractor' && (t.costType === 'Labor' || (t.unit||'').toLowerCase() === 'hr'); }

async function computeJobLaborHours(jobId) {
  const [epics, hoursByFeature] = await Promise.all([loadEpicTree(jobId), loadFeatureActualHours(jobId)]);
  let estHours = 0, actHours = 0;
  epics.forEach(epic => epic.features.forEach(f => {
    (f.tasks||[]).forEach(t => { if (isLaborItem(t)) estHours += Number(t.qty)||0; });
    actHours += hoursByFeature[f.id] || 0;
  }));
  return { estHours, actHours };
}

function laborHoursHealth(estHours, actHours) {
  if (!estHours) return { color: 'var(--muted)', label: 'No labor hours estimated' };
  const pctUsed = actHours / estHours * 100;
  if (pctUsed <= 100) return { color: '#1dbb87', label: 'On/under budget' };
  if (pctUsed <= 115) return { color: '#f59e0b', label: 'Slightly over' };
  return { color: '#ef5350', label: 'Over budget' };
}

async function renderLaborHoursSection(jobId) {
  const el = document.getElementById('laborHoursReport');
  if (!el) return;
  const { estHours, actHours } = await computeJobLaborHours(jobId);
  const health = laborHoursHealth(estHours, actHours);
  const pctUsed = estHours ? (actHours/estHours*100) : 0;
  el.innerHTML = `<div class="kt-card" style="padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-weight:800;font-size:.92rem">⏱️ Labor Hours</div>
      <span style="background:${health.color}22;color:${health.color};padding:2px 10px;border-radius:999px;font-size:.74rem;font-weight:700">${health.label}</span>
    </div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">${actHours.toFixed(1)}h logged of ${estHours.toFixed(1)}h estimated ${estHours?'('+pctUsed.toFixed(0)+'%)':''}</div>
    <div style="height:9px;background:rgba(110,145,210,.12);border-radius:6px;overflow:clip">
      <div style="height:100%;width:${Math.min(pctUsed,100)}%;background:${health.color}"></div>
    </div>
  </div>`;
}

// ── Estimate cost sync (rolls estimate line items into job.estCost) ──
// Source of truth: sum(qty × unitCost) across all items, matching calcGroupTotals.
// Writes estCost ONLY — never contractValue (that stays the approved/contract price).
function syncJobEstimateCost(jobId, opts) {
  opts = opts || {};
  if (!conDb || !jobId) return Promise.resolve(null);
  const jobRef = coll('jobs').doc(jobId);
  let totalCost = 0, itemCount = 0;

  return jobRef.collection('estimateGroups').get()
    .then(async groupSnap => {
      for (const groupDoc of groupSnap.docs) {
        // Direct items on the group
        const directSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id).collection('items').get();
        directSnap.forEach(d => {
          const it = d.data();
          totalCost += (it.qty||1) * (it.unitCost||0);
          itemCount++;
        });
        // Subgroup items
        const subSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id).collection('subgroups').get();
        for (const subDoc of subSnap.docs) {
          const itemSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id)
            .collection('subgroups').doc(subDoc.id).collection('items').get();
          itemSnap.forEach(d => {
            const it = d.data();
            totalCost += (it.qty||1) * (it.unitCost||0);
            itemCount++;
          });
        }
      }
      if (itemCount === 0) return null; // no estimate → leave manual estCost untouched

      const rounded = Math.round(totalCost);
      const job = conJobs.find(j => j.id === jobId);
      const current = job ? (job.estCost||0) : null;
      // Only write if it actually changed (avoid needless writes / snapshot churn)
      if (current !== null && Math.round(current) === rounded) return rounded;

      await jobRef.update({ estCost: rounded, estCostSyncedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
      if (job) job.estCost = rounded;
      return rounded;
    })
    .catch(() => null);
}

function syncCurrentJobEstimateCost() {
  const jobId = conCurrentJobId;
  if (!jobId) return;
  const btn = document.getElementById('dashSyncCostBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Syncing…'; }
  syncJobEstimateCost(jobId).then(cost => {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Sync from Estimate'; }
    if (cost === null) { alert('No estimate line items found on this job yet. Add items in the Estimate tab first.'); return; }
    // Refresh the open dashboard financials
    const job = conJobs.find(j => j.id === jobId);
    if (job) refreshJobFinancials(job);
  });
}

// Populates the financial bar, dashboard panel, and Financials-tab est/actual fields.
function refreshJobFinancials(job) {
  if (!job) return;
  const fmt = v => '$' + Number(v||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});
  const cv = getJobValue(job);
  const ec = job.estCost || 0;
  const ac = job.actualCost || 0;
  // Best-known cost for margin math: prefer real imported actualCost over a stale/manual estCost.
  // (estCost with no estimate line items behind it is often a bare imported number — see syncJobEstimateCost.)
  const hasRealActual = typeof job.actualCost === 'number' && job.actualCost > 0;
  const bestCost = hasRealActual ? ac : ec;
  const profit = cv - bestCost;
  const margin = cv ? (profit / cv * 100) : 0;

  // Collected: prefer the imported JobTread figure; fall back to in-app invoice payments.
  const jobInvs = (allInvoices || []).filter(i => i.jobId === job.id);
  const inAppCollected = jobInvs.reduce((s,i) => s + (i.amtPaid||0), 0);
  const collected = (typeof job.collected === 'number') ? job.collected : inAppCollected;
  const balance = cv - collected;
  const costToComplete = hasRealActual ? 0 : Math.max(0, ec - ac); // actualCost IS cost-to-date, nothing left to project without real estimate data
  const projProfit = profit;
  const projMargin = margin;

  const setFin = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };
  // Top financial bar
  setFin('fbarApproved', cv);
  setFin('fbarCollected', collected);
  setFin('fbarBalance', balance);
  setFin('fbarCostComplete', costToComplete);
  setFin('fbarProfit', projProfit);
  const fbarM = document.getElementById('fbarMargin');
  if (fbarM) { fbarM.textContent = projMargin.toFixed(1) + '%'; fbarM.style.color = projMargin > 0 ? '#a3f2d2' : '#f87171'; }

  // Dashboard right panel
  setFin('dashFinApproved', cv);
  setFin('dashFinCollected', collected);
  setFin('dashFinBalance', balance);
  setFin('dashFinCost', bestCost);
  setFin('dashFinProfit', projProfit);
  const dashM = document.getElementById('dashFinMargin');
  if (dashM) dashM.textContent = projMargin.toFixed(1) + '%';

  // Financials tab est/actual block
  setFin('finContract', cv);
  setFin('finEstCost', bestCost);
  setFin('finEstProfit', profit);
  const finM = document.getElementById('finEstMargin');
  if (finM) finM.textContent = margin.toFixed(1) + '%';
  const finBar = document.getElementById('finMarginBar');
  if (finBar) finBar.style.width = Math.min(Math.max(margin,0), 100) + '%';
  setFin('finActualCost', ac);
  const variance = ec - ac;
  const varEl = document.getElementById('finVariance');
  if (varEl) { varEl.textContent = (variance >= 0 ? '+' : '') + fmt(variance); varEl.style.color = variance >= 0 ? '#a3f2d2' : '#ef5350'; }
  const aciEl = document.getElementById('actualCostInput');
  if (aciEl) aciEl.value = ac || '';

  // Payment Milestones panel — completion %, and Progress/Final invoice triggers
  renderPaymentMilestones(job.id, balance);
}

// Counts done vs total tasks across every Epic/Feature in this job's estimate
// tree, so we have a real completion percentage to drive payment milestones.
async function computeJobCompletionPct(jobId) {
  if (!conDb || !jobId) return { done: 0, total: 0, pct: 0 };
  const groupsSnap = await coll('jobs').doc(jobId).collection('estimateGroups').get();
  let done = 0, total = 0;
  for (const groupDoc of groupsSnap.docs) {
    const subSnap = await coll('jobs').doc(jobId).collection('estimateGroups')
      .doc(groupDoc.id).collection('subgroups').get();
    for (const subDoc of subSnap.docs) {
      const itemSnap = await coll('jobs').doc(jobId).collection('estimateGroups')
        .doc(groupDoc.id).collection('subgroups').doc(subDoc.id).collection('items').get();
      itemSnap.forEach(itemDoc => {
        total++;
        if (itemDoc.data().taskStatus === 'done') done++;
      });
    }
  }
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  return { done, total, pct };
}

async function renderPaymentMilestones(jobId, balanceDue) {
  const pctEl = document.getElementById('dashCompletionPct');
  const barEl = document.getElementById('dashCompletionBar');
  const progressBtn = document.getElementById('dashProgressPayBtn');
  const finalBtn = document.getElementById('dashFinalPayBtn');
  if (!pctEl || !barEl) return;

  const { done, total, pct } = await computeJobCompletionPct(jobId);
  pctEl.textContent = total > 0 ? `${pct}% (${done}/${total} tasks)` : 'No tasks yet';
  barEl.style.width = pct + '%';

  const job = conJobs.find(j => j.id === jobId);

  if (progressBtn) {
    const alreadySent = !!job?.progressPaymentInvoiced;
    progressBtn.disabled = false;
    if (alreadySent) {
      progressBtn.textContent = '✓ Progress Payment Sent';
      progressBtn.style.opacity = '.6';
    } else if (pct >= 75) {
      progressBtn.textContent = '📄 Progress Payment Invoice (25%) — Ready';
      progressBtn.style.background = 'linear-gradient(135deg,var(--amber),var(--amber2))';
      progressBtn.style.color = '#fff';
      progressBtn.style.opacity = '1';
    } else {
      progressBtn.textContent = '📄 Progress Payment Invoice (25%)';
      progressBtn.style.background = '';
      progressBtn.style.color = '';
      progressBtn.style.opacity = '1';
    }
  }

  if (finalBtn) {
    const alreadySent = !!job?.finalPaymentInvoiced;
    finalBtn.disabled = false;
    if (alreadySent) {
      finalBtn.textContent = '✓ Final Payment Sent';
      finalBtn.style.opacity = '.6';
    } else if (pct >= 100 && total > 0) {
      finalBtn.textContent = '📄 Final Payment Invoice — Job Complete';
      finalBtn.style.background = 'linear-gradient(135deg,var(--amber),var(--amber2))';
      finalBtn.style.color = '#fff';
      finalBtn.style.opacity = '1';
    } else {
      finalBtn.textContent = '📄 Final Payment Invoice';
      finalBtn.style.background = '';
      finalBtn.style.color = '';
      finalBtn.style.opacity = '1';
    }
  }
}
window.renderPaymentMilestones = renderPaymentMilestones;

// 25% progress payment, calculated the same way the 50/25/25 schedule does.
function triggerProgressPaymentInvoice() {
  if (!conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const total = getJobValue(job) || 0;
  if (!total) { alert('This job has no contract value or estimate total yet.'); return; }
  const rate = Math.round(total * 25 / 100 * 100) / 100;

  openAddInvoiceModal(conCurrentJobId);
  document.getElementById('invType').value = 'Progress Billing';
  _invLineItems = [{ desc: 'Progress Payment (25%)', qty: 1, rate }];
  renderInvLineItems();
  calcInvTotals();
  window._pendingMilestoneForInvoice = 'progress';
}
window.triggerProgressPaymentInvoice = triggerProgressPaymentInvoice;

// Final payment = whatever balance remains, not a blind 25% — this correctly
// accounts for any Change Orders added along the way.
function triggerFinalPaymentInvoice() {
  if (!conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const total = getJobValue(job) || 0;
  const jobInvs = (allInvoices || []).filter(i => i.jobId === conCurrentJobId);
  const collected = jobInvs.reduce((s,i) => s + (i.amtPaid||0), 0);
  const remaining = Math.round((total - collected) * 100) / 100;
  if (remaining <= 0) { alert('This job shows a $0 or negative remaining balance — check the Financials tab before invoicing.'); return; }

  openAddInvoiceModal(conCurrentJobId);
  document.getElementById('invType').value = 'Final Billing';
  _invLineItems = [{ desc: 'Final Payment — Balance Due', qty: 1, rate: remaining }];
  renderInvLineItems();
  calcInvTotals();
  window._pendingMilestoneForInvoice = 'final';
}
window.triggerFinalPaymentInvoice = triggerFinalPaymentInvoice;


let _geoCache = {}; // address -> {lat, lon}

function _osmEmbed(lat, lon) {
  const d = 0.008; // ~0.9km half-window for a tight neighborhood view
  const west = (lon - d).toFixed(6), east = (lon + d).toFixed(6);
  const south = (lat - d).toFixed(6), north = (lat + d).toFixed(6);
  const bbox = `${west},${south},${east},${north}`;
  const marker = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox +
         '&layer=mapnik&marker=' + marker;
}

function _renderMapIframe(mapEl, lat, lon, gmapsUrl) {
  mapEl.innerHTML = '<iframe ' +
    'width="100%" height="220" frameborder="0" style="border:0;filter:hue-rotate(190deg) saturate(0.7) brightness(0.8)" ' +
    'src="' + _osmEmbed(lat, lon) + '" loading="lazy"></iframe>' +
    '<a href="' + gmapsUrl + '" target="_blank" ' +
    'style="position:absolute;bottom:8px;right:8px;background:rgba(6,14,28,.9);border:1px solid rgba(217,119,6,.4);border-radius:6px;padding:4px 10px;font-size:.72rem;color:var(--amber);font-weight:700;text-decoration:none;z-index:10">🗺 Google Maps ↗</a>';
  mapEl.style.position = 'relative';
}

function renderJobMap(job) {
  const mapEl = document.getElementById('detailMap');
  if (!mapEl) return;
  const addr = job.address || '';
  const gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);

  if (!addr) {
    mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.84rem">No address on file</div>';
    return;
  }

  // 1. Cached coords on the job doc (one-time geocode, saved to Firestore)
  if (typeof job.geoLat === 'number' && typeof job.geoLon === 'number') {
    _renderMapIframe(mapEl, job.geoLat, job.geoLon, gmapsUrl);
    return;
  }
  // 2. In-memory cache for this session
  if (_geoCache[addr]) {
    _renderMapIframe(mapEl, _geoCache[addr].lat, _geoCache[addr].lon, gmapsUrl);
    return;
  }

  // 3. Geocode via Nominatim, then cache + persist
  mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.84rem">Locating address…</div>';
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(addr);
  fetch(url, { headers: { 'Accept': 'application/json' } })
    .then(r => r.json())
    .then(results => {
      if (!Array.isArray(results) || !results.length) throw new Error('no match');
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      if (isNaN(lat) || isNaN(lon)) throw new Error('bad coords');
      _geoCache[addr] = { lat, lon };
      // Only render if still viewing this job
      if (conCurrentJobId === job.id) _renderMapIframe(mapEl, lat, lon, gmapsUrl);
      // Persist to Firestore so we never geocode this job again
      if (conDb) coll('jobs').doc(job.id).update({ geoLat: lat, geoLon: lon }).catch(() => {});
      const jj = conJobs.find(j => j.id === job.id);
      if (jj) { jj.geoLat = lat; jj.geoLon = lon; }
    })
    .catch(() => {
      // Fallback: address text + Google Maps link, no misleading world map
      mapEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--muted);font-size:.84rem;text-align:center;padding:12px">' +
        '<div>📍 ' + esc(addr) + '</div>' +
        '<a href="' + gmapsUrl + '" target="_blank" style="color:var(--amber);font-weight:700;text-decoration:none">Open in Google Maps ↗</a></div>';
    });
}

function openJobDetail(jobId, defaultTab) {
  const job = conJobs.find(j => j.id === jobId);
  if (!job) return;
  conCurrentJobId = jobId;

  const fmt = v => '$' + Number(v||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});

  // Header
  document.getElementById('detailJobNum').textContent = '#' + (job.jobNumber || '');
  document.getElementById('detailJobName').textContent = job.name;
  document.getElementById('detailJobClient').textContent = '👤 ' + job.client + (job.phone ? ' · ' + job.phone : '') + (job.email ? ' · ' + job.email : '');
  document.getElementById('detailStatusBadge').value = job.status || 'New Lead';

  // Call/Text/Email buttons
  const callBtns = document.getElementById('detailCallBtns');
  if (callBtns) {
    const btns = [];
    if (job.phone) {
      btns.push('<a href="tel:'+job.phone+'" style="display:inline-flex;align-items:center;gap:4px;background:rgba(29,187,135,.15);color:#a3f2d2;border:1px solid rgba(29,187,135,.3);border-radius:7px;padding:3px 9px;font-size:.74rem;font-weight:700;text-decoration:none">📞 Call</a>');
      btns.push('<a href="sms:'+job.phone+'" style="display:inline-flex;align-items:center;gap:4px;background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.3);border-radius:7px;padding:3px 9px;font-size:.74rem;font-weight:700;text-decoration:none">📱 Text</a>');
    }
    if (job.email) {
      btns.push('<a href="mailto:'+job.email+'" style="display:inline-flex;align-items:center;gap:4px;background:rgba(217,119,6,.12);color:#d97706;border:1px solid rgba(217,119,6,.3);border-radius:7px;padding:3px 9px;font-size:.74rem;font-weight:700;text-decoration:none">✉️ Email</a>');
    }
    callBtns.innerHTML = btns.join('');
  }

  // Dashboard fields
  document.getElementById('detailStatus').textContent = job.status || '—';
  document.getElementById('detailType').textContent = job.type || '—';
  document.getElementById('detailStart').textContent = job.startDate || '—';
  document.getElementById('detailEnd').textContent = job.endDate || '—';
  document.getElementById('detailSuper').textContent = job.superintendent || '—';
  document.getElementById('detailPM').textContent = job.pm || '—';
  document.getElementById('detailAddress').textContent = job.address || '—';
  document.getElementById('detailTeamLead').textContent = job.teamLead || '—';
  document.getElementById('detailAccessInfo').textContent = job.accessInfo || job.notes?.match(/Access: (.+)/)?.[1] || '—';
  document.getElementById('detailNotes').textContent = job.notes || '';

  // Map — OpenStreetMap embed geocoded via Nominatim (free, no API key)
  const mapAddress = job.address || '';
  const mapAddrEl = document.getElementById('detailMapAddress');
  if (mapAddrEl) mapAddrEl.textContent = mapAddress;
  renderJobMap(job);

  // Financials (extracted so it can be re-run after estimate cost sync)
  refreshJobFinancials(job);

  // Auto-sync estCost from estimate line items in the background, then refresh
  syncJobEstimateCost(jobId).then(cost => {
    if (cost !== null && conCurrentJobId === jobId) {
      const j = conJobs.find(x => x.id === jobId);
      if (j) refreshJobFinancials(j);
    }
  });

  // Weather
  if (job.address) loadJobWeather(job.address);

  // Load phases, logs, activity
  conLoadPhases(jobId);
  conLoadLogs(jobId);
  loadJobActivity(jobId);

  // Switch to dashboard tab
  switchDetailTab(defaultTab || 'dashboard', document.querySelector('#jobDetailModal .con-subtab'));
  if (defaultTab && defaultTab !== 'dashboard') {
    setTimeout(() => switchDetailTab(defaultTab, null), 100);
  }
  kOpen('jobDetailModal');
}

function editCurrentJob() {
  if (!conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  if (!job) return;
  conEditingJobId = conCurrentJobId;
  document.getElementById('jobModalTitle').textContent = 'Edit Job';
  document.getElementById('jobName').value = job.name || '';
  document.getElementById('jobClient').value = job.client || '';
  document.getElementById('jobPhone').value = job.phone || '';
  document.getElementById('jobEmail').value = job.email || '';
  document.getElementById('jobAddress').value = job.address || '';
  document.getElementById('jobStatus').value = job.status || 'New Lead';
  document.getElementById('jobType').value = job.type || 'Residential Remodel';
  document.getElementById('jobContractValue').value = job.contractValue || '';
  document.getElementById('jobEstCost').value = job.estCost || '';
  document.getElementById('jobStartDate').value = job.startDate || '';
  document.getElementById('jobEndDate').value = job.endDate || '';
  document.getElementById('jobSuperintendent').value = job.superintendent || '';
  document.getElementById('jobPM').value = job.pm || '';
  document.getElementById('jobNotes').value = job.notes || '';
  kClose('jobDetailModal');
  kOpen('newJobModal');
}

function saveActualCost() {
  if (!conCurrentJobId || !conDb) return;
  const val = parseFloat(document.getElementById('actualCostInput').value) || 0;
  coll('jobs').doc(conCurrentJobId).update({ actualCost: val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => {
      const job = conJobs.find(j => j.id === conCurrentJobId);
      if (job) { job.actualCost = val; openJobDetail(conCurrentJobId); }
    })
    .catch(e => alert('Error: ' + e.message));
}

// ── Phases ──
let conPhases = [];

function conLoadPhases(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('phases').onSnapshot(snap => {
    conPhases = [];
    snap.forEach(doc => conPhases.push({ id: doc.id, ...doc.data() }));
    conPhases.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    loadPhaseActualHours(jobId).then(() => {
      renderPhaseList();
      updateScheduleHoursSummary(jobId);
      if (typeof renderEpicBoard === 'function') renderEpicBoard();
    });
  }, () => {
    coll('jobs').doc(jobId).collection('phases').onSnapshot(snap => {
      conPhases = [];
      snap.forEach(doc => conPhases.push({ id: doc.id, ...doc.data() }));
      renderPhaseList();
      updateScheduleHoursSummary(jobId);
      if (typeof renderEpicBoard === 'function') renderEpicBoard();
    });
  });
}

async function loadPhaseActualHours(jobId) {
  try {
    const teSnap = await coll('timeentries').where('jobId','==',jobId).get();
    const hoursByPhase = {};
    teSnap.forEach(d => {
      const data = d.data();
      if (data.phaseId && data.hours) hoursByPhase[data.phaseId] = (hoursByPhase[data.phaseId]||0) + data.hours;
    });
    conPhases.forEach(p => { p._actualHours = hoursByPhase[p.id] || p.actualHours || 0; });
  } catch(e) {
    conPhases.forEach(p => { p._actualHours = p.actualHours || 0; });
  }
}

// Combined summary covering both legacy phase docs (if any remain unmigrated
// for this job) and real Features — so the header widget shows something
// meaningful regardless of which system a given job is on.
async function updateScheduleHoursSummary(jobId) {
  const el = document.getElementById('phaseHoursSummary');
  if (!el) return;
  const legacyAct = conPhases.reduce((s,p) => s + (p._actualHours||0), 0);
  const legacyDone = conPhases.filter(p => p.status === 'complete').length;

  let featTotal = 0, featDone = 0, featAct = 0;
  try {
    const [epics, hoursByFeature] = await Promise.all([loadEpicTree(jobId), loadFeatureActualHours(jobId)]);
    epics.forEach(epic => epic.features.forEach(f => {
      featTotal++;
      if (f.status === 'complete') featDone++;
      featAct += hoursByFeature[f.id] || 0;
    }));
  } catch(e) {}

  const totalAct = legacyAct + featAct;
  const totalDone = legacyDone + featDone;
  const totalCount = conPhases.length + featTotal;
  if (!totalCount) { el.innerHTML = ''; return; }
  el.innerHTML = '<span style="color:#34d399;font-weight:700">'+totalAct.toFixed(1)+'h logged</span> · '+totalDone+'/'+totalCount+' complete';
}

let _currentPhaseView = 'board';

function switchPhaseView(view) {
  _currentPhaseView = view;
  const views = {board:'phaseBoardView',gantt:'phaseGanttView',list:'phaseListView'};
  const btns = {board:'phaseViewBoard',gantt:'phaseViewGantt',list:'phaseViewList'};
  Object.entries(views).forEach(([k,id]) => { const el=document.getElementById(id); if(el) el.style.display=k===view?'block':'none'; });
  Object.entries(btns).forEach(([k,id]) => {
    const btn=document.getElementById(id); if(!btn) return;
    if(k===view){btn.style.background='linear-gradient(135deg,var(--amber),var(--amber2))';btn.style.color='#fff';}
    else{btn.style.background='transparent';btn.style.color='var(--muted)';}
  });
  if(view==='gantt') renderEpicGantt();
  if(view==='list') renderPhaseList();
  if(view==='board') renderEpicBoard();
}

// ── JOBSMETRIX GANTT ENGINE ───────────────────────────────────────────────
// MS Project-style two-panel Gantt: left = task list, right = timeline bars
// Structure: Job → Phase (estimateGroup) → Room (subgroup) → Task (item)
// Completion % = task-based rollup. Dates: Owner sets phase dates,
// room dates auto-divide from phase, tasks inherit room dates.
// ─────────────────────────────────────────────────────────────────────────

const DAY_WIDTH = 28; // pixels per day on timeline
let _ganttData = [];  // [{phase, rooms:[{room, tasks:[]}]}]
let _ganttCollapsed = {}; // phaseId → bool, roomId → bool
let _ganttJobId = null;

let _ganttJobCollapsed = false;

// Fast re-render using cached _ganttData — no Firestore reload
function renderGanttFromCache() {
  const jobId = _ganttJobId;
  const job = conJobs.find(j => j.id === jobId);
  if (!job || !_ganttData) return;

  const allDates = [];
  _ganttData.forEach(({ phase, rooms }) => {
    if (phase.startDate) allDates.push(new Date(phase.startDate));
    if (phase.endDate) allDates.push(new Date(phase.endDate));
    rooms.forEach(({ room }) => {
      if (room.startDate) allDates.push(new Date(room.startDate));
      if (room.endDate) allDates.push(new Date(room.endDate));
    });
  });
  if (job?.startDate) allDates.push(new Date(job.startDate));
  if (job?.endDate) allDates.push(new Date(job.endDate));

  const today = new Date();
  today.setHours(0,0,0,0);
  let minDate = allDates.length ? new Date(Math.min(...allDates)) : new Date(today);
  let maxDate = allDates.length ? new Date(Math.max(...allDates)) : new Date(today);
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  renderGanttLeft(jobId, job);
  renderGanttRight(minDate, maxDate, today);
}
window.renderGanttFromCache = renderGanttFromCache;

async function renderJobGantt(jobId) {
  _ganttJobId = jobId;
  const job = conJobs.find(j => j.id === jobId);

  // Load phase tree
  const tree = await loadEpicTree(jobId);
  _ganttData = tree.map(phase => ({
    phase,
    rooms: phase.features.map(room => ({
      room,
      tasks: room.tasks || [],
    })),
  }));

  // Determine overall date range
  const allDates = [];
  _ganttData.forEach(({ phase, rooms }) => {
    if (phase.startDate) allDates.push(new Date(phase.startDate));
    if (phase.endDate) allDates.push(new Date(phase.endDate));
    rooms.forEach(({ room }) => {
      if (room.startDate) allDates.push(new Date(room.startDate));
      if (room.endDate) allDates.push(new Date(room.endDate));
    });
  });

  // Also use job start/end dates from the job record
  if (job?.startDate) allDates.push(new Date(job.startDate));
  if (job?.endDate) allDates.push(new Date(job.endDate));

  const today = new Date();
  today.setHours(0,0,0,0);

  let minDate = allDates.length ? new Date(Math.min(...allDates)) : new Date(today);
  let maxDate = allDates.length ? new Date(Math.max(...allDates)) : new Date(today);

  // Pad edges
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  // Calculate overall % complete
  let totalTasks = 0, doneTasks = 0;
  _ganttData.forEach(({ rooms }) => {
    rooms.forEach(({ room, tasks }) => {
      const dt = getDisplayTasks(room, tasks);
      totalTasks += dt.length;
      doneTasks += dt.filter(t => t.taskStatus === 'done').length;
    });
  });
  const overallPct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;
  const pctEl = document.getElementById('ganttCompletePct');
  if (pctEl) pctEl.textContent = totalTasks ? `${overallPct}% complete (${doneTasks}/${totalTasks} tasks)` : 'No tasks yet';

  renderGanttLeft(jobId, job);
  renderGanttRight(minDate, maxDate, today);
  syncGanttScroll();
  initGanttResize();
}
window.renderJobGantt = renderJobGantt;

function renderGanttLeft(jobId, job) {
  const container = document.getElementById('ganttLeftRows');
  if (!container) return;

  const isOwner = ['Owner', 'Full Access'].includes(currentUserRole);
  let html = '';

  // Job-level summary row — with date pickers
  const jobPct = calcJobPct();
  html += `<div class="gantt-left-row phase-row" style="background:rgba(245,158,11,.08);border-bottom:2px solid rgba(245,158,11,.2)" onclick="ganttToggleJob()">
    <div class="gantt-name-cell" style="color:var(--amber);font-size:.85rem">
      <span class="gantt-collapse-btn">${_ganttJobCollapsed ? '▶' : '▼'}</span>
      🏠 ${esc(job?.name || 'This Job')}
    </div>
    <div class="gantt-days-cell" style="color:var(--amber)">${dateDiff(job?.startDate, job?.endDate) !== null ? dateDiff(job?.startDate, job?.endDate)+'d' : '—'}</div>
    <div class="gantt-date-cell" onclick="event.stopPropagation()">${isOwner
      ? `<input type="date" value="${job?.startDate||''}" onchange="updateJobDate('startDate',this.value)" onclick="event.stopPropagation()">`
      : (job?.startDate||'—')}
    </div>
    <div class="gantt-date-cell" onclick="event.stopPropagation()">${isOwner
      ? `<input type="date" value="${job?.endDate||''}" onchange="updateJobDate('endDate',this.value)" onclick="event.stopPropagation()">`
      : (job?.endDate||'—')}
    </div>
    <div class="gantt-pct-cell" style="color:${pctColor(jobPct)};font-weight:800">${jobPct}%</div>
  </div>`;

  if (!_ganttJobCollapsed) {

  _ganttData.forEach(({ phase, rooms }) => {
    const phaseCollapsed = _ganttCollapsed[phase.id];
    const phasePct = calcPhasePct(rooms);
    const phaseDays = dateDiff(phase.startDate, phase.endDate);

    html += `<div class="gantt-left-row phase-row" onclick="ganttTogglePhase('${phase.id}')">
      <div class="gantt-name-cell" style="color:#93c5fd">
        <span class="gantt-collapse-btn">${phaseCollapsed ? '▶' : '▼'}</span>
        ${esc(phase.name)}
      </div>
      <div class="gantt-days-cell">${phaseDays !== null ? phaseDays+'d' : '—'}</div>
      <div class="gantt-date-cell">${isOwner
        ? `<input type="date" value="${phase.startDate||''}" onchange="updatePhaseDate('${phase.id}','startDate',this.value)" onclick="event.stopPropagation()">`
        : (phase.startDate||'—')}
      </div>
      <div class="gantt-date-cell">${isOwner
        ? `<input type="date" value="${phase.endDate||''}" onchange="updatePhaseDate('${phase.id}','endDate',this.value)" onclick="event.stopPropagation()">`
        : (phase.endDate||'—')}
      </div>
      <div class="gantt-pct-cell" style="color:${pctColor(phasePct)};font-weight:700">${phasePct}%</div>
    </div>`;

    if (!phaseCollapsed) {
      rooms.forEach(({ room, tasks }) => {
        const roomCollapsed = _ganttCollapsed[room.id];
        const roomPct = calcRoomPct(room, tasks);
        const { start: roomStart, end: roomEnd } = getRoomDates(room, phase);
        const roomDays = dateDiff(roomStart, roomEnd);

        html += `<div class="gantt-left-row room-row" onclick="ganttToggleRoom('${room.id}')">
          <div class="gantt-name-cell" style="padding-left:24px;color:#e2e8f0">
            <span class="gantt-collapse-btn">${roomCollapsed ? '▶' : '▼'}</span>
            ${esc(room.name)}
          </div>
          <div class="gantt-days-cell">${roomDays !== null ? roomDays+'d' : '—'}</div>
          <div class="gantt-date-cell" style="color:var(--muted)">${roomStart||'—'}</div>
          <div class="gantt-date-cell" style="color:var(--muted)">${roomEnd||'—'}</div>
          <div class="gantt-pct-cell" style="color:${pctColor(roomPct)}">${roomPct}%</div>
        </div>`;

        if (!roomCollapsed) {
          // Use actual items; fall back to scope notes parsed by line break
          let displayTasks = tasks;
          if (!tasks.length && room.scopeNotes) {
            const statusMap = room.scopeNoteStatus || {};
            displayTasks = room.scopeNotes.split('\n')
              .map(l => l.trim()).filter(Boolean)
              .map((line, i) => ({
                id: `scope_${room.id}_${i}`,
                name: line,
                taskStatus: statusMap[`scope_${room.id}_${i}`] || 'todo',
                fromScopeNotes: true,
              }));
          }
          displayTasks.forEach(task => {
            const isDone = task.taskStatus === 'done';
            html += `<div class="gantt-left-row task-row">
              <div class="gantt-name-cell" style="padding-left:44px;color:${isDone?'var(--muted)':'#cbd5e1'}">
                <input type="checkbox" ${isDone?'checked':''} 
                  onchange="toggleGanttTask('${phase.id}','${room.id}','${task.id}',this.checked)"
                  style="margin-right:6px;cursor:pointer;accent-color:var(--amber)"
                  onclick="event.stopPropagation()">
                <span style="${isDone?'text-decoration:line-through;opacity:.5':''}">${esc(task.name)}</span>
              </div>
              <div class="gantt-days-cell">1d</div>
              <div class="gantt-date-cell" style="color:rgba(110,145,210,.4)">${roomStart||'—'}</div>
              <div class="gantt-date-cell" style="color:rgba(110,145,210,.4)">${roomEnd||'—'}</div>
              <div class="gantt-pct-cell" style="color:${isDone?'#10b981':'var(--muted)'}">${isDone?'100':'0'}%</div>
            </div>`;
          });

          // Add task button
          html += `<div class="gantt-left-row task-row" style="opacity:.6">
            <div class="gantt-name-cell" style="padding-left:44px">
              <button onclick="addGanttTask('${phase.id}','${room.id}')" 
                style="background:none;border:1px dashed rgba(110,145,210,.3);border-radius:4px;color:var(--muted);font-size:.7rem;padding:2px 8px;cursor:pointer">
                + Add task
              </button>
            </div>
            <div class="gantt-days-cell"></div>
            <div class="gantt-date-cell"></div>
            <div class="gantt-date-cell"></div>
            <div class="gantt-pct-cell"></div>
          </div>`;
        }
      });
    }
      // Add room button at bottom of phase
      if (!phaseCollapsed) {
        html += `<div class="gantt-left-row" style="background:rgba(8,19,37,.15)">
          <div class="gantt-name-cell" style="padding-left:24px">
            <button onclick="addGanttRoom('${phase.id}')"
              style="background:none;border:1px dashed rgba(110,145,210,.3);border-radius:4px;color:var(--muted);font-size:.7rem;padding:2px 8px;cursor:pointer">
              + Add room
            </button>
          </div>
          <div class="gantt-days-cell"></div>
          <div class="gantt-date-cell"></div>
          <div class="gantt-date-cell"></div>
          <div class="gantt-pct-cell"></div>
        </div>`;
      }
  });

  } // end if (!_ganttJobCollapsed)

  container.innerHTML = html;
}

function renderGanttRight(minDate, maxDate, today) {
  const totalDays = Math.ceil((maxDate - minDate) / 86400000);
  const totalWidth = totalDays * DAY_WIDTH;

  // Build month headers
  let monthHtml = '';
  let d = new Date(minDate);
  while (d < maxDate) {
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const visStart = d > monthStart ? d : monthStart;
    const visEnd = monthEnd < maxDate ? monthEnd : maxDate;
    const days = Math.ceil((visEnd - visStart) / 86400000) + 1;
    const width = days * DAY_WIDTH;
    monthHtml += `<div class="gantt-month-cell" style="width:${width}px">${d.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>`;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  // Build week headers
  let weekHtml = '';
  d = new Date(minDate);
  // Align to Monday
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  while (d < maxDate) {
    const label = d.toLocaleDateString('en-US', { month:'numeric', day:'numeric' });
    weekHtml += `<div class="gantt-week-cell" style="width:${DAY_WIDTH*7}px">${label}</div>`;
    d.setDate(d.getDate() + 7);
  }

  document.getElementById('ganttMonthRow').innerHTML = monthHtml;
  document.getElementById('ganttWeekRow').innerHTML = weekHtml;

  // Today line
  const todayOffset = Math.floor((today - minDate) / 86400000) * DAY_WIDTH;
  const todayLine = document.getElementById('ganttTodayLine');
  if (todayLine) {
    todayLine.style.left = todayOffset + 'px';
    todayLine.style.display = today >= minDate && today <= maxDate ? 'block' : 'none';
  }

  // Build bar rows — must match left panel row order exactly
  let barsHtml = '';
  const rowH = 36;

  const barRow = (extraStyle='') =>
    `<div class="gantt-bar-row" style="height:${rowH}px;${extraStyle}">`;

  const bar = (startStr, endStr, color, pct, label, extraClass='') => {
    if (!startStr || !endStr) return '<div style="height:36px"></div>';
    const s = new Date(startStr), e = new Date(endStr);
    if (isNaN(s) || isNaN(e)) return '<div style="height:36px"></div>';
    const left = Math.floor((s - minDate) / 86400000) * DAY_WIDTH;
    const width = Math.max(DAY_WIDTH, Math.ceil((e - s) / 86400000) * DAY_WIDTH);
    const fillWidth = Math.round(pct * width / 100);
    return `<div class="${extraClass}" style="left:${left}px;width:${width}px;${color}">
      <div class="gantt-bar-fill" style="width:${fillWidth}px"></div>
      ${width > 60 ? `<span style="position:absolute;left:6px;font-size:.65rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;max-width:${width-12}px">${esc(label)}</span>` : ''}
    </div>`;
  };

  // Job summary bar
  const job = conJobs.find(j => j.id === _ganttJobId);
  const jobPct = calcJobPct();
  barsHtml += barRow('background:rgba(245,158,11,.05);border-bottom:2px solid rgba(245,158,11,.2)') +
    bar(job?.startDate, job?.endDate, 'background:linear-gradient(90deg,#b45309,#d97706);border-radius:4px;position:absolute;height:22px;top:7px', jobPct, job?.name||'Job', '') +
    '</div>';

  if (!_ganttJobCollapsed) {
  _ganttData.forEach(({ phase, rooms }) => {
    const phaseCollapsed = _ganttCollapsed[phase.id];
    const phasePct = calcPhasePct(rooms);

    barsHtml += barRow('background:rgba(8,19,37,.4)') +
      bar(phase.startDate, phase.endDate, 'background:linear-gradient(90deg,#1d4ed8,#3b82f6);border-radius:3px;position:absolute;height:20px;top:8px', phasePct, phase.name, '') +
      '</div>';

    if (!phaseCollapsed) {
      rooms.forEach(({ room, tasks }) => {
        const roomCollapsed = _ganttCollapsed[room.id];
        const { start: roomStart, end: roomEnd } = getRoomDates(room, phase);

        // Mirror displayTasks logic from renderGanttLeft
        let displayTasks = tasks;
        if (!tasks.length && room.scopeNotes) {
          const statusMap = room.scopeNoteStatus || {};
          displayTasks = room.scopeNotes.split('\n')
            .map(l => l.trim()).filter(Boolean)
            .map((line, i) => ({ id: `scope_${room.id}_${i}`, name: line, taskStatus: statusMap[`scope_${room.id}_${i}`] || 'todo' }));
        }
        const roomPct = displayTasks.length
          ? Math.round(displayTasks.filter(t => t.taskStatus === 'done').length / displayTasks.length * 100)
          : 0;

        barsHtml += barRow('background:rgba(8,19,37,.2)') +
          bar(roomStart, roomEnd, 'background:linear-gradient(90deg,#0d9488,#14b8a6);border-radius:3px;position:absolute;height:16px;top:10px', roomPct, room.name, '') +
          '</div>';

        if (!roomCollapsed) {
          displayTasks.forEach(task => {
            const isDone = task.taskStatus === 'done';
            barsHtml += barRow() +
              bar(roomStart, roomEnd, `background:${isDone?'#10b981':'#334155'};border-radius:2px;position:absolute;height:8px;top:14px`, isDone?100:0, '', '') +
              '</div>';
          });
          // Add task button row
          barsHtml += `<div class="gantt-bar-row" style="height:${rowH}px"></div>`;
        }
      });
    }
    // Add room button row
    if (!phaseCollapsed) {
      barsHtml += `<div class="gantt-bar-row" style="height:${rowH}px;background:rgba(8,19,37,.15)"></div>`;
    }
  }); // end _ganttData.forEach
  } // end if (!_ganttJobCollapsed)

  const barsContainer = document.getElementById('ganttBars');
  const rightInner = document.getElementById('ganttRightInner');
  if (barsContainer) barsContainer.innerHTML = barsHtml;
  if (rightInner) rightInner.style.minWidth = totalWidth + 'px';
}

// Sync scroll between left and right panels vertically
function syncGanttScroll() {
  const left = document.getElementById('ganttLeft');
  const right = document.getElementById('ganttRight');
  if (!left || !right) return;
  let syncing = false;
  left.addEventListener('scroll', () => {
    if (syncing) return; syncing = true;
    right.scrollTop = left.scrollTop;
    syncing = false;
  });
  right.addEventListener('scroll', () => {
    if (syncing) return; syncing = true;
    left.scrollTop = right.scrollTop;
    syncing = false;
  });
}

// ── Gantt helper functions ────────────────────────────────────────────────

function dateDiff(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr), e = new Date(endStr);
  if (isNaN(s) || isNaN(e)) return null;
  return Math.ceil((e - s) / 86400000);
}

function pctColor(pct) {
  if (pct >= 100) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  if (pct > 0) return '#3b82f6';
  return 'var(--muted)';
}

function calcJobPct() {
  let total = 0, done = 0;
  _ganttData.forEach(({ rooms }) => {
    rooms.forEach(({ room, tasks }) => {
      const displayTasks = getDisplayTasks(room, tasks);
      total += displayTasks.length;
      done += displayTasks.filter(t => t.taskStatus === 'done').length;
    });
  });
  return total ? Math.round(done / total * 100) : 0;
}

// Helper to get displayTasks consistently
function getDisplayTasks(room, tasks) {
  if (!tasks.length && room.scopeNotes) {
    const statusMap = room.scopeNoteStatus || {};
    return room.scopeNotes.split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map((line, i) => ({
        id: `scope_${room.id}_${i}`,
        name: line,
        taskStatus: statusMap[`scope_${room.id}_${i}`] || 'todo',
      }));
  }
  return tasks;
}

function calcPhasePct(rooms) {
  let total = 0, done = 0;
  rooms.forEach(({ room, tasks }) => {
    const dt = getDisplayTasks(room, tasks);
    total += dt.length;
    done += dt.filter(t => t.taskStatus === 'done').length;
  });
  return total ? Math.round(done / total * 100) : 0;
}

function calcRoomPct(room, tasks) {
  const dt = getDisplayTasks(room, tasks);
  if (!dt.length) return 0;
  return Math.round(dt.filter(t => t.taskStatus === 'done').length / dt.length * 100);
}

// Room dates: use room's own dates if set, otherwise auto-divide phase dates equally
function getRoomDates(room, phase) {
  if (room.startDate && room.endDate) return { start: room.startDate, end: room.endDate };
  if (!phase.startDate || !phase.endDate) return { start: null, end: null };

  // Find phase's rooms to auto-divide
  const phaseEntry = _ganttData.find(p => p.phase.id === phase.id);
  if (!phaseEntry) return { start: phase.startDate, end: phase.endDate };

  const rooms = phaseEntry.rooms;
  const idx = rooms.findIndex(r => r.room.id === room.id);
  const total = rooms.length;
  if (total === 0) return { start: phase.startDate, end: phase.endDate };

  const phaseStart = new Date(phase.startDate);
  const phaseEnd = new Date(phase.endDate);
  const totalMs = phaseEnd - phaseStart;
  const chunkMs = totalMs / total;

  const roomStart = new Date(phaseStart.getTime() + idx * chunkMs);
  const roomEnd = new Date(phaseStart.getTime() + (idx + 1) * chunkMs);

  return {
    start: roomStart.toISOString().split('T')[0],
    end: roomEnd.toISOString().split('T')[0],
  };
}

function toggleGanttFullscreen() {
  const container = document.getElementById('ganttContainer');
  const btn = document.getElementById('ganttFullscreenBtn');
  const exitBtn = document.getElementById('ganttExitFullscreenBtn');
  if (!container) return;

  const isFullscreen = container.dataset.fullscreen === 'true';
  if (isFullscreen) {
    container.dataset.fullscreen = 'false';
    container.style.position = '';
    container.style.top = '';
    container.style.left = '';
    container.style.right = '';
    container.style.bottom = '';
    container.style.zIndex = '';
    container.style.height = '';
    container.style.background = '';
    if (btn) btn.textContent = '⛶ Full Screen';
    if (exitBtn) exitBtn.style.display = 'none';
  } else {
    container.dataset.fullscreen = 'true';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.zIndex = '9999';
    container.style.height = '100vh';
    container.style.background = 'rgba(5,14,28,.99)';
    if (btn) btn.textContent = '⛶ Full Screen';
    if (exitBtn) exitBtn.style.display = 'block';
  }
  setTimeout(() => renderGanttFromCache(), 50);
}
window.toggleGanttFullscreen = toggleGanttFullscreen;

// Escape key exits Gantt fullscreen
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const container = document.getElementById('ganttContainer');
    if (container && container.dataset.fullscreen === 'true') toggleGanttFullscreen();
    const masterCard = document.getElementById('homeMasterGanttCard');
    if (masterCard && masterCard.dataset.fullscreen === 'true') toggleMasterGanttFullscreen();
  }
});

function ganttToggleJob() {
  _ganttJobCollapsed = !_ganttJobCollapsed;
  renderGanttFromCache();
}
window.ganttToggleJob = ganttToggleJob;

function ganttTogglePhase(phaseId) {
  _ganttCollapsed[phaseId] = !_ganttCollapsed[phaseId];
  renderGanttFromCache();
}
window.ganttTogglePhase = ganttTogglePhase;

function ganttToggleRoom(roomId) {
  _ganttCollapsed[roomId] = !_ganttCollapsed[roomId];
  renderGanttFromCache();
}
window.ganttToggleRoom = ganttToggleRoom;

function ganttExpandAll() {
  _ganttCollapsed = {};
  _ganttJobCollapsed = false;
  renderGanttFromCache();
}
window.ganttExpandAll = ganttExpandAll;

function ganttCollapseAll() {
  _ganttData.forEach(({ phase, rooms }) => {
    _ganttCollapsed[phase.id] = true;
    rooms.forEach(({ room }) => { _ganttCollapsed[room.id] = true; });
  });
  renderGanttFromCache();
}
window.ganttCollapseAll = ganttCollapseAll;

async function updateJobDate(field, value) {
  if (!_ganttJobId || !conDb) return;
  try {
    // Update local cache immediately so re-render shows the new value
    const job = conJobs.find(j => j.id === _ganttJobId);
    if (job) job[field] = value;
    // Write to Firestore
    await coll('jobs').doc(_ganttJobId).update({
      [field]: value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    renderJobGantt(_ganttJobId);
  } catch(e) {
    console.error('updateJobDate failed:', e);
    alert('Could not save date: ' + e.message);
  }
}
window.updateJobDate = updateJobDate;

// Gantt panel resize
function initGanttResize() {
  const resizer = document.getElementById('ganttResizer');
  const left = document.getElementById('ganttLeft');
  if (!resizer || !left) return;
  let startX, startW;
  resizer.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = left.offsetWidth;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onMove), { once: true });
  });
  function onMove(e) {
    const newW = Math.max(300, Math.min(800, startW + e.clientX - startX));
    left.style.width = newW + 'px';
  }
}
window.initGanttResize = initGanttResize;

async function updatePhaseDate(phaseId, field, value) {
  if (!_ganttJobId || !conDb) return;
  try {
    // Update local cache immediately
    const entry = _ganttData.find(p => p.phase.id === phaseId);
    if (entry) entry.phase[field] = value;
    // Write to Firestore
    await coll('jobs').doc(_ganttJobId)
      .collection('estimateGroups').doc(phaseId)
      .update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    renderJobGantt(_ganttJobId);
  } catch(e) {
    console.error('updatePhaseDate failed:', e);
    alert('Could not save date: ' + e.message);
  }
}
window.updatePhaseDate = updatePhaseDate;

async function toggleGanttTask(phaseId, roomId, taskId, checked) {
  if (!_ganttJobId || !conDb) return;

  const isScopeNote = taskId.startsWith('scope_');

  if (isScopeNote) {
    // Scope note tasks — store status in room's scopeNoteStatus map in Firestore
    const key = taskId; // e.g. scope_roomId_0
    try {
      await coll('jobs').doc(_ganttJobId)
        .collection('estimateGroups').doc(phaseId)
        .collection('subgroups').doc(roomId)
        .update({ [`scopeNoteStatus.${key}`]: checked ? 'done' : 'todo' });
    } catch(e) {
      console.warn('Could not save scope note status:', e.message);
    }
    // Update local cache on the room
    const entry = _ganttData.find(p => p.phase.id === phaseId);
    if (entry) {
      const roomEntry = entry.rooms.find(r => r.room.id === roomId);
      if (roomEntry) {
        if (!roomEntry.room.scopeNoteStatus) roomEntry.room.scopeNoteStatus = {};
        roomEntry.room.scopeNoteStatus[key] = checked ? 'done' : 'todo';
      }
    }
  } else {
    // Real Firestore item
    try {
      await coll('jobs').doc(_ganttJobId)
        .collection('estimateGroups').doc(phaseId)
        .collection('subgroups').doc(roomId)
        .collection('items').doc(taskId)
        .update({ taskStatus: checked ? 'done' : 'todo' });
    } catch(e) {
      console.warn('Could not save task status:', e.message);
    }
    // Update local cache
    const entry = _ganttData.find(p => p.phase.id === phaseId);
    if (entry) {
      const roomEntry = entry.rooms.find(r => r.room.id === roomId);
      if (roomEntry) {
        const task = roomEntry.tasks.find(t => t.id === taskId);
        if (task) task.taskStatus = checked ? 'done' : 'todo';
      }
    }
  }

  renderGanttFromCache();
}
window.toggleGanttTask = toggleGanttTask;

async function addGanttTask(phaseId, roomId) {
  const name = prompt('Task name:');
  if (!name?.trim()) return;
  await coll('jobs').doc(_ganttJobId)
    .collection('estimateGroups').doc(phaseId)
    .collection('subgroups').doc(roomId)
    .collection('items').add({
      desc: name.trim(),
      taskStatus: 'todo',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      companyId: currentCompanyId,
    });
  renderJobGantt(_ganttJobId);
}
async function addGanttRoom(phaseId) {
  const name = prompt('Room name (e.g. "Kitchen", "Master Bath", "Living Room"):');
  if (!name?.trim()) return;
  if (!_ganttJobId || !conDb) return;
  const phaseEntry = _ganttData.find(p => p.phase.id === phaseId);
  const order = phaseEntry ? phaseEntry.rooms.length : 0;
  await coll('jobs').doc(_ganttJobId)
    .collection('estimateGroups').doc(phaseId)
    .collection('subgroups').add({
      name: name.trim(),
      order,
      status: 'not-started',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      companyId: currentCompanyId,
    });
  renderJobGantt(_ganttJobId);
}
window.addGanttRoom = addGanttRoom;

function renderEpicGantt() { if (_ganttJobId) renderJobGantt(_ganttJobId); }
// The piece from the locked Schedule redesign spec that was never built:
// a real visual Gantt for the Epic/Feature/Task tree, with dependency arrows
// instead of just text warnings. Bars are positioned by each Feature's
// assigned Sprint dates (Features don't carry their own dates — only Sprints
// do, per the locked design). Features with no Sprint show as "No sprint
// assigned" rows rather than being silently omitted.
let _ganttFeaturesById = {};

function renderEpicGantt() {
  const wrap = document.getElementById('ganttWrap');
  if (!wrap || !conCurrentJobId) return;
  wrap.innerHTML = '<div class="small muted" style="padding:20px;text-align:center">Loading timeline...</div>';

  Promise.all([loadEpicTree(conCurrentJobId), loadSprints(conCurrentJobId)])
    .then(([epics, sprints]) => {
      const sprintsById = {};
      sprints.forEach(s => { sprintsById[s.id] = s; });

      const allFeatures = [];
      epics.forEach(epic => {
        epic.features.forEach(f => allFeatures.push({ ...f, epicId: epic.id, epicName: epic.name }));
      });
      _ganttFeaturesById = {};
      allFeatures.forEach(f => { _ganttFeaturesById[f.id] = f; });

      const dated = allFeatures.filter(f => f.sprintId && sprintsById[f.sprintId] && sprintsById[f.sprintId].startDate);
      if (!allFeatures.length) {
        wrap.innerHTML = '<div class="small muted" style="padding:20px;text-align:center">No Features yet — add Features in the estimate to see them here</div>';
        return;
      }
      if (!dated.length) {
        wrap.innerHTML = '<div class="small muted" style="padding:20px;text-align:center">Assign Features to a Sprint with dates to see the Timeline</div>';
        return;
      }

      const dates = dated.flatMap(f => {
        const s = sprintsById[f.sprintId];
        return [s.startDate, s.endDate].filter(Boolean);
      });
      const minDate = new Date(dates.reduce((a,b)=>a<b?a:b));
      const maxDate = new Date(dates.reduce((a,b)=>a>b?a:b));
      minDate.setDate(minDate.getDate()-7);
      maxDate.setDate(maxDate.getDate()+14);
      const totalDays = Math.ceil((maxDate-minDate)/86400000);
      const dayWidth = Math.max(24, Math.floor(800/totalDays));
      const totalWidth = totalDays*dayWidth;
      const today = new Date();
      const todayOffset = Math.floor((today-minDate)/86400000)*dayWidth;

      const weekWidth = dayWidth*7;
      let weekHeaders = '', d = new Date(minDate);
      while (d < maxDate) {
        const label = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
        weekHeaders += '<div class="gantt-week-label" style="width:'+weekWidth+'px">Wk '+getWeekNum(d)+'<br><span style="font-size:.64rem">'+label+'</span></div>';
        d.setDate(d.getDate()+7);
      }

      const statusColors = {'not-started':'#64748b','in-progress':'#3b82f6','complete':'#10b981','blocked':'#ef4444'};
      const rowHeight = 44;
      const barPositions = {};
      let rowIndex = 0;

      const featureRows = allFeatures.map(f => {
        const sprint = f.sprintId ? sprintsById[f.sprintId] : null;
        const rowTop = rowIndex * rowHeight;
        rowIndex++;
        if (!sprint || !sprint.startDate) {
          return '<div class="gantt-row"><div class="gantt-label">'+esc(f.name)+'<div style="font-size:.7rem;color:var(--muted)">'+esc(f.epicName)+'</div></div>'+
            '<div class="gantt-bar-area" style="width:'+totalWidth+'px"><span style="color:var(--muted);font-size:.74rem;padding:12px 8px;display:block">No sprint assigned</span></div></div>';
        }
        const start = new Date(sprint.startDate);
        const end = sprint.endDate ? new Date(sprint.endDate) : new Date(start.getTime()+86400000*7);
        const left = Math.floor((start-minDate)/86400000)*dayWidth;
        const width = Math.max(dayWidth*2, Math.ceil((end-start)/86400000)*dayWidth);
        barPositions[f.id] = { left, width, top: rowTop };
        const color = statusColors[f.status] || '#64748b';
        const doneCount = (f.tasks||[]).filter(t => t.taskStatus === 'done').length;
        const taskLabel = (f.tasks||[]).length ? ' · '+doneCount+'/'+f.tasks.length+' tasks' : '';
        const warning = dependencyWarning(f, _ganttFeaturesById);
        return '<div class="gantt-row">'+
          '<div class="gantt-label">'+esc(f.name)+'<div style="font-size:.7rem;color:var(--muted)">'+esc(f.epicName)+'</div></div>'+
          '<div class="gantt-bar-area" style="width:'+totalWidth+'px;position:relative">'+
          '<div class="gantt-bar" onclick="openGanttFeature(\''+f.id+'\')" style="left:'+left+'px;width:'+width+'px;background:'+color+';opacity:'+(f.status==='complete'?0.7:1)+'">'+
          esc(f.name)+taskLabel+'</div>'+
          (warning ? '<div style="position:absolute;left:'+(left+width)+'px;top:12px;font-size:.7rem;color:#f87171;font-weight:700;white-space:nowrap"> ⚠ '+esc(warning)+'</div>' : '')+
          '</div></div>';
      }).join('');

      // Dependency arrows — a real visual upgrade over the board's text-only warnings.
      const totalHeight = rowIndex * rowHeight;
      let svgLines = '';
      allFeatures.forEach(f => {
        (f.dependsOn||[]).forEach(depId => {
          const from = barPositions[depId];
          const to = barPositions[f.id];
          if (!from || !to) return; // one or both unscheduled — no arrow to draw
          const blocker = _ganttFeaturesById[depId];
          const satisfied = blocker && blocker.status === 'complete';
          const x1 = from.left + from.width, y1 = from.top + 22;
          const x2 = to.left, y2 = to.top + 22;
          const color = satisfied ? '#475569' : '#ef4444';
          svgLines += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="2" marker-end="url(#ganttArrowhead)" stroke-dasharray="'+(satisfied?'0':'4,3')+'" />';
        });
      });
      const svgOverlay = svgLines ? '<svg style="position:absolute;left:160px;top:0;pointer-events:none;overflow:visible" width="'+totalWidth+'" height="'+totalHeight+'">'+
        '<defs><marker id="ganttArrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ef4444"/></marker></defs>'+
        svgLines+'</svg>' : '';

      wrap.innerHTML = '<div style="position:relative">'+
        '<div style="display:flex"><div style="width:160px;flex-shrink:0"></div>'+
        '<div class="gantt-header" style="width:'+totalWidth+'px;position:relative">'+weekHeaders+
        '<div class="gantt-today-line" style="left:'+todayOffset+'px"></div></div></div>'+
        featureRows+svgOverlay+
        '</div>'+
        '<div style="margin-top:12px;font-size:.74rem;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">'+
        '<span>🔵 In Progress</span><span>✅ Complete</span><span style="color:#f87171">⚠ Dependency warning</span>'+
        '<span style="border-left:2px solid rgba(239,68,68,.7);padding-left:6px">Today</span>'+
        '<span style="color:#ef4444">┅ Unmet dependency</span><span style="color:#475569">— Satisfied dependency</span></div>';
    })
    .catch(err => {
      wrap.innerHTML = '<div class="small muted" style="padding:20px;text-align:center">Could not load timeline: '+esc((err&&err.message)||'')+'</div>';
    });
}
window.renderEpicGantt = renderEpicGantt;

function openGanttFeature(featureId) {
  const f = _ganttFeaturesById[featureId];
  if (!f) return;
  openFeatureModal(f.epicId, f.epicName, f);
}
window.openGanttFeature = openGanttFeature;

function getWeekNum(d) {
  const date=new Date(d);date.setHours(0,0,0,0);date.setDate(date.getDate()+3-(date.getDay()+6)%7);
  const week1=new Date(date.getFullYear(),0,4);
  return 1+Math.round(((date.getTime()-week1.getTime())/86400000-3+(week1.getDay()+6)%7)/7);
}

async function renderPhaseList() {
  const el = document.getElementById('phaseList');
  if (!el || !conCurrentJobId) return;
  el.innerHTML = '<p class="muted">Loading...</p>';

  const [epics, hoursByFeature] = await Promise.all([
    loadEpicTree(conCurrentJobId),
    loadFeatureActualHours(conCurrentJobId),
  ]);
  const allFeatures = [];
  epics.forEach(epic => epic.features.forEach(f => allFeatures.push({ ...f, epicId: epic.id, epicName: epic.name })));
  _newFeatureListById = {};
  allFeatures.forEach(f => { _newFeatureListById[f.id] = f; });

  if (!allFeatures.length) { el.innerHTML = '<p class="muted">No Features yet. Hit + Add Feature to start.</p>'; return; }

  const sc = {'not-started':'#64748b','in-progress':'#3b82f6','complete':'#10b981','blocked':'#ef4444'};
  const sl = {'not-started':'Not Started','in-progress':'In Progress','complete':'Complete','blocked':'Blocked'};

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.84rem';
  table.innerHTML = '<thead><tr style="border-bottom:2px solid rgba(110,145,210,.15)">' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Feature</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Epic</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Team Lead</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Tasks</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Hrs Logged</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Status</th>' +
    '</tr></thead>';

  const tbody = document.createElement('tbody');
  allFeatures.forEach(f => {
    const color = sc[f.status||'not-started'] || '#64748b';
    const actH = hoursByFeature[f.id] || 0;
    const doneCount = (f.tasks||[]).filter(t => t.taskStatus === 'done').length;

    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer';
    tr.onmouseover = function() { this.style.background = 'rgba(217,119,6,.05)'; };
    tr.onmouseout = function() { this.style.background = ''; };
    tr.onclick = function() { openFeatureModal(f.epicId, f.epicName, f); };

    tr.innerHTML =
      '<td style="padding:10px"><div style="display:flex;align-items:center;gap:8px">' +
      '<div style="width:4px;height:30px;background:'+color+';border-radius:2px;flex-shrink:0"></div>' +
      '<div style="font-weight:700">'+esc(f.name)+'</div></div></td>' +
      '<td style="padding:10px;color:var(--muted)">'+esc(f.epicName||'\u2014')+'</td>' +
      '<td style="padding:10px;color:var(--muted)">'+esc(f.assignedTeamLead||'\u2014')+'</td>' +
      '<td style="padding:10px;color:var(--muted)">'+doneCount+'/'+(f.tasks||[]).length+'</td>' +
      '<td style="padding:10px;text-align:right;font-weight:700;color:'+(actH>0?'#34d399':'var(--muted)')+'">'+(actH>0?actH.toFixed(1):'\u2014')+'</td>' +
      '<td style="padding:10px"><span style="background:'+color+'22;color:'+color+';padding:2px 8px;border-radius:999px;font-size:.75rem;font-weight:700">'+(sl[f.status||'not-started'])+'</span></td>';

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.innerHTML = '';
  el.appendChild(table);
}
let _newFeatureListById = {};

// ── Actual hours, keyed by Feature id (timeentries.phaseId now holds the
// clocked-against Feature's id going forward — see loadClockPhases/
// loadManualPhases/clockIn/saveManualTimeEntry below) ──
async function loadFeatureActualHours(jobId) {
  try {
    const snap = await coll('timeentries').where('jobId','==',jobId).get();
    const hours = {};
    snap.forEach(d => {
      const t = d.data();
      if (t.phaseId && t.hours) hours[t.phaseId] = (hours[t.phaseId]||0) + t.hours;
    });
    return hours;
  } catch(e) { return {}; }
}


let _newFeatureEpics = [];

async function openAddPhaseModal() {
  if (!conCurrentJobId) return;
  const name = prompt('Phase name (e.g. "Demo", "Rough-in", "Paint", "Finish"):');
  if (!name?.trim()) return;
  try {
    const existing = await loadEpicTree(conCurrentJobId);
    await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
      name: name.trim(),
      order: existing.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      companyId: currentCompanyId,
    });
    renderJobGantt(conCurrentJobId);
  } catch(e) {
    alert('Error creating phase: ' + e.message);
  }
}

async function migrateLegacyPhaseToFeature(phaseId, phaseName, phaseStatus) {
  if (!confirm('Migrate "'+phaseName+'" into a real Feature? This replaces the old legacy card.')) return;
  try {
    const epics = await loadEpicTree(conCurrentJobId);
    let legacyEpic = epics.find(e => e.name === 'Legacy Phases');
    let epicId = legacyEpic ? legacyEpic.id : null;
    if (!epicId) {
      const epicRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
        name: 'Legacy Phases', order: epics.length, sprintEnabled: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      epicId = epicRef.id;
    }
    await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').doc(epicId)
      .collection('subgroups').add({
        name: phaseName, order: (legacyEpic?.features||[]).length,
        status: phaseStatus || 'not-started', dependsOn: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    await coll('jobs').doc(conCurrentJobId).collection('phases').doc(phaseId).delete();
    renderEpicBoard();
  } catch (e) {
    alert('Migration error: ' + e.message);
  }
}
window.migrateLegacyPhaseToFeature = migrateLegacyPhaseToFeature;

function onNewFeatureEpicChange() {
  const val = document.getElementById('newFeatureEpicSel').value;
  document.getElementById('newFeatureEpicNameRow').style.display = val === '__new__' ? 'block' : 'none';
}

async function saveNewFeature() {
  const name = document.getElementById('newFeatureName').value.trim();
  if (!name) { alert('Feature name is required.'); return; }
  const epicSel = document.getElementById('newFeatureEpicSel').value;
  if (!epicSel) { alert('Pick an Epic, or choose "New Epic" for a one-off situation.'); return; }

  let epicId = epicSel, epicName;
  try {
    if (epicSel === '__new__') {
      const newEpicName = document.getElementById('newFeatureEpicName').value.trim();
      if (!newEpicName) { alert('Name the new Epic.'); return; }
      const epicRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
        name: newEpicName,
        order: _newFeatureEpics.length,
        sprintEnabled: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      epicId = epicRef.id;
      epicName = newEpicName;
    } else {
      epicName = (_newFeatureEpics.find(e => e.id === epicId) || {}).name || '';
    }

    const order = (_newFeatureEpics.find(e => e.id === epicId)?.features || []).length;
    const featRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
      .doc(epicId).collection('subgroups').add({
        name, order, status: 'not-started', dependsOn: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    kClose('addPhaseModal');
    if (typeof renderEpicBoard === 'function') renderEpicBoard();
    openFeatureModal(epicId, epicName, { id: featRef.id, name, status: 'not-started', dependsOn: [], tasks: [] });
  } catch (e) {
    alert('Error creating Feature: ' + e.message);
  }
}

window.switchPhaseView=switchPhaseView;
window.openAddPhaseModal=openAddPhaseModal;
window.onNewFeatureEpicChange=onNewFeatureEpicChange;
window.saveNewFeature=saveNewFeature;


// ── Daily Logs ──
let conLogs = [];

function conLoadLogs(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('logs').orderBy('date','desc').onSnapshot(snap => {
    conLogs = [];
    snap.forEach(doc => conLogs.push({ id: doc.id, ...doc.data() }));
    renderLogList();
  });
}

function openAddLogModal() {
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('logWeather').selectedIndex = 0;
  document.getElementById('logCrew').value = '';
  document.getElementById('logNotes').value = '';
  document.getElementById('logIssues').value = '';
  kOpen('addLogModal');
}

function saveLog() {
  if (!conCurrentJobId || !conDb) return;
  const date = document.getElementById('logDate').value;
  if (!date) { alert('Date is required.'); return; }
  const data = {
    date,
    weather: document.getElementById('logWeather').value,
    crew: document.getElementById('logCrew').value.trim(),
    notes: document.getElementById('logNotes').value.trim(),
    issues: document.getElementById('logIssues').value.trim(),
    createdBy: conCurrentUser ? conCurrentUser.email : 'unknown',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  coll('jobs').doc(conCurrentJobId).collection('logs').add(subDoc(data))
    .then(() => { kClose('addLogModal'); switchDetailTab('logs', null); })
    .catch(e => alert('Error: ' + e.message));
}

function deleteLog(logId) {
  if (!confirm('Delete this log entry?')) return;
  coll('jobs').doc(conCurrentJobId).collection('logs').doc(logId).delete();
}

// ── UI helpers ──
function switchConTab(tab, btn) {
  ['conDashView','conBoardView','conListView','conCalView'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const map = { dashboard:'conDashView', board:'conBoardView', list:'conListView', calendar:'conCalView' };
  const target = document.getElementById(map[tab]);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.con-subtabs .con-subtab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'dashboard') renderJobCostDashboard();
}

// ════════════════════════════════════════════════════
// ── JOB COSTING DASHBOARD ──
// ════════════════════════════════════════════════════

const JCD_COST_CATEGORIES = ['Labor','Materials','Subcontractor','Equipment','Permits & Fees','Overhead','Other'];
let _jcdSortKey = 'margin';
let _jcdSortDir = 1; // 1=asc, -1=desc
let _jcdSelectedJobId = null;
let _jcdActualsCache = {}; // { jobId: { category: amount } }

// ── Top-level render ──────────────────────────────────
function renderJobCostDashboard() {
  // Financial import is PM/Owner only
  const impSec = document.getElementById('jcdImportSection');
  if (impSec) impSec.style.display = isOwnerOrAdmin() ? 'block' : 'none';
  renderJCDKpis();
  renderJCDPipeline();
  renderJCDAlerts();
  renderJCDTable();
  if (_jcdSelectedJobId) renderJCDJobDetail(_jcdSelectedJobId);
}

// ── KPI strip ────────────────────────────────────────
function renderJCDKpis() {
  const el = document.getElementById('jcdKpiStrip');
  if (!el) return;

  const jobs = conJobs;
  const active = jobs.filter(j => ['In Progress','Approved'].includes(j.status));
  const totalContract = jobs.reduce((s,j) => s + getJobValue(j), 0);
  const totalEst = jobs.reduce((s,j) => s + (j.estCost||0), 0);
  const totalActual = jobs.reduce((s,j) => s + getJobTotalActual(j.id), 0);

  // Weighted avg margin on jobs with contract value
  const marginJobs = jobs.filter(j => getJobValue(j) > 0 && j.estCost > 0 && j.estCost < getJobValue(j));
  const avgEstMargin = marginJobs.length
    ? marginJobs.reduce((s,j) => s + ((getJobValue(j) - j.estCost) / getJobValue(j) * 100), 0) / marginJobs.length
    : 0;

  // Jobs with margin < 15% (threshold warning)
  const atRisk = jobs.filter(j => {
    if (!getJobValue(j) || !j.estCost || j.estCost >= getJobValue(j)) return false;
    const m = (getJobValue(j) - j.estCost) / getJobValue(j) * 100;
    return m < 15 && ['In Progress','Scheduled','Inspection Pending'].includes(j.status);
  }).length;

  // Approved CO total
  const approvedCOTotal = _jcdCOTotals ? Object.values(_jcdCOTotals).reduce((s,v)=>s+v,0) : 0;

  const kpis = [
    { label:'Total Pipeline', val:'$'+Math.round(totalContract).toLocaleString(), sub: jobs.length+' job'+(jobs.length!==1?'s':''), accent:'var(--amber)' },
    { label:'Active Jobs', val: active.length, sub: 'In Progress + Approved', accent:'#4d8dff' },
    { label:'Avg Est. Margin', val: avgEstMargin.toFixed(1)+'%', sub:'Target ≥ 20%', accent: avgEstMargin >= 20 ? '#1dbb87' : avgEstMargin >= 15 ? '#f3b33d' : '#ef5350', valColor: avgEstMargin >= 20 ? '#a3f2d2' : avgEstMargin >= 15 ? '#ffe09d' : '#ffc0be' },
    { label:'Est. vs Actual', val: totalActual > 0 ? '$'+Math.round(totalActual).toLocaleString() : '—', sub: totalEst > 0 ? 'of $'+Math.round(totalEst).toLocaleString()+' est.' : 'No actuals yet', accent:'#f3b33d' },
    { label:'⚠ At-Risk Jobs', val: atRisk, sub: 'Margin < 15%', accent: atRisk > 0 ? '#ef5350' : '#1dbb87', valColor: atRisk > 0 ? '#ffc0be' : '#a3f2d2' },
  ];

  el.innerHTML = kpis.map(k => `
    <div class="jcd-kpi">
      <div class="jcd-kpi-accent" style="background:${k.accent}"></div>
      <div class="jcd-kpi-val" style="color:${k.valColor||'var(--amber)'}">${k.val}</div>
      <div class="jcd-kpi-label">${k.label}</div>
      <div class="jcd-kpi-sub">${k.sub}</div>
    </div>
  `).join('');
}

// ── Pipeline strip ────────────────────────────────────
function renderJCDPipeline() {
  const strip = document.getElementById('jcdPipelineStrip');
  const totalEl = document.getElementById('jcdPipelineTotal');
  if (!strip) return;

  let grandTotal = 0;

  strip.innerHTML = KANBAN_COLUMNS.filter(c => !c.hidden).map(col => {
    const jobs = conJobs.filter(j => col.statuses.includes(j.status));
    const val = jobs.reduce((t,j) => t + getJobValue(j), 0);
    grandTotal += val;
    return `<div class="pipeline-stage" onclick="filterJCDByStatus('${col.dropStatus}')" style="cursor:pointer;border-top:3px solid ${col.color}" title="Filter to ${col.label}">
      <div class="pipeline-stage-label" style="color:${col.color}">${col.label}</div>
      <div class="pipeline-stage-val" style="color:${col.color}">${val > 0 ? '$'+Math.round(val/1000)+'K' : '—'}</div>
      <div class="pipeline-stage-count">${jobs.length} job${jobs.length!==1?'s':''}</div>
    </div>`;
  }).join('');

  if (totalEl) totalEl.textContent = 'Total pipeline: $' + Math.round(grandTotal).toLocaleString();
}

function filterJCDByStatus(status) {
  const sel = document.getElementById('jcdStatusFilter');
  if (sel) { sel.value = sel.value === status ? '' : status; }
  renderJCDTable();
}

// ── Alerts ────────────────────────────────────────────
function renderJCDAlerts(containerId) {
  const el = document.getElementById(containerId || 'jcdAlerts');
  if (!el) return;
  const alerts = [];

  conJobs.forEach(j => {
    if (!ACTIVE_STATUSES.includes(j.status)) return;
    const cv = getJobValue(j);
    const ec = j.estCost || 0;
    const ac = getJobTotalActual(j.id);

    // Over budget
    if (ac > 0 && ec > 0 && ac > ec * 0.9) {
      alerts.push({ type: ac > ec ? 'bad' : 'warn', msg: `⚠️ ${j.name}: Actual cost ${ac > ec ? 'exceeds' : 'approaching'} estimate ($${Math.round(ac).toLocaleString()} vs $${Math.round(ec).toLocaleString()})` });
    }
    // Thin margin
    if (cv && ec) {
      const m = (cv - ec) / cv * 100;
      if (m < 10) alerts.push({ type: 'bad', msg: `🔴 ${j.name}: Estimated margin is ${m.toFixed(1)}% — below 10% threshold` });
      else if (m < 15) alerts.push({ type: 'warn', msg: `🟡 ${j.name}: Estimated margin is ${m.toFixed(1)}% — watch closely` });
    }
    // No estimate
    if (cv > 0 && !ec) alerts.push({ type: 'warn', msg: `📋 ${j.name}: No estimated cost set — margin unknown` });
  });

  if (!alerts.length) {
    el.innerHTML = `<div class="jcd-alert jcd-alert-ok">✅ All active jobs are within expected cost and margin targets.</div>`;
    return;
  }
  el.innerHTML = alerts.map(a => `<div class="jcd-alert ${a.type==='bad'?'':'jcd-alert-warn'}">${a.msg}</div>`).join('');
}

// ── Costing table ─────────────────────────────────────
let _jcdCOTotals = {}; // { jobId: approvedCOTotal }

function jcdSort(key) {
  if (_jcdSortKey === key) _jcdSortDir *= -1;
  else { _jcdSortKey = key; _jcdSortDir = -1; }
  renderJCDTable();
}

function renderJCDTable() {
  const tbody = document.getElementById('jcdTableBody');
  const tfoot = document.getElementById('jcdTableFoot');
  const sumEl = document.getElementById('jcdTableSummary');
  if (!tbody) return;

  const statusFilter = (document.getElementById('jcdStatusFilter')||{}).value || '';
  let jobs = statusFilter ? conJobs.filter(j => j.status === statusFilter) : conJobs;

  // Compute derived fields
  jobs = jobs.map(j => {
    const cv = getJobValue(j);
    const ec = j.estCost || 0;
    const ac = getJobTotalActual(j.id);
    const coTotal = _jcdCOTotals[j.id] || 0;
    const adjustedContract = cv + coTotal;
    const variance = ec > 0 ? ec - ac : 0;
    const margin = adjustedContract > 0 ? (adjustedContract - (ac > 0 ? ac : ec)) / adjustedContract * 100 : 0;
    return { ...j, _cv: cv, _ec: ec, _ac: ac, _coTotal: coTotal, _adjustedContract: adjustedContract, _variance: variance, _margin: margin };
  });

  // Sort
  jobs.sort((a, b) => {
    let av = a['_'+_jcdSortKey] ?? a[_jcdSortKey] ?? '';
    let bv = b['_'+_jcdSortKey] ?? b[_jcdSortKey] ?? '';
    if (typeof av === 'string') return av.localeCompare(bv) * _jcdSortDir;
    return (av - bv) * _jcdSortDir;
  });

  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No jobs found. Add your first job with + New Job.</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    if (sumEl) sumEl.textContent = '';
    return;
  }

  // Totals
  let totCV = 0, totEC = 0, totAC = 0, totCO = 0;
  jobs.forEach(j => { totCV += j._cv; totEC += j._ec; totAC += j._ac; totCO += j._coTotal; });

  tbody.innerHTML = jobs.map(j => {
    const mClass = j._margin >= 20 ? 'margin-good' : j._margin >= 10 ? 'margin-warn' : 'margin-bad';
    const varColor = j._variance >= 0 ? '#a3f2d2' : '#ef5350';
    const varSign = j._variance >= 0 ? '+' : '';
    const acDisplay = j._ac > 0 ? '$'+Math.round(j._ac).toLocaleString() : '<span style="color:var(--muted)">—</span>';
    const pctUsed = j._ec > 0 && j._ac > 0 ? Math.round(j._ac / j._ec * 100) : 0;
    const barColor = pctUsed > 100 ? '#ef5350' : pctUsed > 85 ? '#f3b33d' : '#1dbb87';

    return `<tr onclick="openJCDJobDetail('${j.id}')">
      <td>
        <div style="font-weight:700">${esc(j.name)}</div>
        <div style="font-size:.75rem;color:var(--amber)">${j.jobNumber||''}</div>
        <div style="font-size:.75rem;color:var(--muted)">${esc(j.client||'')}</div>
      </td>
      <td><span style="font-size:.75rem;background:var(--amber-light);color:var(--amber);padding:2px 8px;border-radius:999px">${j.status}</span></td>
      <td style="text-align:right;font-weight:700;color:#a3f2d2">$${Math.round(j._adjustedContract).toLocaleString()}</td>
      <td style="text-align:right">$${Math.round(j._ec).toLocaleString()}</td>
      <td style="text-align:right">
        ${acDisplay}
        ${pctUsed > 0 ? `<div class="variance-bar-wrap"><div class="variance-bar-fill" style="width:${Math.min(pctUsed,100)}%;background:${barColor}"></div></div>` : ''}
      </td>
      <td style="text-align:right;font-weight:700;color:${varColor}">${j._ac > 0 ? varSign+'$'+Math.abs(Math.round(j._variance)).toLocaleString() : '<span style="color:var(--muted)">—</span>'}</td>
      <td style="text-align:right"><span class="margin-pill ${mClass}">${j._margin.toFixed(1)}%</span></td>
      <td style="text-align:right;color:${j._coTotal > 0 ? '#ffe09d' : 'var(--muted)'}">
        ${j._coTotal > 0 ? '+$'+Math.round(j._coTotal).toLocaleString() : '—'}
      </td>
      <td><button class="btn" style="padding:3px 10px;font-size:.75rem" onclick="event.stopPropagation();openJCDJobDetail('${j.id}')">Detail →</button></td>
    </tr>`;
  }).join('');

  // Footer totals
  const avgM = jobs.filter(j=>j._adjustedContract>0).length
    ? jobs.filter(j=>j._adjustedContract>0).reduce((s,j)=>s+j._margin,0) / jobs.filter(j=>j._adjustedContract>0).length
    : 0;
  const mClass = avgM >= 20 ? 'margin-good' : avgM >= 10 ? 'margin-warn' : 'margin-bad';
  if (tfoot) tfoot.innerHTML = `<tr style="background:rgba(217,119,6,.06)">
    <td colspan="2" style="font-weight:800;color:var(--amber);padding:12px">TOTALS (${jobs.length} jobs)</td>
    <td style="text-align:right;font-weight:800;color:#a3f2d2">$${Math.round(totCV+totCO).toLocaleString()}</td>
    <td style="text-align:right;font-weight:700">$${Math.round(totEC).toLocaleString()}</td>
    <td style="text-align:right;font-weight:700">${totAC > 0 ? '$'+Math.round(totAC).toLocaleString() : '—'}</td>
    <td style="text-align:right;font-weight:700;color:${totEC-totAC>=0?'#a3f2d2':'#ef5350'}">${totAC>0?(totEC-totAC>=0?'+':'')+' $'+Math.abs(Math.round(totEC-totAC)).toLocaleString():'—'}</td>
    <td style="text-align:right"><span class="margin-pill ${mClass}">${avgM.toFixed(1)}%</span></td>
    <td style="text-align:right;color:#ffe09d">${totCO>0?'+$'+Math.round(totCO).toLocaleString():'—'}</td>
    <td></td>
  </tr>`;

  if (sumEl) sumEl.textContent = jobs.length + ' job' + (jobs.length!==1?'s':'') + ' · Pipeline: $' + Math.round(totCV).toLocaleString();
}

// ── Per-job detail panel ──────────────────────────────
function openJCDJobDetail(jobId) {
  _jcdSelectedJobId = jobId;
  const panel = document.getElementById('jcdJobDetail');
  if (panel) panel.style.display = 'block';
  // Scroll to it
  setTimeout(() => { if(panel) panel.scrollIntoView({ behavior:'smooth', block:'start' }); }, 100);
  // Load actuals from Firestore for this job
  loadJobCostActuals(jobId, () => renderJCDJobDetail(jobId));
}

function renderJCDJobDetail(jobId) {
  const job = conJobs.find(j => j.id === jobId);
  if (!job) return;

  const nameEl = document.getElementById('jcdDetailJobName');
  if (nameEl) nameEl.textContent = '💰 ' + job.name + ' — Cost Breakdown';

  const cv = getJobValue(job);
  const ec = job.estCost || 0;
  const ac = getJobTotalActual(jobId);
  const coTotal = _jcdCOTotals[jobId] || 0;
  const adjustedContract = cv + coTotal;
  const estMargin = adjustedContract > 0 ? ((adjustedContract - ec) / adjustedContract * 100) : 0;
  const actualMargin = adjustedContract > 0 && ac > 0 ? ((adjustedContract - ac) / adjustedContract * 100) : null;
  const variance = ec - ac;
  const pctComplete = ec > 0 && ac > 0 ? Math.min(100, (ac / ec * 100)).toFixed(0) : 0;

  // KPI row
  const kpiEl = document.getElementById('jcdDetailKpis');
  if (kpiEl) {
    const mClass = estMargin >= 20 ? '#a3f2d2' : estMargin >= 10 ? '#ffe09d' : '#ffc0be';
    const amClass = actualMargin !== null ? (actualMargin >= 20 ? '#a3f2d2' : actualMargin >= 10 ? '#ffe09d' : '#ffc0be') : 'var(--muted)';
    kpiEl.innerHTML = [
      { label:'Adjusted Contract', val:'$'+Math.round(adjustedContract).toLocaleString(), sub: coTotal>0?'Includes $'+Math.round(coTotal).toLocaleString()+' in COs':'No COs yet', color:'#a3f2d2' },
      { label:'Estimated Cost', val:'$'+Math.round(ec).toLocaleString(), sub:'Est. margin: '+estMargin.toFixed(1)+'%', color:mClass },
      { label:'Actual Cost', val: ac>0?'$'+Math.round(ac).toLocaleString():'Not entered', sub: ac>0?pctComplete+'% of estimate used':'Enter actuals below', color: ac>0?amClass:'var(--muted)' },
      { label:'Variance', val: ac>0?(variance>=0?'+':'')+' $'+Math.abs(Math.round(variance)).toLocaleString():'—', sub: ac>0?(variance>=0?'Under budget':'OVER budget'):'Awaiting actuals', color: variance>=0?'#a3f2d2':'#ffc0be' },
    ].map(k=>`<div style="background:rgba(8,18,36,.8);border:1px solid var(--amber-border);border-radius:12px;padding:12px 14px">
      <div style="font-size:1.3rem;font-weight:900;color:${k.color}">${k.val}</div>
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-top:3px">${k.label}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${k.sub}</div>
    </div>`).join('');
  }

  // Alerts
  renderJCDAlerts('jcdDetailAlerts');

  // Category table — estimate comes from estimate line items, actuals are manually entered
  const catBody = document.getElementById('jcdCostCatBody');
  const catTotals = document.getElementById('jcdCostCatTotals');
  if (!catBody) return;

  const actuals = _jcdActualsCache[jobId] || {};
  // Build estimated cost per category from estimate sub-collection (cached in _jcdEstCache)
  const estByCat = _jcdEstCache[jobId] || {};

  let totalEst = 0, totalActual = 0;
  catBody.innerHTML = JCD_COST_CATEGORIES.map(cat => {
    const estVal = estByCat[cat] || 0;
    const actVal = actuals[cat] || 0;
    const variance2 = estVal - actVal;
    const pct = estVal > 0 ? Math.min(200, (actVal / estVal * 100)) : 0;
    const barColor = pct > 100 ? '#ef5350' : pct > 85 ? '#f3b33d' : '#1dbb87';
    totalEst += estVal;
    totalActual += actVal;
    return `<div class="cost-cat-row">
      <div>
        <div class="cost-cat-label">${cat}</div>
        ${pct > 0 ? `<div class="variance-bar-wrap" style="min-width:unset"><div class="variance-bar-fill" style="width:${Math.min(pct,100)}%;background:${barColor}"></div></div>` : ''}
      </div>
      <div style="text-align:right;color:var(--muted)">${estVal>0?'$'+Math.round(estVal).toLocaleString():'—'}</div>
      <div style="text-align:right">
        <input class="cost-cat-input" type="number" step="1" placeholder="0"
          value="${actVal||''}"
          onchange="updateJobCostActual('${jobId}','${cat}',this.value)"
          id="costCatInput_${cat.replace(/[^a-z0-9]/gi,'_')}" />
      </div>
      <div style="text-align:right;font-weight:700;color:${variance2>=0?'#a3f2d2':variance2<0?'#ef5350':'var(--muted)'}">
        ${actVal>0 ? (variance2>=0?'+':'')+' $'+Math.abs(Math.round(variance2)).toLocaleString() : '—'}
      </div>
      <div style="text-align:right;color:${pct>100?'#ef5350':pct>85?'#f3b33d':'var(--muted)'}">
        ${pct>0?pct.toFixed(0)+'%':'—'}
      </div>
    </div>`;
  }).join('');

  // Totals row
  if (catTotals) {
    const netV = totalEst - totalActual;
    catTotals.innerHTML = `<div class="cost-cat-row" style="font-weight:800;font-size:.92rem;border-top:none">
      <div style="color:var(--amber)">TOTAL</div>
      <div style="text-align:right;color:var(--muted)">${totalEst>0?'$'+Math.round(totalEst).toLocaleString():'—'}</div>
      <div style="text-align:right;font-weight:800;color:#eaf0fb">${totalActual>0?'$'+Math.round(totalActual).toLocaleString():'—'}</div>
      <div style="text-align:right;font-weight:800;color:${netV>=0?'#a3f2d2':'#ef5350'}">${totalActual>0?(netV>=0?'+':'')+' $'+Math.abs(Math.round(netV)).toLocaleString():'—'}</div>
      <div style="text-align:right;color:${totalEst>0&&totalActual/totalEst>1?'#ef5350':totalEst>0&&totalActual/totalEst>0.85?'#f3b33d':'var(--muted)'}">
        ${totalEst>0&&totalActual>0?Math.round(totalActual/totalEst*100)+'%':'—'}
      </div>
    </div>`;
  }

  // Cost-to-complete panel
  const ctcEl = document.getElementById('jcdCtcPanel');
  if (ctcEl) {
    const pctDone = totalEst > 0 && totalActual > 0 ? totalActual / totalEst : 0;
    const projFinal = pctDone > 0 ? totalActual / pctDone : totalEst;
    const projVariance = totalEst - projFinal;
    const projMargin = adjustedContract > 0 ? ((adjustedContract - projFinal) / adjustedContract * 100) : 0;
    ctcEl.innerHTML = `<div style="font-size:.8rem;font-weight:700;color:var(--amber);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">📈 Cost-to-Complete Projection</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:.86rem">
        <div><div style="color:var(--muted);font-size:.72rem;margin-bottom:2px">% Budget Used</div><div style="font-weight:700">${pctDone>0?(pctDone*100).toFixed(0)+'%':'No actuals yet'}</div></div>
        <div><div style="color:var(--muted);font-size:.72rem;margin-bottom:2px">Projected Final Cost</div><div style="font-weight:700;color:${projFinal>totalEst?'#ef5350':'#a3f2d2'}">${totalActual>0?'$'+Math.round(projFinal).toLocaleString():'—'}</div></div>
        <div><div style="color:var(--muted);font-size:.72rem;margin-bottom:2px">Projected Margin</div><div style="font-weight:700;color:${projMargin>=20?'#a3f2d2':projMargin>=10?'#ffe09d':'#ffc0be'}">${totalActual>0?projMargin.toFixed(1)+'%':'—'}</div></div>
      </div>
      <div style="font-size:.75rem;color:rgba(110,145,210,.4);margin-top:8px">Projection uses actual spend rate to forecast final cost. Assumes current cost pace continues.</div>`;
  }
}

// ── Actuals storage ───────────────────────────────────
let _jcdEstCache = {}; // { jobId: { category: estTotal } }

function loadJobCostActuals(jobId, callback) {
  if (!conDb) { if(callback) callback(); return; }
  // Load actuals from Firestore job document field
  coll('jobs').doc(jobId).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.costActuals) _jcdActualsCache[jobId] = data.costActuals;
      else _jcdActualsCache[jobId] = {};
    }
    // Also load estimate sub-collection to build estByCat
    return coll('jobs').doc(jobId).collection('estimate').get();
  }).then(snap => {
    const byCat = {};
    snap.forEach(doc => {
      const item = doc.data();
      const cat = item.category || 'Other';
      const qty = Number(item.qty||1);
      const uc = Number(item.unitCost||0);
      const markup = Number(item.markup||0);
      const lineTotal = qty * uc * (1 + markup/100);
      byCat[cat] = (byCat[cat]||0) + lineTotal;
    });
    _jcdEstCache[jobId] = byCat;
    if(callback) callback();
  }).catch(e => {
    console.warn('loadJobCostActuals error:', e);
    if(callback) callback();
  });
}

function updateJobCostActual(jobId, category, value) {
  if (!_jcdActualsCache[jobId]) _jcdActualsCache[jobId] = {};
  _jcdActualsCache[jobId][category] = parseFloat(value) || 0;
}

function saveJobCostActuals() {
  const jobId = _jcdSelectedJobId;
  if (!jobId || !conDb) return;
  const actuals = _jcdActualsCache[jobId] || {};
  const totalActual = Object.values(actuals).reduce((s,v)=>s+v,0);
  coll('jobs').doc(jobId).update({
    costActuals: actuals,
    actualCost: totalActual,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    // Refresh
    renderJCDJobDetail(jobId);
    renderJCDKpis();
    renderJCDTable();
    renderJCDAlerts();
    // Brief save confirmation
    const btn = document.querySelector('[onclick="saveJobCostActuals()"]');
    if (btn) { btn.textContent = '✅ Saved'; setTimeout(()=>btn.textContent='💾 Save Actuals', 1500); }
  }).catch(e => alert('Error saving: ' + e.message));
}

function getJobTotalActual(jobId) {
  // Use cached actuals or fall back to job.actualCost
  const cached = _jcdActualsCache[jobId];
  if (cached) return Object.values(cached).reduce((s,v)=>s+v, 0);
  const job = conJobs.find(j=>j.id===jobId);
  return job ? (job.actualCost||0) : 0;
}

// ── Load CO totals for all jobs (approved only) ────────
function loadAllCOTotals() {
  if (!conDb || !conJobs.length) return;
  conJobs.forEach(job => {
    coll('jobs').doc(job.id).collection('changeorders')
      .where('status','==','Approved').get()
      .then(snap => {
        let total = 0;
        snap.forEach(doc => { total += Number(doc.data().amount||0); });
        _jcdCOTotals[job.id] = total;
      }).catch(()=>{});
  });
}

// ── Expose dashboard functions ──
window.renderJobCostDashboard = renderJobCostDashboard;
window.openJCDJobDetail = openJCDJobDetail;
window.saveJobCostActuals = saveJobCostActuals;
window.filterJCDByStatus = filterJCDByStatus;
window.jcdSort = jcdSort;
window.updateJobCostActual = updateJobCostActual;
window.renderJCDTable = renderJCDTable;

// conLoadJobs CO patch removed — consolidated into main function above

function commitJobStatusChange(newStatus) {
  const jobId = conCurrentJobId;
  const job = conJobs.find(j => j.id === jobId);
  if (!job || !jobId) return;
  if (job.status === newStatus) return;

  // Confirm on closing statuses — this is a meaningful, hard-to-undo action.
  if ((newStatus === 'Closed Completed' || newStatus === 'Closed Lost') &&
      !confirm('Mark this job as "' + newStatus + '"? This updates the job\'s status for everyone.')) {
    document.getElementById('detailStatusBadge').value = job.status || 'New Lead';
    return;
  }

  const prevStatus = job.status;
  job.status = newStatus; // optimistic local update
  document.getElementById('detailStatusBadge').value = newStatus;

  coll('jobs').doc(jobId).update({
    status: newStatus,
    statusDate: new Date().toISOString().split('T')[0],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
  }).then(() => {
    if (typeof conRenderBoard === 'function') conRenderBoard();
    if (typeof renderJobsBoard === 'function') renderJobsBoard();
  }).catch(err => {
    job.status = prevStatus; // revert on failure
    document.getElementById('detailStatusBadge').value = prevStatus || 'New Lead';
    alert('Could not update job status: ' + err.message);
  });
}
window.commitJobStatusChange = commitJobStatusChange;

function switchDetailTab(tab, btn) {
  const allTabs = ['dashboard','financials','estimate','changeorders','subs','phases','logs','invoices','documents','activity','retrospective','todos','selections','specifications','plans','messages','reports'];
  allTabs.forEach(t => {
    const key = 'detail' + t.charAt(0).toUpperCase() + t.slice(1);
    const el = document.getElementById(key);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#jobDetailModal .con-subtab').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const btns = document.querySelectorAll('#jobDetailModal .con-subtab');
    if (btns[0]) btns[0].classList.add('active');
  }
  if (tab === 'estimate') loadEstimate(conCurrentJobId);
  if (tab === 'changeorders') renderCOList();
  if (tab === 'subs') { loadJobBidRequests(conCurrentJobId); renderSubList(); }
  if (tab === 'documents') { loadJobDocs(conCurrentJobId); loadJobPhotos(conCurrentJobId); }
  if (tab === 'phases') { renderJobGantt(conCurrentJobId); }
  if (tab === 'logs') renderLogList();
  if (tab === 'invoices') loadJobInvoices(conCurrentJobId);
  if (tab === 'activity') loadJobActivity(conCurrentJobId, 'full');
  if (tab === 'jobnotes') loadJobNotes(conCurrentJobId);
  if (tab === 'retrospective') loadRetrospective(conCurrentJobId);
  if (tab === 'financials') renderFinancialsHub(conCurrentJobId);
  if (tab === 'todos') renderJobTodos(conCurrentJobId);
  if (tab === 'selections') loadSelections(conCurrentJobId);
  if (tab === 'specifications') loadSpecifications(conCurrentJobId);
  if (tab === 'plans') loadPlans(conCurrentJobId);
  if (tab === 'messages') loadJobMessages(conCurrentJobId);
  if (tab === 'reports') renderJobReports(conCurrentJobId);
}

// ════════════════════════════════════════════════════
// ── FINANCIAL HUB (per-job) ──
// ════════════════════════════════════════════════════
let _fhInvoices = [];
let _fhBills = [];
let _fhBillsLoadedFor = null;

function finhubToggle(bodyId, headEl) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  const chev = headEl ? headEl.querySelector('.finhub-chev') : null;
  if (chev) chev.classList.toggle('closed', open);
}

const FH_INV_COLORS = { Paid:'#1dbb87', 'Partially Paid':'#f59e0b', Partial:'#f59e0b', Sent:'#4d8dff', Draft:'#8ea3c8', Overdue:'#ef5350' };
const FH_CO_COLORS  = { Approved:'#1dbb87', Pending:'#f59e0b', Rejected:'#ef5350', Void:'#8ea3c8' };
const FH_BILL_COLORS = { Paid:'#1dbb87', Partial:'#f97316', Unpaid:'#f59e0b', Overdue:'#ef5350' };

function fhBadge(txt, color) {
  return `<span class="finhub-badge" style="color:${color};background:${color}22">${esc(txt)}</span>`;
}
function fhMoney(n) { return '$' + Math.round(n||0).toLocaleString(); }

// Load bills tagged to this job across all vendors (bills live under vendors/{id}/bills with a jobId field)
function fhLoadJobBills(jobId, cb) {
  if (!conDb || !Array.isArray(allVendors) || !allVendors.length) { _fhBills = []; cb && cb(); return; }
  const bills = [];
  let pending = allVendors.length;
  allVendors.forEach(v => {
    coll('vendors').doc(v.id).collection('bills').where('jobId','==',jobId).get()
      .then(snap => { snap.forEach(d => bills.push({ id:d.id, vendorId:v.id, vendorName:v.name, ...d.data() })); })
      .catch(() => {})
      .finally(() => { if (--pending === 0) { _fhBills = bills; cb && cb(); } });
  });
}

function renderFinancialsHub(jobId) {
  const job = conJobs.find(j => j.id === jobId);
  if (!job) return;

  // Invoices (subcollection on job) — one-shot get
  coll('jobs').doc(jobId).collection('invoices').get()
    .then(snap => { _fhInvoices = []; snap.forEach(d => _fhInvoices.push({ id:d.id, ...d.data() })); fhRenderInvoices(); fhRenderTotals(job); })
    .catch(() => { _fhInvoices = []; fhRenderInvoices(); fhRenderTotals(job); });

  // Change orders already loaded into conCOs when job opened
  fhRenderCOs();

  // Bills across vendors
  fhRenderBillsLoading();
  fhLoadJobBills(jobId, () => { fhRenderBills(); fhRenderTotals(job); });

  fhRenderEva();
}

function fhRenderInvoices() {
  const el = document.getElementById('fhInvSec');
  const cnt = document.getElementById('fhInvCount');
  const sum = document.getElementById('fhInvSum');
  if (!el) return;
  const invs = _fhInvoices.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const total = invs.reduce((s,i)=>s+(i.total||0),0);
  const paid = invs.reduce((s,i)=>s+(i.amtPaid||0),0);
  if (cnt) cnt.textContent = invs.length;
  if (sum) sum.textContent = invs.length ? `${fhMoney(paid)} / ${fhMoney(total)} collected` : '';
  const today = new Date().toISOString().split('T')[0];
  if (!invs.length) { el.innerHTML = '<div class="finhub-empty">No invoices yet for this job.</div>'; return; }
  el.innerHTML = invs.map(inv => {
    const bal = (inv.total||0) - (inv.amtPaid||0);
    let status = inv.status || 'Draft';
    if (status !== 'Paid' && inv.dueDate && inv.dueDate < today) status = 'Overdue';
    const color = FH_INV_COLORS[status] || '#8ea3c8';
    return `<div class="finhub-line" onclick="openEditInvoice('${inv.jobId||conCurrentJobId}','${inv.id}')" style="cursor:pointer">
      <div><div class="finhub-line-title">${esc(inv.number||'Draft')}</div><div class="finhub-line-sub">${esc(inv.type||'Invoice')} · ${inv.date||'—'}${inv.dueDate?` · due ${inv.dueDate}`:''}</div></div>
      <div class="finhub-line-amt">${fhMoney(inv.total)}</div>
      <div class="finhub-line-bal" style="color:${bal>0?'#fde68a':'#a3f2d2'}">${bal>0?fhMoney(bal)+' due':'paid'}</div>
      <div>${fhBadge(status,color)}</div>
    </div>`;
  }).join('');
}

function fhRenderCOs() {
  const el = document.getElementById('fhCOSec');
  const cnt = document.getElementById('fhCOCount');
  const sum = document.getElementById('fhCOSum');
  if (!el) return;
  const cos = Array.isArray(conCOs) ? conCOs : [];
  const approved = cos.filter(c=>c.status==='Approved').reduce((s,c)=>s+Number(c.amount||0),0);
  const pending = cos.filter(c=>c.status==='Pending').reduce((s,c)=>s+Number(c.amount||0),0);
  if (cnt) cnt.textContent = cos.length;
  if (sum) sum.textContent = cos.length ? `+${fhMoney(approved)} approved${pending?` · ${fhMoney(pending)} pending`:''}` : '';
  if (!cos.length) { el.innerHTML = '<div class="finhub-empty">No change orders.</div>'; return; }
  el.innerHTML = cos.map(co => {
    const amt = Number(co.amount||0);
    const color = FH_CO_COLORS[co.status] || '#8ea3c8';
    return `<div class="finhub-line" onclick="switchDetailTab('changeorders',null)" style="cursor:pointer">
      <div><div class="finhub-line-title">${esc(co.title||'Untitled CO')}</div><div class="finhub-line-sub">${co.date||'—'}${co.days?` · +${co.days}d`:''}</div></div>
      <div class="finhub-line-amt" style="color:${amt>=0?'var(--amber)':'#ef5350'}">${amt>=0?'+':''}${fhMoney(Math.abs(amt))}</div>
      <div></div>
      <div>${fhBadge(co.status,color)}</div>
    </div>`;
  }).join('');
}

function fhRenderBillsLoading() {
  const el = document.getElementById('fhBillSec');
  if (el) el.innerHTML = '<div class="finhub-empty">Loading bills…</div>';
}

function fhRenderBills() {
  const el = document.getElementById('fhBillSec');
  const cnt = document.getElementById('fhBillCount');
  const sum = document.getElementById('fhBillSum');
  if (!el) return;
  const bills = _fhBills.slice().sort((a,b) => (b.billDate||'').localeCompare(a.billDate||''));
  const total = bills.reduce((s,b)=>s+(b.amount||0),0);
  const paid = bills.reduce((s,b)=>s+(b.amtPaid||0),0);
  const owed = total - paid;
  if (cnt) cnt.textContent = bills.length;
  if (sum) sum.textContent = bills.length ? `${fhMoney(owed)} owed of ${fhMoney(total)}` : '';
  const today = new Date().toISOString().split('T')[0];
  if (!bills.length) { el.innerHTML = '<div class="finhub-empty">No vendor bills tagged to this job.</div>'; return; }
  el.innerHTML = bills.map(b => {
    const bal = (b.amount||0) - (b.amtPaid||0);
    let status = b.status || 'Unpaid';
    if (status !== 'Paid' && b.dueDate && b.dueDate < today) status = 'Overdue';
    const color = FH_BILL_COLORS[status] || '#f59e0b';
    return `<div class="finhub-line" onclick="openVendorFromBill('${esc(b.vendorId)}','${b.id}')" style="cursor:pointer">
      <div><div class="finhub-line-title">${esc(b.vendorName||'Vendor')}</div><div class="finhub-line-sub">${esc(b.desc||'')}${b.dueDate?` · due ${b.dueDate}`:''}</div></div>
      <div class="finhub-line-amt">${fhMoney(b.amount)}</div>
      <div class="finhub-line-bal" style="color:${bal>0?'#fca5a5':'#a3f2d2'}">${bal>0?fhMoney(bal)+' owed':'paid'}</div>
      <div>${fhBadge(status,color)}</div>
    </div>`;
  }).join('');
}

function openVendorFromBill(vendorId, billId) {
  // Best-effort: jump to vendor detail if available, else no-op
  if (typeof openVendorDetail === 'function' && vendorId) { openVendorDetail(vendorId); }
}

function fhRenderEva() {
  const sum = document.getElementById('fhEvaSum');
  const job = conJobs.find(j => j.id === conCurrentJobId);
  if (sum && job) {
    const ec = job.estCost||0, ac = job.actualCost||0;
    sum.textContent = ac ? `${fhMoney(ac)} actual of ${fhMoney(ec)} est` : `${fhMoney(ec)} est`;
  }
}

function fhRenderTotals(job) {
  const contract = getJobValue(job);
  const approvedCO = (Array.isArray(conCOs)?conCOs:[]).filter(c=>c.status==='Approved').reduce((s,c)=>s+Number(c.amount||0),0);
  const contractTotal = contract + approvedCO;
  const invoiced = _fhInvoices.reduce((s,i)=>s+(i.total||0),0);
  const collected = _fhInvoices.reduce((s,i)=>s+(i.amtPaid||0),0);
  const owedUs = invoiced - collected;
  const billsTotal = _fhBills.reduce((s,b)=>s+(b.amount||0),0);
  const billsPaid = _fhBills.reduce((s,b)=>s+(b.amtPaid||0),0);
  const weOwe = billsTotal - billsPaid;
  const ec = job.estCost||0, ac = job.actualCost||0;
  const costToComplete = Math.max(ec - ac, 0);
  const net = collected - billsPaid;

  const set = (id,v,color) => { const el=document.getElementById(id); if(el){ el.textContent=fhMoney(v); if(color)el.style.color=color; } };
  set('fhContract', contractTotal);
  set('fhInvoiced', invoiced);
  set('fhCollected', collected, '#a3f2d2');
  set('fhOwedUs', owedUs, owedUs>0?'#fde68a':'#a3f2d2');
  set('fhBills', billsTotal);
  set('fhBillsPaid', billsPaid, '#a3f2d2');
  set('fhWeOwe', weOwe, weOwe>0?'#fca5a5':'#a3f2d2');
  set('fhCostComplete', costToComplete);

  const netEl = document.getElementById('fhNet');
  if (netEl) { netEl.textContent = (net<0?'-':'')+fhMoney(Math.abs(net)); netEl.style.color = net>=0?'#a3f2d2':'#fca5a5'; }
  const netSub = document.getElementById('fhNetSub');
  if (netSub) netSub.textContent = `${fhMoney(owedUs)} still coming in · ${fhMoney(weOwe)} still going out`;
}



// Expose to window
window.conSignIn = conSignIn;
window.conSignOut = conSignOut;
window.openNewJobModal = openNewJobModal;
window.saveJob = saveJob;
window.openJobDetail = openJobDetail;
window.editCurrentJob = editCurrentJob;
window.saveActualCost = saveActualCost;
window.openAddPhaseModal = openAddPhaseModal;
window.openAddLogModal = openAddLogModal;
window.saveLog = saveLog;
window.deleteLog = deleteLog;
window.switchConTab = switchConTab;
window.switchDetailTab = switchDetailTab;

// ════════════════════════════════════════════════════
// ── NOTIFICATION SYSTEM ──
// Independent read tracking per user for Notes, Messages, Change Orders.
// Badge on sidebar nav shows unread count. Clears only when that user
// opens and views the relevant page. Travis and Jason track independently.
// ════════════════════════════════════════════════════

// ── Read state stored in Firestore under user's profile ──
// Path: companies/{companyId}/userReadState/{userEmail}/readNotes/{noteId}
// Path: companies/{companyId}/userReadState/{userEmail}/readMessages/{msgId}
// Path: companies/{companyId}/userReadState/{userEmail}/readCOs/{coId}

function getReadStateRef(type) {
  const email = (conCurrentUser?.email || '').replace(/\./g, '_').replace(/@/g, '_at_');
  if (!email || !currentCompanyId || !conDb) return null;
  return conDb.collection('companies').doc(currentCompanyId)
    .collection('userReadState').doc(email).collection(type);
}

// ── Update a sidebar badge ──
function setNavBadge(badgeId, count) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = 'inline-block';
  } else {
    el.style.display = 'none';
  }
}

// ── NOTES: load all job notes across all jobs, track unread ──
async function loadGlobalNotes() {
  const el = document.getElementById('globalNotesList');
  if (!el || !conDb || !currentCompanyId) return;
  el.innerHTML = '<div class="small muted" style="text-align:center;padding:32px">Loading…</div>';

  const myEmail = (conCurrentUser?.email || '').toLowerCase();
  const isOwnerOrFullAccess = conUserRole === 'Owner' || window._hasFullAccess;

  const allNotes = [];
  // Skip collection group query (needs Firestore index) — go straight to per-job
  for (const job of conJobs.slice(0, 30)) {
    try {
      const snap = await coll('jobs').doc(job.id).collection('jobNotes')
        .orderBy('createdMs', 'desc').limit(20).get();
      snap.forEach(d => allNotes.push({ id: d.id, ...d.data(), jobId: job.id, jobName: job.name }));
    } catch(e) {
      // orderBy may fail without index — try without
      try {
        const snap2 = await coll('jobs').doc(job.id).collection('jobNotes').limit(20).get();
        snap2.forEach(d => allNotes.push({ id: d.id, ...d.data(), jobId: job.id, jobName: job.name }));
      } catch(e2) {}
    }
  }
  allNotes.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));

  // Get read state for current user
  const readRef = getReadStateRef('readNotes');
  const readSnap = readRef ? await readRef.get().catch(() => null) : null;
  const readIds = new Set();
  if (readSnap) readSnap.forEach(d => readIds.add(d.id));

  // Count unread — notes NOT by me that I haven't read
  const unread = allNotes.filter(n =>
    (n.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(n.id)
  );
  setNavBadge('navNotesBadge', unread.length);

  if (!allNotes.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No notes yet across any jobs.</div>';
    return;
  }

  el.innerHTML = allNotes.map(n => {
    const isUnread = (n.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(n.id);
    const ts = n.createdMs ? new Date(n.createdMs) : null;
    const dateStr = ts ? ts.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : '';
    const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '';
    return `<div onclick="markNoteRead('${n.id}','${n.jobId}',this)" style="background:${isUnread ? 'rgba(217,119,6,.08)' : 'rgba(8,18,36,.6)'};border:1px solid ${isUnread ? 'rgba(217,119,6,.4)' : 'var(--line)'};border-radius:12px;padding:14px;cursor:pointer;transition:background .2s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div>
          ${isUnread ? '<span style="background:#d97706;color:#fff;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:6px;margin-right:6px">NEW</span>' : ''}
          <span style="font-weight:700;color:#eaf0fb">${esc(n.authorName || n.authorEmail || 'Unknown')}</span>
          <span style="color:var(--muted);font-size:.8rem"> on </span>
          <span style="color:var(--amber);font-size:.82rem;font-weight:700;cursor:pointer" onclick="event.stopPropagation();openJobDetail('${n.jobId}')">${esc(n.jobName)}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">${dateStr} · ${timeStr}</div>
      </div>
      ${n.category ? `<div style="margin-bottom:6px"><span style="background:rgba(217,119,6,.15);color:#f59e0b;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:700">${esc(n.category)}</span></div>` : ''}
      <div style="font-size:.88rem;color:#eaf0fb;line-height:1.55;white-space:pre-wrap">${esc(n.text || '')}</div>
    </div>`;
  }).join('');

  // Mark all as read when page is viewed
  if (readRef && unread.length) {
    const batch = conDb.batch();
    unread.forEach(n => batch.set(readRef.doc(n.id), { readAt: Date.now() }));
    batch.commit().catch(() => {});
    setTimeout(() => setNavBadge('navNotesBadge', 0), 1000);
  }
}
window.loadGlobalNotes = loadGlobalNotes;

async function markNoteRead(noteId, jobId, el) {
  const readRef = getReadStateRef('readNotes');
  if (readRef) readRef.doc(noteId).set({ readAt: Date.now() }).catch(() => {});
  if (el) {
    el.style.background = 'rgba(8,18,36,.6)';
    el.style.borderColor = 'var(--line)';
    const badge = el.querySelector('span[style*="NEW"]');
    if (badge) badge.remove();
  }
  refreshNotificationBadges();
}
window.markNoteRead = markNoteRead;

async function markAllNotesRead() {
  await loadGlobalNotes();
}
window.markAllNotesRead = markAllNotesRead;

// ── MESSAGES: load all job messages, track unread ──
async function loadGlobalMessages() {
  const el = document.getElementById('globalMessagesList');
  if (!el || !conDb) return;
  el.innerHTML = '<div class="small muted" style="text-align:center;padding:32px">Loading…</div>';

  const myEmail = (conCurrentUser?.email || '').toLowerCase();
  const allMsgs = [];

  for (const job of conJobs.slice(0, 20)) {
    try {
      const snap = await coll('jobs').doc(job.id).collection('messages')
        .orderBy('createdMs', 'desc').limit(10).get();
      snap.forEach(d => allMsgs.push({ id: d.id, ...d.data(), jobId: job.id, jobName: job.name }));
    } catch(e) {}
  }
  allMsgs.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));

  const readRef = getReadStateRef('readMessages');
  const readSnap = readRef ? await readRef.get().catch(() => null) : null;
  const readIds = new Set();
  if (readSnap) readSnap.forEach(d => readIds.add(d.id));

  const unread = allMsgs.filter(m =>
    (m.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(m.id)
  );
  setNavBadge('navMessagesBadge', unread.length);

  if (!allMsgs.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No messages yet.</div>';
    return;
  }

  el.innerHTML = allMsgs.map(m => {
    const isUnread = (m.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(m.id);
    const ts = m.createdMs ? new Date(m.createdMs) : null;
    const dateStr = ts ? ts.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : '';
    const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '';
    const sender = m.fromCustomer ? `${esc(m.authorName || 'Customer')} (Customer)` : esc(m.authorName || m.authorEmail || 'Team');
    return `<div style="background:${isUnread ? 'rgba(99,179,237,.08)' : 'rgba(8,18,36,.6)'};border:1px solid ${isUnread ? 'rgba(99,179,237,.4)' : 'var(--line)'};border-radius:12px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <div>
          ${isUnread ? '<span style="background:#3b82f6;color:#fff;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:6px;margin-right:6px">NEW</span>' : ''}
          <span style="font-weight:700;color:#eaf0fb">${sender}</span>
          <span style="color:var(--muted);font-size:.8rem"> on </span>
          <span style="color:var(--amber);font-size:.82rem;font-weight:700;cursor:pointer" onclick="openJobDetail('${m.jobId}');switchDetailTab('messages',null)">${esc(m.jobName)}</span>
        </div>
        <div style="font-size:.72rem;color:var(--muted)">${dateStr} · ${timeStr}</div>
      </div>
      <div style="font-size:.88rem;color:#eaf0fb;line-height:1.55">${esc(m.text || '')}</div>
    </div>`;
  }).join('');

  // Mark all read on view
  if (readRef && unread.length) {
    const batch = conDb.batch();
    unread.forEach(m => batch.set(readRef.doc(m.id), { readAt: Date.now() }));
    batch.commit().catch(() => {});
    setTimeout(() => setNavBadge('navMessagesBadge', 0), 1000);
  }
}
window.loadGlobalMessages = loadGlobalMessages;

async function markAllMessagesRead() {
  await loadGlobalMessages();
}
window.markAllMessagesRead = markAllMessagesRead;

// ── CHANGE ORDERS: load all COs, flag unprocessed, auto-create To-Do ──
async function loadGlobalChangeOrders() {
  const el = document.getElementById('globalCOList');
  if (!el || !conDb) return;
  el.innerHTML = '<div class="small muted" style="text-align:center;padding:32px">Loading…</div>';

  const allCOs = [];
  for (const job of conJobs.slice(0, 20)) {
    try {
      const snap = await coll('jobs').doc(job.id).collection('changeOrders')
        .orderBy('createdAt', 'desc').limit(20).get();
      snap.forEach(d => allCOs.push({ id: d.id, ...d.data(), jobId: job.id, jobName: job.name }));
    } catch(e) {
      try {
        const snap2 = await coll('jobs').doc(job.id).collection('changeOrders').limit(20).get();
        snap2.forEach(d => allCOs.push({ id: d.id, ...d.data(), jobId: job.id, jobName: job.name }));
      } catch(e2) {}
    }
  }

  const unprocessed = allCOs.filter(co =>
    !['approved','declined','rejected'].includes((co.status || '').toLowerCase())
  );
  setNavBadge('navCOBadge', unprocessed.length);

  if (!allCOs.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No change orders yet.</div>';
    return;
  }

  const statusColor = { approved:'#1dbb87', declined:'#ef5350', rejected:'#ef5350', pending:'#f59e0b', draft:'#94a3b8' };

  el.innerHTML = allCOs.map(co => {
    const status = (co.status || 'pending').toLowerCase();
    const isUnprocessed = !['approved','declined','rejected'].includes(status);
    const sc = statusColor[status] || '#f59e0b';
    const amount = co.amount || co.total || 0;
    return `<div style="background:${isUnprocessed ? 'rgba(239,83,80,.07)' : 'rgba(8,18,36,.6)'};border:1px solid ${isUnprocessed ? 'rgba(239,83,80,.4)' : 'var(--line)'};border-radius:12px;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          ${isUnprocessed ? '<span style="background:#ef5350;color:#fff;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:6px;margin-right:6px">ACTION NEEDED</span>' : ''}
          <span style="font-weight:700;color:#eaf0fb">${esc(co.title || co.description || 'Change Order')}</span>
          <span style="color:var(--muted);font-size:.8rem"> · </span>
          <span style="color:var(--amber);font-size:.82rem;font-weight:700;cursor:pointer" onclick="openJobDetail('${co.jobId}');switchDetailTab('changeorders',null)">${esc(co.jobName)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${amount ? `<span style="font-weight:700;color:#eaf0fb">$${Number(amount).toLocaleString(undefined,{minimumFractionDigits:2})}</span>` : ''}
          <span style="font-size:.75rem;font-weight:700;color:${sc};text-transform:uppercase">${co.status || 'Pending'}</span>
        </div>
      </div>
      ${co.description ? `<div style="margin-top:8px;font-size:.85rem;color:var(--muted)">${esc(co.description)}</div>` : ''}
      ${isUnprocessed ? `<div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn" style="padding:5px 14px;font-size:.78rem;background:rgba(29,187,135,.12);color:#1dbb87;border-color:rgba(29,187,135,.35)"
          onclick="approveCOFromGlobal('${co.jobId}','${co.id}',this)">✓ Approve</button>
        <button class="btn" style="padding:5px 14px;font-size:.78rem;background:rgba(239,83,80,.1);color:#ef5350;border-color:rgba(239,83,80,.3)"
          onclick="declineCOFromGlobal('${co.jobId}','${co.id}',this)">✕ Decline</button>
        <button class="btn" style="padding:5px 14px;font-size:.78rem"
          onclick="openJobDetail('${co.jobId}');switchDetailTab('changeorders',null)">View Job →</button>
      </div>` : ''}
    </div>`;
  }).join('');
}
window.loadGlobalChangeOrders = loadGlobalChangeOrders;

async function approveCOFromGlobal(jobId, coId, btn) {
  try {
    await coll('jobs').doc(jobId).collection('changeOrders').doc(coId).update({ status: 'Approved' });
    if (btn) btn.closest('[style]').style.borderColor = 'var(--line)';
    loadGlobalChangeOrders();
  } catch(e) { alert('Error: ' + e.message); }
}
window.approveCOFromGlobal = approveCOFromGlobal;

async function declineCOFromGlobal(jobId, coId, btn) {
  if (!confirm('Decline this change order?')) return;
  try {
    await coll('jobs').doc(jobId).collection('changeOrders').doc(coId).update({ status: 'Declined' });
    loadGlobalChangeOrders();
  } catch(e) { alert('Error: ' + e.message); }
}
window.declineCOFromGlobal = declineCOFromGlobal;

// ── Auto-create To-Do when a Change Order is added ──
// Called from saveChangeOrder after writing the CO to Firestore
async function autoCreateCOTodo(jobId, coId, coTitle, coAmount) {
  if (!conDb || !jobId || !currentCompanyId) return;
  const job = conJobs.find(j => j.id === jobId);

  // Find Team Lead assigned to this job
  const teamMembers = await fetchTeamMembersFlat(conDb, currentCompanyId);
  const teamLead = teamMembers.find(m => m.role === 'Team Lead' || m.role === 'Superintendent');
  const owner = teamMembers.find(m => m.role === 'Owner');

  const todoText = `Process Change Order: ${coTitle || 'Change Order'}${coAmount ? ' — $' + Number(coAmount).toLocaleString() : ''} on ${job?.name || 'job'}`;

  // Create To-Do assigned to Owner
  const todoData = {
    text: todoText,
    jobId,
    jobName: job?.name || '',
    priority: 'high',
    status: 'open',
    assignee: owner?.email || conCurrentUser?.email || '',
    assigneeName: owner?.name || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
    coId,
    category: 'Change Order',
  };

  await coll('todos').add(todoData).catch(() => {});

  // If team lead exists, create a second To-Do for them
  if (teamLead && teamLead.email !== owner?.email) {
    await coll('todos').add({
      ...todoData,
      assignee: teamLead.email,
      assigneeName: teamLead.name || '',
    }).catch(() => {});
  }

  // Refresh CO badge
  refreshNotificationBadges();
}
window.autoCreateCOTodo = autoCreateCOTodo;

// ── Refresh all notification badges ──
async function refreshNotificationBadges() {
  if (!conDb || !currentCompanyId || !conCurrentUser) return;
  const myEmail = (conCurrentUser.email || '').toLowerCase();

  // Notes badge — unread notes not by me
  try {
    const readRef = getReadStateRef('readNotes');
    const readSnap = readRef ? await readRef.get() : null;
    const readIds = new Set();
    if (readSnap) readSnap.forEach(d => readIds.add(d.id));

    let unreadNotes = 0;
    for (const job of conJobs.slice(0, 20)) {
      const snap = await coll('jobs').doc(job.id).collection('jobNotes').get().catch(() => null);
      if (snap) snap.forEach(d => {
        const n = d.data();
        if ((n.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(d.id)) unreadNotes++;
      });
    }
    setNavBadge('navNotesBadge', unreadNotes);
  } catch(e) {}

  // Messages badge
  try {
    const readRef = getReadStateRef('readMessages');
    const readSnap = readRef ? await readRef.get() : null;
    const readIds = new Set();
    if (readSnap) readSnap.forEach(d => readIds.add(d.id));

    let unreadMsgs = 0;
    for (const job of conJobs.slice(0, 20)) {
      const snap = await coll('jobs').doc(job.id).collection('messages').limit(50).get().catch(() => null);
      if (snap) snap.forEach(d => {
        const m = d.data();
        if ((m.authorEmail || '').toLowerCase() !== myEmail && !readIds.has(d.id)) unreadMsgs++;
      });
    }
    setNavBadge('navMessagesBadge', unreadMsgs);
  } catch(e) {}

  // Change Orders badge — count unprocessed
  try {
    let unprocessedCOs = 0;
    for (const job of conJobs.slice(0, 20)) {
      const snap = await coll('jobs').doc(job.id).collection('changeOrders').get().catch(() => null);
      if (snap) snap.forEach(d => {
        const co = d.data();
        if (!['approved','declined','rejected'].includes((co.status || '').toLowerCase())) unprocessedCOs++;
      });
    }
    setNavBadge('navCOBadge', unprocessedCOs);
  } catch(e) {}
}
window.refreshNotificationBadges = refreshNotificationBadges;

// ════════════════════════════════════════════════════
// ── JOB NOTES LOG ──
// Timestamped, authored notes on a job — separate from daily logs
// (which are crew field reports) and activity feed (which is automated).
// This is the PM paper trail: customer conversations, verbal instructions,
// accountability records, field observations, anything that needs a
// permanent dated record tied to this job.
// ════════════════════════════════════════════════════

function loadJobNotes(jobId) {
  if (!jobId || !conDb) return;
  const el = document.getElementById('jobNotesList');
  if (!el) return;
  el.innerHTML = '<div class="small muted" style="text-align:center;padding:20px">Loading notes…</div>';

  coll('jobs').doc(jobId).collection('jobNotes')
    .orderBy('createdAt', 'desc')
    .get()
    .then(snap => {
      if (snap.empty) {
        el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No notes yet.<br><br>Use notes to log customer conversations, verbal instructions, site observations — anything that needs a permanent dated record.</div>';
        return;
      }
      const notes = [];
      snap.forEach(d => notes.push({ id: d.id, ...d.data() }));
      renderJobNotes(notes);
    })
    .catch(() => {
      // Fall back without orderBy if index missing
      coll('jobs').doc(jobId).collection('jobNotes').get()
        .then(snap => {
          const notes = [];
          snap.forEach(d => notes.push({ id: d.id, ...d.data() }));
          notes.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
          renderJobNotes(notes);
        });
    });
}
window.loadJobNotes = loadJobNotes;

function renderJobNotes(notes) {
  const el = document.getElementById('jobNotesList');
  if (!el) return;
  if (!notes.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">No notes yet.</div>';
    return;
  }
  el.innerHTML = notes.map(n => {
    const ts = n.createdMs ? new Date(n.createdMs) : null;
    const dateStr = ts ? ts.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '';
    const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '';
    const author = n.authorName || n.authorEmail || 'Unknown';
    const isMe = n.authorEmail === conCurrentUser?.email;

    return `<div style="background:rgba(8,18,36,.6);border:1px solid var(--line);border-radius:12px;padding:16px;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${isMe ? 'rgba(217,119,6,.3)' : 'rgba(110,145,210,.2)'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;color:${isMe ? '#f59e0b' : '#94a3b8'}">${esc(author[0]?.toUpperCase()||'?')}</div>
          <div>
            <div style="font-weight:700;color:#eaf0fb;font-size:.88rem">${esc(author)}</div>
            <div style="font-size:.72rem;color:var(--muted)">${dateStr} · ${timeStr}</div>
          </div>
        </div>
        ${(conUserRole === 'Owner' || window._hasFullAccess) ? `<button onclick="deleteJobNote('${n.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:4px" title="Delete note">✕</button>` : ''}
      </div>
      <div style="font-size:.9rem;color:#eaf0fb;line-height:1.6;white-space:pre-wrap;word-break:break-word">${esc(n.text || '')}</div>
      ${n.category ? `<div style="margin-top:8px"><span style="background:rgba(217,119,6,.15);color:#f59e0b;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:700">${esc(n.category)}</span></div>` : ''}
    </div>`;
  }).join('');
}

function openAddJobNote() {
  const existing = document.getElementById('addJobNoteModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'addJobNoteModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#0d1f35;border:1px solid var(--line);border-radius:16px;padding:28px;max-width:520px;width:100%">
      <div style="font-size:1.1rem;font-weight:800;color:#eaf0fb;margin-bottom:4px">📋 Add Note</div>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:16px">Timestamped and attributed to you. Cannot be edited after saving.</div>

      <div style="margin-bottom:12px">
        <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;display:block;margin-bottom:6px">Category (optional)</label>
        <select id="jobNoteCategory" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:rgba(8,18,36,.6);color:#eaf0fb;font-size:.88rem">
          <option value="">— General Note —</option>
          <option value="Customer Call">📞 Customer Call</option>
          <option value="Customer Request">🔄 Customer Request</option>
          <option value="Crew Instruction">👷 Crew Instruction</option>
          <option value="Site Observation">🔍 Site Observation</option>
          <option value="Change Order Note">📋 Change Order Note</option>
          <option value="Issue / Concern">⚠️ Issue / Concern</option>
          <option value="Material Note">📦 Material Note</option>
          <option value="Vendor / Sub Note">🤝 Vendor / Sub Note</option>
        </select>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;display:block;margin-bottom:6px">Note *</label>
        <textarea id="jobNoteText" rows="6" placeholder="Document what happened, what was said, who was involved, and any relevant details..."
          style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:rgba(8,18,36,.6);color:#eaf0fb;font-size:.88rem;box-sizing:border-box;resize:vertical;line-height:1.55"></textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn" onclick="document.getElementById('addJobNoteModal').remove()">Cancel</button>
        <button class="btn-amber" onclick="saveJobNote()" style="padding:10px 24px;font-weight:700">Save Note</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('jobNoteText')?.focus(), 100);
}
window.openAddJobNote = openAddJobNote;

async function saveJobNote() {
  const text = document.getElementById('jobNoteText')?.value.trim();
  const category = document.getElementById('jobNoteCategory')?.value || '';
  if (!text) { alert('Please enter a note.'); return; }
  if (!conCurrentJobId || !conDb) return;

  const now = Date.now();
  try {
    await coll('jobs').doc(conCurrentJobId).collection('jobNotes').add({
      text,
      category,
      authorEmail: conCurrentUser?.email || '',
      authorName: conCurrentUser?.displayName || conCurrentUser?.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdMs: now,
    });
    document.getElementById('addJobNoteModal')?.remove();
    loadJobNotes(conCurrentJobId);
  } catch(e) {
    alert('Error saving note: ' + e.message);
  }
}
window.saveJobNote = saveJobNote;

async function deleteJobNote(noteId) {
  if (!confirm('Delete this note permanently? This cannot be undone.')) return;
  try {
    await coll('jobs').doc(conCurrentJobId).collection('jobNotes').doc(noteId).delete();
    loadJobNotes(conCurrentJobId);
  } catch(e) {
    alert('Error deleting note: ' + e.message);
  }
}
window.deleteJobNote = deleteJobNote;
window.renderJobMap = renderJobMap;
window.loadTeamCache = loadTeamCache;
window.getTeamMemberOpts = getTeamMemberOpts;
window.getTeamMemberOptsEmail = getTeamMemberOptsEmail;
window.renderJobTodos = renderJobTodos;
window.addJobTodo = addJobTodo;
window.loadSelections = loadSelections;
window.openAddSelection = openAddSelection;
window.deleteSelection = deleteSelection;
window.loadSpecifications = loadSpecifications;
window.loadPlans = loadPlans;
window.handlePlanUpload = handlePlanUpload;
window.loadJobMessages = loadJobMessages;
window.sendJobMessage = sendJobMessage;
window.renderJobReports = renderJobReports;
window.handleImportFiles = handleImportFiles;
window.commitImport = commitImport;
window.syncJobEstimateCost = syncJobEstimateCost;
window.syncCurrentJobEstimateCost = syncCurrentJobEstimateCost;
window.refreshJobFinancials = refreshJobFinancials;
window.finhubToggle = finhubToggle;
window.renderFinancialsHub = renderFinancialsHub;
window.openVendorFromBill = openVendorFromBill;

// ════════════════════════════════════════════════════
// ── PHASE 2: LINE ITEM ESTIMATING ──
// ════════════════════════════════════════════════════

function conLoadEstimate(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('estimate')
    .orderBy('category').onSnapshot(snap => {
      conEstItems = [];
      snap.forEach(doc => conEstItems.push({ id: doc.id, ...doc.data() }));
      renderEstimateList();
    });
}

function renderEstimateList() {
  const tbody = document.getElementById('estimateBody');
  const tfoot = document.getElementById('estimateFoot');
  const sumEl = document.getElementById('estSummaryLine');
  const catFilter = document.getElementById('estCategoryFilter');
  if (!tbody) return;

  // Populate category filter
  const cats = [...new Set(conEstItems.map(i => i.category))].sort();
  if (catFilter) {
    const cur = catFilter.value;
    catFilter.innerHTML = '<option value="">All Categories</option>' +
      cats.map(c => `<option value="${esc(c)}" ${c===cur?'selected':''}>${esc(c)}</option>`).join('');
  }

  const filterCat = catFilter ? catFilter.value : '';
  const items = filterCat ? conEstItems.filter(i => i.category === filterCat) : conEstItems;

  // Group by category
  const grouped = {};
  items.forEach(i => { if (!grouped[i.category]) grouped[i.category] = []; grouped[i.category].push(i); });

  let html = '';
  let grandTotal = 0;
  Object.keys(grouped).sort().forEach(cat => {
    let catTotal = 0;
    html += `<tr><td colspan="8" class="est-cat-header">${esc(cat)}</td></tr>`;
    grouped[cat].forEach(item => {
      const qty = Number(item.qty || 1);
      const uc = Number(item.unitCost || 0);
      const markup = Number(item.markup || 0);
      const lineTotal = qty * uc * (1 + markup / 100);
      catTotal += lineTotal;
      grandTotal += lineTotal;
      html += `<tr>
        <td></td>
        <td>${esc(item.desc || '')}</td>
        <td style="text-align:right">${qty}</td>
        <td style="color:var(--muted)">${esc(item.unit || 'ea')}</td>
        <td style="text-align:right">$${Number(item.unitCost||0).toFixed(2)}</td>
        <td style="text-align:right">${markup > 0 ? `<span class="markup-badge">+${markup}%</span>` : '—'}</td>
        <td style="text-align:right;font-weight:700;color:var(--amber)">$${lineTotal.toFixed(2)}</td>
        <td><button class="btn" style="padding:3px 8px;font-size:.72rem" onclick="openEditEstItem('${item.id}')">Edit</button></td>
      </tr>`;
    });
    html += `<tr><td></td><td colspan="5" style="text-align:right;font-size:.8rem;color:var(--muted)">Subtotal</td><td style="text-align:right;font-weight:700;color:var(--amber)">$${catTotal.toFixed(2)}</td><td></td></tr>`;
  });

  tbody.innerHTML = html || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">No line items yet. Add your first item above.</td></tr>`;

  // Grand total row
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const contract = job ? getJobValue(job) : 0;
  const margin = contract > 0 ? ((contract - grandTotal) / contract * 100).toFixed(1) : '—';
  if (tfoot) {
    tfoot.innerHTML = `
      <tr class="est-total-row">
        <td colspan="6" style="text-align:right;font-size:.96rem;font-weight:800">ESTIMATE TOTAL</td>
        <td style="text-align:right;font-size:1.1rem">$${grandTotal.toFixed(2)}</td>
        <td></td>
      </tr>
      ${contract > 0 ? `<tr><td colspan="6" style="text-align:right;font-size:.8rem;color:var(--muted)">Contract Value</td><td style="text-align:right;font-weight:700;color:#a3f2d2">$${contract.toLocaleString()}</td><td></td></tr>
      <tr><td colspan="6" style="text-align:right;font-size:.8rem;color:var(--muted)">Projected Gross Margin</td><td style="text-align:right;font-weight:700;color:${parseFloat(margin)>=15?'#a3f2d2':parseFloat(margin)>=0?'#f3b33d':'#ef5350'}">${margin}%</td><td></td></tr>` : ''}
    `;
  }
  if (sumEl) sumEl.textContent = `${conEstItems.length} line item${conEstItems.length!==1?'s':''} · Total: $${grandTotal.toFixed(2)}`;
}

function calcEstItemTotal() {
  const qty = parseFloat(document.getElementById('estItemQty').value) || 0;
  const uc = parseFloat(document.getElementById('estItemUnitCost').value) || 0;
  const markup = parseFloat(document.getElementById('estItemMarkup').value) || 0;
  const total = qty * uc * (1 + markup / 100);
  const el = document.getElementById('estItemTotal');
  if (el) el.textContent = '$' + total.toFixed(2);
}

function openEditEstItem(id) {
  const item = conEstItems.find(i => i.id === id);
  if (!item) return;
  conEditingEstItemId = id;
  document.getElementById('estItemModalTitle').textContent = 'Edit Line Item';
  document.getElementById('estItemId').value = id;
  document.getElementById('estItemCategory').value = item.category || 'Labor';
  document.getElementById('estItemDesc').value = item.desc || '';
  document.getElementById('estItemQty').value = item.qty || 1;
  document.getElementById('estItemUnit').value = item.unit || 'ea';
  document.getElementById('estItemUnitCost').value = item.unitCost || '';
  document.getElementById('estItemMarkup').value = item.markup || 0;
  document.getElementById('estItemNotes').value = item.notes || '';
  document.getElementById('deleteEstItemBtn').style.display = 'inline-flex';
  calcEstItemTotal();
  kOpen('addEstItemModal');
}

// ════════════════════════════════════════════════════
// ── PHASE 2: CHANGE ORDERS ──
// ════════════════════════════════════════════════════
let conCOs = [];
let conEditingCOId = null;

function conLoadCOs(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('changeorders')
    .orderBy('date', 'desc').onSnapshot(snap => {
      conCOs = [];
      snap.forEach(doc => conCOs.push({ id: doc.id, ...doc.data() }));
      renderCOList();
    });
}

const CO_STATUS_COLORS = {
  'Submitted': 'co-pending',
  'Priced': 'co-pending',
  'Customer Approved': 'co-approved',
  'Customer Declined': 'co-rejected',
  'Invoiced': 'co-approved',
  'Paid': 'co-approved',
  'Void': 'co-void',
  // legacy values from before the pipeline existed
  'Pending': 'co-pending',
  'Approved': 'co-approved',
  'Rejected': 'co-rejected'
};

// Maps old flat statuses (from before this pipeline existed) onto the new
// lifecycle so existing Change Order records still display sensibly.
function normalizeCOStatus(s) {
  const map = { Pending: 'Submitted', Approved: 'Customer Approved', Rejected: 'Customer Declined' };
  return map[s] || s || 'Submitted';
}

function renderCOList() {
  const el = document.getElementById('coList');
  const sumEl = document.getElementById('coSummaryLine');
  if (!el) return;
  if (!conCOs.length) { el.innerHTML = '<p class="muted">No change orders yet.</p>'; if(sumEl)sumEl.textContent=''; return; }

  const approvedTotal = conCOs.filter(c => ['Customer Approved','Invoiced','Paid'].includes(normalizeCOStatus(c.status))).reduce((s, c) => s + Number(c.amount || 0), 0);
  const pendingTotal = conCOs.filter(c => ['Submitted','Priced'].includes(normalizeCOStatus(c.status))).reduce((s, c) => s + Number(c.amount || 0), 0);
  if (sumEl) sumEl.textContent = `${conCOs.length} CO${conCOs.length!==1?'s':''} · Approved: $${approvedTotal.toLocaleString()} · Pending: $${pendingTotal.toLocaleString()}`;

  const canPrice = isOwnerOrAdmin();

  el.innerHTML = conCOs.map(co => {
    const status = normalizeCOStatus(co.status);
    const badgeClass = CO_STATUS_COLORS[status] || 'co-pending';
    const amt = Number(co.amount || 0);

    // Contextual action buttons — what happens next depends on where this CO
    // currently sits in the real-world workflow.
    let actions = `<button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="openEditCO('${co.id}')">Edit</button>`;
    if (status === 'Submitted' && canPrice) {
      actions += `<button class="btn btn-amber" style="padding:4px 10px;font-size:.76rem" onclick="openEditCO('${co.id}')">💲 Price This CO</button>`;
    }
    if (status === 'Priced') {
      actions += `<button class="btn btn-green" style="padding:4px 10px;font-size:.76rem" onclick="markCOCustomerApproved('${co.id}')">✅ Customer Approved</button>`;
      actions += `<button class="btn btn-danger" style="padding:4px 10px;font-size:.76rem" onclick="markCODeclined('${co.id}')">❌ Customer Declined</button>`;
    }
    if (status === 'Customer Approved' && canPrice) {
      actions += `<button class="btn btn-amber" style="padding:4px 10px;font-size:.76rem" onclick="createInvoiceFromCO('${co.id}')">🧾 Create Invoice</button>`;
    }
    if (status === 'Invoiced') {
      actions += `<span class="small muted" style="align-self:center">Waiting on payment — mark the linked invoice Paid to apply this to the job.</span>`;
    }
    if (status === 'Paid') {
      actions += `<span class="small" style="align-self:center;color:#1dbb87;font-weight:700">✓ Applied to estimate &amp; punch list</span>`;
    }

    return `<div class="co-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;margin-bottom:4px">${esc(co.title || 'Untitled CO')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span class="co-badge ${badgeClass}">${esc(status)}</span>
            <span class="small muted">${co.date || ''}</span>
            ${co.days ? `<span class="small muted">+${co.days} day${co.days!=1?'s':''}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:800;color:${amt>=0?'var(--amber)':'#ef5350'}">${amt>=0?'+':''}$${Math.abs(amt).toLocaleString()}</div>
        </div>
      </div>
      ${co.reason ? `<div style="font-size:.84rem;color:var(--muted);margin-bottom:8px">${esc(co.reason)}</div>` : ''}
      <div class="small muted" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        ${co.submittedBy ? `<span>Submitted: ${esc(co.submittedBy)}</span>` : ''}
        ${co.pricedBy ? `<span>Priced: ${esc(co.pricedBy)}</span>` : ''}
        ${co.customerDecisionBy ? `<span>Customer answer relayed by: ${esc(co.customerDecisionBy)}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${actions}</div>
    </div>`;
  }).join('');
}

let _coLineItems = [];

function renderCOLineItems() {
  const container = document.getElementById('coLineItemsContainer');
  if (!container) return;
  const canPrice = isOwnerOrAdmin();

  if (!_coLineItems.length) {
    container.innerHTML = '<div class="small muted" style="padding:10px 0;font-style:italic">No line items yet.</div>';
  } else {
    container.innerHTML = _coLineItems.map((item, i) => `
      <div style="display:grid;grid-template-columns:2fr 55px 60px 90px 80px 80px 22px;gap:6px;align-items:center;margin-bottom:6px">
        <input value="${esc(item.desc||'')}" placeholder="Description" style="font-size:.8rem;padding:6px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb"
          onchange="_coLineItems[${i}].desc=this.value" />
        <input type="number" value="${item.qty||1}" min="0" step="any" style="font-size:.8rem;padding:6px;text-align:right;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb"
          onchange="_coLineItems[${i}].qty=parseFloat(this.value)||1;calcCOTotal()" />
        <input value="${esc(item.unit||'ea')}" placeholder="unit" style="font-size:.8rem;padding:6px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb"
          onchange="_coLineItems[${i}].unit=this.value" />
        <input value="${esc(item.costType||'Materials')}" placeholder="type" style="font-size:.8rem;padding:6px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb"
          onchange="_coLineItems[${i}].costType=this.value" />
        <input type="number" value="${item.unitCost||0}" min="0" step="0.01" style="font-size:.8rem;padding:6px;text-align:right;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb" ${canPrice?'':'disabled title="Owner/PM only"'}
          onchange="_coLineItems[${i}].unitCost=parseFloat(this.value)||0;calcCOTotal()" />
        <input type="number" value="${item.unitPrice||0}" min="0" step="0.01" style="font-size:.8rem;padding:6px;text-align:right;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb" ${canPrice?'':'disabled title="Owner/PM only"'}
          onchange="_coLineItems[${i}].unitPrice=parseFloat(this.value)||0;calcCOTotal()" />
        <button onclick="_coLineItems.splice(${i},1);renderCOLineItems();calcCOTotal()" style="background:none;border:none;color:#ef5350;cursor:pointer;font-size:1rem;padding:0">✕</button>
      </div>`).join('');
  }
  const lockNote = document.getElementById('coPricingLockedNote');
  if (lockNote) lockNote.style.display = canPrice ? 'none' : 'block';
  const addBtn = document.getElementById('coAddLineBtn');
  if (addBtn) addBtn.style.display = 'inline-flex';
}

function addCOLineItem() {
  _coLineItems.push({ desc: '', qty: 1, unit: 'ea', costType: 'Materials', unitCost: 0, unitPrice: 0 });
  renderCOLineItems();
  calcCOTotal();
}
window.addCOLineItem = addCOLineItem;

function calcCOTotal() {
  const total = _coLineItems.reduce((s, i) => s + (i.qty||1) * (i.unitPrice||0), 0);
  const el = document.getElementById('coTotalDisplay');
  if (el) el.textContent = 'Total: $' + total.toFixed(2);
  return total;
}
window.calcCOTotal = calcCOTotal;

function onCOStatusManualChange() { /* reserved for future validation */ }
window.onCOStatusManualChange = onCOStatusManualChange;

function _applyCOModalPermissionLock(lockToStatus) {
  const statusSel = document.getElementById('coStatus');
  if (!statusSel) return;
  const canPrice = isOwnerOrAdmin();
  Array.from(statusSel.options).forEach(o => {
    o.disabled = !canPrice && o.value !== lockToStatus;
  });
}

function openAddCOModal() {
  conEditingCOId = null;
  document.getElementById('coModalTitle').textContent = 'New Change Order';
  document.getElementById('coId').value = '';
  document.getElementById('coTitle').value = '';
  document.getElementById('coDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('coStatus').value = 'Submitted';
  document.getElementById('coDays').value = '';
  document.getElementById('coReason').value = '';
  document.getElementById('coSubmittedBy').value = conCurrentUser ? (conCurrentUser.displayName || conCurrentUser.email) : '';
  document.getElementById('coPricedBy').value = '';
  document.getElementById('coCustomerDecisionBy').value = '';
  document.getElementById('deleteCOBtn').style.display = 'none';
  _coLineItems = [];
  renderCOLineItems();
  calcCOTotal();
  _applyCOModalPermissionLock('Submitted');
  kOpen('addCOModal');
}

function openEditCO(id) {
  const co = conCOs.find(c => c.id === id);
  if (!co) return;
  conEditingCOId = id;
  const status = normalizeCOStatus(co.status);
  document.getElementById('coModalTitle').textContent = 'Edit Change Order';
  document.getElementById('coId').value = id;
  document.getElementById('coTitle').value = co.title || '';
  document.getElementById('coDate').value = co.date || '';
  document.getElementById('coStatus').value = status;
  document.getElementById('coDays').value = co.days || '';
  document.getElementById('coReason').value = co.reason || '';
  document.getElementById('coSubmittedBy').value = co.submittedBy || '';
  document.getElementById('coPricedBy').value = co.pricedBy || '';
  document.getElementById('coCustomerDecisionBy').value = co.customerDecisionBy || '';
  document.getElementById('deleteCOBtn').style.display = 'inline-flex';
  _coLineItems = co.lineItems ? JSON.parse(JSON.stringify(co.lineItems)) : [];
  renderCOLineItems();
  calcCOTotal();
  _applyCOModalPermissionLock(status);
  kOpen('addCOModal');
}

function saveCO() {
  if (!conCurrentJobId || !conDb) return;
  const title = document.getElementById('coTitle').value.trim();
  if (!title) { alert('Title is required.'); return; }

  const canPrice = isOwnerOrAdmin();
  const total = calcCOTotal();
  let status = document.getElementById('coStatus').value;
  // Non-owners can only ever submit — even if the select was somehow changed client-side.
  if (!canPrice) status = 'Submitted';
  // If line items now have real pricing and status is still Submitted, auto-advance to Priced.
  if (canPrice && status === 'Submitted' && total > 0) status = 'Priced';

  const data = {
    title,
    date: document.getElementById('coDate').value,
    status,
    lineItems: _coLineItems,
    amount: total,
    days: parseInt(document.getElementById('coDays').value) || 0,
    reason: document.getElementById('coReason').value.trim(),
    submittedBy: document.getElementById('coSubmittedBy').value.trim(),
    customerDecisionBy: document.getElementById('coCustomerDecisionBy').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
  };
  if (canPrice) data.pricedBy = document.getElementById('coPricedBy').value.trim();

  const col = coll('jobs').doc(conCurrentJobId).collection('changeorders');
  if (conEditingCOId) {
    col.doc(conEditingCOId).update(data)
      .then(() => { kClose('addCOModal'); switchDetailTab('changeorders', null); })
      .catch(e => alert('Error: ' + e.message));
  } else {
    data.coNumber = 'CO-' + String(conCOs.length + 1).padStart(3, '0');
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = conCurrentUser ? conCurrentUser.email : 'unknown';
    col.add({...data, companyId: currentCompanyId})
      .then(ref => {
        kClose('addCOModal');
        switchDetailTab('changeorders', null);
        // Auto-create To-Do for Owner and Team Lead, refresh CO badge
        autoCreateCOTodo(conCurrentJobId, ref.id, title, total);
        refreshNotificationBadges();
      })
      .catch(e => alert('Error: ' + e.message));
  }
}

function deleteCO() {
  if (!conEditingCOId || !confirm('Delete this change order?')) return;
  coll('jobs').doc(conCurrentJobId).collection('changeorders').doc(conEditingCOId).delete()
    .then(() => kClose('addCOModal'))
    .catch(e => alert('Error: ' + e.message));
}

// Team lead or owner relays the customer's verbal decision on a priced CO.
function markCOCustomerApproved(id) {
  if (!confirm('Confirm: the customer said YES to this change order price?')) return;
  coll('jobs').doc(conCurrentJobId).collection('changeorders').doc(id).update({
    status: 'Customer Approved',
    customerDecisionBy: conCurrentUser ? (conCurrentUser.displayName || conCurrentUser.email) : 'Unknown',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => alert('Error: ' + e.message));
}
window.markCOCustomerApproved = markCOCustomerApproved;

function markCODeclined(id) {
  if (!confirm('Confirm: the customer said NO to this change order?')) return;
  coll('jobs').doc(conCurrentJobId).collection('changeorders').doc(id).update({
    status: 'Customer Declined',
    customerDecisionBy: conCurrentUser ? (conCurrentUser.displayName || conCurrentUser.email) : 'Unknown',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => alert('Error: ' + e.message));
}
window.markCODeclined = markCODeclined;

// Owner/PM turns an approved Change Order directly into an invoice, so the
// price never has to be manually retyped.
function createInvoiceFromCO(coId) {
  if (!isOwnerOrAdmin()) { alert('Only Owner/PM can create invoices.'); return; }
  const co = conCOs.find(c => c.id === coId);
  if (!co) return;

  openAddInvoiceModal(conCurrentJobId);
  document.getElementById('invType').value = 'Change Order';
  document.getElementById('invNotes').value = 'Change Order: ' + (co.title || '') + (co.reason ? ' — ' + co.reason : '');

  if (co.lineItems && co.lineItems.length) {
    _invLineItems = co.lineItems.map(li => ({ desc: li.desc, qty: li.qty||1, rate: li.unitPrice||0 }));
  } else {
    _invLineItems = [{ desc: 'Change Order: ' + (co.title || ''), qty: 1, rate: co.amount || 0 }];
  }
  renderInvLineItems();
  calcInvTotals();

  window._pendingCOIdForInvoice = coId;
}
window.createInvoiceFromCO = createInvoiceFromCO;
window.quickApproveCO = markCOCustomerApproved; // legacy alias, in case anything still calls the old name

// ════════════════════════════════════════════════════
// ── PHASE 2: SUBS & VENDORS ──
// ════════════════════════════════════════════════════
let conSubs = [];
let conEditingSubId = null;

function conLoadSubs(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('subs')
    .orderBy('trade').onSnapshot(snap => {
      conSubs = [];
      snap.forEach(doc => conSubs.push({ id: doc.id, ...doc.data() }));
      renderSubList();
    });
}

function renderSubList() {
  const el = document.getElementById('subList');
  if (!el) return;
  if (!conSubs.length) { el.innerHTML = '<p class="muted">No subs or vendors added yet.</p>'; return; }

  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = conSubs.map(s => {
    const insExp = s.insExp || '';
    const insExpired = insExp && insExp < today;
    const insWarn = insExp && !insExpired && insExp < addDays(today, 30);
    const statusColors = { Bidding:'#f3b33d', Contracted:'#4d8dff', Scheduled:'#a855f7', 'On Site':'var(--amber)', Complete:'#1dbb87' };
    const col = statusColors[s.status] || 'var(--muted)';
    return `<div class="sub-card">
      <div class="sub-avatar">${s.trade ? s.trade[0] : '👷'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
          <span style="font-weight:700">${esc(s.name)}</span>
          <span style="font-size:.72rem;background:${col}22;color:${col};border:1px solid ${col}44;border-radius:999px;padding:2px 8px">${s.status || 'Bidding'}</span>
        </div>
        <div class="small muted">${esc(s.trade || '')}${s.contact ? ' · ' + esc(s.contact) : ''}${s.phone ? ' · ' + esc(s.phone) : ''}</div>
        ${s.amount ? `<div class="small" style="color:#a3f2d2;margin-top:2px">Contract: $${Number(s.amount).toLocaleString()}</div>` : ''}
        ${insExp ? `<div class="small" style="color:${insExpired?'#ef5350':insWarn?'#f3b33d':'var(--muted)'};margin-top:2px">${insExpired?'⚠️ INS EXPIRED':'🛡 Ins exp:'} ${insExp}</div>` : ''}
        ${s.notes ? `<div class="small muted" style="margin-top:2px">${esc(s.notes)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="openEditSub('${s.id}')">Edit</button>
        ${s.phone ? `<a href="tel:${esc(s.phone)}" class="btn" style="padding:4px 10px;font-size:.76rem;text-decoration:none;text-align:center">📞 Call</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openAddSubModal() {
  conEditingSubId = null;
  document.getElementById('subModalTitle').textContent = 'Add Sub / Vendor';
  document.getElementById('subId').value = '';
  ['subName','subContact','subPhone','subEmail','subNotes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('subTrade').value = 'General Labor';
  document.getElementById('subStatus').value = 'Bidding';
  document.getElementById('subAmount').value = '';
  document.getElementById('subInsExp').value = '';
  document.getElementById('deleteSubBtn').style.display = 'none';
  kOpen('addSubModal');
}

function openEditSub(id) {
  const s = conSubs.find(x => x.id === id);
  if (!s) return;
  conEditingSubId = id;
  document.getElementById('subModalTitle').textContent = 'Edit Sub / Vendor';
  document.getElementById('subId').value = id;
  document.getElementById('subName').value = s.name || '';
  document.getElementById('subTrade').value = s.trade || 'General Labor';
  document.getElementById('subStatus').value = s.status || 'Bidding';
  document.getElementById('subContact').value = s.contact || '';
  document.getElementById('subPhone').value = s.phone || '';
  document.getElementById('subEmail').value = s.email || '';
  document.getElementById('subAmount').value = s.amount || '';
  document.getElementById('subInsExp').value = s.insExp || '';
  document.getElementById('subNotes').value = s.notes || '';
  document.getElementById('deleteSubBtn').style.display = 'inline-flex';
  kOpen('addSubModal');
}

function saveSub() {
  if (!conCurrentJobId || !conDb) return;
  const name = document.getElementById('subName').value.trim();
  if (!name) { alert('Company / Name is required.'); return; }
  const data = {
    name,
    trade: document.getElementById('subTrade').value,
    status: document.getElementById('subStatus').value,
    contact: document.getElementById('subContact').value.trim(),
    phone: document.getElementById('subPhone').value.trim(),
    email: document.getElementById('subEmail').value.trim(),
    amount: parseFloat(document.getElementById('subAmount').value) || 0,
    insExp: document.getElementById('subInsExp').value,
    notes: document.getElementById('subNotes').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const col = coll('jobs').doc(conCurrentJobId).collection('subs');
  if (conEditingSubId) {
    col.doc(conEditingSubId).update(data)
      .then(() => { kClose('addSubModal'); switchDetailTab('subs', null); })
      .catch(e => alert('Error: ' + e.message));
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    col.add({...data, companyId: currentCompanyId})
      .then(() => { kClose('addSubModal'); switchDetailTab('subs', null); })
      .catch(e => alert('Error: ' + e.message));
  }
}

function deleteSub() {
  if (!conEditingSubId || !confirm('Delete this sub/vendor?')) return;
  coll('jobs').doc(conCurrentJobId).collection('subs').doc(conEditingSubId).delete()
    .then(() => kClose('addSubModal'))
    .catch(e => alert('Error: ' + e.message));
}

// ════════════════════════════════════════════════════
// ── PHASE 2: PHOTO UPLOADS FOR DAILY LOGS ──
// ════════════════════════════════════════════════════
let _logPhotoPending = []; // {dataUrl, name}[]

function handleLogPhotoUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  // Compress each photo client-side before staging it — avoids the
  // silent-skip that happened when real iPhone photos exceeded Firestore's
  // limit mid-upload. Target 1200px wide at 75% quality (~100-200KB result).
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      compressImage(e.target.result, 1200, 0.75)
        .then(compressed => {
          _logPhotoPending.push({ dataUrl: compressed, name: file.name });
          renderLogPhotoGrid();
        })
        .catch(() => {
          // Compression failed — fall back to original (rare edge case)
          _logPhotoPending.push({ dataUrl: e.target.result, name: file.name });
          renderLogPhotoGrid();
        });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderLogPhotoGrid() {
  const grid = document.getElementById('logPhotoGrid');
  if (!grid) return;
  // Build preview thumbnails for pending photos
  let html = _logPhotoPending.map((p, i) => `
    <div style="position:relative">
      <img src="${p.dataUrl}" class="photo-thumb" onclick="openLightbox('${p.dataUrl}')" />
      <button onclick="removeLogPhoto(${i})" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.7);border:none;border-radius:50%;width:20px;height:20px;color:#fff;font-size:.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
    </div>
  `).join('');
  html += `<label class="photo-upload-btn" style="min-height:80px">
    <span style="font-size:1.5rem">📷</span>
    <span>Add Photo</span>
    <input type="file" accept="image/*" multiple style="display:none" onchange="handleLogPhotoUpload(this)" />
  </label>`;
  grid.innerHTML = html;
}

function removeLogPhoto(idx) {
  _logPhotoPending.splice(idx, 1);
  renderLogPhotoGrid();
}

// Store photos as base64 in Firestore (small photos) or show warning for large
async function uploadLogPhotos() {
  if (!_logPhotoPending.length) return [];
  // Compress to max ~200KB each before storing in Firestore
  const results = [];
  for (const p of _logPhotoPending) {
    try {
      const compressed = await compressImage(p.dataUrl, 800, 0.7);
      results.push({ dataUrl: compressed, name: p.name, uploadedAt: new Date().toISOString() });
    } catch(e) {
      results.push({ dataUrl: p.dataUrl, name: p.name, uploadedAt: new Date().toISOString() });
    }
  }
  return results;
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Render photos in a log entry
function renderLogPhotos(photos) {
  if (!photos || !photos.length) return '';
  return `<div class="photo-grid" style="margin-top:8px">
    ${photos.map(p => `<img src="${p.dataUrl}" class="photo-thumb" onclick="openLightbox('${p.dataUrl.replace(/'/g,"\\'")}') " />`).join('')}
  </div>`;
}

function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('photoLightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('photoLightbox').classList.remove('open');
  document.getElementById('lightboxImg').src = '';
}

// ── Patch saveLog to include photos ──
const _origSaveLog = window.saveLog;
window.saveLog = async function() {
  if (!conCurrentJobId || !conDb) return;
  const date = document.getElementById('logDate').value;
  if (!date) { alert('Date is required.'); return; }

  // Upload photos first
  let photos = [];
  if (_logPhotoPending.length > 0) {
    try { photos = await uploadLogPhotos(); }
    catch(e) { console.warn('Photo upload error:', e); }
  }

  const data = {
    date,
    weather: document.getElementById('logWeather').value,
    crew: document.getElementById('logCrew').value.trim(),
    notes: document.getElementById('logNotes').value.trim(),
    issues: document.getElementById('logIssues').value.trim(),
    photos,
    createdBy: conCurrentUser ? conCurrentUser.email : 'unknown',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  coll('jobs').doc(conCurrentJobId).collection('logs').add(subDoc(data))
    .then(() => {
      _logPhotoPending = [];
      kClose('addLogModal');
      switchDetailTab('logs', null);
    })
    .catch(e => alert('Error: ' + e.message));
};

// ── Patch openAddLogModal to clear photos ──
const _origOpenAddLogModal = window.openAddLogModal;
window.openAddLogModal = function() {
  _logPhotoPending = [];
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('logWeather').selectedIndex = 0;
  document.getElementById('logCrew').value = '';
  document.getElementById('logNotes').value = '';
  document.getElementById('logIssues').value = '';
  renderLogPhotoGrid();
  kOpen('addLogModal');
};

// ── Patch renderLogList to show photos ──
const _origRenderLogList = renderLogList;
function renderLogList() {
  const el = document.getElementById('logList');
  if (!el) return;
  if (!conLogs.length) { el.innerHTML = '<p class="muted">No daily logs yet.</p>'; return; }
  el.innerHTML = conLogs.map(l => `
    <div class="log-entry">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="log-date">${l.date}</span>
        <span class="log-weather">${l.weather || ''}</span>
        <button class="btn btn-danger" style="padding:2px 8px;font-size:.75rem" onclick="deleteLog('${l.id}')">✕</button>
      </div>
      ${l.crew ? `<div class="small muted" style="margin-bottom:4px">👷 ${esc(l.crew)}</div>` : ''}
      <div style="font-size:.88rem;margin-bottom:4px">${esc(l.notes || '')}</div>
      ${l.issues ? `<div style="font-size:.82rem;color:#ef5350">⚠️ ${esc(l.issues)}</div>` : ''}
      ${renderLogPhotos(l.photos)}
      <div class="small muted" style="margin-top:6px">${l.createdBy ? 'Logged by: ' + esc(l.createdBy) : ''}</div>
    </div>
  `).join('');
}

// ── Patch openJobDetail to load Phase 2 subcollections ──
const _origOpenJobDetail = window.openJobDetail;
window.openJobDetail = function(jobId) {
  _origOpenJobDetail(jobId);
  conLoadEstimate(jobId);
  conLoadCOs(jobId);
  conLoadSubs(jobId);
};

// ── Extend switchDetailTab to handle new tabs ──
// switchDetailTab defined above


// ── Expose Phase 2 functions to window ──
window.openAddEstItemModal = openAddEstItemModal;
window.populateEstSubgroupDropdown = populateEstSubgroupDropdown;
window.onEstGroupChange = onEstGroupChange;
window.onEstSubgroupChange = onEstSubgroupChange;
window.openEditEstItem = openEditEstItem;
window.saveEstItem = saveEstItem;
window.deleteEstItem = deleteEstItem;
window.calcEstItemTotal = calcEstItemTotal;
window.renderEstimateList = renderEstimateList;
window.openAddCOModal = openAddCOModal;
window.openEditCO = openEditCO;
window.saveCO = saveCO;
window.deleteCO = deleteCO;
window.openAddSubModal = openAddSubModal;
window.openEditSub = openEditSub;
window.saveSub = saveSub;
window.deleteSub = deleteSub;
window.handleLogPhotoUpload = handleLogPhotoUpload;
window.removeLogPhoto = removeLogPhoto;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;


// Auto-load Firebase immediately on page open
conLoadFirebase();

// Patch conInitFirebase to use ktRevealSignIn and new auth wall IDs
const _origConInitFirebase = conInitFirebase;
function conInitFirebase() {
  try {
    if (!firebase.apps.length) {
      conApp = firebase.initializeApp(CON_FIREBASE_CONFIG);
    } else {
      conApp = firebase.apps[0];
    }
    conDb = firebase.firestore();
    conAuth = firebase.auth();
    conFunctions = firebase.functions();
    conFirebaseReady = true;

    // Never show the sign-in wall until Firebase explicitly fires
    // onAuthStateChanged with null — meaning no active session.
    // Firebase always fires once on init. Removing the timer means
    // the loading spinner shows until the answer arrives, no flash.
    conAuth.onAuthStateChanged(user => {
      if (user) {
        conCurrentUser = user;

        // ── Domain/member pre-check ──────────────────────────────────
        // Block uninvited off-domain accounts HERE, before syncMyClaims
        // or resolveCompany ever run. Approved domains proceed immediately.
        // Off-domain accounts get a memberEmails check first so an
        // explicitly invited subcontractor/bookkeeper can still log in;
        // if that query returns empty (or is denied), hard-stop with the
        // Access Restricted screen and sign them back out.
        const email = (user.email || '').toLowerCase();

        const continueLogin = () => {
          window._signingIn = false; // popup resolved — clear the flag
          // Sync Custom Claims (companyId/role/fullAccessOverride) before
          // anything else - Firestore Security Rules trust the token
          // claims, not client-side state, so this has to land (and the
          // token has to refresh) before other reads/writes rely on rules
          // passing. Falls through to the old client-only flow if the
          // function isn't deployed yet (e.g. mid-rollout).
          const proceedWithLogin = () => {
            resolveCompany(user, () => {
              loadUserRole(user, () => {
                conShowMain(user);
                conLoadJobs();
                loadCompanyProfile();
                setTimeout(() => refreshNotificationBadges(), 3000);
              });
            });
          };
          if (conFunctions) {
            conFunctions.httpsCallable('syncMyClaims')()
              .then(() => user.getIdToken(true))
              .then(proceedWithLogin)
              .catch(e => {
                console.warn('syncMyClaims not available yet (functions not deployed?):', e.message);
                proceedWithLogin();
              });
          } else {
            proceedWithLogin();
          }
        };

        if (canCreateCompany(email)) {
          // Approved domain — no extra check needed
          continueLogin();
        } else {
          // Off-domain: check if explicitly invited as a member
          conDb.collection('companies')
            .where('memberEmails', 'array-contains', email)
            .limit(1)
            .get()
            .then(snap => {
              if (!snap.empty) {
                continueLogin();
              } else {
                conAuth.signOut().catch(() => {});
                showAccessDenied(user);
              }
            })
            .catch(() => {
              // Rules denied the query (no claims yet) — treat as not a member
              conAuth.signOut().catch(() => {});
              showAccessDenied(user);
            });
        }
      } else {
        conCurrentUser = null;
        // onAuthStateChanged confirmed no active session — show sign-in wall.
        // Skip if user just clicked Sign In (popup in flight).
        if (!window._signingIn) ktRevealSignIn();
      }
    });
  } catch(e) {
    console.error('Firebase init error:', e);
    const loading = document.getElementById('ktAuthLoading');
    if(loading) loading.innerHTML = '<span style="color:#ef5350">⚠️ Connection error. Reload to try again.</span>';
  }
}

// conLoadJobs view patch consolidated below

// Expose everything
// Reason options adapt to the job's current pipeline stage group.
const JOB_ARCHIVE_REASONS = {
  sales: [
    'Customer went with another contractor',
    'Customer cancelled — project on hold indefinitely',
    'Company declined — not a good fit',
    'Duplicate lead entry',
    'Other'
  ],
  active: [
    'Contract cancelled by customer',
    'Contract cancelled by company',
    'Duplicate / test entry',
    'Other'
  ],
  finance: [
    'Contract cancelled by customer',
    'Contract cancelled by company',
    'Duplicate / test entry',
    'Other'
  ],
  closed: [
    'Entered in error',
    'Duplicate of another job',
    'Other'
  ]
};

function openArchiveJobModal() {
  if (!conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const statusDef = job ? KYTRAC_STATUSES.find(s => s.name === job.status) : null;
  const group = statusDef ? statusDef.group : 'sales';
  const reasons = JOB_ARCHIVE_REASONS[group] || JOB_ARCHIVE_REASONS.sales;

  const sel = document.getElementById('archiveJobReason');
  sel.innerHTML = reasons.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  document.getElementById('archiveJobOtherWrap').style.display = (reasons[0] === 'Other') ? 'block' : 'none';
  document.getElementById('archiveJobOtherText').value = '';
  kOpen('archiveJobModal');
}
window.openArchiveJobModal = openArchiveJobModal;

function confirmArchiveJob() {
  if (!conCurrentJobId || !conDb) return;
  const reasonSel = document.getElementById('archiveJobReason').value;
  const otherText = document.getElementById('archiveJobOtherText').value.trim();
  const reason = (reasonSel === 'Other' && otherText) ? otherText : reasonSel;
  if (!reason) { alert('Please select a reason.'); return; }
  if (!confirm('Delete this job? It will be removed from your boards and lists.')) return;

  coll('jobs').doc(conCurrentJobId).update({
      archived: true,
      archivedReason: reason,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archivedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
    })
    .then(() => {
      kClose('archiveJobModal');
      kClose('jobDetailModal');
      conCurrentJobId = null;
    })
    .catch(e => alert('Error deleting: ' + e.message));
}
window.confirmArchiveJob = confirmArchiveJob;

function deleteCurrentJob() {
  if (!conCurrentJobId || !conDb) return;
  if (!confirm('Delete this job? This cannot be undone.')) return;
  coll('jobs').doc(conCurrentJobId).delete()
    .then(() => {
      kClose('jobDetailModal');
      conCurrentJobId = null;
    })
    .catch(e => alert('Error deleting: ' + e.message));
}
window.deleteCurrentJob = deleteCurrentJob;

window.ktNav = ktNav;

// Returns the set of job IDs assigned to the current user - via crew
// membership (email match, reliable) or superintendent/pm field (name
// match, best-effort since those are free-text fields, not linked to
// the team roster). Used to scope the dashboard for restricted roles.
function getMyJobIds() {
  const myEmail = (conCurrentUser?.email || '').toLowerCase();
  const myName = (currentUserTeamData?.name || '').toLowerCase();
  const ids = new Set();
  conJobs.forEach(j => {
    const crewMatch = (j.crew || []).some(c => (c.email || '').toLowerCase() === myEmail);
    const nameMatch = myName && ((j.superintendent || '').toLowerCase() === myName || (j.pm || '').toLowerCase() === myName);
    if (crewMatch || nameMatch) ids.add(j.id);
  });
  return ids;
}
window.getMyJobIds = getMyJobIds;

function toggleMasterRow(type, id) {
  if (!window._masterCollapsed) window._masterCollapsed = {};
  const nowCollapsed = !window._masterCollapsed[id];
  window._masterCollapsed[id] = nowCollapsed;

  function showEl(el) {
    el.style.display = el.hasAttribute('data-master-row') ? 'flex' : 'block';
  }

  if (type === 'job') {
    const arrow = document.getElementById('masterArrowJob_' + id);
    if (arrow) arrow.textContent = nowCollapsed ? '▶' : '▼';
    document.querySelectorAll('[data-parent-job="' + id + '"]').forEach(el => {
      if (nowCollapsed) {
        el.style.display = 'none';
      } else {
        const phaseId = el.getAttribute('data-parent-phase');
        const roomId = el.getAttribute('data-parent-room');
        if (roomId && window._masterCollapsed[roomId]) { el.style.display = 'none'; return; }
        if (phaseId && window._masterCollapsed[phaseId]) { el.style.display = 'none'; return; }
        showEl(el);
      }
    });
  } else if (type === 'phase') {
    const arrow = document.getElementById('masterArrowPhase_' + id);
    if (arrow) arrow.textContent = nowCollapsed ? '▶' : '▼';
    document.querySelectorAll('[data-parent-phase="' + id + '"]').forEach(el => {
      if (nowCollapsed) {
        el.style.display = 'none';
      } else {
        const roomId = el.getAttribute('data-parent-room');
        if (roomId && window._masterCollapsed[roomId]) { el.style.display = 'none'; return; }
        showEl(el);
      }
    });
  } else if (type === 'room') {
    const arrow = document.getElementById('masterArrowRoom_' + id);
    if (arrow) arrow.textContent = nowCollapsed ? '▶' : '▼';
    document.querySelectorAll('[data-parent-room="' + id + '"]').forEach(el => {
      el.style.display = nowCollapsed ? 'none' : (el.hasAttribute('data-master-row') ? 'flex' : 'block');
    });
  }
}
window.toggleMasterRow = toggleMasterRow;

async function renderMasterSchedulePage() {
  const el = document.getElementById('masterPageGantt');
  const meta = document.getElementById('masterPageMeta');
  if (!el) return;

  el.innerHTML = '<div class="small muted" style="padding:24px;font-style:italic">Loading all jobs...</div>';

  const ACTIVE = ['Scheduled','In Progress','Approved','To Be Scheduled','Inspection Pending'];
  const activeJobs = conJobs.filter(j => ACTIVE.includes(j.status))
    .sort((a,b) => (a.startDate||'9999').localeCompare(b.startDate||'9999'));

  if (meta) meta.textContent = activeJobs.length + ' active job' + (activeJobs.length !== 1 ? 's' : '');

  // Load all phases for all jobs in parallel
  const jobPhaseMap = {};
  await Promise.all(activeJobs.map(async job => {
    try {
      const phases = await loadEpicTree(job.id);
      jobPhaseMap[job.id] = phases;
    } catch(e) { jobPhaseMap[job.id] = []; }
  }));

  // Date range across all jobs and phases
  const today = new Date(); today.setHours(0,0,0,0);
  const allDates = [];
  activeJobs.forEach(job => {
    if (job.startDate) allDates.push(new Date(job.startDate));
    if (job.endDate) allDates.push(new Date(job.endDate));
    (jobPhaseMap[job.id] || []).forEach(phase => {
      if (phase.startDate) allDates.push(new Date(phase.startDate));
      if (phase.endDate) allDates.push(new Date(phase.endDate));
    });
  });

  if (!allDates.length) {
    el.innerHTML = '<div class="small muted" style="padding:24px;font-style:italic">No jobs with dates set. Set start and end dates on your jobs to see them here.</div>';
    return;
  }

  let minDate = new Date(Math.min(...allDates));
  let maxDate = new Date(Math.max(...allDates));
  minDate.setDate(minDate.getDate() - 5);
  maxDate.setDate(maxDate.getDate() + 14);

  const totalDays = Math.ceil((maxDate - minDate) / 86400000);
  const DAY_W = 32;
  const totalWidth = totalDays * DAY_W;
  const LABEL_W = 240;
  const ROW_H = 40;
  const PHASE_H = 32;
  const todayOffset = Math.floor((today - minDate) / 86400000) * DAY_W;

  // Collapse state
  if (!window._masterCollapsed) window._masterCollapsed = {};

  function bar(startDate, endDate, color, height, top, label, pct) {
    if (!startDate || !endDate) return '';
    const s = new Date(startDate), e = new Date(endDate);
    const left = Math.floor((s - minDate) / 86400000) * DAY_W;
    const width = Math.max(DAY_W, Math.ceil((e - s) / 86400000) * DAY_W);
    // Progress: dark overlay on the UNFILLED portion so filled section stays bright
    const progressOverlay = (pct >= 0 && pct < 100)
      ? `<div style="position:absolute;right:0;top:0;height:100%;width:${100-pct}%;background:rgba(0,0,0,0.45);pointer-events:none;border-radius:0 4px 4px 0"></div>`
      : '';
    return `<div style="position:absolute;left:${left}px;width:${width}px;height:${height}px;top:${top}px;${color};border-radius:4px;display:flex;align-items:center;overflow:hidden">
      ${progressOverlay}
      ${width > 60 ? `<span style="position:relative;z-index:1;font-size:.62rem;font-weight:700;color:#fff;padding:0 6px;white-space:nowrap;overflow:hidden;max-width:${width-12}px">${esc(label)}</span>` : ''}
    </div>`;
  }

  // Build month headers
  let monthHtml = `<div style="display:flex;margin-left:${LABEL_W}px;min-width:${totalWidth}px;border-bottom:1px solid rgba(110,145,210,.15)">`;
  let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const visStart = d < minDate ? minDate : d;
    const visEnd = monthEnd > maxDate ? maxDate : monthEnd;
    const days = Math.ceil((visEnd - visStart) / 86400000) + 1;
    const w = days * DAY_W;
    monthHtml += `<div style="width:${w}px;flex-shrink:0;font-size:.7rem;font-weight:800;color:var(--muted);border-right:1px solid rgba(110,145,210,.1);padding:4px 6px;white-space:nowrap;overflow:hidden">${d.toLocaleString('default',{month:'short',year:'numeric'})}</div>`;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  monthHtml += '</div>';

  // Build unified rows (label + bar in same div — no sync needed)
  let rowsHtml = '';

  function rowBar(startDate, endDate, color, height, pct, label) {
    if (!startDate || !endDate) return '<div style="flex:1"></div>';
    const s = new Date(startDate), e = new Date(endDate);
    const leftPx = Math.floor((s - minDate) / 86400000) * DAY_W;
    const width = Math.max(DAY_W, Math.ceil((e - s) / 86400000) * DAY_W);
    const pctNum = pct || 0;
    // Dark overlay on unfilled right portion for contrast
    const overlay = (pctNum >= 0 && pctNum < 100)
      ? `<div style="position:absolute;right:0;top:0;height:100%;width:${100-pctNum}%;background:rgba(0,0,0,0.5);pointer-events:none;border-radius:0 4px 4px 0"></div>`
      : '';
    return `<div style="flex:1;min-width:${totalWidth}px;position:relative;height:100%">
      <div style="position:absolute;left:${leftPx}px;width:${width}px;height:${height}px;top:50%;transform:translateY(-50%);${color};border-radius:4px;overflow:hidden;display:flex;align-items:center">
        ${overlay}
        ${width > 50 ? `<span style="position:relative;z-index:1;font-size:.6rem;font-weight:700;color:#fff;padding:0 5px;white-space:nowrap;overflow:hidden;max-width:${width-10}px">${esc(label)}</span>` : ''}
      </div>
    </div>`;
  }

  activeJobs.forEach(job => {
    const jobCollapsed = window._masterCollapsed[job.id];
    const phases = (jobPhaseMap[job.id] || []).filter(p => p.startDate && p.endDate);
    const allPhases = jobPhaseMap[job.id] || [];
    const isLate = job.endDate && new Date(job.endDate) < today;
    const isActive = job.status === 'In Progress';
    const jobBarColor = isLate ? 'background:linear-gradient(90deg,#991b1b,#ef4444)'
      : isActive ? 'background:linear-gradient(90deg,#065f46,#10b981)'
      : 'background:linear-gradient(90deg,#b45309,#d97706)';

    // Job % complete
    let _jobDone = 0, _jobTotal = 0;
    allPhases.forEach(p => {
      (p.features || []).forEach(room => {
        const sm = room.scopeNoteStatus || {};
        const tl = (room.scopeNotes && room.scopeNotes.trim())
          ? room.scopeNotes.split('\n').map(l=>l.trim()).filter(Boolean).map((ln,i)=>({taskStatus:sm['scope_'+room.id+'_'+i]||'todo'}))
          : (room.tasks||[]);
        _jobTotal += tl.length;
        _jobDone += tl.filter(t=>t.taskStatus==='done').length;
      });
    });
    const _jobPct = _jobTotal ? Math.round(_jobDone / _jobTotal * 100) : 0;
    const _jobPctColor = _jobPct===100 ? '#10b981' : _jobPct>0 ? '#60a5fa' : 'var(--muted)';

    // Job row
    rowsHtml += `<div data-master-row="job" data-job-id="${job.id}" style="display:flex;align-items:stretch;min-height:${ROW_H}px;border-bottom:1px solid rgba(110,145,210,.1);background:rgba(245,158,11,.06);cursor:pointer"
      onclick="toggleMasterRow('job','${job.id}')">
      <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:6px 10px;border-right:1px solid rgba(110,145,210,.15);overflow:hidden;display:flex;flex-direction:column;justify-content:center">
        <div style="display:flex;align-items:center;gap:6px">
          <span id="masterArrowJob_${job.id}" style="font-size:.65rem;color:var(--muted);flex-shrink:0">${jobCollapsed ? '▶' : '▼'}</span>
          <span style="font-size:.78rem;font-weight:800;color:var(--amber);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(job.name)}</span>
          <span style="font-size:.68rem;font-weight:700;color:${_jobPctColor};flex-shrink:0">${_jobPct}%</span>
        </div>
        <div style="font-size:.65rem;color:var(--muted);padding-left:14px">${esc(job.status)}${job.startDate ? ' · ' + job.startDate + ' → ' + (job.endDate||'?') : ' · No dates'}</div>
      </div>
      ${rowBar(job.startDate, job.endDate, jobBarColor, 22, _jobPct, job.name)}
    </div>`;

    if (!jobCollapsed) {
      phases.forEach(phase => {
        const phaseCollapsed = window._masterCollapsed[phase.id];
        const roomCount = (phase.features || []).length;

        // Phase % from rooms
        let phaseDone = 0, phaseTotal = 0;
        (phase.features || []).forEach(room => {
          const sm = room.scopeNoteStatus || {};
          const tl = (room.scopeNotes && room.scopeNotes.trim())
            ? room.scopeNotes.split('\n').map(l=>l.trim()).filter(Boolean).map((ln,i)=>({taskStatus:sm['scope_'+room.id+'_'+i]||'todo'}))
            : (room.tasks||[]);
          phaseTotal += tl.length;
          phaseDone += tl.filter(t=>t.taskStatus==='done').length;
        });
        const phasePct = phaseTotal ? Math.round(phaseDone / phaseTotal * 100) : 0;

        rowsHtml += `<div data-master-row="phase" data-phase-id="${phase.id}" data-parent-job="${job.id}" style="display:flex;align-items:stretch;min-height:${PHASE_H}px;border-bottom:1px solid rgba(110,145,210,.07);background:rgba(8,19,37,.3);cursor:pointer"
          onclick="toggleMasterRow('phase','${phase.id}')">
          <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:4px 10px 4px 22px;border-right:1px solid rgba(110,145,210,.15);overflow:hidden;display:flex;align-items:center;gap:5px">
            ${roomCount ? `<span id="masterArrowPhase_${phase.id}" style="font-size:.6rem;color:var(--muted);flex-shrink:0">${phaseCollapsed?'▶':'▼'}</span>` : '<span style="width:10px;flex-shrink:0"></span>'}
            <span style="font-size:.74rem;font-weight:700;color:#93c5fd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(phase.name)}</span>
            <span style="font-size:.65rem;color:var(--muted);flex-shrink:0">${phasePct}%</span>
          </div>
          ${rowBar(phase.startDate, phase.endDate, 'background:linear-gradient(90deg,#1d4ed8,#3b82f6)', 16, phasePct, phase.name)}
        </div>`;

        if (!phaseCollapsed) {
          (phase.features || []).forEach(room => {
            const roomCollapsed = window._masterCollapsed[room.id];
            const sm = room.scopeNoteStatus || {};
            const scopeTaskList = (room.scopeNotes && room.scopeNotes.trim())
              ? room.scopeNotes.split('\n').map(l=>l.trim()).filter(Boolean).map((line,i)=>({ id:`scope_${room.id}_${i}`, name:line, taskStatus:sm[`scope_${room.id}_${i}`]||'todo' }))
              : null;
            const displayTasks = scopeTaskList || getDisplayTasks(room, room.tasks || []);
            const doneTasks = displayTasks.filter(t => t.taskStatus === 'done').length;
            const pct = displayTasks.length ? Math.round(doneTasks / displayTasks.length * 100) : 0;
            const roomColor = pct === 100 ? 'background:#10b981'
              : room.endDate && new Date(room.endDate) < today ? 'background:#ef4444'
              : 'background:linear-gradient(90deg,#0d9488,#14b8a6)';

            rowsHtml += `<div data-master-row="room" data-room-id="${room.id}" data-parent-phase="${phase.id}" data-parent-job="${job.id}" style="display:flex;align-items:stretch;min-height:${PHASE_H}px;border-bottom:1px solid rgba(110,145,210,.05);background:rgba(8,19,37,.15);cursor:${displayTasks.length?'pointer':'default'}"
              ${displayTasks.length ? `onclick="toggleMasterRow('room','${room.id}')"` : ''}>
              <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:3px 10px 3px 38px;border-right:1px solid rgba(110,145,210,.1);overflow:hidden;display:flex;align-items:center;gap:5px">
                ${displayTasks.length ? `<span id="masterArrowRoom_${room.id}" style="font-size:.58rem;color:var(--muted);flex-shrink:0">${roomCollapsed?'▶':'▼'}</span>` : '<span style="width:8px;flex-shrink:0"></span>'}
                <span style="font-size:.71rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(room.name)}</span>
                <span style="font-size:.62rem;color:var(--muted);flex-shrink:0">${doneTasks}/${displayTasks.length} · ${pct}%</span>
              </div>
              ${rowBar(room.startDate||phase.startDate, room.endDate||phase.endDate, roomColor, 12, pct, room.name)}
            </div>`;

            if (!roomCollapsed) {
              const TASK_H = 26;
              displayTasks.forEach((task, ti) => {
                const isDone = task.taskStatus === 'done';
                rowsHtml += `<div data-master-row="task" data-task-idx="${ti}" data-parent-room="${room.id}" data-parent-phase="${phase.id}" data-parent-job="${job.id}" style="display:flex;align-items:center;min-height:${TASK_H}px;border-bottom:1px solid rgba(110,145,210,.03);background:rgba(8,19,37,.08)">
                  <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:2px 10px 2px 52px;border-right:1px solid rgba(110,145,210,.06);overflow:hidden;display:flex;align-items:center;gap:5px">
                    <span style="font-size:.72rem;color:${isDone?'#10b981':'var(--muted)'};flex-shrink:0">${isDone?'☑':'☐'}</span>
                    <span style="font-size:.67rem;color:${isDone?'#10b981':'#64748b'};text-decoration:${isDone?'line-through':'none'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(task.name)}</span>
                  </div>
                  <div style="flex:1;min-width:${totalWidth}px"></div>
                </div>`;
              });
            }
          });

          if (!phases.length || !(phase.features||[]).length) {
            rowsHtml += `<div style="display:flex;min-height:26px;border-bottom:1px solid rgba(110,145,210,.05)">
              <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:4px 10px 4px 38px;font-size:.67rem;color:var(--muted);font-style:italic;border-right:1px solid rgba(110,145,210,.06)">No rooms</div>
              <div style="flex:1;min-width:${totalWidth}px"></div>
            </div>`;
          }
        }
      });

      if (!phases.length) {
        rowsHtml += `<div style="display:flex;min-height:28px;border-bottom:1px solid rgba(110,145,210,.05)">
          <div class="ms-label" style="width:${LABEL_W}px;flex-shrink:0;padding:4px 10px 4px 22px;font-size:.67rem;color:var(--muted);font-style:italic;border-right:1px solid rgba(110,145,210,.06)">No phases with dates set</div>
          <div style="flex:1;min-width:${totalWidth}px"></div>
        </div>`;
      }
    }
  });

  // No active jobs
  if (!activeJobs.length) {
    el.innerHTML = '<div class="small muted" style="padding:24px;font-style:italic">No active jobs found.</div>';
    return;
  }

  el.innerHTML = `
    <div style="height:100%;overflow:auto;position:relative" id="masterPageScroll">
      <!-- Sticky header -->
      <div style="display:flex;position:sticky;top:0;z-index:20;background:rgba(8,19,37,.97);border-bottom:2px solid rgba(110,145,210,.2)">
        <div class="ms-label" id="masterLabelHeader" style="width:${LABEL_W}px;flex-shrink:0;height:32px;display:flex;align-items:center;padding:0 10px;font-size:.7rem;font-weight:800;color:var(--muted);border-right:1px solid rgba(110,145,210,.2)">JOB / PHASE / ROOM</div>
        <!-- Drag handle -->
        <div id="masterPageDivider" style="width:5px;flex-shrink:0;cursor:col-resize;background:rgba(110,145,210,.2);position:relative;z-index:5"
          onmouseover="this.style.background='rgba(245,158,11,.5)'" onmouseout="this.style.background='rgba(110,145,210,.2)'"></div>
        <div style="flex:1;min-width:${totalWidth}px;overflow:hidden;position:relative">
          ${monthHtml}
          <div style="position:absolute;left:${todayOffset}px;top:0;bottom:0;width:1px;background:rgba(239,68,68,.4);pointer-events:none"></div>
        </div>
      </div>
      <!-- Today line through rows -->
      <div style="position:relative">
        <div style="position:absolute;left:${LABEL_W + 5 + todayOffset}px;top:0;bottom:0;width:1px;background:rgba(239,68,68,.25);z-index:5;pointer-events:none"></div>
        ${rowsHtml}
      </div>
    </div>`;

  // Drag-to-resize label column
  const divider = document.getElementById('masterPageDivider');
  const scroll = document.getElementById('masterPageScroll');
  let _msLabelW = 240; // matches LABEL_W
  if (divider && scroll) {
    let dragging = false, startX = 0, startW = 0;
    divider.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; startW = _msLabelW;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      _msLabelW = Math.max(160, Math.min(600, startW + (e.clientX - startX)));
      scroll.querySelectorAll('.ms-label').forEach(el => el.style.width = _msLabelW + 'px');
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

}
window.renderMasterSchedulePage = renderMasterSchedulePage;