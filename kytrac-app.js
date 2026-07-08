// JOBSpan Application JavaScript v1.9.35 · 08/Jul/2026


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
  dashboard: { el:'ktPageDashboard', title:'🏠 Home' },
  jobs:      { el:'ktPageJobs',      title:'🔧 Jobs' },
  logs:      { el:'ktPageLogs',      title:'📋 Daily Logs' },
  costing:   { el:'ktPageCosting',   title:'💰 Job Costing' },
  catalog:   { el:'ktPageCatalog',   title:'📦 Cost Catalog' },
  invoicing: { el:'ktPageInvoicing', title:'🧾 Invoicing' },
  reports:        { el:'ktPageReports',       title:'📊 Reports & Analytics' },
  purchaseorders: { el:'ktPagePurchaseOrders', title:'📋 Purchase Orders' },
  calendar:  { el:'ktPageCalendar',  title:'📅 Calendar' },
  time:      { el:'ktPageTime',      title:'⏱ Time Tracking' },
  documents: { el:'ktPageDocuments', title:'📁 Documents' },
  todos:     { el:'ktPageTodos',     title:'✅ To-Dos' },
  customers: { el:'ktPageCustomers', title:'👥 Customers' },
  vendors:   { el:'ktPageVendors',   title:'🏭 Vendors' },
  settings:  { el:'ktPageSettings',  title:'⚙️ Company Settings' },

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
function renderJobsBoard() {
  const board = document.getElementById('jobsBoard');
  if (!board) return;
  const statusFilter = document.getElementById('jobsStatusFilter')?.value || '';
  board.innerHTML = '';
  const statusesToShow = statusFilter
    ? KYTRAC_STATUSES.filter(s => s.name === statusFilter)
    : KYTRAC_STATUSES;
  statusesToShow.forEach(s => {
    const jobs = conJobs.filter(j => j.status === s.name);
    const col = document.createElement('div');
    col.className = 'kt-col';
    col.style.borderTopColor = s.color;
    col.dataset.status = s.name;
    col.innerHTML = `<div class="kt-col-head"><span class="kt-col-head-label" style="color:${s.color}">${s.name}</span><span class="kt-col-count" style="background:${s.color}22;color:${s.color};flex-shrink:0">${jobs.length}</span></div>`;
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'kt-job-card';
      card.style.borderLeftColor = s.color;
      card.dataset.jobId = job.id;
      card.innerHTML = `
        <div class="kt-job-num" style="color:${s.color}">${esc(job.jobNumber||'')}</div>
        <div class="kt-job-name">${esc(job.name)}</div>
        ${job.client?`<div class="kt-job-meta">Customer: ${esc(job.client)}</div>`:''}
        ${job.statusDate||job.startDate?`<div class="kt-job-meta">Status Date: ${job.statusDate||job.startDate}</div>`:''}
        ${job.superintendent||job.pm?`<div class="kt-job-meta">Sales Rep: ${esc(job.superintendent||job.pm)}</div>`:''}
        ${getJobValue(job)?`<div class="kt-job-value">$${Math.round(getJobValue(job)).toLocaleString()}</div>`:''}
      `;
      card.onclick = () => openJobDetail(job.id);
      col.appendChild(card);
    });
    if (!jobs.length) {
      const empty = document.createElement('div');
      empty.className = 'kt-col-empty';
      empty.textContent = 'No jobs';
      col.appendChild(empty);
    }
    board.appendChild(col);
  });
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
  if(key==='costing') renderJobCostDashboard();

  if(key==='jobs') {
    if(_jobsView === 'kanban') renderJobsBoard();
    else conRenderList();
  }
  if(key==='dashboard') { conRenderBoard(); conRenderStats(); renderHomeDashboard(); }
  if(key==='catalog') renderCatalog();
  if(key==='calendar') { loadGlobalPhases(); loadCalendarEvents(); buildTeamColors(); renderCalendar(); }
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

// ── OVERRIDE conShowMain to use new JOBSpan UI ──
function conShowMain(user) {
  document.getElementById('ktAuthWall').style.display = 'none';
  document.getElementById('ktApp').style.display = 'flex';
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
    label: 'Owner',
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

function hasPermission(perm) {
  if (!currentUserRole) return false;
  const role = KYTRAC_ROLES[currentUserRole];
  if (!role) return false;
  if (role.permissions.includes('all')) return true;
  return role.permissions.includes(perm);
}

function isOwnerOrAdmin() {
  return currentUserRole === 'Owner' || currentUserRole === 'Project Manager';
}

// Legacy - kept for auth check but role system handles access
const CON_APPROVED_EMAILS = [];

let conApp = null, conDb = null, conAuth = null;
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

const KYTRAC_STATUSES = [
  {name:'New Lead',           color:'#ef4444', group:'sales'},
  {name:'Hipshot Needed',     color:'#f97316', group:'sales'},
  {name:'Appointment Set',    color:'#f97316', group:'sales'},
  {name:'Estimating',         color:'#f97316', group:'sales'},
  {name:'Submitted',          color:'#d97706', group:'sales'},
  {name:'Approved',           color:'#16a34a', group:'active'},
  {name:'Design Phase',       color:'#16a34a', group:'active'},
  {name:'Permitting',         color:'#16a34a', group:'active'},
  {name:'Scheduled',          color:'#0d9488', group:'active'},
  {name:'Work In Progress',   color:'#0891b2', group:'active'},
  {name:'Inspection Pending', color:'#2563eb', group:'active'},
  {name:'Invoicing',          color:'#2563eb', group:'finance'},
  {name:'Pending Payment',    color:'#7c3aed', group:'finance'},
  {name:'Delinquent',         color:'#7c3aed', group:'finance'},
  {name:'Closed Hipshot Sent',color:'#7c3aed', group:'closed'},
  {name:'Closed Won',         color:'#db2777', group:'closed'},
  {name:'Closed Lost',        color:'#dc2626', group:'closed'},
];
const CON_JOB_STATUSES = KYTRAC_STATUSES.map(s => s.name);

function conLoadFirebase() {
  if (conFirebaseReady) return;
  // Load Firebase SDKs in sequence — app MUST load before auth and firestore
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
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
      if (loader) loader.innerHTML = '<div style="color:#ef5350;font-size:.9rem">⚠️ Could not connect to JOBSpan.<br>Check your internet connection and reload.</div>';
    };
    document.head.appendChild(s);
  }
  loadNext(0);
}

// conShowAuthWall and conShowMain overridden by JOBSpan UI versions below

function conSignIn() {
  if (!conFirebaseReady) {
    // If somehow called before ready, just wait and retry
    const btn = document.getElementById('conSignInBtn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }
    setTimeout(conSignIn, 1000);
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  conAuth.signInWithPopup(provider).catch(e => {
    alert('Sign-in failed: ' + e.message);
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
  document.getElementById('jobStatus').value = 'Contracted';
  document.getElementById('jobType').value = 'Residential Remodel';
  document.getElementById('jobStartDate').value = '';
  document.getElementById('jobEndDate').value = '';
  kOpen('newJobModal');
}

function saveJob(openEstimate) {
  const name = document.getElementById('jobName').value.trim();
  const client = document.getElementById('jobClient').value.trim();
  if (!name || !client) { alert('Job name and client name are required.'); return; }

  const data = {
    name, client,
    phone: document.getElementById('jobPhone').value.trim(),
    email: document.getElementById('jobEmail').value.trim(),
    address: document.getElementById('jobAddress').value.trim(),
    status: document.getElementById('jobStatus').value,
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
    coll('jobs').doc(conEditingJobId).update(data)
      .then(() => kClose('newJobModal'))
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
  document.getElementById('jobStatus').value = 'Contracted';
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
  KYTRAC_STATUSES.forEach(s => {
    const jobs = conJobs.filter(j => j.status === s.name);
    const col = document.createElement('div');
    col.className = 'con-col';
    col.style.borderTopColor = s.color;
    col.innerHTML = `<div class="con-col-head" style="color:${s.color}">${s.name} <span class="con-col-count" style="background:${s.color}22;color:${s.color}">${jobs.length}</span></div>`;
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.style.borderLeftColor = s.color;
      // Format: jobNumber — customer name (like JobTread shows address)
      const statusDate = job.statusDate || job.startDate || '';
      const salesRep = job.superintendent || job.pm || '';
      card.innerHTML = `
        <div class="job-card-num" style="color:${s.color}">${job.jobNumber || ''}</div>
        <div class="job-card-name">${job.name}</div>
        ${job.client ? `<div class="job-card-meta">Customer: ${job.client}</div>` : ''}
        ${statusDate ? `<div class="job-card-meta">Status Date: ${statusDate}</div>` : ''}
        ${salesRep ? `<div class="job-card-meta">Sales Rep: ${salesRep}</div>` : ''}
        ${getJobValue(job) ? `<div class="job-card-value">$${Math.round(getJobValue(job)).toLocaleString()}</div>` : ''}
      `;
      card.onclick = () => openJobDetail(job.id);
      col.appendChild(card);
    });
    if (!jobs.length) {
      const empty = document.createElement('div');
      empty.className = 'kt-col-empty';
      empty.textContent = 'No jobs';
      col.appendChild(empty);
    }
    board.appendChild(col);
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
    const val = getJobValue(job) ? '$' + Math.round(getJobValue(job)).toLocaleString() : '—';
    tr.innerHTML = `
      <td style="color:var(--amber);font-weight:700">${job.jobNumber || '—'}</td>
      <td style="font-weight:600">${job.name}</td>
      <td>${job.client}</td>
      <td><span style="background:var(--amber-light);color:var(--amber);padding:3px 8px;border-radius:8px;font-size:.78rem">${job.status}</span></td>
      <td style="color:#a3f2d2">${val}</td>
      <td>${job.startDate || '—'}</td>
      <td>${job.superintendent || job.pm || '—'}</td>
      <td><button class="btn" style="padding:4px 10px;font-size:.78rem" onclick="openJobDetail('${job.id}')">Open</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function getJobValue(job) {
  return Number(job.contractValue || job.approvedOrders || job.pendingOrders || 0);
}

function conRenderStats() {
  const closedStatuses = ['Closed Won','Closed Lost','Closed Hipshot Sent'];
  const active = conJobs.filter(j => !closedStatuses.includes(j.status)).length;
  document.getElementById('statActiveJobs').textContent = active;
  const totalContract = conJobs.reduce((s, j) => s + getJobValue(j), 0);
  document.getElementById('statContractTotal').textContent = '$' + Math.round(totalContract).toLocaleString();
  const margins = conJobs.filter(j => getJobValue(j) > 0 && j.estCost > 0 && j.estCost < getJobValue(j)).map(j => (getJobValue(j) - j.estCost) / getJobValue(j) * 100);
  const avgMargin = margins.length ? (margins.reduce((a,b) => a+b, 0) / margins.length).toFixed(1) : '0';
  document.getElementById('statAvgMargin').textContent = avgMargin + '%';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('statLogsToday').textContent = '—';
}

function conRenderSchedule() {
  const el = document.getElementById('conScheduleList');
  if (!el) return;
  const jobsWithDates = conJobs.filter(j => j.startDate && ['Work In Progress','Scheduled','Approved','Design Phase','Permitting'].includes(j.status));
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
    html += '<div class="small" style="color:#fca5a5">No matching jobs. Confirm job numbers in JOBSpan match your estimates.</div>';
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
      </div>
      <div style="font-size:.66rem;color:var(--muted);margin-top:3px;padding:0 4px">${when}</div>
    </div>`;
  }).join('');
  // Scroll to newest
  listEl.scrollTop = listEl.scrollHeight;
}

function sendJobMessage() {
  const input = document.getElementById('messageInput');
  const text = (input?.value || '').trim();
  if (!text || !conDb || !conCurrentJobId) return;
  const data = {
    text,
    authorEmail: conCurrentUser?.email || '',
    authorName: conCurrentUser?.displayName || conCurrentUser?.email || 'Unknown',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdMs: Date.now()
  };
  if (input) input.value = '';
  coll('jobs').doc(conCurrentJobId).collection('messages').add(data)
    .catch(e => { alert('Error sending: ' + e.message); if (input) input.value = text; });
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

  el.innerHTML = html;
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
  const jobInvs = (window._allInvoices || []).filter(i => i.jobId === job.id);
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
}


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

function openJobDetail(jobId) {
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
  switchDetailTab('dashboard', document.querySelector('#jobDetailModal .con-subtab'));
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
  document.getElementById('jobStatus').value = job.status || 'Contracted';
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
  coll('jobs').doc(jobId).collection('phases').orderBy('order').onSnapshot(snap => {
    conPhases = [];
    snap.forEach(doc => conPhases.push({ id: doc.id, ...doc.data() }));
    loadPhaseActualHours(jobId).then(() => {
      renderPhaseKanban();
      renderPhaseList();
      updatePhaseHoursSummary();
      if (typeof renderEpicBoard === 'function') renderEpicBoard();
    });
  }, () => {
    coll('jobs').doc(jobId).collection('phases').onSnapshot(snap => {
      conPhases = [];
      snap.forEach(doc => conPhases.push({ id: doc.id, ...doc.data() }));
      renderPhaseKanban();
      renderPhaseList();
      updatePhaseHoursSummary();
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

function updatePhaseHoursSummary() {
  const el = document.getElementById('phaseHoursSummary');
  if (!el || !conPhases.length) return;
  const totalEst = conPhases.reduce((s,p) => s + (p.estHours||0), 0);
  const totalAct = conPhases.reduce((s,p) => s + (p._actualHours||0), 0);
  const done = conPhases.filter(p => p.status === 'complete').length;
  const color = totalAct > totalEst && totalEst > 0 ? '#f87171' : '#34d399';
  el.innerHTML = '<span style="color:'+color+';font-weight:700">'+totalAct.toFixed(1)+'h actual</span> / '+totalEst.toFixed(1)+'h est · '+done+'/'+conPhases.length+' complete';
}

let _currentPhaseView = 'board';

function switchPhaseView(view) {
  _currentPhaseView = view;
  const views = {kanban:'phaseKanbanView',board:'phaseBoardView',gantt:'phaseGanttView',list:'phaseListView'};
  const btns = {kanban:'phaseViewKanban',board:'phaseViewBoard',gantt:'phaseViewGantt',list:'phaseViewList'};
  Object.entries(views).forEach(([k,id]) => { const el=document.getElementById(id); if(el) el.style.display=k===view?'block':'none'; });
  Object.entries(btns).forEach(([k,id]) => {
    const btn=document.getElementById(id); if(!btn) return;
    if(k===view){btn.style.background='linear-gradient(135deg,var(--amber),var(--amber2))';btn.style.color='#fff';}
    else{btn.style.background='transparent';btn.style.color='var(--muted)';}
  });
  if(view==='gantt') renderPhaseGantt();
  if(view==='kanban') renderPhaseKanban();
  if(view==='list') renderPhaseList();
  if(view==='board') renderEpicBoard();
}

function renderPhaseKanban() {
  const lanes = {'not-started':document.getElementById('phaseLane0'),'in-progress':document.getElementById('phaseLane1'),'complete':document.getElementById('phaseLane2'),'blocked':document.getElementById('phaseLane3')};
  const counts = {'not-started':0,'in-progress':0,'complete':0,'blocked':0};
  Object.values(lanes).forEach(l => { if(l) l.innerHTML=''; });

  conPhases.forEach(phase => {
    const status = phase.status||'not-started';
    counts[status] = (counts[status]||0)+1;
    const lane = lanes[status];
    if(!lane) return;
    const color = phase.color||'#d97706';
    const estH = phase.estHours||0;
    const actH = phase._actualHours||0;
    const pct = estH>0 ? Math.min(actH/estH*100,120) : 0;
    const over = actH>estH && estH>0;
    const barColor = over?'#f87171':(actH>0?'#34d399':'rgba(255,255,255,.15)');
    const today = new Date().toISOString().split('T')[0];
    const isBehind = phase.endDate && phase.endDate<today && status!=='complete';

    const hoursHtml = estH>0 ?
      '<div style="display:flex;justify-content:space-between;font-size:.72rem;margin-top:6px;padding-left:8px">'+
      '<span style="color:'+(over?'#f87171':'var(--muted)')+'">⏱ '+actH.toFixed(1)+'h actual</span>'+
      '<span style="color:var(--muted)">'+estH+'h est</span></div>'+
      '<div class="phase-hours-bar"><div class="phase-hours-fill" style="width:'+Math.min(pct,100)+'%;background:'+barColor+'"></div></div>' : '';

    const div = document.createElement('div');
    div.className = 'phase-card';
    div.draggable = true;
    div.dataset.phaseId = phase.id;
    div.innerHTML =
      '<div class="phase-card-accent" style="background:'+color+'"></div>'+
      '<div class="phase-card-name">'+esc(phase.name)+(isBehind?' <span style="color:#f87171;font-size:.7rem">⚠ Behind</span>':'')+'</div>'+
      '<div class="phase-card-meta">'+(phase.assigned?'👤 '+esc(phase.assigned)+'<br>':'')+(phase.startDate?'📅 '+phase.startDate+(phase.endDate?' → '+phase.endDate:'')+'<br>':'')+(phase.trade?'🔧 '+esc(phase.trade):'')+'</div>'+
      hoursHtml;
    div.addEventListener('dragstart', e => { e.dataTransfer.setData('phaseId', phase.id); });
    div.onclick = () => openEditPhaseModal(phase.id);
    lane.appendChild(div);
  });

  ['not-started','in-progress','complete','blocked'].forEach((s,i) => {
    const el = document.getElementById('laneCount'+i);
    if(el) el.textContent = counts[s]||0;
  });
  if(!conPhases.length) {
    const lane = lanes['not-started'];
    if(lane) lane.innerHTML='<div style="color:var(--muted);font-size:.82rem;text-align:center;padding:20px">No phases yet.<br>Hit + Add Phase to start.</div>';
  }
}

function phaseDropped(event, newStatus) {
  event.preventDefault();
  const phaseId = event.dataTransfer.getData('phaseId');
  if(!phaseId||!conCurrentJobId) return;
  const updates = {status:newStatus,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(newStatus==='in-progress') updates.actualStart = new Date().toISOString().split('T')[0];
  if(newStatus==='complete') updates.actualEnd = new Date().toISOString().split('T')[0];
  coll('jobs').doc(conCurrentJobId).collection('phases').doc(phaseId).update(updates);
}

function renderPhaseGantt() {
  const wrap = document.getElementById('ganttWrap');
  if(!wrap) return;
  if(!conPhases.length){wrap.innerHTML='<div class="small muted" style="padding:20px;text-align:center">No phases to show</div>';return;}
  const dates = conPhases.flatMap(p=>[p.startDate,p.endDate].filter(Boolean));
  if(!dates.length){wrap.innerHTML='<div class="small muted" style="padding:20px;text-align:center">Add start/end dates to phases to see the Gantt chart</div>';return;}

  const minDate = new Date(dates.reduce((a,b)=>a<b?a:b));
  const maxDate = new Date(dates.reduce((a,b)=>a>b?a:b));
  minDate.setDate(minDate.getDate()-7);
  maxDate.setDate(maxDate.getDate()+14);
  const totalDays = Math.ceil((maxDate-minDate)/86400000);
  const dayWidth = Math.max(24,Math.floor(800/totalDays));
  const totalWidth = totalDays*dayWidth;
  const today = new Date();
  const todayOffset = Math.floor((today-minDate)/86400000)*dayWidth;

  const weekWidth = dayWidth*7;
  let weekHeaders='',d=new Date(minDate);
  while(d<maxDate){
    const label=d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    weekHeaders+='<div class="gantt-week-label" style="width:'+weekWidth+'px">Wk '+getWeekNum(d)+'<br><span style="font-size:.64rem">'+label+'</span></div>';
    d.setDate(d.getDate()+7);
  }

  const statusColors={'not-started':'#64748b','in-progress':'#3b82f6','complete':'#10b981','blocked':'#ef4444'};
  const rows = conPhases.map(phase => {
    if(!phase.startDate) return '<div class="gantt-row"><div class="gantt-label">'+esc(phase.name)+'</div><div class="gantt-bar-area" style="width:'+totalWidth+'px"><span style="color:var(--muted);font-size:.74rem;padding:12px 8px;display:block">No dates</span></div></div>';
    const start=new Date(phase.startDate);
    const end=phase.endDate?new Date(phase.endDate):new Date(start.getTime()+86400000*3);
    const left=Math.floor((start-minDate)/86400000)*dayWidth;
    const width=Math.max(dayWidth*2,Math.ceil((end-start)/86400000)*dayWidth);
    const color=phase.color||statusColors[phase.status]||'#64748b';
    const todayStr=new Date().toISOString().split('T')[0];
    const isBehind=phase.endDate&&phase.endDate<todayStr&&phase.status!=='complete';
    const actH=phase._actualHours||0;const estH=phase.estHours||0;
    const hoursLabel=estH>0?' · '+actH.toFixed(1)+'/'+estH+'h':'';
    return '<div class="gantt-row">'+
      '<div class="gantt-label">'+esc(phase.name)+'<div style="font-size:.7rem;color:var(--muted)">'+esc(phase.assigned||'')+'</div></div>'+
      '<div class="gantt-bar-area" style="width:'+totalWidth+'px;position:relative">'+
      '<div class="gantt-bar'+(isBehind?' behind':'')+' " onclick="openEditPhaseModal(\''+phase.id+'\')" style="left:'+left+'px;width:'+width+'px;background:'+color+';opacity:'+(phase.status==='complete'?0.7:1)+'">'+
      esc(phase.name)+hoursLabel+'</div>'+
      (isBehind?'<div style="position:absolute;left:'+(left+width)+'px;top:12px;font-size:.7rem;color:#f87171;font-weight:700;white-space:nowrap"> ⚠ Behind</div>':'')+
      '</div></div>';
  }).join('');

  wrap.innerHTML='<div style="display:flex"><div style="width:160px;flex-shrink:0"></div>'+
    '<div class="gantt-header" style="width:'+totalWidth+'px;position:relative">'+weekHeaders+
    '<div class="gantt-today-line" style="left:'+todayOffset+'px"></div></div></div>'+
    rows+'<div style="margin-top:12px;font-size:.74rem;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">'+
    '<span>🔵 In Progress</span><span>✅ Complete</span><span style="color:#f87171">⚠ Behind</span>'+
    '<span style="border-left:2px solid rgba(239,68,68,.7);padding-left:6px">Today</span></div>';
}

function getWeekNum(d) {
  const date=new Date(d);date.setHours(0,0,0,0);date.setDate(date.getDate()+3-(date.getDay()+6)%7);
  const week1=new Date(date.getFullYear(),0,4);
  return 1+Math.round(((date.getTime()-week1.getTime())/86400000-3+(week1.getDay()+6)%7)/7);
}

function renderPhaseList() {
  const el = document.getElementById('phaseList');
  if (!el) return;
  if (!conPhases.length) { el.innerHTML = '<p class="muted">No phases added yet.</p>'; return; }

  const sc = {'not-started':'#64748b','in-progress':'#3b82f6','complete':'#10b981','blocked':'#ef4444'};
  const sl = {'not-started':'Not Started','in-progress':'In Progress','complete':'Complete','blocked':'Blocked'};
  const today = new Date().toISOString().split('T')[0];

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.84rem';
  table.innerHTML = '<thead><tr style="border-bottom:2px solid rgba(110,145,210,.15)">' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Phase</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Assigned</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Dates</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Est Hrs</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Act Hrs</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Status</th>' +
    '</tr></thead>';

  const tbody = document.createElement('tbody');
  conPhases.forEach(p => {
    const color = p.color || sc[p.status||'not-started'] || '#64748b';
    const actH = p._actualHours || 0;
    const estH = p.estHours || 0;
    const over = actH > estH && estH > 0;
    const behind = p.endDate && p.endDate < today && p.status !== 'complete';

    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer';
    tr.onmouseover = function() { this.style.background = 'rgba(217,119,6,.05)'; };
    tr.onmouseout = function() { this.style.background = ''; };
    tr.onclick = function() { openEditPhaseModal(p.id); };

    tr.innerHTML =
      '<td style="padding:10px"><div style="display:flex;align-items:center;gap:8px">' +
      '<div style="width:4px;height:30px;background:'+color+';border-radius:2px;flex-shrink:0"></div>' +
      '<div><div style="font-weight:700">'+esc(p.name)+'</div><div style="font-size:.73rem;color:var(--muted)">'+esc(p.trade||'')+'</div></div></div></td>' +
      '<td style="padding:10px;color:var(--muted)">'+esc(p.assigned||'\u2014')+'</td>' +
      '<td style="padding:10px;color:var(--muted);font-size:.8rem">'+(p.startDate||'\u2014')+(p.endDate?' \u2192 '+p.endDate:'')+(behind?' <span style="color:#f87171">\u26a0</span>':'')+'</td>' +
      '<td style="padding:10px;text-align:right;font-weight:700">'+(estH||'\u2014')+'</td>' +
      '<td style="padding:10px;text-align:right;font-weight:700;color:'+(over?'#f87171':actH>0?'#34d399':'var(--muted)')+'>'+(actH>0?actH.toFixed(1):'\u2014')+'</td>' +
      '<td style="padding:10px"><span style="background:'+sc[p.status||'not-started']+'22;color:'+sc[p.status||'not-started']+';padding:2px 8px;border-radius:999px;font-size:.75rem;font-weight:700">'+sl[p.status||'not-started']+'</span></td>';

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.innerHTML = '';
  el.appendChild(table);
}


function populatePhaseAssigneeDropdown(currentValue) {
  const sel = document.getElementById('phaseAssigned');
  if (!sel) return;
  const buildOptions = (members) => {
    let html = '<option value="">Unassigned</option>';
    let matched = false;
    Object.values(members).forEach(m => {
      const val = m.email || m.name || '';
      if (val === currentValue) matched = true;
      html += `<option value="${esc(val)}" ${val===currentValue?'selected':''}>${esc(m.name||m.email)}</option>`;
    });
    // Preserve legacy free-text values (e.g. names typed before this was a
    // dropdown) that don't match any current team member, so editing an
    // older phase never silently blanks out who it was assigned to.
    if (currentValue && !matched) {
      html += `<option value="${esc(currentValue)}" selected>${esc(currentValue)} (not on team)</option>`;
    }
    sel.innerHTML = html;
  };
  if (!conDb) { buildOptions({}); return; }
  coll('settings').doc('team').get().then(doc => {
    buildOptions(doc.exists ? extractTeamMembers(doc.data()) : {});
  }).catch(() => buildOptions({}));
}

function openAddPhaseModal() {
  document.getElementById('addPhaseModalTitle').textContent='Add Phase';
  document.getElementById('editPhaseId').value='';
  document.getElementById('phaseName').value='';
  document.getElementById('phaseTrade').value='';
  document.getElementById('phaseStart').value='';
  document.getElementById('phaseEnd').value='';
  populatePhaseAssigneeDropdown('');
  document.getElementById('phaseEstHours').value='';
  document.getElementById('phaseStatus').value='not-started';
  document.getElementById('phaseNotes').value='';
  document.getElementById('phaseColor').value='#d97706';
  document.getElementById('deletePhaseBtn').style.display='none';
  document.querySelectorAll('.phase-color-opt').forEach(e=>e.classList.remove('selected'));
  const firstOpt=document.querySelector('.phase-color-opt[data-color="#d97706"]');
  if(firstOpt) firstOpt.classList.add('selected');
  kOpen('addPhaseModal');
}

function openEditPhaseModal(phaseId) {
  const p=conPhases.find(x=>x.id===phaseId);if(!p) return;
  document.getElementById('addPhaseModalTitle').textContent='Edit Phase';
  document.getElementById('editPhaseId').value=phaseId;
  document.getElementById('phaseName').value=p.name||'';
  document.getElementById('phaseTrade').value=p.trade||'';
  document.getElementById('phaseStart').value=p.startDate||'';
  document.getElementById('phaseEnd').value=p.endDate||'';
  populatePhaseAssigneeDropdown(p.assigned||'');
  document.getElementById('phaseEstHours').value=p.estHours||'';
  document.getElementById('phaseStatus').value=p.status||'not-started';
  document.getElementById('phaseNotes').value=p.notes||'';
  document.getElementById('phaseColor').value=p.color||'#d97706';
  document.getElementById('deletePhaseBtn').style.display='inline-flex';
  document.querySelectorAll('.phase-color-opt').forEach(el=>el.classList.toggle('selected',el.dataset.color===(p.color||'#d97706')));
  kOpen('addPhaseModal');
}

function selectPhaseColor(color,el) {
  document.getElementById('phaseColor').value=color;
  document.querySelectorAll('.phase-color-opt').forEach(e=>e.classList.remove('selected'));
  if(el) el.classList.add('selected');
}

function savePhase() {
  if(!conCurrentJobId||!conDb) return;
  const name=document.getElementById('phaseName').value.trim();
  if(!name){alert('Phase name is required.');return;}
  const data={
    name,trade:document.getElementById('phaseTrade').value,
    startDate:document.getElementById('phaseStart').value,
    endDate:document.getElementById('phaseEnd').value,
    assigned:document.getElementById('phaseAssigned').value.trim(),
    estHours:parseFloat(document.getElementById('phaseEstHours').value)||0,
    status:document.getElementById('phaseStatus').value,
    notes:document.getElementById('phaseNotes').value.trim(),
    color:document.getElementById('phaseColor').value||'#d97706',
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
  };
  const editId=document.getElementById('editPhaseId').value;
  const ref=coll('jobs').doc(conCurrentJobId).collection('phases');
  if(editId){
    ref.doc(editId).update(data).then(()=>kClose('addPhaseModal')).catch(e=>alert('Error: '+e.message));
  } else {
    data.order=conPhases.length;data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    ref.add(subDoc(data)).then(()=>kClose('addPhaseModal')).catch(e=>alert('Error: '+e.message));
  }
}

function deleteCurrentPhase() {
  const editId=document.getElementById('editPhaseId').value;
  if(!editId||!conCurrentJobId) return;
  if(!confirm('Delete this phase?')) return;
  coll('jobs').doc(conCurrentJobId).collection('phases').doc(editId).delete().then(()=>kClose('addPhaseModal'));
}

function updatePhaseStatus(phaseId,status) {
  if(!conCurrentJobId||!conDb) return;
  coll('jobs').doc(conCurrentJobId).collection('phases').doc(phaseId).update({status});
}

function deletePhase(phaseId) {
  if(!confirm('Delete this phase?')) return;
  coll('jobs').doc(conCurrentJobId).collection('phases').doc(phaseId).delete();
}

window.switchPhaseView=switchPhaseView;
window.phaseDropped=phaseDropped;
window.openAddPhaseModal=openAddPhaseModal;
window.openEditPhaseModal=openEditPhaseModal;
window.selectPhaseColor=selectPhaseColor;
window.savePhase=savePhase;
window.deleteCurrentPhase=deleteCurrentPhase;
window.updatePhaseStatus=updatePhaseStatus;
window.deletePhase=deletePhase;


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
  const active = jobs.filter(j => ['In Progress','Contracted'].includes(j.status));
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
    return m < 15 && ['Work In Progress','Scheduled','Inspection Pending'].includes(j.status);
  }).length;

  // Approved CO total
  const approvedCOTotal = _jcdCOTotals ? Object.values(_jcdCOTotals).reduce((s,v)=>s+v,0) : 0;

  const kpis = [
    { label:'Total Pipeline', val:'$'+Math.round(totalContract).toLocaleString(), sub: jobs.length+' job'+(jobs.length!==1?'s':''), accent:'var(--amber)' },
    { label:'Active Jobs', val: active.length, sub: 'In Progress + Contracted', accent:'#4d8dff' },
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

  const stages = KYTRAC_STATUSES.map(s => s.name);
  let grandTotal = 0;

  strip.innerHTML = KYTRAC_STATUSES.map(s => {
    const jobs = conJobs.filter(j => j.status === s.name);
    const val = jobs.reduce((t,j) => t + getJobValue(j), 0);
    grandTotal += val;
    return `<div class="pipeline-stage" onclick="filterJCDByStatus('${s.name}')" style="cursor:pointer;border-top:3px solid ${s.color}" title="Filter to ${s.name}">
      <div class="pipeline-stage-label" style="color:${s.color}">${s.name}</div>
      <div class="pipeline-stage-val" style="color:${s.color}">${val > 0 ? '$'+Math.round(val/1000)+'K' : '—'}</div>
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
    if (!['Work In Progress','Scheduled','Inspection Pending','Approved','Design Phase','Permitting'].includes(j.status)) return;
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
  if ((newStatus === 'Closed Won' || newStatus === 'Closed Lost') &&
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
  if (tab === 'phases') { renderEpicBoard(); renderPhaseList(); }
  if (tab === 'logs') renderLogList();
  if (tab === 'invoices') loadJobInvoices(conCurrentJobId);
  if (tab === 'activity') loadJobActivity(conCurrentJobId, 'full');
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
window.savePhase = savePhase;
window.updatePhaseStatus = updatePhaseStatus;
window.deletePhase = deletePhase;
window.openAddLogModal = openAddLogModal;
window.saveLog = saveLog;
window.deleteLog = deleteLog;
window.switchConTab = switchConTab;
window.switchDetailTab = switchDetailTab;
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

function renderCOList() {
  const el = document.getElementById('coList');
  const sumEl = document.getElementById('coSummaryLine');
  if (!el) return;
  if (!conCOs.length) { el.innerHTML = '<p class="muted">No change orders yet.</p>'; if(sumEl)sumEl.textContent=''; return; }

  const approvedTotal = conCOs.filter(c => c.status === 'Approved').reduce((s, c) => s + Number(c.amount || 0), 0);
  const pendingTotal = conCOs.filter(c => c.status === 'Pending').reduce((s, c) => s + Number(c.amount || 0), 0);
  if (sumEl) sumEl.textContent = `${conCOs.length} CO${conCOs.length!==1?'s':''} · Approved: $${approvedTotal.toLocaleString()} · Pending: $${pendingTotal.toLocaleString()}`;

  el.innerHTML = conCOs.map(co => {
    const badgeClass = { Pending:'co-pending', Approved:'co-approved', Rejected:'co-rejected', Void:'co-void' }[co.status] || 'co-pending';
    const amt = Number(co.amount || 0);
    return `<div class="co-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;margin-bottom:4px">${esc(co.title || 'Untitled CO')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span class="co-badge ${badgeClass}">${co.status}</span>
            <span class="small muted">${co.date || ''}</span>
            ${co.days ? `<span class="small muted">+${co.days} day${co.days!=1?'s':''}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:800;color:${amt>=0?'var(--amber)':'#ef5350'}">${amt>=0?'+':''}$${Math.abs(amt).toLocaleString()}</div>
        </div>
      </div>
      ${co.reason ? `<div style="font-size:.84rem;color:var(--muted);margin-bottom:8px">${esc(co.reason)}</div>` : ''}
      ${co.approvedBy ? `<div class="small muted">Approved by: ${esc(co.approvedBy)}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="openEditCO('${co.id}')">Edit</button>
        ${co.status==='Pending' ? `<button class="btn btn-green" style="padding:4px 10px;font-size:.76rem" onclick="quickApproveCO('${co.id}')">✓ Approve</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openAddCOModal() {
  conEditingCOId = null;
  document.getElementById('coModalTitle').textContent = 'New Change Order';
  document.getElementById('coId').value = '';
  document.getElementById('coTitle').value = '';
  document.getElementById('coDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('coStatus').value = 'Pending';
  document.getElementById('coAmount').value = '';
  document.getElementById('coDays').value = '';
  document.getElementById('coReason').value = '';
  document.getElementById('coApprovedBy').value = '';
  document.getElementById('deleteCOBtn').style.display = 'none';
  kOpen('addCOModal');
}

function openEditCO(id) {
  const co = conCOs.find(c => c.id === id);
  if (!co) return;
  conEditingCOId = id;
  document.getElementById('coModalTitle').textContent = 'Edit Change Order';
  document.getElementById('coId').value = id;
  document.getElementById('coTitle').value = co.title || '';
  document.getElementById('coDate').value = co.date || '';
  document.getElementById('coStatus').value = co.status || 'Pending';
  document.getElementById('coAmount').value = co.amount || '';
  document.getElementById('coDays').value = co.days || '';
  document.getElementById('coReason').value = co.reason || '';
  document.getElementById('coApprovedBy').value = co.approvedBy || '';
  document.getElementById('deleteCOBtn').style.display = 'inline-flex';
  kOpen('addCOModal');
}

function saveCO() {
  if (!conCurrentJobId || !conDb) return;
  const title = document.getElementById('coTitle').value.trim();
  if (!title) { alert('Title is required.'); return; }
  const data = {
    title,
    date: document.getElementById('coDate').value,
    status: document.getElementById('coStatus').value,
    amount: parseFloat(document.getElementById('coAmount').value) || 0,
    days: parseInt(document.getElementById('coDays').value) || 0,
    reason: document.getElementById('coReason').value.trim(),
    approvedBy: document.getElementById('coApprovedBy').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
  };
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
      .then(() => { kClose('addCOModal'); switchDetailTab('changeorders', null); })
      .catch(e => alert('Error: ' + e.message));
  }
}

function deleteCO() {
  if (!conEditingCOId || !confirm('Delete this change order?')) return;
  coll('jobs').doc(conCurrentJobId).collection('changeorders').doc(conEditingCOId).delete()
    .then(() => kClose('addCOModal'))
    .catch(e => alert('Error: ' + e.message));
}

function quickApproveCO(id) {
  coll('jobs').doc(conCurrentJobId).collection('changeorders').doc(id).update({
    status: 'Approved',
    approvedBy: conCurrentUser ? conCurrentUser.displayName || conCurrentUser.email : 'Unknown',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => alert('Error: ' + e.message));
}

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
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      _logPhotoPending.push({ dataUrl: e.target.result, name: file.name });
      renderLogPhotoGrid();
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
window.quickApproveCO = quickApproveCO;
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
    conFirebaseReady = true;
    ktRevealSignIn();
    conAuth.onAuthStateChanged(user => {
      if (user) {
        conCurrentUser = user;
        resolveCompany(user, () => {
          loadUserRole(user, () => {
            conShowMain(user);
            conLoadJobs();
            setTimeout(() => loadCompanyProfile(), 800);
          });
        });
      } else {
        conCurrentUser = null;
        conShowAuthWall();
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

function renderHomeDashboard() {
  // Active jobs table — all non-closed jobs
  const tbody = document.getElementById('homeActiveJobsBody');
  if (tbody) {
    const closedStatuses = ['Closed Won','Closed Lost','Closed Hipshot Sent'];
    const active = conJobs.filter(j => !closedStatuses.includes(j.status))
      .sort((a,b) => (a.statusDate||'').localeCompare(b.statusDate||''));
    if (!active.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px;font-style:italic">No active jobs yet</td></tr>';
    } else {
      tbody.innerHTML = active.map(job => {
        const s = KYTRAC_STATUSES.find(x => x.name === job.status) || {color:'var(--amber)'};
        return `<tr onclick="openJobDetail('${job.id}')" style="cursor:pointer">
          <td><div style="font-weight:700;font-size:.86rem">${esc(job.name)}</div><div style="font-size:.72rem;color:var(--amber)">${job.jobNumber||''}</div></td>
          <td style="font-size:.84rem">${esc(job.client||'—')}</td>
          <td><span style="background:${s.color}22;color:${s.color};padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap">${job.status}</span></td>
          <td style="text-align:right;font-weight:700;color:#a3f2d2;font-size:.84rem">${getJobValue(job)?'$'+Math.round(getJobValue(job)).toLocaleString():'—'}</td>
        </tr>`;
      }).join('');
    }
  }

  // Pipeline summary — group by stage group
  const pipeline = document.getElementById('homePipelineSummary');
  if (pipeline) {
    const groups = [
      { label: 'Sales', color: '#f97316', statuses: ['New Lead','Hipshot Needed','Appointment Set','Estimating','Submitted'] },
      { label: 'Active', color: '#0d9488', statuses: ['Approved','Design Phase','Permitting','Scheduled','Work In Progress','Inspection Pending'] },
      { label: 'Finance', color: '#7c3aed', statuses: ['Invoicing','Pending Payment','Delinquent'] },
      { label: 'Closed Won', color: '#db2777', statuses: ['Closed Won'] },
      { label: 'Closed Lost', color: '#dc2626', statuses: ['Closed Lost','Closed Hipshot Sent'] },
    ];
    pipeline.innerHTML = groups.map(g => {
      const jobs = conJobs.filter(j => g.statuses.includes(j.status));
      const val = jobs.reduce((s,j) => s + getJobValue(j), 0);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(110,145,210,.07)">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0"></div>
          <span style="font-size:.82rem;font-weight:600">${g.label}</span>
        </div>
        <div style="text-align:right">
          <div style="font-size:.82rem;font-weight:700;color:${g.color}">${jobs.length} job${jobs.length!==1?'s':''}</div>
          ${val > 0 ? `<div style="font-size:.7rem;color:var(--muted)">$${Math.round(val).toLocaleString()}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // Bottom three panels
  renderNeedsAttention();
  renderRecentLogs();
  renderUpcomingPhases();
}
window.renderHomeDashboard = renderHomeDashboard;

// ── TODAY'S ACTIVITY ──
function renderNeedsAttention() {
  const el = document.getElementById('homeNeedsAttention');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const items = [];

  conJobs.forEach(job => {
    // Delinquent or Pending Payment
    if (job.status === 'Delinquent') {
      items.push({ color:'#ef5350', icon:'🔴', text: job.name, sub: 'Delinquent — needs follow-up', jobId: job.id });
    }
    if (job.status === 'Pending Payment') {
      items.push({ color:'#f3b33d', icon:'💰', text: job.name, sub: 'Pending payment', jobId: job.id });
    }
    if (job.status === 'Inspection Pending') {
      items.push({ color:'#2563eb', icon:'🔍', text: job.name, sub: 'Inspection pending', jobId: job.id });
    }
    // Jobs with no logs in 3+ days (active jobs only)
    const activeStatuses = ['Work In Progress','Scheduled','Approved','Design Phase','Permitting'];
    if (activeStatuses.includes(job.status)) {
      const lastLog = job.lastLogDate || '';
      if (!lastLog) {
        items.push({ color:'#f97316', icon:'📋', text: job.name, sub: 'No daily logs yet', jobId: job.id });
      } else {
        const daysSince = Math.floor((new Date() - new Date(lastLog)) / 86400000);
        if (daysSince >= 3) {
          items.push({ color:'#f97316', icon:'📋', text: job.name, sub: `No log in ${daysSince} days`, jobId: job.id });
        }
      }
    }
  });

  if (!items.length) {
    el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">✅ All jobs on track</div>';
    return;
  }

  el.innerHTML = items.map(i => `
    <div onclick="openJobDetail('${i.jobId}')" style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer">
      <span style="font-size:1rem;flex-shrink:0">${i.icon}</span>
      <div>
        <div style="font-size:.84rem;font-weight:700;color:#eaf0fb">${esc(i.text)}</div>
        <div style="font-size:.74rem;color:${i.color};margin-top:1px">${i.sub}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentLogs() {
  const el = document.getElementById('homeRecentLogs');
  if (!el || !conDb) return;
  
  // Try collectionGroup first (requires index), fall back to per-job fetch
  conDb.collectionGroup('logs').where('companyId','==',currentCompanyId)
    .orderBy('date', 'desc')
    .limit(8)
    .get()
    .then(snap => {
      if (snap.empty) {
        el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No daily logs yet</div>';
        return;
      }
      el.innerHTML = snap.docs.map(doc => {
        const log = doc.data();
        const jobId = doc.ref.parent.parent.id;
        const job = conJobs.find(j => j.id === jobId);
        return `<div onclick="openJobDetail('${jobId}')" style="padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
            <div style="font-size:.82rem;font-weight:700;color:var(--amber)">${esc(job ? job.name : 'Unknown Job')}</div>
            <div style="font-size:.7rem;color:var(--muted)">${log.date||''}</div>
          </div>
          <div style="font-size:.78rem;color:#eaf0fb;line-height:1.4">${esc((log.notes||'').slice(0,80))}${(log.notes||'').length>80?'…':''}</div>
          ${log.crew?`<div style="font-size:.7rem;color:var(--muted);margin-top:2px">👷 ${esc(log.crew)}</div>`:''}
          ${log.issues?`<div style="font-size:.72rem;color:#ef5350;margin-top:2px">⚠️ ${esc(log.issues.slice(0,60))}</div>`:''}
        </div>`;
      }).join('');
    })
    .catch(() => {
      // collectionGroup index not created yet — fall back to fetching logs per job
      if (!conJobs.length) {
        el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No daily logs yet</div>';
        return;
      }
      el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">Loading logs...</div>';
      const allLogs = [];
      let pending = conJobs.length;
      conJobs.forEach(job => {
        coll('jobs').doc(job.id).collection('logs')
          .orderBy('date','desc').limit(3).get()
          .then(snap => {
            snap.forEach(doc => allLogs.push({ ...doc.data(), jobId: job.id, jobName: job.name }));
          })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (pending === 0) {
              allLogs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
              const recent = allLogs.slice(0,8);
              if (!recent.length) {
                el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No daily logs yet</div>';
                return;
              }
              el.innerHTML = recent.map(log => `
                <div onclick="openJobDetail('${log.jobId}')" style="padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                    <div style="font-size:.82rem;font-weight:700;color:var(--amber)">${esc(log.jobName||'')}</div>
                    <div style="font-size:.7rem;color:var(--muted)">${log.date||''}</div>
                  </div>
                  <div style="font-size:.78rem;color:#eaf0fb;line-height:1.4">${esc((log.notes||'').slice(0,80))}${(log.notes||'').length>80?'…':''}</div>
                  ${log.crew?`<div style="font-size:.7rem;color:var(--muted);margin-top:2px">👷 ${esc(log.crew)}</div>`:''}
                  ${log.issues?`<div style="font-size:.72rem;color:#ef5350;margin-top:2px">⚠️ ${esc(log.issues.slice(0,60))}</div>`:''}
                </div>`).join('');
            }
          });
      });
    });
}

function renderUpcomingPhases() {
  const el = document.getElementById('homeUpcomingPhases');
  if (!el || !conDb) return;
  const today = new Date().toISOString().split('T')[0];
  const in7 = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];

  // Query phases across all jobs starting in next 7 days
  conDb.collectionGroup('phases').where('companyId','==',currentCompanyId)
    .orderBy('startDate')
    .startAt(today)
    .endAt(in7)
    .limit(10)
    .get()
    .then(snap => {
      if (snap.empty) {
        el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No phases in the next 7 days</div>';
        return;
      }
      el.innerHTML = snap.docs.map(doc => {
        const phase = doc.data();
        const jobId = doc.ref.parent.parent.id;
        const job = conJobs.find(j => j.id === jobId);
        const statusColors = { 'not-started':'var(--muted)', 'in-progress':'var(--amber)', 'complete':'#1dbb87' };
        const col = statusColors[phase.status] || 'var(--muted)';
        const isToday = phase.startDate === today;
        return `<div onclick="openJobDetail('${jobId}')" style="padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
            <div style="font-size:.82rem;font-weight:700;color:#eaf0fb">${esc(phase.name||'Phase')}</div>
            <div style="font-size:.7rem;font-weight:700;color:${isToday?'var(--amber)':'var(--muted)'}">${isToday?'TODAY':phase.startDate||''}</div>
          </div>
          <div style="font-size:.74rem;color:var(--amber);margin-bottom:2px">${esc(job ? job.name : '')}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:7px;height:7px;border-radius:50%;background:${col}"></div>
            <span style="font-size:.7rem;color:${col}">${phase.status||'not-started'}</span>
            ${phase.assigned?`<span style="font-size:.7rem;color:var(--muted)">· ${esc(phase.assigned)}</span>`:''}
          </div>
        </div>`;
      }).join('');
    })
    .catch(() => {
      // collectionGroup index not ready — fall back to per-job fetch
      if (!conJobs.length) { el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No upcoming phases yet</div>'; return; }
      const allPhases = [];
      let pending = conJobs.length;
      conJobs.forEach(job => {
        coll('jobs').doc(job.id).collection('phases')
          .where('startDate','>=',today).where('startDate','<=',in7).get()
          .then(snap => { snap.forEach(doc => allPhases.push({ ...doc.data(), jobId: job.id, jobName: job.name })); })
          .catch(() => {})
          .finally(() => {
            pending--;
            if (pending === 0) {
              allPhases.sort((a,b) => (a.startDate||'').localeCompare(b.startDate||''));
              if (!allPhases.length) { el.innerHTML = '<div class="small muted" style="font-style:italic;padding:10px 0;text-align:center">No phases in the next 7 days</div>'; return; }
              const statusColors = { 'not-started':'var(--muted)', 'in-progress':'var(--amber)', 'complete':'#1dbb87' };
              el.innerHTML = allPhases.map(phase => {
                const col = statusColors[phase.status] || 'var(--muted)';
                const isToday = phase.startDate === today;
                return `<div onclick="openJobDetail('${phase.jobId}')" style="padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                    <div style="font-size:.82rem;font-weight:700;color:#eaf0fb">${esc(phase.name||'Phase')}</div>
                    <div style="font-size:.7rem;font-weight:700;color:${isToday?'var(--amber)':'var(--muted)'}">${isToday?'TODAY':phase.startDate||''}</div>
                  </div>
                  <div style="font-size:.74rem;color:var(--amber)">${esc(phase.jobName||'')}</div>
                </div>`;
              }).join('');
            }
          });
      });
    });
}

window.renderNeedsAttention = renderNeedsAttention;
window.renderRecentLogs = renderRecentLogs;
window.renderUpcomingPhases = renderUpcomingPhases;
window.ktFilterJobs = ktFilterJobs;
window.conSignIn = conSignIn;
window.conSignOut = conSignOut;
window.openNewJobModal = openNewJobModal;
// (window exposures consolidated below)
window.renderJCDTable = renderJCDTable;
window.jcdSort = jcdSort;
window.filterJCDByStatus = filterJCDByStatus;
window.saveJobCostActuals = saveJobCostActuals;
window.updateJobCostActual = updateJobCostActual;
window.openJCDJobDetail = openJCDJobDetail;

// ════════════════════════════════════════════════════
// ── COST CATALOG ──
// ════════════════════════════════════════════════════
let catalogItems = [];
let catalogListener = null;

const CAT_COLORS = {
  'Labor':          '#4d8dff',
  'Materials':      '#1dbb87',
  'Subcontractor':  '#a855f7',
  'Equipment':      '#f97316',
  'Permits & Fees': '#f3b33d',
  'Overhead':       '#98a7c4',
};

function catColor(cat) { return CAT_COLORS[cat] || 'var(--amber)'; }

function loadCatalog() {
  if (!conDb) return;
  if (catalogListener) catalogListener(); // unsubscribe previous
  catalogListener = coll('catalog')
    .orderBy('category')
    .onSnapshot(snap => {
      catalogItems = [];
      snap.forEach(doc => catalogItems.push({ id: doc.id, ...doc.data() }));
      renderCatalog();
      renderCatalogStats();
    }, err => console.warn('Catalog load error:', err));
}

function renderCatalogStats() {
  const total = catalogItems.length;
  const labor = catalogItems.filter(i => i.category === 'Labor').length;
  const mats = catalogItems.filter(i => i.category === 'Materials').length;
  const subs = catalogItems.filter(i => i.category === 'Subcontractor').length;
  const el = id => document.getElementById(id);
  if(el('catStatTotal')) el('catStatTotal').textContent = total;
  if(el('catStatLabor')) el('catStatLabor').textContent = labor;
  if(el('catStatMaterials')) el('catStatMaterials').textContent = mats;
  if(el('catStatSubs')) el('catStatSubs').textContent = subs;
}

function renderCatalog() {
  const body = document.getElementById('catBody');
  if (!body) return;

  const q = (document.getElementById('catSearchInput')?.value || '').toLowerCase();
  const catFilter = document.getElementById('catCategoryFilter')?.value || '';

  let items = catalogItems;
  if (q) items = items.filter(i =>
    (i.desc||'').toLowerCase().includes(q) ||
    (i.category||'').toLowerCase().includes(q) ||
    (i.notes||'').toLowerCase().includes(q) ||
    (i.supplier||'').toLowerCase().includes(q)
  );
  if (catFilter) items = items.filter(i => i.category === catFilter);

  if (!items.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${catalogItems.length === 0 ? 'No items yet. Add your first catalog item to start building your cost library.' : 'No items match your search.'}
    </div>`;
    return;
  }

  // Group by category
  const groups = {};
  items.forEach(i => {
    if (!groups[i.category]) groups[i.category] = [];
    groups[i.category].push(i);
  });

  let html = '';
  Object.keys(groups).sort().forEach(cat => {
    const col = catColor(cat);
    html += `<div class="cat-group-header">
      <span style="color:${col}">${esc(cat)}</span>
      <span class="cat-badge" style="background:${col}18;color:${col};border-color:${col}44">${groups[cat].length} item${groups[cat].length!==1?'s':''}</span>
    </div>`;
    groups[cat].forEach(item => {
      const cost = Number(item.unitCost || 0);
      const markup = Number(item.markup || 0);
      const sellPrice = cost * (1 + markup / 100);
      const margin = sellPrice > 0 ? ((sellPrice - cost) / sellPrice * 100).toFixed(0) : 0;
      html += `<div class="cat-item" onclick="openCatalogItemModal('${item.id}')">
        <div>
          <div style="font-weight:600;color:#eaf0fb">${esc(item.desc||'')}</div>
          ${item.supplier ? `<div style="font-size:.74rem;color:var(--muted);margin-top:2px">📦 ${esc(item.supplier)}</div>` : ''}
          ${item.notes ? `<div style="font-size:.74rem;color:var(--muted);margin-top:1px">${esc(item.notes)}</div>` : ''}
        </div>
        <div><span style="background:${col}18;color:${col};border:1px solid ${col}33;border-radius:999px;padding:2px 8px;font-size:.72rem;font-weight:700">${esc(item.category||'')}</span></div>
        <div style="text-align:right;color:var(--muted);font-size:.82rem">${esc(item.unit||'ea')}</div>
        <div style="text-align:right;font-weight:700">$${cost.toFixed(2)}</div>
        <div style="text-align:right">
          ${markup > 0 ? `<span style="color:#a3f2d2;font-weight:700">$${sellPrice.toFixed(2)}</span><span style="font-size:.72rem;color:var(--muted);margin-left:4px">(+${markup}%)</span>` : '<span style="color:var(--muted)">—</span>'}
        </div>
        <div style="text-align:right">
          <button class="btn" style="padding:3px 10px;font-size:.74rem" onclick="event.stopPropagation();openCatalogItemModal('${item.id}')">Edit</button>
        </div>
      </div>`;
    });
  });

  body.innerHTML = html;
}

function openCatalogItemModal(id) {
  const item = id ? catalogItems.find(i => i.id === id) : null;
  document.getElementById('catalogModalTitle').textContent = item ? 'Edit Catalog Item' : 'Add Catalog Item';
  document.getElementById('catItemId').value = item ? item.id : '';
  document.getElementById('catItemDesc').value = item ? (item.desc||'') : '';
  document.getElementById('catItemCategory').value = item ? (item.category||'Labor') : 'Labor';
  document.getElementById('catItemUnit').value = item ? (item.unit||'ea') : 'ea';
  document.getElementById('catItemCost').value = item ? (item.unitCost||'') : '';
  document.getElementById('catItemMarkup').value = item ? (item.markup||0) : 0;
  document.getElementById('catItemNotes').value = item ? (item.notes||'') : '';
  document.getElementById('catItemSupplier').value = item ? (item.supplier||'') : '';
  document.getElementById('deleteCatItemBtn').style.display = item ? 'inline-flex' : 'none';
  calcCatPreview();
  kOpen('catalogItemModal');
}

function calcCatPreview() {
  const cost = parseFloat(document.getElementById('catItemCost')?.value) || 0;
  const markup = parseFloat(document.getElementById('catItemMarkup')?.value) || 0;
  const sell = cost * (1 + markup / 100);
  const margin = sell > 0 ? ((sell - cost) / sell * 100).toFixed(1) : 0;
  const prev = document.getElementById('catItemPreview');
  const marg = document.getElementById('catItemMargin');
  if (prev) prev.textContent = '$' + sell.toFixed(2);
  if (marg) marg.textContent = margin + '%';
}

function saveCatalogItem() {
  if (!conDb) return;
  const desc = document.getElementById('catItemDesc').value.trim();
  if (!desc) { alert('Description is required.'); return; }
  const id = document.getElementById('catItemId').value;
  const data = {
    desc,
    category: document.getElementById('catItemCategory').value,
    unit: document.getElementById('catItemUnit').value,
    unitCost: parseFloat(document.getElementById('catItemCost').value) || 0,
    markup: parseFloat(document.getElementById('catItemMarkup').value) || 0,
    notes: document.getElementById('catItemNotes').value.trim(),
    supplier: document.getElementById('catItemSupplier').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser ? conCurrentUser.email : 'unknown'
  };
  const col = coll('catalog');
  if (id) {
    col.doc(id).update(data)
      .then(() => kClose('catalogItemModal'))
      .catch(e => alert('Error: ' + e.message));
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = conCurrentUser ? conCurrentUser.email : 'unknown';
    col.add({...data, companyId: currentCompanyId})
      .then(() => kClose('catalogItemModal'))
      .catch(e => alert('Error: ' + e.message));
  }
}

function deleteCatalogItem() {
  const id = document.getElementById('catItemId').value;
  if (!id || !confirm('Delete this catalog item?')) return;
  coll('catalog').doc(id).delete()
    .then(() => kClose('catalogItemModal'))
    .catch(e => alert('Error: ' + e.message));
}

// conLoadJobs catalog patch consolidated below

// ── Allow adding catalog items directly to a job estimate ──
function addCatalogItemToEstimate(catItem) {
  if (!conCurrentJobId) { alert('Open a job first.'); return; }
  const qty = 1;
  const data = {
    desc: catItem.desc || '',
    qty,
    unit: catItem.unit || 'ea',
    costType: catItem.category || 'Materials',
    unitCost: catItem.unitCost || 0,
    markup: catItem.markup || 0,
    unitPrice: catItem.unitCost ? catItem.unitCost * (1 + (catItem.markup || 0) / 100) : 0,
    notes: catItem.notes || '',
    order: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const groupName = catItem.category || 'General';

  (async () => {
    let group = estGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) {
      const ref = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
        name: groupName, order: estGroups.length,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      group = { id: ref.id, name: groupName, order: estGroups.length, subgroups: [], directItems: [] };
      estGroups.push(group);
    }
    return coll('jobs').doc(conCurrentJobId)
      .collection('estimateGroups').doc(group.id)
      .collection('items').add(data);
  })()
    .then(() => {
      loadEstimate(conCurrentJobId);
      // Brief confirmation
      const btn = event.target;
      if (btn) { const orig = btn.textContent; btn.textContent = '✓ Added'; setTimeout(()=>btn.textContent=orig, 1500); }
    })
    .catch(e => alert('Error: ' + e.message));
}

// Expose catalog functions
window.openCatalogItemModal = openCatalogItemModal;
window.saveCatalogItem = saveCatalogItem;
window.deleteCatalogItem = deleteCatalogItem;
window.calcCatPreview = calcCatPreview;
window.renderCatalog = renderCatalog;
window.addCatalogItemToEstimate = addCatalogItemToEstimate;

// ════════════════════════════════════════════════════
// ── CUSTOMER INVOICING ──
// ════════════════════════════════════════════════════
let allInvoices = []; // [{...invoiceData, jobId, jobName, jobClient}]
let _invLineItems = []; // current modal line items
let _invListeners = {}; // per-job invoice listeners

// ── Load all invoices across all jobs ──
function loadAllInvoices() {
  if (!conDb) return;
  // Clear existing listeners
  Object.values(_invListeners).forEach(unsub => unsub());
  _invListeners = {};
  allInvoices = [];
  if (!conJobs.length) {
    renderInvoicingPage();
    return;
  }

  conJobs.forEach(job => {
    const unsub = coll('jobs').doc(job.id).collection('invoices')
      .orderBy('date', 'desc')
      .onSnapshot(snap => {
        // Remove old invoices for this job
        allInvoices = allInvoices.filter(inv => inv.jobId !== job.id);
        snap.forEach(doc => {
          allInvoices.push({ id: doc.id, jobId: job.id, jobName: job.name, jobClient: job.client || '', ...doc.data() });
        });
        renderInvoicingPage();
        // Update badge
        const overdue = allInvoices.filter(i => i.status === 'Overdue').length;
        const badge = document.getElementById('navInvoiceBadge');
        if (badge) { badge.style.display = overdue > 0 ? 'inline-flex' : 'none'; badge.textContent = overdue; }
      }, () => {});
    _invListeners[job.id] = unsub;
  });
}

// ── Render the Invoicing page ──
function renderInvoicingPage() {
  const tbody = document.getElementById('invAllBody');
  const tfoot = document.getElementById('invAllFoot');
  if (!tbody) return;

  // Populate job filter
  const jobFilter = document.getElementById('invJobFilter');
  if (jobFilter) {
    const cur = jobFilter.value;
    jobFilter.innerHTML = '<option value="">All Jobs</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.name)}</option>`).join('');
  }

  const statusFilter = document.getElementById('invStatusFilter')?.value || '';
  const jobFilterVal = jobFilter?.value || '';

  let invs = allInvoices;
  if (statusFilter) invs = invs.filter(i => i.status === statusFilter);
  if (jobFilterVal) invs = invs.filter(i => i.jobId === jobFilterVal);
  invs = [...invs].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  // KPI calcs
  const totalInvoiced = allInvoices.reduce((s,i) => s + (i.total||0), 0);
  const totalPaid = allInvoices.reduce((s,i) => s + (i.amtPaid||0), 0);
  const outstanding = totalInvoiced - totalPaid;
  const overdue = allInvoices.filter(i => i.status === 'Overdue').length;
  const setEl = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('invStatTotal', '$' + Math.round(totalInvoiced).toLocaleString());
  setEl('invStatPaid', '$' + Math.round(totalPaid).toLocaleString());
  setEl('invStatOutstanding', '$' + Math.round(outstanding).toLocaleString());
  setEl('invStatOverdue', overdue);

  if (!invs.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:28px;font-style:italic">No invoices yet. Open a job and create your first invoice.</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  tbody.innerHTML = invs.map(inv => {
    const balance = (inv.total||0) - (inv.amtPaid||0);
    const isOverdue = inv.status !== 'Paid' && inv.dueDate && inv.dueDate < today;
    const statusKey = (inv.status||'Draft').toLowerCase().replace(' ','');
    return `<tr onclick="openEditInvoice('${inv.jobId}','${inv.id}')" style="cursor:pointer">
      <td style="font-weight:700;color:var(--amber)">${esc(inv.number||'—')}</td>
      <td><div style="font-weight:600;font-size:.84rem">${esc(inv.jobName||'')}</div><div style="font-size:.72rem;color:var(--muted)">${esc(inv.jobClient||'')}</div></td>
      <td style="font-size:.84rem">${esc(inv.jobClient||'—')}</td>
      <td style="font-size:.82rem;color:var(--muted)">${esc(inv.type||'—')}</td>
      <td style="font-size:.82rem">${inv.date||'—'}</td>
      <td style="font-size:.82rem;color:${isOverdue?'#fca5a5':'inherit'}">${inv.dueDate||'—'}${isOverdue?' ⚠️':''}</td>
      <td style="text-align:right;font-weight:700">$${(inv.total||0).toLocaleString()}</td>
      <td style="text-align:right;color:#a3f2d2">$${(inv.amtPaid||0).toLocaleString()}</td>
      <td style="text-align:right;font-weight:700;color:${balance>0?'#fde68a':'#a3f2d2'}">$${balance.toLocaleString()}</td>
      <td><span class="inv-badge inv-status-${statusKey}">${inv.status||'Draft'}</span></td>
      <td><button class="btn" style="padding:3px 8px;font-size:.74rem" onclick="event.stopPropagation();openEditInvoice('${inv.jobId}','${inv.id}')">Edit</button></td>
    </tr>`;
  }).join('');

  // Footer totals
  const filtTotal = invs.reduce((s,i)=>s+(i.total||0),0);
  const filtPaid = invs.reduce((s,i)=>s+(i.amtPaid||0),0);
  const filtBal = filtTotal - filtPaid;
  if (tfoot) tfoot.innerHTML = `<tr style="background:rgba(217,119,6,.06);font-weight:800">
    <td colspan="6" style="padding:10px 12px;color:var(--amber)">TOTALS (${invs.length} invoice${invs.length!==1?'s':''})</td>
    <td style="text-align:right">$${Math.round(filtTotal).toLocaleString()}</td>
    <td style="text-align:right;color:#a3f2d2">$${Math.round(filtPaid).toLocaleString()}</td>
    <td style="text-align:right;color:${filtBal>0?'#fde68a':'#a3f2d2'}">$${Math.round(filtBal).toLocaleString()}</td>
    <td colspan="2"></td>
  </tr>`;
}

// ── Per-job invoice list (in job detail modal) ──
function loadJobInvoices(jobId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('invoices')
    .orderBy('date','desc')
    .onSnapshot(snap => {
      const invs = [];
      snap.forEach(doc => invs.push({ id: doc.id, ...doc.data() }));
      renderJobInvoiceList(jobId, invs);
    });
}

function renderJobInvoiceList(jobId, invs) {
  const el = document.getElementById('jobInvoiceList');
  const sumEl = document.getElementById('invJobSummaryLine');
  if (!el) return;

  const totalInv = invs.reduce((s,i)=>s+(i.total||0),0);
  const totalPaid = invs.reduce((s,i)=>s+(i.amtPaid||0),0);
  const balance = totalInv - totalPaid;
  if (sumEl) sumEl.textContent = `${invs.length} invoice${invs.length!==1?'s':''} · Invoiced: $${Math.round(totalInv).toLocaleString()} · Paid: $${Math.round(totalPaid).toLocaleString()} · Balance: $${Math.round(balance).toLocaleString()}`;

  if (!invs.length) {
    el.innerHTML = '<p class="muted" style="font-style:italic">No invoices yet for this job.</p>';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = invs.map(inv => {
    const bal = (inv.total||0) - (inv.amtPaid||0);
    const isOverdue = inv.status !== 'Paid' && inv.dueDate && inv.dueDate < today;
    const statusKey = (inv.status||'Draft').toLowerCase().replace(' ','');
    return `<div class="inv-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:800;color:var(--amber)">${esc(inv.number||'Draft')}</div>
          <div style="font-size:.82rem;color:var(--muted)">${esc(inv.type||'')} · ${inv.date||''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.2rem;font-weight:900;color:#eaf0fb">$${(inv.total||0).toLocaleString()}</div>
          <span class="inv-badge inv-status-${statusKey}">${inv.status||'Draft'}</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;font-size:.82rem;flex-wrap:wrap;margin-bottom:10px">
        <div><span class="muted">Due:</span> <span style="color:${isOverdue?'#fca5a5':'inherit'}">${inv.dueDate||'—'}${isOverdue?' ⚠️':''}</span></div>
        <div><span class="muted">Paid:</span> <span style="color:#a3f2d2">$${(inv.amtPaid||0).toLocaleString()}</span></div>
        <div><span class="muted">Balance:</span> <span style="font-weight:700;color:${bal>0?'#fde68a':'#a3f2d2'}">$${bal.toLocaleString()}</span></div>
        ${inv.payMethod?`<div><span class="muted">Via:</span> ${esc(inv.payMethod)}</div>`:''}
      </div>
      ${inv.notes?`<div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">${esc(inv.notes)}</div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="openEditInvoice('${jobId}','${inv.id}')">Edit</button>
        <button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="quickMarkPaid('${jobId}','${inv.id}',${inv.total||0})"${inv.status==='Paid'?' disabled':''}>✓ Mark Paid</button>
        <button class="btn" style="padding:4px 10px;font-size:.76rem" onclick="printInvoiceById('${jobId}','${inv.id}')">🖨 Print</button>
      </div>
    </div>`;
  }).join('');
}

// ── Open Add Invoice Modal ──
function openAddInvoiceModal(jobId) {
  const jid = jobId || conCurrentJobId;
  if (!jid) { alert('Open a job first.'); return; }
  const job = conJobs.find(j => j.id === jid);
  document.getElementById('invModalTitle').textContent = 'New Invoice';
  document.getElementById('invModalJobName').textContent = job ? job.name : '';
  document.getElementById('invId').value = '';
  document.getElementById('invJobId').value = jid;
  // Auto-generate invoice number
  const jobInvs = allInvoices.filter(i => i.jobId === jid);
  const nextNum = (job?.jobNumber || 'INV') + '-' + String(jobInvs.length + 1).padStart(3,'0');
  document.getElementById('invNumber').value = nextNum;
  document.getElementById('invType').value = 'Progress';
  document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
  // Default due date 30 days out
  const due = new Date(); due.setDate(due.getDate() + 30);
  document.getElementById('invDueDate').value = due.toISOString().split('T')[0];
  document.getElementById('invStatus').value = 'Draft';
  document.getElementById('invTaxRate').value = '0';
  document.getElementById('invAmtPaid').value = '';
  document.getElementById('invPaidDate').value = '';
  document.getElementById('invPayMethod').value = '';
  document.getElementById('invNotes').value = 'Payment due within 30 days. Thank you for your business!';
  document.getElementById('deleteInvBtn').style.display = 'none';
  _invLineItems = [];
  renderInvLineItems();
  calcInvTotals();
  kOpen('addInvoiceModal');
}

function openEditInvoice(jobId, invId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('invoices').doc(invId).get()
    .then(doc => {
      if (!doc.exists) return;
      const inv = doc.data();
      const job = conJobs.find(j => j.id === jobId);
      document.getElementById('invModalTitle').textContent = 'Edit Invoice';
      document.getElementById('invModalJobName').textContent = job ? job.name : '';
      document.getElementById('invId').value = invId;
      document.getElementById('invJobId').value = jobId;
      document.getElementById('invNumber').value = inv.number || '';
      document.getElementById('invType').value = inv.type || 'Progress';
      document.getElementById('invDate').value = inv.date || '';
      document.getElementById('invDueDate').value = inv.dueDate || '';
      document.getElementById('invStatus').value = inv.status || 'Draft';
      document.getElementById('invTaxRate').value = inv.taxRate || 0;
      document.getElementById('invAmtPaid').value = inv.amtPaid || '';
      document.getElementById('invPaidDate').value = inv.paidDate || '';
      document.getElementById('invPayMethod').value = inv.payMethod || '';
      document.getElementById('invNotes').value = inv.notes || '';
      document.getElementById('invPaymentLink').value = inv.paymentLink || '';
      document.getElementById('deleteInvBtn').style.display = 'inline-flex';
      _invLineItems = inv.lineItems || [];
      renderInvLineItems();
      calcInvTotals();
      kOpen('addInvoiceModal');
    });
}

// ── Line Items ──
function renderInvLineItems() {
  const body = document.getElementById('invLineItemsBody');
  if (!body) return;
  if (!_invLineItems.length) {
    body.innerHTML = `<div class="small muted" style="padding:12px 0;font-style:italic">No line items yet. Add a line or import from estimate.</div>`;
    return;
  }
  body.innerHTML = _invLineItems.map((item, i) => `
    <div class="inv-line-row" style="align-items:center">
      <input value="${esc(item.desc||'')}" style="font-size:.82rem;padding:5px 8px" placeholder="Description"
        onchange="_invLineItems[${i}].desc=this.value;calcInvTotals()" />
      <input type="number" value="${item.qty||1}" style="font-size:.82rem;padding:5px 6px;text-align:right" min="0" step="any"
        onchange="_invLineItems[${i}].qty=parseFloat(this.value)||1;calcInvTotals()" />
      <input type="number" value="${item.rate||0}" style="font-size:.82rem;padding:5px 6px;text-align:right" min="0" step="0.01"
        onchange="_invLineItems[${i}].rate=parseFloat(this.value)||0;calcInvTotals()" />
      <div style="text-align:right;font-weight:700;font-size:.84rem;color:var(--amber)">$${((item.qty||1)*(item.rate||0)).toFixed(2)}</div>
      <button onclick="_invLineItems.splice(${i},1);renderInvLineItems();calcInvTotals()" style="background:none;border:none;color:#ef5350;cursor:pointer;font-size:1rem;padding:0">✕</button>
    </div>`).join('');
}

function addInvLineItem() {
  const existing = document.getElementById('invLinePicker');
  if (existing) existing.remove();
  const picker = document.createElement('div');
  picker.id = 'invLinePicker';
  picker.style.cssText = 'position:fixed;inset:0;background:rgba(0,5,14,.78);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
  picker.innerHTML =
    '<div id="invPickerBox" style="background:rgba(6,14,28,.99);border:1px solid rgba(217,119,6,.35);border-radius:18px;padding:24px;max-width:540px;width:100%;max-height:88vh;display:flex;flex-direction:column">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div id="invPickerTitle" style="font-size:1rem;font-weight:800;color:#eaf0fb">Add Line Item</div>' +
    '<button onclick="document.getElementById(\'invLinePicker\').remove()" style="background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer;line-height:1">✕</button>' +
    '</div>' +
    '<div id="invPickerBody" style="flex:1;overflow-y:auto"></div>' +
    '<div style="border-top:1px solid rgba(110,145,210,.1);padding-top:12px;margin-top:10px">' +
    '<button onclick="window.addBlankInvLine()" style="width:100%;padding:9px;background:transparent;border:1px solid rgba(110,145,210,.15);border-radius:10px;color:var(--muted);font-size:.82rem;cursor:pointer">＋ Add blank custom line</button>' +
    '</div></div>';
  document.body.appendChild(picker);
  window._invPickerStep = 'type';
  window._invPickerType = null;
  invPickerRender();
}

function invPickerRender() {
  const body = document.getElementById('invPickerBody');
  const title = document.getElementById('invPickerTitle');
  if (!body) return;
  const step = window._invPickerStep;
  const total = getEstimateTotal();
  const fmt = v => '$' + v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

  if (step === 'type') {
    if (title) title.textContent = 'What type of invoice?';
    const types = [
      { id: '502525', icon: '💰', label: '50 / 25 / 25 Schedule', sub: 'Deposit + 2 progress payments' },
      { id: '333334', icon: '⅓', label: '1/3 Schedule', sub: 'Three equal payments' },
      { id: 'full',   icon: '✅', label: 'Full Payment', sub: 'Invoice for the full amount' },
      { id: 'custom', icon: '✏️', label: 'Custom Amount', sub: 'Enter any percentage or dollar amount' },
      { id: 'catalog',icon: '📦', label: 'Catalog Items', sub: 'Pick individual items from your cost catalog' },
      { id: 'estimate',icon:'📋', label: 'Import from Estimate', sub: 'Pull all estimate lines into this invoice' },
    ];
    body.innerHTML = types.map(t =>
      '<div onclick="window.invPickerSelectType(\'' + t.id + '\')"' +
      ' style="display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:12px;cursor:pointer;margin-bottom:8px;border:1px solid rgba(110,145,210,.12)"' +
      ' onmouseover="this.style.background=\'rgba(217,119,6,.1)\';this.style.borderColor=\'rgba(217,119,6,.3)\'"' +
      ' onmouseout="this.style.background=\'\';this.style.borderColor=\'rgba(110,145,210,.12)\'">' +
      '<div style="font-size:1.4rem;width:32px;text-align:center">' + t.icon + '</div>' +
      '<div><div style="font-size:.88rem;font-weight:700;color:#eaf0fb">' + t.label + '</div>' +
      '<div style="font-size:.74rem;color:var(--muted)">' + t.sub + '</div></div>' +
      '</div>'
    ).join('');

  } else if (step === 'payment') {
    const type = window._invPickerType;
    let payments = [];
    if (type === '502525') {
      if (title) title.textContent = 'Select Payment — 50/25/25';
      payments = [
        { pct:50, label:'Initial Deposit', sub:'50% — Due at signing' },
        { pct:25, label:'Progress Payment', sub:'25% — Due at midpoint' },
        { pct:25, label:'Final Payment',    sub:'25% — Due at completion' },
      ];
    } else if (type === '333334') {
      if (title) title.textContent = 'Select Payment — 1/3 Schedule';
      payments = [
        { pct:33.33, label:'First Payment',  sub:'1/3 — Due at signing' },
        { pct:33.33, label:'Second Payment', sub:'1/3 — Due at midpoint' },
        { pct:33.34, label:'Final Payment',  sub:'1/3 — Due at completion' },
      ];
    }
    const backBtn = '<button onclick="window._invPickerStep=\'type\';window.invPickerRender()" style="margin-bottom:14px;background:transparent;border:none;color:var(--muted);font-size:.82rem;cursor:pointer">← Back</button>';
    body.innerHTML = backBtn + payments.map(p => {
      const amt = total > 0 ? fmt(total * p.pct / 100) : p.pct + '%';
      return '<div onclick="window.pickPaymentSchedule(' + p.pct + ',\'' + p.label + '\')"' +
        ' style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-radius:12px;cursor:pointer;margin-bottom:8px;border:1px solid rgba(110,145,210,.12)"' +
        ' onmouseover="this.style.background=\'rgba(217,119,6,.1)\';this.style.borderColor=\'rgba(217,119,6,.3)\'"' +
        ' onmouseout="this.style.background=\'\';this.style.borderColor=\'rgba(110,145,210,.12)\'">' +
        '<div><div style="font-size:.9rem;font-weight:700;color:#eaf0fb">' + p.label + '</div>' +
        '<div style="font-size:.76rem;color:var(--muted)">' + p.sub + '</div></div>' +
        '<div style="font-size:1.1rem;font-weight:900;color:var(--amber)">' + amt + '</div>' +
        '</div>';
    }).join('');

  } else if (step === 'custom') {
    if (title) title.textContent = 'Custom Amount';
    const backBtn = '<button onclick="window._invPickerStep=\'type\';window.invPickerRender()" style="margin-bottom:14px;background:transparent;border:none;color:var(--muted);font-size:.82rem;cursor:pointer">← Back</button>';
    body.innerHTML = backBtn +
      '<div style="font-size:.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">By Percentage</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:18px">' +
      '<input id="invCustomPct" type="number" min="1" max="100" placeholder="%" style="width:70px;padding:10px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:8px;color:#eaf0fb;font-size:.9rem;text-align:center" oninput="window.updateCustomPayPreview()" />' +
      '<div style="color:var(--muted)">% of ' + fmt(total) + ' =</div>' +
      '<div id="invCustomPctAmt" style="font-weight:800;color:var(--amber);min-width:80px">$0.00</div>' +
      '<button onclick="window.pickCustomPct()" style="padding:10px 16px;background:var(--amber);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer">Add</button>' +
      '</div>' +
      '<div style="font-size:.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Fixed Dollar Amount</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input id="invCustomAmt" type="number" min="0" step="0.01" placeholder="$0.00" style="width:110px;padding:10px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:8px;color:#eaf0fb;font-size:.9rem" />' +
      '<input id="invCustomDesc" placeholder="Description" style="flex:1;padding:10px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:8px;color:#eaf0fb;font-size:.88rem" />' +
      '<button onclick="window.pickCustomAmt()" style="padding:10px 16px;background:var(--amber);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer">Add</button>' +
      '</div>';

  } else if (step === 'catalog') {
    if (title) title.textContent = 'Catalog Items';
    const backBtn = '<button onclick="window._invPickerStep=\'type\';window.invPickerRender()" style="margin-bottom:10px;background:transparent;border:none;color:var(--muted);font-size:.82rem;cursor:pointer">← Back</button>';
    body.innerHTML = backBtn +
      '<input id="invLinePickerSearch" placeholder="Search catalog items..." autocomplete="off"' +
      ' style="width:100%;padding:10px 14px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:10px;color:#eaf0fb;font-size:.88rem;margin-bottom:10px;box-sizing:border-box"' +
      ' oninput="window.renderInvLinePicker(this.value)" />' +
      '<div id="invLinePickerList"></div>';
    renderInvLinePicker('');
    setTimeout(() => document.getElementById('invLinePickerSearch')?.focus(), 100);
  }
}

function invPickerSelectType(typeId) {
  if (typeId === '502525' || typeId === '333334') {
    window._invPickerType = typeId;
    window._invPickerStep = 'payment';
    invPickerRender();
  } else if (typeId === 'full') {
    const total = getEstimateTotal();
    _invLineItems.push({ desc: 'Payment in Full', qty: 1, rate: total || 0 });
    renderInvLineItems();
    calcInvTotals();
    document.getElementById('invLinePicker')?.remove();
  } else if (typeId === 'custom') {
    window._invPickerStep = 'custom';
    invPickerRender();
  } else if (typeId === 'catalog') {
    window._invPickerStep = 'catalog';
    invPickerRender();
  } else if (typeId === 'estimate') {
    document.getElementById('invLinePicker')?.remove();
    importEstimateToInvoice();
  }
}

function getEstimateTotal() {
  const jobId = document.getElementById('invJobId')?.value;
  const job = conJobs.find(j => j.id === jobId);
  const contractAmt = job?.contractValue || job?.approvedOrders || 0;
  if (contractAmt > 0) return contractAmt;

  // No signed contract value yet (e.g. job still in Estimating status) —
  // fall back to the live running estimate total so deposit/percentage
  // payments have something real to calculate against.
  if (jobId === conCurrentJobId && estGroups.length) {
    let totalPrice = 0;
    estGroups.forEach(g => {
      const items = getAllItemsInGroup(g);
      totalPrice += calcGroupTotals(items).price;
    });
    return totalPrice;
  }
  return 0;
}

function updateCustomPayPreview() {
  const pct = parseFloat(document.getElementById('invCustomPct')?.value) || 0;
  const total = getEstimateTotal();
  const el = document.getElementById('invCustomPctAmt');
  if (el) el.textContent = '$' + (total * pct / 100).toFixed(2);
}

function pickPaymentSchedule(pct, desc) {
  const total = getEstimateTotal();
  const rate = total > 0 ? Math.round(total * pct / 100 * 100) / 100 : 0;
  _invLineItems.push({ desc, qty: 1, rate });
  renderInvLineItems();
  calcInvTotals();
  document.getElementById('invLinePicker')?.remove();
}

function pickCustomPct() {
  const pct = parseFloat(document.getElementById('invCustomPct')?.value) || 0;
  if (!pct) { alert('Enter a percentage.'); return; }
  const total = getEstimateTotal();
  const rate = Math.round(total * pct / 100 * 100) / 100;
  _invLineItems.push({ desc: pct + '% Payment', qty: 1, rate });
  renderInvLineItems();
  calcInvTotals();
  document.getElementById('invLinePicker')?.remove();
}

function pickCustomAmt() {
  const rate = parseFloat(document.getElementById('invCustomAmt')?.value) || 0;
  const desc = document.getElementById('invCustomDesc')?.value.trim() || 'Custom Payment';
  if (!rate) { alert('Enter an amount.'); return; }
  _invLineItems.push({ desc, qty: 1, rate });
  renderInvLineItems();
  calcInvTotals();
  document.getElementById('invLinePicker')?.remove();
}

function renderInvLinePicker(q) {
  const list = document.getElementById('invLinePickerList');
  if (!list) return;
  const val = (q || '').trim().toLowerCase();
  let items = catalogItems.filter(i => i.unitCost > 0);
  if (val) items = items.filter(i => (i.desc||'').toLowerCase().includes(val) || (i.category||'').toLowerCase().includes(val));
  if (!items.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.84rem;font-style:italic;padding:16px;text-align:center">' + (val ? 'No matches' : 'No catalog items yet') + '</div>';
    return;
  }
  const groups = {};
  items.forEach(i => { const cat = i.category||'Other'; if (!groups[cat]) groups[cat]=[]; groups[cat].push(i); });
  list.innerHTML = Object.entries(groups).map(([cat, catItems]) => {
    const itemRows = catItems.map(item => {
      const sell = (item.unitCost||0) * (1 + (item.markup||0)/100);
      return '<div onclick="window.pickInvLineItem(\'' + item.id + '\')"' +
        ' style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:8px;cursor:pointer;margin-bottom:3px;border:1px solid transparent"' +
        ' onmouseover="this.style.background=\'rgba(217,119,6,.1)\';this.style.borderColor=\'rgba(217,119,6,.2)\'"' +
        ' onmouseout="this.style.background=\'\';this.style.borderColor=\'transparent\'">' +
        '<div><div style="font-size:.85rem;font-weight:600;color:#eaf0fb">' + esc(item.desc||'') + '</div>' +
        '<div style="font-size:.73rem;color:var(--muted)">' + (item.unit||'ea') + '</div></div>' +
        '<div style="font-size:.84rem;font-weight:700;color:var(--amber)">$' + sell.toFixed(2) + '</div></div>';
    }).join('');
    return '<div style="margin-bottom:8px"><div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:4px 0 6px">' + cat + '</div>' + itemRows + '</div>';
  }).join('');
}

function pickInvLineItem(itemId) {
  const item = catalogItems.find(i => i.id === itemId);
  if (!item) return;
  const sell = (item.unitCost||0) * (1 + (item.markup||0)/100);
  _invLineItems.push({ desc: item.desc||'', qty: 1, rate: sell });
  renderInvLineItems();
  calcInvTotals();
  document.getElementById('invLinePicker')?.remove();
}

function addBlankInvLine() {
  _invLineItems.push({ desc: '', qty: 1, rate: 0 });
  renderInvLineItems();
  calcInvTotals();
  document.getElementById('invLinePicker')?.remove();
}

window.addInvLineItem = addInvLineItem;
window.invPickerRender = invPickerRender;
window.invPickerSelectType = invPickerSelectType;
window.renderInvLinePicker = renderInvLinePicker;
window.pickInvLineItem = pickInvLineItem;
window.pickPaymentSchedule = pickPaymentSchedule;
window.pickCustomPct = pickCustomPct;
window.pickCustomAmt = pickCustomAmt;
window.updateCustomPayPreview = updateCustomPayPreview;
window.addBlankInvLine = addBlankInvLine;


function calcInvTotals() {
  const subtotal = _invLineItems.reduce((s,i) => s + (i.qty||1)*(i.rate||0), 0);
  const taxRate = parseFloat(document.getElementById('invTaxRate')?.value) || 0;
  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;
  const setEl = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('invSubtotal', '$' + subtotal.toFixed(2));
  setEl('invTaxAmt', '$' + tax.toFixed(2));
  setEl('invTotal', '$' + total.toFixed(2));
  calcInvBalance();
  return total;
}

function calcInvBalance() {
  const totalEl = document.getElementById('invTotal');
  const total = totalEl ? parseFloat(totalEl.textContent.replace('$','').replace(',','')) || 0 : 0;
  const paid = parseFloat(document.getElementById('invAmtPaid')?.value) || 0;
  const balance = Math.max(0, total - paid);
  const el = document.getElementById('invBalance');
  if (el) { el.textContent = '$' + balance.toFixed(2); el.style.color = balance > 0 ? 'var(--amber)' : '#a3f2d2'; }
}

function importEstimateToInvoice() {
  const jobId = document.getElementById('invJobId')?.value;
  if (!jobId || !conDb) return;

  const jobRef = coll('jobs').doc(jobId);
  const allItems = [];

  // Walk the full groups → subgroups → items tree
  jobRef.collection('estimateGroups').orderBy('order').get()
    .then(async groupSnap => {
      for (const groupDoc of groupSnap.docs) {
        const group = groupDoc.data();

        // Direct items on group
        const directSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id).collection('items').get();
        directSnap.forEach(d => {
          const item = d.data();
          if (item.type === 'labor' || !item.unitCost) return; // skip labor lines
          const qty = item.qty || 1;
          const rate = (item.unitCost || 0) * (1 + (item.markup || 0) / 100);
          if (rate > 0) allItems.push({ desc: item.desc || item.name || group.name || '', qty, rate });
        });

        // Subgroups
        const subSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id).collection('subgroups').orderBy('order').get();
        for (const subDoc of subSnap.docs) {
          const sub = subDoc.data();
          const itemSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id)
            .collection('subgroups').doc(subDoc.id).collection('items').get();
          itemSnap.forEach(d => {
            const item = d.data();
            if (item.type === 'labor' || !item.unitCost) return; // skip labor
            const qty = item.qty || 1;
            const rate = (item.unitCost || 0) * (1 + (item.markup || 0) / 100);
            if (rate > 0) allItems.push({ desc: item.desc || item.name || sub.name || '', qty, rate });
          });
        }
      }

      if (!allItems.length) {
        alert('No estimate line items found on this job. Add items in the Estimate tab first.');
        return;
      }

      _invLineItems = [..._invLineItems, ...allItems];
      renderInvLineItems();
      calcInvTotals();
    })
    .catch(e => alert('Error importing estimate: ' + e.message));
}

// ── Save Invoice ──
function saveInvoice() {
  const jobId = document.getElementById('invJobId')?.value;
  const invId = document.getElementById('invId')?.value;
  if (!jobId || !conDb) return;

  const subtotal = _invLineItems.reduce((s,i) => s + (i.qty||1)*(i.rate||0), 0);
  const taxRate = parseFloat(document.getElementById('invTaxRate')?.value) || 0;
  const total = subtotal * (1 + taxRate/100);

  const data = {
    number: document.getElementById('invNumber').value.trim(),
    type: document.getElementById('invType').value,
    date: document.getElementById('invDate').value,
    dueDate: document.getElementById('invDueDate').value,
    status: document.getElementById('invStatus').value,
    lineItems: _invLineItems,
    subtotal,
    taxRate,
    taxAmt: subtotal * taxRate/100,
    total,
    amtPaid: parseFloat(document.getElementById('invAmtPaid').value) || 0,
    paidDate: document.getElementById('invPaidDate').value,
    payMethod: document.getElementById('invPayMethod').value,
    notes: document.getElementById('invNotes').value.trim(),
    paymentLink: document.getElementById('invPaymentLink')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser?.email || 'unknown'
  };

  // Auto-set overdue
  const today = new Date().toISOString().split('T')[0];
  if (data.status !== 'Paid' && data.dueDate && data.dueDate < today) data.status = 'Overdue';
  // Auto-set paid if full amount received
  if (data.amtPaid >= data.total && data.total > 0) data.status = 'Paid';

  const col = coll('jobs').doc(jobId).collection('invoices');
  const promise = invId ? col.doc(invId).update(data) : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: conCurrentUser?.email || 'unknown' });

  promise.then(() => {
    kClose('addInvoiceModal');
    switchDetailTab('invoices', null);
    loadAllInvoices();
  }).catch(e => alert('Error saving invoice: ' + e.message));
}

function deleteInvoice() {
  const jobId = document.getElementById('invJobId')?.value;
  const invId = document.getElementById('invId')?.value;
  if (!jobId || !invId || !confirm('Delete this invoice?')) return;
  coll('jobs').doc(jobId).collection('invoices').doc(invId).delete()
    .then(() => { kClose('addInvoiceModal'); loadAllInvoices(); });
}

function quickMarkPaid(jobId, invId, total) {
  if (!confirm('Mark this invoice as Paid in Full?')) return;
  coll('jobs').doc(jobId).collection('invoices').doc(invId).update({
    status: 'Paid',
    amtPaid: total,
    paidDate: new Date().toISOString().split('T')[0],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => alert('Error: ' + e.message));
}

// ── Print Invoice ──
function printInvoiceById(jobId, invId) {
  if (!conDb) return;
  coll('jobs').doc(jobId).collection('invoices').doc(invId).get()
    .then(doc => {
      if (!doc.exists) return;
      const inv = doc.data();
      const job = conJobs.find(j => j.id === jobId);
      printInvoiceData(inv, job);
    });
}

function printInvoice() {
  // Build from current modal state
  const jobId = document.getElementById('invJobId')?.value;
  const job = conJobs.find(j => j.id === jobId);
  const subtotal = _invLineItems.reduce((s,i) => s + (i.qty||1)*(i.rate||0), 0);
  const taxRate = parseFloat(document.getElementById('invTaxRate')?.value) || 0;
  const total = subtotal * (1 + taxRate/100);
  const inv = {
    number: document.getElementById('invNumber')?.value,
    type: document.getElementById('invType')?.value,
    date: document.getElementById('invDate')?.value,
    dueDate: document.getElementById('invDueDate')?.value,
    status: document.getElementById('invStatus')?.value,
    lineItems: _invLineItems,
    subtotal, taxRate, taxAmt: subtotal*taxRate/100, total,
    amtPaid: parseFloat(document.getElementById('invAmtPaid')?.value)||0,
    notes: document.getElementById('invNotes')?.value
  };
  printInvoiceData(inv, job);
}

// ── Patch openJobDetail to load invoices ──
const _origOpenJobDetailInv = window.openJobDetail;
window.openJobDetail = function(jobId) {
  _origOpenJobDetailInv(jobId);
  loadJobInvoices(jobId);
  loadJobDocs(jobId);
};

// ── Patch switchDetailTab to handle invoices tab ──
// switchDetailTab defined above


// invoicing nav trigger handled in base ktNav above

// ── Patch conLoadJobs to also load all invoices ──
const _origConLoadJobsInv = conLoadJobs;
function conLoadJobs() {
  if (!conDb) return;
  coll('jobs').orderBy('createdAt','desc').onSnapshot(snap => {
    conJobs = [];
    snap.forEach(doc => {
      const job = { id: doc.id, ...doc.data() };
      if (!job.archived) conJobs.push(job);
    });
    conRenderBoard();
    conRenderList();
    conRenderStats();
    conRenderSchedule();
    loadAllCOTotals();
    loadCatalog();
    loadAllInvoices();
    loadTodos();
    loadCustomers();
    loadTimeEntries();
    loadVendors();
    loadDocuments();
    loadGlobalLogs();
    loadGlobalPhases();
    loadCalendarEvents();
    loadPOs();
    loadTeamCache();
    renderHomeDashboard();
  });
}

// Expose
window.renderInvoicingPage = renderInvoicingPage;
window.openAddInvoiceModal = openAddInvoiceModal;
window.openEditInvoice = openEditInvoice;
window.saveInvoice = saveInvoice;
window.deleteInvoice = deleteInvoice;
window.quickMarkPaid = quickMarkPaid;
window.addInvLineItem = addInvLineItem;
window.calcInvTotals = calcInvTotals;
window.calcInvBalance = calcInvBalance;
window.importEstimateToInvoice = importEstimateToInvoice;
window.printInvoice = printInvoice;
window.printInvoiceById = printInvoiceById;

// ════════════════════════════════════════════════════
// ── COMPANY SETTINGS ──
// ════════════════════════════════════════════════════
let companyProfile = {};

// Default profile for Durbin Leadership Group (test tenant)
const DEFAULT_COMPANY_PROFILE = {
  companyName: 'Durbin Leadership Group',
  phone: '314-714-8277',
  email: 'travis@durbinleadershipgroup.com',
  website: 'http://5stonesleadership.com',
  address: 'St. Louis, MO',
  license: '',
  insurance: '',
  logo: '',
  payTerms: 30,
  taxRate: 0,
  invNotes: 'Payment due within 30 days. Thank you for your business!'
};

function loadCompanyProfile() {
  if (!conDb || !conCurrentUser) return;
  // Also refresh role display in case it wasn't set yet
  const roleEl = document.getElementById('ktUserRole');
  if (roleEl && currentUserRole) {
    const roleData = KYTRAC_ROLES[currentUserRole] || {};
    roleEl.textContent = currentUserRole;
    roleEl.style.color = roleData.color || 'var(--muted)';
  }
  coll('settings').doc('company').get()
    .then(doc => {
      if (doc.exists) {
        companyProfile = { ...DEFAULT_COMPANY_PROFILE, ...doc.data() };
      } else {
        // First time — save the default profile
        companyProfile = { ...DEFAULT_COMPANY_PROFILE };
        coll('settings').doc('company').set(companyProfile).catch(() => {});
      }
      populateSettingsForm();
      updateSidebarUserInfo();
    })
    .catch(() => {
      companyProfile = { ...DEFAULT_COMPANY_PROFILE };
      populateSettingsForm();
    });
}

function populateSettingsForm() {
  const p = companyProfile;
  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  setVal('settCompanyName', p.companyName);
  setVal('settPhone', p.phone);
  setVal('settEmail', p.email);
  setVal('settWebsite', p.website);
  setVal('settAddress', p.address);
  setVal('settLicense', p.license);
  setVal('settInsurance', p.insurance);
  setVal('settPayTerms', p.payTerms || 30);
  setVal('settTaxRate', p.taxRate || 0);
  setVal('settInvNotes', p.invNotes);

  // Logo
  const img = document.getElementById('logoPreviewImg');
  const empty = document.getElementById('logoPreviewEmpty');
  if (img && empty) {
    if (p.logo) { img.src = p.logo; img.style.display = 'block'; empty.style.display = 'none'; }
    else { img.style.display = 'none'; empty.style.display = 'block'; }
  }

  // User info on settings page
  if (conCurrentUser) {
    const name = conCurrentUser.displayName || conCurrentUser.email || '';
    const sName = document.getElementById('settUserName');
    const sEmail = document.getElementById('settUserEmail');
    const sImg = document.getElementById('settAvatarImg');
    const sInit = document.getElementById('settAvatarInitial');
    if (sName) sName.textContent = name;
    if (sEmail) sEmail.textContent = conCurrentUser.email || '';
    if (conCurrentUser.photoURL && sImg) {
      sImg.src = conCurrentUser.photoURL;
      sImg.style.display = 'block';
      if (sInit) sInit.style.display = 'none';
    } else if (sInit) {
      sInit.textContent = (name[0] || '?').toUpperCase();
    }
  }
}

function saveCompanyProfile() {
  if (!conDb) return;
  const profile = {
    companyName: document.getElementById('settCompanyName')?.value.trim() || '',
    phone: document.getElementById('settPhone')?.value.trim() || '',
    email: document.getElementById('settEmail')?.value.trim() || '',
    website: document.getElementById('settWebsite')?.value.trim() || '',
    address: document.getElementById('settAddress')?.value.trim() || '',
    license: document.getElementById('settLicense')?.value.trim() || '',
    insurance: document.getElementById('settInsurance')?.value.trim() || '',
    logo: companyProfile.logo || '',
    payTerms: parseInt(document.getElementById('settPayTerms')?.value) || 30,
    taxRate: parseFloat(document.getElementById('settTaxRate')?.value) || 0,
    invNotes: document.getElementById('settInvNotes')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  coll('settings').doc('company').set(profile)
    .then(() => {
      companyProfile = profile;
      // Show saved confirmation
      const msg = document.getElementById('settSavedMsg');
      if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
      // Update invoice defaults
      const invNotesEl = document.getElementById('invNotes');
      if (invNotesEl && !invNotesEl.value) invNotesEl.value = profile.invNotes;
    })
    .catch(e => alert('Error saving: ' + e.message));
}

function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // Compress logo
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 300;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png', 0.85);
      companyProfile.logo = dataUrl;
      const previewImg = document.getElementById('logoPreviewImg');
      const previewEmpty = document.getElementById('logoPreviewEmpty');
      if (previewImg) { previewImg.src = dataUrl; previewImg.style.display = 'block'; }
      if (previewEmpty) previewEmpty.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearLogo() {
  companyProfile.logo = '';
  const img = document.getElementById('logoPreviewImg');
  const empty = document.getElementById('logoPreviewEmpty');
  if (img) { img.src = ''; img.style.display = 'none'; }
  if (empty) empty.style.display = 'block';
}

// ── Update sidebar with company name ──
function updateSidebarUserInfo() {
  const companyTag = document.getElementById('ktCompanyTag');
  if (companyTag && companyProfile.companyName) {
    companyTag.textContent = companyProfile.companyName;
  }
}

// ── Patch printInvoiceData to use company profile ──
const _origPrintInvoiceData = printInvoiceData;
function printInvoiceData(inv, job) {
  const co = companyProfile;
  const win = window.open('', '_blank');
  const fmt = v => '$' + Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

  // Determine if this is a payment schedule invoice
  const isScheduled = (inv.type||'').toLowerCase().includes('deposit') ||
    (inv.lineItems||[]).some(li => /deposit|progress|final|payment/i.test(li.desc||''));

  // Project total from job
  const projectTotal = job?.contractValue || job?.approvedOrders || 0;

  // Build line rows
  const lineRows = (inv.lineItems||[]).map(item => {
    const amt = (item.qty||1) * (item.rate||0);
    const pct = projectTotal > 0 ? ' (' + Math.round(amt/projectTotal*100) + '% of project)' : '';
    return '<tr>' +
      '<td style="padding:10px 6px;border-bottom:1px solid #e5e7eb;font-size:.92rem">' + esc(item.desc||'') + '<span style="color:#9ca3af;font-size:.8rem">' + pct + '</span></td>' +
      '<td style="padding:10px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:.92rem">' + (item.qty||1) + '</td>' +
      '<td style="padding:10px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;font-size:.95rem">' + fmt(amt) + '</td>' +
      '</tr>';
  }).join('');

  const logoHtml = co.logo ? '<img src="' + co.logo + '" style="height:64px;object-fit:contain;margin-bottom:8px" /><br>' : '';

  // Project summary block for scheduled payments
  const projectSummary = projectTotal > 0 ? (
    '<div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;padding:16px;margin-bottom:24px">' +
    '<div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#92400e;margin-bottom:8px">Project Summary</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
    '<div><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Total Project Value</div><div style="font-size:1.1rem;font-weight:900;color:#1a1a1a">' + fmt(projectTotal) + '</div></div>' +
    '<div><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">This Invoice</div><div style="font-size:1.1rem;font-weight:900;color:#d97706">' + fmt(inv.total||0) + '</div></div>' +
    '<div><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Remaining Balance</div><div style="font-size:1.1rem;font-weight:900;color:#374151">' + fmt(Math.max(0, projectTotal - (inv.total||0))) + '</div></div>' +
    '</div></div>'
  ) : '';

  win.document.write('<!DOCTYPE html><html><head><title>Invoice ' + (inv.number||'') + '</title>' +
    '<style>' +
    'body{font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:740px;margin:40px auto;padding:0 28px}' +
    'table{width:100%;border-collapse:collapse}' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d97706;padding-bottom:20px;margin-bottom:24px}' +
    '.label{font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;font-weight:700}' +
    '@media print{body{margin:16px}}' +
    '</style></head><body>' +

    // Header
    '<div class="header">' +
    '<div>' + logoHtml +
    '<div style="font-size:1.4rem;font-weight:900;color:#1a1a1a">' + esc(co.companyName||'') + '</div>' +
    (co.address ? '<div style="color:#6b7280;font-size:.84rem">' + esc(co.address) + '</div>' : '') +
    (co.phone ? '<div style="color:#6b7280;font-size:.84rem">' + esc(co.phone) + '</div>' : '') +
    (co.email ? '<div style="color:#6b7280;font-size:.84rem">' + esc(co.email) + '</div>' : '') +
    (co.license ? '<div style="color:#6b7280;font-size:.76rem">License: ' + esc(co.license) + '</div>' : '') +
    '</div>' +
    '<div style="text-align:right">' +
    '<div style="font-size:1.8rem;font-weight:900;color:#d97706">INVOICE</div>' +
    '<div style="font-size:1.1rem;font-weight:800">' + esc(inv.number||'') + '</div>' +
    '<div style="margin-top:4px;background:' + (inv.status==='Paid'?'#dcfce7':inv.status==='Overdue'?'#fee2e2':'#fef9c3') + ';color:' + (inv.status==='Paid'?'#166534':inv.status==='Overdue'?'#991b1b':'#854d0e') + ';padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:800;display:inline-block">' + (inv.status||'Draft') + '</div>' +
    '</div></div>' +

    // Bill to / Invoice details
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">' +
    '<div><div class="label" style="margin-bottom:6px">Bill To</div>' +
    '<div style="font-weight:800;font-size:1.05rem">' + esc(job?.client||'') + '</div>' +
    '<div style="color:#374151;font-size:.9rem;margin-top:2px">' + esc(job?.name||'') + '</div>' +
    '<div style="color:#6b7280;font-size:.84rem">' + esc(job?.address||'') + '</div>' +
    '</div>' +
    '<div style="text-align:right">' +
    '<div style="margin-bottom:5px"><span class="label">Invoice Date: </span>' + (inv.date||'') + '</div>' +
    '<div style="margin-bottom:5px"><span class="label">Due Date: </span><strong>' + (inv.dueDate||'') + '</strong></div>' +
    '<div><span class="label">Type: </span>' + (inv.type||'') + '</div>' +
    (job?.jobNumber ? '<div style="margin-top:5px"><span class="label">Job #: </span>' + esc(job.jobNumber) + '</div>' : '') +
    '</div></div>' +

    // Project summary (for deposit/progress invoices)
    projectSummary +

    // Line items
    '<table style="margin-bottom:24px">' +
    '<thead><tr style="background:#f9fafb">' +
    '<th style="padding:10px 6px;text-align:left;font-size:.72rem;text-transform:uppercase;color:#6b7280;letter-spacing:.05em">Description</th>' +
    '<th style="padding:10px 6px;text-align:right;font-size:.72rem;text-transform:uppercase;color:#6b7280;letter-spacing:.05em">Qty</th>' +
    '<th style="padding:10px 6px;text-align:right;font-size:.72rem;text-transform:uppercase;color:#6b7280;letter-spacing:.05em">Amount</th>' +
    '</tr></thead>' +
    '<tbody>' + lineRows + '</tbody>' +
    '<tfoot>' +
    (inv.taxAmt>0 ? '<tr><td colspan="2" style="padding:8px 6px;text-align:right;color:#6b7280">Tax (' + (inv.taxRate||0) + '%)</td><td style="padding:8px 6px;text-align:right">' + fmt(inv.taxAmt) + '</td></tr>' : '') +
    '<tr style="border-top:2px solid #d97706"><td colspan="2" style="padding:12px 6px;text-align:right;font-weight:900;font-size:1.1rem">AMOUNT DUE</td><td style="padding:12px 6px;text-align:right;font-weight:900;font-size:1.2rem;color:#d97706">' + fmt(inv.total||0) + '</td></tr>' +
    ((inv.amtPaid||0)>0 ? '<tr><td colspan="2" style="padding:6px;text-align:right;color:#059669">Amount Paid</td><td style="padding:6px;text-align:right;color:#059669">-' + fmt(inv.amtPaid) + '</td></tr><tr><td colspan="2" style="padding:6px;text-align:right;font-weight:700">Balance Due</td><td style="padding:6px;text-align:right;font-weight:800;color:#d97706">' + fmt(Math.max(0,(inv.total||0)-(inv.amtPaid||0))) + '</td></tr>' : '') +
    '</tfoot></table>' +

    (inv.notes ? '<div style="background:#f9fafb;border-radius:8px;padding:14px;font-size:.85rem;color:#4b5563;margin-bottom:20px"><strong>Notes & Terms:</strong><br><br>' + esc(inv.notes) + '</div>' : '') +

    (inv.paymentLink ? 
      '<div style="text-align:center;margin:24px 0">' +
      '<a href="' + inv.paymentLink + '" style="display:inline-block;background:#d97706;color:#fff;font-size:1.1rem;font-weight:800;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:.02em">💳 Pay Now</a>' +
      '<div style="font-size:.76rem;color:#9ca3af;margin-top:8px">Click to pay securely via QuickBooks</div>' +
      '</div>' : '') +

    '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:.75rem">' +
    (co.companyName||'') + (co.phone?' · '+co.phone:'') + (co.email?' · '+co.email:'') +
    '<br>Powered by JOBSpan Construction Tracking' +
    '</div>' +
    '<script>window.print();<\/script></body></html>');
  win.document.close();
}
window.printInvoiceData = printInvoiceData;

// ── Add settings to ktNav trigger ──
// (handled in base ktNav below)

// Company profile loaded via conInitFirebase below

// Expose settings functions
window.loadCompanyProfile = loadCompanyProfile;
window.saveCompanyProfile = saveCompanyProfile;
window.handleLogoUpload = handleLogoUpload;
window.clearLogo = clearLogo;

// ════════════════════════════════════════════════════
// ── ROLE & TEAM MANAGEMENT ──
// ════════════════════════════════════════════════════

// ════════════════════════════════════════════════════
// ── MULTI-TENANCY: Company Resolution ──
// ════════════════════════════════════════════════════

function resolveCompany(user, callback) {
  const email = (user.email || '').toLowerCase();

  // 1. Check if this user owns a company
  conDb.collection('companies').where('ownerEmail', '==', email).limit(1).get()
    .then(snap => {
      if (!snap.empty) {
        // Found their company — they are the ownerEmail, so definitionally Owner
        currentCompanyId = snap.docs[0].id;
        isCompanyOwnerByEmail = true;
        console.log('JOBSpan: Loaded company', currentCompanyId);
        if (callback) callback();
        return;
      }

      // 2. Check if they're a member of a company (invited user)
      conDb.collection('companies').where('memberEmails', 'array-contains', email).limit(1).get()
        .then(snap2 => {
          if (!snap2.empty) {
            currentCompanyId = snap2.docs[0].id;
            console.log('JOBSpan: Joined company as member', currentCompanyId);
            if (callback) callback();
            return;
          }

          // 3. No company found — show onboarding to create one
          showCompanyOnboarding(user, callback);
        });
    })
    .catch(e => {
      console.error('resolveCompany error:', e);
      // Fallback for first-ever user — create company immediately
      showCompanyOnboarding(user, callback);
    });
}

function showCompanyOnboarding(user, callback) {
  // Hide auth wall, show onboarding overlay
  document.getElementById('ktAuthWall').style.display = 'none';
  document.getElementById('ktApp').style.display = 'none';

  let onboarding = document.getElementById('ktOnboarding');
  if (!onboarding) {
    onboarding = document.createElement('div');
    onboarding.id = 'ktOnboarding';
    onboarding.style.cssText = 'position:fixed;inset:0;background:#060e1e;display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px';
    onboarding.innerHTML = `
      <div style="background:rgba(8,18,36,.95);border:1px solid rgba(217,119,6,.4);border-radius:20px;padding:36px;max-width:480px;width:100%">
        <div style="font-size:1.8rem;font-weight:900;color:#f59e0b;margin-bottom:6px">Welcome to JOBSpan</div>
        <div style="color:#94a3b8;font-size:.88rem;margin-bottom:28px">Let's set up your company to get started.</div>
        <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Company Name *</label>
        <input id="onboardCompanyName" placeholder="Jason Hudson Construction" style="width:100%;padding:12px 14px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:10px;color:#eaf0fb;font-size:.95rem;margin-bottom:16px;box-sizing:border-box" />
        <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Your Name *</label>
        <input id="onboardOwnerName" placeholder="${user.displayName || ''}" value="${user.displayName || ''}" style="width:100%;padding:12px 14px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:10px;color:#eaf0fb;font-size:.95rem;margin-bottom:16px;box-sizing:border-box" />
        <label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">Phone</label>
        <input id="onboardPhone" placeholder="(314) 555-0100" style="width:100%;padding:12px 14px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:10px;color:#eaf0fb;font-size:.95rem;margin-bottom:24px;box-sizing:border-box" />
        <button onclick="createCompany('${user.email}')" style="width:100%;padding:14px;background:#d97706;border:none;border-radius:10px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer">
          Create My Company →
        </button>
        <div id="onboardError" style="color:#f87171;font-size:.82rem;margin-top:10px;display:none"></div>
      </div>
    `;
    document.body.appendChild(onboarding);
  }
  onboarding.style.display = 'flex';
  window._onboardCallback = callback;
}

function createCompany(ownerEmail) {
  const name = document.getElementById('onboardCompanyName')?.value.trim();
  const ownerName = document.getElementById('onboardOwnerName')?.value.trim();
  const phone = document.getElementById('onboardPhone')?.value.trim();
  const errEl = document.getElementById('onboardError');

  if (!name) {
    if (errEl) { errEl.textContent = 'Company name is required.'; errEl.style.display = 'block'; }
    return;
  }

  const btn = document.querySelector('#ktOnboarding button');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  const companyData = {
    name,
    ownerEmail: ownerEmail.toLowerCase(),
    ownerName: ownerName || ownerEmail,
    phone: phone || '',
    memberEmails: [ownerEmail.toLowerCase()],
    plan: 'trial',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  conDb.collection('companies').add(companyData)
    .then(ref => {
      currentCompanyId = ref.id;
      console.log('JOBSpan: Created company', currentCompanyId);

      // Also set up the settings/company doc with company profile
      return coll('settings').doc('company').set({
        companyName: name,
        phone: phone || '',
        email: ownerEmail,
        address: '',
        license: '',
        insurance: '',
        logo: '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
    .then(() => {
      const onboarding = document.getElementById('ktOnboarding');
      if (onboarding) onboarding.style.display = 'none';
      if (window._onboardCallback) window._onboardCallback();
    })
    .catch(e => {
      if (errEl) { errEl.textContent = 'Error: ' + e.message; errEl.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Create My Company →'; }
    });
}
window.createCompany = createCompany;

// Returns the team members map regardless of whether they're nested under
// `members` (current write path) or sitting at the top level of the team doc
// (legacy/imported shape). Filters out non-member metadata fields.
function extractTeamMembers(data) {
  if (!data) return {};
  if (data.members && typeof data.members === 'object') return data.members;
  // Legacy shape: members are top-level fields on the team doc. Keep only
  // entries that look like a member record (have an email or role).
  const out = {};
  Object.keys(data).forEach(k => {
    const v = data[k];
    if (v && typeof v === 'object' && (v.email || v.role)) out[k] = v;
  });
  return out;
}

function loadUserRole(user, callback) {
  if (!conDb) { currentUserRole = 'Owner'; if(callback) callback(); return; }

  const email = (user.email || '').toLowerCase();

  coll('settings').doc('team').get()
    .then(doc => {
      if (!doc.exists) {
        // First user ever — make them Owner and create team doc
        currentUserRole = 'Owner';
        currentUserTeamData = { email, name: user.displayName || email, role: 'Owner', addedAt: new Date().toISOString() };
        const teamData = {};
        teamData[email.replace(/\./g,'_')] = currentUserTeamData;
        coll('settings').doc('team').set({ members: teamData })
          .catch(() => {});
        // Immediately update role display
        const roleElFirst = document.getElementById('ktUserRole');
        if (roleElFirst) { roleElFirst.textContent = 'Owner'; roleElFirst.style.color = KYTRAC_ROLES['Owner'].color; }
      } else {
        const members = extractTeamMembers(doc.data());
        const key = email.replace(/\./g,'_');
        if (members[key]) {
          currentUserRole = members[key].role || 'Field Technician';
          currentUserTeamData = members[key];
        } else {
          // Email not in team — deny access
          conAuth.signOut();
          alert('Access denied. Contact your Owner to be added to the team.');
          return;
        }
        // The company's ownerEmail is always Owner. If a stale role says
        // otherwise, correct it in memory and persist to the team doc.
        if (isCompanyOwnerByEmail && currentUserRole !== 'Owner') {
          currentUserRole = 'Owner';
          coll('settings').doc('team').set(
            { members: { [key]: { role: 'Owner', updatedAt: new Date().toISOString() } } },
            { merge: true }
          ).catch(() => {});
        }
      }
      // Update role display
      const roleEl = document.getElementById('ktUserRole');
      if (roleEl) {
        const roleData = KYTRAC_ROLES[currentUserRole] || {};
        roleEl.textContent = currentUserRole || 'Member';
        roleEl.style.color = roleData.color || 'var(--muted)';
      }
      // Apply role-based permissions to UI
      setTimeout(applyRolePermissions, 100);
      if (callback) callback();
    })
    .catch(() => {
      // Firestore not ready yet — allow as owner for initial setup
      currentUserRole = 'Owner';
      if (callback) callback();
    });
}

// ── Team management ──
function loadTeamMembers() {
  if (!conDb) return;
  const list = document.getElementById('teamMemberList');
  const form = document.getElementById('addMemberForm');
  if (!list) return;

  // Only owners can manage team
  if (currentUserRole !== 'Owner') {
    if (form) form.style.display = 'none';
    const section = document.getElementById('teamSection');
    if (section) section.style.display = 'none';
    return;
  }

  coll('settings').doc('team').get()
    .then(doc => {
      const members = doc.exists ? extractTeamMembers(doc.data()) : {};
      const memberList = Object.values(members).sort((a,b) => {
        const la = KYTRAC_ROLES[a.role]?.level || 0;
        const lb = KYTRAC_ROLES[b.role]?.level || 0;
        return lb - la;
      });

      if (!memberList.length) {
        list.innerHTML = '<div class="small muted" style="font-style:italic">No team members yet.</div>';
        return;
      }

      list.innerHTML = memberList.map(m => {
        const roleData = KYTRAC_ROLES[m.role] || { color: 'var(--muted)' };
        const isCurrentUser = (m.email || '').toLowerCase() === (conCurrentUser?.email || '').toLowerCase();
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(110,145,210,.07);flex-wrap:wrap">
          <div style="width:36px;height:36px;border-radius:50%;background:${roleData.color}22;border:2px solid ${roleData.color};display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:800;color:${roleData.color};flex-shrink:0">
            ${(m.name||m.email||'?')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.9rem">${esc(m.name||m.email||'')}</div>
            <div style="font-size:.78rem;color:var(--muted)">${esc(m.email||'')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select onchange="updateMemberRole('${(m.email||'').replace(/\./g,'_')}',this.value)"
              style="font-size:.78rem;padding:4px 8px;background:rgba(8,19,37,.9);border:1px solid ${roleData.color}44;color:${roleData.color};border-radius:7px;font-weight:700"
              ${isCurrentUser && m.role==='Owner' ? 'title="You are the account Owner"' : ''}>
              ${Object.keys(KYTRAC_ROLES).map(r => `<option value="${r}" ${r===m.role?'selected':''}>${r}</option>`).join('')}
            </select>
            ${!isCurrentUser ? `<button class="btn btn-danger" onclick="removeMember('${(m.email||'').replace(/\./g,'_')}')" style="padding:4px 8px;font-size:.75rem">Remove</button>` : '<span class="small muted">(you)</span>'}
          </div>
        </div>`;
      }).join('');
    })
    .catch(() => {
      list.innerHTML = '<div class="small muted">Could not load team members.</div>';
    });
}

function addTeamMember() {
  if (currentUserRole !== 'Owner') { alert('Only Owners can add team members.'); return; }
  const email = (document.getElementById('newMemberEmail')?.value || '').trim().toLowerCase();
  const name = (document.getElementById('newMemberName')?.value || '').trim();
  const role = document.getElementById('newMemberRole')?.value || 'Field Technician';

  if (!email || !email.includes('@')) { alert('Enter a valid email address.'); return; }
  if (!name) { alert('Enter the team member name.'); return; }

  const key = email.replace(/\./g,'_');
  const memberData = { email, name, role, addedAt: new Date().toISOString(), addedBy: conCurrentUser?.email || '' };

  coll('settings').doc('team').set(
    { members: { [key]: memberData } },
    { merge: true }
  ).then(() => {
    document.getElementById('newMemberEmail').value = '';
    document.getElementById('newMemberName').value = '';
    loadTeamMembers();
    alert(`${name} added as ${role}. They can now sign in with ${email}.`);
  }).catch(e => alert('Error: ' + e.message));
}

function updateMemberRole(key, newRole) {
  if (currentUserRole !== 'Owner') return;
  coll('settings').doc('team').set(
    { members: { [key]: { role: newRole, updatedAt: new Date().toISOString() } } },
    { merge: true }
  ).then(() => loadTeamMembers())
   .catch(e => alert('Error: ' + e.message));
}

function removeMember(key) {
  if (currentUserRole !== 'Owner') return;
  if (!confirm('Remove this team member? They will lose access immediately.')) return;
  coll('settings').doc('team').get()
    .then(doc => {
      if (!doc.exists) return;
      const data = doc.data();
      const members = { ...extractTeamMembers(data) };
      delete members[key];
      // Write canonical nested shape.
      const payload = { members };
      // If this doc used the legacy top-level shape, null out the old
      // top-level member fields so they don't shadow the nested map.
      if (!data.members) {
        Object.keys(data).forEach(k => {
          const v = data[k];
          if (v && typeof v === 'object' && (v.email || v.role)) {
            payload[k] = firebase.firestore.FieldValue.delete();
          }
        });
      }
      return coll('settings').doc('team').update(payload);
    })
    .then(() => loadTeamMembers())
    .catch(e => alert('Error: ' + e.message));
}

// ── Apply role-based nav visibility ──
function applyRolePermissions() {
  const role = currentUserRole;
  if (!role) return;

  // Hide nav items based on role
  const canSeeCosting = hasPermission('costing') || hasPermission('invoicing');
  const canSeeInvoicing = hasPermission('invoicing');
  const canSeeCatalog = hasPermission('catalog') || hasPermission('catalog_read');
  const canSeeSettings = isOwnerOrAdmin(); // Owner or Project Manager — team mgmt inside stays Owner-only

  // Nav items
  const navItems = {
    'invoicing': canSeeInvoicing,
    'costing': canSeeCosting,
    'catalog': canSeeCatalog,
    'settings': canSeeSettings,
  };

  document.querySelectorAll('.kt-nav-item').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    Object.entries(navItems).forEach(([key, visible]) => {
      if (onclick.includes(`'${key}'`)) {
        btn.style.display = visible ? '' : 'none';
      }
    });
  });

  // Hide + New Job for read-only roles
  const canCreateJobs = hasPermission('jobs') || hasPermission('jobs_sales') || isOwnerOrAdmin();
  const newJobBtn = document.getElementById('newJobBtn');
  if (newJobBtn) newJobBtn.style.display = canCreateJobs ? 'inline-flex' : 'none';

  // Show/hide team management section
  const teamSection = document.getElementById('teamSection');
  if (teamSection) teamSection.style.display = role === 'Owner' ? 'block' : 'none';
}

// Expose team functions
window.addTeamMember = addTeamMember;
window.updateMemberRole = updateMemberRole;
window.removeMember = removeMember;
window.loadTeamMembers = loadTeamMembers;
window.applyRolePermissions = applyRolePermissions;

// ════════════════════════════════════════════════════
// ── TO-DOS ──
// ════════════════════════════════════════════════════
let allTodos = [];
let _todoFilter = 'all';

function loadTodos() {
  if (!conDb) return;
  coll('todos')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allTodos = [];
      snap.forEach(doc => allTodos.push({ id: doc.id, ...doc.data() }));
      renderTodos();
      updateTodoBadge();
      populateTodoJobFilter();
      populateTodoAssigneeFilter();
    }, () => {});
}

function updateTodoBadge() {
  const open = allTodos.filter(t => !t.done).length;
  const badge = document.getElementById('navTodoBadge');
  if (badge) {
    badge.style.display = open > 0 ? 'inline-flex' : 'none';
    badge.textContent = open;
  }
}

function populateTodoJobFilter() {
  const sel = document.getElementById('newTodoJobLink');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">No job linked</option>' +
    conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.name)}</option>`).join('');
}

function populateTodoAssigneeFilter() {
  // Load team members for assignee dropdown
  if (!conDb) return;
  coll('settings').doc('team').get().then(doc => {
    if (!doc.exists) return;
    const members = extractTeamMembers(doc.data());
    const sel = document.getElementById('newTodoAssignee');
    if (!sel) return;
    sel.innerHTML = '<option value="">Unassigned</option>' +
      Object.values(members).map(m =>
        `<option value="${esc(m.email)}">${esc(m.name||m.email)}</option>`
      ).join('');
  }).catch(() => {});
}

function filterTodos(filter, btn) {
  _todoFilter = filter;
  document.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTodos();
}

function renderTodos() {
  const el = document.getElementById('todoList');
  if (!el) return;

  const today = new Date().toISOString().split('T')[0];
  const myEmail = conCurrentUser?.email || '';

  let todos = [...allTodos];
  if (_todoFilter === 'mine') todos = todos.filter(t => t.assignee === myEmail || t.createdBy === myEmail);
  if (_todoFilter === 'open') todos = todos.filter(t => !t.done);
  if (_todoFilter === 'done') todos = todos.filter(t => t.done);
  if (_todoFilter === 'high') todos = todos.filter(t => t.priority === 'high' && !t.done);
  if (_todoFilter === 'today') todos = todos.filter(t => t.dueDate === today && !t.done);

  // Stats
  const open = allTodos.filter(t => !t.done).length;
  const done = allTodos.filter(t => t.done).length;
  const overdue = allTodos.filter(t => !t.done && t.dueDate && t.dueDate < today).length;
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('todoStatOpen', `${open} open`);
  setEl('todoStatDone', `${done} completed`);
  setEl('todoStatOverdue', overdue > 0 ? `${overdue} overdue` : '');

  if (!todos.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted);font-style:italic">
      ${_todoFilter === 'all' && !allTodos.length ? 'No to-dos yet. Add your first one above.' : 'No to-dos match this filter.'}
    </div>`;
    return;
  }

  // Sort: high priority first, then by due date, then by created
  todos.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = a.priority==='high'?0:a.priority==='med'?1:2;
    const pb = b.priority==='high'?0:b.priority==='med'?1:2;
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const priorityColors = { high:'#ef5350', med:'#f97316', normal:'var(--amber-border)' };

  el.innerHTML = todos.map(todo => {
    const pColor = priorityColors[todo.priority] || 'var(--amber-border)';
    const isOverdue = !todo.done && todo.dueDate && todo.dueDate < today;
    const linkedJob = todo.jobId ? conJobs.find(j => j.id === todo.jobId) : null;
    return `<div class="todo-item ${todo.done?'done':''}">
      <div class="todo-check ${todo.done?'checked':''} ${todo.priority!=='normal'?'todo-priority-'+todo.priority:''}"
        onclick="toggleTodo('${todo.id}',${!todo.done})" style="border-color:${pColor}${todo.done?';background:'+pColor:''}"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <span style="font-size:.88rem;font-weight:${todo.done?'400':'600'};color:${todo.done?'var(--muted)':'#eaf0fb'};${todo.done?'text-decoration:line-through':''};flex:1">${esc(todo.text||'')}</span>
          ${todo.priority==='high'?`<span style="font-size:.68rem;background:#ef535022;color:#fca5a5;border:1px solid #ef535044;border-radius:999px;padding:1px 6px;font-weight:700;flex-shrink:0">HIGH</span>`:''}
          ${todo.priority==='med'?`<span style="font-size:.68rem;background:#f9731622;color:#fed7aa;border:1px solid #f9731644;border-radius:999px;padding:1px 6px;font-weight:700;flex-shrink:0">MED</span>`:''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          ${linkedJob?`<span style="font-size:.72rem;color:var(--amber)">🔧 ${esc(linkedJob.name)}</span>`:''}
          ${todo.assignee?`<span style="font-size:.72rem;color:var(--muted)">👤 ${esc(todo.assigneeName||todo.assignee)}</span>`:''}
          ${todo.dueDate?`<span style="font-size:.72rem;color:${isOverdue?'#fca5a5':'var(--muted)'}">📅 ${todo.dueDate}${isOverdue?' ⚠️':''}</span>`:''}
          <span style="font-size:.7rem;color:rgba(110,145,210,.3)">${todo.createdByName||''}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="openEditTodo('${todo.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.9rem;padding:2px 4px">✏️</button>
        <button onclick="deleteTodo('${todo.id}')" style="background:none;border:none;color:rgba(239,83,80,.4);cursor:pointer;font-size:.9rem;padding:2px 4px">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function addTodo() {
  const input = document.getElementById('newTodoInput');
  const text = (input?.value || '').trim();
  if (!text) { input?.focus(); return; }
  if (!conDb) return;

  const assigneeEl = document.getElementById('newTodoAssignee');
  const assigneeEmail = assigneeEl?.value || '';
  const assigneeName = assigneeEl?.options[assigneeEl.selectedIndex]?.text || '';

  const data = {
    text,
    priority: document.getElementById('newTodoPriority')?.value || 'normal',
    jobId: document.getElementById('newTodoJobLink')?.value || '',
    assignee: assigneeEmail,
    assigneeName: assigneeEmail ? assigneeName : '',
    done: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
    createdByName: conCurrentUser?.displayName || conCurrentUser?.email || ''
  };

  coll('todos').add(data)
    .then(() => {
      if (input) input.value = '';
    })
    .catch(e => alert('Error: ' + e.message));
}

function toggleTodo(id, done) {
  if (!conDb) return;
  coll('todos').doc(id).update({
    done,
    completedAt: done ? firebase.firestore.FieldValue.serverTimestamp() : null,
    completedBy: done ? (conCurrentUser?.email || '') : ''
  }).catch(e => alert('Error: ' + e.message));
}

function deleteTodo(id) {
  if (!confirm('Delete this to-do?')) return;
  coll('todos').doc(id).delete().catch(e => alert('Error: ' + e.message));
}

function openEditTodo(id) {
  const todo = allTodos.find(t => t.id === id);
  if (!todo) return;
  const newText = prompt('Edit to-do:', todo.text);
  if (newText === null) return;
  const trimmed = newText.trim();
  if (!trimmed) return;
  coll('todos').doc(id).update({ text: trimmed })
    .catch(e => alert('Error: ' + e.message));
}

// ════════════════════════════════════════════════════
// ── CUSTOMERS ──
// ════════════════════════════════════════════════════
let allCustomers = [];
let _editingCustomerId = null;

function loadCustomers() {
  if (!conDb) return;
  coll('customers')
    .orderBy('name')
    .onSnapshot(snap => {
      allCustomers = [];
      snap.forEach(doc => allCustomers.push({ id: doc.id, ...doc.data() }));
      renderCustomers();
    }, () => {});
}

function renderCustomers() {
  const grid = document.getElementById('customerGrid');
  const countEl = document.getElementById('customerCount');
  if (!grid) return;

  const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  let customers = q
    ? allCustomers.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.email||'').toLowerCase().includes(q) ||
        (c.phone||'').toLowerCase().includes(q) ||
        (c.address||'').toLowerCase().includes(q)
      )
    : allCustomers;

  if (countEl) countEl.textContent = `${allCustomers.length} customer${allCustomers.length!==1?'s':''} total`;

  if (!customers.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${allCustomers.length === 0 ? 'No customers yet. Add your first customer above.' : 'No customers match your search.'}
    </div>`;
    return;
  }

  grid.innerHTML = customers.map(c => {
    const customerJobs = conJobs.filter(j => j.client === c.name || j.customerId === c.id);
    const openJobs = customerJobs.filter(j => !['Closed Won','Closed Lost'].includes(j.status));
    const jobCount = customerJobs.length;
    const initials = (c.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const jobsHtml = openJobs.slice(0,3).map(j =>
      '<div onclick="event.stopPropagation();openJobDetail(\'' + j.id + '\')" ' +
      'style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.15);border-radius:7px;margin-bottom:4px;cursor:pointer" ' +
      'onmouseover="this.style.background=\'rgba(217,119,6,.15)\'" onmouseout="this.style.background=\'rgba(217,119,6,.08)\'">' +
      '<div><div style="font-size:.8rem;font-weight:700;color:#eaf0fb">' + esc(j.name) + '</div>' +
      '<div style="font-size:.7rem;color:var(--muted)">#' + (j.jobNumber||'') + ' · ' + esc(j.status) + '</div></div>' +
      '<div style="font-size:.72rem;color:var(--amber);font-weight:700">→ Open</div></div>'
    ).join('');
    return '<div class="customer-card">' +
      '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">' +
      '<div class="customer-avatar">' + initials + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:800;font-size:.95rem;color:#eaf0fb">' + esc(c.name||'') + '</div>' +
      '<div style="font-size:.75rem;color:var(--muted);margin-top:1px">' + esc(c.type||'Homeowner') + '</div>' +
      (c.source ? '<div style="font-size:.72rem;color:rgba(110,145,210,.4);margin-top:1px">via ' + esc(c.source) + '</div>' : '') +
      '</div>' +
      (jobCount>0 ? '<span style="background:var(--amber-dim);color:var(--amber);border:1px solid var(--amber-border);border-radius:999px;padding:2px 8px;font-size:.7rem;font-weight:700;white-space:nowrap">' + jobCount + ' job' + (jobCount!==1?'s':'') + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      (c.phone ? '<div style="font-size:.82rem;display:flex;align-items:center;gap:6px"><a href="tel:' + esc(c.phone) + '" onclick="event.stopPropagation()" style="color:#a3f2d2;text-decoration:none;font-weight:600">📞 ' + esc(c.phone) + '</a><a href="sms:' + esc(c.phone) + '" onclick="event.stopPropagation()" style="background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25);border-radius:6px;padding:1px 7px;font-size:.7rem;font-weight:700;text-decoration:none">📱 Text</a></div>' : '') +
      (c.email ? '<div style="font-size:.82rem;display:flex;align-items:center;gap:6px"><span style="color:var(--muted)">✉️</span><a href="mailto:' + esc(c.email) + '" onclick="event.stopPropagation()" style="color:#eaf0fb;text-decoration:none">' + esc(c.email) + '</a></div>' : '') +
      (c.address ? '<div style="font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:6px"><span>📍</span>' + esc(c.address) + '</div>' : '') +
      (c.notes ? '<div style="font-size:.76rem;color:rgba(110,145,210,.5);margin-top:4px;font-style:italic">' + esc(c.notes.slice(0,80)) + (c.notes.length>80?'…':'') + '</div>' : '') +
      '</div>' +
      (openJobs.length > 0 ?
        '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(110,145,210,.1)">' +
        '<div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px">Open Jobs</div>' +
        jobsHtml +
        (openJobs.length > 3 ? '<div style="font-size:.74rem;color:var(--muted);padding:3px 6px">+' + (openJobs.length-3) + ' more open jobs</div>' : '') +
        '</div>' : '') +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<button onclick="event.stopPropagation();openNewJobForCustomer(\'' + c.id + '\')" style="flex:1;padding:6px;background:linear-gradient(135deg,var(--amber),var(--amber2));border:none;border-radius:8px;color:#fff;font-size:.76rem;font-weight:700;cursor:pointer">+ New Job</button>' +
      '<button onclick="event.stopPropagation();openCustomerModal(\'' + c.id + '\')" style="padding:6px 10px;background:transparent;border:1px solid rgba(110,145,210,.2);border-radius:8px;color:var(--muted);font-size:.76rem;cursor:pointer">✏️ Edit</button>' +
      '</div></div>';
  }).join('');
}

function openCustomerModal(id) {
  _editingCustomerId = id || null;
  const customer = id ? allCustomers.find(c => c.id === id) : null;
  const title = document.getElementById('customerModalTitle');
  if (title) title.textContent = customer ? 'Edit Customer' : 'Add Customer';
  document.getElementById('customerId').value = id || '';

  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
  setVal('custName', customer?.name);
  setVal('custPhone', customer?.phone);
  setVal('custEmail', customer?.email);
  setVal('custAddress', customer?.address);
  setVal('custSource', customer?.source);
  setVal('custType', customer?.type || 'Homeowner');
  setVal('custNotes', customer?.notes);

  const deleteBtn = document.getElementById('deleteCustomerBtn');
  if (deleteBtn) deleteBtn.style.display = customer ? 'inline-flex' : 'none';
  kOpen('customerModal');
}

function saveCustomer(goToNewJob) {
  if (!conDb) return;
  const name = document.getElementById('custName')?.value.trim();
  if (!name) { alert('Name is required.'); return; }
  const id = document.getElementById('customerId')?.value;

  const data = {
    name,
    phone: document.getElementById('custPhone')?.value.trim() || '',
    email: document.getElementById('custEmail')?.value.trim() || '',
    address: document.getElementById('custAddress')?.value.trim() || '',
    source: document.getElementById('custSource')?.value || '',
    type: document.getElementById('custType')?.value || 'Homeowner',
    notes: document.getElementById('custNotes')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser?.email || ''
  };

  const col = coll('customers');
  const promise = id
    ? col.doc(id).update(data)
    : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: conCurrentUser?.email || '' });

  promise.then((ref) => {
      kClose('customerModal');
      if (goToNewJob) {
        const newCustomerId = id || (ref && ref.id);
        prefillNewJobForCustomerData({ id: newCustomerId, ...data });
      }
    })
    .catch(e => alert('Error: ' + e.message));
}

function deleteCustomer() {
  const id = document.getElementById('customerId')?.value;
  if (!id || !confirm('Delete this customer?')) return;
  coll('customers').doc(id).delete()
    .then(() => kClose('customerModal'))
    .catch(e => alert('Error: ' + e.message));
}

// Expose
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.openEditTodo = openEditTodo;
window.filterTodos = filterTodos;
window.openCustomerModal = openCustomerModal;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.renderCustomers = renderCustomers;

// ════════════════════════════════════════════════════
// ── TIME TRACKING ──
// ════════════════════════════════════════════════════
let allTimeEntries = [];
let _clockedInEntry = null;
let _clockInterval = null;
let _clockStart = null;

function loadTimeEntries() {
  if (!conDb) return;
  const today = new Date().toISOString().split('T')[0];
  coll('timeentries')
    .orderBy('clockIn', 'desc')
    .limit(200)
    .onSnapshot(snap => {
      allTimeEntries = [];
      _clockedInEntry = null;
      snap.forEach(doc => {
        const entry = { id: doc.id, ...doc.data() };
        allTimeEntries.push(entry);
        // Check if current user is clocked in
        if (!entry.clockOut && entry.userId === conCurrentUser?.uid) {
          _clockedInEntry = entry;
        }
      });
      updateClockUI();
      renderTimeLog();
      renderTodaySummary();
      updateTimeBadge();
      populateTimeFilters();
    }, () => {});
}

function updateTimeBadge() {
  const badge = document.getElementById('navTimeBadge');
  if (badge) badge.style.display = _clockedInEntry ? 'inline-flex' : 'none';
}

function handleClockToggle() {
  if (_clockedInEntry) {
    clockOut();
  } else {
    clockIn();
  }
}

function clockIn() {
  const jobId = document.getElementById('clockJobSelect')?.value || '';
  if (!jobId) { alert('Please select a job first.'); return; }
  if (!conDb || !conCurrentUser) return;

  const job = conJobs.find(j => j.id === jobId);
  const phaseId = document.getElementById('clockPhaseSelect')?.value || '';
  const phase = phaseId ? conPhases.find(p => p.id === phaseId) : null;
  const now = new Date();

  const entry = {
    userId: conCurrentUser.uid,
    userEmail: conCurrentUser.email || '',
    userName: conCurrentUser.displayName || conCurrentUser.email || '',
    jobId,
    jobName: job?.name || '',
    phaseId: phaseId || '',
    phaseName: phase?.name || '',
    clockIn: firebase.firestore.FieldValue.serverTimestamp(),
    clockInISO: now.toISOString(),
    clockOut: null,
    notes: document.getElementById('clockNotes')?.value.trim() || '',
    date: now.toISOString().split('T')[0],
    hours: null,
    companyId: currentCompanyId,
  };

  coll('timeentries').add(entry)
    .then(() => { _clockStart = now; startClockTicker(); })
    .catch(e => alert('Error clocking in: ' + e.message));
}

function clockOut() {
  if (!_clockedInEntry || !conDb) return;
  const now = new Date();
  const clockInTime = _clockedInEntry.clockInISO ? new Date(_clockedInEntry.clockInISO) : new Date(now - 3600000);
  const hours = Math.round((now - clockInTime) / 3600000 * 100) / 100;

  coll('timeentries').doc(_clockedInEntry.id).update({
    clockOut: firebase.firestore.FieldValue.serverTimestamp(),
    clockOutISO: now.toISOString(),
    hours,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    stopClockTicker();
    const notes = document.getElementById('clockNotes');
    if (notes) notes.value = '';
  }).catch(e => alert('Error clocking out: ' + e.message));
}

// ── Phase selectors for time entry ──
async function loadClockPhases(jobId) {
  const sel = document.getElementById('clockPhaseSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">No phase selected</option>';
  if (!jobId) return;

  try {
    const snap = await coll('jobs').doc(jobId).collection('phases').get();
    const phases = [];
    snap.forEach(d => phases.push({ id: d.id, ...d.data() }));
    // Sort by order/status — active phases first
    phases.sort((a,b) => {
      const order = {'in-progress':0,'not-started':1,'blocked':2,'complete':3};
      return (order[a.status]||1) - (order[b.status]||1);
    });
    phases.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const statusLabel = p.status === 'in-progress' ? '🔵' : p.status === 'complete' ? '✅' : p.status === 'blocked' ? '🚫' : '⬜';
      opt.textContent = statusLabel + ' ' + p.name + (p.assigned ? ' — ' + p.assigned : '');
      sel.appendChild(opt);
    });
  } catch(e) {}
}

async function loadManualPhases(jobId) {
  const sel = document.getElementById('manualPhaseSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">No phase</option>';
  if (!jobId) return;
  try {
    const snap = await coll('jobs').doc(jobId).collection('phases').get();
    snap.forEach(d => {
      const p = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = p.name + (p.trade ? ' (' + p.trade + ')' : '');
      sel.appendChild(opt);
    });
  } catch(e) {}
}

function saveManualTimeEntry() {
  const jobId = document.getElementById('manualJobSelect')?.value;
  const hours = parseFloat(document.getElementById('manualHours')?.value);
  const date = document.getElementById('manualDate')?.value;
  if (!jobId || !hours || !date) { alert('Job, hours, and date are required.'); return; }

  const phaseId = document.getElementById('manualPhaseSelect')?.value || '';
  const crew = document.getElementById('manualCrew')?.value.trim();
  const notes = document.getElementById('manualNotes')?.value.trim();
  const job = conJobs.find(j => j.id === jobId);
  const phase = phaseId ? { id: phaseId } : null;

  const entry = {
    userId: crew ? '' : (conCurrentUser?.uid || ''),
    userEmail: crew ? '' : (conCurrentUser?.email || ''),
    userName: crew || conCurrentUser?.displayName || conCurrentUser?.email || '',
    jobId,
    jobName: job?.name || '',
    phaseId,
    phaseName: '',
    date,
    hours,
    notes: notes || '',
    manual: true,
    companyId: currentCompanyId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
  };

  // Get phase name
  if (phaseId) {
    coll('jobs').doc(jobId).collection('phases').doc(phaseId).get().then(d => {
      if (d.exists) entry.phaseName = d.data().name || '';
      return coll('timeentries').add(entry);
    }).then(() => {
      document.getElementById('manualHours').value = '';
      document.getElementById('manualNotes').value = '';
      document.getElementById('manualCrew').value = '';
      alert('✅ ' + hours + 'h logged' + (entry.phaseName ? ' to ' + entry.phaseName : ''));
    }).catch(e => alert('Error: ' + e.message));
  } else {
    coll('timeentries').add(entry).then(() => {
      document.getElementById('manualHours').value = '';
      document.getElementById('manualNotes').value = '';
      document.getElementById('manualCrew').value = '';
      alert('✅ ' + hours + 'h logged');
    }).catch(e => alert('Error: ' + e.message));
  }
}

window.loadClockPhases = loadClockPhases;
window.loadManualPhases = loadManualPhases;
window.saveManualTimeEntry = saveManualTimeEntry;

function startClockTicker() {
  if (_clockInterval) clearInterval(_clockInterval);
  _clockInterval = setInterval(updateClockTicker, 1000);
  updateClockTicker();
}

function stopClockTicker() {
  if (_clockInterval) clearInterval(_clockInterval);
  _clockInterval = null;
}

function updateClockTicker() {
  if (!_clockedInEntry || !_clockStart) return;
  const elapsed = Math.floor((Date.now() - _clockStart.getTime()) / 1000);
  const h = Math.floor(elapsed / 3600).toString().padStart(2,'0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2,'0');
  const s = (elapsed % 60).toString().padStart(2,'0');
  const ticker = document.getElementById('clockTicker');
  if (ticker) ticker.textContent = `${h}:${m}:${s}`;
}

function updateClockUI() {
  const btn = document.getElementById('clockBtn');
  const btnIcon = document.getElementById('clockBtnIcon');
  const btnLabel = document.getElementById('clockBtnLabel');
  const statusLabel = document.getElementById('clockStatusLabel');
  const ticker = document.getElementById('clockTicker');

  if (_clockedInEntry) {
    if (btn) { btn.className = 'clock-btn clock-btn-out'; }
    if (btnIcon) btnIcon.textContent = '■';
    if (btnLabel) btnLabel.textContent = 'Clock Out';
    if (statusLabel) statusLabel.innerHTML = `<span class="clocked-in-badge">● CLOCKED IN</span> — ${esc(_clockedInEntry.jobName||'')}`;
    // Start ticker from clockInISO
    _clockStart = _clockedInEntry.clockInISO ? new Date(_clockedInEntry.clockInISO) : new Date();
    startClockTicker();
    // Pre-select job
    const jobSel = document.getElementById('clockJobSelect');
    if (jobSel && _clockedInEntry.jobId) jobSel.value = _clockedInEntry.jobId;
  } else {
    if (btn) { btn.className = 'clock-btn clock-btn-in'; }
    if (btnIcon) btnIcon.textContent = '▶';
    if (btnLabel) btnLabel.textContent = 'Clock In';
    if (statusLabel) statusLabel.textContent = 'Not clocked in';
    if (ticker) ticker.textContent = '00:00:00';
    stopClockTicker();
  }
}

function renderTodaySummary() {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = allTimeEntries.filter(e => e.date === today);
  const myEntries = todayEntries.filter(e => e.userId === conCurrentUser?.uid);
  const myHours = myEntries.reduce((s,e) => s + (e.hours||0), 0);
  const teamOnSite = [...new Set(todayEntries.filter(e => !e.clockOut).map(e => e.userId))].length;

  const dateEl = document.getElementById('timeTodayDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});

  const hoursEl = document.getElementById('timeTodayHours');
  if (hoursEl) hoursEl.textContent = myHours.toFixed(1) + 'h';

  const teamEl = document.getElementById('timeTodayTeam');
  if (teamEl) teamEl.textContent = teamOnSite;

  const listEl = document.getElementById('todayTimeEntries');
  if (listEl) {
    if (!todayEntries.length) {
      listEl.innerHTML = '<div class="small muted" style="font-style:italic">No time entries today yet.</div>';
      return;
    }
    listEl.innerHTML = todayEntries.map(e => {
      const inTime = e.clockInISO ? new Date(e.clockInISO).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) : '—';
      const outTime = e.clockOutISO ? new Date(e.clockOutISO).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) : null;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07);font-size:.82rem">
        <div>
          <div style="font-weight:700">${esc(e.userName||e.userEmail||'')}</div>
          <div style="color:var(--amber);font-size:.76rem">${esc(e.jobName||'')}</div>
        </div>
        <div style="text-align:right">
          ${outTime
            ? `<div style="font-weight:700;color:#a3f2d2">${e.hours?.toFixed(1)||'0.0'}h</div><div style="font-size:.72rem;color:var(--muted)">${inTime} – ${outTime}</div>`
            : `<span class="clocked-in-badge">● Live</span><div style="font-size:.72rem;color:var(--muted);margin-top:2px">In: ${inTime}</div>`
          }
        </div>
      </div>`;
    }).join('');
  }
}

function populateTimeFilters() {
  const activeStatuses = ['Work In Progress','Scheduled','Approved','Design Phase','Permitting','In Progress','Contracted'];
  const activeJobs = conJobs.filter(j => activeStatuses.includes(j.status));

  const jobSel = document.getElementById('clockJobSelect');
  if (jobSel) {
    const cur = jobSel.value;
    jobSel.innerHTML = '<option value="">Select a job...</option>' +
      activeJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.jobNumber?'#'+j.jobNumber+' ':'')}${esc(j.name)}</option>`).join('');
  }

  // Manual entry job selector
  const manualJobSel = document.getElementById('manualJobSelect');
  if (manualJobSel) {
    const cur = manualJobSel.value;
    manualJobSel.innerHTML = '<option value="">Select job...</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.jobNumber?'#'+j.jobNumber+' ':'')}${esc(j.name)}</option>`).join('');
  }

  // Set today's date on manual entry
  const manualDate = document.getElementById('manualDate');
  if (manualDate && !manualDate.value) manualDate.value = new Date().toISOString().split('T')[0];

  const filterJobSel = document.getElementById('timeFilterJob');
  if (filterJobSel) {
    const cur2 = filterJobSel.value;
    filterJobSel.innerHTML = '<option value="">All Jobs</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===cur2?'selected':''}>${esc(j.name)}</option>`).join('');
  }
}

function renderTimeLog() {
  const tbody = document.getElementById('timeLogBody');
  const tfoot = document.getElementById('timeLogFoot');
  const totalEl = document.getElementById('timeLogTotal');
  if (!tbody) return;

  const jobFilter = document.getElementById('timeFilterJob')?.value || '';
  const userFilter = document.getElementById('timeFilterUser')?.value || '';

  let entries = allTimeEntries;
  if (jobFilter) entries = entries.filter(e => e.jobId === jobFilter);
  if (userFilter) entries = entries.filter(e => e.userId === userFilter || e.userEmail === userFilter);

  const totalHours = entries.filter(e => e.hours).reduce((s,e) => s + e.hours, 0);
  if (totalEl) totalEl.textContent = `${entries.length} entries · ${totalHours.toFixed(1)}h total`;

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-style:italic">No time entries yet.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const inTime = e.clockInISO ? new Date(e.clockInISO).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) : '—';
    const outTime = e.clockOutISO ? new Date(e.clockOutISO).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) : null;
    return `<tr>
      <td><div style="font-weight:600">${esc(e.userName||'')}</div><div style="font-size:.72rem;color:var(--muted)">${esc(e.userEmail||'')}</div></td>
      <td style="font-size:.82rem;color:var(--amber)">${esc(e.jobName||'—')}</td>
      <td style="font-size:.78rem;color:#60a5fa">${e.phaseName ? '⚡ '+esc(e.phaseName) : '<span style="color:var(--muted)">—</span>'}</td>
      <td style="font-size:.82rem">${e.date||'—'}</td>
      <td style="font-size:.82rem">${inTime}</td>
      <td style="font-size:.82rem">${outTime || '<span class="clocked-in-badge" style="font-size:.68rem">● Live</span>'}</td>
      <td style="text-align:right;font-weight:700;color:${e.hours?'#a3f2d2':'var(--muted)'}">
        ${e.hours ? e.hours.toFixed(2)+'h' : '—'}
      </td>
      <td style="font-size:.78rem;color:var(--muted)">${esc(e.notes||'')}</td>
      <td>
        ${!e.clockOut && e.userId===conCurrentUser?.uid
          ? `<button class="btn btn-danger" onclick="forceClockOut('${e.id}')" style="padding:3px 8px;font-size:.74rem">Clock Out</button>`
          : `<button class="btn" onclick="deleteTimeEntry('${e.id}')" style="padding:3px 8px;font-size:.74rem">✕</button>`}
      </td>
    </tr>`;
  }).join('');

  if (tfoot) tfoot.innerHTML = `<tr style="background:rgba(217,119,6,.06);font-weight:800">
    <td colspan="6" style="padding:10px 12px;color:var(--amber)">TOTAL (${entries.filter(e=>e.hours).length} entries)</td>
    <td style="text-align:right;color:#a3f2d2">${totalHours.toFixed(2)}h</td>
    <td colspan="2"></td>
  </tr>`;
}

function forceClockOut(entryId) {
  const entry = allTimeEntries.find(e => e.id === entryId);
  if (!entry) return;
  const now = new Date();
  const clockInTime = entry.clockInISO ? new Date(entry.clockInISO) : new Date(now - 3600000);
  const hours = Math.round((now - clockInTime) / 3600000 * 100) / 100;
  coll('timeentries').doc(entryId).update({
    clockOut: firebase.firestore.FieldValue.serverTimestamp(),
    clockOutISO: now.toISOString(),
    hours
  }).catch(e => alert('Error: ' + e.message));
}

function deleteTimeEntry(id) {
  if (!confirm('Delete this time entry?')) return;
  coll('timeentries').doc(id).delete().catch(e => alert('Error: ' + e.message));
}

// ════════════════════════════════════════════════════
// ── CALENDAR ──
// ════════════════════════════════════════════════════
let _calDate = new Date();
let _calView = 'month';

function switchCalView(view, btn) {
  _calView = view;
  document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('calMonthView').style.display = view === 'month' ? 'block' : 'none';
  document.getElementById('calWeekView').style.display = view === 'week' ? 'block' : 'none';
  renderCalendar();
}

function calNav(dir) {
  if (_calView === 'month') {
    _calDate = new Date(_calDate.getFullYear(), _calDate.getMonth() + dir, 1);
  } else {
    _calDate = new Date(_calDate.getTime() + dir * 7 * 86400000);
  }
  renderCalendar();
}

function calGoToday() {
  _calDate = new Date();
  renderCalendar();
  // In week view, scroll to current time after render
  if (_calView === 'week') {
    setTimeout(() => {
      const scrollTarget = document.querySelector('#calWeekView div[style*="overflow-y"]');
      if (scrollTarget) scrollTarget.scrollTop = (new Date().getHours() - 6) * 48;
    }, 100);
  }
}

function renderCalendar() {
  const titleEl = document.getElementById('calTitle');
  if (_calView === 'month') {
    if (titleEl) titleEl.textContent = _calDate.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    renderMonthView();
  } else {
    // Get start of week (Sunday)
    const dow = _calDate.getDay();
    const weekStart = new Date(_calDate.getTime() - dow * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    if (titleEl) titleEl.textContent =
      weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ' – ' +
      weekEnd.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    renderWeekView(weekStart);
  }
}

function renderMonthView() {
  const grid = document.getElementById('calMonthGrid');
  if (!grid) return;
  const today = new Date().toISOString().split('T')[0];
  const year = _calDate.getFullYear();
  const month = _calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let cells = '';
  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateISO === today;
    const events = getCalEvents(dateISO);
    const evHtml = events.slice(0,3).map(ev =>
      `<div class="cal-event" style="background:${ev.color}22;color:${ev.color};border-left:2px solid ${ev.color}">${esc(ev.label)}</div>`
    ).join('') + (events.length > 3 ? `<div style="font-size:.6rem;color:var(--muted)">+${events.length-3} more</div>` : '');
    cells += `<div class="cal-day${isToday?' today':''}">
      <div class="cal-day-num">${d}</div>
      ${evHtml}
    </div>`;
  }
  // Next month fill
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }
  grid.innerHTML = cells;
}

function renderWeekView(weekStart) {
  const header = document.getElementById('calWeekHeader');
  const grid = document.getElementById('calWeekGrid');
  if (!header || !grid) return;
  const today = new Date().toISOString().split('T')[0];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build week day dates
  const weekDays = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart.getTime() + i * 86400000);
    return { d, iso: d.toISOString().split('T')[0], isToday: d.toISOString().split('T')[0] === today };
  });

  // Header row with day names + dates
  header.innerHTML = '<div style="padding:8px 4px;font-size:.7rem;color:var(--muted);border-bottom:1px solid rgba(110,145,210,.1)"></div>' +
    weekDays.map(({d, iso, isToday}) => {
      // Count events for badge
      const evCount = window.getCalEvents(iso).length;
      return `<div style="text-align:center;padding:8px 4px;font-size:.78rem;font-weight:700;color:${isToday?'var(--amber)':'var(--muted)'};border-bottom:1px solid rgba(110,145,210,.1)">
        ${days[d.getDay()]}<br>
        <span style="font-size:1.1rem;color:${isToday?'var(--amber)':'#eaf0fb'};${isToday?'background:var(--amber);color:#000;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;':''}">${d.getDate()}</span>
        ${evCount>0?`<div style="font-size:.65rem;color:var(--amber);margin-top:2px">${evCount} event${evCount>1?'s':''}</div>`:''}
      </div>`;
    }).join('');

  // All-day events row (phases, todos without time)
  const allDayRow = '<div style="font-size:.65rem;color:var(--muted);padding:4px;text-align:right;border-bottom:1px solid rgba(110,145,210,.1)">all-day</div>' +
    weekDays.map(({iso}) => {
      const allDay = window.getCalEvents(iso).filter(e => e.type === 'phase' || (e.type === 'todo') || (e.type === 'event' && !e.ev?.time));
      return `<div style="padding:2px;border-bottom:1px solid rgba(110,145,210,.1);min-height:28px">
        ${allDay.map(e => `<span class="cal-event-pill" style="background:${e.color}20;color:${e.color};border-left-color:${e.color};font-size:.62rem" title="${e.label}">${e.label.slice(0,20)}${e.label.length>20?'…':''}</span>`).join('')}
      </div>`;
    }).join('');

  // Hour rows 6am-9pm
  let rows = '';
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  for (let h = 6; h <= 21; h++) {
    const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
    rows += `<div class="cal-week-hour" style="font-size:.68rem;color:var(--muted);text-align:right;padding-right:8px;padding-top:6px;border-top:1px solid rgba(110,145,210,.06)">${label}</div>`;

    weekDays.forEach(({d, iso, isToday}) => {
      // Get timed events for this hour
      const timedEvents = window.getCalEvents(iso).filter(e => {
        if (e.type === 'event' && e.ev?.time) {
          const evH = parseInt(e.ev.time.split(':')[0]);
          return evH === h;
        }
        if (e.type === 'time') {
          const entry = allTimeEntries.find(t => t.id === e.id);
          if (entry?.clockInISO) {
            return new Date(entry.clockInISO).getHours() === h;
          }
        }
        return false;
      });

      const isCurrentHour = isToday && h === currentHour;
      const timeBarPos = isCurrentHour ? Math.round((currentMin / 60) * 100) : -1;

      rows += `<div style="border-top:1px solid rgba(110,145,210,.06);min-height:48px;padding:2px;position:relative;background:${isToday?'rgba(217,119,6,.03)':'transparent'}">
        ${timeBarPos >= 0 ? `<div style="position:absolute;left:0;right:0;top:${timeBarPos}%;height:2px;background:var(--amber);z-index:2;opacity:.7"></div>` : ''}
        ${timedEvents.map(e => `<span class="cal-event-pill" style="background:${e.color}20;color:${e.color};border-left-color:${e.color};font-size:.68rem;cursor:pointer" onclick="${e.type==='event'?`openCalEventModal('${e.id}')`:''}">
          ${e.label.slice(0,22)}${e.label.length>22?'…':''}
          ${e.ev?.meetLink?`<a href="${e.ev.meetLink}" target="_blank" onclick="event.stopPropagation()" style="color:#fff;font-size:.6rem;background:#0d9488;border-radius:3px;padding:0 3px;margin-left:2px;text-decoration:none">🎥 Join</a>`:''}
        </span>`).join('')}
      </div>`;
    });
  }

  grid.innerHTML = allDayRow + rows;

  // Scroll to current hour (or 8am default)
  const scrollTarget = document.querySelector('#calWeekView div[style*="overflow-y"]');
  if (scrollTarget) {
    const targetHour = today >= weekDays[0].iso && today <= weekDays[6].iso ? Math.max(6, currentHour - 1) : 8;
    scrollTarget.scrollTop = (targetHour - 6) * 48;
  }
}

// Expose time + calendar functions
window.handleClockToggle = handleClockToggle;
window.forceClockOut = forceClockOut;
window.deleteTimeEntry = deleteTimeEntry;
window.renderTimeLog = renderTimeLog;
window.switchCalView = switchCalView;
window.calNav = calNav;
window.calGoToday = calGoToday;
window.renderCalendar = renderCalendar;

// ════════════════════════════════════════════════════
// ── VENDORS & SUBCONTRACTORS ──
// ════════════════════════════════════════════════════
let allVendors = [];
let _currentVendorId = null;
let _editingBillId = null;
let _vendorBills = []; // bills for current vendor detail view

function loadVendors() {
  if (!conDb) return;
  coll('vendors').orderBy('name').onSnapshot(snap => {
    allVendors = [];
    snap.forEach(doc => allVendors.push({ id: doc.id, ...doc.data() }));
    renderVendors();
    updateVendorBadge();
  }, () => {});
}

function updateVendorBadge() {
  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
  const expiring = allVendors.filter(v => v.insExp && v.insExp <= in30).length;
  const badge = document.getElementById('navVendorBadge');
  if (badge) { badge.style.display = expiring > 0 ? 'inline-flex' : 'none'; badge.textContent = expiring; }
}

function renderVendors() {
  const grid = document.getElementById('vendorGrid');
  const countEl = document.getElementById('vendorCount');
  if (!grid) return;

  const q = (document.getElementById('vendorSearch')?.value || '').toLowerCase();
  const tradeFilter = document.getElementById('vendorTradeFilter')?.value || '';
  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];

  let vendors = allVendors;
  if (q) vendors = vendors.filter(v =>
    (v.name||'').toLowerCase().includes(q) ||
    (v.trade||'').toLowerCase().includes(q) ||
    (v.contact||'').toLowerCase().includes(q) ||
    (v.email||'').toLowerCase().includes(q)
  );
  if (tradeFilter) vendors = vendors.filter(v => v.trade === tradeFilter);

  // Stats
  const activeOnJobs = new Set(conJobs.flatMap(j => j.subIds||[])).size;
  const insWarn = allVendors.filter(v => v.insExp && v.insExp <= in30 && v.insExp >= today).length;
  const insExpired = allVendors.filter(v => v.insExp && v.insExp < today).length;
  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl('vendorStatTotal', allVendors.length);
  setEl('vendorStatActive', conJobs.filter(j=>['Work In Progress','Scheduled'].includes(j.status)).length + ' jobs active');
  setEl('vendorStatInsWarn', insWarn + (insExpired > 0 ? ` (+${insExpired} expired)` : ''));

  if (countEl) countEl.textContent = `${allVendors.length} vendor${allVendors.length!==1?'s':''} total`;

  if (!vendors.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${allVendors.length===0 ? 'No vendors yet. Add your first vendor or subcontractor above.' : 'No vendors match your search.'}
    </div>`;
    return;
  }

  grid.innerHTML = vendors.map(v => {
    const insExpired = v.insExp && v.insExp < today;
    const insWarn = v.insExp && !insExpired && v.insExp <= in30;
    const insClass = insExpired ? 'ins-expired' : insWarn ? 'ins-warn' : 'ins-ok';
    const insLabel = insExpired ? '⚠️ INS EXPIRED' : insWarn ? '⚠️ Ins expiring' : v.insExp ? '✓ Insured' : '';
    const statusColors = { Active:'#1dbb87', Preferred:'#f59e0b', 'On Hold':'#ef5350', Inactive:'#6b7280' };
    const sColor = statusColors[v.status||'Active'] || '#1dbb87';
    // Jobs linked to this vendor
    const linkedJobs = conJobs.filter(j => (j.vendorIds||[]).includes(v.id)).length;
    const initials = (v.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();

    return `<div class="vendor-card" onclick="openVendorDetail('${v.id}')">
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
        <div class="vendor-avatar">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:.95rem;color:#eaf0fb">${esc(v.name||'')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
            <span class="vendor-trade-badge">${esc(v.trade||'')}</span>
            <span style="font-size:.7rem;font-weight:700;color:${sColor}">${v.status||'Active'}</span>
          </div>
        </div>
        ${linkedJobs > 0 ? `<span style="background:var(--amber-dim);color:var(--amber);border:1px solid var(--amber-border);border-radius:999px;padding:2px 8px;font-size:.7rem;font-weight:700;white-space:nowrap">${linkedJobs} job${linkedJobs!==1?'s':''}</span>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${v.contact ? `<div style="font-size:.82rem;color:var(--muted)">👤 ${esc(v.contact)}</div>` : ''}
        ${v.phone ? `<div style="font-size:.82rem;display:flex;align-items:center;gap:6px">
          <a href="tel:${esc(v.phone)}" onclick="event.stopPropagation()" style="color:#a3f2d2;text-decoration:none;font-weight:600">📞 ${esc(v.phone)}</a>
          <a href="sms:${esc(v.phone)}" onclick="event.stopPropagation()" style="background:rgba(59,130,246,.15);color:#93c5fd;border:1px solid rgba(59,130,246,.25);border-radius:6px;padding:1px 7px;font-size:.7rem;font-weight:700;text-decoration:none">📱 Text</a>
        </div>` : ''}
        ${v.email ? `<div style="font-size:.82rem"><a href="mailto:${esc(v.email)}" onclick="event.stopPropagation()" style="color:#eaf0fb;text-decoration:none">✉️ ${esc(v.email)}</a></div>` : ''}
        ${v.insExp ? `<div style="font-size:.76rem;margin-top:4px" class="${insClass}">${insLabel}: ${v.insExp}</div>` : ''}
        ${v.payTerms ? `<div style="font-size:.74rem;color:rgba(110,145,210,.4)">Terms: ${esc(v.payTerms)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Vendor Detail Modal ──
function openVendorDetail(id) {
  const v = allVendors.find(x => x.id === id);
  if (!v) return;
  _currentVendorId = id;
  const modal = document.getElementById('vendorDetailModal');
  if (modal) modal.dataset.vendorId = id;

  const today = new Date().toISOString().split('T')[0];
  const insExpired = v.insExp && v.insExp < today;
  const insWarn = v.insExp && !insExpired && v.insExp <= new Date(Date.now()+30*86400000).toISOString().split('T')[0];

  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v || '—'; };
  setEl('vdName', v.name);
  setEl('vdContact', v.contact);
  setEl('vdPhone', v.phone);
  setEl('vdEmail', v.email);
  setEl('vdLicense', v.license);
  setEl('vdPayTerms', v.payTerms);
  setEl('vdRate', v.rate ? `$${v.rate}/hr` : '—');
  setEl('vdAddress', v.address);
  setEl('vdNotes', v.notes);

  const tradeEl = document.getElementById('vdTrade');
  if (tradeEl) tradeEl.textContent = v.trade || '';

  const statusEl = document.getElementById('vdStatus');
  const statusColors = { Active:'#1dbb87', Preferred:'#f59e0b', 'On Hold':'#ef5350', Inactive:'#6b7280' };
  if (statusEl) { statusEl.textContent = v.status||'Active'; statusEl.style.color = statusColors[v.status||'Active']; }

  const insEl = document.getElementById('vdInsExp');
  if (insEl) {
    insEl.textContent = v.insExp || '—';
    insEl.className = insExpired ? 'ins-expired' : insWarn ? 'ins-warn' : '';
  }

  // Jobs tab
  const jobListEl = document.getElementById('vdJobList');
  if (jobListEl) {
    const linked = conJobs.filter(j => (j.vendorIds||[]).includes(id) || j.client === v.name);
    if (!linked.length) {
      jobListEl.innerHTML = '<p class="muted" style="font-style:italic">No jobs linked to this vendor yet.</p>';
    } else {
      jobListEl.innerHTML = linked.map(j => {
        const s = KYTRAC_STATUSES.find(x => x.name === j.status) || {color:'var(--amber)'};
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(110,145,210,.07);cursor:pointer" onclick="kClose('vendorDetailModal');openJobDetail('${j.id}')">
          <div><div style="font-weight:700">${esc(j.name)}</div><div style="font-size:.76rem;color:var(--amber)">${esc(j.jobNumber||'')}</div></div>
          <span style="background:${s.color}22;color:${s.color};padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700">${j.status}</span>
        </div>`;
      }).join('');
    }
  }

  switchVendorTab('info', document.querySelector('#vendorDetailModal .con-subtab'));
  loadVendorBills(id);
  kOpen('vendorDetailModal');
}

function switchVendorTab(tab, btn) {
  ['info','jobs','bills'].forEach(t => {
    const el = document.getElementById('vdTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#vendorDetailModal .con-subtab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const btns = document.querySelectorAll('#vendorDetailModal .con-subtab');
    const idx = ['info','jobs','bills'].indexOf(tab);
    if (btns[idx]) btns[idx].classList.add('active');
  }
}

// ── Vendor CRUD ──
function openVendorModal(id) {
  const v = id ? allVendors.find(x => x.id === id) : null;
  document.getElementById('vendorModalTitle').textContent = v ? 'Edit Vendor' : 'Add Vendor';
  document.getElementById('vendorId').value = id || '';
  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
  setVal('vendorName', v?.name); setVal('vendorContact', v?.contact);
  setVal('vendorPhone', v?.phone); setVal('vendorEmail', v?.email);
  setVal('vendorWebsite', v?.website); setVal('vendorLicense', v?.license);
  setVal('vendorInsExp', v?.insExp); setVal('vendorAddress', v?.address);
  setVal('vendorNotes', v?.notes); setVal('vendorRate', v?.rate);
  document.getElementById('vendorTrade').value = v?.trade || 'General Labor';
  document.getElementById('vendorStatus').value = v?.status || 'Active';
  document.getElementById('vendorPayTerms').value = v?.payTerms || 'Net 30';
  document.getElementById('deleteVendorBtn').style.display = v ? 'inline-flex' : 'none';
  if (id) kClose('vendorDetailModal');
  kOpen('vendorModal');
}

function saveVendor() {
  const name = document.getElementById('vendorName')?.value.trim();
  if (!name) { alert('Company name is required.'); return; }
  const id = document.getElementById('vendorId')?.value;
  const data = {
    name, trade: document.getElementById('vendorTrade')?.value,
    status: document.getElementById('vendorStatus')?.value,
    contact: document.getElementById('vendorContact')?.value.trim() || '',
    phone: document.getElementById('vendorPhone')?.value.trim() || '',
    email: document.getElementById('vendorEmail')?.value.trim() || '',
    website: document.getElementById('vendorWebsite')?.value.trim() || '',
    license: document.getElementById('vendorLicense')?.value.trim() || '',
    insExp: document.getElementById('vendorInsExp')?.value || '',
    payTerms: document.getElementById('vendorPayTerms')?.value || 'Net 30',
    rate: parseFloat(document.getElementById('vendorRate')?.value) || 0,
    address: document.getElementById('vendorAddress')?.value.trim() || '',
    notes: document.getElementById('vendorNotes')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const col = coll('vendors');
  const promise = id ? col.doc(id).update(data)
    : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: conCurrentUser?.email||'' });
  promise.then(() => kClose('vendorModal')).catch(e => alert('Error: ' + e.message));
}

function deleteVendor() {
  const id = document.getElementById('vendorId')?.value;
  if (!id || !confirm('Delete this vendor?')) return;
  coll('vendors').doc(id).delete()
    .then(() => { kClose('vendorModal'); kClose('vendorDetailModal'); })
    .catch(e => alert('Error: ' + e.message));
}

// ── Bills / AP ──
function loadVendorBills(vendorId) {
  if (!conDb) return;
  coll('vendors').doc(vendorId).collection('bills')
    .orderBy('billDate', 'desc').get()
    .then(snap => {
      _vendorBills = [];
      snap.forEach(doc => _vendorBills.push({ id: doc.id, ...doc.data() }));
      renderVendorBills();
    }).catch(() => { _vendorBills = []; renderVendorBills(); });
}

function renderVendorBills() {
  const el = document.getElementById('vdBillList');
  const sumEl = document.getElementById('vdBillsSummary');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const totalAmt = _vendorBills.reduce((s,b) => s + (b.amount||0), 0);
  const totalPaid = _vendorBills.reduce((s,b) => s + (b.amtPaid||0), 0);
  const outstanding = totalAmt - totalPaid;
  if (sumEl) sumEl.textContent = `${_vendorBills.length} bill${_vendorBills.length!==1?'s':''} · Total: $${Math.round(totalAmt).toLocaleString()} · Paid: $${Math.round(totalPaid).toLocaleString()} · Owed: $${Math.round(outstanding).toLocaleString()}`;

  // Update stat
  const statEl = document.getElementById('vendorStatBillsOwed');
  if (statEl) statEl.textContent = '$' + Math.round(outstanding).toLocaleString();

  if (!_vendorBills.length) { el.innerHTML = '<p class="muted" style="font-style:italic;padding:12px 0">No bills yet.</p>'; return; }

  el.innerHTML = _vendorBills.map(b => {
    const bal = (b.amount||0) - (b.amtPaid||0);
    const isOverdue = b.status !== 'Paid' && b.dueDate && b.dueDate < today;
    const statusColors = { Unpaid:'#f59e0b', Partial:'#f97316', Paid:'#1dbb87', Overdue:'#ef5350' };
    const sColor = statusColors[b.status||'Unpaid'] || '#f59e0b';
    const job = conJobs.find(j => j.id === b.jobId);
    return `<div class="bill-row" onclick="openAddBillModal('${b.id}')" style="cursor:pointer">
      <div><div style="font-weight:600;font-size:.84rem">${esc(b.desc||'')}</div>${b.notes?`<div style="font-size:.72rem;color:var(--muted)">${esc(b.notes)}</div>`:''}</div>
      <div style="font-size:.78rem;color:var(--amber)">${esc(job?.name||'—')}</div>
      <div style="text-align:right;font-weight:700">$${(b.amount||0).toLocaleString()}</div>
      <div style="text-align:right;color:#a3f2d2">$${(b.amtPaid||0).toLocaleString()}</div>
      <div style="font-size:.78rem;color:${isOverdue?'#fca5a5':'var(--muted)'}">${b.dueDate||'—'}${isOverdue?' ⚠️':''}</div>
      <div><span style="font-size:.72rem;font-weight:700;color:${sColor}">${b.status||'Unpaid'}</span></div>
    </div>`;
  }).join('');
}

function openAddBillModal(billId) {
  const bill = billId ? _vendorBills.find(b => b.id === billId) : null;
  _editingBillId = billId || null;
  document.getElementById('billId').value = billId || '';
  document.getElementById('billVendorId').value = _currentVendorId || '';
  const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  setVal('billDesc', bill?.desc);
  setVal('billJobId', bill?.jobId);
  setVal('billDate', bill?.billDate || new Date().toISOString().split('T')[0]);
  setVal('billDueDate', bill?.dueDate);
  setVal('billAmount', bill?.amount);
  setVal('billAmtPaid', bill?.amtPaid);
  setVal('billNotes', bill?.notes);
  document.getElementById('billStatus').value = bill?.status || 'Unpaid';
  document.getElementById('deleteBillBtn').style.display = bill ? 'inline-flex' : 'none';
  // Populate job dropdown
  const jobSel = document.getElementById('billJobId');
  if (jobSel) {
    jobSel.innerHTML = '<option value="">No job linked</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===(bill?.jobId||'')?'selected':''}>${esc(j.name)}</option>`).join('');
  }
  kOpen('addBillModal');
}

function saveBill() {
  const vendorId = document.getElementById('billVendorId')?.value;
  const desc = document.getElementById('billDesc')?.value.trim();
  if (!desc) { alert('Description is required.'); return; }
  if (!vendorId) { alert('No vendor selected.'); return; }
  const billId = document.getElementById('billId')?.value;
  const amount = parseFloat(document.getElementById('billAmount')?.value) || 0;
  const amtPaid = parseFloat(document.getElementById('billAmtPaid')?.value) || 0;
  let status = document.getElementById('billStatus')?.value || 'Unpaid';
  if (amtPaid >= amount && amount > 0) status = 'Paid';
  const today = new Date().toISOString().split('T')[0];
  const dueDate = document.getElementById('billDueDate')?.value || '';
  if (status !== 'Paid' && dueDate && dueDate < today) status = 'Overdue';
  const data = {
    desc, amount, amtPaid, status, dueDate,
    billDate: document.getElementById('billDate')?.value || today,
    jobId: document.getElementById('billJobId')?.value || '',
    notes: document.getElementById('billNotes')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const col = coll('vendors').doc(vendorId).collection('bills');
  const promise = billId ? col.doc(billId).update(data)
    : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  promise.then(() => { kClose('addBillModal'); loadVendorBills(vendorId); })
    .catch(e => alert('Error: ' + e.message));
}

function deleteBill() {
  const vendorId = document.getElementById('billVendorId')?.value;
  const billId = document.getElementById('billId')?.value;
  if (!vendorId || !billId || !confirm('Delete this bill?')) return;
  coll('vendors').doc(vendorId).collection('bills').doc(billId).delete()
    .then(() => { kClose('addBillModal'); loadVendorBills(vendorId); })
    .catch(e => alert('Error: ' + e.message));
}

// ── Connect vendor picker to job subs tab ──
// When user clicks "+ Add Sub" on a job, show vendor directory first
function openAddSubFromVendor() {
  // Show a quick-pick modal from vendor directory
  if (!allVendors.length) { openAddSubModal(); return; }
  const vendor = allVendors[0]; // placeholder — full picker built separately
  openAddSubModal();
}

// Expose
window.openVendorDetail = openVendorDetail;
window.openVendorModal = openVendorModal;
window.saveVendor = saveVendor;
window.deleteVendor = deleteVendor;
window.switchVendorTab = switchVendorTab;
window.openAddBillModal = openAddBillModal;
window.saveBill = saveBill;
window.deleteBill = deleteBill;
window.renderVendors = renderVendors;

// ════════════════════════════════════════════════════
// ── DOCUMENTS ──
// ════════════════════════════════════════════════════
// Documents are stored as base64 in Firestore (small files <1MB)
// or as metadata with download links for larger files
// For now: compress images, store PDFs/docs as base64 up to 500KB
let allDocuments = [];
const DOC_SIZE_LIMIT = 500 * 1024; // 500KB limit per file

const DOC_ICONS = {
  pdf: { icon: '📄', class: 'doc-icon-pdf' },
  jpg: { icon: '🖼', class: 'doc-icon-img' },
  jpeg: { icon: '🖼', class: 'doc-icon-img' },
  png: { icon: '🖼', class: 'doc-icon-img' },
  gif: { icon: '🖼', class: 'doc-icon-img' },
  doc: { icon: '📝', class: 'doc-icon-doc' },
  docx: { icon: '📝', class: 'doc-icon-doc' },
  xls: { icon: '📊', class: 'doc-icon-xls' },
  xlsx: { icon: '📊', class: 'doc-icon-xls' },
  csv: { icon: '📊', class: 'doc-icon-xls' },
};

function getDocIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return DOC_ICONS[ext] || { icon: '📁', class: 'doc-icon-other' };
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function loadDocuments() {
  if (!conDb) return;
  coll('documents')
    .orderBy('uploadedAt', 'desc')
    .onSnapshot(snap => {
      allDocuments = [];
      snap.forEach(doc => allDocuments.push({ id: doc.id, ...doc.data() }));
      renderDocuments();
      renderDocStats();
    }, () => {});
}

function renderDocStats() {
  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('docStatTotal', allDocuments.length);
  setEl('docStatContracts', allDocuments.filter(d => d.category === 'Contract').length);
  setEl('docStatPermits', allDocuments.filter(d => d.category === 'Permit').length);
  const latest = allDocuments[0];
  setEl('docStatRecent', latest?.uploadedDate || '—');
}

function populateDocJobFilter() {
  const sel = document.getElementById('docJobFilter');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Jobs</option>' +
    conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.name)}</option>`).join('');
}

function renderDocuments() {
  const el = document.getElementById('docList');
  const countEl = document.getElementById('docCount');
  if (!el) return;

  const q = (document.getElementById('docSearch')?.value || '').toLowerCase();
  const jobFilter = document.getElementById('docJobFilter')?.value || '';
  const catFilter = document.getElementById('docCategoryFilter')?.value || '';

  let docs = allDocuments;
  if (q) docs = docs.filter(d =>
    (d.name||'').toLowerCase().includes(q) ||
    (d.category||'').toLowerCase().includes(q) ||
    (d.jobName||'').toLowerCase().includes(q) ||
    (d.notes||'').toLowerCase().includes(q)
  );
  if (jobFilter) docs = docs.filter(d => d.jobId === jobFilter);
  if (catFilter) docs = docs.filter(d => d.category === catFilter);

  if (countEl) countEl.textContent = `${allDocuments.length} file${allDocuments.length!==1?'s':''} total`;

  if (!docs.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${allDocuments.length===0 ? 'No documents yet. Upload your first file above.' : 'No documents match your search.'}
    </div>`;
    return;
  }

  // Group by job
  const grouped = {};
  docs.forEach(d => {
    const key = d.jobId ? (d.jobName || d.jobId) : 'General';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  el.innerHTML = Object.entries(grouped).map(([group, groupDocs]) => `
    <div style="margin-bottom:16px">
      <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--amber);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--amber-border)">${esc(group)}</div>
      ${groupDocs.map(d => renderDocCard(d)).join('')}
    </div>
  `).join('');
}

function renderDocCard(d) {
  const { icon, class: iconClass } = getDocIcon(d.name);
  const catColors = {
    Contract: '#3b82f6', Permit: '#10b981', 'Plans & Drawings': '#8b5cf6',
    Inspection: '#f59e0b', Insurance: '#ef5350', Invoice: '#d97706',
    'Change Order': '#f97316', Photo: '#06b6d4', Other: '#6b7280'
  };
  const catColor = catColors[d.category] || 'var(--muted)';

  return `<div class="doc-card" onclick="openDocument('${d.id}')">
    <div class="doc-icon ${iconClass}">${icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name||'Unnamed')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:3px;align-items:center">
        ${d.category ? `<span style="font-size:.68rem;font-weight:700;color:${catColor};background:${catColor}18;border:1px solid ${catColor}33;border-radius:999px;padding:1px 7px">${esc(d.category)}</span>` : ''}
        <span style="font-size:.72rem;color:var(--muted)">${formatFileSize(d.size)}</span>
        <span style="font-size:.72rem;color:var(--muted)">${d.uploadedDate||''}</span>
        ${d.uploadedByName ? `<span style="font-size:.7rem;color:rgba(110,145,210,.4)">${esc(d.uploadedByName)}</span>` : ''}
      </div>
      ${d.notes ? `<div style="font-size:.76rem;color:var(--muted);margin-top:3px;font-style:italic">${esc(d.notes.slice(0,60))}${d.notes.length>60?'…':''}</div>` : ''}
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button onclick="event.stopPropagation();downloadDoc('${d.id}')" class="btn" style="padding:4px 8px;font-size:.75rem" title="Download">⬇</button>
      <button onclick="event.stopPropagation();deleteDoc('${d.id}')" class="btn btn-danger" style="padding:4px 8px;font-size:.75rem" title="Delete">✕</button>
    </div>
  </div>`;
}

// ── Per-job document list ──
function renderJobDocList(docs) {
  const el = document.getElementById('jobDocList');
  const countEl = document.getElementById('jobDocCount');
  if (!el) return;
  if (countEl) countEl.textContent = docs?.length ? `${docs.length} file${docs.length!==1?'s':''}` : '';
  if (!docs || !docs.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-style:italic">No files uploaded for this job yet.<br><br>Use the Upload File button above or the Documents page.</div>';
    return;
  }
  el.innerHTML = docs.map(d => renderDocCard(d)).join('');
}

function loadJobDocs(jobId) {
  if (!jobId) return;
  // First render from in-memory cache immediately
  const cached = allDocuments.filter(d => d.jobId === jobId);
  renderJobDocList(cached);
  // Then refresh from Firestore if available
  if (!conDb) return;
  coll('documents')
    .where('jobId','==',jobId)
    .orderBy('uploadedAt','desc')
    .get()
    .then(snap => {
      const docs = [];
      snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
      renderJobDocList(docs);
    })
    .catch(() => {
      // orderBy may need index - fall back to unordered
      coll('documents').where('jobId','==',jobId).get()
        .then(snap => {
          const docs = [];
          snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
          docs.sort((a,b) => (b.uploadedDate||'').localeCompare(a.uploadedDate||''));
          renderJobDocList(docs);
        }).catch(() => renderJobDocList(cached));
    });
}

// ── File Upload ──
async function handleDocUpload(input, context) {
  const files = Array.from(input.files || []);
  if (!files.length || !conDb) return;
  input.value = '';

  const progressEl = document.getElementById('docUploadProgress');
  const labelEl = document.getElementById('docUploadLabel');
  const barEl = document.getElementById('docUploadBar');
  if (progressEl) progressEl.style.display = 'block';

  // Prompt for category
  const category = await promptDocCategory();

  // Prompt for notes
  const notes = window.prompt('Notes for this file (optional):') || '';

  const jobId = context === 'job' ? conCurrentJobId : (document.getElementById('docJobFilter')?.value || '');
  const job = conJobs.find(j => j.id === jobId);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (labelEl) labelEl.textContent = `Uploading ${i+1}/${files.length}: ${file.name}`;
    if (barEl) barEl.style.width = `${(i/files.length)*100}%`;

    try {
      let dataUrl = null;
      let size = file.size;

      if (file.size > DOC_SIZE_LIMIT) {
        // Too large for Firestore — store metadata only with a warning
        if (!confirm(`"${file.name}" is ${formatFileSize(file.size)}. Files over 500KB cannot be stored in JOBSpan yet. Store metadata only (no download)?`)) continue;
        dataUrl = null;
      } else {
        dataUrl = await fileToBase64(file);
      }

      const docData = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size,
        category,
        notes,
        jobId: jobId || '',
        jobName: job?.name || '',
        dataUrl, // null if too large
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploadedDate: new Date().toISOString().split('T')[0],
        uploadedBy: conCurrentUser?.email || '',
        uploadedByName: conCurrentUser?.displayName || conCurrentUser?.email || '',
      };

      await coll('documents').add(docData);
    } catch(e) {
      alert(`Error uploading ${file.name}: ${e.message}`);
    }
  }

  if (progressEl) progressEl.style.display = 'none';
  if (barEl) barEl.style.width = '0%';

  // Refresh job doc list if in job context
  if (context === 'job' && conCurrentJobId) loadJobDocs(conCurrentJobId);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function promptDocCategory() {
  return new Promise(resolve => {
    const cats = ['Contract','Permit','Plans & Drawings','Inspection','Insurance','Invoice','Change Order','Photo','Other'];
    const choice = window.prompt('Select category: 1.Contract 2.Permit 3.Plans 4.Inspection 5.Insurance 6.Invoice 7.Change Order 8.Photo 9.Other - Enter number:', '9');
    const idx = parseInt(choice) - 1;
    resolve(cats[idx] || 'Other');
  });
}

function openDocument(id) {
  const doc = allDocuments.find(d => d.id === id);
  if (!doc) return;
  if (doc.dataUrl) {
    // Open in new tab
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(doc.name)}</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh">
      ${doc.type?.startsWith('image/') ? `<img src="${doc.dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain" />` :
        doc.type === 'application/pdf' ? `<iframe src="${doc.dataUrl}" style="width:100vw;height:100vh;border:none"></iframe>` :
        `<div style="color:#fff;text-align:center;padding:40px"><p>Preview not available for this file type.</p><a href="${doc.dataUrl}" download="${esc(doc.name)}" style="color:#d97706;font-size:1.1rem">⬇ Download ${esc(doc.name)}</a></div>`
      }
    </body></html>`);
    win.document.close();
  } else {
    alert(`"${doc.name}" was uploaded without file data (file was too large). Re-upload to view.`);
  }
}

function downloadDoc(id) {
  const doc = allDocuments.find(d => d.id === id);
  if (!doc?.dataUrl) { alert('No file data available for download.'); return; }
  const a = document.createElement('a');
  a.href = doc.dataUrl;
  a.download = doc.name || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function deleteDoc(id) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  coll('documents').doc(id).delete()
    .then(() => {
      allDocuments = allDocuments.filter(d => d.id !== id);
      renderDocuments();
      renderDocStats();
    })
    .catch(e => alert('Error: ' + e.message));
}

// Expose
window.handleDocUpload = handleDocUpload;
window.openDocument = openDocument;
window.downloadDoc = downloadDoc;
window.deleteDoc = deleteDoc;
window.renderDocuments = renderDocuments;
window.loadJobDocs = loadJobDocs;

// ════════════════════════════════════════════════════
// ── GLOBAL DAILY LOGS FEED ──
// ════════════════════════════════════════════════════
let globalLogs = []; // [{...logData, jobId, jobName}]

function loadGlobalLogs() {
  if (!conDb) return;
  // Load logs across all jobs using collectionGroup
  conDb.collectionGroup('logs').where('companyId','==',currentCompanyId)
    .orderBy('date', 'desc')
    .limit(150)
    .onSnapshot(snap => {
      globalLogs = [];
      snap.forEach(doc => {
        const jobId = doc.ref.parent.parent.id;
        const job = conJobs.find(j => j.id === jobId);
        globalLogs.push({
          id: doc.id,
          jobId,
          jobName: job?.name || 'Unknown Job',
          jobNumber: job?.jobNumber || '',
          jobStatus: job?.status || '',
          ...doc.data()
        });
      });
      renderGlobalLogs();
      populateLogsFilters();
      updateLogsStats();
    }, () => {
      // collectionGroup index not ready - fall back to per-job
      loadGlobalLogsFallback();
    });
}

function loadGlobalLogsFallback() {
  if (!conDb || !conJobs.length) return;
  globalLogs = [];
  let pending = conJobs.length;
  conJobs.forEach(job => {
    coll('jobs').doc(job.id).collection('logs')
      .orderBy('date', 'desc').limit(20).get()
      .then(snap => {
        snap.forEach(doc => {
          globalLogs.push({
            id: doc.id, jobId: job.id,
            jobName: job.name, jobNumber: job.jobNumber || '',
            jobStatus: job.status || '',
            ...doc.data()
          });
        });
      })
      .catch(() => {})
      .finally(() => {
        pending--;
        if (pending === 0) {
          globalLogs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
          renderGlobalLogs();
          populateLogsFilters();
          updateLogsStats();
        }
      });
  });
}

function populateLogsFilters() {
  // Job filter
  const jobSel = document.getElementById('logsJobFilter');
  if (jobSel) {
    const cur = jobSel.value;
    jobSel.innerHTML = '<option value="">All Jobs</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.name)}</option>`).join('');
  }
  // Crew filter - unique crew members from logs
  const crewSel = document.getElementById('logsCrewFilter');
  if (crewSel) {
    const cur = crewSel.value;
    const crews = [...new Set(globalLogs.map(l => l.crew).filter(Boolean))].sort();
    crewSel.innerHTML = '<option value="">All Crew</option>' +
      crews.map(c => `<option value="${c}" ${c===cur?'selected':''}>${esc(c)}</option>`).join('');
  }
}

function updateLogsStats() {
  const today = new Date().toISOString().split('T')[0];
  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('logStatTotal', globalLogs.length);
  setEl('logStatToday', globalLogs.filter(l => l.date === today).length);
  setEl('logStatJobs', [...new Set(globalLogs.map(l => l.jobId))].length);
  setEl('logStatIssues', globalLogs.filter(l => l.issues && l.issues.trim()).length);
}

function renderGlobalLogs() {
  const feed = document.getElementById('globalLogFeed');
  const countEl = document.getElementById('logsGlobalCount');
  if (!feed) return;

  const jobFilter = document.getElementById('logsJobFilter')?.value || '';
  const crewFilter = document.getElementById('logsCrewFilter')?.value || '';
  const dateFrom = document.getElementById('logsDateFrom')?.value || '';
  const dateTo = document.getElementById('logsDateTo')?.value || '';

  let logs = globalLogs;
  if (jobFilter) logs = logs.filter(l => l.jobId === jobFilter);
  if (crewFilter) logs = logs.filter(l => l.crew === crewFilter);
  if (dateFrom) logs = logs.filter(l => l.date >= dateFrom);
  if (dateTo) logs = logs.filter(l => l.date <= dateTo);

  if (countEl) countEl.textContent = `${logs.length} log${logs.length!==1?'s':''} ${jobFilter||crewFilter||dateFrom?'(filtered)':'total'}`;

  if (!logs.length) {
    feed.innerHTML = `<div class="kt-card"><div style="text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${globalLogs.length === 0 ? 'No daily logs yet. Field crew can add logs from inside any job.' : 'No logs match your filters.'}
    </div></div>`;
    return;
  }

  // Group by date
  const byDate = {};
  logs.forEach(l => {
    const d = l.date || 'No Date';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];

  feed.innerHTML = Object.entries(byDate).map(([date, dayLogs]) => {
    const label = date === today ? '📅 Today' : date === yesterday ? '📅 Yesterday' : '📅 ' + new Date(date+'T00:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    return `
      <div style="margin-bottom:20px">
        <div style="font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--amber);margin-bottom:10px;display:flex;align-items:center;gap:10px">
          ${label}
          <span style="font-size:.7rem;color:var(--muted);font-weight:600;text-transform:none;letter-spacing:0">${dayLogs.length} log${dayLogs.length!==1?'s':''}</span>
        </div>
        ${dayLogs.map(log => renderGlobalLogCard(log)).join('')}
      </div>`;
  }).join('');
}

function renderGlobalLogCard(log) {
  const hasIssues = log.issues && log.issues.trim();
  const hasPhotos = log.photos && log.photos.length > 0;
  const s = KYTRAC_STATUSES.find(x => x.name === log.jobStatus) || {color:'var(--amber)'};

  return `<div class="kt-card" style="margin-bottom:10px;${hasIssues?'border-color:rgba(239,83,80,.3)':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:14px 16px 10px;border-bottom:1px solid rgba(110,145,210,.08);flex-wrap:wrap;gap:8px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:800;color:var(--amber);font-size:.88rem;cursor:pointer" onclick="openJobDetail('${log.jobId}')">${esc(log.jobName)}</span>
          ${log.jobNumber?`<span style="font-size:.7rem;color:var(--muted)">${esc(log.jobNumber)}</span>`:''}
          <span style="background:${s.color}22;color:${s.color};padding:1px 7px;border-radius:999px;font-size:.68rem;font-weight:700">${esc(log.jobStatus||'')}</span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          ${log.crew?`<span style="font-size:.78rem;color:var(--muted)">👷 ${esc(log.crew)}</span>`:''}
          ${log.weather?`<span style="font-size:.78rem;color:var(--muted)">🌤 ${esc(log.weather)}</span>`:''}
          ${log.crewCount?`<span style="font-size:.78rem;color:var(--muted)">👥 ${esc(log.crewCount)} on site</span>`:''}
          ${log.hoursWorked?`<span style="font-size:.78rem;color:var(--muted)">⏱ ${esc(String(log.hoursWorked))}h</span>`:''}
          ${log.createdByName?`<span style="font-size:.72rem;color:rgba(110,145,210,.35)">logged by ${esc(log.createdByName)}</span>`:''}
        </div>
      </div>
      <button class="btn" style="padding:3px 10px;font-size:.76rem;flex-shrink:0" onclick="openJobDetail('${log.jobId}')">Open Job →</button>
    </div>
    <div style="padding:12px 16px">
      ${log.notes?`<div style="font-size:.86rem;color:#eaf0fb;line-height:1.6;margin-bottom:${hasIssues||hasPhotos?'10px':'0'}">${esc(log.notes)}</div>`:''}
      ${hasIssues?`<div style="background:rgba(239,83,80,.08);border:1px solid rgba(239,83,80,.2);border-radius:8px;padding:9px 12px;font-size:.82rem;color:#fca5a5;margin-bottom:${hasPhotos?'10px':'0'}">
        <span style="font-weight:700;margin-right:6px">⚠️ Issue:</span>${esc(log.issues)}
      </div>`:''}
      ${hasPhotos?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        ${log.photos.slice(0,6).map((p,i) => `<img src="${p}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(110,145,210,.2)" onclick="openLightbox('${p}')" />`).join('')}
        ${log.photos.length>6?`<div style="width:70px;height:70px;border-radius:8px;background:rgba(8,18,36,.8);border:1px solid rgba(110,145,210,.2);display:flex;align-items:center;justify-content:center;font-size:.76rem;color:var(--muted)">+${log.photos.length-6}</div>`:''}
      </div>`:''}
    </div>
    <div style="padding:0 16px 12px;display:flex;justify-content:flex-end">
      <button onclick="event.stopPropagation();window._currentLogForAI=${JSON.stringify(Object.assign({},log,{photos:[]}))};const c=document.createElement('div');c.id='aiSummaryContainer_${log.id}';this.parentNode.appendChild(c);generateAILogSummary('${log.id}','${esc(log.jobName||'')}');this.remove()" 
        style="font-size:.72rem;padding:3px 10px;background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(59,130,246,.15));color:#c4b5fd;border:1px solid rgba(139,92,246,.3);border-radius:7px;cursor:pointer">
        ✨ Client Summary
      </button>
      <div id="aiSummaryContainer_${log.id}"></div>
    </div>
  </div>`;
}

function openAddLogFromGlobal() {
  if (conJobs.length === 0) {
    alert('Create a job first before adding daily logs.');
    return;
  }
  // Show job picker modal
  showJobPickerForLog();
}

function showJobPickerForLog() {
  // Create a simple job picker overlay
  const existing = document.getElementById('jobPickerOverlay');
  if (existing) existing.remove();

  const activeJobs = conJobs.filter(j =>
    ['Work In Progress','Scheduled','Approved','Design Phase','Permitting','Estimating'].includes(j.status)
  );
  const jobList = activeJobs.length ? activeJobs : conJobs;

  const overlay = document.createElement('div');
  overlay.id = 'jobPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,5,14,.85);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:rgba(6,14,28,.99);border:1px solid var(--amber-border);border-radius:18px;padding:24px;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6);max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1rem;font-weight:800">📋 Select Job for Daily Log</div>
        <button onclick="document.getElementById('jobPickerOverlay').remove()" class="btn" style="padding:4px 10px">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${jobList.map(j => {
          const s = KYTRAC_STATUSES.find(x=>x.name===j.status)||{color:'var(--amber)'};
          return `<button onclick="pickJobForLog('${j.id}')" style="background:rgba(8,18,36,.8);border:1px solid var(--amber-border);border-radius:10px;padding:12px 14px;text-align:left;cursor:pointer;transition:border-color .12s;width:100%" onmouseover="this.style.borderColor='var(--amber)'" onmouseout="this.style.borderColor='var(--amber-border)'">
            <div style="font-weight:700;color:#eaf0fb">${esc(j.name)}</div>
            <div style="font-size:.76rem;display:flex;gap:8px;margin-top:3px">
              <span style="color:var(--amber)">${esc(j.jobNumber||'')}</span>
              <span style="color:${s.color};font-weight:700">${j.status}</span>
              ${j.client?`<span style="color:var(--muted)">${esc(j.client)}</span>`:''}
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function pickJobForLog(jobId) {
  const overlay = document.getElementById('jobPickerOverlay');
  if (overlay) overlay.remove();
  // Set the current job ID so saveLog knows where to save
  conCurrentJobId = jobId;
  // Reset and open the log modal
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  if (typeof window._afterLogSave === 'function') { window._afterLogSave(); window._afterLogSave = null; }
  document.getElementById('logWeather').selectedIndex = 0;
  document.getElementById('logCrew').value = '';
  document.getElementById('logNotes').value = '';
  document.getElementById('logIssues').value = '';
  const photoGrid = document.getElementById('logPhotoGrid');
  if (photoGrid) {
    const btn = photoGrid.querySelector('label');
    photoGrid.innerHTML = '';
    if (btn) photoGrid.appendChild(btn);
  }
  // Move the modal to body level if needed and open
  const modal = document.getElementById('addLogModal');
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  kOpen('addLogModal');
  // After save, reload global logs
  window._afterLogSave = () => {
    loadGlobalLogs();
    renderGlobalLogs();
  };
}
window.pickJobForLog = pickJobForLog;
window.showJobPickerForLog = showJobPickerForLog;

// Expose
window.renderGlobalLogs = renderGlobalLogs;
window.openAddLogFromGlobal = openAddLogFromGlobal;

// ════════════════════════════════════════════════════
// ── CREW ASSIGNMENT ──
// ════════════════════════════════════════════════════

function getSelectedCrew() {
  const boxes = document.querySelectorAll('#crewCheckboxes input[type="checkbox"]:checked');
  return Array.from(boxes).map(cb => ({ email: cb.value, name: cb.dataset.name }));
}

function populateCrewCheckboxes(selectedCrew) {
  const container = document.getElementById('crewCheckboxes');
  if (!container || !conDb) return;
  coll('settings').doc('team').get().then(doc => {
    if (!doc.exists) {
      container.innerHTML = '<div class="small muted" style="font-style:italic;grid-column:1/-1">No team members added yet. Add team members in Company Settings.</div>';
      return;
    }
    const members = Object.values(extractTeamMembers(doc.data()))
      .sort((a,b) => (KYTRAC_ROLES[a.role]?.level||0) > (KYTRAC_ROLES[b.role]?.level||0) ? -1 : 1);
    if (!members.length) {
      container.innerHTML = '<div class="small muted" style="font-style:italic;grid-column:1/-1">No team members added yet.</div>';
      return;
    }
    const selectedEmails = (selectedCrew||[]).map(c => c.email);
    const roleColors = { Owner:'#f59e0b', 'Project Manager':'#3b82f6', 'Office Manager':'#8b5cf6', Accounting:'#10b981', 'Marketing/Office Staff':'#6366f1', Sales:'#f97316', Superintendent:'#0891b2', 'Field Technician':'#6b7280' };
    container.innerHTML = members.map(m => {
      const color = roleColors[m.role] || 'var(--amber)';
      const checked = selectedEmails.includes(m.email);
      return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;border-radius:7px;background:${checked?'rgba(217,119,6,.1)':'transparent'};border:1px solid ${checked?'var(--amber-border)':'transparent'};transition:all .12s" onclick="this.style.background=this.querySelector('input').checked?'transparent':'rgba(217,119,6,.1)';this.style.borderColor=this.querySelector('input').checked?'transparent':'var(--amber-border)'">
        <input type="checkbox" value="${esc(m.email)}" data-name="${esc(m.name||m.email)}" ${checked?'checked':''} style="accent-color:var(--amber);width:16px;height:16px;flex-shrink:0" />
        <div>
          <div style="font-size:.82rem;font-weight:700;color:#eaf0fb">${esc(m.name||m.email)}</div>
          <div style="font-size:.68rem;color:${color};font-weight:600">${esc(m.role||'')}</div>
        </div>
      </label>`;
    }).join('');
  }).catch(() => {
    container.innerHTML = '<div class="small muted" style="font-style:italic">Could not load team members.</div>';
  });
}

// Patch openNewJobModal to populate crew checkboxes
const _origOpenNewJobModal = window.openNewJobModal;
window.openNewJobModal = function() {
  _origOpenNewJobModal();
  setTimeout(() => populateCrewCheckboxes([]), 100);
};

// Patch editCurrentJob to populate crew checkboxes with current selection
const _origEditCurrentJob = window.editCurrentJob;
window.editCurrentJob = function() {
  _origEditCurrentJob();
  const job = conJobs.find(j => j.id === conEditingJobId);
  setTimeout(() => populateCrewCheckboxes(job?.crew || []), 100);
};

// Update openJobDetail to show crew in overview
const _origOpenJobDetailCrew = window.openJobDetail;
window.openJobDetail = function(jobId) {
  _origOpenJobDetailCrew(jobId);
  const job = conJobs.find(j => j.id === jobId);
  const crewEl = document.getElementById('detailCrew');
  const crewRow = document.getElementById('detailCrewRow');
  if (crewEl && job?.crew?.length) {
    const roleColors = { Owner:'#f59e0b', 'Project Manager':'#3b82f6', Superintendent:'#0891b2', 'Field Technician':'#6b7280' };
    crewEl.innerHTML = job.crew.map(c => {
      return `<span style="background:rgba(217,119,6,.12);border:1px solid var(--amber-border);border-radius:999px;padding:3px 10px;font-size:.76rem;font-weight:700;color:#eaf0fb">👷 ${esc(c.name||c.email)}</span>`;
    }).join('');
    if (crewRow) crewRow.style.display = 'block';
  } else if (crewRow) {
    crewRow.style.display = 'none';
  }
};

// ════════════════════════════════════════════════════
// ── GLOBAL PHASES (for Calendar) ──
// ════════════════════════════════════════════════════
let globalPhases = []; // [{...phaseData, jobId, jobName}]

function loadGlobalPhases() {
  if (!conDb) return;
  // Try collectionGroup first
  conDb.collectionGroup('phases').where('companyId','==',currentCompanyId)
    .orderBy('startDate')
    .onSnapshot(snap => {
      globalPhases = [];
      snap.forEach(doc => {
        const jobId = doc.ref.parent.parent.id;
        const job = conJobs.find(j => j.id === jobId);
        if (!job) return;
        globalPhases.push({
          id: doc.id, jobId,
          jobName: job.name,
          jobNumber: job.jobNumber || '',
          ...doc.data()
        });
      });
      // Re-render calendar if visible
      const calPage = document.getElementById('ktPageCalendar');
      if (calPage?.classList.contains('active')) renderCalendar();
    }, () => {
      loadGlobalPhasesFallback();
    });
}

function loadGlobalPhasesFallback() {
  if (!conDb || !conJobs.length) return;
  globalPhases = [];
  let pending = conJobs.length;
  conJobs.forEach(job => {
    coll('jobs').doc(job.id).collection('phases')
      .orderBy('startDate').get()
      .then(snap => {
        snap.forEach(doc => {
          globalPhases.push({
            id: doc.id, jobId: job.id,
            jobName: job.name, jobNumber: job.jobNumber || '',
            ...doc.data()
          });
        });
      })
      .catch(() => {})
      .finally(() => {
        pending--;
        if (pending === 0) {
          const calPage = document.getElementById('ktPageCalendar');
          if (calPage?.classList.contains('active')) renderCalendar();
        }
      });
  });
}

// ── Update getCalEvents to include phases ──
function getCalEvents(dateISO) {
  const events = [];

  // Phases — show on every day between startDate and endDate
  globalPhases.forEach(phase => {
    if (!phase.startDate) return;
    const start = phase.startDate;
    const end = phase.endDate || phase.startDate;
    if (dateISO >= start && dateISO <= end) {
      const statusColors = { 'not-started':'#6b7280', 'in-progress':'#0d9488', 'complete':'#1dbb87' };
      const color = statusColors[phase.status] || '#0d9488';
      const isStart = dateISO === start;
      events.push({
        type: 'phase',
        label: `${isStart ? '' : ''}${esc(phase.name||'Phase')} — ${esc(phase.jobName)}`,
        color,
        id: phase.id,
        jobId: phase.jobId
      });
    }
  });

  // To-dos with due dates
  allTodos.filter(t => !t.done && t.dueDate === dateISO).forEach(t => {
    events.push({ type:'todo', label: esc(t.text), color:'#f59e0b', id:t.id });
  });

  // Time entries
  allTimeEntries.filter(e => e.date === dateISO).forEach(e => {
    events.push({
      type: 'time',
      label: `${esc(e.userName||'?')} — ${esc(e.jobName||'')}${e.hours?' ('+e.hours.toFixed(1)+'h)':''}`,
      color: '#3b82f6',
      id: e.id
    });
  });

  return events;
}
window.getCalEvents = getCalEvents;

// ── Update calendar legend to show phases ──
// Already shows teal for phases in legend

// ── Load global phases on sign in ──
// (called below in loadGlobalPhases patch)

// Expose
window.populateCrewCheckboxes = populateCrewCheckboxes;
window.getSelectedCrew = getSelectedCrew;
window.loadGlobalPhases = loadGlobalPhases;

// ════════════════════════════════════════════════════
// ── CUSTOMER PORTAL ──
// ════════════════════════════════════════════════════

// ── Check for portal URL parameter on page load ──
function checkPortalMode() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('portal');
  if (token) {
    // Hide main app, show portal
    document.getElementById('ktAuthWall').style.display = 'none';
    document.getElementById('ktApp').style.display = 'none';
    document.getElementById('ktPortalView').classList.add('active');
    loadPortalData(token);
  }
}

function loadPortalData(token) {
  // Token format: jobId-randomHash
  // Extract jobId from token
  const parts = token.split('-hash-');
  const jobId = parts[0];
  if (!jobId) { showPortalNotFound(); return; }

  // Load Firebase for portal (read-only anonymous access)
  // Portal uses same Firebase project but reads via token validation
  function loadNext(i, scripts) {
    if (i >= scripts.length) { initPortalFirebase(jobId, token); return; }
    const s = document.createElement('script');
    s.src = scripts[i];
    s.onload = () => loadNext(i+1, scripts);
    s.onerror = () => showPortalNotFound();
    document.head.appendChild(s);
  }

  if (typeof firebase !== 'undefined') {
    initPortalFirebase(jobId, token);
  } else {
    loadNext(0, [
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
    ]);
  }
}

function initPortalFirebase(jobId, token) {
  try {
    let app, db;
    if (firebase.apps.length) {
      app = firebase.apps[0];
    } else {
      app = firebase.initializeApp(CON_FIREBASE_CONFIG);
    }
    db = firebase.firestore();

    // Validate token exists in Firestore
    db.collection('portalTokens').doc(token).get()
      .then(tokenDoc => {
        if (!tokenDoc.exists) { showPortalNotFound(); return; }
        const tokenData = tokenDoc.data();
        if (tokenData.jobId !== jobId) { showPortalNotFound(); return; }
        if (tokenData.expires && tokenData.expires < Date.now()) {
          showPortalNotFound(); return;
        }
        // Token valid - load all portal data
        return loadPortalJob(db, jobId, tokenData);
      })
      .catch(() => {
        // If token collection doesn't exist yet, try loading job directly
        // This allows portal to work even before token system is set up
        loadPortalJob(db, jobId, {});
      });
  } catch(e) {
    showPortalNotFound();
  }
}

function loadPortalJob(db, jobId, tokenData) {
  const companyId = tokenData.companyId || null;

  // Helper to get company-scoped collection
  function portalColl(name) {
    if (companyId) return db.collection('companies').doc(companyId).collection(name);
    return db.collection(name); // fallback for old tokens
  }

  // Load company profile for branding
  portalColl('settings').doc('company').get()
    .then(doc => {
      const co = doc.exists ? doc.data() : {};
      renderPortalHeader(co);
    }).catch(() => renderPortalHeader({}));

  // Load job
  portalColl('jobs').doc(jobId).get()
    .then(doc => {
      if (!doc.exists) { showPortalNotFound(); return; }
      const job = { id: doc.id, ...doc.data() };
      renderPortalJob(job);

      // Load phases
      portalColl('jobs').doc(jobId).collection('phases')
        .orderBy('startDate').get()
        .then(snap => {
          const phases = [];
          snap.forEach(d => phases.push({ id: d.id, ...d.data() }));
          renderPortalPhases(phases);
        }).catch(() => renderPortalPhases([]));

      // Load shared daily logs (last 20)
      portalColl('jobs').doc(jobId).collection('logs')
        .orderBy('date','desc').limit(20).get()
        .then(snap => {
          const logs = [];
          snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
          renderPortalLogs(logs);
        }).catch(() => renderPortalLogs([]));

      // Load invoices if sharing enabled
      if (tokenData.shareInvoices !== false) {
        portalColl('jobs').doc(jobId).collection('invoices')
          .orderBy('date','desc').get()
          .then(snap => {
            const invs = [];
            snap.forEach(d => invs.push({ id: d.id, ...d.data() }));
            renderPortalInvoices(invs);
          }).catch(() => {});
      }

      // Load approved change orders
      portalColl('jobs').doc(jobId).collection('changeorders')
        .where('status','==','Approved').get()
        .then(snap => {
          const cos = [];
          snap.forEach(d => cos.push({ id: d.id, ...d.data() }));
          renderPortalCOs(cos);
        }).catch(() => {});
    })
    .catch(() => showPortalNotFound());
}

function renderPortalHeader(co) {
  const nameEl = document.getElementById('portalCompanyName');
  const subEl = document.getElementById('portalCompanySub');
  const logoEl = document.getElementById('portalLogoImg');
  const contactEl = document.getElementById('portalContactBar');
  const footerEl = document.getElementById('portalFooterCompany');

  if (nameEl) nameEl.textContent = co.companyName || 'Construction Company';
  if (subEl) subEl.textContent = co.address || 'Professional Construction Services';
  if (logoEl && co.logo) { logoEl.src = co.logo; logoEl.style.display = 'block'; }
  if (footerEl) footerEl.textContent = co.companyName || '';

  if (contactEl) {
    contactEl.innerHTML = [
      co.phone ? `<div class="portal-contact-item">📞 <a href="tel:${esc(co.phone)}">${esc(co.phone)}</a></div>` : '',
      co.email ? `<div class="portal-contact-item">✉️ <a href="mailto:${esc(co.email)}">${esc(co.email)}</a></div>` : '',
      co.website ? `<div class="portal-contact-item">🌐 <a href="${esc(co.website)}" target="_blank">${esc(co.website.replace(/https?:\/\//,''))}</a></div>` : '',
    ].join('');
  }
}

function renderPortalJob(job) {
  document.getElementById('portalLoading').style.display = 'none';
  document.getElementById('portalJobHero').style.display = 'block';

  document.getElementById('portalJobName').textContent = job.name || '';
  document.getElementById('portalJobAddress').textContent = job.address || '';

  const s = KYTRAC_STATUSES.find(x => x.name === job.status) || {color:'var(--amber)'};
  const statusEl = document.getElementById('portalJobStatus');
  if (statusEl) {
    statusEl.textContent = job.status || '';
    statusEl.style.background = s.color + '22';
    statusEl.style.color = s.color;
    statusEl.style.border = `1px solid ${s.color}44`;
  }

  const datesEl = document.getElementById('portalJobDates');
  if (datesEl && job.startDate) {
    datesEl.textContent = `Start: ${job.startDate}${job.endDate ? ' · Target: ' + job.endDate : ''}`;
  }

  // Build visual status track
  // Show simplified customer-facing stages
  const customerStages = [
    { label: 'Estimate', statuses: ['New Lead','Hipshot Needed','Appointment Set','Estimating','Submitted'] },
    { label: 'Approved', statuses: ['Approved'] },
    { label: 'Design', statuses: ['Design Phase','Permitting'] },
    { label: 'Scheduled', statuses: ['Scheduled'] },
    { label: 'In Progress', statuses: ['Work In Progress','Inspection Pending'] },
    { label: 'Invoicing', statuses: ['Invoicing','Pending Payment','Delinquent'] },
    { label: 'Complete', statuses: ['Closed Won'] },
  ];

  const currentIdx = customerStages.findIndex(st => st.statuses.includes(job.status));
  const trackEl = document.getElementById('portalStatusTrack');
  if (trackEl) {
    trackEl.innerHTML = customerStages.map((st, i) => {
      const isDone = i < currentIdx;
      const isActive = i === currentIdx;
      return `<div class="portal-stage">
        <div class="portal-stage-dot ${isDone?'done':isActive?'active':''}"></div>
        <div class="portal-stage-label ${isDone?'done':isActive?'active':''}">${st.label}</div>
      </div>
      ${i < customerStages.length-1 ? `<div class="portal-stage-line ${isDone?'done':''}"></div>` : ''}`;
    }).join('');
  }
}

function renderPortalPhases(phases) {
  const el = document.getElementById('portalPhasesList');
  const section = document.getElementById('portalPhasesSection');
  if (!el) return;

  if (!phases.length) {
    if (section) section.style.display = 'none';
    return;
  }

  const statusIcons = { 'not-started':'○', 'in-progress':'◐', 'complete':'●' };
  const statusColors = { 'not-started':'var(--muted)', 'in-progress':'var(--amber)', 'complete':'#1dbb87' };

  el.innerHTML = phases.map(p => {
    const color = statusColors[p.status] || 'var(--muted)';
    const icon = statusIcons[p.status] || '○';
    return `<div class="portal-phase-row">
      <span style="font-size:1.1rem;color:${color};flex-shrink:0">${icon}</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:.88rem">${esc(p.name||'Phase')}</div>
        ${p.startDate||p.endDate ? `<div style="font-size:.76rem;color:var(--muted)">${p.startDate||''}${p.endDate&&p.endDate!==p.startDate?' – '+p.endDate:''}</div>` : ''}
      </div>
      <span style="font-size:.72rem;font-weight:700;color:${color};text-transform:capitalize">${(p.status||'not-started').replace('-',' ')}</span>
    </div>`;
  }).join('');
}

function renderPortalLogs(logs) {
  const el = document.getElementById('portalLogsList');
  const countEl = document.getElementById('portalLogsCount');
  const section = document.getElementById('portalLogsSection');
  if (!el) return;

  if (countEl) countEl.textContent = `${logs.length} update${logs.length!==1?'s':''}`;

  if (!logs.length) {
    el.innerHTML = '<p class="muted" style="font-style:italic">No updates yet.</p>';
    return;
  }

  el.innerHTML = logs.map(log => {
    const hasPhotos = log.photos && log.photos.length > 0;
    return `<div class="portal-log-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;font-size:.82rem;color:var(--amber)">${log.date||''}</div>
        <div style="display:flex;gap:10px">
          ${log.weather?`<span style="font-size:.76rem;color:var(--muted)">🌤 ${esc(log.weather)}</span>`:''}
          ${log.crewCount?`<span style="font-size:.76rem;color:var(--muted)">👷 ${esc(String(log.crewCount))} on site</span>`:''}
        </div>
      </div>
      ${log.notes?`<div style="font-size:.86rem;color:#eaf0fb;line-height:1.6;margin-bottom:${hasPhotos?'10px':'0'}">${esc(log.notes)}</div>`:''}
      ${hasPhotos?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${log.photos.slice(0,8).map(p => `<img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(110,145,210,.2)" onclick="window.open('${p}','_blank')" />`).join('')}
      </div>`:''}
    </div>`;
  }).join('');
}

function renderPortalInvoices(invs) {
  if (!invs.length) return;
  const section = document.getElementById('portalInvoicesSection');
  const el = document.getElementById('portalInvList');
  const sumEl = document.getElementById('portalInvSummary');
  if (!section || !el) return;

  section.style.display = 'block';
  const totalAmt = invs.reduce((s,i) => s+(i.total||0), 0);
  const totalPaid = invs.reduce((s,i) => s+(i.amtPaid||0), 0);
  if (sumEl) sumEl.textContent = `$${Math.round(totalPaid).toLocaleString()} paid of $${Math.round(totalAmt).toLocaleString()}`;

  const statusColors = { Draft:'var(--muted)', Sent:'#3b82f6', Paid:'#1dbb87', Overdue:'#ef5350', Partial:'#f97316' };

  el.innerHTML = invs.map(inv => {
    const bal = (inv.total||0) - (inv.amtPaid||0);
    const sColor = statusColors[inv.status] || 'var(--muted)';
    const payBtn = inv.paymentLink && bal > 0 && inv.status !== 'Paid'
      ? `<a href="${inv.paymentLink}" target="_blank" style="display:inline-block;margin-top:8px;background:#d97706;color:#fff;font-size:.78rem;font-weight:800;padding:7px 18px;border-radius:8px;text-decoration:none">💳 Pay Now</a>`
      : '';
    return `<div class="portal-invoice-row" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:700;color:var(--amber)">${esc(inv.number||'Invoice')}</div>
          <div style="font-size:.76rem;color:var(--muted)">${inv.date||''} · Due: ${inv.dueDate||'—'}</div>
          ${inv.type ? `<div style="font-size:.74rem;color:var(--muted)">${esc(inv.type)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;font-size:1rem">$${(inv.total||0).toLocaleString()}</div>
          <div style="font-size:.76rem;color:${sColor};font-weight:700">${inv.status||'Draft'}</div>
          ${bal > 0 ? `<div style="font-size:.74rem;color:var(--muted)">Balance: $${bal.toFixed(2)}</div>` : ''}
        </div>
      </div>
      ${payBtn}
    </div>`;
  }).join('');
}

function renderPortalCOs(cos) {
  if (!cos.length) return;
  const section = document.getElementById('portalCOSection');
  const el = document.getElementById('portalCOList');
  if (!section || !el) return;
  section.style.display = 'block';
  el.innerHTML = cos.map(co => `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(110,145,210,.07)">
      <div>
        <div style="font-weight:700">${esc(co.title||co.description||'Change Order')}</div>
        <div style="font-size:.76rem;color:var(--muted)">${co.date||''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;color:#a3f2d2">+$${(co.amount||0).toLocaleString()}</div>
        <div style="font-size:.72rem;color:#1dbb87;font-weight:700">Approved</div>
      </div>
    </div>`).join('');
}

function showPortalNotFound() {
  document.getElementById('portalLoading').style.display = 'none';
  document.getElementById('portalNotFound').style.display = 'block';
}

// ── Generate and share portal link ──
function shareCustomerPortal() {
  if (!conCurrentJobId || !conDb) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);
  if (!job) return;

  // Generate token
  const token = conCurrentJobId + '-hash-' + Math.random().toString(36).slice(2,10);
  const portalUrl = window.location.origin + window.location.pathname + '?portal=' + token;

  // Save token to Firestore — include companyId for multi-tenant portal access
  conDb.collection('portalTokens').doc(token).set({
    jobId: conCurrentJobId,
    jobName: job.name || '',
    companyId: currentCompanyId,
    created: Date.now(),
    createdBy: conCurrentUser?.email || '',
    expires: null,
    shareInvoices: true,
  }).then(() => {
    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        showPortalShareConfirm(portalUrl);
      }).catch(() => showPortalShareConfirm(portalUrl));
    } else {
      showPortalShareConfirm(portalUrl);
    }
  }).catch(e => alert('Error generating portal link: ' + e.message));
}

function showPortalShareConfirm(url) {
  // Show a nice confirmation with the URL
  const msg = `✅ Customer Portal Link Ready!

Send this link to your customer:

${url}

They can view their project status, schedule, daily updates, and invoices — no login required.`;
  
  // Create a styled modal instead of alert
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,5,14,.85);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:rgba(6,14,28,.99);border:1px solid var(--amber-border);border-radius:18px;padding:28px;max-width:520px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6)">
      <div style="font-size:1.8rem;margin-bottom:12px">🔗</div>
      <div style="font-size:1.1rem;font-weight:800;color:#eaf0fb;margin-bottom:6px">Customer Portal Link Ready</div>
      <div style="font-size:.84rem;color:var(--muted);margin-bottom:16px">Send this link to your customer. They can view their project — no login needed.</div>
      <div style="background:rgba(8,18,36,.8);border:1px solid var(--amber-border);border-radius:10px;padding:12px 14px;margin-bottom:16px;word-break:break-all;font-size:.78rem;color:var(--amber);font-family:monospace">${esc(url)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="navigator.clipboard.writeText('${url.replace(/'/g,"\'")}').then(()=>{this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy Link',2000)})" class="btn-amber" style="flex:1">📋 Copy Link</button>
        <a href="mailto:?subject=Your Project Portal&body=View your project here: ${encodeURIComponent(url)}" class="btn" style="flex:1;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px">✉️ Email Link</a>
        <button onclick="this.closest('div[style*=fixed]').remove()" class="btn" style="flex:1">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// Expose portal functions
window.shareCustomerPortal = shareCustomerPortal;
window.checkPortalMode = checkPortalMode;

// ════════════════════════════════════════════════════
// ── CALENDAR PERSONAL EVENTS ──
// ════════════════════════════════════════════════════

function loadCalendarEvents() {
  if (!conDb) return;
  coll('calendarEvents')
    .orderBy('date')
    .onSnapshot(snap => {
      calendarEvents = [];
      snap.forEach(doc => calendarEvents.push({ id: doc.id, ...doc.data() }));
      // Build team color map
      buildTeamColors();
      // Re-render calendar if visible
      const calPage = document.getElementById('ktPageCalendar');
      if (calPage?.classList.contains('active')) renderCalendar();
    }, () => {});
}

function buildTeamColors() {
  if (!conDb) return;
  coll('settings').doc('team').get().then(doc => {
    if (!doc.exists) return;
    const members = Object.values(extractTeamMembers(doc.data()));
    _teamColors = {};
    members.forEach((m, i) => {
      _teamColors[m.email] = CAL_USER_COLORS[i % CAL_USER_COLORS.length];
    });
    // Always assign current user first color
    if (conCurrentUser?.email && !_teamColors[conCurrentUser.email]) {
      _teamColors[conCurrentUser.email] = CAL_USER_COLORS[0];
    }
    renderTeamLegend();
    renderCalendar();
  }).catch(() => {});
}

function renderTeamLegend() {
  const el = document.getElementById('calTeamLegend');
  if (!el || !Object.keys(_teamColors).length) return;
  el.innerHTML = Object.entries(_teamColors).map(([email, color]) => {
    const name = email.split('@')[0];
    return `<span style="display:flex;align-items:center;gap:4px;font-size:.72rem;color:var(--muted)">
      <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
      ${esc(name)}
    </span>`;
  }).join('');
}

// ── Override getCalEvents to include personal events ──
const _origGetCalEvents = window.getCalEvents;
window.getCalEvents = function(dateISO) {
  const events = typeof _origGetCalEvents === 'function' ? _origGetCalEvents(dateISO) : [];

  // Add personal calendar events
  calendarEvents.filter(e => e.date === dateISO).forEach(ev => {
    const assigneeEmail = ev.assignee || '';
    const color = assigneeEmail ? (_teamColors[assigneeEmail] || 'var(--amber)') : 'var(--amber)';
    const assigneeName = assigneeEmail ? assigneeEmail.split('@')[0] : 'All';
    events.push({
      type: 'event',
      label: `${ev.meetLink?'🎥 ':''}${ev.time ? ev.time.slice(0,5)+' ' : ''}${esc(ev.title||'')}`,
      sublabel: assigneeName,
      color,
      id: ev.id,
      ev
    });
  });

  return events;
}

// ── Override renderMonthView to use new pill style ──
const _origRenderMonthView = window.renderMonthView;
window.renderMonthView = function() {
  const grid = document.getElementById('calMonthGrid');
  if (!grid) return;
  const today = new Date().toISOString().split('T')[0];
  const year = _calDate.getFullYear();
  const month = _calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let cells = '';
  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateISO === today;
    const events = window.getCalEvents(dateISO);
    const evHtml = events.slice(0,4).map(ev =>
      `<span class="cal-event-pill" style="background:${ev.color}20;color:${ev.color};border-left-color:${ev.color}" onclick="event.stopPropagation();${ev.type==='event'?`openCalEventModal('${ev.id}')`:''}" title="${esc(ev.label)}">${esc(ev.label)}${ev.ev?.meetLink?` <a href="${ev.ev.meetLink}" target="_blank" onclick="event.stopPropagation()" style="color:#fff;font-size:.6rem;background:#0d9488;border-radius:3px;padding:0 3px;text-decoration:none">Join</a>`:''}</span>`
    ).join('') + (events.length > 4 ? `<span style="font-size:.6rem;color:var(--muted);padding:1px 4px">+${events.length-4} more</span>` : '');
    cells += `<div class="cal-day${isToday?' today':''}" onclick="openCalEventModal(null,'${dateISO}')">
      <div class="cal-day-num">${isToday?`<span class="cal-day-today-num">${d}</span>`:d}</div>
      ${evHtml}
    </div>`;
  }
  // Next month fill
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }
  grid.innerHTML = cells;
}

// ── Calendar Event CRUD ──
function openCalEventModal(id, prefilledDate) {
  const ev = id ? calendarEvents.find(e => e.id === id) : null;
  document.getElementById('calEventModalTitle').textContent = ev ? 'Edit Event' : 'New Event';
  document.getElementById('calEventId').value = id || '';

  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
  setVal('calEventTitle', ev?.title);
  setVal('calEventType', ev?.type || 'Meeting');
  setVal('calEventDate', ev?.date || prefilledDate || new Date().toISOString().split('T')[0]);
  setVal('calEventTime', ev?.time || '09:00');
  setVal('calEventDuration', ev?.duration || '60');
  setVal('calEventLocation', ev?.location);
  setVal('calEventMeet', ev?.meetLink);
  setVal('calEventNotes', ev?.notes);

  // Populate assignee dropdown from team
  const assignSel = document.getElementById('calEventAssignee');
  if (assignSel && conDb) {
    coll('settings').doc('team').get().then(doc => {
      const members = doc.exists ? Object.values(extractTeamMembers(doc.data())) : [];
      assignSel.innerHTML = '<option value="">Everyone (All Team)</option>' +
        members.map(m => {
          const color = _teamColors[m.email] || 'var(--amber)';
          return `<option value="${esc(m.email)}" ${m.email===(ev?.assignee||'')?'selected':''}>${esc(m.name||m.email)}</option>`;
        }).join('');
      if (ev?.assignee) assignSel.value = ev.assignee;
    }).catch(() => {});
  }

  // Populate job dropdown
  const jobSel = document.getElementById('calEventJob');
  if (jobSel) {
    jobSel.innerHTML = '<option value="">No job linked</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===(ev?.jobId||'')?'selected':''}>${esc(j.name)}</option>`).join('');
  }

  document.getElementById('deleteCalEventBtn').style.display = id ? 'inline-flex' : 'none';
  kOpen('calEventModal');
}

function saveCalEvent() {
  const title = document.getElementById('calEventTitle')?.value.trim();
  if (!title) { alert('Title is required.'); return; }
  const id = document.getElementById('calEventId')?.value;
  const assignee = document.getElementById('calEventAssignee')?.value || '';

  const data = {
    title,
    type: document.getElementById('calEventType')?.value || 'Meeting',
    date: document.getElementById('calEventDate')?.value || '',
    time: document.getElementById('calEventTime')?.value || '',
    duration: parseInt(document.getElementById('calEventDuration')?.value) || 60,
    location: document.getElementById('calEventLocation')?.value.trim() || '',
    notes: document.getElementById('calEventNotes')?.value.trim() || '',
    meetLink: document.getElementById('calEventMeet')?.value.trim() || '',
    assignee,
    assigneeName: assignee ? (assignee.split('@')[0]) : 'All',
    jobId: document.getElementById('calEventJob')?.value || '',
    color: assignee ? (_teamColors[assignee] || 'var(--amber)') : 'var(--amber)',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || ''
  };

  const col = coll('calendarEvents');
  const promise = id ? col.doc(id).update(data)
    : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  promise.then(() => kClose('calEventModal'))
    .catch(e => alert('Error: ' + e.message));
}

function deleteCalEvent() {
  const id = document.getElementById('calEventId')?.value;
  if (!id || !confirm('Delete this event?')) return;
  coll('calendarEvents').doc(id).delete()
    .then(() => kClose('calEventModal'))
    .catch(e => alert('Error: ' + e.message));
}

function generateMeetLink() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (n) => Array.from({length:n}, () => chars[Math.floor(Math.random()*26)]).join('');
  const link = 'https://meet.google.com/' + seg(3) + '-' + seg(4) + '-' + seg(3);
  const el = document.getElementById('calEventMeet');
  if (el) { el.value = link; el.select(); }
}
window.generateMeetLink = generateMeetLink;

// Expose
window.openCalEventModal = openCalEventModal;
window.saveCalEvent = saveCalEvent;
window.deleteCalEvent = deleteCalEvent;
window.loadCalendarEvents = loadCalendarEvents;

// ════════════════════════════════════════════════════
// ── REPORTS & ANALYTICS ──
// ════════════════════════════════════════════════════
let _activeReport = 'overview';

function switchReport(report, btn) {
  _activeReport = report;
  document.querySelectorAll('#reportTabs .con-subtab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderActiveReport();
}

function getReportDateFilter() {
  const range = document.getElementById('reportDateRange')?.value || 'all';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const thisYear = now.getFullYear() + '';
  const thisMonth = today.slice(0,7);
  const last30 = new Date(now - 30*86400000).toISOString().split('T')[0];
  const last90 = new Date(now - 90*86400000).toISOString().split('T')[0];
  return { range, today, thisYear, thisMonth, last30, last90 };
}

function filterJobsByDate(jobs, f) {
  if (f.range === 'all') return jobs;
  return jobs.filter(j => {
    const d = j.startDate || j.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || '';
    if (f.range === 'thisYear') return d.startsWith(f.thisYear);
    if (f.range === 'thisMonth') return d.startsWith(f.thisMonth);
    if (f.range === 'last30') return d >= f.last30;
    if (f.range === 'last90') return d >= f.last90;
    return true;
  });
}

function renderActiveReport() {
  const el = document.getElementById('reportContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading report...</div>';
  const f = getReportDateFilter();
  const jobs = filterJobsByDate(conJobs, f);
  switch (_activeReport) {
    case 'overview': renderOverviewReport(el, jobs, f); break;
    case 'jobs': renderJobsPnLReport(el, jobs); break;
    case 'pipeline': renderPipelineReport(el); break;
    case 'time': renderLaborReport(el, f); break;
    case 'invoices': renderInvoicesReport(el, f); break;
    case 'vendors': renderVendorsReport(el); break;
  }
}

// ── OVERVIEW REPORT ──
function renderOverviewReport(el, jobs, f) {
  const totalContract = jobs.reduce((s,j) => s+getJobValue(j), 0);
  const totalEstCost = jobs.reduce((s,j) => s+(j.estCost||0), 0);
  const totalActual = jobs.reduce((s,j) => s+(j.actualCost||0), 0);
  const estMargin = totalContract - totalEstCost;
  const actMargin = totalContract - totalActual;
  const estMarginPct = totalContract ? Math.round(estMargin/totalContract*100) : 0;
  const actMarginPct = totalContract ? Math.round(actMargin/totalContract*100) : 0;

  const activeJobs = jobs.filter(j => ['Work In Progress','Scheduled','Approved','Design Phase','Permitting'].includes(j.status));
  const wonJobs = jobs.filter(j => j.status === 'Closed Won');
  const lostJobs = jobs.filter(j => j.status === 'Closed Lost');
  const winRate = (wonJobs.length + lostJobs.length) > 0
    ? Math.round(wonJobs.length / (wonJobs.length + lostJobs.length) * 100) : 0;

  // Revenue by month (last 6 months)
  const monthlyRevenue = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0,7);
    monthlyRevenue[key] = 0;
  }
  jobs.forEach(j => {
    const key = (j.startDate||'').slice(0,7);
    if (key && monthlyRevenue[key] !== undefined) monthlyRevenue[key] += getJobValue(j);
  });

  const maxRev = Math.max(...Object.values(monthlyRevenue), 1);

  el.innerHTML = `
    <!-- KPI Strip -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      ${kpiCard('Total Contract Value','$'+Math.round(totalContract).toLocaleString(),'#eaf0fb')}
      ${kpiCard('Estimated Margin','$'+Math.round(estMargin).toLocaleString()+' ('+estMarginPct+'%)','#f59e0b')}
      ${kpiCard('Actual Margin','$'+Math.round(actMargin).toLocaleString()+' ('+actMarginPct+'%)',actMarginPct>=estMarginPct?'#1dbb87':'#ef5350')}
      ${kpiCard('Active Jobs',activeJobs.length,'#3b82f6')}
      ${kpiCard('Jobs Won',wonJobs.length,'#1dbb87')}
      ${kpiCard('Win Rate',winRate+'%',winRate>=50?'#1dbb87':'#f59e0b')}
    </div>

    <!-- Revenue chart -->
    <div class="kt-card" style="margin-bottom:16px">
      <div class="kt-card-head"><h3>📈 Contract Value by Month</h3></div>
      <div class="kt-card-body" style="padding:16px 20px">
        <div style="display:flex;align-items:flex-end;gap:8px;height:140px">
          ${Object.entries(monthlyRevenue).map(([month, rev]) => {
            const pct = Math.round((rev/maxRev)*100);
            const label = month.slice(5) + '/' + month.slice(2,4);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:.68rem;color:var(--amber);font-weight:700">${rev>0?'$'+Math.round(rev/1000)+'k':''}</div>
              <div style="width:100%;background:linear-gradient(180deg,var(--amber),var(--amber2));border-radius:4px 4px 0 0;min-height:4px" style="height:${pct}%"></div>
              <div style="font-size:.68rem;color:var(--muted)">${label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Job status breakdown -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="kt-card">
        <div class="kt-card-head"><h3>🔧 Jobs by Status</h3></div>
        <div class="kt-card-body">
          ${KYTRAC_STATUSES.map(s => {
            const count = jobs.filter(j => j.status === s.name).length;
            if (!count) return '';
            const val = jobs.filter(j => j.status === s.name).reduce((sum,j) => sum+getJobValue(j), 0);
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07)">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
                <span style="font-size:.84rem">${s.name}</span>
              </div>
              <div style="text-align:right">
                <span style="font-weight:700;color:${s.color}">${count}</span>
                <span style="font-size:.74rem;color:var(--muted);margin-left:8px">$${Math.round(val/1000)||0}k</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="kt-card">
        <div class="kt-card-head"><h3>🏗 Jobs by Type</h3></div>
        <div class="kt-card-body">
          ${(() => {
            const types = {};
            jobs.forEach(j => { const t = j.type||'Other'; types[t] = (types[t]||0) + 1; });
            return Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([type,count]) =>
              `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(110,145,210,.07)">
                <span style="font-size:.84rem">${esc(type)}</span>
                <span style="font-weight:700;color:var(--amber)">${count}</span>
              </div>`
            ).join('') || '<p class="muted">No data</p>';
          })()}
        </div>
      </div>
    </div>`;
}

// ── JOBS P&L REPORT ──
function renderJobsPnLReport(el, jobs) {
  const sorted = [...jobs].sort((a,b) => (b.contractValue||0)-(a.contractValue||0));
  el.innerHTML = `
    <div class="kt-card">
      <div class="kt-card-head"><h3>🔧 Job Profit & Loss</h3></div>
      <div style="overflow-x:auto">
        <table class="kt-table">
          <thead><tr>
            <th>Job</th><th>Status</th><th style="text-align:right">Contract</th>
            <th style="text-align:right">Est. Cost</th><th style="text-align:right">Actual Cost</th>
            <th style="text-align:right">Est. Margin</th><th style="text-align:right">Act. Margin</th>
            <th style="text-align:right">Margin %</th>
          </tr></thead>
          <tbody>
            ${sorted.map(j => {
              const contract = getJobValue(j);
              const estCost = j.estCost||0;
              const actual = j.actualCost||0;
              const estMargin = contract - estCost;
              const actMargin = contract - actual;
              const marginPct = contract ? Math.round(actMargin/contract*100) : 0;
              const pctColor = marginPct >= 20 ? '#1dbb87' : marginPct >= 10 ? '#f59e0b' : '#ef5350';
              const s = KYTRAC_STATUSES.find(x=>x.name===j.status)||{color:'var(--amber)'};
              return `<tr>
                <td><div style="font-weight:700">${esc(j.name)}</div><div style="font-size:.72rem;color:var(--amber)">${esc(j.jobNumber||'')}</div></td>
                <td><span style="font-size:.72rem;font-weight:700;color:${s.color}">${j.status}</span></td>
                <td style="text-align:right;font-weight:700">$${Math.round(contract).toLocaleString()}</td>
                <td style="text-align:right;color:var(--muted)">$${Math.round(estCost).toLocaleString()}</td>
                <td style="text-align:right;color:var(--muted)">$${Math.round(actual).toLocaleString()}</td>
                <td style="text-align:right;color:#f59e0b">$${Math.round(estMargin).toLocaleString()}</td>
                <td style="text-align:right;color:${actMargin>=0?'#1dbb87':'#ef5350'}">$${Math.round(actMargin).toLocaleString()}</td>
                <td style="text-align:right;font-weight:800;color:${pctColor}">${marginPct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr style="background:rgba(217,119,6,.06);font-weight:800">
            <td colspan="2" style="padding:10px 12px">TOTALS (${sorted.length} jobs)</td>
            <td style="text-align:right;padding:10px 12px">$${Math.round(sorted.reduce((s,j)=>s+getJobValue(j),0)).toLocaleString()}</td>
            <td style="text-align:right;padding:10px 12px">$${Math.round(sorted.reduce((s,j)=>s+(j.estCost||0),0)).toLocaleString()}</td>
            <td style="text-align:right;padding:10px 12px">$${Math.round(sorted.reduce((s,j)=>s+(j.actualCost||0),0)).toLocaleString()}</td>
            <td style="text-align:right;padding:10px 12px;color:#f59e0b">$${Math.round(sorted.reduce((s,j)=>s+getJobValue(j)-(j.estCost||0),0)).toLocaleString()}</td>
            <td style="text-align:right;padding:10px 12px;color:#1dbb87">$${Math.round(sorted.reduce((s,j)=>s+getJobValue(j)-(j.actualCost||0),0)).toLocaleString()}</td>
            <td style="text-align:right;padding:10px 12px"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
}

// ── PIPELINE REPORT ──
function renderPipelineReport(el) {
  const stages = KYTRAC_STATUSES.map(s => {
    const stageJobs = conJobs.filter(j => j.status === s.name);
    const value = stageJobs.reduce((sum,j) => sum+getJobValue(j), 0);
    return { ...s, count: stageJobs.length, value };
  }).filter(s => s.count > 0);

  const totalValue = stages.reduce((s,x) => s+x.value, 0);

  el.innerHTML = `
    <div class="kt-card" style="margin-bottom:16px">
      <div class="kt-card-head"><h3>💰 Pipeline Value by Stage</h3><span style="font-weight:700;color:var(--amber)">Total: $${Math.round(totalValue).toLocaleString()}</span></div>
      <div class="kt-card-body">
        ${stages.map(s => {
          const pct = totalValue ? Math.round(s.value/totalValue*100) : 0;
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:.84rem;font-weight:700;color:${s.color}">${s.name}</span>
              <span style="font-size:.82rem;color:#eaf0fb">${s.count} job${s.count!==1?'s':''} · <strong>$${Math.round(s.value).toLocaleString()}</strong></span>
            </div>
            <div style="height:8px;background:rgba(110,145,210,.1);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${s.color};border-radius:4px;transition:width .4s"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── LABOR REPORT ──
function renderLaborReport(el, f) {
  const entries = allTimeEntries.filter(e => {
    if (!e.date) return false;
    if (f.range === 'thisMonth') return e.date.startsWith(f.thisMonth);
    if (f.range === 'last30') return e.date >= f.last30;
    if (f.range === 'last90') return e.date >= f.last90;
    if (f.range === 'thisYear') return e.date.startsWith(f.thisYear);
    return true;
  });

  // Group by employee
  const byEmployee = {};
  entries.forEach(e => {
    const key = e.userEmail || e.userName || 'Unknown';
    if (!byEmployee[key]) byEmployee[key] = { name: e.userName||key, hours: 0, entries: 0, jobs: new Set() };
    byEmployee[key].hours += e.hours||0;
    byEmployee[key].entries++;
    if (e.jobName) byEmployee[key].jobs.add(e.jobName);
  });

  const totalHours = entries.reduce((s,e) => s+(e.hours||0), 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px">
      ${kpiCard('Total Hours',totalHours.toFixed(1)+'h','var(--amber)')}
      ${kpiCard('Employees Tracked',Object.keys(byEmployee).length,'#3b82f6')}
      ${kpiCard('Time Entries',entries.length,'#eaf0fb')}
    </div>
    <div class="kt-card">
      <div class="kt-card-head"><h3>⏱ Labor by Employee</h3></div>
      <div style="overflow-x:auto">
        <table class="kt-table">
          <thead><tr>
            <th>Employee</th><th style="text-align:right">Hours</th>
            <th style="text-align:right">Entries</th><th>Jobs</th>
          </tr></thead>
          <tbody>
            ${Object.values(byEmployee).sort((a,b)=>b.hours-a.hours).map(emp => `
              <tr>
                <td style="font-weight:700">${esc(emp.name)}</td>
                <td style="text-align:right;font-weight:800;color:var(--amber)">${emp.hours.toFixed(1)}h</td>
                <td style="text-align:right;color:var(--muted)">${emp.entries}</td>
                <td style="font-size:.78rem;color:var(--muted)">${[...emp.jobs].slice(0,3).join(', ')}${emp.jobs.size>3?' +more':''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── INVOICES REPORT ──
function renderInvoicesReport(el, f) {
  // Load all invoices across all jobs
  if (!conDb) return;
  let allInvs = [];
  let pending = conJobs.length || 1;
  if (!conJobs.length) {
    el.innerHTML = '<p class="muted">No jobs to report on.</p>';
    return;
  }
  conJobs.forEach(job => {
    coll('jobs').doc(job.id).collection('invoices').get()
      .then(snap => {
        snap.forEach(d => allInvs.push({ ...d.data(), jobName: job.name, jobId: job.id }));
      }).catch(() => {})
      .finally(() => {
        pending--;
        if (pending === 0) renderInvoicesTable(el, allInvs, f);
      });
  });
}

function renderInvoicesTable(el, allInvs, f) {
  let invs = allInvs;
  if (f.range !== 'all') {
    invs = invs.filter(inv => {
      const d = inv.date||'';
      if (f.range === 'thisMonth') return d.startsWith(f.thisMonth);
      if (f.range === 'last30') return d >= f.last30;
      if (f.range === 'last90') return d >= f.last90;
      if (f.range === 'thisYear') return d.startsWith(f.thisYear);
      return true;
    });
  }

  const totalInvoiced = invs.reduce((s,i)=>s+(i.total||0),0);
  const totalPaid = invs.reduce((s,i)=>s+(i.amtPaid||0),0);
  const totalOutstanding = totalInvoiced - totalPaid;
  const overdue = invs.filter(i=>i.status==='Overdue').length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px">
      ${kpiCard('Total Invoiced','$'+Math.round(totalInvoiced).toLocaleString(),'#eaf0fb')}
      ${kpiCard('Collected','$'+Math.round(totalPaid).toLocaleString(),'#1dbb87')}
      ${kpiCard('Outstanding','$'+Math.round(totalOutstanding).toLocaleString(),'#f59e0b')}
      ${kpiCard('Overdue',overdue,'#ef5350')}
    </div>
    <div class="kt-card">
      <div class="kt-card-head"><h3>🧾 All Invoices</h3><span class="small muted">${invs.length} invoices</span></div>
      <div style="overflow-x:auto;max-height:400px">
        <table class="kt-table">
          <thead><tr>
            <th>Invoice #</th><th>Job</th><th>Date</th><th>Due</th>
            <th style="text-align:right">Amount</th><th style="text-align:right">Paid</th>
            <th style="text-align:right">Balance</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${invs.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(inv => {
              const bal = (inv.total||0)-(inv.amtPaid||0);
              const sc = {Draft:'var(--muted)',Sent:'#3b82f6',Paid:'#1dbb87',Overdue:'#ef5350',Partial:'#f97316'};
              return `<tr>
                <td style="color:var(--amber);font-weight:700">${esc(inv.number||'—')}</td>
                <td style="font-size:.82rem">${esc(inv.jobName||'—')}</td>
                <td style="font-size:.82rem">${inv.date||'—'}</td>
                <td style="font-size:.82rem">${inv.dueDate||'—'}</td>
                <td style="text-align:right;font-weight:700">$${(inv.total||0).toLocaleString()}</td>
                <td style="text-align:right;color:#1dbb87">$${(inv.amtPaid||0).toLocaleString()}</td>
                <td style="text-align:right;font-weight:700;color:${bal>0?'#f59e0b':'#1dbb87'}">$${bal.toLocaleString()}</td>
                <td><span style="font-size:.72rem;font-weight:700;color:${sc[inv.status||'Draft']||'var(--muted)'}">${inv.status||'Draft'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── VENDORS AP REPORT ──
function renderVendorsReport(el) {
  if (!allVendors.length) {
    el.innerHTML = '<p class="muted" style="padding:20px">No vendors added yet.</p>';
    return;
  }
  el.innerHTML = `
    <div class="kt-card">
      <div class="kt-card-head"><h3>🏭 Vendors & Accounts Payable</h3></div>
      <div style="overflow-x:auto">
        <table class="kt-table">
          <thead><tr>
            <th>Vendor</th><th>Trade</th><th>Status</th>
            <th>Insurance Exp.</th><th style="text-align:right">Bills Total</th>
            <th style="text-align:right">Paid</th><th style="text-align:right">Outstanding</th>
          </tr></thead>
          <tbody id="vendorReportBody">
            <tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  // Load bills for each vendor
  const tbody = document.getElementById('vendorReportBody');
  let rows = [];
  let pending = allVendors.length;
  const today = new Date().toISOString().split('T')[0];

  allVendors.forEach(v => {
    coll('vendors').doc(v.id).collection('bills').get()
      .then(snap => {
        let total = 0, paid = 0;
        snap.forEach(d => { const b = d.data(); total += b.amount||0; paid += b.amtPaid||0; });
        const outstanding = total - paid;
        const insExp = v.insExp || '';
        const insExpired = insExp && insExp < today;
        const insWarn = insExp && !insExpired && insExp <= new Date(Date.now()+30*86400000).toISOString().split('T')[0];
        const insClass = insExpired ? '#ef5350' : insWarn ? '#f59e0b' : '#1dbb87';
        rows.push({ v, total, paid, outstanding, insClass, insExp });
      }).catch(() => {
        rows.push({ v, total:0, paid:0, outstanding:0, insClass:'var(--muted)', insExp:'' });
      }).finally(() => {
        pending--;
        if (pending === 0) {
          rows.sort((a,b) => b.outstanding - a.outstanding);
          if (tbody) tbody.innerHTML = rows.map(r => `
            <tr>
              <td style="font-weight:700">${esc(r.v.name)}</td>
              <td style="font-size:.78rem;color:var(--muted)">${esc(r.v.trade||'')}</td>
              <td style="font-size:.74rem;font-weight:700;color:${r.v.status==='Active'?'#1dbb87':'var(--muted)'}">${r.v.status||'Active'}</td>
              <td style="font-size:.78rem;color:${r.insClass}">${r.insExp||'—'}</td>
              <td style="text-align:right;font-weight:700">$${Math.round(r.total).toLocaleString()}</td>
              <td style="text-align:right;color:#1dbb87">$${Math.round(r.paid).toLocaleString()}</td>
              <td style="text-align:right;font-weight:800;color:${r.outstanding>0?'#f59e0b':'#1dbb87'}">$${Math.round(r.outstanding).toLocaleString()}</td>
            </tr>`).join('');
        }
      });
  });
}

// ── Shared KPI card helper ──
function kpiCard(label, value, color) {
  return `<div class="kt-stat">
    <div class="kt-stat-val" style="color:${color}">${value}</div>
    <div class="kt-stat-label">${label}</div>
  </div>`;
}

// ── Export to CSV ──
function exportReport() {
  let csv = '';
  const f = getReportDateFilter();
  const jobs = filterJobsByDate(conJobs, f);

  function csvRow(...fields) { return fields.map(f => '"'+String(f||'').replace(/"/g,'""')+'"').join(',') + '\n'; }
  if (_activeReport === 'overview' || _activeReport === 'jobs') {
    csv = 'Job Name,Job Number,Status,Type,Contract Value,Est Cost,Actual Cost,Est Margin,Act Margin,Margin %,Start Date\n';
    jobs.forEach(j => {
      const c = getJobValue(j), ec = j.estCost||0, a = j.actualCost||0;
      const actM = c-a, pct = c ? Math.round(actM/c*100) : 0;
      csv += csvRow(j.name,j.jobNumber,j.status,j.type,c,ec,a,c-ec,actM,pct+'%',j.startDate);
    });
  } else if (_activeReport === 'time') {
    csv = 'Employee,Email,Job,Date,Clock In,Clock Out,Hours,Notes\n';
    allTimeEntries.forEach(e => {
      csv += csvRow(e.userName,e.userEmail,e.jobName,e.date,e.clockInISO,e.clockOutISO,e.hours||0,e.notes);
    });
  }

  if (!csv) { alert('Export not available for this report yet.'); return; }
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kytrac-report-${_activeReport}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// Expose
window.switchReport = switchReport;
window.renderActiveReport = renderActiveReport;
window.exportReport = exportReport;

// ════════════════════════════════════════════════════
// ── PURCHASE ORDERS ──
// ════════════════════════════════════════════════════
let allPOs = [];
let _poLineItems = [];

function loadPOs() {
  if (!conDb) return;
  coll('purchaseOrders')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allPOs = [];
      snap.forEach(doc => allPOs.push({ id: doc.id, ...doc.data() }));
      renderPOs();
      updatePOBadge();
      populatePOFilters();
    }, () => {});
}

function updatePOBadge() {
  const pending = allPOs.filter(p => p.status === 'Sent' || p.status === 'Partial').length;
  const badge = document.getElementById('navPOBadge');
  if (badge) { badge.style.display = pending > 0 ? 'inline-flex' : 'none'; badge.textContent = pending; }
}

function populatePOFilters() {
  const jobSel = document.getElementById('poJobFilter');
  if (jobSel) {
    const cur = jobSel.value;
    jobSel.innerHTML = '<option value="">All Jobs</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===cur?'selected':''}>${esc(j.name)}</option>`).join('');
  }
}

function renderPOs() {
  const el = document.getElementById('poList');
  const countEl = document.getElementById('poCount');
  if (!el) return;

  const statusFilter = document.getElementById('poStatusFilter')?.value || '';
  const jobFilter = document.getElementById('poJobFilter')?.value || '';

  let pos = allPOs;
  if (statusFilter) pos = pos.filter(p => p.status === statusFilter);
  if (jobFilter) pos = pos.filter(p => p.jobId === jobFilter);

  // Stats
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('poStatTotal', allPOs.length);
  setEl('poStatValue', '$' + Math.round(allPOs.reduce((s,p) => s+(p.total||0), 0)).toLocaleString());
  setEl('poStatPending', allPOs.filter(p => p.status==='Sent'||p.status==='Partial').length);
  setEl('poStatReceived', allPOs.filter(p => p.status==='Received').length);
  if (countEl) countEl.textContent = `${allPOs.length} purchase order${allPOs.length!==1?'s':''} total`;

  if (!pos.length) {
    el.innerHTML = `<div class="kt-card"><div style="text-align:center;padding:40px;color:var(--muted);font-style:italic">
      ${allPOs.length===0 ? 'No purchase orders yet. Create your first PO above.' : 'No POs match your filters.'}
    </div></div>`;
    return;
  }

  const statusColors = { Draft:'var(--muted)', Sent:'#93c5fd', Received:'#a3f2d2', Partial:'#fed7aa', Cancelled:'#fca5a5' };
  const statusBg = { Draft:'rgba(110,145,210,.1)', Sent:'rgba(59,130,246,.12)', Received:'rgba(29,187,135,.12)', Partial:'rgba(249,115,22,.12)', Cancelled:'rgba(239,83,80,.12)' };

  el.innerHTML = pos.map(po => {
    const job = conJobs.find(j => j.id === po.jobId);
    const sc = statusColors[po.status||'Draft'] || 'var(--muted)';
    const sbg = statusBg[po.status||'Draft'] || 'rgba(110,145,210,.1)';
    const itemCount = (po.lineItems||[]).length;
    const isOverdue = po.deliveryDate && po.deliveryDate < new Date().toISOString().split('T')[0] && po.status !== 'Received' && po.status !== 'Cancelled';

    return `<div class="po-card" onclick="openPOModal('${po.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:800;color:var(--amber)">${esc(po.number||'PO')}</span>
            <span style="font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;color:${sc};background:${sbg}">${po.status||'Draft'}</span>
            ${isOverdue?'<span style="font-size:.7rem;color:#fca5a5;font-weight:700">⚠️ Overdue</span>':''}
          </div>
          <div style="font-weight:700;font-size:.92rem;margin-top:4px">${esc(po.vendorName||'No vendor')}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">
            ${job?`<span>🔧 ${esc(job.name)}</span>`:''}
            ${po.date?`<span>📅 ${po.date}</span>`:''}
            ${po.deliveryDate?`<span style="color:${isOverdue?'#fca5a5':'var(--muted)'}">🚚 Due: ${po.deliveryDate}</span>`:''}
            <span>${itemCount} item${itemCount!==1?'s':''}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1.2rem;font-weight:900;color:#eaf0fb">$${(po.total||0).toLocaleString()}</div>
          ${po.notes?`<div style="font-size:.74rem;color:var(--muted);max-width:160px;text-align:right">${esc(po.notes.slice(0,50))}${po.notes.length>50?'…':''}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── PO Modal ──
function openPOModal(id) {
  const po = id ? allPOs.find(p => p.id === id) : null;
  document.getElementById('poModalTitle').textContent = po ? 'Edit Purchase Order' : 'New Purchase Order';
  document.getElementById('poId').value = id || '';

  // Auto-generate PO number
  if (!po) {
    const num = 'PO-' + new Date().getFullYear() + '-' + String(allPOs.length + 1).padStart(3,'0');
    document.getElementById('poNumber').value = num;
  } else {
    document.getElementById('poNumber').value = po.number || '';
  }

  const setVal = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val||''; };
  setVal('poDate', po?.date || new Date().toISOString().split('T')[0]);
  setVal('poDelivery', po?.deliveryDate);
  setVal('poStatus', po?.status || 'Draft');
  setVal('poShipTo', po?.shipTo);
  setVal('poNotes', po?.notes);

  // Populate vendor dropdown
  const vendorSel = document.getElementById('poVendor');
  if (vendorSel) {
    vendorSel.innerHTML = '<option value="">Select vendor...</option>' +
      allVendors.map(v => `<option value="${v.id}" data-name="${esc(v.name)}" ${v.id===(po?.vendorId||'')?'selected':''}>${esc(v.name)} — ${esc(v.trade||'')}</option>`).join('');
  }

  // Populate job dropdown
  const jobSel = document.getElementById('poJob');
  if (jobSel) {
    jobSel.innerHTML = '<option value="">No job linked</option>' +
      conJobs.map(j => `<option value="${j.id}" ${j.id===(po?.jobId||'')?'selected':''}>${esc(j.name)}</option>`).join('');
    if (po?.jobId) jobSel.value = po.jobId;
  }

  // Pre-fill ship to from job address
  if (!po) {
    const firstActiveJob = conJobs.find(j => ['Work In Progress','Scheduled','Approved'].includes(j.status));
    if (firstActiveJob?.address) setVal('poShipTo', firstActiveJob.address);
  }

  // Line items
  _poLineItems = po?.lineItems ? [...po.lineItems] : [{ desc:'', qty:1, unitCost:0 }];
  renderPOLineItems();

  document.getElementById('deletePOBtn').style.display = id ? 'inline-flex' : 'none';
  kOpen('poModal');
}

function prefillVendorContact() {
  const sel = document.getElementById('poVendor');
  const vendorId = sel?.value;
  const vendor = allVendors.find(v => v.id === vendorId);
  if (vendor?.address) {
    const shipTo = document.getElementById('poShipTo');
    if (shipTo && !shipTo.value) shipTo.value = vendor.address;
  }
}

function renderPOLineItems() {
  const el = document.getElementById('poLineItems');
  if (!el) return;

  el.innerHTML = _poLineItems.map((item, i) => `
    <div style="display:grid;grid-template-columns:2fr 80px 100px 100px 32px;gap:6px;margin-bottom:6px;align-items:center">
      <input value="${esc(item.desc||'')}" placeholder="Description" style="font-size:.84rem" onchange="_poLineItems[${i}].desc=this.value;updatePOTotal()" />
      <input type="number" value="${item.qty||1}" min="1" style="font-size:.84rem;text-align:right" onchange="_poLineItems[${i}].qty=parseFloat(this.value)||1;updatePOTotal()" />
      <input type="number" value="${item.unitCost||0}" step="0.01" placeholder="0.00" style="font-size:.84rem;text-align:right" onchange="_poLineItems[${i}].unitCost=parseFloat(this.value)||0;updatePOTotal()" />
      <div style="text-align:right;font-weight:700;font-size:.88rem;color:var(--amber)">$${((item.qty||1)*(item.unitCost||0)).toFixed(2)}</div>
      <button onclick="_poLineItems.splice(${i},1);renderPOLineItems()" style="background:none;border:none;color:rgba(239,83,80,.5);cursor:pointer;font-size:1rem">✕</button>
    </div>`).join('');

  updatePOTotal();
}

function addPOLineItem() {
  _poLineItems.push({ desc:'', qty:1, unitCost:0 });
  renderPOLineItems();
  // Focus last description field
  setTimeout(() => {
    const inputs = document.querySelectorAll('#poLineItems input[placeholder="Description"]');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 50);
}

function updatePOTotal() {
  const total = _poLineItems.reduce((s, item) => s + (item.qty||1)*(item.unitCost||0), 0);
  const el = document.getElementById('poTotal');
  if (el) el.textContent = '$' + total.toFixed(2);
}

function savePO(status) {
  const vendorSel = document.getElementById('poVendor');
  const vendorId = vendorSel?.value;
  const vendorName = vendorId ? (allVendors.find(v=>v.id===vendorId)?.name||'') : '';
  if (!vendorId) { alert('Please select a vendor.'); return; }

  const id = document.getElementById('poId')?.value;
  const total = _poLineItems.reduce((s,i) => s+(i.qty||1)*(i.unitCost||0), 0);

  const data = {
    number: document.getElementById('poNumber')?.value || '',
    date: document.getElementById('poDate')?.value || '',
    deliveryDate: document.getElementById('poDelivery')?.value || '',
    status: status || document.getElementById('poStatus')?.value || 'Draft',
    vendorId,
    vendorName,
    jobId: document.getElementById('poJob')?.value || '',
    shipTo: document.getElementById('poShipTo')?.value.trim() || '',
    notes: document.getElementById('poNotes')?.value.trim() || '',
    lineItems: _poLineItems.filter(i => i.desc || i.unitCost),
    total,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: conCurrentUser?.email || ''
  };

  const col = coll('purchaseOrders');
  const promise = id ? col.doc(id).update(data)
    : col.add({ ...data, companyId: currentCompanyId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: conCurrentUser?.email||'' });

  promise.then(() => {
    kClose('poModal');
    if (status === 'Sent') {
      const vendor = allVendors.find(v => v.id === vendorId);
      if (vendor?.email) {
        window.open(`mailto:${vendor.email}?subject=Purchase Order ${data.number}&body=Please see Purchase Order ${data.number} for $${total.toFixed(2)}. Total items: ${data.lineItems.length}.`);
      }
    }
  }).catch(e => alert('Error: ' + e.message));
}

function deletePO() {
  const id = document.getElementById('poId')?.value;
  if (!id || !confirm('Delete this purchase order?')) return;
  coll('purchaseOrders').doc(id).delete()
    .then(() => kClose('poModal'))
    .catch(e => alert('Error: ' + e.message));
}

// Expose PO functions
window.openPOModal = openPOModal;
window.savePO = savePO;
window.deletePO = deletePO;
window.renderPOs = renderPOs;
window.addPOLineItem = addPOLineItem;
window.prefillVendorContact = prefillVendorContact;

// ════════════════════════════════════════════════════
// ── AI DAILY LOG SUMMARY ──
// ════════════════════════════════════════════════════

async function generateAILogSummary(logId, jobName) {
  // Find the log
  let log = null;
  if (logId) {
    // Try to find in current context - look in the DOM or pass log data directly
    log = window._currentLogForAI;
  }
  if (!log) return;

  const summaryContainer = document.getElementById('aiSummaryContainer_' + logId);
  if (!summaryContainer) return;

  summaryContainer.innerHTML = `<div class="ai-summary-box">
    <div class="ai-summary-header">
      <div class="ai-pulse"></div>
      <span style="font-size:.82rem;font-weight:700;color:#8b5cf6">KYTHY is writing your update...</span>
    </div>
    <div style="font-size:.84rem;color:var(--muted);font-style:italic">Generating professional client summary...</div>
  </div>`;

  try {
    const prompt = `You are writing a professional daily update for a homeowner about work done on their construction project.

Project: ${jobName}
Date: ${log.date || 'Today'}
Weather: ${log.weather || 'Not noted'}
Crew on site: ${log.crewCount || 'Not noted'}
Hours worked: ${log.hoursWorked || 'Not noted'}
Raw field notes: ${log.notes || 'No notes'}
Issues noted: ${log.issues || 'None'}

Write a professional, friendly 3-4 sentence daily update for the homeowner. Be specific about the work completed, use plain language (no construction jargon), and end with what to expect next. Do not mention hours or internal crew details. Make it warm and reassuring.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text || 'Could not generate summary.';

    summaryContainer.innerHTML = `<div class="ai-summary-box">
      <div class="ai-summary-header">
        <span style="font-size:.9rem">✨</span>
        <span style="font-size:.82rem;font-weight:700;color:#8b5cf6">KYTHY — Client Summary</span>
        <button onclick="copyAISummary('${logId}')" class="btn" style="margin-left:auto;font-size:.72rem;padding:2px 8px">📋 Copy</button>
        <button onclick="document.getElementById('aiSummaryContainer_${logId}').innerHTML=''" class="btn" style="font-size:.72rem;padding:2px 8px">✕</button>
      </div>
      <div id="aiSummaryText_${logId}" style="font-size:.88rem;color:#eaf0fb;line-height:1.7;margin-top:6px">${esc(summary)}</div>
      <div style="font-size:.72rem;color:rgba(139,92,246,.5);margin-top:8px">Send this to your client via text or email</div>
    </div>`;
  } catch(e) {
    summaryContainer.innerHTML = `<div class="ai-summary-box">
      <div style="color:#fca5a5;font-size:.84rem">Could not generate summary. Check your connection and try again.</div>
    </div>`;
  }
}

function copyAISummary(logId) {
  const el = document.getElementById('aiSummaryText_' + logId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.previousElementSibling?.querySelector('button');
    // Show copied feedback
    const copyBtns = document.querySelectorAll('[onclick*="copyAISummary"]');
    copyBtns.forEach(b => { if (b.onclick?.toString().includes(logId)) { b.textContent = '✓ Copied!'; setTimeout(()=>b.textContent='📋 Copy',2000); }});
  }).catch(() => {});
}

// ── Patch renderLogList to add AI Summary button ──
const _origRenderLogListAI = window.renderLogList;
window.renderLogList = function() {
  if (typeof _origRenderLogListAI === 'function') _origRenderLogListAI();
  // Add AI buttons to each log card after render
  setTimeout(() => {
    document.querySelectorAll('.log-card').forEach(card => {
      const logId = card.dataset.logId;
      if (!logId || document.getElementById('aiSummaryContainer_' + logId)) return;
      const aiDiv = document.createElement('div');
      aiDiv.id = 'aiSummaryContainer_' + logId;
      const aiBtn = document.createElement('button');
      aiBtn.className = 'btn';
      aiBtn.style.cssText = 'font-size:.74rem;padding:3px 10px;margin-top:8px;background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(59,130,246,.15));color:#c4b5fd;border-color:rgba(139,92,246,.3)';
      aiBtn.textContent = '✨ Generate Client Summary';
      aiBtn.onclick = () => {
        window._currentLogForAI = window._currentLogsData?.find(l => l.id === logId);
        generateAILogSummary(logId, conJobs.find(j=>j.id===conCurrentJobId)?.name||'');
      };
      aiDiv.appendChild(aiBtn);
      card.appendChild(aiDiv);
    });
  }, 200);
};

// ── Also add AI button to global log feed cards ──
const _origRenderGlobalLogs = window.renderGlobalLogs;
window.renderGlobalLogs = function() {
  if (typeof _origRenderGlobalLogs === 'function') _origRenderGlobalLogs();
  setTimeout(() => {
    document.querySelectorAll('.portal-log-card, .kt-card[data-log-id]').forEach(card => {
      const logId = card.dataset?.logId;
      if (!logId || document.getElementById('aiSummaryContainer_' + logId)) return;
      if (!card.querySelector('[data-ai-btn]')) {
        const btn = document.createElement('button');
        btn.setAttribute('data-ai-btn', '1');
        btn.className = 'btn';
        btn.style.cssText = 'font-size:.72rem;padding:2px 8px;margin-top:6px;background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(59,130,246,.15));color:#c4b5fd;border-color:rgba(139,92,246,.3)';
        btn.textContent = '✨ Client Summary';
        card.appendChild(btn);
      }
    });
  }, 300);
};

// ── Standalone AI summary trigger from daily logs ──
function triggerAIForLog(logData, jobName, containerId) {
  window._currentLogForAI = logData;
  const container = document.getElementById(containerId);
  if (!container) return;
  const tempId = 'log_' + Date.now();
  container.id = 'aiSummaryContainer_' + tempId;
  generateAILogSummary(tempId, jobName);
}
window.triggerAIForLog = triggerAIForLog;
window.generateAILogSummary = generateAILogSummary;
window.copyAISummary = copyAISummary;

// ════════════════════════════════════════════════════
// ── BID MANAGEMENT ──
// ════════════════════════════════════════════════════
let _selectedBidVendors = new Set();
let _allBidRequests = []; // for current job

function openBidRequestModal() {
  if (!conCurrentJobId) return;
  const job = conJobs.find(j => j.id === conCurrentJobId);

  // Set defaults
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  document.getElementById('bidDueDate').value = dueDate.toISOString().split('T')[0];
  document.getElementById('bidScope').value = '';
  document.getElementById('bidBudget').value = '';
  document.getElementById('bidAccess').value = job?.address || '';
  document.getElementById('bidTrade').value = '';
  _selectedBidVendors.clear();

  // Populate vendor list
  renderBidVendorList();
  kOpen('bidRequestModal');
}

function renderBidVendorList(filter) {
  const el = document.getElementById('bidVendorList');
  if (!el) return;

  const trade = document.getElementById('bidTrade')?.value || '';
  const q = (filter || document.getElementById('bidVendorSearch')?.value || '').toLowerCase();

  let vendors = allVendors.filter(v => v.status !== 'Inactive' && v.status !== 'On Hold');
  if (trade) vendors = vendors.filter(v => v.trade === trade);
  if (q) vendors = vendors.filter(v =>
    (v.name||'').toLowerCase().includes(q) ||
    (v.trade||'').toLowerCase().includes(q)
  );

  if (!vendors.length) {
    el.innerHTML = `<div class="small muted" style="padding:12px;text-align:center;font-style:italic">
      ${allVendors.length === 0 ? 'No vendors in directory. Add vendors first.' : 'No vendors match this trade/filter.'}
    </div>`;
    updateBidVendorCount();
    return;
  }

  el.innerHTML = vendors.map(v => {
    const checked = _selectedBidVendors.has(v.id);
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;${checked?'background:rgba(59,130,246,.1)':''}" onclick="toggleBidVendor('${v.id}',this)">
      <input type="checkbox" ${checked?'checked':''} style="accent-color:#3b82f6;width:16px;height:16px;flex-shrink:0" onclick="event.stopPropagation()" onchange="toggleBidVendorCheck('${v.id}',this.checked,this.closest('label'))" />
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.86rem">${esc(v.name)}</div>
        <div style="font-size:.74rem;color:var(--muted)">${esc(v.trade||'')}${v.phone?' · '+esc(v.phone):''}${v.email?' · '+esc(v.email):''}</div>
      </div>
      ${v.email?'<span style="font-size:.68rem;color:#1dbb87">✓ email</span>':'<span style="font-size:.68rem;color:#f59e0b">no email</span>'}
    </label>`;
  }).join('');

  updateBidVendorCount();
}

function toggleBidVendor(vendorId, label) {
  const cb = label.querySelector('input[type="checkbox"]');
  if (!cb) return;
  const checked = !cb.checked;
  cb.checked = checked;
  toggleBidVendorCheck(vendorId, checked, label);
}

function toggleBidVendorCheck(vendorId, checked, label) {
  if (checked) {
    _selectedBidVendors.add(vendorId);
    if (label) label.style.background = 'rgba(59,130,246,.1)';
  } else {
    _selectedBidVendors.delete(vendorId);
    if (label) label.style.background = '';
  }
  updateBidVendorCount();
}

function filterBidVendors() {
  renderBidVendorList();
}

function selectAllBidVendors() {
  allVendors.forEach(v => _selectedBidVendors.add(v.id));
  renderBidVendorList();
}

function clearBidVendors() {
  _selectedBidVendors.clear();
  renderBidVendorList();
}

function updateBidVendorCount() {
  const el = document.getElementById('bidVendorCount');
  if (el) el.textContent = `${_selectedBidVendors.size} vendor${_selectedBidVendors.size!==1?'s':''} selected`;
}

function sendBidRequests() {
  const trade = document.getElementById('bidTrade')?.value;
  const scope = document.getElementById('bidScope')?.value.trim();
  const dueDate = document.getElementById('bidDueDate')?.value;

  if (!trade) { alert('Please select a trade.'); return; }
  if (!scope) { alert('Please describe the scope of work.'); return; }
  if (_selectedBidVendors.size === 0) { alert('Please select at least one vendor.'); return; }

  const job = conJobs.find(j => j.id === conCurrentJobId);
  const budget = document.getElementById('bidBudget')?.value || '';
  const access = document.getElementById('bidAccess')?.value || '';

  // Save bid request to Firestore
  const bidRequestData = {
    jobId: conCurrentJobId,
    jobName: job?.name || '',
    jobAddress: job?.address || '',
    trade,
    scope,
    dueDate,
    budget,
    access,
    status: 'Sent',
    vendors: Array.from(_selectedBidVendors).map(id => {
      const v = allVendors.find(x => x.id === id);
      return { vendorId: id, vendorName: v?.name||'', vendorEmail: v?.email||'', bidStatus: 'Pending', bidAmount: null };
    }),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
    sentDate: new Date().toISOString().split('T')[0]
  };

  coll('jobs').doc(conCurrentJobId).collection('bidRequests').add(bidRequestData)
    .then(ref => {
      kClose('bidRequestModal');

      // Open mailto links for vendors with email
      const vendorsWithEmail = bidRequestData.vendors.filter(v => v.vendorEmail);
      if (vendorsWithEmail.length > 0) {
        const co = companyProfile;
        const subject = encodeURIComponent(`Bid Request: ${job?.name||'Construction Project'} — ${trade}`);
        const body = encodeURIComponent(
          `Dear [Vendor Name],

` +
          `${co.companyName||'We'} would like to invite you to bid on the following project:

` +
          `PROJECT: ${job?.name||''}
` +
          `ADDRESS: ${job?.address||''}
` +
          `TRADE NEEDED: ${trade}

` +
          `SCOPE OF WORK:
${scope}

` +
          (budget ? `BUDGET RANGE: ${budget}

` : '') +
          (access ? `SITE ACCESS: ${access}

` : '') +
          `BID DUE DATE: ${dueDate}

` +
          `Please reply with your detailed bid by the due date above.

` +
          `Thank you,
${co.companyName||''}
${co.phone||''}
${co.email||''}`
        );

        // Open email for each vendor
        vendorsWithEmail.forEach((v, i) => {
          setTimeout(() => {
            window.open(`mailto:${v.vendorEmail}?subject=${subject}&body=${body}`, '_blank');
          }, i * 500);
        });

        alert(`Bid requests sent to ${vendorsWithEmail.length} vendor${vendorsWithEmail.length!==1?'s':''}!

Vendors without email (${bidRequestData.vendors.length - vendorsWithEmail.length}) need to be contacted manually.

Bid request saved — go to the Subs tab to track incoming bids.`);
      } else {
        alert('Bid request saved. No vendors had email addresses — contact them directly. Track bids in the Subs tab.');
      }

      // Reload subs/bids
      loadJobBidRequests(conCurrentJobId);
    })
    .catch(e => alert('Error: ' + e.message));
}

// ── Load and render bid requests for a job ──
function loadJobBidRequests(jobId) {
  if (!conDb || !jobId) return;
  coll('jobs').doc(jobId).collection('bidRequests')
    .orderBy('createdAt', 'desc').get()
    .then(snap => {
      _allBidRequests = [];
      snap.forEach(doc => _allBidRequests.push({ id: doc.id, ...doc.data() }));
      renderJobBidRequests();
    }).catch(() => {});
}

function renderJobBidRequests() {
  const section = document.getElementById('jobBidSection');
  const el = document.getElementById('jobBidList');
  if (!el || !section) return;

  if (!_allBidRequests.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  el.innerHTML = _allBidRequests.map(req => {
    const awardedVendor = req.vendors?.find(v => v.bidStatus === 'Awarded');
    const receivedCount = req.vendors?.filter(v => v.bidStatus === 'Received' || v.bidStatus === 'Awarded').length || 0;
    const totalCount = req.vendors?.length || 0;
    const lowestBid = req.vendors
      ?.filter(v => v.bidAmount)
      .sort((a,b) => (a.bidAmount||0)-(b.bidAmount||0))[0];

    return `<div class="bid-card ${awardedVendor?'awarded':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:800;color:#93c5fd">${esc(req.trade||'')}</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${receivedCount}/${totalCount} bids received
            ${lowestBid?` · Lowest: <strong style="color:#1dbb87">$${(lowestBid.bidAmount||0).toLocaleString()}</strong>`:''}
            ${req.dueDate?` · Due: ${req.dueDate}`:''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${awardedVendor?`<span style="font-size:.76rem;font-weight:700;color:#1dbb87">✓ AWARDED to ${esc(awardedVendor.vendorName)}</span>`:''}
          <button class="btn" onclick="openBidComparison('${req.id}')" style="font-size:.76rem;padding:4px 10px">Compare Bids</button>
        </div>
      </div>

      <!-- Vendor bid rows -->
      <div>
        <div class="bid-vendor-row bid-vendor-header">
          <div>Vendor</div><div>Status</div><div style="text-align:right">Bid Amount</div>
          <div>Notes</div><div></div>
        </div>
        ${(req.vendors||[]).map(v => {
          const sc = { Pending:'bid-status-pending', Received:'bid-status-received', Awarded:'bid-status-awarded', Declined:'bid-status-declined' };
          return `<div class="bid-vendor-row">
            <div>
              <div style="font-weight:700;font-size:.85rem">${esc(v.vendorName)}</div>
              ${v.vendorEmail?`<div style="font-size:.72rem;color:var(--muted)">${esc(v.vendorEmail)}</div>`:''}
            </div>
            <div><span class="${sc[v.bidStatus]||'bid-status-pending'};font-size:.78rem;font-weight:700">${v.bidStatus||'Pending'}</span></div>
            <div style="text-align:right;font-weight:800;color:${v.bidStatus==='Awarded'?'#1dbb87':'#eaf0fb'}">
              ${v.bidAmount?'$'+v.bidAmount.toLocaleString():'—'}
            </div>
            <div style="font-size:.76rem;color:var(--muted)">${esc((v.bidNotes||'').slice(0,40))}${(v.bidNotes||'').length>40?'…':''}</div>
            <div style="display:flex;gap:4px">
              ${v.bidStatus !== 'Awarded' ? `<button class="btn" onclick="openEnterBid('${req.id}','${v.vendorId}','${esc(v.vendorName)}')" style="font-size:.7rem;padding:2px 7px">${v.bidAmount?'Edit':'Enter'}</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      <div style="font-size:.76rem;color:rgba(110,145,210,.3);margin-top:8px;font-style:italic">${esc(req.scope?.slice(0,80)||'')}${(req.scope||'').length>80?'…':''}</div>
    </div>`;
  }).join('');
}

function openEnterBid(requestId, vendorId, vendorName) {
  document.getElementById('enterBidId').value = '';
  document.getElementById('enterBidVendorId').value = vendorId;
  document.getElementById('enterBidRequestId').value = requestId;
  document.getElementById('enterBidTitle').textContent = 'Enter Bid — ' + vendorName;
  document.getElementById('enterBidAmount').value = '';
  document.getElementById('enterBidDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('enterBidNotes').value = '';
  document.getElementById('enterBidValidity').value = '30';
  kOpen('enterBidModal');
}

function saveBidEntry(status) {
  const requestId = document.getElementById('enterBidRequestId')?.value;
  const vendorId = document.getElementById('enterBidVendorId')?.value;
  const amount = parseFloat(document.getElementById('enterBidAmount')?.value);
  const notes = document.getElementById('enterBidNotes')?.value.trim();
  const date = document.getElementById('enterBidDate')?.value;

  if (!amount || isNaN(amount)) { alert('Please enter a bid amount.'); return; }
  if (!requestId) return;

  // Update the vendor entry in the bid request
  const req = _allBidRequests.find(r => r.id === requestId);
  if (!req) return;

  const vendors = (req.vendors || []).map(v => {
    if (v.vendorId === vendorId) {
      return { ...v, bidStatus: status, bidAmount: amount, bidNotes: notes, bidDate: date };
    }
    // If awarding this one, unset others
    if (status === 'Awarded' && v.bidStatus === 'Awarded') {
      return { ...v, bidStatus: 'Received' };
    }
    return v;
  });

  coll('jobs').doc(conCurrentJobId).collection('bidRequests').doc(requestId)
    .update({ vendors, status: status === 'Awarded' ? 'Awarded' : req.status })
    .then(() => {
      kClose('enterBidModal');

      if (status === 'Awarded') {
        // Auto-add vendor to job subs
        const vendor = allVendors.find(v => v.id === vendorId);
        const awardedVendor = vendors.find(v => v.vendorId === vendorId);
        if (vendor) {
          const subData = {
            name: vendor.name,
            trade: vendor.trade || req.trade,
            contact: vendor.contact || '',
            phone: vendor.phone || '',
            email: vendor.email || '',
            contract: amount,
            status: 'Active',
            notes: `Awarded from bid request. Bid: $${amount.toLocaleString()}`,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          coll('jobs').doc(conCurrentJobId).collection('subs').add(subDoc(subData))
            .then(() => {
              renderSubList();
              alert(`🏆 Bid awarded to ${vendor.name} for $${amount.toLocaleString()}!

They have been added to the job's subcontractors.

Would you like to create a Purchase Order?`);
            });
        }
      }
      loadJobBidRequests(conCurrentJobId);
    })
    .catch(e => alert('Error: ' + e.message));
}

function openBidComparison(requestId) {
  // Scroll to the bid request card
  const req = _allBidRequests.find(r => r.id === requestId);
  if (!req) return;
  // Already visible in the bid list - just highlight
  const cards = document.querySelectorAll('.bid-card');
  cards.forEach((card, i) => {
    if (i === _allBidRequests.findIndex(r => r.id === requestId)) {
      card.style.borderColor = 'var(--amber)';
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.style.borderColor = '', 2000);
    }
  });
}

// Bid loading handled in switchDetailTab directly

// Update trade filter in bid modal
document.addEventListener('DOMContentLoaded', () => {
  const tradeSel = document.getElementById('bidTrade');
  if (tradeSel) tradeSel.addEventListener('change', () => renderBidVendorList());
});

// Expose
window.openBidRequestModal = openBidRequestModal;
window.sendBidRequests = sendBidRequests;
window.filterBidVendors = filterBidVendors;
window.selectAllBidVendors = selectAllBidVendors;
window.clearBidVendors = clearBidVendors;
window.openEnterBid = openEnterBid;
window.saveBidEntry = saveBidEntry;
window.openBidComparison = openBidComparison;
window.renderBidVendorList = renderBidVendorList;
window.toggleBidVendor = toggleBidVendor;
window.toggleBidVendorCheck = toggleBidVendorCheck;
window.loadJobBidRequests = loadJobBidRequests;

// ════════════════════════════════════════════════════
// ── HIERARCHICAL ESTIMATE ENGINE ──
// ════════════════════════════════════════════════════
// Data structure stored in Firestore as jobs/{jobId}/estimateGroups
// Each group has: { id, name, order, collapsed, subgroups: [] }
// Each subgroup has: { id, name, order, items: [] }
// Each item has: { id, desc, qty, unit, costType, unitCost, markup, unitPrice, phase, notes }

let estGroups = []; // [{id, name, order, collapsed, subgroups:[{id, name, order, items:[...]}]}]
let _estCollapsed = {}; // groupId/subgroupId -> bool
let _editingGroupId = null;
let _editingSubgroupId = null;
let _editingEstItemId = null;

const COST_TYPES = ['Labor','Materials','Subcontractor','Equipment','Permits & Fees','Overhead','Other'];

// ── Load estimate from Firestore ──
function loadEstimate(jobId) {
  if (!conDb || !jobId) return;
  coll('jobs').doc(jobId).collection('estimateGroups')
    .orderBy('order').get()
    .then(snap => {
      estGroups = [];
      const groupPromises = [];
      snap.forEach(doc => {
        const group = { id: doc.id, ...doc.data(), subgroups: [] };
        estGroups.push(group);
        // Load subgroups
        const p = coll('jobs').doc(jobId).collection('estimateGroups')
          .doc(doc.id).collection('subgroups').orderBy('order').get()
          .then(subSnap => {
            const subPromises = [];
            subSnap.forEach(subDoc => {
              const subgroup = { id: subDoc.id, ...subDoc.data(), items: [] };
              group.subgroups.push(subgroup);
              // Load items
              const sp = coll('jobs').doc(jobId).collection('estimateGroups')
                .doc(doc.id).collection('subgroups').doc(subDoc.id).collection('items')
                .orderBy('order').get()
                .then(itemSnap => {
                  itemSnap.forEach(itemDoc => {
                    subgroup.items.push({ id: itemDoc.id, ...itemDoc.data() });
                  });
                });
              subPromises.push(sp);
            });
            // Also load items directly on group (no subgroup)
            const dp = coll('jobs').doc(jobId).collection('estimateGroups')
              .doc(doc.id).collection('items').orderBy('order').get()
              .then(itemSnap => {
                if (!group.directItems) group.directItems = [];
                itemSnap.forEach(itemDoc => {
                  group.directItems.push({ id: itemDoc.id, ...itemDoc.data() });
                });
              });
            subPromises.push(dp);
            return Promise.all(subPromises);
          });
        groupPromises.push(p);
      });
      return Promise.all(groupPromises);
    })
    .then(() => {
      renderEstimateTree();
      updateEstimateSummary();
    })
    .catch(e => console.error('Estimate load error:', e));
}

// ── Render the estimate tree ──
function renderEstimateTree() {
  const tree = document.getElementById('estimateTree');
  const emptyState = document.getElementById('estEmptyState');
  if (!tree) return;

  if (!estGroups.length) {
    tree.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  tree.innerHTML = estGroups.map(group => renderGroupHTML(group)).join('');
}

function renderGroupHTML(group) {
  const isCollapsed = _estCollapsed[group.id];
  const allItems = getAllItemsInGroup(group);
  const totals = calcGroupTotals(allItems);
  const marginColor = totals.margin >= 20 ? '#1dbb87' : totals.margin >= 10 ? '#f59e0b' : '#ef5350';

  return `<div class="est-group" id="estGroup_${group.id}">
    <div class="est-group-head" onclick="toggleGroupCollapse('${group.id}')">
      <span class="est-group-toggle ${isCollapsed?'':'open'}">▶</span>
      <span class="est-group-name">${esc(group.name)}</span>
      <span class="est-group-total-val" style="color:var(--muted);font-size:.76rem">${allItems.length} item${allItems.length!==1?'s':''}</span>
      <span class="est-group-total-val" style="color:var(--muted)">Cost: $${Math.round(totals.cost).toLocaleString()}</span>
      <span class="est-group-total-val" style="color:var(--amber)">Price: $${Math.round(totals.price).toLocaleString()}</span>
      <span class="est-group-total-val" style="color:${marginColor}">${Math.round(totals.margin)}%</span>
      <div style="display:flex;gap:6px;margin-left:8px" onclick="event.stopPropagation()">
        <button onclick="openAddSubgroupModal('${group.id}')" class="btn" style="padding:2px 8px;font-size:.7rem">+ Sub</button>
        <button onclick="openAddEstItemModal(null,'${group.id}')" class="btn" style="padding:2px 8px;font-size:.7rem">+ Item</button>
        <button onclick="openEditGroupModal('${group.id}')" class="btn" style="padding:2px 8px;font-size:.7rem">✏️</button>
        <button onclick="deleteGroup('${group.id}')" class="btn btn-danger" style="padding:2px 8px;font-size:.7rem">✕</button>
      </div>
    </div>
    ${isCollapsed ? '' : `<div>
      ${(group.subgroups||[]).map(sub => renderSubgroupHTML(group.id, sub)).join('')}
      ${(group.directItems||[]).map(item => renderItemRowHTML(item, group.id, null)).join('')}
      ${(group.directItems||[]).length > 0 || (group.subgroups||[]).length === 0 ? `
        <div style="padding:6px 12px 10px">
          <button class="est-add-btn" onclick="openAddEstItemModal(null,'${group.id}')">+ Add line item to ${esc(group.name)}</button>
        </div>` : ''}
    </div>`}
  </div>`;
}

function renderSubgroupHTML(groupId, sub) {
  const isCollapsed = _estCollapsed[sub.id];
  const totals = calcGroupTotals(sub.items||[]);
  const marginColor = totals.margin >= 20 ? '#1dbb87' : totals.margin >= 10 ? '#f59e0b' : '#ef5350';

  return `<div class="est-subgroup" id="estSub_${sub.id}">
    <div class="est-subgroup-head" onclick="toggleGroupCollapse('${sub.id}')">
      <span class="est-group-toggle ${isCollapsed?'':'open'}" style="font-size:.75rem">▶</span>
      <span class="est-subgroup-name">${esc(sub.name)}</span>
      <span style="font-size:.74rem;color:var(--muted)">${(sub.items||[]).length} items · Cost $${Math.round(totals.cost).toLocaleString()} · Price $${Math.round(totals.price).toLocaleString()}</span>
      <span style="font-size:.74rem;color:${marginColor}">${Math.round(totals.margin)}%</span>
      <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
        <button onclick="openAddEstItemModal(null,'${groupId}','${sub.id}')" class="btn" style="padding:1px 6px;font-size:.68rem">+ Item</button>
        <button onclick="openEditSubgroupModal('${groupId}','${sub.id}')" class="btn" style="padding:1px 6px;font-size:.68rem">✏️</button>
        <button onclick="deleteSubgroup('${groupId}','${sub.id}')" class="btn btn-danger" style="padding:1px 6px;font-size:.68rem">✕</button>
      </div>
    </div>
    ${isCollapsed ? '' : `<div>
      ${(sub.items||[]).map(item => renderItemRowHTML(item, groupId, sub.id)).join('')}
      <div style="padding:4px 12px 8px 48px">
        <button class="est-add-btn" onclick="openAddEstItemModal(null,'${groupId}','${sub.id}')">+ Add item to ${esc(sub.name)}</button>
      </div>
    </div>`}
  </div>`;
}

function renderItemRowHTML(item, groupId, subgroupId) {
  const qty = item.qty || 1;
  const unitCost = item.unitCost || 0;
  const markup = item.markup || 0;
  const unitPrice = item.unitPrice || unitCost * (1 + markup/100);
  const extCost = qty * unitCost;
  const extPrice = qty * unitPrice;
  const margin = extPrice > 0 ? Math.round((extPrice - extCost) / extPrice * 100) : 0;
  const marginColor = margin >= 20 ? '#1dbb87' : margin >= 10 ? '#f59e0b' : '#ef5350';
  const ctColors = { Labor:'#3b82f6', Materials:'#f59e0b', Subcontractor:'#8b5cf6', Equipment:'#06b6d4', 'Permits & Fees':'#f97316' };
  const ctColor = ctColors[item.costType] || 'var(--muted)';

  return `<div class="est-item-row" id="estItem_${item.id}">
    <div style="font-size:.68rem;color:rgba(110,145,210,.3)">${item.order||''}</div>
    <div>
      <div style="font-weight:600">${esc(item.desc||'Unnamed item')}</div>
      ${item.notes?`<div style="font-size:.72rem;color:var(--muted);font-style:italic">${esc(item.notes)}</div>`:''}
    </div>
    <div style="color:var(--muted)">${qty}${item.unit?' '+esc(item.unit):''}</div>
    <div><span style="font-size:.7rem;color:${ctColor};font-weight:700">${esc(item.costType||'')}</span></div>
    <div style="text-align:right">$${unitCost.toFixed(2)}</div>
    <div style="text-align:right;font-weight:700">$${extCost.toFixed(2)}</div>
    <div style="text-align:right">$${unitPrice.toFixed(2)}</div>
    <div style="text-align:right;font-weight:700;color:var(--amber)">$${extPrice.toFixed(2)}</div>
    <div style="text-align:right;font-weight:700;color:${marginColor}">${margin}%</div>
    <div style="display:flex;gap:3px;justify-content:flex-end">
      <button onclick="openAddEstItemModal('${item.id}','${groupId}','${subgroupId||''}')" class="btn" style="padding:2px 6px;font-size:.7rem">✏️</button>
      <button onclick="deleteEstItem('${item.id}','${groupId}','${subgroupId||''}')" class="btn btn-danger" style="padding:2px 6px;font-size:.7rem">✕</button>
    </div>
  </div>`;
}

function getAllItemsInGroup(group) {
  const items = [...(group.directItems||[])];
  (group.subgroups||[]).forEach(sub => items.push(...(sub.items||[])));
  return items;
}

function calcGroupTotals(items) {
  let cost = 0, price = 0;
  items.forEach(item => {
    const qty = item.qty||1;
    const uc = item.unitCost||0;
    const up = item.unitPrice || uc*(1+(item.markup||0)/100);
    cost += qty * uc;
    price += qty * up;
  });
  const profit = price - cost;
  const margin = price > 0 ? profit/price*100 : 0;
  return { cost, price, profit, margin };
}

function updateEstimateSummary() {
  let totalCost = 0, totalPrice = 0, totalItems = 0;
  estGroups.forEach(g => {
    const items = getAllItemsInGroup(g);
    totalItems += items.length;
    const t = calcGroupTotals(items);
    totalCost += t.cost;
    totalPrice += t.price;
  });
  const profit = totalPrice - totalCost;
  const margin = totalPrice > 0 ? profit/totalPrice*100 : 0;
  const marginColor = margin >= 20 ? '#1dbb87' : margin >= 10 ? '#f59e0b' : '#ef5350';

  const setEl = (id, v, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = v;
    if (color) el.style.color = color;
  };
  setEl('estKpiCost', '$'+Math.round(totalCost).toLocaleString());
  setEl('estKpiPrice', '$'+Math.round(totalPrice).toLocaleString());
  setEl('estKpiProfit', '$'+Math.round(profit).toLocaleString(), profit>=0?'#1dbb87':'#ef5350');
  setEl('estKpiMargin', Math.round(margin)+'%', marginColor);
  setEl('estKpiItems', totalItems);

  // Sync estCost from the estimate. Do NOT overwrite contractValue —
  // the contract/approved price is set on the job and only moves via change orders.
  if (conCurrentJobId && conDb && totalItems > 0) {
    const rounded = Math.round(totalCost);
    coll('jobs').doc(conCurrentJobId).update({
      estCost: rounded, estCostSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
    const job = conJobs.find(j => j.id === conCurrentJobId);
    if (job) { job.estCost = rounded; refreshJobFinancials(job); }
  }
}

function toggleGroupCollapse(id) {
  _estCollapsed[id] = !_estCollapsed[id];
  renderEstimateTree();
}

// ── GROUP CRUD ──
function openAddGroupModal(editId) {
  _editingGroupId = editId || null;
  const group = editId ? estGroups.find(g => g.id === editId) : null;
  document.getElementById('groupNameTitle').textContent = editId ? 'Edit Group' : 'Add Group';
  document.getElementById('groupNameInput').value = group?.name || '';

  const common = ['Exterior','Interior','Kitchen','Master Bath','Bathroom','Bedroom','Living Room',
    'Basement','Laundry Room','Dining Room','Deck / Porch','Roof','Siding','Windows & Doors',
    'Garage','Hallway / Stairs','Demo / Trash Out','Miscellaneous'];
  const existing = new Set(estGroups.map(g => g.name));
  const suggestions = common.filter(n => !existing.has(n)).slice(0, 12);
  const qp = document.getElementById('groupQuickPicks');
  if (qp) {
    qp.innerHTML = '';
    suggestions.forEach(function(n) {
      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = n;
      btn.style.cssText = 'font-size:.76rem;padding:4px 10px;border-radius:8px;margin-bottom:4px';
      btn.onclick = function() { document.getElementById('groupNameInput').value = n; };
      qp.appendChild(btn);
    });
  }
  kOpen('groupNameModal');
  setTimeout(function() { var el = document.getElementById('groupNameInput'); if(el) el.focus(); }, 150);
}

function saveGroupName() {
  const name = document.getElementById('groupNameInput')?.value.trim();
  if (!name) { alert('Please enter a group name.'); return; }
  kClose('groupNameModal');
  if (_editingGroupId) {
    updateGroup(_editingGroupId, name);
  } else {
    addGroup(name);
  }
}

function openEditGroupModal(groupId) { openAddGroupModal(groupId); }

function addGroup(name) {
  if (!conDb || !conCurrentJobId) return;
  const order = estGroups.length;
  coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
    name, order, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(ref => {
    estGroups.push({ id: ref.id, name, order, subgroups: [], directItems: [] });
    renderEstimateTree();
    updateEstimateSummary();
  }).catch(e => alert('Error: ' + e.message));
}

function updateGroup(groupId, name) {
  if (!conDb || !conCurrentJobId) return;
  coll('jobs').doc(conCurrentJobId).collection('estimateGroups').doc(groupId)
    .update({ name })
    .then(() => {
      const g = estGroups.find(x => x.id === groupId);
      if (g) g.name = name;
      renderEstimateTree();
    }).catch(e => alert('Error: ' + e.message));
}

function deleteGroup(groupId) {
  if (!confirm('Delete this group and ALL its items?')) return;
  coll('jobs').doc(conCurrentJobId).collection('estimateGroups').doc(groupId)
    .delete().then(() => {
      estGroups = estGroups.filter(g => g.id !== groupId);
      renderEstimateTree();
      updateEstimateSummary();
    }).catch(e => alert('Error: ' + e.message));
}

// ── SUBGROUP CRUD ──
function openAddSubgroupModal(groupId, editSubId) {
  let targetGroupId = groupId;
  if (!targetGroupId) {
    if (!estGroups.length) { alert('Add a group first.'); return; }
    if (estGroups.length === 1) {
      targetGroupId = estGroups[0].id;
    } else {
      const choice = prompt('Which group? ' + estGroups.map((g,i) => (i+1)+'. '+g.name).join(', ') + ' -- Enter number:');
      const idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= estGroups.length) return;
      targetGroupId = estGroups[idx].id;
    }
  }
  const group = estGroups.find(g => g.id === targetGroupId);
  const existingSub = editSubId ? group?.subgroups?.find(s => s.id === editSubId) : null;
  _pendingSubgroupForGroup = targetGroupId;
  _pendingSubgroupEditId = editSubId || null;

  document.getElementById('subgroupNameTitle').textContent = editSubId ? 'Edit Subgroup' : 'Add Subgroup';
  document.getElementById('subgroupNameInput').value = existingSub?.name || '';
  const parentEl = document.getElementById('subgroupParentName');
  if (parentEl) parentEl.textContent = group?.name || '';

  const groupName = (group?.name || '').toLowerCase();
  let suggestions = [];
  if (groupName.includes('bath')) suggestions = ['Shower','Tub','Toilet','Vanity','Tile Floor','Mirror','Fixtures','Demo'];
  else if (groupName.includes('kitchen')) suggestions = ['Cabinets','Countertops','Backsplash','Appliances','Plumbing','Flooring','Demo'];
  else if (groupName.includes('deck') || groupName.includes('exterior')) suggestions = ['Decking Boards','Framing','Railing','Stairs','Ledger','Footings','Painting'];
  else if (groupName.includes('bedroom')) suggestions = ['Flooring','Painting','Trim','Closet','Electrical','Drywall'];
  else if (groupName.includes('roof')) suggestions = ['Tear Off','Decking','Shingles','Flashing','Gutters','Fascia'];
  else suggestions = ['Demo','Rough-In','Finish Work','Painting','Flooring','Electrical','Plumbing','Trim'];

  const existing = new Set(group?.subgroups?.map(s => s.name) || []);
  const filtered = suggestions.filter(n => !existing.has(n));
  const qp = document.getElementById('subgroupQuickPicks');
  if (qp) {
    qp.innerHTML = '';
    filtered.forEach(function(n) {
      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = n;
      btn.style.cssText = 'font-size:.76rem;padding:4px 10px;border-radius:8px;margin-bottom:4px';
      btn.onclick = function() { document.getElementById('subgroupNameInput').value = n; };
      qp.appendChild(btn);
    });
  }
  kOpen('subgroupNameModal');
  setTimeout(function() { var el = document.getElementById('subgroupNameInput'); if(el) el.focus(); }, 150);
}

let _pendingSubgroupForGroup = null;
let _pendingSubgroupEditId = null;

function saveSubgroupName() {
  const name = document.getElementById('subgroupNameInput')?.value.trim();
  if (!name) { alert('Please enter a subgroup name.'); return; }
  kClose('subgroupNameModal');
  const groupId = _pendingSubgroupForGroup;
  const editSubId = _pendingSubgroupEditId;
  const group = estGroups.find(g => g.id === groupId);

  if (editSubId) {
    coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
      .doc(groupId).collection('subgroups').doc(editSubId).update({ name })
      .then(function() {
        const sub = group?.subgroups?.find(s => s.id === editSubId);
        if (sub) sub.name = name;
        renderEstimateTree();
      }).catch(function(e) { alert('Error: ' + e.message); });
  } else {
    const order = group?.subgroups?.length || 0;
    coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
      .doc(groupId).collection('subgroups').add({
        name: name, order: order, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function(ref) {
        if (group) {
          if (!group.subgroups) group.subgroups = [];
          group.subgroups.push({ id: ref.id, name: name, order: order, items: [] });
        }
        renderEstimateTree();
      }).catch(function(e) { alert('Error: ' + e.message); });
  }
}

function openEditSubgroupModal(groupId, subId) { openAddSubgroupModal(groupId, subId); }

function deleteSubgroup(groupId, subId) {
  if (!confirm('Delete this subgroup and all its items?')) return;
  coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
    .doc(groupId).collection('subgroups').doc(subId)
    .delete().then(() => {
      const group = estGroups.find(g => g.id === groupId);
      if (group) group.subgroups = group.subgroups.filter(s => s.id !== subId);
      renderEstimateTree();
      updateEstimateSummary();
    }).catch(e => alert('Error: ' + e.message));
}

// ── ITEM MODAL ──
function openAddEstItemModal(itemId, groupId, subgroupId) {
  _editingEstItemId = itemId || null;
  _editingGroupId = groupId || null;
  _editingSubgroupId = subgroupId || null;

  // Find item if editing
  let item = null;
  if (itemId && groupId) {
    const group = estGroups.find(g => g.id === groupId);
    if (subgroupId) {
      const sub = group?.subgroups?.find(s => s.id === subgroupId);
      item = sub?.items?.find(it => it.id === itemId);
    } else {
      item = group?.directItems?.find(it => it.id === itemId);
    }
  }

  const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  document.getElementById('estItemModalTitle').textContent = item ? 'Edit Line Item' : 'Add Line Item';
  setVal('estItemDesc', item?.desc);
  setVal('estItemQty', item?.qty || 1);
  setVal('estItemUnit', item?.unit || 'ea');
  document.getElementById('estItemCostType').value = item?.costType || 'Labor';
  setVal('estItemUnitCost', item?.unitCost || '');
  setVal('estItemMarkup', item?.markup !== undefined ? item.markup : 15);
  setVal('estItemUnitPrice', item?.unitPrice || '');
  setVal('estItemNotes', item?.notes || '');
  setVal('estItemPhase', item?.phase || '');

  // Populate group dropdown
  const groupSel = document.getElementById('estItemGroupSel');
  if (groupSel) {
    groupSel.innerHTML = '<option value="">— Select Group —</option>' +
      estGroups.map(g => '<option value="'+g.id+'"'+(g.id===groupId?' selected':'')+'>'+esc(g.name)+'</option>').join('');
    if (groupId) groupSel.value = groupId;
  }
  populateEstSubgroupDropdown(groupId, subgroupId);

  calcEstItemPreview();
  kOpen('addEstItemModal');
  setTimeout(() => document.getElementById('estItemDesc')?.focus(), 150);
}

function populateEstSubgroupDropdown(groupId, selectedSubId) {
  const subSel = document.getElementById('estItemSubgroupSel');
  if (!subSel) return;
  const group = estGroups.find(g => g.id === groupId);
  const subs = group?.subgroups || [];
  subSel.innerHTML = '<option value="">No subgroup</option>' +
    subs.map(s => '<option value="'+s.id+'"'+(s.id===selectedSubId?' selected':'')+'>'+esc(s.name)+'</option>').join('');
  if (selectedSubId) subSel.value = selectedSubId;
}

function onEstGroupChange() {
  const groupId = document.getElementById('estItemGroupSel')?.value;
  _editingGroupId = groupId || null;
  populateEstSubgroupDropdown(groupId, null);
}

function onEstSubgroupChange() {
  _editingSubgroupId = document.getElementById('estItemSubgroupSel')?.value || null;
}

function calcEstItemPreview() {
  const qty = parseFloat(document.getElementById('estItemQty')?.value) || 1;
  const unitCost = parseFloat(document.getElementById('estItemUnitCost')?.value) || 0;
  const markup = parseFloat(document.getElementById('estItemMarkup')?.value) || 0;
  const manualPrice = parseFloat(document.getElementById('estItemUnitPrice')?.value);

  const unitPrice = manualPrice || unitCost * (1 + markup/100);
  const extCost = qty * unitCost;
  const extPrice = qty * unitPrice;
  const profit = extPrice - extCost;
  const margin = extPrice > 0 ? profit/extPrice*100 : 0;

  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('estPreviewExtCost', '$' + extCost.toFixed(2));
  setEl('estPreviewExtPrice', '$' + extPrice.toFixed(2));
  setEl('estPreviewProfit', '$' + profit.toFixed(2));
  setEl('estPreviewMargin', margin.toFixed(1) + '%');

  // Auto-fill unit price if not manually set
  const priceEl = document.getElementById('estItemUnitPrice');
  if (priceEl && !manualPrice) priceEl.placeholder = '$' + unitPrice.toFixed(2);
}

function saveEstItem() {
  const desc = document.getElementById('estItemDesc')?.value.trim();
  if (!desc) { alert('Description is required.'); return; }

  // Read group/subgroup from dropdowns
  const groupIdFromSel = document.getElementById('estItemGroupSel')?.value;
  const subgroupIdFromSel = document.getElementById('estItemSubgroupSel')?.value || null;
  if (!groupIdFromSel) { alert('Please select a group.'); return; }
  _editingGroupId = groupIdFromSel;
  _editingSubgroupId = subgroupIdFromSel;

  const qty = parseFloat(document.getElementById('estItemQty')?.value) || 1;
  const unitCost = parseFloat(document.getElementById('estItemUnitCost')?.value) || 0;
  const markup = parseFloat(document.getElementById('estItemMarkup')?.value) || 0;
  const manualPrice = parseFloat(document.getElementById('estItemUnitPrice')?.value);
  const unitPrice = manualPrice || unitCost * (1 + markup/100);

  const data = {
    desc,
    qty,
    unit: document.getElementById('estItemUnit')?.value || 'ea',
    costType: document.getElementById('estItemCostType')?.value || 'Labor',
    unitCost,
    markup,
    unitPrice,
    phase: document.getElementById('estItemPhase')?.value || '',
    notes: document.getElementById('estItemNotes')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const groupId = _editingGroupId;
  const subgroupId = _editingSubgroupId;
  const jobRef = coll('jobs').doc(conCurrentJobId);
  let colRef;

  if (subgroupId) {
    colRef = jobRef.collection('estimateGroups').doc(groupId).collection('subgroups').doc(subgroupId).collection('items');
  } else {
    colRef = jobRef.collection('estimateGroups').doc(groupId).collection('items');
  }

  const promise = _editingEstItemId
    ? colRef.doc(_editingEstItemId).update(data)
    : colRef.add({ ...data, order: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  promise.then(() => {
    kClose('addEstItemModal');
    loadEstimate(conCurrentJobId);
  }).catch(e => alert('Error: ' + e.message));
}

function deleteEstItem(itemId, groupId, subgroupId) {
  if (!confirm('Delete this line item?')) return;
  const jobRef = coll('jobs').doc(conCurrentJobId);
  let colRef;
  if (subgroupId) {
    colRef = jobRef.collection('estimateGroups').doc(groupId).collection('subgroups').doc(subgroupId).collection('items');
  } else {
    colRef = jobRef.collection('estimateGroups').doc(groupId).collection('items');
  }
  colRef.doc(itemId).delete().then(() => loadEstimate(conCurrentJobId)).catch(e => alert('Error: ' + e.message));
}

function importFromCatalogModal() {
  if (!conCatalogItems?.length) { alert('No catalog items yet. Add items to the Cost Catalog first.'); return; }
  if (!estGroups.length) { alert('Add a group first before importing from catalog.'); return; }

  const groupId = estGroups.length === 1 ? estGroups[0].id : null;
  if (!groupId) {
    const names = estGroups.map((g,i) => (i+1)+'. '+g.name).join('\n');
    const choice = prompt('Import to which group? ' + names + ' -- Enter number:');
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= estGroups.length) return;
    const selectedGroupId = estGroups[idx].id;
    showCatalogPicker(selectedGroupId);
  } else {
    showCatalogPicker(groupId);
  }
}

function showCatalogPicker(groupId) {
  const items = conCatalogItems || [];
  const cats = [...new Set(items.map(i => i.category||'Other'))].sort();
  const choice = prompt('Select category: ' + cats.map((c,i) => (i+1)+'. '+c).join(', ') + ' -- Enter number:');



  if (!choice) return;
  const idx = parseInt(choice) - 1;
  const cat = cats[idx];
  if (!cat) return;

  const catItems = items.filter(i => (i.category||'Other') === cat);
  catItems.forEach((item, i) => {
    const jobRef = coll('jobs').doc(conCurrentJobId);
    jobRef.collection('estimateGroups').doc(groupId).collection('items').add({
      desc: item.description || item.name || '',
      qty: 1,
      unit: item.unit || 'ea',
      costType: item.category || 'Materials',
      unitCost: item.cost || 0,
      markup: item.markup || 15,
      unitPrice: item.sellPrice || (item.cost||0) * 1.15,
      order: i,
      notes: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  setTimeout(() => loadEstimate(conCurrentJobId), 500);
  alert(`Imported ${catItems.length} items from ${cat}.`);
}

// ── PRINT ESTIMATE ──
function printEstimate() {
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const co = companyProfile;
  const win = window.open('', '_blank');

  let allCost = 0, allPrice = 0;
  const groupRows = estGroups.map(group => {
    const allItems = getAllItemsInGroup(group);
    const totals = calcGroupTotals(allItems);
    allCost += totals.cost;
    allPrice += totals.price;

    const subRows = (group.subgroups||[]).map(sub => {
      const st = calcGroupTotals(sub.items||[]);
      const subItemRows = (sub.items||[]).map(item => {
        const qty = item.qty||1;
        const uc = item.unitCost||0;
        const up = item.unitPrice||uc;
        return `<tr style="font-size:.82rem">
          <td style="padding:5px 8px 5px 32px">${esc(item.desc||'')}</td>
          <td style="text-align:center">${qty} ${item.unit||''}</td>
          <td style="text-align:right">$${(qty*uc).toFixed(2)}</td>
          <td style="text-align:right;font-weight:600">$${(qty*up).toFixed(2)}</td>
        </tr>`;
      }).join('');
      return `<tr style="background:#f3f4f6">
        <td style="padding:6px 8px 6px 20px;font-weight:700;color:#374151">${esc(sub.name)}</td>
        <td></td>
        <td style="text-align:right;font-weight:600">$${st.cost.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:#d97706">$${st.price.toFixed(2)}</td>
      </tr>${subItemRows}`;
    }).join('');

    const directRows = (group.directItems||[]).map(item => {
      const qty = item.qty||1;
      const uc = item.unitCost||0;
      const up = item.unitPrice||uc;
      return `<tr style="font-size:.82rem">
        <td style="padding:5px 8px 5px 20px">${esc(item.desc||'')}</td>
        <td style="text-align:center">${qty} ${item.unit||''}</td>
        <td style="text-align:right">$${(qty*uc).toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${(qty*up).toFixed(2)}</td>
      </tr>`;
    }).join('');

    return `<tr style="background:#e5e7eb">
      <td style="padding:8px;font-weight:900;font-size:.95rem">${esc(group.name)}</td>
      <td></td>
      <td style="text-align:right;font-weight:700">$${totals.cost.toFixed(2)}</td>
      <td style="text-align:right;font-weight:700;color:#d97706">$${totals.price.toFixed(2)}</td>
    </tr>${subRows}${directRows}`;
  }).join('');

  const profit = allPrice - allCost;
  const margin = allPrice > 0 ? (profit/allPrice*100).toFixed(1) : '0.0';

  win.document.write(`<!DOCTYPE html><html><head><title>Estimate — ${esc(job?.name||'')}</title>
  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
  table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #e5e7eb}
  .header{display:flex;justify-content:space-between;border-bottom:3px solid #d97706;padding-bottom:16px;margin-bottom:20px}
  @media print{body{margin:10px}}</style></head><body>
  <div class="header">
    <div>
      ${co.logo?`<img src="${co.logo}" style="height:48px;object-fit:contain;margin-bottom:4px"><br>`:''}
      <strong style="font-size:1.2rem">${esc(co.companyName||'')}</strong><br>
      <span style="color:#6b7280;font-size:.85rem">${esc(co.phone||'')} · ${esc(co.email||'')}</span>
    </div>
    <div style="text-align:right">
      <div style="font-size:1.4rem;font-weight:900;color:#d97706">ESTIMATE</div>
      <div style="font-size:1rem;font-weight:700">${esc(job?.name||'')}</div>
      <div style="color:#6b7280;font-size:.85rem">${esc(job?.address||'')}</div>
      <div style="color:#6b7280;font-size:.85rem">Date: ${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  <table>
    <thead><tr style="background:#1f2937;color:#fff">
      <th style="padding:10px 8px;text-align:left">Description</th>
      <th style="padding:10px 8px;text-align:center">Qty</th>
      <th style="padding:10px 8px;text-align:right">Cost</th>
      <th style="padding:10px 8px;text-align:right">Price</th>
    </tr></thead>
    <tbody>${groupRows}</tbody>
    <tfoot>
      <tr style="background:#1f2937;color:#fff;font-weight:900;font-size:1rem">
        <td style="padding:12px 8px" colspan="2">TOTAL</td>
        <td style="padding:12px 8px;text-align:right">$${allCost.toFixed(2)}</td>
        <td style="padding:12px 8px;text-align:right">$${allPrice.toFixed(2)}</td>
      </tr>
      <tr><td colspan="4" style="padding:8px;text-align:right;color:#6b7280;font-size:.85rem">
        Profit: $${profit.toFixed(2)} · Margin: ${margin}%
      </td></tr>
    </tfoot>
  </table>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:.75rem;text-align:center">
    ${esc(co.companyName||'')} · ${esc(co.phone||'')} · ${esc(co.email||'')}
    ${co.license?'<br>License #'+esc(co.license):''}
  </div>
  <script>window.print();<\/script></body></html>`);
  win.document.close();
}

// ── PUNCH LIST PRINT ──
function printPunchList() {
  const job = conJobs.find(j => j.id === conCurrentJobId);
  const co = companyProfile;
  const win = window.open('', '_blank');

  const groupSections = estGroups.map(group => {
    const allItems = getAllItemsInGroup(group);
    if (!allItems.length) return '';

    const subSections = (group.subgroups||[]).map(sub => {
      if (!(sub.items||[]).length) return '';
      const itemRows = (sub.items||[]).map(item =>
        `<tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;width:24px"><div style="width:18px;height:18px;border:2px solid #374151;border-radius:3px;display:inline-block"></div></td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">${esc(item.desc||'')}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6b7280">${(item.qty||1)} ${item.unit||''}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;width:200px;color:#9ca3af;font-style:italic;font-size:.82rem">${item.notes||'Notes: ________________'}</td>
        </tr>`
      ).join('');
      return `<tr><td colspan="4" style="padding:8px 8px 4px 16px;background:#f9fafb;font-weight:700;color:#374151;font-size:.88rem">${esc(sub.name)}</td></tr>${itemRows}`;
    }).join('');

    const directRows = (group.directItems||[]).map(item =>
      `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;width:24px"><div style="width:18px;height:18px;border:2px solid #374151;border-radius:3px;display:inline-block"></div></td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">${esc(item.desc||'')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6b7280">${(item.qty||1)} ${item.unit||''}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;width:200px;color:#9ca3af;font-style:italic;font-size:.82rem">${item.notes||'Notes: ________________'}</td>
      </tr>`
    ).join('');

    return `<div style="page-break-inside:avoid;margin-bottom:28px;border:2px solid #d97706;border-radius:8px;overflow:hidden">
      <div style="background:#d97706;color:#fff;padding:10px 14px;font-size:1.1rem;font-weight:900">${esc(group.name)}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:7px 8px;text-align:left;font-size:.75rem;color:#6b7280;font-weight:700">✓</th>
          <th style="padding:7px 8px;text-align:left;font-size:.75rem;color:#6b7280;font-weight:700">ITEM</th>
          <th style="padding:7px 8px;text-align:left;font-size:.75rem;color:#6b7280;font-weight:700">QTY</th>
          <th style="padding:7px 8px;text-align:left;font-size:.75rem;color:#6b7280;font-weight:700">NOTES</th>
        </tr></thead>
        <tbody>${subSections}${directRows}</tbody>
      </table>
      <div style="padding:10px 14px;background:#fffbeb;border-top:1px solid #fde68a">
        <div style="font-size:.78rem;color:#92400e;font-weight:700">Field Notes:</div>
        <div style="height:48px;border-bottom:1px solid #d1d5db;margin-top:4px"></div>
        <div style="height:48px;border-bottom:1px solid #d1d5db;margin-top:8px"></div>
      </div>
    </div>`;
  }).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>Punch List — ${esc(job?.name||'')}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:900px;margin:20px auto;padding:0 16px;color:#111}
    @media print{body{margin:10px} .no-print{display:none} div{page-break-inside:avoid}}
  </style></head><body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #d97706">
    <div>
      ${co.logo?`<img src="${co.logo}" style="height:44px;object-fit:contain;margin-bottom:4px"><br>`:''}
      <strong style="font-size:1rem">${esc(co.companyName||'')}</strong>
    </div>
    <div style="text-align:right">
      <div style="font-size:1.3rem;font-weight:900">PUNCH LIST / WORK ORDER</div>
      <div style="font-size:1rem;font-weight:700">${esc(job?.name||'')}</div>
      <div style="color:#6b7280">${esc(job?.address||'')}</div>
      <div style="color:#6b7280;font-size:.85rem">Date: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Crew: ___________________</div>
    </div>
  </div>
  ${groupSections}
  <div style="margin-top:20px;padding:14px;border:1px solid #e5e7eb;border-radius:8px">
    <div style="font-weight:700;margin-bottom:6px">General Notes:</div>
    <div style="height:60px;border-bottom:1px solid #d1d5db"></div>
    <div style="height:60px;border-bottom:1px solid #d1d5db;margin-top:8px"></div>
  </div>
  <div style="margin-top:16px;text-align:center;color:#9ca3af;font-size:.75rem">
    ${esc(co.companyName||'')} Punch List · ${esc(job?.name||'')} · Printed ${new Date().toLocaleString()}
  </div>
  <script>window.print();<\/script></body></html>`);
  win.document.close();
}

// Expose estimate functions
window.openAddGroupModal = openAddGroupModal;
window.saveGroupName = saveGroupName;
window.saveSubgroupName = saveSubgroupName;
window.openEditGroupModal = openEditGroupModal;
window.openAddSubgroupModal = openAddSubgroupModal;
window.openEditSubgroupModal = openEditSubgroupModal;
window.openAddEstItemModal = openAddEstItemModal;
window.populateEstSubgroupDropdown = populateEstSubgroupDropdown;
window.onEstGroupChange = onEstGroupChange;
window.onEstSubgroupChange = onEstSubgroupChange;
window.saveEstItem = saveEstItem;
window.deleteEstItem = deleteEstItem;
window.deleteGroup = deleteGroup;
window.deleteSubgroup = deleteSubgroup;
window.toggleGroupCollapse = toggleGroupCollapse;
window.calcEstItemPreview = calcEstItemPreview;
window.importFromCatalogModal = importFromCatalogModal;
window.printEstimate = printEstimate;
window.printPunchList = printPunchList;
window.loadEstimate = loadEstimate;
window.renderEstimateTree = renderEstimateTree;

// ════════════════════════════════════════════════════
// ── FIELD NOTES ──
// ════════════════════════════════════════════════════
let _fieldNotesSaveTimer = null;

function loadFieldNotes(jobId) {
  if (!conDb || !jobId) return;
  const textarea = document.getElementById('fieldNotesArea');
  const statusEl = document.getElementById('fieldNotesSaveStatus');
  if (!textarea) return;

  if (statusEl) statusEl.textContent = 'Loading...';

  coll('jobs').doc(jobId).get()
    .then(doc => {
      const notes = doc.data()?.fieldNotes || '';
      textarea.value = notes;
      if (statusEl) statusEl.textContent = notes ? `Last saved: ${doc.data()?.fieldNotesUpdated || 'previously'}` : 'Auto-saves as you type';
    }).catch(() => {
      if (statusEl) statusEl.textContent = 'Could not load notes';
    });
}

function autoSaveFieldNotes() {
  if (_fieldNotesSaveTimer) clearTimeout(_fieldNotesSaveTimer);
  const statusEl = document.getElementById('fieldNotesSaveStatus');
  if (statusEl) statusEl.textContent = 'Saving...';
  _fieldNotesSaveTimer = setTimeout(() => saveFieldNotes(), 1500);
}

function saveFieldNotes() {
  if (!conDb || !conCurrentJobId) return;
  const textarea = document.getElementById('fieldNotesArea');
  const statusEl = document.getElementById('fieldNotesSaveStatus');
  if (!textarea) return;

  const notes = textarea.value;
  const now = new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});

  coll('jobs').doc(conCurrentJobId).update({
    fieldNotes: notes,
    fieldNotesUpdated: now,
    fieldNotesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    if (statusEl) statusEl.textContent = 'Saved at ' + now;
  }).catch(() => {
    if (statusEl) statusEl.textContent = 'Save failed — check connection';
  });
}

function copyFieldNotes() {
  const textarea = document.getElementById('fieldNotesArea');
  if (!textarea?.value) { alert('No notes to copy.'); return; }
  navigator.clipboard.writeText(textarea.value).then(() => {
    const statusEl = document.getElementById('fieldNotesSaveStatus');
    if (statusEl) { const orig = statusEl.textContent; statusEl.textContent = '✓ Copied to clipboard!'; setTimeout(() => statusEl.textContent = orig, 2000); }
  });
}

function clearFieldNotes() {
  if (!confirm('Clear all field notes for this job?')) return;
  const textarea = document.getElementById('fieldNotesArea');
  if (textarea) { textarea.value = ''; saveFieldNotes(); }
}

window.autoSaveFieldNotes = autoSaveFieldNotes;
window.copyFieldNotes = copyFieldNotes;
window.clearFieldNotes = clearFieldNotes;
window.loadFieldNotes = loadFieldNotes;

// ════════════════════════════════════════════════════
// ── SMART ADD WIZARD ──
// ════════════════════════════════════════════════════

// Embedded catalog from JobTread CSV
const CATALOG_DATA = {"2500 Decking":[{"name":"#9 x 3 in. Red Torx Flat-Head Wood Deck Screws (25 lb./1543-Piece)","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"#9 x 3 in. Red Torx Flat-Head Wood Deck Screws (25 lb./1543-Piece)","unitCost":102.6,"unitPrice":128.25,"unit":"ea","qty":1},"labor":null},{"name":"1/2 in. x 6 in. Hex Galvanized Lag Screw","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"1/2 in. x 6 in. Hex Galvanized Lag Screw","unitCost":3.72,"unitPrice":4.65,"unit":"ea","qty":1},"labor":null},{"name":"2 in. x 4 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"2 in. x 4 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","unitCost":15.08,"unitPrice":18.85,"unit":"ea","qty":1},"labor":{"desc":"Labor - 2 in. x 4 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4' L -Silver Spring Aluminum Wheelchair Access Ramps with Handrails","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"4' L -Silver Spring Aluminum Wheelchair Access Ramps with Handrails","unitCost":799.99,"unitPrice":999.988,"unit":"Each","qty":1},"labor":null},{"name":"6 in. x 6 in. x 12 ft. #2 Ground Contact Cedar-Tone Pressure-Treated Timber","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"6 in. x 6 in. x 12 ft. #2 Ground Contact Cedar-Tone Pressure-Treated Timber","unitCost":55.88,"unitPrice":69.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - 6 in. x 6 in. x 12 ft. #2 Ground Contact Cedar-Tone Pressure-Treated Timber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Deck Board Install Labor","costCode":"2500 Decking","costCodeName":"Decking","materials":null,"labor":{"desc":"Labor - Deck Board Install Labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"EPB Elevated Post Base for 6 x 6 Nominal Lumber","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"EPB Elevated Post Base for 6 x 6 Nominal Lumber","unitCost":28.98,"unitPrice":36.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - EPB Elevated Post Base for 6 x 6 Nominal Lumber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"LSC 18-Gauge ZMAX Galvanized Adjustable Stringer Connector","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"LSC 18-Gauge ZMAX Galvanized Adjustable Stringer Connector","unitCost":2.48,"unitPrice":3.1,"unit":"Each","qty":1},"labor":null},{"name":"Labor to install composite railing","costCode":"2500 Decking","costCodeName":"Decking","materials":null,"labor":{"desc":"Labor - Labor to install composite railing","unitCost":300.0,"unitPrice":345.0,"unit":"hr","qty":1}},{"name":"NewTechWood Cortes Plus 0.88 in. x 5.43 in. x 16 ft. Rustic and Wood Grain Peruvian Teak Composite Decking Board","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"NewTechWood Cortes Plus 0.88 in. x 5.43 in. x 16 ft. Rustic and Wood Grain Peruvian Teak Composite Decking Board","unitCost":91.26,"unitPrice":114.075,"unit":"Each","qty":1},"labor":{"desc":"Labor - NewTechWood Cortes Plus 0.88 in. x 5.43 in. x 16 ft. Rustic and Wood Grain Peruvian Teak Composite Decking Board","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"NewTechWood UltraShield 3.7 in. x 3.7 in. x 3.5 ft. Peruvian Teak Composite Hemispheres 3.5 ft. Post Kit","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"NewTechWood UltraShield 3.7 in. x 3.7 in. x 3.5 ft. Peruvian Teak Composite Hemispheres 3.5 ft. Post Kit","unitCost":70.59,"unitPrice":88.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - NewTechWood UltraShield 3.7 in. x 3.7 in. x 3.5 ft. Peruvian Teak Composite Hemispheres 3.5 ft. Post Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"NewTechWood Ultrashield Hemispheres 36 in. x 3 in. x 6 ft. Brown Peruvian Teak Composite Railing Kit","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"NewTechWood Ultrashield Hemispheres 36 in. x 3 in. x 6 ft. Brown Peruvian Teak Composite Railing Kit","unitCost":144.0,"unitPrice":180.0,"unit":"Each","qty":1},"labor":null},{"name":"ProWood 1-5/8 in. x 50 ft. Black Butyl Deck Joist Tape for under Decking Board","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"ProWood 1-5/8 in. x 50 ft. Black Butyl Deck Joist Tape for under Decking Board","unitCost":17.98,"unitPrice":22.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - ProWood 1-5/8 in. x 50 ft. Black Butyl Deck Joist Tape for under Decking Board","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ProWood 8-Step Ground Contact Pressure Treated Pine Stair Stringer","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"ProWood 8-Step Ground Contact Pressure Treated Pine Stair Stringer","unitCost":114.93,"unitPrice":143.663,"unit":"Each","qty":1},"labor":{"desc":"Labor - ProWood 8-Step Ground Contact Pressure Treated Pine Stair Stringer","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Trex Enhance Naturals 1 in. x 6 in. x 16 ft. Rocky Harbor Grooved Edge Composite Deck Board","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"Trex Enhance Naturals 1 in. x 6 in. x 16 ft. Rocky Harbor Grooved Edge Composite Deck Board","unitCost":41.58,"unitPrice":51.975,"unit":"Each","qty":1},"labor":null},{"name":"Ultra Shield 3.7 in. x 3.7 in. x 3.5 ft. Brazilian Ipe Composite Hemispheres 3.5 ft. Post Kit","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"Ultra Shield 3.7 in. x 3.7 in. x 3.5 ft. Brazilian Ipe Composite Hemispheres 3.5 ft. Post Kit","unitCost":70.44,"unitPrice":88.05,"unit":"ea","qty":1},"labor":null},{"name":"WeatherShield 5/4 in. x 6 in. x 16 ft. Standard Ground Contact Pressure-Treated Southern Yellow Pine Decking Board","costCode":"2500 Decking","costCodeName":"Decking","materials":{"desc":"WeatherShield 5/4 in. x 6 in. x 16 ft. Standard Ground Contact Pressure-Treated Southern Yellow Pine Decking Board","unitCost":12.48,"unitPrice":15.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - WeatherShield 5/4 in. x 6 in. x 16 ft. Standard Ground Contact Pressure-Treated Southern Yellow Pine Decking Board","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1500 Doors & Windows":[{"name":"1 in. x 81 in. White Vinyl-Clad Replacement Weatherstrip","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"1 in. x 81 in. White Vinyl-Clad Replacement Weatherstrip","unitCost":6.47,"unitPrice":8.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1 in. x 81 in. White Vinyl-Clad Replacement Weatherstrip","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"10.1 oz. Latex Window Glazing","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"10.1 oz. Latex Window Glazing","unitCost":8.48,"unitPrice":10.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - 10.1 oz. Latex Window Glazing","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"11 in. x 14 in. x 0.125 in. Clear Glass","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"11 in. x 14 in. x 0.125 in. Clear Glass","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - 11 in. x 14 in. x 0.125 in. Clear Glass","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"18 in. x 36 in. x 0.125 in. Clear Glass","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"18 in. x 36 in. x 0.125 in. Clear Glass","unitCost":18.48,"unitPrice":23.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - 18 in. x 36 in. x 0.125 in. Clear Glass","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"2 in. Satin Brass Victorian Door Knob Mortise Lock Set","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - 2 in. Satin Brass Victorian Door Knob Mortise Lock Set","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"24 in. x 80 in. Colonist Primed Textured Molded Composite MDF Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - 24 in. x 80 in. Colonist Primed Textured Molded Composite MDF Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"28 in. to 48 in., Aluminum, White, Security Bar Lock by Prime-Line","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"28 in. to 48 in., Aluminum, White, Security Bar Lock by Prime-Line","unitCost":21.78,"unitPrice":27.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - 28 in. to 48 in., Aluminum, White, Security Bar Lock by Prime-Line","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"30 in. x 80 in. Unfinished Flush Hardwood Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"30 in. x 80 in. Unfinished Flush Hardwood Interior Door Slab","unitCost":33.86,"unitPrice":42.325,"unit":"Each","qty":1},"labor":{"desc":"Labor - 30 in. x 80 in. Unfinished Flush Hardwood Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"35-3/4 in. x 79 in. Reliant 11-Lite Cambertop White Primed Fiberglass Clear Front Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"35-3/4 in. x 79 in. Reliant 11-Lite Cambertop White Primed Fiberglass Clear Front Door Slab","unitCost":808.0,"unitPrice":1010.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - 35-3/4 in. x 79 in. Reliant 11-Lite Cambertop White Primed Fiberglass Clear Front Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"36 in. x 80 in. Adjustable Fit White Premium Patio Sliding Screen Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"36 in. x 80 in. Adjustable Fit White Premium Patio Sliding Screen Door","unitCost":105.0,"unitPrice":131.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - 36 in. x 80 in. Adjustable Fit White Premium Patio Sliding Screen Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4 ft. x 6.5 ft. Frosted Privacy Window Film by Gila","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"4 ft. x 6.5 ft. Frosted Privacy Window Film by Gila","unitCost":34.98,"unitPrice":43.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - 4 ft. x 6.5 ft. Frosted Privacy Window Film by Gila","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4-3/4 in. Clear Shade with 3-1/4 in. Fitter and 3-5/8 in. Width","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - 4-3/4 in. Clear Shade with 3-1/4 in. Fitter and 3-5/8 in. Width","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clopay Classic Collection 16 ft. x 7 ft. Non-Insulated Solid White Garage Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Clopay Classic Collection 16 ft. x 7 ft. Non-Insulated Solid White Garage Door","unitCost":1138.0,"unitPrice":1422.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Clopay Classic Collection 16 ft. x 7 ft. Non-Insulated Solid White Garage Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Crown White Cordless Smooth Vertical Louvers (9 Pack) - 3.5 in. W x 84 in. L (Actual Size 3.5 in. W x 82.5 in. L )","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Crown White Cordless Smooth Vertical Louvers (9 Pack) - 3.5 in. W x 84 in. L (Actual Size 3.5 in. W x 82.5 in. L )","unitCost":2.5,"unitPrice":3.125,"unit":"Each","qty":1},"labor":{"desc":"Labor - Crown White Cordless Smooth Vertical Louvers (9 Pack) - 3.5 in. W x 84 in. L (Actual Size 3.5 in. W x 82.5 in. L )","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Defiant Single Cylinder Satin Nickel Deadbolt","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Defiant Single Cylinder Satin Nickel Deadbolt","unitCost":11.83,"unitPrice":14.788,"unit":"Each","qty":1},"labor":{"desc":"Labor - Defiant Single Cylinder Satin Nickel Deadbolt","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"EMCO 36 in. x 80 in. 100 Series Plus Bronze Self-Storing Storm Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"EMCO 36 in. x 80 in. 100 Series Plus Bronze Self-Storing Storm Door","unitCost":139.0,"unitPrice":173.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - EMCO 36 in. x 80 in. 100 Series Plus Bronze Self-Storing Storm Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Easelife 72 in. x 84 in. (Double 36 in. Doors) 5-Panel Solid MDF White Finished Interior Sliding Barn Door with Hardware Kit","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Easelife 72 in. x 84 in. (Double 36 in. Doors) 5-Panel Solid MDF White Finished Interior Sliding Barn Door with Hardware Kit","unitCost":518.0,"unitPrice":647.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Easelife 72 in. x 84 in. (Double 36 in. Doors) 5-Panel Solid MDF White Finished Interior Sliding Barn Door with Hardware Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 3-1/2 in. Satin Nickel Square Corner Door Hinge","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt 3-1/2 in. Satin Nickel Square Corner Door Hinge","unitCost":3.82,"unitPrice":4.775,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 3-1/2 in. Satin Nickel Square Corner Door Hinge","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 3-1/2 in. x 1/4 in. Radius Satin Nickel Door Hinge","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt 3-1/2 in. x 1/4 in. Radius Satin Nickel Door Hinge","unitCost":3.82,"unitPrice":4.775,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 3-1/2 in. x 1/4 in. Radius Satin Nickel Door Hinge","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 36 in. Bi-Fold Door Hardware Set with White Track","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt 36 in. Bi-Fold Door Hardware Set with White Track","unitCost":19.93,"unitPrice":24.913,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 36 in. Bi-Fold Door Hardware Set with White Track","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 48 in. Sliding Door Set","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt 48 in. Sliding Door Set","unitCost":14.93,"unitPrice":18.663,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 48 in. Sliding Door Set","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Satin Nickel Light Duty Hinge Pin Door Stop","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt Satin Nickel Light Duty Hinge Pin Door Stop","unitCost":1.68,"unitPrice":2.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Satin Nickel Light Duty Hinge Pin Door Stop","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Satin Nickel Light Duty Solid Door Stop","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Everbilt Satin Nickel Light Duty Solid Door Stop","unitCost":1.98,"unitPrice":2.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Satin Nickel Light Duty Solid Door Stop","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Exterior Manual Lift Handle","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Exterior Manual Lift Handle","unitCost":7.88,"unitPrice":9.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - Exterior Manual Lift Handle","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"First Watch Security Polished Brass Glass Knob Set with Spindle","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"First Watch Security Polished Brass Glass Knob Set with Spindle","unitCost":18.74,"unitPrice":23.425,"unit":"Each","qty":1},"labor":{"desc":"Labor - First Watch Security Polished Brass Glass Knob Set with Spindle","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Frost King 1-5/8-inx36-in White Premium Aluminum and Vinyl Door Sweep Weatherstrip","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Frost King 1-5/8-inx36-in White Premium Aluminum and Vinyl Door Sweep Weatherstrip","unitCost":9.93,"unitPrice":12.413,"unit":"Each","qty":1},"labor":{"desc":"Labor - Frost King 1-5/8-inx36-in White Premium Aluminum and Vinyl Door Sweep Weatherstrip","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Crown White Room Darkening 3.5 in. Vertical Blind Kit for Sliding Door or Window - 104 in. W x 84 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay Crown White Room Darkening 3.5 in. Vertical Blind Kit for Sliding Door or Window - 104 in. W x 84 in. L","unitCost":77.98,"unitPrice":97.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Crown White Room Darkening 3.5 in. Vertical Blind Kit for Sliding Door or Window - 104 in. W x 84 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35.5x48","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35.5x48","unitCost":28.48,"unitPrice":35.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35.5x48","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35x48","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35x48","unitCost":26.48,"unitPrice":33.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless 1 in. Room Darkening Vinyl Blind, Cut to length, 35x48","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 48 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 48 in. L","unitCost":26.48,"unitPrice":33.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 48 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 38 in. W x 48 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 38 in. W x 48 in. L","unitCost":30.47,"unitPrice":38.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 38 in. W x 48 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 48 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 48 in. L","unitCost":66.47,"unitPrice":83.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 48 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 72 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 72 in. L","unitCost":80.47,"unitPrice":100.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 71.5 in. W x 72 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 24.5 in. W x 64 in. L (Actual Size 24 in. W x 64 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 24.5 in. W x 64 in. L (Actual Size 24 in. W x 64 in. L)","unitCost":37.98,"unitPrice":47.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 24.5 in. W x 64 in. L (Actual Size 24 in. W x 64 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 28 in. W x 48 in. L (Actual Size 27.5 in. W x 48 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 28 in. W x 48 in. L (Actual Size 27.5 in. W x 48 in. L)","unitCost":30.98,"unitPrice":38.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 28 in. W x 48 in. L (Actual Size 27.5 in. W x 48 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32 in. W x 64 in. L (Actual Size 31.5 in. W x 64 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32 in. W x 64 in. L (Actual Size 31.5 in. W x 64 in. L)","unitCost":45.48,"unitPrice":56.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32 in. W x 64 in. L (Actual Size 31.5 in. W x 64 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32.5 in. W x 48 in. L (Actual Size 32 in. W x 48 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32.5 in. W x 48 in. L (Actual Size 32 in. W x 48 in. L)","unitCost":38.98,"unitPrice":48.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 32.5 in. W x 48 in. L (Actual Size 32 in. W x 48 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 34 in. W x 36 in. L (Actual Size: 33.5 in. W x 36 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 34 in. W x 36 in. L (Actual Size: 33.5 in. W x 36 in. L)","unitCost":34.98,"unitPrice":43.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 34 in. W x 36 in. L (Actual Size: 33.5 in. W x 36 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 48 in. L (Actual Size 36.5 in. W x 48 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 48 in. L (Actual Size 36.5 in. W x 48 in. L)","unitCost":41.48,"unitPrice":51.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 48 in. L (Actual Size 36.5 in. W x 48 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 64 in. L (Actual Size 36.5 in. W x 64 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 64 in. L (Actual Size 36.5 in. W x 64 in. L)","unitCost":55.48,"unitPrice":69.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 37 in. W x 64 in. L (Actual Size 36.5 in. W x 64 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 38 in. W x 36 in. L (Actual Size: 37.5 in. W x 36 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 38 in. W x 36 in. L (Actual Size: 37.5 in. W x 36 in. L)","unitCost":39.48,"unitPrice":49.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 38 in. W x 36 in. L (Actual Size: 37.5 in. W x 36 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 47.5 in. W x 36 in. L (Actual Size: 47 in. W x 36 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 47.5 in. W x 36 in. L (Actual Size: 47 in. W x 36 in. L)","unitCost":48.48,"unitPrice":60.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 47.5 in. W x 36 in. L (Actual Size: 47 in. W x 36 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 71 in. W x 72 in. L (Actual Size 70.5 in. W x 72 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 71 in. W x 72 in. L (Actual Size 70.5 in. W x 72 in. L)","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 71 in. W x 72 in. L (Actual Size 70.5 in. W x 72 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 72 in. W x 36 in. L (Actual Size: 71.5 in. W x 36 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 72 in. W x 36 in. L (Actual Size: 71.5 in. W x 36 in. L)","unitCost":73.98,"unitPrice":92.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection White Cordless 2 in. Faux Wood Blind - 72 in. W x 36 in. L (Actual Size: 71.5 in. W x 36 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Home Decorators Collection: 2 in. and 2-1/2 in. Cordless Faux Wood Blind Replacement Wand in White","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Home Decorators Collection: 2 in. and 2-1/2 in. Cordless Faux Wood Blind Replacement Wand in White","unitCost":6.48,"unitPrice":8.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Home Decorators Collection: 2 in. and 2-1/2 in. Cordless Faux Wood Blind Replacement Wand in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"JELD-WEN 24 in. x 80 in. 6 Panel Colonist Primed Textured Molded Composite Hollow Core Closet Bi-Fold Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"JELD-WEN 24 in. x 80 in. 6 Panel Colonist Primed Textured Molded Composite Hollow Core Closet Bi-Fold Door","unitCost":208.0,"unitPrice":260.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - JELD-WEN 24 in. x 80 in. 6 Panel Colonist Primed Textured Molded Composite Hollow Core Closet Bi-Fold Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kwikset 1/4 in. Satin Nickel Full Lip Round Corner Strike","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset 1/4 in. Satin Nickel Full Lip Round Corner Strike","unitCost":3.19,"unitPrice":3.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - Kwikset 1/4 in. Satin Nickel Full Lip Round Corner Strike","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kwikset 660 Single Cylinder Deadbolt featuring SmartKey Security in Satin Chrome","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset 660 Single Cylinder Deadbolt featuring SmartKey Security in Satin Chrome","unitCost":14.9,"unitPrice":18.625,"unit":"Each","qty":1},"labor":null},{"name":"Kwikset 92001-565 Tylo Passage Hall/Closet Knob In Satin Nickel","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset 92001-565 Tylo Passage Hall/Closet Knob In Satin Nickel","unitCost":13.01,"unitPrice":16.263,"unit":"Each","qty":1},"labor":null},{"name":"Kwikset Tylo Satin Chrome Half-Dummy Door Knob","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset Tylo Satin Chrome Half-Dummy Door Knob","unitCost":8.97,"unitPrice":11.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Kwikset Tylo Satin Chrome Half-Dummy Door Knob","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security","unitCost":25.45,"unitPrice":31.813,"unit":"Each","qty":1},"labor":{"desc":"Labor - Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kwikset Tylo Satin Chrome Passage Hall/Closet Door Knob","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset Tylo Satin Chrome Passage Hall/Closet Door Knob","unitCost":12.97,"unitPrice":16.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Kwikset Tylo Satin Chrome Passage Hall/Closet Door Knob","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kwikset Tylo Satin Chrome Privacy Bed/Bath Door Knob","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Kwikset Tylo Satin Chrome Privacy Bed/Bath Door Knob","unitCost":13.47,"unitPrice":16.838,"unit":"Each","qty":1},"labor":null},{"name":"Labor to install Deadbolt","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install Deadbolt","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install Mini Blinds","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install Mini Blinds","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Labor to install Passage Knob","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install Passage Knob","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install bed/bath knob","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install bed/bath knob","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install exterior door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install exterior door","unitCost":300.0,"unitPrice":345.0,"unit":"hr","qty":1}},{"name":"Labor to install pre hung interior door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install pre hung interior door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor to install screens","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Labor to install screens","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"M-D Building Products Adjustable 5-5/8 in. x 1-1/8 in. X 36 in. Exterior Silver Aluminum and Hardwood Door Threshold","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"M-D Building Products Adjustable 5-5/8 in. x 1-1/8 in. X 36 in. Exterior Silver Aluminum and Hardwood Door Threshold","unitCost":39.27,"unitPrice":49.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - M-D Building Products Adjustable 5-5/8 in. x 1-1/8 in. X 36 in. Exterior Silver Aluminum and Hardwood Door Threshold","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Medium Duty Hydraulic Seville Bronze Door Closer by Wright Products","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Medium Duty Hydraulic Seville Bronze Door Closer by Wright Products","unitCost":32.93,"unitPrice":41.163,"unit":"Each","qty":1},"labor":{"desc":"Labor - Medium Duty Hydraulic Seville Bronze Door Closer by Wright Products","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Pinecroft 24 in. x 80 in. Seabrooke Louver/Louver White Hollow Core PVC Vinyl Interior Bi-Fold Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Pinecroft 24 in. x 80 in. Seabrooke Louver/Louver White Hollow Core PVC Vinyl Interior Bi-Fold Door","unitCost":148.0,"unitPrice":185.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Pinecroft 24 in. x 80 in. Seabrooke Louver/Louver White Hollow Core PVC Vinyl Interior Bi-Fold Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Pre-Cut 46 in. W x 64 in. L Cordless Light Filtering White Vinyl Mini Blind with 1 in. Slats","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Pre-Cut 46 in. W x 64 in. L Cordless Light Filtering White Vinyl Mini Blind with 1 in. Slats","unitCost":14.86,"unitPrice":18.575,"unit":"Each","qty":1},"labor":null},{"name":"Prime Line Bi-Fold Door Knob, 1-11/16 in. Outside Diameter, Diecast, Satin Nickel Plated","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime Line Bi-Fold Door Knob, 1-11/16 in. Outside Diameter, Diecast, Satin Nickel Plated","unitCost":8.93,"unitPrice":11.163,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime Line Bi-Fold Door Knob, 1-11/16 in. Outside Diameter, Diecast, Satin Nickel Plated","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime Line Sliding Closet Door Bottom Guide, 4-3/16 in., Plastic, White (2-pack)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime Line Sliding Closet Door Bottom Guide, 4-3/16 in., Plastic, White (2-pack)","unitCost":3.67,"unitPrice":4.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime Line Sliding Closet Door Bottom Guide, 4-3/16 in., Plastic, White (2-pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line 96in. Galvanized Steel Bypass Closet Door Track Kit","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line 96in. Galvanized Steel Bypass Closet Door Track Kit","unitCost":45.75,"unitPrice":57.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line 96in. Galvanized Steel Bypass Closet Door Track Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line Bumper, Universal Fit, Wardrobe Door, Edge Mount (2-pack)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line Bumper, Universal Fit, Wardrobe Door, Edge Mount (2-pack)","unitCost":15.67,"unitPrice":19.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line Bumper, Universal Fit, Wardrobe Door, Edge Mount (2-pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line Door Hole Cover Plate, 2-5/8 in. Diameter, Finished in Gray Primer","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line Door Hole Cover Plate, 2-5/8 in. Diameter, Finished in Gray Primer","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line Door Hole Cover Plate, 2-5/8 in. Diameter, Finished in Gray Primer","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line Storm Door Protector Chain and Spring, Aluminum Finish","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line Storm Door Protector Chain and Spring, Aluminum Finish","unitCost":5.81,"unitPrice":7.263,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line Storm Door Protector Chain and Spring, Aluminum Finish","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line Tilt Latch Pair, White Plastic Construction, spring-loaded, Snap-In","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line Tilt Latch Pair, White Plastic Construction, spring-loaded, Snap-In","unitCost":5.67,"unitPrice":7.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line Tilt Latch Pair, White Plastic Construction, spring-loaded, Snap-In","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line Window Sash Lock with Cam Action and Alignment Lugs, White Diecast","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Prime-Line Window Sash Lock with Cam Action and Alignment Lugs, White Diecast","unitCost":6.67,"unitPrice":8.338,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line Window Sash Lock with Cam Action and Alignment Lugs, White Diecast","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Satin Nickel Steel Window Sash Lock","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Satin Nickel Steel Window Sash Lock","unitCost":3.27,"unitPrice":4.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Satin Nickel Steel Window Sash Lock","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Screen Tight 5/16 in. x 48 in. White Window Screen Frame Kit","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Screen Tight 5/16 in. x 48 in. White Window Screen Frame Kit","unitCost":17.98,"unitPrice":22.475,"unit":"Each","qty":1},"labor":null},{"name":"Spiral Tilt Window Balance","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Spiral Tilt Window Balance","unitCost":10.0,"unitPrice":12.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Spiral Tilt Window Balance","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons 1-3/4 in. x 36 in. Brown Bottom Sweep Weather-strip Replacement for Doors","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 1-3/4 in. x 36 in. Brown Bottom Sweep Weather-strip Replacement for Doors","unitCost":15.86,"unitPrice":19.825,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons 1-3/4 in. x 36 in. Brown Bottom Sweep Weather-strip Replacement for Doors","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons 28 in. x 80 in. Flush Hollow Core Unfinished Hardwood Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 28 in. x 80 in. Flush Hollow Core Unfinished Hardwood Interior Door Slab","unitCost":60.0,"unitPrice":75.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons 28 in. x 80 in. Flush Hollow Core Unfinished Hardwood Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons 30 in. x 80 in. 6-Panel Textured Hollow Core White Primed Composite Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 30 in. x 80 in. 6-Panel Textured Hollow Core White Primed Composite Interior Door Slab","unitCost":60.0,"unitPrice":75.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons 30 in. x 80 in. 6-Panel Textured Hollow Core White Primed Composite Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons 32 in. x 80 in. 6-Panel Textured Hollow Core Primed White Pre-Bored Composite Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 32 in. x 80 in. 6-Panel Textured Hollow Core Primed White Pre-Bored Composite Interior Door Slab","unitCost":69.0,"unitPrice":86.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons 32 in. x 80 in. 6-Panel Textured Hollow Core Primed White Pre-Bored Composite Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons 32 in. x 80 in. Right-Handed 6-Panel Textured Hollow Core White Primed Composite SJ Single Prehung Interior Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 32 in. x 80 in. Right-Handed 6-Panel Textured Hollow Core White Primed Composite SJ Single Prehung Interior Door","unitCost":126.0,"unitPrice":157.5,"unit":"Each","qty":1},"labor":null},{"name":"Steves & Sons 36 in. x 80 in. 6-Panel Textured Hollow Core Primed White Composite Interior Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons 36 in. x 80 in. 6-Panel Textured Hollow Core Primed White Composite Interior Door Slab","unitCost":68.0,"unitPrice":85.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons 36 in. x 80 in. 6-Panel Textured Hollow Core Primed White Composite Interior Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons Element 34 in. x 80 in. 6-Panel Universal Primed White Steel Front Door Slab","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons Element 34 in. x 80 in. 6-Panel Universal Primed White Steel Front Door Slab","unitCost":224.0,"unitPrice":280.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons Element 34 in. x 80 in. 6-Panel Universal Primed White Steel Front Door Slab","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steves & Sons Element 36 in. x 80 in. 6-Panel Left-Hand Inswing Primed White Steel Prehung Front Door with Brickmold","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons Element 36 in. x 80 in. 6-Panel Left-Hand Inswing Primed White Steel Prehung Front Door with Brickmold","unitCost":265.0,"unitPrice":331.25,"unit":"Each","qty":1},"labor":null},{"name":"Steves & Sons Element 36 in. x 80 in. Left-Hand Fan Lite Clear Glass White Primed Steel Prehung Front Door with Brickmold","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Steves & Sons Element 36 in. x 80 in. Left-Hand Fan Lite Clear Glass White Primed Steel Prehung Front Door with Brickmold","unitCost":336.0,"unitPrice":420.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steves & Sons Element 36 in. x 80 in. Left-Hand Fan Lite Clear Glass White Primed Steel Prehung Front Door with Brickmold","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"TRUporte 60 in. x 80 in. 230 Series Steel White Mirror Interior Sliding Door","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"TRUporte 60 in. x 80 in. 230 Series Steel White Mirror Interior Sliding Door","unitCost":219.0,"unitPrice":273.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - TRUporte 60 in. x 80 in. 230 Series Steel White Mirror Interior Sliding Door","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Trending White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Trending White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Trending White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 64 in. L","unitCost":6.98,"unitPrice":8.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 72 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 72 in. L","unitCost":6.75,"unitPrice":8.438,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 23 in. W x 72 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 27 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 27 in. W x 64 in. L","unitCost":6.75,"unitPrice":8.438,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 27 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 29 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 29 in. W x 64 in. L","unitCost":8.98,"unitPrice":11.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 29 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 64 in. L","unitCost":9.98,"unitPrice":12.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 72 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 72 in. L","unitCost":11.98,"unitPrice":14.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 31 in. W x 72 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 32 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 32 in. W x 64 in. L","unitCost":10.48,"unitPrice":13.1,"unit":"Each","qty":1},"labor":null},{"name":"White Cordless 1 in. Vinyl Mini Blind - 33 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 33 in. W x 64 in. L","unitCost":10.98,"unitPrice":13.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 33 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 34 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 34 in. W x 64 in. L","unitCost":11.48,"unitPrice":14.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 34 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 35 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 35 in. W x 64 in. L","unitCost":11.98,"unitPrice":14.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 35 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 36 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 36 in. W x 64 in. L","unitCost":12.98,"unitPrice":16.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 36 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 46 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 47 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 47 in. W x 64 in. L","unitCost":29.98,"unitPrice":37.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 47 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 1 in. Vinyl Mini Blind - 58 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 1 in. Vinyl Mini Blind - 58 in. W x 64 in. L","unitCost":26.97,"unitPrice":33.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 1 in. Vinyl Mini Blind - 58 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 2 in. Faux Wood Blind - 30 in. W x 64 in. L","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 2 in. Faux Wood Blind - 30 in. W x 64 in. L","unitCost":43.98,"unitPrice":54.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 2 in. Faux Wood Blind - 30 in. W x 64 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 2 in. Faux Wood Blind - 33 in. W x 64 in. L (Actual Size 32.5 in. W x 64 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 2 in. Faux Wood Blind - 33 in. W x 64 in. L (Actual Size 32.5 in. W x 64 in. L)","unitCost":44.98,"unitPrice":56.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 2 in. Faux Wood Blind - 33 in. W x 64 in. L (Actual Size 32.5 in. W x 64 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless 2 in. Faux Wood Blind - 34 in. W x 64 in. L (Actual Size 33.5 in. W x 64 in. L)","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless 2 in. Faux Wood Blind - 34 in. W x 64 in. L (Actual Size 33.5 in. W x 64 in. L)","unitCost":43.98,"unitPrice":54.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless 2 in. Faux Wood Blind - 34 in. W x 64 in. L (Actual Size 33.5 in. W x 64 in. L)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 24 in. W x 48 in. L by Hampton Bay","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 24 in. W x 48 in. L by Hampton Bay","unitCost":20.47,"unitPrice":25.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 24 in. W x 48 in. L by Hampton Bay","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 32 in. W x 72 in. L by Hampton Bay","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 32 in. W x 72 in. L by Hampton Bay","unitCost":38.98,"unitPrice":48.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 32 in. W x 72 in. L by Hampton Bay","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 72 in. L by Hampton Bay","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 72 in. L by Hampton Bay","unitCost":38.98,"unitPrice":48.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door - 34 in. W x 72 in. L by Hampton Bay","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Window replacement","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":null,"labor":{"desc":"Labor - Window replacement","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Woodgrain Millwork 11/16 in. x 4-9/16 in. x 81 in. Primed Finger-Jointed Interior Flat Door Jamb Set Includes Pre Cut Header and Sides","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Woodgrain Millwork 11/16 in. x 4-9/16 in. x 81 in. Primed Finger-Jointed Interior Flat Door Jamb Set Includes Pre Cut Header and Sides","unitCost":38.84,"unitPrice":48.55,"unit":"Each","qty":1},"labor":{"desc":"Labor - Woodgrain Millwork 11/16 in. x 4-9/16 in. x 81 in. Primed Finger-Jointed Interior Flat Door Jamb Set Includes Pre Cut Header and Sides","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Wright Products Free-Hanging Black Push Button Handle Door Latch","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Wright Products Free-Hanging Black Push Button Handle Door Latch","unitCost":11.64,"unitPrice":14.55,"unit":"Each","qty":1},"labor":{"desc":"Labor - Wright Products Free-Hanging Black Push Button Handle Door Latch","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Wright Products Satin Nickel Serenade Mortise Set Door Latch","costCode":"1500 Doors & Windows","costCodeName":"Doors & Windows","materials":{"desc":"Wright Products Satin Nickel Serenade Mortise Set Door Latch","unitCost":74.93,"unitPrice":93.663,"unit":"Each","qty":1},"labor":{"desc":"Labor - Wright Products Satin Nickel Serenade Mortise Set Door Latch","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1200 Mechanical":[{"name":"1 Week Programmable Thermostat","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"1 Week Programmable Thermostat","unitCost":29.98,"unitPrice":37.475,"unit":"Each","qty":1},"labor":null},{"name":"12 in. x 6 in. 2-Way Wall/Ceiling Register","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"12 in. x 6 in. 2-Way Wall/Ceiling Register","unitCost":14.87,"unitPrice":18.588,"unit":"Each","qty":1},"labor":null},{"name":"14 x 20 x 1 Basic Household Pleated FPR 4 Air Filter by Rheem","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"14 x 20 x 1 Basic Household Pleated FPR 4 Air Filter by Rheem","unitCost":4.74,"unitPrice":5.925,"unit":"Each","qty":1},"labor":{"desc":"Labor - 14 x 20 x 1 Basic Household Pleated FPR 4 Air Filter by Rheem","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4 in. x 5 ft. Round Metal Duct Pipe by Master Flow","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"4 in. x 5 ft. Round Metal Duct Pipe by Master Flow","unitCost":10.98,"unitPrice":13.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - 4 in. x 5 ft. Round Metal Duct Pipe by Master Flow","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"AC Security Cage, Adjustable Height and Width, Steel Air Conditioner Cage for Round or Square Shape incl. Anti-Theft Screws (Reinforced Version)","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"AC Security Cage, Adjustable Height and Width, Steel Air Conditioner Cage for Round or Square Shape incl. Anti-Theft Screws (Reinforced Version)","unitCost":235.99,"unitPrice":294.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - AC Security Cage, Adjustable Height and Width, Steel Air Conditioner Cage for Round or Square Shape incl. Anti-Theft Screws (Reinforced Version)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 30 in. x 10 in. White Return Air Grille","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Everbilt 30 in. x 10 in. White Return Air Grille","unitCost":20.0,"unitPrice":25.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 30 in. x 10 in. White Return Air Grille","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 4 in. x 10 in. 2-Way Steel Floor Register in Brown","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Everbilt 4 in. x 10 in. 2-Way Steel Floor Register in Brown","unitCost":12.97,"unitPrice":16.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 4 in. x 10 in. 2-Way Steel Floor Register in Brown","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 4 in. x 10 in. White Floor Diffuser","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Everbilt 4 in. x 10 in. White Floor Diffuser","unitCost":12.97,"unitPrice":16.213,"unit":"Each","qty":1},"labor":null},{"name":"Frigidaire 8,000 BTU 115-Volt Window-Mounted Mini-Compact Air Conditioner with Temperature-Sensing Remote Control","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Frigidaire 8,000 BTU 115-Volt Window-Mounted Mini-Compact Air Conditioner with Temperature-Sensing Remote Control","unitCost":279.99,"unitPrice":349.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - Frigidaire 8,000 BTU 115-Volt Window-Mounted Mini-Compact Air Conditioner with Temperature-Sensing Remote Control","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"HDX 12 in. x 24 in. x 1 in. Standard Pleated Air Filter FPR 5 (3-Pack)","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"HDX 12 in. x 24 in. x 1 in. Standard Pleated Air Filter FPR 5 (3-Pack)","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - HDX 12 in. x 24 in. x 1 in. Standard Pleated Air Filter FPR 5 (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"HVAC Clean & Check (JC's AC)","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"HVAC Clean & Check (JC's AC)","unitCost":125.0,"unitPrice":156.25,"unit":"Each","qty":1},"labor":null},{"name":"Honeywell Home 20 x 25 x 5 Pleated MERV 10 - FPR 8 Air Filter","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Honeywell Home 20 x 25 x 5 Pleated MERV 10 - FPR 8 Air Filter","unitCost":38.98,"unitPrice":48.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Honeywell Home 20 x 25 x 5 Pleated MERV 10 - FPR 8 Air Filter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Install AC Cage","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Install AC Cage","unitCost":495.0,"unitPrice":618.75,"unit":"Each","qty":1},"labor":null},{"name":"Install new AC & Furnace","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Install new AC & Furnace","unitCost":5775.0,"unitPrice":7218.75,"unit":"Each","qty":1},"labor":null},{"name":"Labor to Install wall register","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":null,"labor":{"desc":"Labor - Labor to Install wall register","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install floor register","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":null,"labor":{"desc":"Labor - Labor to install floor register","unitCost":10.0,"unitPrice":11.5,"unit":"hr","qty":1}},{"name":"Master Flow 6 in. 90 Deg. Round Adjustable Elbow","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Master Flow 6 in. 90 Deg. Round Adjustable Elbow","unitCost":7.28,"unitPrice":9.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Master Flow 6 in. 90 Deg. Round Adjustable Elbow","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Master Flow 6 in. Round Duct Cap","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Master Flow 6 in. Round Duct Cap","unitCost":5.58,"unitPrice":6.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Master Flow 6 in. Round Duct Cap","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Master Flow 6 in. x 5 ft. Round Metal Duct Pipe","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Master Flow 6 in. x 5 ft. Round Metal Duct Pipe","unitCost":14.47,"unitPrice":18.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Master Flow 6 in. x 5 ft. Round Metal Duct Pipe","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Programmable Thermostat Install Labor","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":null,"labor":{"desc":"Labor - Programmable Thermostat Install Labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Rheem: 16 x 25 x 1 Basic Household Pleated FPR 4 Air Filter","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Rheem: 16 x 25 x 1 Basic Household Pleated FPR 4 Air Filter","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Rheem: 16 x 25 x 1 Basic Household Pleated FPR 4 Air Filter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"True Blue 14 x 25 x 1 Basic FPR 5 Pleated Air Filter","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"True Blue 14 x 25 x 1 Basic FPR 5 Pleated Air Filter","unitCost":5.25,"unitPrice":6.563,"unit":"Each","qty":1},"labor":{"desc":"Labor - True Blue 14 x 25 x 1 Basic FPR 5 Pleated Air Filter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"True Blue 16 x 20 x 1 Basic FPR 5 Pleated Air Filter","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"True Blue 16 x 20 x 1 Basic FPR 5 Pleated Air Filter","unitCost":4.98,"unitPrice":6.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - True Blue 16 x 20 x 1 Basic FPR 5 Pleated Air Filter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"True Blue 20 x 25 x 1 Basic FPR 5 Pleated Air Filter","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"True Blue 20 x 25 x 1 Basic FPR 5 Pleated Air Filter","unitCost":4.98,"unitPrice":6.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - True Blue 20 x 25 x 1 Basic FPR 5 Pleated Air Filter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Venti Air 12 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 12 in. W x 20 in H","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Venti Air 12 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 12 in. W x 20 in H","unitCost":68.76,"unitPrice":85.95,"unit":"Each","qty":1},"labor":{"desc":"Labor - Venti Air 12 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 12 in. W x 20 in H","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Venti Air 14 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 14 in. W x 20 in H","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Venti Air 14 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 14 in. W x 20 in H","unitCost":68.76,"unitPrice":85.95,"unit":"Each","qty":1},"labor":{"desc":"Labor - Venti Air 14 in. Wide x 20 in High Rectangular Floor Return Air Grille of Steel for Duct Opening 14 in. W x 20 in H","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Westinghouse 1-1/2 in. Square Clear Floral Design on White Diffuser with 12 in. Width","costCode":"1200 Mechanical","costCodeName":"Mechanical","materials":{"desc":"Westinghouse 1-1/2 in. Square Clear Floral Design on White Diffuser with 12 in. Width","unitCost":5.8,"unitPrice":7.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Westinghouse 1-1/2 in. Square Clear Floral Design on White Diffuser with 12 in. Width","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1100 Plumbing":[{"name":"1-1/2 in. White Plastic Sink Drain P- Trap","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"1-1/2 in. White Plastic Sink Drain P- Trap","unitCost":4.68,"unitPrice":5.85,"unit":"ea","qty":1},"labor":null},{"name":"1-1/2 in. White Plastic Slip-Joint Sink Drain Outlet Waste","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"1-1/2 in. White Plastic Slip-Joint Sink Drain Outlet Waste","unitCost":9.98,"unitPrice":12.475,"unit":"ea","qty":1},"labor":null},{"name":"1-Spray 1.4 in. Single Wall Mount Fixed Shower Head in Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"1-Spray 1.4 in. Single Wall Mount Fixed Shower Head in Chrome","unitCost":9.43,"unitPrice":11.788,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1-Spray 1.4 in. Single Wall Mount Fixed Shower Head in Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"1.5 GPM Regular Size Water-Saving Aerator Insert by NEOPERL","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"1.5 GPM Regular Size Water-Saving Aerator Insert by NEOPERL","unitCost":3.54,"unitPrice":4.425,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1.5 GPM Regular Size Water-Saving Aerator Insert by NEOPERL","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"14 in. Black Poly Bath Waste & Overflow with Tip-Toe Drain Plug and 2-Hole Faceplate, Matte Black","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"14 in. Black Poly Bath Waste & Overflow with Tip-Toe Drain Plug and 2-Hole Faceplate, Matte Black","unitCost":25.24,"unitPrice":31.55,"unit":"ea","qty":1},"labor":null},{"name":"2-Handle Claw Foot Tub Faucet in Polished Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"2-Handle Claw Foot Tub Faucet in Polished Chrome","unitCost":59.7,"unitPrice":74.625,"unit":"Each","qty":1},"labor":{"desc":"Labor - 2-Handle Claw Foot Tub Faucet in Polished Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"2-Handle Claw Foot Tub Faucet with Riser Showerhead and Shower Ring in Polished Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"2-Handle Claw Foot Tub Faucet with Riser Showerhead and Shower Ring in Polished Chrome","unitCost":192.68,"unitPrice":240.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - 2-Handle Claw Foot Tub Faucet with Riser Showerhead and Shower Ring in Polished Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"3/8 in. Compression x 7/8 in. Ballcock Nut x 12 in. Braided Polymer Toilet Supply Line","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"3/8 in. Compression x 7/8 in. Ballcock Nut x 12 in. Braided Polymer Toilet Supply Line","unitCost":12.0,"unitPrice":15.0,"unit":"ea","qty":1.0},"labor":null},{"name":"6-3/4 in. I.D. Cast Iron Pittsburgh Bell Trap Strainer by JONES STEPHENS","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"6-3/4 in. I.D. Cast Iron Pittsburgh Bell Trap Strainer by JONES STEPHENS","unitCost":6.96,"unitPrice":8.7,"unit":"Each","qty":1},"labor":{"desc":"Labor - 6-3/4 in. I.D. Cast Iron Pittsburgh Bell Trap Strainer by JONES STEPHENS","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"9.8 oz. Powder Septic Tank Treatment by RID-X","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"9.8 oz. Powder Septic Tank Treatment by RID-X","unitCost":9.48,"unitPrice":11.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - 9.8 oz. Powder Septic Tank Treatment by RID-X","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"9B-5D Diverter Stem for Sayco Bath Faucets","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"9B-5D Diverter Stem for Sayco Bath Faucets","unitCost":20.33,"unitPrice":25.413,"unit":"Each","qty":1},"labor":{"desc":"Labor - 9B-5D Diverter Stem for Sayco Bath Faucets","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Apollo 1/2 in. x 10 ft. Blue PEX-B Pipe","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Apollo 1/2 in. x 10 ft. Blue PEX-B Pipe","unitCost":0.36,"unitPrice":0.45,"unit":"Each","qty":1},"labor":{"desc":"Labor - Apollo 1/2 in. x 10 ft. Blue PEX-B Pipe","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Apollo 1/2 in. x 10 ft. Red PEX-B Pipe","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Apollo 1/2 in. x 10 ft. Red PEX-B Pipe","unitCost":0.36,"unitPrice":0.45,"unit":"Each","qty":1},"labor":{"desc":"Labor - Apollo 1/2 in. x 10 ft. Red PEX-B Pipe","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Banbury 1-Handle 1-Spray Trim Kit Tub and Shower Faucet 1.75 GPM in Matte Black (Valve and Handles Included)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Banbury 1-Handle 1-Spray Trim Kit Tub and Shower Faucet 1.75 GPM in Matte Black (Valve and Handles Included)","unitCost":165.62,"unitPrice":207.025,"unit":"ea","qty":1},"labor":null},{"name":"Bathroom Supply Line Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Bathroom Supply Line Labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Bootz Industries Aloha 60 in. Right Drain Rectangular Alcove Soaking Bathtub in White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Bootz Industries Aloha 60 in. Right Drain Rectangular Alcove Soaking Bathtub in White","unitCost":189.0,"unitPrice":236.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Bootz Industries Aloha 60 in. Right Drain Rectangular Alcove Soaking Bathtub in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Bootz Industries Aloha 60 in. x 30 in. Soaking Bathtub with Left Drain in White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Bootz Industries Aloha 60 in. x 30 in. Soaking Bathtub with Left Drain in White","unitCost":189.0,"unitPrice":236.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Bootz Industries Aloha 60 in. x 30 in. Soaking Bathtub with Left Drain in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Brass Craft 3/8 in. Compression x 1/2 in. FIP x 20 in. Braided Polymer Universal Faucet Water Connector","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Brass Craft 3/8 in. Compression x 1/2 in. FIP x 20 in. Braided Polymer Universal Faucet Water Connector","unitCost":8.97,"unitPrice":11.213,"unit":"Each","qty":1},"labor":null},{"name":"COOLWEST Commercial Wall Mount Faucet 8 Inch Center with 8\" Gooseneck Swivel Spout, 2 Handles Heavy Duty Brass Kitchen Sink Faucet, Chrome Finish","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"COOLWEST Commercial Wall Mount Faucet 8 Inch Center with 8\" Gooseneck Swivel Spout, 2 Handles Heavy Duty Brass Kitchen Sink Faucet, Chrome Finish","unitCost":86.99,"unitPrice":108.738,"unit":"Each","qty":1},"labor":{"desc":"Labor - COOLWEST Commercial Wall Mount Faucet 8 Inch Center with 8\" Gooseneck Swivel Spout, 2 Handles Heavy Duty Brass Kitchen Sink Faucet, Chrome Finish","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Camera Lateral","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Camera Lateral","unitCost":155.0,"unitPrice":193.75,"unit":"Each","qty":1},"labor":null},{"name":"Charlotte Pipe 1-1/2 in. PVC DWV Coupling","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Charlotte Pipe 1-1/2 in. PVC DWV Coupling","unitCost":1.04,"unitPrice":1.3,"unit":"Each","qty":1},"labor":{"desc":"Labor - Charlotte Pipe 1-1/2 in. PVC DWV Coupling","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Charlotte Pipe 2 in. PVC DWV 90-Degree Long Sweep Elbow","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Charlotte Pipe 2 in. PVC DWV 90-Degree Long Sweep Elbow","unitCost":4.04,"unitPrice":5.05,"unit":"Each","qty":1},"labor":{"desc":"Labor - Charlotte Pipe 2 in. PVC DWV 90-Degree Long Sweep Elbow","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Charlotte Pipe 2 in. PVC Schedule 40 Socket Cap","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Charlotte Pipe 2 in. PVC Schedule 40 Socket Cap","unitCost":2.59,"unitPrice":3.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - Charlotte Pipe 2 in. PVC Schedule 40 Socket Cap","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Charlotte Pipe 2 in. x 10 ft. White Schedule 40 PVC Pipe Solid Core","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Charlotte Pipe 2 in. x 10 ft. White Schedule 40 PVC Pipe Solid Core","unitCost":1.1,"unitPrice":1.375,"unit":"Each","qty":1},"labor":{"desc":"Labor - Charlotte Pipe 2 in. x 10 ft. White Schedule 40 PVC Pipe Solid Core","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clear clog","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Clear clog","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"DANCO 1-1/4 in. Stainless Steel Sink Hole Cover in Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"DANCO 1-1/4 in. Stainless Steel Sink Hole Cover in Chrome","unitCost":3.53,"unitPrice":4.413,"unit":"Each","qty":1},"labor":{"desc":"Labor - DANCO 1-1/4 in. Stainless Steel Sink Hole Cover in Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"DANCO 5 in. Bathroom Tub Spout with Front Diverter, Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"DANCO 5 in. Bathroom Tub Spout with Front Diverter, Chrome","unitCost":18.98,"unitPrice":23.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - DANCO 5 in. Bathroom Tub Spout with Front Diverter, Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"DANCO 5 in. Flat Suction Sink Stopper in White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"DANCO 5 in. Flat Suction Sink Stopper in White","unitCost":2.97,"unitPrice":3.713,"unit":"Each","qty":1},"labor":null},{"name":"Danco Twist and Turn Tub Drain Kit with Chrome Trim","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Danco Twist and Turn Tub Drain Kit with Chrome Trim","unitCost":24.34,"unitPrice":30.425,"unit":"Each","qty":1},"labor":{"desc":"Labor - Danco Twist and Turn Tub Drain Kit with Chrome Trim","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Delta Classic 500 60 in. x 32 in. Alcove Deep Soaking Bathtub with Right Drain in High Gloss White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Delta Classic 500 60 in. x 32 in. Alcove Deep Soaking Bathtub with Right Drain in High Gloss White","unitCost":279.0,"unitPrice":348.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Delta Classic 500 60 in. x 32 in. Alcove Deep Soaking Bathtub with Right Drain in High Gloss White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Delta Hycroft 60\"W x 30\"D x 19-1/4\"H White Bathtub with Right Drain","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Delta Hycroft 60\"W x 30\"D x 19-1/4\"H White Bathtub with Right Drain","unitCost":268.99,"unitPrice":336.238,"unit":"Each","qty":1},"labor":null},{"name":"Double Sink Drain Line Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Double Sink Drain Line Labor","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Drain cabeling/drain","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Drain cabeling/drain","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Drano Commercial Line 128 fl. oz. Max Gel Clog Remover","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Drano Commercial Line 128 fl. oz. Max Gel Clog Remover","unitCost":14.88,"unitPrice":18.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Drano Commercial Line 128 fl. oz. Max Gel Clog Remover","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"DreamLine SlimLine 60 in. x 32 in. Single Threshold Shower Pan Base in White with Right Hand Drain","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"DreamLine SlimLine 60 in. x 32 in. Single Threshold Shower Pan Base in White with Right Hand Drain","unitCost":289.99,"unitPrice":362.488,"unit":"Each","qty":1},"labor":{"desc":"Labor - DreamLine SlimLine 60 in. x 32 in. Single Threshold Shower Pan Base in White with Right Hand Drain","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Eastman 1/2 in. IPS x 3/4 in. Brass MIP x MHT Hose Washing Machine Outlet Stop Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Eastman 1/2 in. IPS x 3/4 in. Brass MIP x MHT Hose Washing Machine Outlet Stop Valve","unitCost":14.0,"unitPrice":17.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Eastman 1/2 in. IPS x 3/4 in. Brass MIP x MHT Hose Washing Machine Outlet Stop Valve","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Economy Kitchen Side Spray with Guide in Black","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Economy Kitchen Side Spray with Guide in Black","unitCost":8.48,"unitPrice":10.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Economy Kitchen Side Spray with Guide in Black","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 1-1/2 in. White Plastic Sink Drain P-Trap with Reversible J-Bend","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt 1-1/2 in. White Plastic Sink Drain P-Trap with Reversible J-Bend","unitCost":4.68,"unitPrice":5.85,"unit":"Each","qty":1},"labor":null},{"name":"Everbilt 1-1/2 in. x 6 in. White Plastic Slip-Joint Sink Drain Tailpiece Extension Tube","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt 1-1/2 in. x 6 in. White Plastic Slip-Joint Sink Drain Tailpiece Extension Tube","unitCost":3.74,"unitPrice":4.675,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 1-1/2 in. x 6 in. White Plastic Slip-Joint Sink Drain Tailpiece Extension Tube","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 1-1/4 in. Plastic Sink Drain Pop-Up Drain Assembly in Chrome Finish","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt 1-1/4 in. Plastic Sink Drain Pop-Up Drain Assembly in Chrome Finish","unitCost":12.29,"unitPrice":15.363,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 1-1/4 in. Plastic Sink Drain Pop-Up Drain Assembly in Chrome Finish","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 1/2 in. FIP x MHT Chrome-Plated Brass Washing Machine Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt 1/2 in. FIP x MHT Chrome-Plated Brass Washing Machine Valve","unitCost":9.67,"unitPrice":12.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 1/2 in. FIP x MHT Chrome-Plated Brass Washing Machine Valve","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 3/4 in. Brass Sweat x Sweat Full Port Ball Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt 3/4 in. Brass Sweat x Sweat Full Port Ball Valve","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 3/4 in. Brass Sweat x Sweat Full Port Ball Valve","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Zinc-Plated Toilet Bolts","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Zinc-Plated Toilet Bolts","unitCost":6.98,"unitPrice":8.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Zinc-Plated Toilet Bolts","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Fast Set 4 in. PVC Hub Toilet Flange with Test Cap and Stainless Steel Ring","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Fast Set 4 in. PVC Hub Toilet Flange with Test Cap and Stainless Steel Ring","unitCost":9.57,"unitPrice":11.963,"unit":"Each","qty":1},"labor":null},{"name":"Fluidmaster PerforMAX Universal High Performance Toilet Fill Valve and 2 in. Flapper Repair Kit","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Fluidmaster PerforMAX Universal High Performance Toilet Fill Valve and 2 in. Flapper Repair Kit","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Fluidmaster PerforMAX Universal High Performance Toilet Fill Valve and 2 in. Flapper Repair Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Fluidmaster Replacement Dual Flush Push Buttons for Glacier Bay Toilets","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Fluidmaster Replacement Dual Flush Push Buttons for Glacier Bay Toilets","unitCost":8.97,"unitPrice":11.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Fluidmaster Replacement Dual Flush Push Buttons for Glacier Bay Toilets","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"GLACIER BAY 33 in. Drop-in Double Bowl 22 Gauge Stainless Steel Kitchen Sink with 4-Faucet Holes","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"GLACIER BAY 33 in. Drop-in Double Bowl 22 Gauge Stainless Steel Kitchen Sink with 4-Faucet Holes","unitCost":79.0,"unitPrice":98.75,"unit":"Each","qty":1},"labor":null},{"name":"Glacier Bay 2-Piece 1.28 GPF High Efficiency Single Flush Round Toilet in White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay 2-Piece 1.28 GPF High Efficiency Single Flush Round Toilet in White","unitCost":89.0,"unitPrice":111.25,"unit":"Each","qty":1},"labor":null},{"name":"Glacier Bay 2-piece 1.1 GPF/1.6 GPF High Efficiency Dual Flush Complete Elongated Toilet in White, Seat Included","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay 2-piece 1.1 GPF/1.6 GPF High Efficiency Dual Flush Complete Elongated Toilet in White, Seat Included","unitCost":99.0,"unitPrice":123.75,"unit":"Each","qty":1},"labor":null},{"name":"Glacier Bay 25 in. Drop-in Single Bowl 22 Gauge Stainless Steel Kitchen Sink","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay 25 in. Drop-in Single Bowl 22 Gauge Stainless Steel Kitchen Sink","unitCost":69.0,"unitPrice":86.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay 25 in. Drop-in Single Bowl 22 Gauge Stainless Steel Kitchen Sink","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay Aragon 3 Handle 1-Spray Tub and Shower Faucet 1.8 GPM in Chrome (Valve Included)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay Aragon 3 Handle 1-Spray Tub and Shower Faucet 1.8 GPM in Chrome (Valve Included)","unitCost":99.0,"unitPrice":123.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay Aragon 3 Handle 1-Spray Tub and Shower Faucet 1.8 GPM in Chrome (Valve Included)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay Constructor 4 in. Centerset 2-Handle Low-Arc Bathroom Faucet in Brushed Nickel","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay Constructor 4 in. Centerset 2-Handle Low-Arc Bathroom Faucet in Brushed Nickel","unitCost":29.98,"unitPrice":37.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay Constructor 4 in. Centerset 2-Handle Low-Arc Bathroom Faucet in Brushed Nickel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with polished finish","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with polished finish","unitCost":10.77,"unitPrice":13.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with polished finish","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"InSinkErator Badger 500 1/2 HP Continuous Feed Garbage Disposal","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"InSinkErator Badger 500 1/2 HP Continuous Feed Garbage Disposal","unitCost":139.0,"unitPrice":173.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - InSinkErator Badger 500 1/2 HP Continuous Feed Garbage Disposal","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kitchen Sink Install Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Kitchen Sink Install Labor","unitCost":300.0,"unitPrice":345.0,"unit":"hr","qty":1}},{"name":"Korky QuietFILL Platinum Complete Universal Toilet Repair Kit","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Korky QuietFILL Platinum Complete Universal Toilet Repair Kit","unitCost":27.98,"unitPrice":34.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Korky QuietFILL Platinum Complete Universal Toilet Repair Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Korky StrongARM Universal Toilet Flush Handle Wave Style in Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Korky StrongARM Universal Toilet Flush Handle Wave Style in Chrome","unitCost":16.97,"unitPrice":21.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Korky StrongARM Universal Toilet Flush Handle Wave Style in Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor to install Bathtub","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Labor to install Bathtub","unitCost":700.0,"unitPrice":805.0,"unit":"hr","qty":1}},{"name":"Labor to replace toilet","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Labor to replace toilet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor: Glacier Bay Market Single-Handle Pull-Out Sprayer Kitchen Faucet in Stainless Steel","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Labor: Glacier Bay Market Single-Handle Pull-Out Sprayer Kitchen Faucet in Stainless Steel","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":null},{"name":"Lift-Off Round Closed Front Toilet Seat in White","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Lift-Off Round Closed Front Toilet Seat in White","unitCost":16.97,"unitPrice":21.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Lift-Off Round Closed Front Toilet Seat in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Lyons Classic 60\"W x 32\"D White Bathtub Wall Surround","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Lyons Classic 60\"W x 32\"D White Bathtub Wall Surround","unitCost":109.99,"unitPrice":137.488,"unit":"Each","qty":1},"labor":{"desc":"Labor - Lyons Classic 60\"W x 32\"D White Bathtub Wall Surround","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"MOEN Adler Single-Handle 4-Spray Tub and Shower Faucet in Chrome (Valve Included)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"MOEN Adler Single-Handle 4-Spray Tub and Shower Faucet in Chrome (Valve Included)","unitCost":99.0,"unitPrice":123.75,"unit":"Each","qty":1},"labor":null},{"name":"MOEN Brass Single-Handle Replacement Cartridge","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"MOEN Brass Single-Handle Replacement Cartridge","unitCost":29.88,"unitPrice":37.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - MOEN Brass Single-Handle Replacement Cartridge","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Material: Glacier Bay Market Single-Handle Pull-Out Sprayer Kitchen Faucet in Stainless Steel","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Material: Glacier Bay Market Single-Handle Pull-Out Sprayer Kitchen Faucet in Stainless Steel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Moen Chateau Handle Kit in Clear (Tub Faucet Handle)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Moen Chateau Handle Kit in Clear (Tub Faucet Handle)","unitCost":12.98,"unitPrice":16.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - Moen Chateau Handle Kit in Clear (Tub Faucet Handle)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Oatey 1/2 in. Copper Tube Size Split Flange Escutcheon Plate in Chrome-Plated Steel","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Oatey 1/2 in. Copper Tube Size Split Flange Escutcheon Plate in Chrome-Plated Steel","unitCost":5.25,"unitPrice":6.563,"unit":"Each","qty":1},"labor":{"desc":"Labor - Oatey 1/2 in. Copper Tube Size Split Flange Escutcheon Plate in Chrome-Plated Steel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Oatey 3-1/2 in. Center Drain Washing Machine Outlet Box","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Oatey 3-1/2 in. Center Drain Washing Machine Outlet Box","unitCost":23.67,"unitPrice":29.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Oatey 3-1/2 in. Center Drain Washing Machine Outlet Box","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Oatey 8 oz. Purple CPVC and PVC Primer and Medium Milky All-Purpose ABS, CPVC, PVC Cement Combo Pack","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Oatey 8 oz. Purple CPVC and PVC Primer and Medium Milky All-Purpose ABS, CPVC, PVC Cement Combo Pack","unitCost":13.26,"unitPrice":16.575,"unit":"Each","qty":1},"labor":null},{"name":"P Trap Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - P Trap Labor","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Pedestal Sink (Glacier Bay Shelburne/Petite Aragon Pedestal in White & Glacier Bay Petite Aragon 8-3/8 in. Pedestal Sink Basin in White)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Pedestal Sink (Glacier Bay Shelburne/Petite Aragon Pedestal in White & Glacier Bay Petite Aragon 8-3/8 in. Pedestal Sink Basin in White)","unitCost":73.75,"unitPrice":92.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Pedestal Sink (Glacier Bay Shelburne/Petite Aragon Pedestal in White & Glacier Bay Petite Aragon 8-3/8 in. Pedestal Sink Basin in White)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Pegasus 2-Handle Claw Foot Tub Faucet with Riser 54 in. Rectangular Shower Ring and Showerhead in Polished Chrome","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Pegasus 2-Handle Claw Foot Tub Faucet with Riser 54 in. Rectangular Shower Ring and Showerhead in Polished Chrome","unitCost":310.55,"unitPrice":388.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Pegasus 2-Handle Claw Foot Tub Faucet with Riser 54 in. Rectangular Shower Ring and Showerhead in Polished Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Pfister 910-374 Marquis Hot and Cold Replacement Stem for Tub and Shower Faucets","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Pfister 910-374 Marquis Hot and Cold Replacement Stem for Tub and Shower Faucets","unitCost":17.48,"unitPrice":21.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - Pfister 910-374 Marquis Hot and Cold Replacement Stem for Tub and Shower Faucets","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Power Flush 2-Piece 1.28 GPF Single Flush Extra Tall Elongated Toilet in White with Slow-Close Seat Included","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Power Flush 2-Piece 1.28 GPF Single Flush Extra Tall Elongated Toilet in White with Slow-Close Seat Included","unitCost":183.08,"unitPrice":228.85,"unit":"ea","qty":1},"labor":null},{"name":"Prier Products 12 in. Full turn frost proof wall hydrant, 1/2 in. MIP x 1/2 in. SWT","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Prier Products 12 in. Full turn frost proof wall hydrant, 1/2 in. MIP x 1/2 in. SWT","unitCost":49.79,"unitPrice":62.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prier Products 12 in. Full turn frost proof wall hydrant, 1/2 in. MIP x 1/2 in. SWT","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"SharkBite 1/2 in. Push-to-Connect x 3/8 in. O.D. Compression Chrome-Plated Brass Quarter-Turn Angle Stop Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"SharkBite 1/2 in. Push-to-Connect x 3/8 in. O.D. Compression Chrome-Plated Brass Quarter-Turn Angle Stop Valve","unitCost":13.45,"unitPrice":16.813,"unit":"Each","qty":1},"labor":null},{"name":"Sharkbite Shutoff Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Sharkbite Shutoff Labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Shower Valve Replacement Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Shower Valve Replacement Labor","unitCost":150.0,"unitPrice":172.5,"unit":"hr","qty":1}},{"name":"Tectite 1/2 in. Brass Push-To-Connect x 3/4 in. Male Hose Thread Straight Washing Machine Ball Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Tectite 1/2 in. Brass Push-To-Connect x 3/4 in. Male Hose Thread Straight Washing Machine Ball Valve","unitCost":9.97,"unitPrice":12.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Tectite 1/2 in. Brass Push-To-Connect x 3/4 in. Male Hose Thread Straight Washing Machine Ball Valve","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"The Tub and Shower Valve UPDATE PLATE, Compatible With Most Single Handle Tub and Shower Valves, Allows for Plenty of Space When Replacing Your Old Tub Faucet, Looks Good, Problem Solved (White)","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"The Tub and Shower Valve UPDATE PLATE, Compatible With Most Single Handle Tub and Shower Valves, Allows for Plenty of Space When Replacing Your Old Tub Faucet, Looks Good, Problem Solved (White)","unitCost":64.96,"unitPrice":81.2,"unit":"ea","qty":1},"labor":null},{"name":"Tub Drain Linkage Assembly","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Tub Drain Linkage Assembly","unitCost":18.84,"unitPrice":23.55,"unit":"Each","qty":1},"labor":null},{"name":"Tub/Shower Drain Linkage Labor","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - Tub/Shower Drain Linkage Labor","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"UDP 1/2 in. I.D. x 5/8 in. O.D. x 20 ft. Clear Vinyl Tubing","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"UDP 1/2 in. I.D. x 5/8 in. O.D. x 20 ft. Clear Vinyl Tubing","unitCost":10.07,"unitPrice":12.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - UDP 1/2 in. I.D. x 5/8 in. O.D. x 20 ft. Clear Vinyl Tubing","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water Heater Expansion Tank","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water Heater Expansion Tank","unitCost":29.88,"unitPrice":37.35,"unit":"Each","qty":1},"labor":null},{"name":"Water heater - 30 gal, tall, electric","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 30 gal, tall, electric","unitCost":569.0,"unitPrice":711.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 30 gal, tall, electric","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water heater - 30 gal, tall, natural gas","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 30 gal, tall, natural gas","unitCost":609.0,"unitPrice":761.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 30 gal, tall, natural gas","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water heater - 40 gal, tall, electric","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 40 gal, tall, electric","unitCost":419.0,"unitPrice":523.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 40 gal, tall, electric","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water heater - 40 gal, tall, natural gas","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 40 gal, tall, natural gas","unitCost":699.0,"unitPrice":873.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 40 gal, tall, natural gas","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water heater - 50 gal, tall, electric","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 50 gal, tall, electric","unitCost":499.0,"unitPrice":623.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 50 gal, tall, electric","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Water heater - 50 gal, tall, natural gas","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Water heater - 50 gal, tall, natural gas","unitCost":799.0,"unitPrice":998.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Water heater - 50 gal, tall, natural gas","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Woodford 1/2 in. x 1/2 in. MPT x Female Sweat x 12 in. L Freezeless Anti-Siphon Sillcock Valve","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":{"desc":"Woodford 1/2 in. x 1/2 in. MPT x Female Sweat x 12 in. L Freezeless Anti-Siphon Sillcock Valve","unitCost":50.52,"unitPrice":63.15,"unit":"Each","qty":1},"labor":{"desc":"Labor - Woodford 1/2 in. x 1/2 in. MPT x Female Sweat x 12 in. L Freezeless Anti-Siphon Sillcock Valve","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"labor to install toilet","costCode":"1100 Plumbing","costCodeName":"Plumbing","materials":null,"labor":{"desc":"Labor - labor to install toilet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1000 Electrical":[{"name":"1-Gang Duplex Outlet Wall Plate, Light Almond by Leviton","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1-Gang Duplex Outlet Wall Plate, Light Almond by Leviton","unitCost":0.48,"unitPrice":0.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1-Gang Duplex Outlet Wall Plate, Light Almond by Leviton","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"1-Gang Duplex Outlet Wall Plate, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1-Gang Duplex Outlet Wall Plate, White","unitCost":0.48,"unitPrice":0.6,"unit":"Each","qty":1},"labor":null},{"name":"1-Gang Midway Toggle Nylon Wall Plate, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1-Gang Midway Toggle Nylon Wall Plate, White","unitCost":0.58,"unitPrice":0.725,"unit":"Each","qty":1},"labor":null},{"name":"1-Light Oil Rubbed Bronze Sconce with Tea Stained Glass Shade by Hampton Bay","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1-Light Oil Rubbed Bronze Sconce with Tea Stained Glass Shade by Hampton Bay","unitCost":25.97,"unitPrice":32.463,"unit":"Each","qty":1},"labor":null},{"name":"1/2 HP Heavy-Duty Chain Drive Garage Door Opener","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1/2 HP Heavy-Duty Chain Drive Garage Door Opener","unitCost":128.0,"unitPrice":160.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1/2 HP Heavy-Duty Chain Drive Garage Door Opener","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"1/2 in. x 10 ft. Electric Metallic Tube (EMT) Conduit","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"1/2 in. x 10 ft. Electric Metallic Tube (EMT) Conduit","unitCost":5.86,"unitPrice":7.325,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1/2 in. x 10 ft. Electric Metallic Tube (EMT) Conduit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"100 ft. 10/3 Solid Romex SIMpull CU NM-B W/G Wire Pink Coil","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"100 ft. 10/3 Solid Romex SIMpull CU NM-B W/G Wire Pink Coil","unitCost":295.0,"unitPrice":368.75,"unit":"Each","qty":1},"labor":null},{"name":"11 in. 1-Light Brushed Nickel Flush Mount with Frosted Glass Shade (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"11 in. 1-Light Brushed Nickel Flush Mount with Frosted Glass Shade (2-Pack)","unitCost":22.47,"unitPrice":28.088,"unit":"Each","qty":1},"labor":null},{"name":"15 Amp 2-Wire Duplex Outlet, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"15 Amp 2-Wire Duplex Outlet, White","unitCost":2.82,"unitPrice":3.525,"unit":"Each","qty":1},"labor":null},{"name":"15 Amp Residential Grade 1-Gang Recessed Single Outlet with Clocked Hanger Hook, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"15 Amp Residential Grade 1-Gang Recessed Single Outlet with Clocked Hanger Hook, White","unitCost":9.51,"unitPrice":11.888,"unit":"Each","qty":1},"labor":{"desc":"Labor - 15 Amp Residential Grade 1-Gang Recessed Single Outlet with Clocked Hanger Hook, White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"15 Amp Self-Test SmartlockPro Slim Duplex GFCI Outlet, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"15 Amp Self-Test SmartlockPro Slim Duplex GFCI Outlet, White","unitCost":13.98,"unitPrice":17.475,"unit":"Each","qty":1},"labor":null},{"name":"15 Amp Single-Pole Toggle Light Switch, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"15 Amp Single-Pole Toggle Light Switch, White","unitCost":0.85,"unitPrice":1.063,"unit":"Each","qty":1},"labor":null},{"name":"20-Watt 2 ft. Linear T12 Fluorescent Tube Light Bulb Cool White (4100K)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"20-Watt 2 ft. Linear T12 Fluorescent Tube Light Bulb Cool White (4100K)","unitCost":10.98,"unitPrice":13.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - 20-Watt 2 ft. Linear T12 Fluorescent Tube Light Bulb Cool White (4100K)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"30 Amp 125/250V, NEMA 14-30R Surface Mount Power Outlet, Single Straight Blade Range & Dryer Outlet Grounding, Black","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"30 Amp 125/250V, NEMA 14-30R Surface Mount Power Outlet, Single Straight Blade Range & Dryer Outlet Grounding, Black","unitCost":11.11,"unitPrice":13.888,"unit":"Each","qty":1},"labor":null},{"name":"32-Watt 4 ft. Alto Linear T8 Fluorescent Tube Light Bulb, Daylight (6500K) (10-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"32-Watt 4 ft. Alto Linear T8 Fluorescent Tube Light Bulb, Daylight (6500K) (10-Pack)","unitCost":5.0,"unitPrice":6.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - 32-Watt 4 ft. Alto Linear T8 Fluorescent Tube Light Bulb, Daylight (6500K) (10-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4-3/4 in., 3-1/8 in. Clear Fitter Jelly Jar Ceiling Fixture Replacement Glass (4 Per Box)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - 4-3/4 in., 3-1/8 in. Clear Fitter Jelly Jar Ceiling Fixture Replacement Glass (4 Per Box)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"40-Watt 4 ft. Linear T12 ALTO Fluorescent Tube Light Bulb Bright White (3000K) (2-Pack) by Philips","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"40-Watt 4 ft. Linear T12 ALTO Fluorescent Tube Light Bulb Bright White (3000K) (2-Pack) by Philips","unitCost":6.99,"unitPrice":8.738,"unit":"Each","qty":1},"labor":{"desc":"Labor - 40-Watt 4 ft. Linear T12 ALTO Fluorescent Tube Light Bulb Bright White (3000K) (2-Pack) by Philips","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"5 in.Bronze Metal Rectangle Ceiling Fan Pull Chains (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"5 in.Bronze Metal Rectangle Ceiling Fan Pull Chains (2-Pack)","unitCost":10.97,"unitPrice":13.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - 5 in.Bronze Metal Rectangle Ceiling Fan Pull Chains (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"50 Amp Thermoplastic Power Single Outlet, Black by Leviton","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"50 Amp Thermoplastic Power Single Outlet, Black by Leviton","unitCost":9.67,"unitPrice":12.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - 50 Amp Thermoplastic Power Single Outlet, Black by Leviton","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"60-Watt Double Life B10 Incandescent Light Bulb (4-Pack) by Sylvania (Candelabra)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - 60-Watt Double Life B10 Incandescent Light Bulb (4-Pack) by Sylvania (Candelabra)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"60-Watt Equivalent A19 Non-Dimmable LED Light Bulb Soft White (8-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"60-Watt Equivalent A19 Non-Dimmable LED Light Bulb Soft White (8-Pack)","unitCost":1.62,"unitPrice":2.025,"unit":"Each","qty":1},"labor":{"desc":"Labor - 60-Watt Equivalent A19 Non-Dimmable LED Light Bulb Soft White (8-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"90-Watt PAR38 Halogen Indoor/Outdoor Flood Light Bulb (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"90-Watt PAR38 Halogen Indoor/Outdoor Flood Light Bulb (2-Pack)","unitCost":4.99,"unitPrice":6.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - 90-Watt PAR38 Halogen Indoor/Outdoor Flood Light Bulb (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"AmazonBasics 48 Pack AA High-Performance Alkaline Batteries, 10-Year Shelf Life, Easy to Open Value Pack","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"AmazonBasics 48 Pack AA High-Performance Alkaline Batteries, 10-Year Shelf Life, Easy to Open Value Pack","unitCost":0.32,"unitPrice":0.4,"unit":"Each","qty":1},"labor":{"desc":"Labor - AmazonBasics 48 Pack AA High-Performance Alkaline Batteries, 10-Year Shelf Life, Easy to Open Value Pack","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"AmazonBasics 9 Volt Everyday Alkaline Batteries - Pack of 8","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"AmazonBasics 9 Volt Everyday Alkaline Batteries - Pack of 8","unitCost":1.58,"unitPrice":1.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - AmazonBasics 9 Volt Everyday Alkaline Batteries - Pack of 8","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Carlon 14 cu. in. PVC Old Work Electrical Outlet Box (1-Gang )","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Carlon 14 cu. in. PVC Old Work Electrical Outlet Box (1-Gang )","unitCost":2.18,"unitPrice":2.725,"unit":"Each","qty":1},"labor":null},{"name":"Ceiling Fan - 44\"","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Ceiling Fan - 44\"","unitCost":74.97,"unitPrice":93.713,"unit":"Each","qty":1},"labor":null},{"name":"Ceiling Fan - 52\"","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Ceiling Fan - 52\"","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":null},{"name":"Ceiling fan install Labor","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Ceiling fan install Labor","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Chrome Pull Chain Fan Light Switch by Commercial Electric","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Chrome Pull Chain Fan Light Switch by Commercial Electric","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Code One Battery Operated Carbon Monoxide Detector","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Code One Battery Operated Carbon Monoxide Detector","unitCost":18.5,"unitPrice":23.125,"unit":"Each","qty":1},"labor":{"desc":"Labor - Code One Battery Operated Carbon Monoxide Detector","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Commercial Electric 1/2 in. Gray Weatherproof Closure Plugs","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric 1/2 in. Gray Weatherproof Closure Plugs","unitCost":3.12,"unitPrice":3.9,"unit":"Each","qty":1},"labor":{"desc":"Labor - Commercial Electric 1/2 in. Gray Weatherproof Closure Plugs","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Commercial Electric 11 in. Oil Rubbed Bronze Color Changing LED Ceiling Flush Mount (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric 11 in. Oil Rubbed Bronze Color Changing LED Ceiling Flush Mount (2-Pack)","unitCost":60.47,"unitPrice":75.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Commercial Electric 11 in. Oil Rubbed Bronze Color Changing LED Ceiling Flush Mount (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Commercial Electric 15 in. Brushed Nickel New Ultra-Low Profile Integrated LED Flush Mount 5CCT (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric 15 in. Brushed Nickel New Ultra-Low Profile Integrated LED Flush Mount 5CCT (2-Pack)","unitCost":39.99,"unitPrice":49.988,"unit":"Each","qty":1},"labor":null},{"name":"Commercial Electric 16 in. Low Profile LED Flush Mount Round Closet Light Fixture 1700 Lumens 3000K 4000K 5000K Dimmable Hallway Stairwell","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric 16 in. Low Profile LED Flush Mount Round Closet Light Fixture 1700 Lumens 3000K 4000K 5000K Dimmable Hallway Stairwell","unitCost":39.97,"unitPrice":49.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Commercial Electric 16 in. Low Profile LED Flush Mount Round Closet Light Fixture 1700 Lumens 3000K 4000K 5000K Dimmable Hallway Stairwell","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Commercial Electric 3 ft. Chrome Beaded Chain with Connector","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric 3 ft. Chrome Beaded Chain with Connector","unitCost":3.47,"unitPrice":4.338,"unit":"Each","qty":1},"labor":{"desc":"Labor - Commercial Electric 3 ft. Chrome Beaded Chain with Connector","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Commercial Electric Clear 1-Gang Extra-Duty Non-Metallic While-In-Use Weatherproof Horizontal/Vertical Receptacle Cover","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Commercial Electric Clear 1-Gang Extra-Duty Non-Metallic While-In-Use Weatherproof Horizontal/Vertical Receptacle Cover","unitCost":9.43,"unitPrice":11.788,"unit":"Each","qty":1},"labor":{"desc":"Labor - Commercial Electric Clear 1-Gang Extra-Duty Non-Metallic While-In-Use Weatherproof Horizontal/Vertical Receptacle Cover","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cooper Bussmann TL Style 15 Amp Plug Fuse (4-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Cooper Bussmann TL Style 15 Amp Plug Fuse (4-Pack)","unitCost":11.67,"unitPrice":14.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Cooper Bussmann TL Style 15 Amp Plug Fuse (4-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cooper Bussmann TL Style 20 Amp Plug Fuse (4-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Cooper Bussmann TL Style 20 Amp Plug Fuse (4-Pack)","unitCost":11.67,"unitPrice":14.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Cooper Bussmann TL Style 20 Amp Plug Fuse (4-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cooper Bussmann TL Style 30 Amp Plug Fuse (4-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Cooper Bussmann TL Style 30 Amp Plug Fuse (4-Pack)","unitCost":11.67,"unitPrice":14.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - Cooper Bussmann TL Style 30 Amp Plug Fuse (4-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Design House Village 1-Light Indoor Dimmable Wall Sconce with Frosted Flute Glass and Twist On/Off Switch, Satin Nickel","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Design House Village 1-Light Indoor Dimmable Wall Sconce with Frosted Flute Glass and Twist On/Off Switch, Satin Nickel","unitCost":23.35,"unitPrice":29.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Design House Village 1-Light Indoor Dimmable Wall Sconce with Frosted Flute Glass and Twist On/Off Switch, Satin Nickel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Designers Fountain Montego 5-Light Oil Rubbed Bronze Hanging Chandelier","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Designers Fountain Montego 5-Light Oil Rubbed Bronze Hanging Chandelier","unitCost":122.7,"unitPrice":153.375,"unit":"Each","qty":1},"labor":{"desc":"Labor - Designers Fountain Montego 5-Light Oil Rubbed Bronze Hanging Chandelier","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Disc Light install Labor","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Disc Light install Labor","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Feit Electric 40-Watt Soft White (2700K) A15 Clear Glass E26 Base Dimmable Incandescent Appliance Light Bulb","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Feit Electric 40-Watt Soft White (2700K) A15 Clear Glass E26 Base Dimmable Incandescent Appliance Light Bulb","unitCost":4.97,"unitPrice":6.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Feit Electric 40-Watt Soft White (2700K) A15 Clear Glass E26 Base Dimmable Incandescent Appliance Light Bulb","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Firex Hardwired Smoke Detector with Adapters, 9-Volt Battery Backup, and Front Load Battery Door by Kidde","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Firex Hardwired Smoke Detector with Adapters, 9-Volt Battery Backup, and Front Load Battery Door by Kidde","unitCost":16.97,"unitPrice":21.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Firex Hardwired Smoke Detector with Adapters, 9-Volt Battery Backup, and Front Load Battery Door by Kidde","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Flush mount light install labor","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Flush mount light install labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"GE White 1-Gang Coaxial Wall Plate (1-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"GE White 1-Gang Coaxial Wall Plate (1-Pack)","unitCost":3.88,"unitPrice":4.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - GE White 1-Gang Coaxial Wall Plate (1-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"GFCI Install Labor","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - GFCI Install Labor","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Globe Electric 2-Light Wolfe Bronze Outdoor Flush Mount","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Globe Electric 2-Light Wolfe Bronze Outdoor Flush Mount","unitCost":139.0,"unitPrice":173.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Globe Electric 2-Light Wolfe Bronze Outdoor Flush Mount","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 18 in. Raceway 3-Light Brushed Nickel Retro Bathroom Vanity Light","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay 18 in. Raceway 3-Light Brushed Nickel Retro Bathroom Vanity Light","unitCost":14.97,"unitPrice":18.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 18 in. Raceway 3-Light Brushed Nickel Retro Bathroom Vanity Light","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 24 in. Raceway 4-Light Brushed Nickel Retro Bathroom Vanity Light","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay 24 in. Raceway 4-Light Brushed Nickel Retro Bathroom Vanity Light","unitCost":14.97,"unitPrice":18.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 24 in. Raceway 4-Light Brushed Nickel Retro Bathroom Vanity Light","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 3-Light 21 in. Oil-Rubbed Bronze Contemporary Bathroom Vanity Light with Frosted Patterned Glass Shade","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay 3-Light 21 in. Oil-Rubbed Bronze Contemporary Bathroom Vanity Light with Frosted Patterned Glass Shade","unitCost":79.97,"unitPrice":99.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 3-Light 21 in. Oil-Rubbed Bronze Contemporary Bathroom Vanity Light with Frosted Patterned Glass Shade","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 8.5 in. White Decorative Outdoor Coach Lantern","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay 8.5 in. White Decorative Outdoor Coach Lantern","unitCost":19.97,"unitPrice":24.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 8.5 in. White Decorative Outdoor Coach Lantern","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Menage 52 in. Integrated LED Indoor Low Profile Oil Rubbed Bronze Ceiling Fan with Light Kit","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Menage 52 in. Integrated LED Indoor Low Profile Oil Rubbed Bronze Ceiling Fan with Light Kit","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Menage 52 in. Integrated LED Indoor Low Profile Oil Rubbed Bronze Ceiling Fan with Light Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Regan 21 in. 3-Light Brushed Nickel Bathroom Vanity Light with Clear Glass Shades","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Regan 21 in. 3-Light Brushed Nickel Bathroom Vanity Light with Clear Glass Shades","unitCost":89.97,"unitPrice":112.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Regan 21 in. 3-Light Brushed Nickel Bathroom Vanity Light with Clear Glass Shades","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Wellston II 44 in. Indoor LED Bronze Dry Rated Downrod Ceiling Fan with Light Kit and 5 Reversible Blades","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Wellston II 44 in. Indoor LED Bronze Dry Rated Downrod Ceiling Fan with Light Kit and 5 Reversible Blades","unitCost":74.97,"unitPrice":93.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Wellston II 44 in. Indoor LED Bronze Dry Rated Downrod Ceiling Fan with Light Kit and 5 Reversible Blades","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Wickford 15.4 in. 1-Light Weathered Bronze Outdoor Wall Light Fixture with Clear Glass (2-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Wickford 15.4 in. 1-Light Weathered Bronze Outdoor Wall Light Fixture with Clear Glass (2-Pack)","unitCost":69.97,"unitPrice":87.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Wickford 15.4 in. 1-Light Weathered Bronze Outdoor Wall Light Fixture with Clear Glass (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Wired Door Bell Push Button, Black","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Wired Door Bell Push Button, Black","unitCost":9.97,"unitPrice":12.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Wired Door Bell Push Button, Black","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Wired Door Chime in White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Wired Door Chime in White","unitCost":29.98,"unitPrice":37.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Wired Door Chime in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Wireless Battery Operated Door Bell Kit with 1-Push Button in White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hampton Bay Wireless Battery Operated Door Bell Kit with 1-Push Button in White","unitCost":29.97,"unitPrice":37.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Wireless Battery Operated Door Bell Kit with 1-Push Button in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hugger 52 in. LED Indoor Black Ceiling Fan with Light Kit","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Hugger 52 in. LED Indoor Black Ceiling Fan with Light Kit","unitCost":53.33,"unitPrice":66.663,"unit":"ea","qty":1},"labor":null},{"name":"Kidde Compact 4 in. 4-Pack Battery Powered Smoke Detector with Photoelectric Sensor","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Kidde Compact 4 in. 4-Pack Battery Powered Smoke Detector with Photoelectric Sensor","unitCost":16.24,"unitPrice":20.3,"unit":"Each","qty":1},"labor":null},{"name":"Labor To Install Electrical Wire","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor To Install Electrical Wire","unitCost":2.0,"unitPrice":2.3,"unit":"hr","qty":1}},{"name":"Labor to Install outlet","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to Install outlet","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install Sconce","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install Sconce","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Labor to install flush mount light","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install flush mount light","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Labor to install old work box","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install old work box","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Labor to install smoke detector","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install smoke detector","unitCost":10.0,"unitPrice":11.5,"unit":"hr","qty":1}},{"name":"Labor to install switch","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install switch","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"Labor to install switch wall plate","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install switch wall plate","unitCost":5.0,"unitPrice":5.75,"unit":"hr","qty":1}},{"name":"Labor to install wall plate","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Labor to install wall plate","unitCost":5.0,"unitPrice":5.75,"unit":"hr","qty":1}},{"name":"Legrand Wiremold 500 and 700 Series Metal Raceway 1-3/4 in. Deep 1-Gang Electrical Switch/Receptacle Box, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Legrand Wiremold 500 and 700 Series Metal Raceway 1-3/4 in. Deep 1-Gang Electrical Switch/Receptacle Box, White","unitCost":12.78,"unitPrice":15.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Legrand Wiremold 500 and 700 Series Metal Raceway 1-3/4 in. Deep 1-Gang Electrical Switch/Receptacle Box, White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Legrand Wiremold Cordmate II Cord Cover 12 ft. Kit, Cord Hider for Home or Office, Holds 3 Cables, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Legrand Wiremold Cordmate II Cord Cover 12 ft. Kit, Cord Hider for Home or Office, Holds 3 Cables, White","unitCost":30.0,"unitPrice":37.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Legrand Wiremold Cordmate II Cord Cover 12 ft. Kit, Cord Hider for Home or Office, Holds 3 Cables, White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton 15 Amp 3-Way Toggle Switch, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton 15 Amp 3-Way Toggle Switch, White","unitCost":2.37,"unitPrice":2.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton 15 Amp 3-Way Toggle Switch, White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton 15 Amp Residential Grade Grounding Duplex Outlet, White","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton 15 Amp Residential Grade Grounding Duplex Outlet, White","unitCost":0.77,"unitPrice":0.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton 15 Amp Residential Grade Grounding Duplex Outlet, White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton 3-Amp Single-Pole Single Circuit (On-Off) Pull Chain Switch","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton 3-Amp Single-Pole Single Circuit (On-Off) Pull Chain Switch","unitCost":15.44,"unitPrice":19.3,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton 3-Amp Single-Pole Single Circuit (On-Off) Pull Chain Switch","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton 50 Amp Single Surface Mounted Single Outlet, Black","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton 50 Amp Single Surface Mounted Single Outlet, Black","unitCost":16.81,"unitPrice":21.013,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton 50 Amp Single Surface Mounted Single Outlet, Black","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton Plastic Pull-Chain Lampholder","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton Plastic Pull-Chain Lampholder","unitCost":4.61,"unitPrice":5.763,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton Plastic Pull-Chain Lampholder","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Leviton White 3-Gang Toggle Wall Plate (1-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Leviton White 3-Gang Toggle Wall Plate (1-Pack)","unitCost":3.31,"unitPrice":4.138,"unit":"Each","qty":1},"labor":{"desc":"Labor - Leviton White 3-Gang Toggle Wall Plate (1-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Lithonia Lighting 10-Watt White Integrated LED Flush Mount Closet Light with Pull Chain","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Lithonia Lighting 10-Watt White Integrated LED Flush Mount Closet Light with Pull Chain","unitCost":27.27,"unitPrice":34.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Lithonia Lighting 10-Watt White Integrated LED Flush Mount Closet Light with Pull Chain","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Lithonia Lighting 2-Lamp Outdoor White Flood Light","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Lithonia Lighting 2-Lamp Outdoor White Flood Light","unitCost":10.46,"unitPrice":13.075,"unit":"Each","qty":1},"labor":{"desc":"Labor - Lithonia Lighting 2-Lamp Outdoor White Flood Light","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Littleton 42 in. LED Indoor White Ceiling Fan with Light Kit","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Littleton 42 in. LED Indoor White Ceiling Fan with Light Kit","unitCost":44.97,"unitPrice":56.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Littleton 42 in. LED Indoor White Ceiling Fan with Light Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Maxim Lighting Essentials 4-Light Oil-Rubbed Bronze Bath Vanity Light","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Maxim Lighting Essentials 4-Light Oil-Rubbed Bronze Bath Vanity Light","unitCost":33.0,"unitPrice":41.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Maxim Lighting Essentials 4-Light Oil-Rubbed Bronze Bath Vanity Light","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Metalux 2 ft. x 4 ft. 4500 Lumens Integrated LED Flat Panel Light 4000K","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Metalux 2 ft. x 4 ft. 4500 Lumens Integrated LED Flat Panel Light 4000K","unitCost":64.88,"unitPrice":81.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Metalux 2 ft. x 4 ft. 4500 Lumens Integrated LED Flat Panel Light 4000K","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Raco 1/2 in. - 1 in. Bronze Ground Clamp","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Raco 1/2 in. - 1 in. Bronze Ground Clamp","unitCost":4.82,"unitPrice":6.025,"unit":"Each","qty":1},"labor":{"desc":"Labor - Raco 1/2 in. - 1 in. Bronze Ground Clamp","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Romex 50 ft. 6/3 Stranded Romex SIMpull CU NM-B W/G Wire","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Romex 50 ft. 6/3 Stranded Romex SIMpull CU NM-B W/G Wire","unitCost":3.98,"unitPrice":4.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Romex 50 ft. 6/3 Stranded Romex SIMpull CU NM-B W/G Wire","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"SOUTHWIRE 100 ft. 12/2 Solid Romex SIMpull CU NM-B W/G Wire","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"SOUTHWIRE 100 ft. 12/2 Solid Romex SIMpull CU NM-B W/G Wire","unitCost":1.0,"unitPrice":1.25,"unit":"Each","qty":1},"labor":null},{"name":"SOUTHWIRE 100 ft. 14/2 Solid Romex SIMpull CU NM-B W/G Wire","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"SOUTHWIRE 100 ft. 14/2 Solid Romex SIMpull CU NM-B W/G Wire","unitCost":1.0,"unitPrice":1.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - SOUTHWIRE 100 ft. 14/2 Solid Romex SIMpull CU NM-B W/G Wire","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Square D Homeline 2-20 Amp Single-Pole Tandem Circuit Breaker","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Square D Homeline 2-20 Amp Single-Pole Tandem Circuit Breaker","unitCost":15.31,"unitPrice":19.138,"unit":"Each","qty":1},"labor":{"desc":"Labor - Square D Homeline 2-20 Amp Single-Pole Tandem Circuit Breaker","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Steel City 4 in. Square Metal Electrical Box Flat Cover","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Steel City 4 in. Square Metal Electrical Box Flat Cover","unitCost":0.98,"unitPrice":1.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - Steel City 4 in. Square Metal Electrical Box Flat Cover","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Suncourt Thru Wall Fan Hardwired Variable Speed","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Suncourt Thru Wall Fan Hardwired Variable Speed","unitCost":80.99,"unitPrice":101.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - Suncourt Thru Wall Fan Hardwired Variable Speed","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Sylvania 40-Watt G25 Double Life E26 Incandescent Light Bulb in 2850K Soft White Color Temperature (3-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Sylvania 40-Watt G25 Double Life E26 Incandescent Light Bulb in 2850K Soft White Color Temperature (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Sylvania 40-Watt G25 Globe Double Life Clear Incandescent Light Bulb (3-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Sylvania 40-Watt G25 Globe Double Life Clear Incandescent Light Bulb (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Tiparts 30 Feet Stainless Steel Ball Chains Necklace with 20pcs Connectors Clasps,Silver Bead Chain Sets (Chain Width 2.4mm+20pcs connectors)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":null,"labor":{"desc":"Labor - Tiparts 30 Feet Stainless Steel Ball Chains Necklace with 20pcs Connectors Clasps,Silver Bead Chain Sets (Chain Width 2.4mm+20pcs connectors)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"WAC LIMITED Disc 6 in. 1-Light White LED Flush Mount","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"WAC LIMITED Disc 6 in. 1-Light White LED Flush Mount","unitCost":24.95,"unitPrice":31.188,"unit":"Each","qty":1},"labor":null},{"name":"WP 4 ft. 3200-Lumens 4000K Cool White 120-Volt White Integrated LED Wraparound Light by Metalux","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"WP 4 ft. 3200-Lumens 4000K Cool White 120-Volt White Integrated LED Wraparound Light by Metalux","unitCost":34.97,"unitPrice":43.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - WP 4 ft. 3200-Lumens 4000K Cool White 120-Volt White Integrated LED Wraparound Light by Metalux","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Westinghouse 4-3/4 in. Clear Shade with 3-1/4 in. Fitter and 3-5/8 in. Width","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Westinghouse 4-3/4 in. Clear Shade with 3-1/4 in. Fitter and 3-5/8 in. Width","unitCost":5.47,"unitPrice":6.838,"unit":"Each","qty":1},"labor":{"desc":"Labor - Westinghouse 4-3/4 in. Clear Shade with 3-1/4 in. Fitter and 3-5/8 in. Width","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Westinghouse 5 in. Handblown White Schoolhouse Shade with 3-1/4 in. Fitter and 5-3/4 in. Width","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"Westinghouse 5 in. Handblown White Schoolhouse Shade with 3-1/4 in. Fitter and 5-3/4 in. Width","unitCost":6.76,"unitPrice":8.45,"unit":"Each","qty":1},"labor":{"desc":"Labor - Westinghouse 5 in. Handblown White Schoolhouse Shade with 3-1/4 in. Fitter and 5-3/4 in. Width","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White 1-Gang Toggle Wall Plate (Switch blank) (1-Pack) by Leviton","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"White 1-Gang Toggle Wall Plate (Switch blank) (1-Pack) by Leviton","unitCost":2.46,"unitPrice":3.075,"unit":"Each","qty":1},"labor":{"desc":"Labor - White 1-Gang Toggle Wall Plate (Switch blank) (1-Pack) by Leviton","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White 2-Gang Decorator/Rocker Wall Plate (1-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"White 2-Gang Decorator/Rocker Wall Plate (1-Pack)","unitCost":1.5,"unitPrice":1.875,"unit":"Each","qty":1},"labor":{"desc":"Labor - White 2-Gang Decorator/Rocker Wall Plate (1-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"White 2-Gang Toggle Wall Plate (1-Pack)","costCode":"1000 Electrical","costCodeName":"Electrical","materials":{"desc":"White 2-Gang Toggle Wall Plate (1-Pack)","unitCost":2.11,"unitPrice":2.638,"unit":"Each","qty":1},"labor":{"desc":"Labor - White 2-Gang Toggle Wall Plate (1-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1900 Cabinetry":[{"name":"1.5x34.5x24 in. Dishwasher End Panel in Cognac","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"1.5x34.5x24 in. Dishwasher End Panel in Cognac","unitCost":77.0,"unitPrice":96.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1.5x34.5x24 in. Dishwasher End Panel in Cognac","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"165\u00b0 35 mm Full Overlay Frameless Cabinet Door Hinges with Installation Screws (1-Pair)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"165\u00b0 35 mm Full Overlay Frameless Cabinet Door Hinges with Installation Screws (1-Pair)","unitCost":9.99,"unitPrice":12.488,"unit":"Each","qty":1},"labor":{"desc":"Labor - 165\u00b0 35 mm Full Overlay Frameless Cabinet Door Hinges with Installation Screws (1-Pair)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"3 in. W x 30 in. H Cabinet Filler in Satin White","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"3 in. W x 30 in. H Cabinet Filler in Satin White","unitCost":37.98,"unitPrice":47.475,"unit":"Each","qty":1},"labor":null},{"name":"30-3/8 in. W x 30-3/16 in. H Frameless Surface-Mount Tri-View Bathroom Medicine Cabinet","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"30-3/8 in. W x 30-3/16 in. H Frameless Surface-Mount Tri-View Bathroom Medicine Cabinet","unitCost":139.0,"unitPrice":173.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - 30-3/8 in. W x 30-3/16 in. H Frameless Surface-Mount Tri-View Bathroom Medicine Cabinet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"31 in. W Vanity in White with Cultured Marble Vanity Top in White by Glacier Bay","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"31 in. W Vanity in White with Cultured Marble Vanity Top in White by Glacier Bay","unitCost":199.0,"unitPrice":248.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - 31 in. W Vanity in White with Cultured Marble Vanity Top in White by Glacier Bay","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cabinet Door Latch - Latch with Catch for Cabinet, Cupboard & Other Furniture (Antique Copper)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Cabinet Door Latch - Latch with Catch for Cabinet, Cupboard & Other Furniture (Antique Copper)","unitCost":12.95,"unitPrice":16.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Cabinet Door Latch - Latch with Catch for Cabinet, Cupboard & Other Furniture (Antique Copper)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Dynasty Hardware European Style 3 in. (76 mm) Center-to-Center Satin Nickel Bar Cabinet Pull (25-Pack)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Dynasty Hardware European Style 3 in. (76 mm) Center-to-Center Satin Nickel Bar Cabinet Pull (25-Pack)","unitCost":2.36,"unitPrice":2.95,"unit":"Each","qty":1},"labor":{"desc":"Labor - Dynasty Hardware European Style 3 in. (76 mm) Center-to-Center Satin Nickel Bar Cabinet Pull (25-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 20 in. Self-Closing Bottom Mount Drawer Slide Set","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Everbilt 20 in. Self-Closing Bottom Mount Drawer Slide Set","unitCost":8.93,"unitPrice":11.163,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 20 in. Self-Closing Bottom Mount Drawer Slide Set","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 3-7/8 in. Satin Nickel Pull (Sash handle)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Everbilt 3-7/8 in. Satin Nickel Pull (Sash handle)","unitCost":3.27,"unitPrice":4.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 3-7/8 in. Satin Nickel Pull (Sash handle)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay 15-1/8 in. W x 19-1/4 in. H Framed Recessed or Surface-Mount Bathroom Medicine Cabinet in White","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Glacier Bay 15-1/8 in. W x 19-1/4 in. H Framed Recessed or Surface-Mount Bathroom Medicine Cabinet in White","unitCost":50.0,"unitPrice":62.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay 15-1/8 in. W x 19-1/4 in. H Framed Recessed or Surface-Mount Bathroom Medicine Cabinet in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay 24.5 in. W x 18.6 in. D x 35.4 in. H Freestanding Bath Vanity in White with White Cultured Marble Top","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Glacier Bay 24.5 in. W x 18.6 in. D x 35.4 in. H Freestanding Bath Vanity in White with White Cultured Marble Top","unitCost":149.0,"unitPrice":186.25,"unit":"Each","qty":1},"labor":null},{"name":"Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror in Silver","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror in Silver","unitCost":49.97,"unitPrice":62.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror in Silver","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay Bannister 30 in. W x 19 in. D x 35 in. H single Sink Freestanding Bath Vanity in White with White Cultured Marble Top","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Glacier Bay Bannister 30 in. W x 19 in. D x 35 in. H single Sink Freestanding Bath Vanity in White with White Cultured Marble Top","unitCost":339.0,"unitPrice":423.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay Bannister 30 in. W x 19 in. D x 35 in. H single Sink Freestanding Bath Vanity in White with White Cultured Marble Top","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay, 30.50 in. W Bath Vanity in White with Cultured Marble Vanity Top in White with White Basin","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Glacier Bay, 30.50 in. W Bath Vanity in White with Cultured Marble Vanity Top in White with White Basin","unitCost":199.0,"unitPrice":248.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay, 30.50 in. W Bath Vanity in White with Cultured Marble Vanity Top in White with White Basin","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Assembled 15x30x12 in. Wall Kitchen Cabinet in Unfinished Beech","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Assembled 15x30x12 in. Wall Kitchen Cabinet in Unfinished Beech","unitCost":67.0,"unitPrice":83.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Assembled 15x30x12 in. Wall Kitchen Cabinet in Unfinished Beech","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 23.25 in. W x 34.5 in. H Base Cabinet End Panel in Unfinished Beech","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay 23.25 in. W x 34.5 in. H Base Cabinet End Panel in Unfinished Beech","unitCost":24.0,"unitPrice":30.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 23.25 in. W x 34.5 in. H Base Cabinet End Panel in Unfinished Beech","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 3x30x0.75 in. Cabinet Filler in Satin White","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay 3x30x0.75 in. Cabinet Filler in Satin White","unitCost":38.0,"unitPrice":47.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 3x30x0.75 in. Cabinet Filler in Satin White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Designer Series 96x4.25x0.25 in. Toe Kick in White","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Designer Series 96x4.25x0.25 in. Toe Kick in White","unitCost":21.0,"unitPrice":26.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Designer Series 96x4.25x0.25 in. Toe Kick in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Designer Series Melvern Assembled 24x90x23.75 in. Pantry Kitchen Cabinet in White","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Designer Series Melvern Assembled 24x90x23.75 in. Pantry Kitchen Cabinet in White","unitCost":655.0,"unitPrice":818.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Designer Series Melvern Assembled 24x90x23.75 in. Pantry Kitchen Cabinet in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Hampton Unfinished Recessed Panel Stock Assembled Sink Base Kitchen Cabinet (60 in. x 34.5 in. x 24 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Hampton Unfinished Recessed Panel Stock Assembled Sink Base Kitchen Cabinet (60 in. x 34.5 in. x 24 in.)","unitCost":184.0,"unitPrice":230.0,"unit":"Each","qty":1},"labor":null},{"name":"Hampton Bay Shaker Satin White Stock Assembled Base Kitchen Cabinet with Ball-Bearing Drawer Glides (12 in. x 34.5 in. x 24 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Base Kitchen Cabinet with Ball-Bearing Drawer Glides (12 in. x 34.5 in. x 24 in.)","unitCost":179.0,"unitPrice":223.75,"unit":"Each","qty":1},"labor":null},{"name":"Hampton Bay Shaker Satin White Stock Assembled Base Kitchen Cabinet with Ball-Bearing Drawer Glides (24 in. x 34.5 in. x 24 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Base Kitchen Cabinet with Ball-Bearing Drawer Glides (24 in. x 34.5 in. x 24 in.)","unitCost":219.0,"unitPrice":273.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Base Kitchen Cabinet with Ball-Bearing Drawer Glides (24 in. x 34.5 in. x 24 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Drawer Base Kitchen Cabinet with Drawer Glides (18 in. x 34.5 in. x 24 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Drawer Base Kitchen Cabinet with Drawer Glides (18 in. x 34.5 in. x 24 in.)","unitCost":319.0,"unitPrice":398.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Drawer Base Kitchen Cabinet with Drawer Glides (18 in. x 34.5 in. x 24 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Sink Base Kitchen Cabinet (36 in. x 34.5 in. x 24 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Sink Base Kitchen Cabinet (36 in. x 34.5 in. x 24 in.)","unitCost":259.0,"unitPrice":323.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Sink Base Kitchen Cabinet (36 in. x 34.5 in. x 24 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (30 in. x 23.5 in. x 12 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (30 in. x 23.5 in. x 12 in.)","unitCost":155.0,"unitPrice":193.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (30 in. x 23.5 in. x 12 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (36 in. x 23.5 in. x 12 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (36 in. x 23.5 in. x 12 in.)","unitCost":182.0,"unitPrice":227.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Wall Bridge Kitchen Cabinet (36 in. x 23.5 in. x 12 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (18 in. x 42 in. x 12 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (18 in. x 42 in. x 12 in.)","unitCost":178.0,"unitPrice":222.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (18 in. x 42 in. x 12 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (36 in. x 42 in. x 12 in.)","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (36 in. x 42 in. x 12 in.)","unitCost":280.0,"unitPrice":350.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay Shaker Satin White Stock Assembled Wall Kitchen Cabinet (36 in. x 42 in. x 12 in.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor for vanity install","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":null,"labor":{"desc":"Labor - Labor for vanity install","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Labor to install base cabinet","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":null,"labor":{"desc":"Labor - Labor to install base cabinet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor to install sink base cabinet","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":null,"labor":{"desc":"Labor - Labor to install sink base cabinet","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Mia 1 in. (26mm) Satin Nickel Round Cabinet Knob by Liberty","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Mia 1 in. (26mm) Satin Nickel Round Cabinet Knob by Liberty","unitCost":2.05,"unitPrice":2.563,"unit":"Each","qty":1},"labor":{"desc":"Labor - Mia 1 in. (26mm) Satin Nickel Round Cabinet Knob by Liberty","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Recessed Panel 24 in. W x 1.5 in. D x 34.5 in. H Dishwasher End Panel in Unfinished","costCode":"1900 Cabinetry","costCodeName":"Cabinetry","materials":{"desc":"Recessed Panel 24 in. W x 1.5 in. D x 34.5 in. H Dishwasher End Panel in Unfinished","unitCost":37.98,"unitPrice":47.475,"unit":"ea","qty":1},"labor":null}],"2400 Appliances":[{"name":"1.6 cu. ft. Over the Range Microwave in White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"1.6 cu. ft. Over the Range Microwave in White","unitCost":199.0,"unitPrice":248.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1.6 cu. ft. Over the Range Microwave in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Anti-Tip Bracket by Frigidaire","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Anti-Tip Bracket by Frigidaire","unitCost":10.96,"unitPrice":13.7,"unit":"Each","qty":1},"labor":{"desc":"Labor - Anti-Tip Bracket by Frigidaire","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Broan-NuTone 46000/42000/40000/F40000 Series Externally Vented Range Hood Aluminum Filter (1 each)","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Broan-NuTone 46000/42000/40000/F40000 Series Externally Vented Range Hood Aluminum Filter (1 each)","unitCost":11.64,"unitPrice":14.55,"unit":"Each","qty":1},"labor":{"desc":"Labor - Broan-NuTone 46000/42000/40000/F40000 Series Externally Vented Range Hood Aluminum Filter (1 each)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Broan-NuTone Replacement Grille for 688 Bathroom Exhaust Fan","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Broan-NuTone Replacement Grille for 688 Bathroom Exhaust Fan","unitCost":11.37,"unitPrice":14.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Broan-NuTone Replacement Grille for 688 Bathroom Exhaust Fan","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Broan-NuToneRL6200 Series 24 in. Ductless Under Cabinet Range Hood with Light in White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Broan-NuToneRL6200 Series 24 in. Ductless Under Cabinet Range Hood with Light in White","unitCost":89.0,"unitPrice":111.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Broan-NuToneRL6200 Series 24 in. Ductless Under Cabinet Range Hood with Light in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Dishwasher - 24\"","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Dishwasher - 24\"","unitCost":500.0,"unitPrice":625.0,"unit":"Each","qty":1},"labor":null},{"name":"Dishwasher Install","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Dishwasher Install","unitCost":300.0,"unitPrice":345.0,"unit":"hr","qty":1}},{"name":"Everbilt 8 in. Range Heating Element (GE)","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Everbilt 8 in. Range Heating Element (GE)","unitCost":39.98,"unitPrice":49.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 8 in. Range Heating Element (GE)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"GE 4.0 Cu. Ft. SmartHQ Top Load Washing Machine With Stainless Steel Basket, Water Level Control, White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"GE 4.0 Cu. Ft. SmartHQ Top Load Washing Machine With Stainless Steel Basket, Water Level Control, White","unitCost":819.0,"unitPrice":1023.75,"unit":"Each","qty":1},"labor":null},{"name":"GE ENERGY STAR 30 In. 5.0 Cu. Ft. Coil Electric Freestanding Range, Manual Clean, Black","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"GE ENERGY STAR 30 In. 5.0 Cu. Ft. Coil Electric Freestanding Range, Manual Clean, Black","unitCost":759.0,"unitPrice":948.75,"unit":"Each","qty":1},"labor":null},{"name":"GE Range Drip Bowl/Pan for GE, Hotpoint 4 -Pack","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"GE Range Drip Bowl/Pan for GE, Hotpoint 4 -Pack","unitCost":14.39,"unitPrice":17.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - GE Range Drip Bowl/Pan for GE, Hotpoint 4 -Pack","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"GE White Laundry Center with 2.3 cu. ft. Washer and 4.4 cu. ft. 240-Volt Vented Electric Dryer","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"GE White Laundry Center with 2.3 cu. ft. Washer and 4.4 cu. ft. 240-Volt Vented Electric Dryer","unitCost":1248.0,"unitPrice":1560.0,"unit":"Each","qty":1},"labor":{"desc":"Labor - GE White Laundry Center with 2.3 cu. ft. Washer and 4.4 cu. ft. 240-Volt Vented Electric Dryer","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hotpoint HPS18BTNDRBB Vegetable Pan Genuine OEM","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Hotpoint HPS18BTNDRBB Vegetable Pan Genuine OEM","unitCost":42.89,"unitPrice":53.613,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hotpoint HPS18BTNDRBB Vegetable Pan Genuine OEM","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Over the Range Microwave","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Over the Range Microwave","unitCost":199.0,"unitPrice":248.75,"unit":"Each","qty":1},"labor":null},{"name":"Over the Range Microwave Install","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Over the Range Microwave Install","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Range - Electric","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Range - Electric","unitCost":600.0,"unitPrice":750.0,"unit":"Each","qty":1},"labor":null},{"name":"Range - Electric - Black","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Electric - Black","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Electric - Stainless Steel","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Electric - Stainless Steel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Electric - White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Electric - White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Electric Install","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Electric Install","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Gas","costCode":"2400 Appliances","costCodeName":"Appliances","materials":{"desc":"Range - Gas","unitCost":600.0,"unitPrice":750.0,"unit":"Each","qty":1},"labor":null},{"name":"Range - Gas - Black","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Gas - Black","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Gas - Stainless Steel","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Gas - Stainless Steel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Gas - White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Gas - White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Range - Gas Install","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Range - Gas Install","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Refrigerator - Stainless Steel","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Refrigerator - Stainless Steel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Refrigerator- White","costCode":"2400 Appliances","costCodeName":"Appliances","materials":null,"labor":{"desc":"Labor - Refrigerator- White","unitCost":749.0,"unitPrice":861.35,"unit":"hr","qty":1}}],"3100 Miscellaneous":[{"name":"1/16 in. x 4 ft. x 8 ft. Plastic Panel","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"1/16 in. x 4 ft. x 8 ft. Plastic Panel","unitCost":25.98,"unitPrice":32.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1/16 in. x 4 ft. x 8 ft. Plastic Panel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"1/2 in. White Shelf Peg (12-Pack)","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"1/2 in. White Shelf Peg (12-Pack)","unitCost":1.75,"unitPrice":2.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1/2 in. White Shelf Peg (12-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"14 in. x 14 in. Access Panel with Frame","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"14 in. x 14 in. Access Panel with Frame","unitCost":17.98,"unitPrice":22.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - 14 in. x 14 in. Access Panel with Frame","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Amerimax Home Products 24 in. Green Vinyl Splash Block","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Amerimax Home Products 24 in. Green Vinyl Splash Block","unitCost":5.97,"unitPrice":7.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products 24 in. Green Vinyl Splash Block","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Architectural Mailboxes MB1 Black, Medium, Steel, Post Mount Mailbox and 2 in. In-Ground Post Kit","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Architectural Mailboxes MB1 Black, Medium, Steel, Post Mount Mailbox and 2 in. In-Ground Post Kit","unitCost":49.93,"unitPrice":62.413,"unit":"Each","qty":1},"labor":{"desc":"Labor - Architectural Mailboxes MB1 Black, Medium, Steel, Post Mount Mailbox and 2 in. In-Ground Post Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Closet Door Roller, Front, 3/4 in. Offset, 3/4 in. Nylon Wheel, Atlas (2-pack)","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":null,"labor":{"desc":"Labor - Closet Door Roller, Front, 3/4 in. Offset, 3/4 in. Nylon Wheel, Atlas (2-pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Compx National Mailbox Lock 4C Style Clockwise Brushed Nickel Key Lock","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Compx National Mailbox Lock 4C Style Clockwise Brushed Nickel Key Lock","unitCost":21.75,"unitPrice":27.188,"unit":"Each","qty":1},"labor":{"desc":"Labor - Compx National Mailbox Lock 4C Style Clockwise Brushed Nickel Key Lock","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 1/4 in. x 3 in. Zinc-Plated Toggle Bolt with Round-Head Phillips Drive Screw (10-Piece)","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Everbilt 1/4 in. x 3 in. Zinc-Plated Toggle Bolt with Round-Head Phillips Drive Screw (10-Piece)","unitCost":6.61,"unitPrice":8.263,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 1/4 in. x 3 in. Zinc-Plated Toggle Bolt with Round-Head Phillips Drive Screw (10-Piece)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 3 in. Self-Adhesive Vinyl Number Set","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Everbilt 3 in. Self-Adhesive Vinyl Number Set","unitCost":2.98,"unitPrice":3.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 3 in. Self-Adhesive Vinyl Number Set","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 6 in. Satin Nickel Square Corner Flush Bolt","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Everbilt 6 in. Satin Nickel Square Corner Flush Bolt","unitCost":9.93,"unitPrice":12.413,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 6 in. Satin Nickel Square Corner Flush Bolt","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 6 in. x 18 in. 22-Gauge Aluminum Metal Sheet","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Everbilt 6 in. x 18 in. 22-Gauge Aluminum Metal Sheet","unitCost":12.93,"unitPrice":16.163,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 6 in. x 18 in. 22-Gauge Aluminum Metal Sheet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Satin Nickel Light-Duty Handrail Bracket","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Everbilt Satin Nickel Light-Duty Handrail Bracket","unitCost":2.93,"unitPrice":3.663,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Satin Nickel Light-Duty Handrail Bracket","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"M-D Building Products 12 in. x 12 in. 28-Gauge Galvanized Sheet","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"M-D Building Products 12 in. x 12 in. 28-Gauge Galvanized Sheet","unitCost":9.27,"unitPrice":11.588,"unit":"Each","qty":1},"labor":{"desc":"Labor - M-D Building Products 12 in. x 12 in. 28-Gauge Galvanized Sheet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Master Lock Heavy-Duty Outdoor Padlock with Key, 1-7/8 in. W, 1-1/2 in. Shackle Keyed Padlock","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Master Lock Heavy-Duty Outdoor Padlock with Key, 1-7/8 in. W, 1-1/2 in. Shackle Keyed Padlock","unitCost":14.58,"unitPrice":18.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - Master Lock Heavy-Duty Outdoor Padlock with Key, 1-7/8 in. W, 1-1/2 in. Shackle Keyed Padlock","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Paslode 3 in. x 0.120-Gauge Brite Smooth Shank FUEL + NAIL Pack (1,000 Nails + 1 Fuel Cell)","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Paslode 3 in. x 0.120-Gauge Brite Smooth Shank FUEL + NAIL Pack (1,000 Nails + 1 Fuel Cell)","unitCost":48.48,"unitPrice":60.6,"unit":"Each","qty":1},"labor":null},{"name":"Prime-Line 3 1/4 in., Rigid Vinyl, White, Self Adhesive Wall Protector","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Prime-Line 3 1/4 in., Rigid Vinyl, White, Self Adhesive Wall Protector","unitCost":3.27,"unitPrice":4.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line 3 1/4 in., Rigid Vinyl, White, Self Adhesive Wall Protector","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line 3-1/2 in. Chrome plated Back Plate","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Prime-Line 3-1/2 in. Chrome plated Back Plate","unitCost":5.9,"unitPrice":7.375,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line 3-1/2 in. Chrome plated Back Plate","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Prime-Line 5 in., Rigid Vinyl, White, Self Adhesive Wall Protector","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Prime-Line 5 in., Rigid Vinyl, White, Self Adhesive Wall Protector","unitCost":4.27,"unitPrice":5.338,"unit":"Each","qty":1},"labor":{"desc":"Labor - Prime-Line 5 in., Rigid Vinyl, White, Self Adhesive Wall Protector","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Trimaco Easy Mask 3 ft. x 167 ft. Red Rosin Medium Weight Paper","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"Trimaco Easy Mask 3 ft. x 167 ft. Red Rosin Medium Weight Paper","unitCost":13.98,"unitPrice":17.475,"unit":"Each","qty":1},"labor":null},{"name":"YA MI 4-digit key lock box, outdoor waterproof hidden wall mounted key safe - key storage lock box for house \uff08Gray\uff09","costCode":"3100 Miscellaneous","costCodeName":"Miscellaneous","materials":{"desc":"YA MI 4-digit key lock box, outdoor waterproof hidden wall mounted key safe - key storage lock box for house \uff08Gray\uff09","unitCost":14.99,"unitPrice":18.738,"unit":"Each","qty":1},"labor":{"desc":"Labor - YA MI 4-digit key lock box, outdoor waterproof hidden wall mounted key safe - key storage lock box for house \uff08Gray\uff09","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"0600 Framing":[{"name":"1/2 4 ft. x 8 ft. Oriented Strand Board","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"1/2 4 ft. x 8 ft. Oriented Strand Board","unitCost":17.58,"unitPrice":21.975,"unit":"Each","qty":1},"labor":null},{"name":"15/32 in. x 4 ft. x 8 ft. 3-Ply RTD Sheathing (Plywood)","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"15/32 in. x 4 ft. x 8 ft. 3-Ply RTD Sheathing (Plywood)","unitCost":0.69,"unitPrice":0.863,"unit":"Each","qty":1},"labor":{"desc":"Labor - 15/32 in. x 4 ft. x 8 ft. 3-Ply RTD Sheathing (Plywood)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"2 in. x 4 in. x 96 in. Prime Whitewood Stud","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"2 in. x 4 in. x 96 in. Prime Whitewood Stud","unitCost":3.46,"unitPrice":4.325,"unit":"Each","qty":1},"labor":null},{"name":"2 in. x 8 in. x 12 ft. #2 Premium Grade Southern Yellow Pine Dimensional Lumber","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"2 in. x 8 in. x 12 ft. #2 Premium Grade Southern Yellow Pine Dimensional Lumber","unitCost":9.72,"unitPrice":12.15,"unit":"Each","qty":1},"labor":{"desc":"Labor - 2 in. x 8 in. x 12 ft. #2 Premium Grade Southern Yellow Pine Dimensional Lumber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"2 in. x 8 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"2 in. x 8 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","unitCost":24.68,"unitPrice":30.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - 2 in. x 8 in. x 16 ft. 2 Prime Cedar-Tone Ground Contact Pressure-Treated Southern Yellow Pine Lumber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"4 in. x 4 in. x 8 ft. #2 Ground Contact Pressure-Treated Southern Yellow Pine Timber","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"4 in. x 4 in. x 8 ft. #2 Ground Contact Pressure-Treated Southern Yellow Pine Timber","unitCost":10.68,"unitPrice":13.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - 4 in. x 4 in. x 8 ft. #2 Ground Contact Pressure-Treated Southern Yellow Pine Timber","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Framing/LF (2x4 or 2x6)","costCode":"0600 Framing","costCodeName":"Framing","materials":null,"labor":{"desc":"Labor - Framing/LF (2x4 or 2x6)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Joist hanger labor","costCode":"0600 Framing","costCodeName":"Framing","materials":null,"labor":{"desc":"Labor - Joist hanger labor","unitCost":15.0,"unitPrice":17.25,"unit":"hr","qty":1}},{"name":"Labor to install a stud","costCode":"0600 Framing","costCodeName":"Framing","materials":null,"labor":{"desc":"Labor - Labor to install a stud","unitCost":80.0,"unitPrice":92.0,"unit":"hr","qty":1}},{"name":"OSB Install Labor","costCode":"0600 Framing","costCodeName":"Framing","materials":null,"labor":{"desc":"Labor - OSB Install Labor","unitCost":33.0,"unitPrice":37.95,"unit":"hr","qty":1}},{"name":"Simpson Strong-Tie LUS ZMAX Galvanized Face-Mount Joist Hanger for 2x8 Nominal Lumber","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"Simpson Strong-Tie LUS ZMAX Galvanized Face-Mount Joist Hanger for 2x8 Nominal Lumber","unitCost":2.39,"unitPrice":2.988,"unit":"Each","qty":1},"labor":null},{"name":"Tiger Brand Super S Series 8 ft. 4 in. Jack Post","costCode":"0600 Framing","costCodeName":"Framing","materials":{"desc":"Tiger Brand Super S Series 8 ft. 4 in. Jack Post","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Tiger Brand Super S Series 8 ft. 4 in. Jack Post","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1400 Drywall":[{"name":"1/2 in. x 4 ft. x 8 ft. UltraLight Drywall","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"1/2 in. x 4 ft. x 8 ft. UltraLight Drywall","unitCost":15.94,"unitPrice":19.925,"unit":"ea","qty":1},"labor":null},{"name":"1/2\" Drywall install per sqft","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"1/2\" Drywall install per sqft","unitCost":0.94,"unitPrice":1.175,"unit":"Each","qty":1},"labor":null},{"name":"4.5 gal. Plus 3 Ready-Mixed Joint Compound","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"4.5 gal. Plus 3 Ready-Mixed Joint Compound","unitCost":21.78,"unitPrice":27.225,"unit":"Each","qty":1},"labor":null},{"name":"5/8\" Drywall install per sqft","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"5/8\" Drywall install per sqft","unitCost":0.56,"unitPrice":0.7,"unit":"Each","qty":1},"labor":{"desc":"Labor - 5/8\" Drywall install per sqft","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Drywall Labor/ Sq Ft","costCode":"1400 Drywall","costCodeName":"Drywall","materials":null,"labor":{"desc":"Labor - Drywall Labor/ Sq Ft","unitCost":6.5,"unitPrice":7.475,"unit":"hr","qty":1}},{"name":"USG Sheetrock Brand1/2 in. x 23-5/8 in. x 23-5/8 in. Drywall Patching Panel","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"USG Sheetrock Brand1/2 in. x 23-5/8 in. x 23-5/8 in. Drywall Patching Panel","unitCost":6.98,"unitPrice":8.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - USG Sheetrock Brand1/2 in. x 23-5/8 in. x 23-5/8 in. Drywall Patching Panel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Wall/door patch: 4.5 Gal. Plus 3 Lightweight All-Purpose Pre-Mixed Joint Compound by USG Sheetrock Brand & 75 ft. Drywall Joint Tape by USG Sheetrock Brand","costCode":"1400 Drywall","costCodeName":"Drywall","materials":{"desc":"Wall/door patch: 4.5 Gal. Plus 3 Lightweight All-Purpose Pre-Mixed Joint Compound by USG Sheetrock Brand & 75 ft. Drywall Joint Tape by USG Sheetrock Brand","unitCost":0.88,"unitPrice":1.1,"unit":"Each","qty":1},"labor":{"desc":"Labor - Wall/door patch: 4.5 Gal. Plus 3 Lightweight All-Purpose Pre-Mixed Joint Compound by USG Sheetrock Brand & 75 ft. Drywall Joint Tape by USG Sheetrock Brand","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1700 Flooring":[{"name":"1/5 in. x 4 ft. x 8 ft. Hardwood Plywood Underlayment Specialty Panel","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"1/5 in. x 4 ft. x 8 ft. Hardwood Plywood Underlayment Specialty Panel","unitCost":26.68,"unitPrice":33.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - 1/5 in. x 4 ft. x 8 ft. Hardwood Plywood Underlayment Specialty Panel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Black and White Marble Paver Residential Vinyl Sheet Flooring 12ft. Wide x Cut to Length by TrafficMaster","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"Black and White Marble Paver Residential Vinyl Sheet Flooring 12ft. Wide x Cut to Length by TrafficMaster","unitCost":0.66,"unitPrice":0.825,"unit":"Each","qty":1},"labor":{"desc":"Labor - Black and White Marble Paver Residential Vinyl Sheet Flooring 12ft. Wide x Cut to Length by TrafficMaster","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Stair Tread and Reversible Riser Kit","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Stair Tread and Reversible Riser Kit","unitCost":63.0,"unitPrice":78.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Stair Tread and Reversible Riser Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Carpet removal","costCode":"1700 Flooring","costCodeName":"Flooring","materials":null,"labor":{"desc":"Labor - Carpet removal","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Carpet replacement (sqft)","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"Carpet replacement (sqft)","unitCost":3.54,"unitPrice":4.425,"unit":"Each","qty":1},"labor":null},{"name":"Devon Oak 6 in. x 36 in. Rigid Core Luxury Vinyl Plank Flooring (23.95 sq. ft. / case)","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"Devon Oak 6 in. x 36 in. Rigid Core Luxury Vinyl Plank Flooring (23.95 sq. ft. / case)","unitCost":1.99,"unitPrice":2.488,"unit":"Each","qty":1},"labor":null},{"name":"Hardwood refinishing per sqft","costCode":"1700 Flooring","costCodeName":"Flooring","materials":null,"labor":{"desc":"Labor - Hardwood refinishing per sqft","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"LVP Flooring Labor","costCode":"1700 Flooring","costCodeName":"Flooring","materials":null,"labor":{"desc":"Labor - LVP Flooring Labor","unitCost":5.0,"unitPrice":5.75,"unit":"hr","qty":1}},{"name":"LVP Tile: Marble ,12\"x24\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP Tile: Marble ,12\"x24\"x5mm/20mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP Tile: Slate ,12\"x24\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP Tile: Slate ,12\"x24\"x5mm/20mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP Tile: Stone ,12\"x24\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP Tile: Stone ,12\"x24\"x5mm/20mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Ash Gray, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Ash Gray, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Ash Gray, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Ash Gray, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Ash, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Ash, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Ash, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Ash, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Aspen, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Aspen, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Aspen, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Aspen, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Aspen, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Aspen, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Bark, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Bark, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Beach Gray, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Beach Gray, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Butterscotch, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Butterscotch, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Butterscotch, 7\"x48\"x8mm/28mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Butterscotch, 7\"x48\"x8mm/28mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Butterscotch, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Butterscotch, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Butterscotch, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Butterscotch, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Caramel Macchiato, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Caramel Macchiato, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Charcoal Gray, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Charcoal Gray, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Costal Dune, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Costal Dune, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Costal Dune, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Costal Dune, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Costal Dune, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Costal Dune, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 9\"x60\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 9\"x60\"x4.5mm/12mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Desert Sand, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Desert Sand, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Dockside, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Dockside, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 9\"x60\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 9\"x60\"x4.5mm/12mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Driftwood, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Driftwood, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Farmhouse, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Farmhouse, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Farmhouse, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Farmhouse, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Fossil, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Fossil, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 7\"x48\"x8mm/28mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 7\"x48\"x8mm/28mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 9\"x60\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 9\"x60\"x4.5mm/12mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: French Oak, 9\"x60\"x8mm/28mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: French Oak, 9\"x60\"x8mm/28mil","unitCost":3.09,"unitPrice":3.863,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Harbor Gray, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Harbor Gray, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Hazelnut, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Hazelnut, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Honey, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Honey, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Lake House, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Lake House, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Lake House, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Lake House, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Lake House, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Lake House, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Light Oak, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Light Oak, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Medium Oak, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Medium Oak, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Medium Oak, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Medium Oak, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Natural Birch, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Natural Birch, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Palomino, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Palomino, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pearl, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pearl, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 9\"x60\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 9\"x60\"x4.5mm/12mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Pecan, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Pecan, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sahara, 7\"x48\"x4.5mm/12mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sahara, 7\"x48\"x4.5mm/12mil","unitCost":1.89,"unitPrice":2.363,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sahara, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sahara, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sahara, 7\"x48\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sahara, 7\"x48\"x6.5mm/24mil","unitCost":2.39,"unitPrice":2.988,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sunset, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sunset, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sunset, 7\"x48\"x8mm/28mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sunset, 7\"x48\"x8mm/28mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sunset, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sunset, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Sunset, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Sunset, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Tuscan, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Tuscan, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Walnut, 7\"x48\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Walnut, 7\"x48\"x5mm/20mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Walnut, 7\"x48\"x8mm/28mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Walnut, 7\"x48\"x8mm/28mil","unitCost":2.09,"unitPrice":2.613,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Walnut, 9\"x60\"x5mm/20mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Walnut, 9\"x60\"x5mm/20mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Walnut, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Walnut, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: White Birch, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: White Birch, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"LVP: Willow, 9\"x60\"x6.5mm/24mil","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"LVP: Willow, 9\"x60\"x6.5mm/24mil","unitCost":2.59,"unitPrice":3.238,"unit":"Square Feet","qty":1},"labor":null},{"name":"TrafficMaster Silver Fluted 36 in. x 1-1/4 in. Seam Binder","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"TrafficMaster Silver Fluted 36 in. x 1-1/4 in. Seam Binder","unitCost":8.7,"unitPrice":10.875,"unit":"Each","qty":1},"labor":{"desc":"Labor - TrafficMaster Silver Fluted 36 in. x 1-1/4 in. Seam Binder","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Transition Strip","costCode":"1700 Flooring","costCodeName":"Flooring","materials":{"desc":"Transition Strip","unitCost":39.98,"unitPrice":49.975,"unit":"Each","qty":1},"labor":null},{"name":"Transition Strip Labor","costCode":"1700 Flooring","costCodeName":"Flooring","materials":null,"labor":{"desc":"Labor - Transition Strip Labor","unitCost":35.0,"unitPrice":40.25,"unit":"hr","qty":1}}],"2300 Painting":[{"name":"12 oz. Satin Fossil General Purpose Spray Paint","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"12 oz. Satin Fossil General Purpose Spray Paint","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - 12 oz. Satin Fossil General Purpose Spray Paint","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"35 in. x 200 ft. Builders Paper","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"35 in. x 200 ft. Builders Paper","unitCost":18.98,"unitPrice":23.725,"unit":"Each","qty":1},"labor":null},{"name":"3M 10.1 fl. oz. Gray Fire Block Specialty Sealant","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"3M 10.1 fl. oz. Gray Fire Block Specialty Sealant","unitCost":7.98,"unitPrice":9.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - 3M 10.1 fl. oz. Gray Fire Block Specialty Sealant","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"3M ScotchBlue 1.88 in. x 60 yds. Original Multi-Surface Painter's Tape (6-Pack)","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"3M ScotchBlue 1.88 in. x 60 yds. Original Multi-Surface Painter's Tape (6-Pack)","unitCost":39.48,"unitPrice":49.35,"unit":"Each","qty":1},"labor":null},{"name":"9 in. x 3/8 in. High-Density Polyester Knit Paint Roller Cover (3-Pack)","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"9 in. x 3/8 in. High-Density Polyester Knit Paint Roller Cover (3-Pack)","unitCost":8.48,"unitPrice":10.6,"unit":"Each","qty":1},"labor":null},{"name":"9 in.x 1/2 in.High-Capacity Polyester Knit Paint Roller Cover (3-Pack)","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"9 in.x 1/2 in.High-Capacity Polyester Knit Paint Roller Cover (3-Pack)","unitCost":9.76,"unitPrice":12.2,"unit":"Each","qty":1},"labor":null},{"name":"Caulk Labor","costCode":"2300 Painting","costCodeName":"Painting","materials":null,"labor":{"desc":"Labor - Caulk Labor","unitCost":25.0,"unitPrice":28.75,"unit":"hr","qty":1}},{"name":"DAP DryDex 16 oz. Dry Time Indicator Spackling Paste","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"DAP DryDex 16 oz. Dry Time Indicator Spackling Paste","unitCost":9.48,"unitPrice":11.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - DAP DryDex 16 oz. Dry Time Indicator Spackling Paste","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 10.1 oz Multi-Purpose Construction Adhesive Sealant; 1 hour dry time","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Everbilt 10.1 oz Multi-Purpose Construction Adhesive Sealant; 1 hour dry time","unitCost":19.98,"unitPrice":24.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 10.1 oz Multi-Purpose Construction Adhesive Sealant; 1 hour dry time","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"GE Advanced Silicone 2 10.1 oz. White Kitchen and Bath Silicone Sealant Caulk","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"GE Advanced Silicone 2 10.1 oz. White Kitchen and Bath Silicone Sealant Caulk","unitCost":10.98,"unitPrice":13.725,"unit":"Each","qty":1},"labor":null},{"name":"KILZOriginal 13 oz. White Oil-Based Interior Primer Spray, Sealer, and Stain Blocker","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"KILZOriginal 13 oz. White Oil-Based Interior Primer Spray, Sealer, and Stain Blocker","unitCost":9.98,"unitPrice":12.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - KILZOriginal 13 oz. White Oil-Based Interior Primer Spray, Sealer, and Stain Blocker","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Mud/Tape per sqft","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Mud/Tape per sqft","unitCost":0.05,"unitPrice":0.063,"unit":"Each","qty":1},"labor":{"desc":"Labor - Mud/Tape per sqft","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Paint Exterior Door (Inside & Out)","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Paint Exterior Door (Inside & Out)","unitCost":2.8,"unitPrice":3.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Paint Exterior Door (Inside & Out)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Paint Labor for 1 coat per sq ft","costCode":"2300 Painting","costCodeName":"Painting","materials":null,"labor":{"desc":"Labor - Paint Labor for 1 coat per sq ft","unitCost":3.0,"unitPrice":3.4499999999999997,"unit":"hr","qty":1}},{"name":"Paint/sqft - 1 coat","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Paint/sqft - 1 coat","unitCost":0.6,"unitPrice":0.752,"unit":"Each","qty":1.0},"labor":null},{"name":"Paint/sqft - 2 coats","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Paint/sqft - 2 coats","unitCost":0.06,"unitPrice":0.075,"unit":"Each","qty":1},"labor":{"desc":"Labor - Paint/sqft - 2 coats","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Patch wall/holes","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Patch wall/holes","unitCost":25.0,"unitPrice":31.25,"unit":"Each","qty":1},"labor":null},{"name":"Premium 2 in. Polyester Trylon Thin Angled Sash Paint Brush","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Premium 2 in. Polyester Trylon Thin Angled Sash Paint Brush","unitCost":9.33,"unitPrice":11.663,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Bath counter","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Bath counter","unitCost":40.0,"unitPrice":50.0,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Bath counter w/sink","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Bath counter w/sink","unitCost":50.0,"unitPrice":62.5,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Bath counter w/sink & Specks","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Bath counter w/sink & Specks","unitCost":65.0,"unitPrice":81.25,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Kitchen Countertops","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Kitchen Countertops","unitCost":155.0,"unitPrice":193.75,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Partial tub strip or re-do","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Partial tub strip or re-do","unitCost":50.0,"unitPrice":62.5,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Shower base","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Shower base","unitCost":75.0,"unitPrice":93.75,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Shower base & walls","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Shower base & walls","unitCost":200.0,"unitPrice":250.0,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Surround","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Surround","unitCost":175.0,"unitPrice":218.75,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Tub","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Tub","unitCost":175.0,"unitPrice":218.75,"unit":"Each","qty":1},"labor":null},{"name":"Resurfacing Plus: Tub & Surround","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"Resurfacing Plus: Tub & Surround","unitCost":275.0,"unitPrice":343.75,"unit":"Each","qty":1},"labor":null},{"name":"ScotchBlue 1.41 in. x 60 yds. Original Multi-Surface Painter's Tape (6-Pack)","costCode":"2300 Painting","costCodeName":"Painting","materials":{"desc":"ScotchBlue 1.41 in. x 60 yds. Original Multi-Surface Painter's Tape (6-Pack)","unitCost":34.98,"unitPrice":43.725,"unit":"Each","qty":1},"labor":null},{"name":"Wallpaper removal/sqft of 8' wall","costCode":"2300 Painting","costCodeName":"Painting","materials":null,"labor":{"desc":"Labor - Wallpaper removal/sqft of 8' wall","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2800 Concrete":[{"name":"3/8 in. x 4 ft. #3 Rebar","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"3/8 in. x 4 ft. #3 Rebar","unitCost":4.18,"unitPrice":5.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - 3/8 in. x 4 ft. #3 Rebar","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Concrete Patch Labor","costCode":"2800 Concrete","costCodeName":"Concrete","materials":null,"labor":{"desc":"Labor - Concrete Patch Labor","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Concrete replacement per sqft","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"Concrete replacement per sqft","unitCost":12.0,"unitPrice":15.0,"unit":"Each","qty":1},"labor":null},{"name":"Quikrete 80 lb. Concrete Mix","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"Quikrete 80 lb. Concrete Mix","unitCost":5.98,"unitPrice":7.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Quikrete 80 lb. Concrete Mix","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Quikrete QUIK-TUBE 12 in. x 48 in. Building Form Tube","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"Quikrete QUIK-TUBE 12 in. x 48 in. Building Form Tube","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Quikrete QUIK-TUBE 12 in. x 48 in. Building Form Tube","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Sika 1 Gal. Ready-Mix Concrete Patch and Repair, Textured Concrete Patch","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"Sika 1 Gal. Ready-Mix Concrete Patch and Repair, Textured Concrete Patch","unitCost":32.62,"unitPrice":40.775,"unit":"Each","qty":1},"labor":null},{"name":"Sika 10.1 fl. oz. Sikaflex Self-Leveling Horizontal Joint Elastic Polyurethane Sealant in Gray","costCode":"2800 Concrete","costCodeName":"Concrete","materials":{"desc":"Sika 10.1 fl. oz. Sikaflex Self-Leveling Horizontal Joint Elastic Polyurethane Sealant in Gray","unitCost":8.91,"unitPrice":11.138,"unit":"Each","qty":1},"labor":{"desc":"Labor - Sika 10.1 fl. oz. Sikaflex Self-Leveling Horizontal Joint Elastic Polyurethane Sealant in Gray","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2100 Trimwork":[{"name":"32 sq. ft. MDF Spartan Oak Wall Paneling 48 in. x 96 in. x 0.118 in.","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"32 sq. ft. MDF Spartan Oak Wall Paneling 48 in. x 96 in. x 0.118 in.","unitCost":19.98,"unitPrice":24.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - 32 sq. ft. MDF Spartan Oak Wall Paneling 48 in. x 96 in. x 0.118 in.","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"42 in. x 2 in. Pressure-Treated Beveled 1-End Baluster","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"42 in. x 2 in. Pressure-Treated Beveled 1-End Baluster","unitCost":1.87,"unitPrice":2.338,"unit":"Each","qty":1},"labor":null},{"name":"6 in. x 12 ft. Aluminum Cedar Texture Fascia Trim in Birch White by Gibraltar Building Products","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"6 in. x 12 ft. Aluminum Cedar Texture Fascia Trim in Birch White by Gibraltar Building Products","unitCost":15.98,"unitPrice":19.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - 6 in. x 12 ft. Aluminum Cedar Texture Fascia Trim in Birch White by Gibraltar Building Products","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Alexandria Moulding 1-1/4 in. x 2 in. x 84 in. Vinyl Brick Moulding Set (3-Pack)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Alexandria Moulding 1-1/4 in. x 2 in. x 84 in. Vinyl Brick Moulding Set (3-Pack)","unitCost":39.34,"unitPrice":49.175,"unit":"Each","qty":1},"labor":{"desc":"Labor - Alexandria Moulding 1-1/4 in. x 2 in. x 84 in. Vinyl Brick Moulding Set (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Alexandria Moulding 390 11/16 in. x 2\u22121/2 in. Primed Finger Jointed Wood Chair Rail Moulding (Sold by Linear Foot)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Alexandria Moulding 390 11/16 in. x 2\u22121/2 in. Primed Finger Jointed Wood Chair Rail Moulding (Sold by Linear Foot)","unitCost":2.64,"unitPrice":3.3,"unit":"Each","qty":1},"labor":{"desc":"Labor - Alexandria Moulding 390 11/16 in. x 2\u22121/2 in. Primed Finger Jointed Wood Chair Rail Moulding (Sold by Linear Foot)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Alexandria Moulding 5/8 in. x 3-1/2 in. x 171 in. Primed Finger-Jointed Pine Wood Casing Molding Pro-Pack (6-Pack)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Alexandria Moulding 5/8 in. x 3-1/2 in. x 171 in. Primed Finger-Jointed Pine Wood Casing Molding Pro-Pack (6-Pack)","unitCost":1.4,"unitPrice":1.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Alexandria Moulding 5/8 in. x 3-1/2 in. x 171 in. Primed Finger-Jointed Pine Wood Casing Molding Pro-Pack (6-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Baluster Install Labor","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":null,"labor":{"desc":"Labor - Baluster Install Labor","unitCost":10.0,"unitPrice":11.5,"unit":"hr","qty":1}},{"name":"Baseboard Install","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":null,"labor":{"desc":"Labor - Baseboard Install","unitCost":4.5,"unitPrice":5.175,"unit":"hr","qty":1}},{"name":"CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Jointed Casing Pro Pack 168 LF (12-Pieces)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Jointed Casing Pro Pack 168 LF (12-Pieces)","unitCost":0.99,"unitPrice":1.238,"unit":"Each","qty":1},"labor":{"desc":"Labor - CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Jointed Casing Pro Pack 168 LF (12-Pieces)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Eucatile 32 sq. ft. 3/16 in. x 48 in. x 96 in. Beadboard White True Bead Panel","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Eucatile 32 sq. ft. 3/16 in. x 48 in. x 96 in. Beadboard White True Bead Panel","unitCost":23.98,"unitPrice":29.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Eucatile 32 sq. ft. 3/16 in. x 48 in. x 96 in. Beadboard White True Bead Panel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"FORMICA 4 ft. x 8 ft. Laminate Sheet in Brite White with Matte Finish","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"FORMICA 4 ft. x 8 ft. Laminate Sheet in Brite White with Matte Finish","unitCost":2.15,"unitPrice":2.688,"unit":"Each","qty":1},"labor":{"desc":"Labor - FORMICA 4 ft. x 8 ft. Laminate Sheet in Brite White with Matte Finish","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor to Install Baseboards per linear ft","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":null,"labor":{"desc":"Labor - Labor to Install Baseboards per linear ft","unitCost":3.3,"unitPrice":3.795,"unit":"hr","qty":1}},{"name":"Quarter round (paint & install) per linear foot","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":null,"labor":{"desc":"Labor - Quarter round (paint & install) per linear foot","unitCost":8.0,"unitPrice":9.2,"unit":"hr","qty":1}},{"name":"ROPPE Vinyl Self Stick Snow 4 in. x 0.080 in. x 20 ft. Wall Cove Base Coil","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"ROPPE Vinyl Self Stick Snow 4 in. x 0.080 in. x 20 ft. Wall Cove Base Coil","unitCost":1.25,"unitPrice":1.563,"unit":"Each","qty":1},"labor":{"desc":"Labor - ROPPE Vinyl Self Stick Snow 4 in. x 0.080 in. x 20 ft. Wall Cove Base Coil","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Royal Mouldings 5205 1 1/8 in. x 1 1/8 in. x 96 in. Finished PVC White Outside Corner Moulding (1-Piece - 8 Total Linear Feet","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Royal Mouldings 5205 1 1/8 in. x 1 1/8 in. x 96 in. Finished PVC White Outside Corner Moulding (1-Piece - 8 Total Linear Feet","unitCost":10.98,"unitPrice":13.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - Royal Mouldings 5205 1 1/8 in. x 1 1/8 in. x 96 in. Finished PVC White Outside Corner Moulding (1-Piece - 8 Total Linear Feet","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Stair Parts 39 in. x 1-1/4 in. Primed Square-Top Baluster","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"Stair Parts 39 in. x 1-1/4 in. Primed Square-Top Baluster","unitCost":6.28,"unitPrice":7.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - Stair Parts 39 in. x 1-1/4 in. Primed Square-Top Baluster","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"TruChoice LWM 623 1/2 in. x 3-1/4 in. x 144 in. MDF Primed Base Pro Pack (10-Pieces) Moulding","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"TruChoice LWM 623 1/2 in. x 3-1/4 in. x 144 in. MDF Primed Base Pro Pack (10-Pieces) Moulding","unitCost":0.62,"unitPrice":0.775,"unit":"Each","qty":1},"labor":{"desc":"Labor - TruChoice LWM 623 1/2 in. x 3-1/4 in. x 144 in. MDF Primed Base Pro Pack (10-Pieces) Moulding","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"WM 129 7/16 in. x 11/16 in. Pine Shoe Base Moulding","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"WM 129 7/16 in. x 11/16 in. Pine Shoe Base Moulding","unitCost":5.48,"unitPrice":6.85,"unit":"Each","qty":1},"labor":{"desc":"Labor - WM 129 7/16 in. x 11/16 in. Pine Shoe Base Moulding","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"WM 231 1-1/2 in. x 1-11/16 in. Solid Pine Wood Handrail (per linear foot)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"WM 231 1-1/2 in. x 1-11/16 in. Solid Pine Wood Handrail (per linear foot)","unitCost":2.97,"unitPrice":3.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - WM 231 1-1/2 in. x 1-11/16 in. Solid Pine Wood Handrail (per linear foot)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"WM 623 9/16 in. x 3-1/4 in. x 144 in. Primed Finger-Jointed Pine Base Moulding Pro Pack (10-Pack)","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"WM 623 9/16 in. x 3-1/4 in. x 144 in. Primed Finger-Jointed Pine Base Moulding Pro Pack (10-Pack)","unitCost":0.58,"unitPrice":0.725,"unit":"Each","qty":1},"labor":null},{"name":"White Melamine Wood Shelf 15.75 in. D x 97 in. L","costCode":"2100 Trimwork","costCodeName":"Trimwork","materials":{"desc":"White Melamine Wood Shelf 15.75 in. D x 97 in. L","unitCost":23.97,"unitPrice":29.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - White Melamine Wood Shelf 15.75 in. D x 97 in. L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2200 Specialty Finishes":[{"name":"4 in. Black Flush Mount Metal House Number","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"4 in. Black Flush Mount Metal House Number","unitCost":6.38,"unitPrice":7.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - 4 in. Black Flush Mount Metal House Number","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ARISTA Highlander Collection 3-Piece Bathroom Hardware Kit in Satin Nickel","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ARISTA Highlander Collection 3-Piece Bathroom Hardware Kit in Satin Nickel","unitCost":28.35,"unitPrice":35.438,"unit":"Each","qty":1},"labor":{"desc":"Labor - ARISTA Highlander Collection 3-Piece Bathroom Hardware Kit in Satin Nickel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Basco Classic 60 in. x 70 in. Semi-Frameless Sliding Shower Door in Chrome with Clear Glass","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Basco Classic 60 in. x 70 in. Semi-Frameless Sliding Shower Door in Chrome with Clear Glass","unitCost":326.29,"unitPrice":407.863,"unit":"Each","qty":1},"labor":{"desc":"Labor - Basco Classic 60 in. x 70 in. Semi-Frameless Sliding Shower Door in Chrome with Clear Glass","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Best Value Centura Toilet Paper Holder in Chrome","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Best Value Centura Toilet Paper Holder in Chrome","unitCost":8.98,"unitPrice":11.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - Best Value Centura Toilet Paper Holder in Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid 12 in. x 1 in. White Shelving Support Bracket (2-Pack)","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid 12 in. x 1 in. White Shelving Support Bracket (2-Pack)","unitCost":10.38,"unitPrice":12.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid 12 in. x 1 in. White Shelving Support Bracket (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid Preloaded Back Wall Clips for Wire Shelving (7-Pack)","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid Preloaded Back Wall Clips for Wire Shelving (7-Pack)","unitCost":3.99,"unitPrice":4.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid Preloaded Back Wall Clips for Wire Shelving (7-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid Preloaded Wall Brackets for SuperSlide Ventilated Wire Shelving (2-Pack)","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid Preloaded Wall Brackets for SuperSlide Ventilated Wire Shelving (2-Pack)","unitCost":5.47,"unitPrice":6.838,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid Preloaded Wall Brackets for SuperSlide Ventilated Wire Shelving (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid Shelf and Rod 6 ft. x 12 in. Ventilated Wire Shelf","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid Shelf and Rod 6 ft. x 12 in. Ventilated Wire Shelf","unitCost":19.98,"unitPrice":24.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid Shelf and Rod 6 ft. x 12 in. Ventilated Wire Shelf","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid Style+ 10 in. x 17 in. White Shaker Drawer Kit for 17 in. W Style+ Tower","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid Style+ 10 in. x 17 in. White Shaker Drawer Kit for 17 in. W Style+ Tower","unitCost":49.98,"unitPrice":62.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid Style+ 10 in. x 17 in. White Shaker Drawer Kit for 17 in. W Style+ Tower","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid SuperSlide 72 in. White Closet Rod","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid SuperSlide 72 in. White Closet Rod","unitCost":12.98,"unitPrice":16.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid SuperSlide 72 in. White Closet Rod","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"ClosetMaid Superslide 48 in. Hanging Closet Rod","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"ClosetMaid Superslide 48 in. Hanging Closet Rod","unitCost":10.38,"unitPrice":12.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - ClosetMaid Superslide 48 in. Hanging Closet Rod","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Delta Classic 500 60 in. W x 61.25 in. H x 32 in. D 3-Piece Direct-to-Stud Alcove Bathtub/Shower Surrounds in High Gloss White","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Delta Classic 500 60 in. W x 61.25 in. H x 32 in. D 3-Piece Direct-to-Stud Alcove Bathtub/Shower Surrounds in High Gloss White","unitCost":359.0,"unitPrice":448.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Delta Classic 500 60 in. W x 61.25 in. H x 32 in. D 3-Piece Direct-to-Stud Alcove Bathtub/Shower Surrounds in High Gloss White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Delta Porter 3-Piece Bath Hardware Set with Towel Ring Toilet Paper Holder and 24 in. Towel Bar in Oil Rubbed Bronze","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Delta Porter 3-Piece Bath Hardware Set with Towel Ring Toilet Paper Holder and 24 in. Towel Bar in Oil Rubbed Bronze","unitCost":59.98,"unitPrice":74.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Delta Porter 3-Piece Bath Hardware Set with Towel Ring Toilet Paper Holder and 24 in. Towel Bar in Oil Rubbed Bronze","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Delta Pro-Series 60 in. W x 57 in. H Five Piece Glue Up Tub Surrounds in High Gloss White","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Delta Pro-Series 60 in. W x 57 in. H Five Piece Glue Up Tub Surrounds in High Gloss White","unitCost":109.0,"unitPrice":136.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Delta Pro-Series 60 in. W x 57 in. H Five Piece Glue Up Tub Surrounds in High Gloss White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Glacier Bay Constructor Single Post Toilet Paper Holder in Brushed Nickel","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Glacier Bay Constructor Single Post Toilet Paper Holder in Brushed Nickel","unitCost":20.71,"unitPrice":25.888,"unit":"Each","qty":1},"labor":{"desc":"Labor - Glacier Bay Constructor Single Post Toilet Paper Holder in Brushed Nickel","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Kingston Brass 64 in. x 27 in. Corner Shower Rod in Chrome","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Kingston Brass 64 in. x 27 in. Corner Shower Rod in Chrome","unitCost":109.37,"unitPrice":136.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Kingston Brass 64 in. x 27 in. Corner Shower Rod in Chrome","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Replacement Double Post Toilet Paper Roller in White","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Replacement Double Post Toilet Paper Roller in White","unitCost":3.98,"unitPrice":4.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Replacement Double Post Toilet Paper Roller in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Rubbed Bronze Steel Mail Slot Accessory","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"Rubbed Bronze Steel Mail Slot Accessory","unitCost":34.93,"unitPrice":43.663,"unit":"Each","qty":1},"labor":{"desc":"Labor - Rubbed Bronze Steel Mail Slot Accessory","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"STERLING Deluxe 46 in. x 65-1/2 in. Framed Sliding Shower Door in Silver with Handle","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"STERLING Deluxe 46 in. x 65-1/2 in. Framed Sliding Shower Door in Silver with Handle","unitCost":536.36,"unitPrice":670.45,"unit":"Each","qty":1},"labor":{"desc":"Labor - STERLING Deluxe 46 in. x 65-1/2 in. Framed Sliding Shower Door in Silver with Handle","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"USG Ceilings 2 ft. x 4 ft. Fifth Avenue Lay-In Ceiling Panel (3-Pack)","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"USG Ceilings 2 ft. x 4 ft. Fifth Avenue Lay-In Ceiling Panel (3-Pack)","unitCost":18.52,"unitPrice":23.15,"unit":"Each","qty":1},"labor":{"desc":"Labor - USG Ceilings 2 ft. x 4 ft. Fifth Avenue Lay-In Ceiling Panel (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"USG Ceilings 2 ft. x 4 ft. Radar Lay-In Ceiling Panel (8-Pack)","costCode":"2200 Specialty Finishes","costCodeName":"Specialty Finishes","materials":{"desc":"USG Ceilings 2 ft. x 4 ft. Radar Lay-In Ceiling Panel (8-Pack)","unitCost":5.06,"unitPrice":6.325,"unit":"Each","qty":1},"labor":{"desc":"Labor - USG Ceilings 2 ft. x 4 ft. Radar Lay-In Ceiling Panel (8-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2600 Fencing":[{"name":"5/8 in. x 5-1/2 in. x 6 ft. Pressure-Treated Pine Dog-Ear Fence Picket","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"5/8 in. x 5-1/2 in. x 6 ft. Pressure-Treated Pine Dog-Ear Fence Picket","unitCost":2.18,"unitPrice":2.725,"unit":"Each","qty":1},"labor":{"desc":"Labor - 5/8 in. x 5-1/2 in. x 6 ft. Pressure-Treated Pine Dog-Ear Fence Picket","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Black Gate Latch by Everbilt","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Black Gate Latch by Everbilt","unitCost":4.93,"unitPrice":6.163,"unit":"Each","qty":1},"labor":{"desc":"Labor - Black Gate Latch by Everbilt","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 1-3/8 in. Dia x 10 ft. 6 in. L 17-Gauge Galvanized Metal Top Rail Chain Link Fence Post","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt 1-3/8 in. Dia x 10 ft. 6 in. L 17-Gauge Galvanized Metal Top Rail Chain Link Fence Post","unitCost":21.97,"unitPrice":27.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 1-3/8 in. Dia x 10 ft. 6 in. L 17-Gauge Galvanized Metal Top Rail Chain Link Fence Post","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 2-1/2 in. Zinc-Plated Rotating Post Safety Hasp","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt 2-1/2 in. Zinc-Plated Rotating Post Safety Hasp","unitCost":4.4,"unitPrice":5.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 2-1/2 in. Zinc-Plated Rotating Post Safety Hasp","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 2-3/8 in. Dia x 8 ft. 16-Gauge Galvanized Steel Chain Link Fence Corner Post","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt 2-3/8 in. Dia x 8 ft. 16-Gauge Galvanized Steel Chain Link Fence Corner Post","unitCost":31.97,"unitPrice":39.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 2-3/8 in. Dia x 8 ft. 16-Gauge Galvanized Steel Chain Link Fence Corner Post","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt 2-3/8 in. Galvanized Chain Link Fence Aluminum End/Gate Post Set for 5 ft. & 6 ft.","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt 2-3/8 in. Galvanized Chain Link Fence Aluminum End/Gate Post Set for 5 ft. & 6 ft.","unitCost":21.94,"unitPrice":27.425,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 2-3/8 in. Galvanized Chain Link Fence Aluminum End/Gate Post Set for 5 ft. & 6 ft.","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Chain Link Fence 2-3/8 in. Galvanized Steel Walk Gate Hardware Set","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt Chain Link Fence 2-3/8 in. Galvanized Steel Walk Gate Hardware Set","unitCost":29.0,"unitPrice":36.25,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Chain Link Fence 2-3/8 in. Galvanized Steel Walk Gate Hardware Set","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Everbilt Chain link 6 ft. W x 4 ft. H Galvanized Steel Fence Gate Kit","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Everbilt Chain link 6 ft. W x 4 ft. H Galvanized Steel Fence Gate Kit","unitCost":79.97,"unitPrice":99.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt Chain link 6 ft. W x 4 ft. H Galvanized Steel Fence Gate Kit","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Veranda `5 in. x 5 in. White Vinyl New England Fence Post Cap","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"Veranda `5 in. x 5 in. White Vinyl New England Fence Post Cap","unitCost":6.97,"unitPrice":8.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Veranda `5 in. x 5 in. White Vinyl New England Fence Post Cap","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"YARDGARD 1-5/8 in. Galvanized Aluminum Plain Dome Post Cap","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"YARDGARD 1-5/8 in. Galvanized Aluminum Plain Dome Post Cap","unitCost":0.98,"unitPrice":1.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - YARDGARD 1-5/8 in. Galvanized Aluminum Plain Dome Post Cap","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"allFENZ 1-3/8 in. x 1-3/8 in. Galvanized Fork Latch Kit (2-Pack)","costCode":"2600 Fencing","costCodeName":"Fencing","materials":{"desc":"allFENZ 1-3/8 in. x 1-3/8 in. Galvanized Fork Latch Kit (2-Pack)","unitCost":7.61,"unitPrice":9.513,"unit":"Each","qty":1},"labor":{"desc":"Labor - allFENZ 1-3/8 in. x 1-3/8 in. Galvanized Fork Latch Kit (2-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1600 Garage":[{"name":"9 ft. x 2.75 in. Dual Vinyl Garage Door Top and Side Seal, White","costCode":"1600 Garage","costCodeName":"Garage","materials":{"desc":"9 ft. x 2.75 in. Dual Vinyl Garage Door Top and Side Seal, White","unitCost":15.57,"unitPrice":19.463,"unit":"Each","qty":1},"labor":null}],"0000 Uncategorized":[{"name":"9X$ Bathroom- Framing and Drywall","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X$ Bathroom- Framing and Drywall","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}},{"name":"9X5 Bathroom - Electrical Rough","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom - Electrical Rough","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}},{"name":"9X5 Bathroom - Underlayment Install- materials included","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom - Underlayment Install- materials included","unitCost":800.0,"unitPrice":920.0,"unit":"hr","qty":1}},{"name":"9X5 Bathroom Floor- Ceramic Tile","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom Floor- Ceramic Tile","unitCost":1200.0,"unitPrice":1380.0,"unit":"hr","qty":1}},{"name":"9X5 Bathroom Rough Plumbing","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom Rough Plumbing","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}},{"name":"9X5 Bathroom- Electrical Final","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom- Electrical Final","unitCost":1.0,"unitPrice":1.15,"unit":"hr","qty":1}},{"name":"9X5 Bathroom- Painting","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Bathroom- Painting","unitCost":800.0,"unitPrice":920.0,"unit":"hr","qty":1}},{"name":"9X5 Plumbing Final","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5 Plumbing Final","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}},{"name":"9X5- Trim out","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - 9X5- Trim out","unitCost":500.0,"unitPrice":575.0,"unit":"hr","qty":1}},{"name":"Carpet cleaning 2bd/1ba(Complete carpet care)","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Carpet cleaning 2bd/1ba(Complete carpet care)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Carpet cleaning per room","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Carpet cleaning per room","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Carpet cleaning per room (Complete carpet care), $115 minimum","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Carpet cleaning per room (Complete carpet care), $115 minimum","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Chamberlain Universal Clicker Black Garage Door Remote Control","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Chamberlain Universal Clicker Black Garage Door Remote Control","unitCost":29.98,"unitPrice":37.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Chamberlain Universal Clicker Black Garage Door Remote Control","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clean window track","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Clean window track","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clean: Fridge","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Clean: Fridge","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clean: Range","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Clean: Range","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cleaning labor/hr x1","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Cleaning labor/hr x1","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Cost to write scope","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Cost to write scope","unitCost":400.0,"unitPrice":460.0,"unit":"hr","qty":1}},{"name":"Decal/sticker removal","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Decal/sticker removal","unitCost":10.0,"unitPrice":12.5,"unit":"Each","qty":1},"labor":null},{"name":"Floor cleaning/buffing per sqft","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Floor cleaning/buffing per sqft","unitCost":1.0,"unitPrice":1.25,"unit":"Each","qty":1},"labor":null},{"name":"Labor and materials to fix door","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor and materials to fix door","unitCost":500.0,"unitPrice":575.0,"unit":"hr","qty":1}},{"name":"Labor for final plumbing","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor for final plumbing","unitCost":5000.0,"unitPrice":5750.0,"unit":"hr","qty":1}},{"name":"Labor to install 220 outlet","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor to install 220 outlet","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Labor to install cabinet spacers","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor to install cabinet spacers","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Labor to install finishes on tub and shower","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor to install finishes on tub and shower","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Labor to install pickets on a fence","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor to install pickets on a fence","unitCost":10.0,"unitPrice":11.5,"unit":"hr","qty":1}},{"name":"Labor to install toilet","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Labor to install toilet","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Materials (Window)","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Materials (Window)","unitCost":450.0,"unitPrice":517.5,"unit":"hr","qty":1}},{"name":"Misc Construction Materials","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Misc Construction Materials","unitCost":150.0,"unitPrice":172.5,"unit":"hr","qty":1}},{"name":"Miscellaneous Supplies","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Miscellaneous Supplies","unitCost":125.0,"unitPrice":156.25,"unit":"ea","qty":1},"labor":null},{"name":"Mold Armor 64 oz. House Wash Hose End Sprayer Mold and Mildew Remover","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Mold Armor 64 oz. House Wash Hose End Sprayer Mold and Mildew Remover","unitCost":13.97,"unitPrice":17.463,"unit":"Each","qty":1},"labor":null},{"name":"Paint 1 gallon- standard","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Paint 1 gallon- standard","unitCost":25.58,"unitPrice":31.975,"unit":"Gallons","qty":1},"labor":null},{"name":"Pest Treatment (Pro-Tec)","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Pest Treatment (Pro-Tec)","unitCost":75.0,"unitPrice":93.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Pest Treatment (Pro-Tec)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Plumbing labor","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Plumbing labor","unitCost":500.0,"unitPrice":575.0,"unit":"hr","qty":1}},{"name":"Plumbing materials","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Plumbing materials","unitCost":500.0,"unitPrice":575.0,"unit":"hr","qty":1}},{"name":"Power Flush 12 inch Rough In Two-Piece 1.28 GPF Single Flush Elongated Toilet in White Seat Included","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Power Flush 12 inch Rough In Two-Piece 1.28 GPF Single Flush Elongated Toilet in White Seat Included","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}},{"name":"Power wash House 1 story","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Power wash House 1 story","unitCost":250.0,"unitPrice":287.5,"unit":"hr","qty":1}},{"name":"Raid 1.5 oz. Deep Reach Insect Foggers (3-Pack)","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Raid 1.5 oz. Deep Reach Insect Foggers (3-Pack)","unitCost":9.97,"unitPrice":12.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Raid 1.5 oz. Deep Reach Insect Foggers (3-Pack)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"SUMMIT BRANDS Glisten 12 oz. Dishwasher Detergent Magic Cleaner and Disinfectan","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"SUMMIT BRANDS Glisten 12 oz. Dishwasher Detergent Magic Cleaner and Disinfectan","unitCost":4.98,"unitPrice":6.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - SUMMIT BRANDS Glisten 12 oz. Dishwasher Detergent Magic Cleaner and Disinfectan","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Smoke cleaning fee","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Smoke cleaning fee","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Spectracide 20 oz. Wasp and Hornet Aerosol Spray Killer","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":{"desc":"Spectracide 20 oz. Wasp and Hornet Aerosol Spray Killer","unitCost":4.97,"unitPrice":6.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Spectracide 20 oz. Wasp and Hornet Aerosol Spray Killer","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Stringer Strap Labor","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Stringer Strap Labor","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Supplies for finish plumbing work","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Supplies for finish plumbing work","unitCost":800.0,"unitPrice":920.0,"unit":"hr","qty":1}},{"name":"Trash removal per hour","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Trash removal per hour","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Wall Wipe down/Clean up (per room)","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - Wall Wipe down/Clean up (per room)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"appliances labor","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - appliances labor","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"labor to install garage door seal","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - labor to install garage door seal","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"labor to install tub drain","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - labor to install tub drain","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"labor to pull electrical","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - labor to pull electrical","unitCost":4.0,"unitPrice":4.6,"unit":"hr","qty":1}},{"name":"labor/materials (unknown) to fix electrical junction box","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - labor/materials (unknown) to fix electrical junction box","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"permits","costCode":"0000 Uncategorized","costCodeName":"Uncategorized","materials":null,"labor":{"desc":"Labor - permits","unitCost":1600.0,"unitPrice":1840.0,"unit":"hr","qty":1}}],"0900 Roofing":[{"name":"Amerimax Home Products 2 in. x 3 in. Aluminum Downspout B Elbow","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Amerimax Home Products 2 in. x 3 in. Aluminum Downspout B Elbow","unitCost":4.28,"unitPrice":5.35,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products 2 in. x 3 in. Aluminum Downspout B Elbow","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Amerimax Home Products 3 in. x 4 in. x 10 ft. White Aluminum Downspout","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Amerimax Home Products 3 in. x 4 in. x 10 ft. White Aluminum Downspout","unitCost":16.48,"unitPrice":20.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products 3 in. x 4 in. x 10 ft. White Aluminum Downspout","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Amerimax Home Products 5 in. Aluminum Hidden Gutter Hanger with Screw","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Amerimax Home Products 5 in. Aluminum Hidden Gutter Hanger with Screw","unitCost":2.43,"unitPrice":3.038,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products 5 in. Aluminum Hidden Gutter Hanger with Screw","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Amerimax Home Products 5 in. x 10 ft. White Aluminum K-Style Gutter","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Amerimax Home Products 5 in. x 10 ft. White Aluminum K-Style Gutter","unitCost":12.98,"unitPrice":16.225,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products 5 in. x 10 ft. White Aluminum K-Style Gutter","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Amerimax Home Products Snap-In Filter 3 ft. White Vinyl Micro-Mesh Gutter Guard (25-Pack) (per l/f)","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Amerimax Home Products Snap-In Filter 3 ft. White Vinyl Micro-Mesh Gutter Guard (25-Pack) (per l/f)","unitCost":1.98,"unitPrice":2.475,"unit":"Each","qty":1},"labor":{"desc":"Labor - Amerimax Home Products Snap-In Filter 3 ft. White Vinyl Micro-Mesh Gutter Guard (25-Pack) (per l/f)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clean gutters, 1 story","costCode":"0900 Roofing","costCodeName":"Roofing","materials":null,"labor":{"desc":"Labor - Clean gutters, 1 story","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Clean gutters, 2 story","costCode":"0900 Roofing","costCodeName":"Roofing","materials":null,"labor":{"desc":"Labor - Clean gutters, 2 story","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Gibraltar Building Products 2-3/8 in. x 1-1/2 in. x 10 ft. Painted Aluminum Drip Edge Flashing in Weathered Wood","costCode":"0900 Roofing","costCodeName":"Roofing","materials":{"desc":"Gibraltar Building Products 2-3/8 in. x 1-1/2 in. x 10 ft. Painted Aluminum Drip Edge Flashing in Weathered Wood","unitCost":12.82,"unitPrice":16.025,"unit":"Each","qty":1},"labor":{"desc":"Labor - Gibraltar Building Products 2-3/8 in. x 1-1/2 in. x 10 ft. Painted Aluminum Drip Edge Flashing in Weathered Wood","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1800 Tiling":[{"name":"Calacatta Nowy White Single Beveled 6 in. x 73 in.Polished Engineered Marble Threshold Tile (6.08 linear ft.)","costCode":"1800 Tiling","costCodeName":"Tiling","materials":{"desc":"Calacatta Nowy White Single Beveled 6 in. x 73 in.Polished Engineered Marble Threshold Tile (6.08 linear ft.)","unitCost":69.99,"unitPrice":87.488,"unit":"Each","qty":1},"labor":{"desc":"Labor - Calacatta Nowy White Single Beveled 6 in. x 73 in.Polished Engineered Marble Threshold Tile (6.08 linear ft.)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Custom Building Products Polyblend #640 10.5 oz. Arctic White Sanded Ceramic Tile Caulk","costCode":"1800 Tiling","costCodeName":"Tiling","materials":{"desc":"Custom Building Products Polyblend #640 10.5 oz. Arctic White Sanded Ceramic Tile Caulk","unitCost":11.97,"unitPrice":14.963,"unit":"Each","qty":1},"labor":{"desc":"Labor - Custom Building Products Polyblend #640 10.5 oz. Arctic White Sanded Ceramic Tile Caulk","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Daltile Restore Bright White 4-1/4 in. x 4-1/4 in. Ceramic Wall Tile (0.125 sq. ft./ Each (cost includes grout and mortar)","costCode":"1800 Tiling","costCodeName":"Tiling","materials":null,"labor":{"desc":"Labor - Daltile Restore Bright White 4-1/4 in. x 4-1/4 in. Ceramic Wall Tile (0.125 sq. ft./ Each (cost includes grout and mortar)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Polyblend Plus #333 Alabaster 10 lb. Unsanded Grout","costCode":"1800 Tiling","costCodeName":"Tiling","materials":{"desc":"Polyblend Plus #333 Alabaster 10 lb. Unsanded Grout","unitCost":19.98,"unitPrice":24.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Polyblend Plus #333 Alabaster 10 lb. Unsanded Grout","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"USG Durock Brand 1/2 in. x 3 ft. x 5 ft. Cement Board with EdgeGuard","costCode":"1800 Tiling","costCodeName":"Tiling","materials":{"desc":"USG Durock Brand 1/2 in. x 3 ft. x 5 ft. Cement Board with EdgeGuard","unitCost":11.6,"unitPrice":14.5,"unit":"Each","qty":1},"labor":{"desc":"Labor - USG Durock Brand 1/2 in. x 3 ft. x 5 ft. Cement Board with EdgeGuard","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"1300 Insulation":[{"name":"Cellulose Blown-In insulation/saft","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Cellulose Blown-In insulation/saft","unitCost":1.9,"unitPrice":2.375,"unit":"Each","qty":1},"labor":null},{"name":"Greenfiber 25 lbs. Cellulose Blown-In Insulation or Spray Applied Insulation (48.8sqft per bag @ R-19)","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Greenfiber 25 lbs. Cellulose Blown-In Insulation or Spray Applied Insulation (48.8sqft per bag @ R-19)","unitCost":14.97,"unitPrice":18.713,"unit":"Each","qty":1},"labor":{"desc":"Labor - Greenfiber 25 lbs. Cellulose Blown-In Insulation or Spray Applied Insulation (48.8sqft per bag @ R-19)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Insulation Batting Labor Sq Ft","costCode":"1300 Insulation","costCodeName":"Insulation","materials":null,"labor":{"desc":"Labor - Insulation Batting Labor Sq Ft","unitCost":0.3,"unitPrice":0.345,"unit":"hr","qty":1}},{"name":"Loctite TITE FOAM Big Gaps Spray Foam, Bright White, 12 oz. Can, Insulating Spray Foam Sealant","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Loctite TITE FOAM Big Gaps Spray Foam, Bright White, 12 oz. Can, Insulating Spray Foam Sealant","unitCost":7.98,"unitPrice":9.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - Loctite TITE FOAM Big Gaps Spray Foam, Bright White, 12 oz. Can, Insulating Spray Foam Sealant","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"OWENS CORNING FOAMULAR NGX F-150 1 in. x 4 ft. x 8 ft. SSE R-5 XPS Rigid Foam Board Insulation","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"OWENS CORNING FOAMULAR NGX F-150 1 in. x 4 ft. x 8 ft. SSE R-5 XPS Rigid Foam Board Insulation","unitCost":21.58,"unitPrice":26.975,"unit":"Each","qty":1},"labor":{"desc":"Labor - OWENS CORNING FOAMULAR NGX F-150 1 in. x 4 ft. x 8 ft. SSE R-5 XPS Rigid Foam Board Insulation","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Owen Corning 15 in. x 47 in. R15 Thermafiber Fire and Sound Guard Plus Mineral Wool Insulation Batt","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Owen Corning 15 in. x 47 in. R15 Thermafiber Fire and Sound Guard Plus Mineral Wool Insulation Batt","unitCost":1.32,"unitPrice":1.65,"unit":"Each","qty":1},"labor":{"desc":"Labor - Owen Corning 15 in. x 47 in. R15 Thermafiber Fire and Sound Guard Plus Mineral Wool Insulation Batt","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Owens Corning R-15 Thermafiber UltraBatt Unfaced Mineral Wool Insulation Batt 15in. x 47in","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Owens Corning R-15 Thermafiber UltraBatt Unfaced Mineral Wool Insulation Batt 15in. x 47in","unitCost":0.96,"unitPrice":1.2,"unit":"Each","qty":1},"labor":null},{"name":"Owens Corning R-30 PINK Unfaced Fiberglass Insulation Roll 23 in. x 25 ft.","costCode":"1300 Insulation","costCodeName":"Insulation","materials":{"desc":"Owens Corning R-30 PINK Unfaced Fiberglass Insulation Roll 23 in. x 25 ft.","unitCost":74.47,"unitPrice":93.088,"unit":"Each","qty":1},"labor":{"desc":"Labor - Owens Corning R-30 PINK Unfaced Fiberglass Insulation Roll 23 in. x 25 ft.","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2000 Countertops":[{"name":"Countertop Install Labor","costCode":"2000 Countertops","costCodeName":"Countertops","materials":null,"labor":{"desc":"Labor - Countertop Install Labor","unitCost":200.0,"unitPrice":230.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 4 ft. Gray Laminate Countertop Kit with Eased Edge in Typhoon Ice","costCode":"2000 Countertops","costCodeName":"Countertops","materials":{"desc":"Hampton Bay 4 ft. Gray Laminate Countertop Kit with Eased Edge in Typhoon Ice","unitCost":161.85,"unitPrice":202.313,"unit":"Each","qty":1},"labor":{"desc":"Labor - Hampton Bay 4 ft. Gray Laminate Countertop Kit with Eased Edge in Typhoon Ice","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Hampton Bay 4-5/8 in. x 25-5/8 in. Laminate Endcap Kit in Typhoon Ice with Full Wrap Ogee Edge","costCode":"2000 Countertops","costCodeName":"Countertops","materials":{"desc":"Hampton Bay 4-5/8 in. x 25-5/8 in. Laminate Endcap Kit in Typhoon Ice with Full Wrap Ogee Edge","unitCost":27.98,"unitPrice":34.975,"unit":"Each","qty":1},"labor":null},{"name":"Hampton Bay Wilsonart 6 ft. Straight Laminate Countertop in Textured Typhoon Ice with Full Wrap Ogee Edge and Integrated Backsplash","costCode":"2000 Countertops","costCodeName":"Countertops","materials":{"desc":"Hampton Bay Wilsonart 6 ft. Straight Laminate Countertop in Textured Typhoon Ice with Full Wrap Ogee Edge and Integrated Backsplash","unitCost":139.0,"unitPrice":173.75,"unit":"Each","qty":1},"labor":null},{"name":"Laminate End Cap Kit Labor","costCode":"2000 Countertops","costCodeName":"Countertops","materials":null,"labor":{"desc":"Labor - Laminate End Cap Kit Labor","unitCost":50.0,"unitPrice":57.5,"unit":"hr","qty":1}},{"name":"Stone Countertop install per sqft","costCode":"2000 Countertops","costCodeName":"Countertops","materials":{"desc":"Stone Countertop install per sqft","unitCost":55.0,"unitPrice":68.75,"unit":"Each","qty":1},"labor":null}],"0200 Demolition":[{"name":"Demo 9X5 Bathroom","costCode":"0200 Demolition","costCodeName":"Demolition","materials":null,"labor":{"desc":"Labor - Demo 9X5 Bathroom","unitCost":100,"unitPrice":0.0,"unit":"hr","qty":1}}],"0800 Siding":[{"name":"Everbilt 4 in. Louvered Vent Cap in White","costCode":"0800 Siding","costCodeName":"Siding","materials":{"desc":"Everbilt 4 in. Louvered Vent Cap in White","unitCost":7.68,"unitPrice":9.6,"unit":"Each","qty":1},"labor":{"desc":"Labor - Everbilt 4 in. Louvered Vent Cap in White","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Mobile Home Skirting Vinyl Underpinning Vented Panel White 16\" W x 35\" L","costCode":"0800 Siding","costCodeName":"Siding","materials":{"desc":"Mobile Home Skirting Vinyl Underpinning Vented Panel White 16\" W x 35\" L","unitCost":6.2,"unitPrice":7.75,"unit":"Each","qty":1},"labor":{"desc":"Labor - Mobile Home Skirting Vinyl Underpinning Vented Panel White 16\" W x 35\" L","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Ply Gem 3 in. x 3/4 in. White Outside Corner Post","costCode":"0800 Siding","costCodeName":"Siding","materials":{"desc":"Ply Gem 3 in. x 3/4 in. White Outside Corner Post","unitCost":17.65,"unitPrice":22.063,"unit":"Each","qty":1},"labor":{"desc":"Labor - Ply Gem 3 in. x 3/4 in. White Outside Corner Post","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Ply Gem 3/4 in. White Inside Corner Post","costCode":"0800 Siding","costCodeName":"Siding","materials":{"desc":"Ply Gem 3/4 in. White Inside Corner Post","unitCost":13.5,"unitPrice":16.875,"unit":"Each","qty":1},"labor":{"desc":"Labor - Ply Gem 3/4 in. White Inside Corner Post","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Ply Gem Transformations Double 4.5 in. x 145 in. White Dutch Lap Vinyl Siding","costCode":"0800 Siding","costCodeName":"Siding","materials":{"desc":"Ply Gem Transformations Double 4.5 in. x 145 in. White Dutch Lap Vinyl Siding","unitCost":7.65,"unitPrice":9.563,"unit":"Each","qty":1},"labor":{"desc":"Labor - Ply Gem Transformations Double 4.5 in. x 145 in. White Dutch Lap Vinyl Siding","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}],"2900 Landscaping":[{"name":"Harmony 500 sq. ft. Bluegrass Sod (1-Pallet)","costCode":"2900 Landscaping","costCodeName":"Landscaping","materials":{"desc":"Harmony 500 sq. ft. Bluegrass Sod (1-Pallet)","unitCost":575.19,"unitPrice":718.988,"unit":"Each","qty":1},"labor":{"desc":"Labor - Harmony 500 sq. ft. Bluegrass Sod (1-Pallet)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Landscaping Clean Up","costCode":"2900 Landscaping","costCodeName":"Landscaping","materials":null,"labor":{"desc":"Labor - Landscaping Clean Up","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Mow & Trim (Joe Nunn)","costCode":"2900 Landscaping","costCodeName":"Landscaping","materials":null,"labor":{"desc":"Labor - Mow & Trim (Joe Nunn)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Spectracide Weed and Grass Killer 128 oz. Ready-to-Use Sprayer","costCode":"2900 Landscaping","costCodeName":"Landscaping","materials":{"desc":"Spectracide Weed and Grass Killer 128 oz. Ready-to-Use Sprayer","unitCost":8.97,"unitPrice":11.213,"unit":"Each","qty":1},"labor":{"desc":"Labor - Spectracide Weed and Grass Killer 128 oz. Ready-to-Use Sprayer","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}},{"name":"Spectracide Weed and Grass Killer 64 oz. Concentrate (1 per gallon application)","costCode":"2900 Landscaping","costCodeName":"Landscaping","materials":{"desc":"Spectracide Weed and Grass Killer 64 oz. Concentrate (1 per gallon application)","unitCost":29.97,"unitPrice":37.463,"unit":"Each","qty":1},"labor":{"desc":"Labor - Spectracide Weed and Grass Killer 64 oz. Concentrate (1 per gallon application)","unitCost":100.0,"unitPrice":115.0,"unit":"hr","qty":1}}]};

// ════════════════════════════════════════════════════
// ── SMART ADD TIERED BUNDLE LIBRARY ──
// Each bundle: { name, icon, desc, tiers: { low, med, high } }
// Each tier: { label, priceRange, lines: [{desc, qty, unitCost, unitPrice, unit, type}] }
// ════════════════════════════════════════════════════
const TIERED_BUNDLES = {
  '1100 Plumbing': [
    {
      name: 'Faucet Replacement',
      icon: '🚿',
      desc: 'Bath or kitchen faucet swap with supply lines and shutoffs',
      tiers: {
        low: { label: 'Standard', priceRange: 'Glacier Bay 2-Handle ~$37', lines: [
          { desc: 'Glacier Bay Constructor 4 in. Centerset 2-Handle Low-Arc Bathroom Faucet in Chrome', qty: 1, unitCost: 29.98, unitPrice: 37.48, unit: 'ea', type: 'material' },
          { desc: 'Faucet Installation Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
          { desc: 'Brass Craft 3/8 in. Compression x 1/2 in. FIP x 20 in. Braided Polymer Supply Line', qty: 2, unitCost: 8.97, unitPrice: 11.21, unit: 'ea', type: 'material' },
          { desc: 'Bathroom Supply Line Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
          { desc: 'SharkBite 1/2 in. Push-to-Connect x 3/8 in. O.D. Compression Chrome Angle Stop', qty: 2, unitCost: 13.45, unitPrice: 16.81, unit: 'ea', type: 'material' },
          { desc: 'Sharkbite Shutoff Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Mid-Grade', priceRange: 'Glacier Bay Pull-Out ~$136', lines: [
          { desc: 'Glacier Bay Market Single-Handle Pull-Out Sprayer Kitchen Faucet in Chrome', qty: 1, unitCost: 109, unitPrice: 136.25, unit: 'ea', type: 'material' },
          { desc: 'Faucet Installation Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
          { desc: 'Brass Craft 3/8 in. Compression x 1/2 in. FIP x 20 in. Braided Polymer Supply Line', qty: 2, unitCost: 8.97, unitPrice: 11.21, unit: 'ea', type: 'material' },
          { desc: 'Bathroom Supply Line Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
          { desc: 'SharkBite 1/2 in. Push-to-Connect x 3/8 in. O.D. Compression Chrome Angle Stop', qty: 2, unitCost: 13.45, unitPrice: 16.81, unit: 'ea', type: 'material' },
          { desc: 'Sharkbite Shutoff Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Premium', priceRange: 'COOLWEST Commercial Wall Mount ~$109', lines: [
          { desc: 'COOLWEST Commercial Wall Mount Faucet 8 Inch Center with 8" Gooseneck Spout', qty: 1, unitCost: 86.99, unitPrice: 108.74, unit: 'ea', type: 'material' },
          { desc: 'Faucet Installation Labor', qty: 1.5, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
          { desc: 'Brass Craft 3/8 in. Compression x 1/2 in. FIP x 20 in. Braided Polymer Supply Line', qty: 2, unitCost: 8.97, unitPrice: 11.21, unit: 'ea', type: 'material' },
          { desc: 'Bathroom Supply Line Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
          { desc: 'SharkBite 1/2 in. Push-to-Connect x 3/8 in. O.D. Compression Chrome Angle Stop', qty: 2, unitCost: 13.45, unitPrice: 16.81, unit: 'ea', type: 'material' },
          { desc: 'Sharkbite Shutoff Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Toilet Replacement',
      icon: '🚽',
      desc: 'Full toilet swap with wax ring, supply line, and seat',
      tiers: {
        low: { label: 'Round Standard', priceRange: 'Glacier Bay 1.28 GPF ~$111', lines: [
          { desc: 'Glacier Bay 2-Piece 1.28 GPF High Efficiency Single Flush Round Toilet in White', qty: 1, unitCost: 89, unitPrice: 111.25, unit: 'ea', type: 'material' },
          { desc: 'Lift-Off Round Closed Front Toilet Seat in White', qty: 1, unitCost: 16.97, unitPrice: 21.21, unit: 'ea', type: 'material' },
          { desc: 'Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Bolts', qty: 1, unitCost: 6.98, unitPrice: 8.72, unit: 'ea', type: 'material' },
          { desc: '3/8 in. Compression x 7/8 in. Ballcock Nut x 12 in. Braided Polymer Toilet Supply Line', qty: 1, unitCost: 12, unitPrice: 15, unit: 'ea', type: 'material' },
          { desc: 'Labor to replace toilet', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Dual Flush', priceRange: 'Glacier Bay Dual Flush ~$124', lines: [
          { desc: 'Glacier Bay 2-piece 1.1 GPF/1.6 GPF High Efficiency Dual Flush Complete Toilet in White', qty: 1, unitCost: 99, unitPrice: 123.75, unit: 'ea', type: 'material' },
          { desc: 'Lift-Off Round Closed Front Toilet Seat in White', qty: 1, unitCost: 16.97, unitPrice: 21.21, unit: 'ea', type: 'material' },
          { desc: 'Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Bolts', qty: 1, unitCost: 6.98, unitPrice: 8.72, unit: 'ea', type: 'material' },
          { desc: '3/8 in. Compression x 7/8 in. Ballcock Nut x 12 in. Braided Polymer Toilet Supply Line', qty: 1, unitCost: 12, unitPrice: 15, unit: 'ea', type: 'material' },
          { desc: 'Labor to replace toilet', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Power Flush Elongated', priceRange: 'Power Flush Tall ~$229', lines: [
          { desc: 'Power Flush 2-Piece 1.28 GPF Single Flush Extra Tall Elongated Toilet in White', qty: 1, unitCost: 183.08, unitPrice: 228.85, unit: 'ea', type: 'material' },
          { desc: 'Lift-Off Round Closed Front Toilet Seat in White', qty: 1, unitCost: 16.97, unitPrice: 21.21, unit: 'ea', type: 'material' },
          { desc: 'Everbilt Extra Thick Reinforced Toilet Wax Ring with Plastic Horn and Bolts', qty: 1, unitCost: 6.98, unitPrice: 8.72, unit: 'ea', type: 'material' },
          { desc: '3/8 in. Compression x 7/8 in. Ballcock Nut x 12 in. Braided Polymer Toilet Supply Line', qty: 1, unitCost: 12, unitPrice: 15, unit: 'ea', type: 'material' },
          { desc: 'Labor to replace toilet', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Kitchen Sink Install',
      icon: '🏠',
      desc: 'Drop-in sink with strainer, P-trap, and labor',
      tiers: {
        low: { label: 'Single Bowl 25"', priceRange: 'Glacier Bay Single ~$86', lines: [
          { desc: 'Glacier Bay 25 in. Drop-in Single Bowl 22 Gauge Stainless Steel Kitchen Sink', qty: 1, unitCost: 69, unitPrice: 86.25, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with Chrome Finish', qty: 1, unitCost: 10.77, unitPrice: 13.46, unit: 'ea', type: 'material' },
          { desc: '1-1/2 in. White Plastic Sink Drain P-Trap', qty: 1, unitCost: 4.68, unitPrice: 5.85, unit: 'ea', type: 'material' },
          { desc: 'Kitchen Sink Install Labor', qty: 1, unitCost: 300, unitPrice: 345, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Double Bowl 33"', priceRange: 'Glacier Bay Double ~$99', lines: [
          { desc: 'GLACIER BAY 33 in. Drop-in Double Bowl 22 Gauge Stainless Steel Kitchen Sink', qty: 1, unitCost: 79, unitPrice: 98.75, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with Chrome Finish', qty: 2, unitCost: 10.77, unitPrice: 13.46, unit: 'ea', type: 'material' },
          { desc: '1-1/2 in. White Plastic Sink Drain P-Trap', qty: 1, unitCost: 4.68, unitPrice: 5.85, unit: 'ea', type: 'material' },
          { desc: 'Kitchen Sink Install Labor', qty: 1, unitCost: 300, unitPrice: 345, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Pedestal Sink', priceRange: 'Glacier Bay Pedestal ~$92', lines: [
          { desc: 'Pedestal Sink (Glacier Bay Shelburne/Petite Aragon Pedestal in White)', qty: 1, unitCost: 73.75, unitPrice: 92.19, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay Fixed Post Kitchen Sink Strainer - Stainless steel with Chrome Finish', qty: 1, unitCost: 10.77, unitPrice: 13.46, unit: 'ea', type: 'material' },
          { desc: '1-1/2 in. White Plastic Sink Drain P-Trap', qty: 1, unitCost: 4.68, unitPrice: 5.85, unit: 'ea', type: 'material' },
          { desc: 'Kitchen Sink Install Labor', qty: 1, unitCost: 300, unitPrice: 345, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Shower/Tub Valve',
      icon: '🛁',
      desc: 'Tub or shower valve replacement with trim kit',
      tiers: {
        low: { label: 'Glacier Bay Aragon Chrome', priceRange: '~$124', lines: [
          { desc: 'Glacier Bay Aragon 3 Handle 1-Spray Tub and Shower Faucet 1.8 GPM in Chrome', qty: 1, unitCost: 99, unitPrice: 123.75, unit: 'ea', type: 'material' },
          { desc: 'Shower Valve Replacement Labor', qty: 1, unitCost: 150, unitPrice: 172.50, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Moen Adler Chrome', priceRange: '~$124', lines: [
          { desc: 'MOEN Adler Single-Handle 4-Spray Tub and Shower Faucet in Chrome', qty: 1, unitCost: 99, unitPrice: 123.75, unit: 'ea', type: 'material' },
          { desc: 'Shower Valve Replacement Labor', qty: 1, unitCost: 150, unitPrice: 172.50, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Banbury Trim Kit Matte Black', priceRange: '~$207', lines: [
          { desc: 'Banbury 1-Handle 1-Spray Trim Kit Tub and Shower Faucet 1.75 GPM in Matte Black', qty: 1, unitCost: 165.62, unitPrice: 207.03, unit: 'ea', type: 'material' },
          { desc: 'Shower Valve Replacement Labor', qty: 1, unitCost: 150, unitPrice: 172.50, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Water Heater Replace',
      icon: '🔥',
      desc: 'Water heater swap with expansion tank',
      tiers: {
        low: { label: '40 gal Electric', priceRange: '~$524 + labor', lines: [
          { desc: 'Water heater - 40 gal, tall, electric', qty: 1, unitCost: 419, unitPrice: 523.75, unit: 'ea', type: 'material' },
          { desc: 'Water Heater Expansion Tank', qty: 1, unitCost: 29.88, unitPrice: 37.35, unit: 'ea', type: 'material' },
          { desc: 'Water heater - 40 gal, tall, electric Install Labor', qty: 3, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '40 gal Natural Gas', priceRange: '~$874 + labor', lines: [
          { desc: 'Water heater - 40 gal, tall, natural gas', qty: 1, unitCost: 699, unitPrice: 873.75, unit: 'ea', type: 'material' },
          { desc: 'Water Heater Expansion Tank', qty: 1, unitCost: 29.88, unitPrice: 37.35, unit: 'ea', type: 'material' },
          { desc: 'Water heater - 40 gal, tall, natural gas Install Labor', qty: 3, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '50 gal Natural Gas', priceRange: '~$999 + labor', lines: [
          { desc: 'Water heater - 50 gal, tall, natural gas', qty: 1, unitCost: 799, unitPrice: 998.75, unit: 'ea', type: 'material' },
          { desc: 'Water Heater Expansion Tank', qty: 1, unitCost: 29.88, unitPrice: 37.35, unit: 'ea', type: 'material' },
          { desc: 'Water heater - 50 gal, tall, natural gas Install Labor', qty: 3, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '1000 Electrical': [
    {
      name: 'Ceiling Fan Install',
      icon: '🌀',
      desc: 'Fan install at existing junction box',
      tiers: {
        low: { label: '42" Littleton White', priceRange: '~$56', lines: [
          { desc: 'Littleton 42 in. LED Indoor White Ceiling Fan with Light Kit', qty: 1, unitCost: 44.97, unitPrice: 56.21, unit: 'ea', type: 'material' },
          { desc: 'Ceiling fan install Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '44" Hampton Bay Bronze', priceRange: '~$94', lines: [
          { desc: 'Hampton Bay Wellston II 44 in. Indoor LED Bronze Dry Rated Downrod Ceiling Fan with Light', qty: 1, unitCost: 74.97, unitPrice: 93.71, unit: 'ea', type: 'material' },
          { desc: 'Ceiling fan install Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '52" Hampton Bay Menage', priceRange: '~$136', lines: [
          { desc: 'Hampton Bay Menage 52 in. Integrated LED Indoor Low Profile Oil Rubbed Bronze Ceiling Fan', qty: 1, unitCost: 109, unitPrice: 136.25, unit: 'ea', type: 'material' },
          { desc: 'Ceiling fan install Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Flush Mount Light',
      icon: '💡',
      desc: 'Swap flush mount light at existing box',
      tiers: {
        low: { label: '11" Brushed Nickel', priceRange: '~$28', lines: [
          { desc: '11 in. 1-Light Brushed Nickel Flush Mount with Frosted Glass', qty: 1, unitCost: 22.47, unitPrice: 28.09, unit: 'ea', type: 'material' },
          { desc: 'Flush mount light install labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '15" Mid-Grade', priceRange: '~$47', lines: [
          { desc: '11 in. 1-Light Brushed Nickel Flush Mount with Frosted Glass', qty: 1, unitCost: 37.98, unitPrice: 47.47, unit: 'ea', type: 'material' },
          { desc: 'Flush mount light install labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Sconce/Premium', priceRange: '~$57+', lines: [
          { desc: '1-Light Oil Rubbed Bronze Sconce with Tea Stained Glass Shade', qty: 1, unitCost: 25.97, unitPrice: 32.46, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Sconce', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Vanity Light Replace',
      icon: '🪞',
      desc: 'Bathroom vanity bar light swap',
      tiers: {
        low: { label: '3-Light Raceway BN', priceRange: '~$19', lines: [
          { desc: 'Hampton Bay 18 in. Raceway 3-Light Brushed Nickel Retro Bathroom Vanity Light', qty: 1, unitCost: 14.97, unitPrice: 18.71, unit: 'ea', type: 'material' },
          { desc: 'Flush mount light install labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '3-Light Oil Rubbed Bronze', priceRange: '~$100', lines: [
          { desc: 'Hampton Bay 3-Light 21 in. Oil-Rubbed Bronze Contemporary Bathroom Vanity Light', qty: 1, unitCost: 79.97, unitPrice: 99.96, unit: 'ea', type: 'material' },
          { desc: 'Flush mount light install labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '3-Light Regan BN', priceRange: '~$112', lines: [
          { desc: 'Hampton Bay Regan 21 in. 3-Light Brushed Nickel Bathroom Vanity Light', qty: 1, unitCost: 89.97, unitPrice: 112.46, unit: 'ea', type: 'material' },
          { desc: 'Flush mount light install labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'GFCI Outlet Install',
      icon: '🔌',
      desc: 'GFCI outlet install at existing box with wall plate',
      tiers: {
        low: { label: '1 Outlet', priceRange: '1 location', lines: [
          { desc: '15 Amp Self-Test SmartlockPro Slim Duplex GFCI Outlet, White', qty: 1, unitCost: 13.98, unitPrice: 17.48, unit: 'ea', type: 'material' },
          { desc: '1-Gang Duplex Outlet Wall Plate, White', qty: 1, unitCost: 0.48, unitPrice: 0.60, unit: 'ea', type: 'material' },
          { desc: 'GFCI Install Labor', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install wall plate', qty: 1, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '2 Outlets', priceRange: '2 locations', lines: [
          { desc: '15 Amp Self-Test SmartlockPro Slim Duplex GFCI Outlet, White', qty: 2, unitCost: 13.98, unitPrice: 17.48, unit: 'ea', type: 'material' },
          { desc: '1-Gang Duplex Outlet Wall Plate, White', qty: 2, unitCost: 0.48, unitPrice: 0.60, unit: 'ea', type: 'material' },
          { desc: 'GFCI Install Labor', qty: 2, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install wall plate', qty: 2, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '4 Outlets', priceRange: '4 locations', lines: [
          { desc: '15 Amp Self-Test SmartlockPro Slim Duplex GFCI Outlet, White', qty: 4, unitCost: 13.98, unitPrice: 17.48, unit: 'ea', type: 'material' },
          { desc: '1-Gang Duplex Outlet Wall Plate, White', qty: 4, unitCost: 0.48, unitPrice: 0.60, unit: 'ea', type: 'material' },
          { desc: 'GFCI Install Labor', qty: 4, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install wall plate', qty: 4, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Light Switch Install',
      icon: '🔆',
      desc: 'Toggle switch replacement with wall plate',
      tiers: {
        low: { label: '1 Switch', priceRange: '1 location', lines: [
          { desc: '15 Amp Single-Pole Toggle Light Switch, White', qty: 1, unitCost: 0.85, unitPrice: 1.06, unit: 'ea', type: 'material' },
          { desc: '1-Gang Midway Toggle Nylon Wall Plate, White', qty: 1, unitCost: 0.58, unitPrice: 0.73, unit: 'ea', type: 'material' },
          { desc: 'Labor to install switch', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install switch wall plate', qty: 1, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '3 Switches', priceRange: '3 locations', lines: [
          { desc: '15 Amp Single-Pole Toggle Light Switch, White', qty: 3, unitCost: 0.85, unitPrice: 1.06, unit: 'ea', type: 'material' },
          { desc: '1-Gang Midway Toggle Nylon Wall Plate, White', qty: 3, unitCost: 0.58, unitPrice: 0.73, unit: 'ea', type: 'material' },
          { desc: 'Labor to install switch', qty: 3, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install switch wall plate', qty: 3, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '6 Switches', priceRange: '6 locations', lines: [
          { desc: '15 Amp Single-Pole Toggle Light Switch, White', qty: 6, unitCost: 0.85, unitPrice: 1.06, unit: 'ea', type: 'material' },
          { desc: '1-Gang Midway Toggle Nylon Wall Plate, White', qty: 6, unitCost: 0.58, unitPrice: 0.73, unit: 'ea', type: 'material' },
          { desc: 'Labor to install switch', qty: 6, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install switch wall plate', qty: 6, unitCost: 5, unitPrice: 5.75, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '1700 Flooring': [
    {
      name: 'LVP Flooring Install',
      icon: '🪵',
      desc: 'Luxury vinyl plank install per room, includes transition strip',
      tiers: {
        low: { label: 'LVP Aspen 4.5mm/12mil', priceRange: '$2.36/sqft material', lines: [
          { desc: 'LVP: Aspen, 7"x48"x4.5mm/12mil', qty: 200, unitCost: 1.89, unitPrice: 2.36, unit: 'sqft', type: 'material' },
          { desc: 'LVP Flooring Labor', qty: 200, unitCost: 5, unitPrice: 5.75, unit: 'sqft', type: 'labor' },
          { desc: 'CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Transition Strip', qty: 1, unitCost: 63, unitPrice: 78.75, unit: 'ea', type: 'material' },
          { desc: 'Transition Strip Labor', qty: 1, unitCost: 35, unitPrice: 40.25, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'LVP Ash Gray 5mm/20mil', priceRange: '$2.61/sqft material', lines: [
          { desc: 'LVP: Ash Gray, 7"x48"x5mm/20mil', qty: 200, unitCost: 2.09, unitPrice: 2.61, unit: 'sqft', type: 'material' },
          { desc: 'LVP Flooring Labor', qty: 200, unitCost: 5, unitPrice: 5.75, unit: 'sqft', type: 'labor' },
          { desc: 'CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Transition Strip', qty: 1, unitCost: 63, unitPrice: 78.75, unit: 'ea', type: 'material' },
          { desc: 'Transition Strip Labor', qty: 1, unitCost: 35, unitPrice: 40.25, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'LVP Ash Gray 6.5mm/24mil', priceRange: '$2.99/sqft material', lines: [
          { desc: 'LVP: Ash Gray, 7"x48"x6.5mm/24mil', qty: 200, unitCost: 2.39, unitPrice: 2.99, unit: 'sqft', type: 'material' },
          { desc: 'LVP Flooring Labor', qty: 200, unitCost: 5, unitPrice: 5.75, unit: 'sqft', type: 'labor' },
          { desc: 'CAP A TREAD Burnt Oak 47 in. L x 12.15 in. W x 1.69 in. T Vinyl Transition Strip', qty: 2, unitCost: 63, unitPrice: 78.75, unit: 'ea', type: 'material' },
          { desc: 'Transition Strip Labor', qty: 2, unitCost: 35, unitPrice: 40.25, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Carpet Remove & Replace',
      icon: '🏠',
      desc: 'Pull existing carpet, install new',
      tiers: {
        low: { label: 'Carpet Removal Only', priceRange: 'Labor per hour', lines: [
          { desc: 'Carpet removal', qty: 4, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Remove + Replace', priceRange: '$4.43/sqft installed', lines: [
          { desc: 'Carpet removal', qty: 2, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
          { desc: 'Carpet replacement (sqft)', qty: 200, unitCost: 3.54, unitPrice: 4.43, unit: 'sqft', type: 'material' },
        ]},
        high: { label: 'Devon Oak LVP Alternative', priceRange: '$3.14/sqft + labor', lines: [
          { desc: 'Devon Oak 6 in. x 36 in. Rigid Core Luxury Vinyl Plank Flooring', qty: 200, unitCost: 1.99, unitPrice: 3.14, unit: 'sqft', type: 'material' },
          { desc: 'LVP Flooring Labor', qty: 200, unitCost: 5, unitPrice: 5.75, unit: 'sqft', type: 'labor' },
        ]},
      }
    },
  ],
  '2300 Painting': [
    {
      name: 'Paint Room',
      icon: '🎨',
      desc: '2 coats walls + ceiling, includes labor and materials',
      tiers: {
        low: { label: '1 Coat per sqft', priceRange: '$3.45/sqft labor', lines: [
          { desc: 'Mud/Tape per sqft', qty: 400, unitCost: 0.05, unitPrice: 0.06, unit: 'sqft', type: 'material' },
          { desc: 'Paint Labor for 1 coat per sq ft', qty: 400, unitCost: 3.00, unitPrice: 3.45, unit: 'sqft', type: 'labor' },
          { desc: 'Patch wall/holes', qty: 1, unitCost: 9.48, unitPrice: 11.85, unit: 'ea', type: 'material' },
          { desc: '9 in. x 3/8 in. High-Density Polyester Knit Paint Roller Cover', qty: 1, unitCost: 8.48, unitPrice: 10.60, unit: 'ea', type: 'material' },
          { desc: '3M ScotchBlue 1.88 in. x 60 yds. Original Multi-Surface Painter\'s Tape', qty: 1, unitCost: 39.48, unitPrice: 49.35, unit: 'ea', type: 'material' },
        ]},
        med: { label: '2 Coats per sqft', priceRange: '$4.07/sqft labor', lines: [
          { desc: 'Mud/Tape per sqft', qty: 400, unitCost: 0.05, unitPrice: 0.06, unit: 'sqft', type: 'material' },
          { desc: 'Paint/sqft - 1 coat', qty: 400, unitCost: 0.10, unitPrice: 0.46, unit: 'sqft', type: 'material' },
          { desc: 'Paint Labor for 2 coat per sq ft', qty: 400, unitCost: 3.00, unitPrice: 4.07, unit: 'sqft', type: 'labor' },
          { desc: 'Patch wall/holes', qty: 2, unitCost: 9.48, unitPrice: 11.85, unit: 'ea', type: 'material' },
          { desc: '9 in. x 3/8 in. High-Density Polyester Knit Paint Roller Cover', qty: 2, unitCost: 8.48, unitPrice: 10.60, unit: 'ea', type: 'material' },
          { desc: '3M ScotchBlue 1.88 in. x 60 yds. Original Multi-Surface Painter\'s Tape', qty: 1, unitCost: 39.48, unitPrice: 49.35, unit: 'ea', type: 'material' },
        ]},
        high: { label: 'Full Room with Caulk', priceRange: '2 coats + caulk finish', lines: [
          { desc: 'Mud/Tape per sqft', qty: 800, unitCost: 0.05, unitPrice: 0.06, unit: 'sqft', type: 'material' },
          { desc: 'Paint/sqft - 1 coat', qty: 800, unitCost: 0.10, unitPrice: 0.46, unit: 'sqft', type: 'material' },
          { desc: 'Paint Labor for 2 coat per sq ft', qty: 800, unitCost: 3.00, unitPrice: 4.07, unit: 'sqft', type: 'labor' },
          { desc: 'Patch wall/holes', qty: 3, unitCost: 9.48, unitPrice: 11.85, unit: 'ea', type: 'material' },
          { desc: 'GE Advanced Silicone 2 10.1 oz. White Kitchen and Bath Silicone', qty: 2, unitCost: 10.98, unitPrice: 13.73, unit: 'ea', type: 'material' },
          { desc: 'Caulk Labor', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: '9 in. x 3/8 in. High-Density Polyester Knit Paint Roller Cover', qty: 2, unitCost: 8.48, unitPrice: 10.60, unit: 'ea', type: 'material' },
          { desc: '3M ScotchBlue 1.88 in. x 60 yds. Original Multi-Surface Painter\'s Tape', qty: 2, unitCost: 39.48, unitPrice: 49.35, unit: 'ea', type: 'material' },
        ]},
      }
    },
    {
      name: 'Paint Exterior Door',
      icon: '🚪',
      desc: 'Interior and exterior of doors, includes prep',
      tiers: {
        low: { label: '1 Door', priceRange: '1 door', lines: [
          { desc: 'Paint Exterior Door (Inside & Out)', qty: 1, unitCost: 2.80, unitPrice: 3.50, unit: 'ea', type: 'material' },
          { desc: 'Caulk Labor', qty: 0.5, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '2 Doors', priceRange: '2 doors', lines: [
          { desc: 'Paint Exterior Door (Inside & Out)', qty: 2, unitCost: 2.80, unitPrice: 3.50, unit: 'ea', type: 'material' },
          { desc: 'Caulk Labor', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '4 Doors', priceRange: '4 doors', lines: [
          { desc: 'Paint Exterior Door (Inside & Out)', qty: 4, unitCost: 2.80, unitPrice: 3.50, unit: 'ea', type: 'material' },
          { desc: 'Caulk Labor', qty: 2, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '1900 Cabinetry': [
    {
      name: 'Bathroom Vanity Install',
      icon: '🪞',
      desc: 'Vanity with top, mirror, and install labor',
      tiers: {
        low: { label: '24.5" Glacier Bay Freestanding', priceRange: '~$186', lines: [
          { desc: 'Glacier Bay 24.5 in. W x 18.6 in. D x 35.4 in. H Freestanding Bath Vanity in White', qty: 1, unitCost: 149, unitPrice: 186.25, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror', qty: 1, unitCost: 49.97, unitPrice: 62.46, unit: 'ea', type: 'material' },
          { desc: 'Labor for vanity install', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '31" Vanity with Cultured Marble Top', priceRange: '~$249', lines: [
          { desc: '31 in. W Vanity in White with Cultured Marble Vanity Top in White by Glacier Bay', qty: 1, unitCost: 199, unitPrice: 248.75, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror', qty: 1, unitCost: 49.97, unitPrice: 62.46, unit: 'ea', type: 'material' },
          { desc: 'Labor for vanity install', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '30" Bannister Freestanding', priceRange: '~$424', lines: [
          { desc: 'Glacier Bay Bannister 30 in. W x 19 in. D x 35 in. H single Sink Freestanding Bath Vanity', qty: 1, unitCost: 339, unitPrice: 423.75, unit: 'ea', type: 'material' },
          { desc: 'Glacier Bay 30 in. W x 36 in. H Frameless Rectangular Beveled Edge Bathroom Vanity Mirror', qty: 1, unitCost: 49.97, unitPrice: 62.46, unit: 'ea', type: 'material' },
          { desc: 'Labor for vanity install', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '2000 Countertops': [
    {
      name: 'Countertop Install',
      icon: '🪨',
      desc: 'Kitchen or bath countertop supply and install',
      tiers: {
        low: { label: 'Wilsonart 6ft Laminate', priceRange: '~$174', lines: [
          { desc: 'Hampton Bay Wilsonart 6 ft. Straight Laminate Countertop in White Ice', qty: 1, unitCost: 139, unitPrice: 173.75, unit: 'ea', type: 'material' },
          { desc: 'Hampton Bay 4-5/8 in. x 25-5/8 in. Laminate Endcap Kit', qty: 1, unitCost: 27.98, unitPrice: 34.98, unit: 'ea', type: 'material' },
          { desc: 'Laminate End Cap Kit Labor', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
          { desc: 'Countertop Install Labor', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Hampton Bay 4ft Gray Laminate Kit', priceRange: '~$202', lines: [
          { desc: 'Hampton Bay 4 ft. Gray Laminate Countertop Kit with Eased Edge', qty: 1, unitCost: 161.85, unitPrice: 202.31, unit: 'ea', type: 'material' },
          { desc: 'Countertop Install Labor', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Stone per sqft', priceRange: '$68.75/sqft', lines: [
          { desc: 'Stone Countertop install per sqft', qty: 25, unitCost: 55, unitPrice: 68.75, unit: 'sqft', type: 'material' },
          { desc: 'Countertop Install Labor', qty: 2, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '1400 Drywall': [
    {
      name: 'Drywall Patch',
      icon: '🧱',
      desc: 'Hole or section repair, tape, mud, sand, prime',
      tiers: {
        low: { label: 'Small Patch (per sqft)', priceRange: '$1.18/sqft material', lines: [
          { desc: '1/2" Drywall install per sqft', qty: 8, unitCost: 0.94, unitPrice: 1.18, unit: 'sqft', type: 'material' },
          { desc: '4.5 gal. Plus 3 Ready-Mixed Joint Compound', qty: 1, unitCost: 21.78, unitPrice: 27.23, unit: 'ea', type: 'material' },
          { desc: 'Drywall Labor/ Sq Ft', qty: 8, unitCost: 6.50, unitPrice: 7.48, unit: 'sqft', type: 'labor' },
        ]},
        med: { label: '1/2 Sheet', priceRange: '~$20 material + labor', lines: [
          { desc: '1/2" Drywall install per sqft', qty: 32, unitCost: 0.94, unitPrice: 1.18, unit: 'sqft', type: 'material' },
          { desc: '4.5 gal. Plus 3 Ready-Mixed Joint Compound', qty: 1, unitCost: 21.78, unitPrice: 27.23, unit: 'ea', type: 'material' },
          { desc: 'Wall/door patch: 4.5 Gal. Plus 3 Lightweight All-Purpose Pre-Mixed Joint Compound', qty: 1, unitCost: 0.88, unitPrice: 1.10, unit: 'ea', type: 'material' },
          { desc: 'Drywall Labor/ Sq Ft', qty: 32, unitCost: 6.50, unitPrice: 7.48, unit: 'sqft', type: 'labor' },
        ]},
        high: { label: 'Full Sheet 4x8', priceRange: '$19.93/sheet + labor', lines: [
          { desc: '1/2 in. x 4 ft. x 8 ft. UltraLight Drywall', qty: 1, unitCost: 15.94, unitPrice: 19.93, unit: 'ea', type: 'material' },
          { desc: '4.5 gal. Plus 3 Ready-Mixed Joint Compound', qty: 1, unitCost: 21.78, unitPrice: 27.23, unit: 'ea', type: 'material' },
          { desc: 'Drywall Labor/ Sq Ft', qty: 64, unitCost: 6.50, unitPrice: 7.48, unit: 'sqft', type: 'labor' },
        ]},
      }
    },
  ],
  '2400 Appliances': [
    {
      name: 'Range / Stove Install',
      icon: '🍳',
      desc: 'Freestanding range install, disconnect old unit',
      tiers: {
        low: { label: 'Electric Standard', priceRange: '~$625', lines: [
          { desc: 'GE ENERGY STAR 30 In. 5.0 Cu. Ft. Coil Electric Freestanding Range in White', qty: 1, unitCost: 759, unitPrice: 948.75, unit: 'ea', type: 'material' },
          { desc: 'Anti-Tip Bracket by Frigidaire', qty: 1, unitCost: 10.96, unitPrice: 13.70, unit: 'ea', type: 'material' },
          { desc: 'Range - Electric Install Labor', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Over Range Microwave', priceRange: 'OTR Microwave ~$249', lines: [
          { desc: '1.6 cu. ft. Over the Range Microwave in White', qty: 1, unitCost: 199, unitPrice: 248.75, unit: 'ea', type: 'material' },
          { desc: 'Over the Range Microwave Install', qty: 1, unitCost: 200, unitPrice: 230, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Dishwasher', priceRange: 'Dishwasher ~$625', lines: [
          { desc: 'Dishwasher - 24"', qty: 1, unitCost: 500, unitPrice: 625, unit: 'ea', type: 'material' },
          { desc: 'Dishwasher Install', qty: 1, unitCost: 300, unitPrice: 345, unit: 'hr', type: 'labor' },
          { desc: 'Appliance Disposal', qty: 1, unitCost: 10, unitPrice: 12.50, unit: 'ea', type: 'other' },
        ]},
      }
    },
  ],
  '1500 Doors & Windows': [
    {
      name: 'Interior Door Replace',
      icon: '🚪',
      desc: 'Interior door install, remove old, install new with hardware',
      tiers: {
        low: { label: '30" Hollow Core Slab', priceRange: '~$42', lines: [
          { desc: '30 in. x 80 in. Unfinished Flush Hardwood Interior Door Slab', qty: 1, unitCost: 33.86, unitPrice: 42.33, unit: 'ea', type: 'material' },
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob', qty: 1, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Passage Knob', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install pre hung interior door', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '30" Steves 6-Panel Primed', priceRange: '~$75', lines: [
          { desc: 'Steves & Sons 30 in. x 80 in. 6-Panel Textured Hollow Core White Primed Interior Door Slab', qty: 1, unitCost: 60, unitPrice: 75, unit: 'ea', type: 'material' },
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob', qty: 1, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Passage Knob', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install pre hung interior door', qty: 1, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '32" Right-Hand Pre-Hung', priceRange: '~$158', lines: [
          { desc: 'Steves & Sons 32 in. x 80 in. Right-Handed 6-Panel Textured Hollow Core Pre-Hung', qty: 1, unitCost: 126, unitPrice: 157.50, unit: 'ea', type: 'material' },
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob', qty: 1, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Passage Knob', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
          { desc: 'Labor to install pre hung interior door', qty: 1.5, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Deadbolt Install',
      icon: '🔐',
      desc: 'Deadbolt replacement on exterior door',
      tiers: {
        low: { label: '1 Door', priceRange: '1 deadbolt', lines: [
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security', qty: 1, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Deadbolt', qty: 1, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '2 Doors', priceRange: '2 deadbolts', lines: [
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security', qty: 2, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Deadbolt', qty: 2, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '3 Doors', priceRange: '3 deadbolts', lines: [
          { desc: 'Kwikset Tylo Satin Chrome Keyed Entry Door Knob Featuring SmartKey Security', qty: 3, unitCost: 25.45, unitPrice: 31.81, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Deadbolt', qty: 3, unitCost: 25, unitPrice: 28.75, unit: 'hr', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Mini Blind Install',
      icon: '🪟',
      desc: 'Window blind install per window',
      tiers: {
        low: { label: '1 Window', priceRange: '1 blind', lines: [
          { desc: 'Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door', qty: 1, unitCost: 26.48, unitPrice: 33.10, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Mini Blinds', qty: 1, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        med: { label: '3 Windows', priceRange: '3 blinds', lines: [
          { desc: 'Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door', qty: 3, unitCost: 26.48, unitPrice: 33.10, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Mini Blinds', qty: 3, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
        high: { label: '6 Windows', priceRange: '6 blinds', lines: [
          { desc: 'Hampton Bay White Cordless Room Darkening 1 in. Vinyl Mini Blind for Window or Door', qty: 6, unitCost: 26.48, unitPrice: 33.10, unit: 'ea', type: 'material' },
          { desc: 'Labor to install Mini Blinds', qty: 6, unitCost: 50, unitPrice: 57.50, unit: 'hr', type: 'labor' },
        ]},
      }
    },
  ],
  '2100 Trimwork': [
    {
      name: 'Baseboard Install',
      icon: '📏',
      desc: 'Baseboard trim install per linear foot',
      tiers: {
        low: { label: '50 Linear Ft', priceRange: '~1 room', lines: [
          { desc: 'CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Joint Base Moulding', qty: 50, unitCost: 0.99, unitPrice: 1.24, unit: 'lf', type: 'material' },
          { desc: 'Labor to Install Baseboards per linear ft', qty: 50, unitCost: 3.30, unitPrice: 3.80, unit: 'lf', type: 'labor' },
        ]},
        med: { label: '100 Linear Ft', priceRange: '~2-3 rooms', lines: [
          { desc: 'CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Joint Base Moulding', qty: 100, unitCost: 0.99, unitPrice: 1.24, unit: 'lf', type: 'material' },
          { desc: 'Labor to Install Baseboards per linear ft', qty: 100, unitCost: 3.30, unitPrice: 3.80, unit: 'lf', type: 'labor' },
        ]},
        high: { label: '200 Linear Ft', priceRange: 'Whole floor', lines: [
          { desc: 'CMPC WM 356 11/16 in. x 2 1/4 in. x 168 in. Pine Primed Finger-Joint Base Moulding', qty: 200, unitCost: 0.99, unitPrice: 1.24, unit: 'lf', type: 'material' },
          { desc: 'Labor to Install Baseboards per linear ft', qty: 200, unitCost: 3.30, unitPrice: 3.80, unit: 'lf', type: 'labor' },
        ]},
      }
    },
    {
      name: 'Quarter Round Install',
      icon: '📐',
      desc: 'Quarter round paint and install per linear foot',
      tiers: {
        low: { label: '50 Linear Ft', priceRange: '~1 room', lines: [
          { desc: 'Quarter round (paint & install) per linear foot', qty: 50, unitCost: 8, unitPrice: 9.20, unit: 'lf', type: 'labor' },
        ]},
        med: { label: '100 Linear Ft', priceRange: '~2-3 rooms', lines: [
          { desc: 'Quarter round (paint & install) per linear foot', qty: 100, unitCost: 8, unitPrice: 9.20, unit: 'lf', type: 'labor' },
        ]},
        high: { label: '200 Linear Ft', priceRange: 'Whole floor', lines: [
          { desc: 'Quarter round (paint & install) per linear foot', qty: 200, unitCost: 8, unitPrice: 9.20, unit: 'lf', type: 'labor' },
        ]},
      }
    },
  ],
  '0200 Demolition': [
    {
      name: 'Demo / Trash Out',
      icon: '🗑',
      desc: 'Demo labor and debris removal',
      tiers: {
        low: { label: 'Half Day 1-Man', priceRange: '4 hrs', lines: [
          { desc: 'Trash removal per hour', qty: 4, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        med: { label: 'Full Day 1-Man', priceRange: '8 hrs', lines: [
          { desc: 'Trash removal per hour', qty: 8, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
        ]},
        high: { label: 'Full Day + Dumpster', priceRange: '8 hrs + dumpster', lines: [
          { desc: 'Trash removal per hour', qty: 8, unitCost: 100, unitPrice: 115, unit: 'hr', type: 'labor' },
          { desc: 'Dumpster Rental', qty: 1, unitCost: 500, unitPrice: 625, unit: 'ea', type: 'other' },
        ]},
      }
    },
  ],
};

const ROOM_STRUCTURE = {
  "Interior": {
    icon: "🏠",
    rooms: {
      "Bathroom": { icon:"🚿", trades:["1100 Plumbing","1000 Electrical","1800 Tiling","1700 Flooring","1400 Drywall","2100 Trimwork","2300 Painting","2200 Specialty Finishes"] },
      "Kitchen": { icon:"🍳", trades:["1900 Cabinetry","2000 Countertops","1100 Plumbing","1000 Electrical","1700 Flooring","1800 Tiling","2400 Appliances","2300 Painting","1400 Drywall"] },
      "Bedroom": { icon:"🛏", trades:["1700 Flooring","2300 Painting","1000 Electrical","1400 Drywall","2100 Trimwork","1500 Doors & Windows"] },
      "Living Room": { icon:"🛋", trades:["1700 Flooring","2300 Painting","1000 Electrical","1400 Drywall","2100 Trimwork","1500 Doors & Windows","2200 Specialty Finishes"] },
      "Basement": { icon:"⬇️", trades:["1700 Flooring","2300 Painting","1000 Electrical","1400 Drywall","1100 Plumbing","1200 Mechanical"] },
      "Laundry Room": { icon:"🧺", trades:["1100 Plumbing","1000 Electrical","1700 Flooring","2400 Appliances","1400 Drywall"] },
      "Hallway / Stairs": { icon:"🪜", trades:["1700 Flooring","2300 Painting","2100 Trimwork","1500 Doors & Windows","1000 Electrical"] },
      "Dining Room": { icon:"🍽", trades:["1700 Flooring","2300 Painting","1000 Electrical","2100 Trimwork"] },
      "Whole Interior": { icon:"🏡", trades:["0200 Demolition","1400 Drywall","2300 Painting","1700 Flooring","1000 Electrical","1100 Plumbing"] }
    }
  },
  "Exterior": {
    icon: "🏗",
    rooms: {
      "Deck / Porch": { icon:"🪵", trades:["2500 Decking","0600 Framing","1000 Electrical","2300 Painting"] },
      "Roof": { icon:"🏚", trades:["0900 Roofing"] },
      "Siding": { icon:"🧱", trades:["0800 Siding","2300 Painting"] },
      "Windows & Doors": { icon:"🪟", trades:["1500 Doors & Windows"] },
      "Foundation": { icon:"🏛", trades:["0500 Foundation","2800 Concrete"] },
      "Fencing": { icon:"🚧", trades:["2600 Fencing"] },
      "Landscaping": { icon:"🌳", trades:["2900 Landscaping","2800 Concrete"] },
      "Garage (Exterior)": { icon:"🚗", trades:["1600 Garage","0800 Siding","0900 Roofing"] },
      "Whole Exterior": { icon:"🏠", trades:["0800 Siding","0900 Roofing","2500 Decking","1500 Doors & Windows","2300 Painting"] }
    }
  },
  "Mechanical / Systems": {
    icon: "⚙️",
    rooms: {
      "HVAC": { icon:"❄️", trades:["1200 Mechanical"] },
      "Electrical": { icon:"⚡", trades:["1000 Electrical"] },
      "Plumbing": { icon:"🔧", trades:["1100 Plumbing"] },
      "Insulation": { icon:"🧊", trades:["1300 Insulation"] },
      "Framing / Structural": { icon:"🏗", trades:["0600 Framing"] }
    }
  },
  "Demo / Cleanup": {
    icon: "🗑",
    rooms: {
      "Demo / Trash Out": { icon:"🗑", trades:["0200 Demolition","0000 Uncategorized"] },
      "Miscellaneous": { icon:"📦", trades:["3100 Miscellaneous"] }
    }
  }
};

let _wizardStep = 1;
let _wizardCategory = null;
let _wizardRoom = null;
let _wizardTrade = null;
let _wizardSelectedItems = new Set();
let _wizardCurrentItems = [];

function openSmartAdd() {
  if (!estGroups.length) {
    // Auto-create a group if none exists
    const name = 'General';
    if (!conDb || !conCurrentJobId) return;
    coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
      name, order:0, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(ref => {
      estGroups.push({ id: ref.id, name, order:0, subgroups:[], directItems:[] });
      _launchSmartAdd();
    }).catch(e => alert('Error: ' + e.message));
  } else {
    _launchSmartAdd();
  }
}

function _launchSmartAdd() {
  _wizardStep = 1;
  _wizardCategory = null;
  _wizardRoom = null;
  _wizardTrade = null;
  _wizardSelectedItems = new Set();
  wizardRenderStep1();
  kOpen('smartAddModal');
}

function wizardRenderStep1() {
  _wizardStep = 1;
  const grid = document.getElementById('wizardCategoryGrid');
  if (!grid) return;

  grid.innerHTML = Object.entries(ROOM_STRUCTURE).map(([cat, data]) => {
    const roomCount = Object.keys(data.rooms).length;
    return `<div class="wizard-card" onclick="wizardSelectCategory('${cat}')">
      <div class="wc-icon">${data.icon}</div>
      <div class="wc-name">${cat}</div>
      <div class="wc-count">${roomCount} areas</div>
    </div>`;
  }).join('');

  wizardSetStep(1);
  updateWizardBreadcrumb();
}

function wizardSelectCategory(cat) {
  _wizardCategory = cat;
  _wizardStep = 2;
  const rooms = ROOM_STRUCTURE[cat]?.rooms || {};
  const grid = document.getElementById('wizardRoomGrid');
  if (!grid) return;

  grid.innerHTML = Object.entries(rooms).map(([room, data]) => {
    const tradeCount = data.trades.length;
    return `<div class="wizard-card" onclick="wizardSelectRoom('${room.replace(/'/g,"\'")}')">
      <div class="wc-icon">${data.icon}</div>
      <div class="wc-name">${room}</div>
      <div class="wc-count">${tradeCount} trade${tradeCount!==1?'s':''}</div>
    </div>`;
  }).join('');

  wizardSetStep(2);
  updateWizardBreadcrumb();
}

function wizardSelectRoom(room) {
  _wizardRoom = room;
  _wizardStep = 3;
  const trades = ROOM_STRUCTURE[_wizardCategory]?.rooms[room]?.trades || [];
  const grid = document.getElementById('wizardTradeGrid');
  if (!grid) return;

  const tradeNames = {
    '0000 Uncategorized':'Misc','0200 Demolition':'Demo','0600 Framing':'Framing',
    '0800 Siding':'Siding','0900 Roofing':'Roofing','1000 Electrical':'Electrical',
    '1100 Plumbing':'Plumbing','1200 Mechanical':'HVAC','1300 Insulation':'Insulation',
    '1400 Drywall':'Drywall','1500 Doors & Windows':'Doors/Windows','1600 Garage':'Garage',
    '1700 Flooring':'Flooring','1800 Tiling':'Tiling','1900 Cabinetry':'Cabinetry',
    '2000 Countertops':'Countertops','2100 Trimwork':'Trimwork','2200 Specialty Finishes':'Finishes',
    '2300 Painting':'Painting','2400 Appliances':'Appliances','2500 Decking':'Decking',
    '2600 Fencing':'Fencing','2800 Concrete':'Concrete','2900 Landscaping':'Landscape',
    '3100 Miscellaneous':'Misc'
  };

  const tradeIcons = {
    'Electrical':'⚡','Plumbing':'🔧','HVAC':'❄️','Flooring':'🪵','Tiling':'🔲',
    'Painting':'🎨','Cabinetry':'🗄','Appliances':'🍳','Decking':'🪵','Roofing':'🏚',
    'Siding':'🧱','Drywall':'🧱','Insulation':'🧊','Framing':'🏗','Doors/Windows':'🪟',
    'Countertops':'🪨','Trimwork':'📏','Finishes':'✨','Demo':'🗑','Misc':'📦',
    'Concrete':'🏛','Landscape':'🌳','Fencing':'🚧','Garage':'🚗'
  };

  grid.innerHTML = trades.map(trade => {
    const name = tradeNames[trade] || trade;
    const icon = tradeIcons[name] || '🔨';
    const items = CATALOG_DATA[trade] || [];
    return `<div class="wizard-trade-btn" onclick="wizardSelectTrade('${trade.replace(/'/g,"\'")}')">
      ${icon} ${name}<div style="font-size:.68rem;color:var(--muted);font-weight:400;margin-top:2px">${items.length} items</div>
    </div>`;
  }).join('');

  wizardSetStep(3);
  updateWizardBreadcrumb();
}

function wizardSelectTrade(trade) {
  _wizardTrade = trade;
  _wizardStep = 4;
  _wizardSelectedItems = new Set();
  _wizardCurrentItems = CATALOG_DATA[trade] || [];

  // Check if this trade has tiered bundles
  const bundles = TIERED_BUNDLES[trade] || [];

  if (bundles.length > 0) {
    // Step 4: Show bundle tasks for this trade
    wizardRenderBundleTasks(trade, bundles);
  } else {
    // No bundles — fall through to catalog items with template tab
    wizardSetStep(4);
    updateWizardBreadcrumb();
    document.getElementById('wizardSearchInput').value = '';

    const itemListEl = document.getElementById('wizardItemList');
    if (itemListEl) {
      itemListEl.innerHTML =
        '<div style="display:flex;gap:0;background:rgba(8,18,36,.8);border:1px solid rgba(110,145,210,.15);border-radius:10px;overflow:hidden;margin-bottom:12px">' +
        '<button id="wizTabTemplates" onclick="wizShowTab(\'templates\')" style="flex:1;padding:8px;border:none;cursor:pointer;font-size:.8rem;font-weight:700;background:linear-gradient(135deg,var(--amber),var(--amber2));color:#fff">⚡ Templates</button>' +
        '<button id="wizTabItems" onclick="wizShowTab(\'items\')" style="flex:1;padding:8px;border:none;cursor:pointer;font-size:.8rem;font-weight:600;background:transparent;color:var(--muted)">📦 Catalog Items</button>' +
        '</div><div id="wizPanelTemplates"></div><div id="wizPanelItems" style="display:none"></div>';
    }
    wizLoadTemplates(trade);

    const itemsPanel = document.getElementById('wizPanelItems');
    if (itemsPanel) {
      itemsPanel.innerHTML = _wizardCurrentItems.length ? _wizardCurrentItems.map(item => {
        const matPrice = item.materials?.unitPrice || 0;
        const labPrice = item.labor?.unitPrice || 0;
        const totalPrice = matPrice + labPrice;
        return '<div class="wizard-item" onclick="wizardToggleItem(\'' + item.name.replace(/'/g,"\\'") + '\',this)">' +
          '<div class="wizard-item-check"></div>' +
          '<div class="wizard-item-info"><div class="wizard-item-name">' + esc(item.name) + '</div>' +
          '<div class="wizard-item-meta">' + (item.materials ? '📦 Mat: $' + matPrice.toFixed(2) : '') + (item.labor ? ' · 👷 Labor: $' + labPrice.toFixed(2) + '/hr' : '') + '</div></div>' +
          '<div class="wizard-item-price">' + (totalPrice > 0 ? '$' + totalPrice.toFixed(2) : '') + '</div></div>';
      }).join('') : '<div class="small muted" style="text-align:center;padding:20px">No items for this trade</div>';
    }

    const footer = document.getElementById('wizardFooter');
    if (footer) footer.innerHTML =
      '<button class="btn" onclick="kClose(\'smartAddModal\')">Cancel</button>' +
      '<button class="btn-amber" onclick="wizardAddToEstimate()" style="min-width:140px">➕ Add to Estimate</button>';
  }
}

// ── Step 4b: Bundle task grid ──
let _wizardBundle = null;
let _wizardTier = null;
let _wizardBundleQty = 1;

function wizardRenderBundleTasks(trade, bundles) {
  wizardSetStep(4);
  updateWizardBreadcrumb();
  document.getElementById('wizardSearchInput').value = '';

  const itemListEl = document.getElementById('wizardItemList');
  if (!itemListEl) return;

  // Hide search row
  const searchRow = document.getElementById('wizardSearchRow');
  if (searchRow) searchRow.style.display = 'none';

  itemListEl.innerHTML =
    '<div style="font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:10px">Select a job bundle:</div>' +
    bundles.map(b =>
      '<div onclick="wizardSelectBundle(\'' + b.name.replace(/'/g,"\\'") + '\')" ' +
      'style="border:1px solid rgba(110,145,210,.15);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:14px" ' +
      'onmouseover="this.style.borderColor=\'rgba(217,119,6,.4)\';this.style.background=\'rgba(217,119,6,.05)\'" ' +
      'onmouseout="this.style.borderColor=\'rgba(110,145,210,.15)\';this.style.background=\'\'">' +
      '<div style="font-size:2rem;flex-shrink:0">' + b.icon + '</div>' +
      '<div><div style="font-weight:800;font-size:.95rem;color:#eaf0fb">' + esc(b.name) + '</div>' +
      '<div style="font-size:.76rem;color:var(--muted);margin-top:2px">' + esc(b.desc) + '</div>' +
      '<div style="font-size:.72rem;color:var(--amber);margin-top:4px">' +
      Object.values(b.tiers).map(t => t.label).join(' · ') + '</div></div></div>'
    ).join('') +
    '<button onclick="wizardSelectTradeFallback(\'' + trade.replace(/'/g,"\\'") + '\')" ' +
    'style="width:100%;margin-top:4px;padding:10px;background:transparent;border:1px dashed rgba(110,145,210,.2);border-radius:10px;color:var(--muted);font-size:.82rem;cursor:pointer">' +
    '📦 Browse individual catalog items instead</button>';

  const footer = document.getElementById('wizardFooter');
  if (footer) footer.innerHTML = '<button class="btn" onclick="kClose(\'smartAddModal\')">Cancel</button>';
}

function wizardSelectBundle(bundleName) {
  const bundles = TIERED_BUNDLES[_wizardTrade] || [];
  _wizardBundle = bundles.find(b => b.name === bundleName);
  if (!_wizardBundle) return;
  _wizardTier = null;
  _wizardBundleQty = 1;
  wizardRenderTierSelect();
}
window.wizardSelectBundle = wizardSelectBundle;

function wizardRenderTierSelect() {
  const itemListEl = document.getElementById('wizardItemList');
  if (!itemListEl || !_wizardBundle) return;

  const tiers = _wizardBundle.tiers;
  const tierColors = { low: '#34d399', med: '#f59e0b', high: '#ef4444' };
  const tierEmoji = { low: '🟢', med: '🟡', high: '🔴' };

  itemListEl.innerHTML =
    '<div style="text-align:center;margin-bottom:16px">' +
    '<div style="font-size:1.8rem">' + _wizardBundle.icon + '</div>' +
    '<div style="font-weight:800;font-size:1rem;color:#eaf0fb;margin-top:6px">' + esc(_wizardBundle.name) + '</div>' +
    '<div style="font-size:.78rem;color:var(--muted);margin-top:2px">' + esc(_wizardBundle.desc) + '</div></div>' +
    '<div style="font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:10px">Select grade / tier:</div>' +
    Object.entries(tiers).map(([key, tier]) => {
      const total = tier.lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0);
      const color = tierColors[key];
      return '<div onclick="wizardSelectTier(\'' + key + '\')" ' +
        'style="border:2px solid ' + color + '22;border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer;background:' + color + '08" ' +
        'onmouseover="this.style.borderColor=\'' + color + '\'" ' +
        'onmouseout="this.style.borderColor=\'' + color + '22\'">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div style="font-weight:800;font-size:.95rem;color:#eaf0fb">' + tierEmoji[key] + ' ' + tier.label + '</div>' +
        '<div style="font-weight:900;color:' + color + ';font-size:1rem">$' + total.toFixed(0) + '</div></div>' +
        '<div style="font-size:.76rem;color:var(--muted);margin-bottom:8px">' + esc(tier.priceRange) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        tier.lines.map(l =>
          '<span style="background:rgba(255,255,255,.06);border-radius:6px;padding:2px 8px;font-size:.72rem;color:#94a3b8">' +
          esc(l.desc) + (l.qty !== 1 ? ' ×' + l.qty : '') + '</span>'
        ).join('') + '</div></div>';
    }).join('') +
    '<button onclick="wizardRenderBundleTasks(_wizardTrade, TIERED_BUNDLES[_wizardTrade]||[])" ' +
    'style="background:none;border:none;color:var(--muted);font-size:.8rem;cursor:pointer;margin-top:6px">← Back to bundles</button>';

  const footer = document.getElementById('wizardFooter');
  if (footer) footer.innerHTML = '<button class="btn" onclick="kClose(\'smartAddModal\')">Cancel</button>';
}
window.wizardRenderTierSelect = wizardRenderTierSelect;

function wizardSelectTier(tierKey) {
  _wizardTier = tierKey;
  _wizardBundleQty = 1;
  wizardRenderQtySelect();
}
window.wizardSelectTier = wizardSelectTier;

function wizardRenderQtySelect() {
  if (!_wizardBundle || !_wizardTier) return;
  const itemListEl = document.getElementById('wizardItemList');
  if (!itemListEl) return;

  const tier = _wizardBundle.tiers[_wizardTier];
  const tierColors = { low: '#34d399', med: '#f59e0b', high: '#ef4444' };
  const tierEmoji = { low: '🟢', med: '🟡', high: '🔴' };
  const color = tierColors[_wizardTier];
  const baseTotal = tier.lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0);

  itemListEl.innerHTML =
    '<div style="background:rgba(217,119,6,.07);border:1px solid rgba(217,119,6,.2);border-radius:14px;padding:16px;margin-bottom:16px">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
    '<div style="font-size:1.5rem">' + _wizardBundle.icon + '</div>' +
    '<div><div style="font-weight:800;color:#eaf0fb">' + esc(_wizardBundle.name) + '</div>' +
    '<div style="font-size:.8rem;color:' + color + ';font-weight:700">' + tierEmoji[_wizardTier] + ' ' + tier.label + ' · ' + esc(tier.priceRange) + '</div></div></div>' +
    tier.lines.map(l =>
      '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.8rem">' +
      '<span style="color:#cbd5e1" id="qtyLine_' + l.desc.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'') + '">' + esc(l.desc) + ' ×' + l.qty + '</span>' +
      '<span style="color:var(--muted)">$' + (l.qty * l.unitPrice).toFixed(2) + '</span></div>'
    ).join('') +
    '<div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:900;font-size:.95rem">' +
    '<span style="color:#eaf0fb">Bundle Total</span><span style="color:var(--amber)" id="wizBundleTotalDisplay">$' + baseTotal.toFixed(2) + '</span></div></div>' +
    '<div style="background:rgba(110,145,210,.06);border:1px solid rgba(110,145,210,.15);border-radius:14px;padding:16px;margin-bottom:16px">' +
    '<div style="font-weight:700;font-size:.88rem;color:#eaf0fb;margin-bottom:12px">How many <span style="color:var(--amber)">' + esc(_wizardBundle.name) + '</span> to add?</div>' +
    '<div style="display:flex;align-items:center;gap:16px;justify-content:center">' +
    '<button onclick="wizChangeBundleQty(-1)" style="width:44px;height:44px;border-radius:10px;border:2px solid var(--amber-border);background:transparent;color:var(--amber);font-size:1.4rem;cursor:pointer;line-height:1">−</button>' +
    '<div id="wizBundleQtyDisplay" style="font-size:2rem;font-weight:900;color:var(--amber);min-width:48px;text-align:center">1</div>' +
    '<button onclick="wizChangeBundleQty(1)" style="width:44px;height:44px;border-radius:10px;border:2px solid var(--amber-border);background:transparent;color:var(--amber);font-size:1.4rem;cursor:pointer;line-height:1">＋</button>' +
    '</div><div style="text-align:center;font-size:.76rem;color:var(--muted);margin-top:8px">All quantities and prices will multiply by this number</div></div>' +
    '<button onclick="wizardRenderTierSelect()" style="background:none;border:none;color:var(--muted);font-size:.8rem;cursor:pointer">← Back to tier select</button>';

  const footer = document.getElementById('wizardFooter');
  if (footer) footer.innerHTML =
    '<button class="btn" onclick="kClose(\'smartAddModal\')">Cancel</button>' +
    '<button class="btn-amber" onclick="wizardAddBundleToEstimate()" style="min-width:180px;font-size:.92rem">➕ Add to Estimate</button>';
}

function wizChangeBundleQty(delta) {
  _wizardBundleQty = Math.max(1, (_wizardBundleQty || 1) + delta);
  const qtyEl = document.getElementById('wizBundleQtyDisplay');
  if (qtyEl) qtyEl.textContent = _wizardBundleQty;
  // Update total
  if (_wizardBundle && _wizardTier) {
    const tier = _wizardBundle.tiers[_wizardTier];
    const baseTotal = tier.lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0);
    const totalEl = document.getElementById('wizBundleTotalDisplay');
    if (totalEl) totalEl.textContent = '$' + (baseTotal * _wizardBundleQty).toFixed(2);
  }
}
window.wizChangeBundleQty = wizChangeBundleQty;

async function wizardAddBundleToEstimate() {
  if (!_wizardBundle || !_wizardTier || !conCurrentJobId) return;
  const tier = _wizardBundle.tiers[_wizardTier];
  const qty = _wizardBundleQty || 1;

  kClose('smartAddModal');

  // Find or create a group (Epic) based on room context, and a subgroup
  // (Feature) based on trade context — same pattern as wizardAddToEstimate,
  // so bundle-added items land in the same tree the Board/Estimate views read.
  const roomName = _wizardRoom || _wizardCategory || 'General';
  const tradeName = (_wizardTrade || '').split(' ').slice(1).join(' ') || 'General';

  let group = estGroups.find(g => g.name.toLowerCase() === roomName.toLowerCase());
  if (!group) {
    const ref = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
      name: roomName, order: estGroups.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    group = { id: ref.id, name: roomName, order: estGroups.length, subgroups: [], directItems: [] };
    estGroups.push(group);
  }
  const groupId = group.id;

  const subgroupName = _wizardBundle.name + (qty > 1 ? ' ×' + qty : '') + ' (' + tier.label + ')';
  const subRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
    .doc(groupId).collection('subgroups').add({
      name: subgroupName, order: group.subgroups?.length || 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  const subgroup = { id: subRef.id, name: subgroupName, order: group.subgroups?.length || 0, items: [] };
  if (!group.subgroups) group.subgroups = [];
  group.subgroups.push(subgroup);
  const subgroupId = subgroup.id;

  // Add each line × qty
  let order = 0;
  for (const line of tier.lines) {
    const lineQty = parseFloat((line.qty * qty).toFixed(4));
    const data = {
      desc: line.desc,
      qty: lineQty,
      unit: line.unit || 'ea',
      costType: line.type === 'labor' ? 'Labor' : 'Materials',
      unitCost: line.unitCost || 0,
      unitPrice: line.unitPrice || 0,
      markup: line.unitCost > 0 ? Math.round((line.unitPrice / line.unitCost - 1) * 100) : 0,
      notes: '',
      order: order++,
      source: 'smartadd-bundle',
      bundleName: _wizardBundle.name,
      bundleTier: _wizardTier,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await coll('jobs').doc(conCurrentJobId)
      .collection('estimateGroups').doc(groupId)
      .collection('subgroups').doc(subgroupId)
      .collection('items').add(data);
  }

  // Refresh estimate
  if (typeof loadEstimate === 'function') loadEstimate(conCurrentJobId);
}
window.wizardAddBundleToEstimate = wizardAddBundleToEstimate;

function wizardSelectTradeFallback(trade) {
  // Show catalog items with template tab (bypassing bundle tasks)
  _wizardCurrentItems = CATALOG_DATA[trade] || [];
  document.getElementById('wizardSearchInput').value = '';
  const searchRow = document.getElementById('wizardSearchRow');
  if (searchRow) searchRow.style.display = 'flex';

  const itemListEl = document.getElementById('wizardItemList');
  if (itemListEl) {
    itemListEl.innerHTML =
      '<div style="display:flex;gap:0;background:rgba(8,18,36,.8);border:1px solid rgba(110,145,210,.15);border-radius:10px;overflow:hidden;margin-bottom:12px">' +
      '<button id="wizTabTemplates" onclick="wizShowTab(\'templates\')" style="flex:1;padding:8px;border:none;cursor:pointer;font-size:.8rem;font-weight:700;background:linear-gradient(135deg,var(--amber),var(--amber2));color:#fff">⚡ Templates</button>' +
      '<button id="wizTabItems" onclick="wizShowTab(\'items\')" style="flex:1;padding:8px;border:none;cursor:pointer;font-size:.8rem;font-weight:600;background:transparent;color:var(--muted)">📦 Catalog Items</button>' +
      '</div><div id="wizPanelTemplates"></div><div id="wizPanelItems" style="display:none"></div>';
  }
  wizLoadTemplates(trade);

  const itemsPanel = document.getElementById('wizPanelItems');
  if (itemsPanel) {
    itemsPanel.innerHTML = _wizardCurrentItems.length ? _wizardCurrentItems.map(item => {
      const total = (item.materials?.unitPrice || 0) + (item.labor?.unitPrice || 0);
      return '<div class="wizard-item" onclick="wizardToggleItem(\'' + item.name.replace(/'/g,"\\'") + '\',this)">' +
        '<div class="wizard-item-check"></div>' +
        '<div class="wizard-item-info"><div class="wizard-item-name">' + esc(item.name) + '</div></div>' +
        '<div class="wizard-item-price">' + (total > 0 ? '$' + total.toFixed(2) : '') + '</div></div>';
    }).join('') : '<div class="small muted" style="text-align:center;padding:20px">No items for this trade</div>';
  }

  const footer = document.getElementById('wizardFooter');
  if (footer) footer.innerHTML =
    '<button class="btn" onclick="kClose(\'smartAddModal\')">Cancel</button>' +
    '<button class="btn-amber" onclick="wizardAddToEstimate()" style="min-width:140px">➕ Add to Estimate</button>';
}
window.wizardSelectTradeFallback = wizardSelectTradeFallback;

function wizShowTab(tab) {
  const tBtn = document.getElementById('wizTabTemplates');
  const iBtn = document.getElementById('wizTabItems');
  const tPanel = document.getElementById('wizPanelTemplates');
  const iPanel = document.getElementById('wizPanelItems');
  const searchRow = document.getElementById('wizardSearchRow');
  if (tab === 'templates') {
    if (tPanel) tPanel.style.display = 'block';
    if (iPanel) iPanel.style.display = 'none';
    if (tBtn) { tBtn.style.background = 'linear-gradient(135deg,var(--amber),var(--amber2))'; tBtn.style.color='#fff'; }
    if (iBtn) { iBtn.style.background = 'transparent'; iBtn.style.color='var(--muted)'; }
    if (searchRow) searchRow.style.display = 'none';
  } else {
    if (tPanel) tPanel.style.display = 'none';
    if (iPanel) iPanel.style.display = 'block';
    if (iBtn) { iBtn.style.background = 'linear-gradient(135deg,var(--amber),var(--amber2))'; iBtn.style.color='#fff'; }
    if (tBtn) { tBtn.style.background = 'transparent'; tBtn.style.color='var(--muted)'; }
    if (searchRow) searchRow.style.display = 'flex';
  }
}

function wizLoadTemplates(trade) {
  const panel = document.getElementById('wizPanelTemplates');
  if (!panel) return;
  panel.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px">Loading templates...</div>';

  coll('templates').where('trade','==',trade).orderBy('name').get()
    .then(snap => {
      const templates = [];
      snap.forEach(d => templates.push({ id: d.id, ...d.data() }));
      wizRenderTemplates(templates, trade);
    })
    .catch(() => wizRenderTemplates([], trade));
}

function wizRenderTemplates(templates, trade) {
  const panel = document.getElementById('wizPanelTemplates');
  if (!panel) return;

  let html = '';

  if (templates.length) {
    html += templates.map(t => {
      const lineCount = (t.lines||[]).length;
      const total = (t.lines||[]).reduce((s,l) => s + (l.qty||1)*(l.unitPrice||0), 0);
      return `<div style="border:1px solid rgba(110,145,210,.15);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer"
        onclick="wizSelectTemplate('${t.id}')"
        onmouseover="this.style.borderColor='rgba(217,119,6,.4)';this.style.background='rgba(217,119,6,.05)'"
        onmouseout="this.style.borderColor='rgba(110,145,210,.15)';this.style.background=''">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:800;font-size:.9rem;color:#eaf0fb">${esc(t.name)}</div>
            <div style="font-size:.74rem;color:var(--muted);margin-top:3px">${lineCount} line${lineCount!==1?'s':''} · ${esc(t.description||'')}</div>
          </div>
          <div style="font-weight:900;color:var(--amber);font-size:.95rem">$${total.toFixed(2)}</div>
        </div>
        <div style="margin-top:8px;font-size:.75rem;color:var(--muted)">
          ${(t.lines||[]).slice(0,3).map(l => `${esc(l.desc||'')} (${l.qty||1})`).join(' · ')}${(t.lines||[]).length>3?' · ...':''}
        </div>
      </div>`;
    }).join('');
  } else {
    html += `<div style="text-align:center;padding:20px 10px;color:var(--muted)">
      <div style="font-size:1.5rem;margin-bottom:8px">⚡</div>
      <div style="font-size:.85rem;font-weight:600;margin-bottom:4px">No templates yet for this trade</div>
      <div style="font-size:.76rem">Create a template to quickly add bundles of items (e.g. "Kitchen Faucet Replacement" with faucet + labor + supply lines)</div>
    </div>`;
  }

  html += `<button onclick="wizOpenCreateTemplate('${trade}')"
    style="width:100%;margin-top:8px;padding:10px;background:transparent;border:1px dashed rgba(217,119,6,.4);border-radius:10px;color:var(--amber);font-size:.83rem;font-weight:700;cursor:pointer">
    ＋ Create New Template
  </button>`;

  panel.innerHTML = html;
}

function wizSelectTemplate(templateId) {
  if (!conCurrentJobId || !conDb) return;
  coll('templates').doc(templateId).get().then(doc => {
    if (!doc.exists) return;
    const t = { id: doc.id, ...doc.data() };

    // Show qty selector overlay
    const overlay = document.createElement('div');
    overlay.id = 'wizTemplateOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,5,14,.8);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';

    const lines = t.lines || [];
    const linesHtml = lines.map(l =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(110,145,210,.07);font-size:.82rem">
        <div style="color:#eaf0fb">${esc(l.desc||'')} × <span id="lineQty_${l.id||Math.random().toString(36).slice(2)}" class="tmpl-scaled-qty">${l.qty||1}</span></div>
        <div style="color:var(--amber)">$<span class="tmpl-scaled-price">${((l.qty||1)*(l.unitPrice||0)).toFixed(2)}</span></div>
      </div>`
    ).join('');

    overlay.innerHTML = `
      <div style="background:rgba(6,14,28,.99);border:1px solid rgba(217,119,6,.35);border-radius:18px;padding:26px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:1rem;font-weight:800;color:#eaf0fb">${esc(t.name)}</div>
          <button onclick="document.getElementById('wizTemplateOverlay').remove()" style="background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer">✕</button>
        </div>
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:14px">${esc(t.description||'')}</div>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.2);border-radius:10px;padding:12px">
          <div style="font-size:.82rem;font-weight:700;color:#eaf0fb">Quantity:</div>
          <button onclick="wizChangeQty(-1)" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--amber-border);background:transparent;color:var(--amber);font-size:1.2rem;cursor:pointer;line-height:1">−</button>
          <div id="wizTmplQty" style="font-size:1.4rem;font-weight:900;color:var(--amber);min-width:32px;text-align:center">1</div>
          <button onclick="wizChangeQty(1)" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--amber-border);background:transparent;color:var(--amber);font-size:1.2rem;cursor:pointer;line-height:1">＋</button>
          <div style="font-size:.76rem;color:var(--muted);margin-left:4px">× all quantities</div>
        </div>

        <div style="margin-bottom:16px">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Lines to add:</div>
          ${linesHtml}
        </div>

        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('wizTemplateOverlay').remove()" style="flex:1;padding:12px;background:transparent;border:1px solid rgba(110,145,210,.2);border-radius:10px;color:var(--muted);font-weight:700;cursor:pointer">Cancel</button>
          <button onclick="wizAddTemplateToEstimate('${templateId}')" style="flex:2;padding:12px;background:#d97706;border:none;border-radius:10px;color:#fff;font-weight:800;cursor:pointer">➕ Add to Estimate</button>
        </div>
      </div>`;

    window._wizTemplateData = t;
    window._wizTemplateQty = 1;
    document.body.appendChild(overlay);
  });
}

function wizChangeQty(delta) {
  const qty = Math.max(1, (window._wizTemplateQty || 1) + delta);
  window._wizTemplateQty = qty;
  document.getElementById('wizTmplQty').textContent = qty;
}

async function wizAddTemplateToEstimate(templateId) {
  const t = window._wizTemplateData;
  const qty = window._wizTemplateQty || 1;
  if (!t || !conCurrentJobId) return;

  document.getElementById('wizTemplateOverlay')?.remove();
  kClose('smartAddModal');

  const roomName = _wizardRoom || _wizardCategory || 'General';
  const tradeName = t.name || (_wizardTrade || '').split(' ').slice(1).join(' ') || 'General';

  let group = estGroups.find(g => g.name.toLowerCase() === roomName.toLowerCase());
  if (!group) {
    const ref = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
      name: roomName, order: estGroups.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    group = { id: ref.id, name: roomName, order: estGroups.length, subgroups: [], directItems: [] };
    estGroups.push(group);
  }
  const groupId = group.id;

  const subRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
    .doc(groupId).collection('subgroups').add({
      name: tradeName, order: group.subgroups?.length || 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  const subgroup = { id: subRef.id, name: tradeName, order: group.subgroups?.length || 0, items: [] };
  if (!group.subgroups) group.subgroups = [];
  group.subgroups.push(subgroup);
  const subgroupId = subgroup.id;

  const lines = t.lines || [];
  let order = 0;
  for (const line of lines) {
    const lineQty = (line.qty || 1) * qty;
    const data = {
      desc: line.desc || '',
      qty: lineQty,
      unit: line.unit || 'ea',
      costType: line.type === 'labor' ? 'Labor' : 'Materials',
      unitCost: line.unitCost || 0,
      unitPrice: line.unitPrice || 0,
      markup: line.markup || 0,
      notes: '',
      order: order++,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await coll('jobs').doc(conCurrentJobId)
      .collection('estimateGroups').doc(groupId)
      .collection('subgroups').doc(subgroupId)
      .collection('items').add(data);
  }

  // Refresh estimate
  if (typeof loadEstimate === 'function') loadEstimate(conCurrentJobId);
}

function wizOpenCreateTemplate(trade) {
  const overlay = document.createElement('div');
  overlay.id = 'wizCreateTemplateOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,5,14,.8);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:rgba(6,14,28,.99);border:1px solid rgba(217,119,6,.35);border-radius:18px;padding:26px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:1rem;font-weight:800;color:#eaf0fb">Create Template — ${esc(trade)}</div>
        <button onclick="document.getElementById('wizCreateTemplateOverlay').remove()" style="background:none;border:none;color:var(--muted);font-size:1.3rem;cursor:pointer">✕</button>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:.78rem;color:var(--muted);display:block;margin-bottom:4px">Template Name *</label>
        <input id="tmplName" placeholder="e.g. Kitchen Faucet Replacement" style="width:100%;padding:10px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:8px;color:#eaf0fb;font-size:.88rem;box-sizing:border-box" />
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:.78rem;color:var(--muted);display:block;margin-bottom:4px">Description</label>
        <input id="tmplDesc" placeholder="e.g. Standard kitchen faucet swap with supply lines and shutoffs" style="width:100%;padding:10px;background:rgba(8,19,37,.8);border:1px solid rgba(217,119,6,.3);border-radius:8px;color:#eaf0fb;font-size:.88rem;box-sizing:border-box" />
      </div>
      <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Line Items</div>
      <div id="tmplLines"></div>
      <button onclick="wizAddTemplateLine()" style="width:100%;padding:9px;background:transparent;border:1px dashed rgba(110,145,210,.3);border-radius:8px;color:var(--muted);font-size:.82rem;cursor:pointer;margin-bottom:16px">＋ Add Line Item</button>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('wizCreateTemplateOverlay').remove()" style="flex:1;padding:12px;background:transparent;border:1px solid rgba(110,145,210,.2);border-radius:10px;color:var(--muted);font-weight:700;cursor:pointer">Cancel</button>
        <button onclick="wizSaveTemplate('${trade}')" style="flex:2;padding:12px;background:#d97706;border:none;border-radius:10px;color:#fff;font-weight:800;cursor:pointer">Save Template</button>
      </div>
    </div>`;
  window._tmplLines = [];
  document.body.appendChild(overlay);
  wizAddTemplateLine(); // Start with one line
}

function wizAddTemplateLine() {
  const id = 'tl_' + Date.now();
  window._tmplLines = window._tmplLines || [];
  window._tmplLines.push(id);
  const container = document.getElementById('tmplLines');
  if (!container) return;
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 60px 80px 80px 24px;gap:6px;align-items:center;margin-bottom:8px';
  div.innerHTML = `
    <input placeholder="Description" style="padding:8px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb;font-size:.8rem" data-field="desc" />
    <input type="number" placeholder="Qty" value="1" min="0.1" step="0.1" style="padding:8px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb;font-size:.8rem;text-align:center" data-field="qty" />
    <input type="number" placeholder="Cost $" min="0" step="0.01" style="padding:8px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb;font-size:.8rem" data-field="unitCost" />
    <input type="number" placeholder="Price $" min="0" step="0.01" style="padding:8px;background:rgba(8,19,37,.8);border:1px solid rgba(110,145,210,.15);border-radius:6px;color:#eaf0fb;font-size:.8rem" data-field="unitPrice" />
    <button onclick="this.closest('div').remove()" style="background:none;border:none;color:#f87171;font-size:1rem;cursor:pointer;padding:0">✕</button>
  `;
  container.appendChild(div);
}

async function wizSaveTemplate(trade) {
  const name = document.getElementById('tmplName')?.value.trim();
  if (!name) { alert('Template name is required.'); return; }
  const desc = document.getElementById('tmplDesc')?.value.trim() || '';

  const lineEls = document.getElementById('tmplLines')?.children || [];
  const lines = [];
  for (const el of lineEls) {
    const lineDesc = el.querySelector('[data-field="desc"]')?.value.trim();
    const qty = parseFloat(el.querySelector('[data-field="qty"]')?.value) || 1;
    const unitCost = parseFloat(el.querySelector('[data-field="unitCost"]')?.value) || 0;
    const unitPrice = parseFloat(el.querySelector('[data-field="unitPrice"]')?.value) || 0;
    if (lineDesc) lines.push({ id: 'l_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), desc: lineDesc, qty, unitCost, unitPrice, unit: 'ea' });
  }

  if (!lines.length) { alert('Add at least one line item.'); return; }

  await coll('templates').add({
    name, description: desc, trade,
    lines,
    companyId: currentCompanyId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: conCurrentUser?.email || '',
  });

  document.getElementById('wizCreateTemplateOverlay')?.remove();
  // Reload templates
  wizLoadTemplates(trade);
}

window.wizShowTab = wizShowTab;
window.wizLoadTemplates = wizLoadTemplates;
window.wizSelectTemplate = wizSelectTemplate;
window.wizChangeQty = wizChangeQty;
window.wizAddTemplateToEstimate = wizAddTemplateToEstimate;
window.wizOpenCreateTemplate = wizOpenCreateTemplate;
window.wizAddTemplateLine = wizAddTemplateLine;
window.wizSaveTemplate = wizSaveTemplate;

function wizardRenderItems(items) {
  const el = document.getElementById('wizardItemList');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = '<div class="small muted" style="text-align:center;padding:20px">No items found</div>';
    return;
  }

  el.innerHTML = items.map((item, idx) => {
    const isSelected = _wizardSelectedItems.has(item.name);
    const matPrice = item.materials?.unitPrice || 0;
    const labPrice = item.labor?.unitPrice || 0;
    const totalPrice = matPrice + labPrice;
    return `<div class="wizard-item ${isSelected?'selected':''}" onclick="wizardToggleItem('${item.name.replace(/'/g,"\'")}',this)">
      <div class="wizard-item-check">${isSelected?'✓':''}</div>
      <div class="wizard-item-info">
        <div class="wizard-item-name">${esc(item.name)}</div>
        <div class="wizard-item-meta">
          ${item.materials?'📦 Mat: $'+item.materials.unitPrice.toFixed(2):''}
          ${item.labor?' · 👷 Labor: $'+item.labor.unitPrice.toFixed(2)+'/hr':''}
        </div>
      </div>
      <div class="wizard-item-price">${totalPrice>0?'$'+totalPrice.toFixed(2):''}</div>
    </div>`;
  }).join('');

  updateWizardSelCount();
}

function wizardToggleItem(name, el) {
  if (_wizardSelectedItems.has(name)) {
    _wizardSelectedItems.delete(name);
    el.classList.remove('selected');
    el.querySelector('.wizard-item-check').textContent = '';
  } else {
    _wizardSelectedItems.add(name);
    el.classList.add('selected');
    el.querySelector('.wizard-item-check').textContent = '✓';
  }
  updateWizardSelCount();
}

function wizardFilterItems() {
  const q = document.getElementById('wizardSearchInput')?.value.toLowerCase() || '';
  const filtered = q ? _wizardCurrentItems.filter(i => i.name.toLowerCase().includes(q)) : _wizardCurrentItems;
  wizardRenderItems(filtered);
}

function wizardSelectAll() {
  _wizardCurrentItems.forEach(i => _wizardSelectedItems.add(i.name));
  wizardRenderItems(_wizardCurrentItems);
}

function wizardClearAll() {
  _wizardSelectedItems.clear();
  wizardRenderItems(_wizardCurrentItems);
}

function updateWizardSelCount() {
  const el = document.getElementById('wizardSelCount');
  if (el) el.textContent = `${_wizardSelectedItems.size} item${_wizardSelectedItems.size!==1?'s':''} selected`;
}

function wizardSetStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('wizardStep' + i);
    if (el) el.classList.toggle('active', i === step);
  }
  const backBtn = document.getElementById('wizardBackBtn');
  if (backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
  if (step < 4) {
    const footer = document.getElementById('wizardFooter');
    if (footer) { footer.innerHTML = ''; const cb = document.createElement('button'); cb.className='btn'; cb.textContent='Cancel'; cb.onclick=function(){kClose('smartAddModal');}; footer.appendChild(cb); }
  }
}

function wizardBack() {
  if (_wizardStep === 2) wizardRenderStep1();
  else if (_wizardStep === 3) wizardSelectCategory(_wizardCategory);
  else if (_wizardStep === 4) wizardSelectRoom(_wizardRoom);
}

function wizardGoTo(step) {
  if (step === 1) wizardRenderStep1();
}

function updateWizardBreadcrumb() {
  const el = document.getElementById('wizardBreadcrumb');
  if (!el) return;
  let crumbs = [{ label:'Start', step:1 }];
  if (_wizardCategory) crumbs.push({ label:_wizardCategory, step:2 });
  if (_wizardRoom) crumbs.push({ label:_wizardRoom, step:3 });
  if (_wizardTrade) {
    const tradeName = _wizardTrade.split(' ').slice(1).join(' ') || _wizardTrade;
    crumbs.push({ label:tradeName, step:4 });
  }
  el.innerHTML = crumbs.map((c, i) =>
    i < crumbs.length - 1
      ? `<span onclick="wizardGoStep(${i})">${c.label}</span> ›`
      : `<span style="color:#eaf0fb;cursor:default">${c.label}</span>`
  ).join(' ');
}

function wizardGoStep(idx) {
  if (idx === 0) wizardRenderStep1();
  else if (idx === 1 && _wizardCategory) wizardSelectCategory(_wizardCategory);
  else if (idx === 2 && _wizardRoom) wizardSelectRoom(_wizardRoom);
}

async function wizardAddToEstimate() {
  if (_wizardSelectedItems.size === 0) { alert('Select at least one item.'); return; }
  if (!conDb || !conCurrentJobId) return;

  // Pick or create group based on room
  let groupId = null;
  let subgroupId = null;
  const roomName = _wizardRoom || _wizardCategory || 'General';
  const tradeName = (_wizardTrade || '').split(' ').slice(1).join(' ') || 'General';

  // Find existing group matching room name
  let group = estGroups.find(g => g.name.toLowerCase() === roomName.toLowerCase());

  if (!group) {
    // Create new group for this room
    const ref = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups').add({
      name: roomName, order: estGroups.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    group = { id: ref.id, name: roomName, order: estGroups.length, subgroups: [], directItems: [] };
    estGroups.push(group);
  }
  groupId = group.id;

  // Create subgroup for the trade
  let subgroup = group.subgroups?.find(s => s.name.toLowerCase() === tradeName.toLowerCase());
  if (!subgroup) {
    const subRef = await coll('jobs').doc(conCurrentJobId).collection('estimateGroups')
      .doc(groupId).collection('subgroups').add({
        name: tradeName, order: group.subgroups?.length || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    subgroup = { id: subRef.id, name: tradeName, order: group.subgroups?.length || 0, items: [] };
    if (!group.subgroups) group.subgroups = [];
    group.subgroups.push(subgroup);
  }
  subgroupId = subgroup.id;

  // Add selected items
  const itemsToAdd = _wizardCurrentItems.filter(i => _wizardSelectedItems.has(i.name));
  const addPromises = [];
  let order = subgroup.items?.length || 0;

  for (const item of itemsToAdd) {
    // Add materials item
    if (item.materials) {
      const matData = {
        desc: item.name,
        qty: item.materials.qty || 1,
        unit: item.materials.unit || 'ea',
        costType: 'Materials',
        unitCost: item.materials.unitCost || 0,
        markup: 15,
        unitPrice: item.materials.unitPrice || 0,
        notes: '',
        order: order++,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      addPromises.push(
        coll('jobs').doc(conCurrentJobId)
          .collection('estimateGroups').doc(groupId)
          .collection('subgroups').doc(subgroupId)
          .collection('items').add(matData)
      );
    }
    // Always add a labor line — $100/hr per man, qty = number of men
    {
      const labData = {
        desc: 'Labor - ' + item.name,
        qty: 1,
        unit: 'men',
        costType: 'Labor',
        unitCost: 100,
        markup: 15,
        unitPrice: 115,
        notes: 'Change qty to number of men on this task',
        order: order++,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      addPromises.push(
        coll('jobs').doc(conCurrentJobId)
          .collection('estimateGroups').doc(groupId)
          .collection('subgroups').doc(subgroupId)
          .collection('items').add(labData)
      );
    }
  }

  await Promise.all(addPromises);
  kClose('smartAddModal');

  // Switch to estimate tab and reload
  const estTab = document.querySelector('[onclick*="estimate"]');
  if (estTab) estTab.click();
  else loadEstimate(conCurrentJobId);

  const itemCount = itemsToAdd.length;
  const lineCount = itemsToAdd.filter(i=>i.materials).length + itemsToAdd.filter(i=>i.labor).length;
  alert(`✅ Added ${itemCount} item${itemCount!==1?'s':''} (${lineCount} line items) to ${roomName} › ${tradeName}`);
}

// Update estimate tab toolbar to include Smart Add
window.openSmartAdd = openSmartAdd;
window.wizardSelectCategory = wizardSelectCategory;
window.wizardSelectRoom = wizardSelectRoom;
window.wizardSelectTrade = wizardSelectTrade;
window.wizardToggleItem = wizardToggleItem;
window.wizardFilterItems = wizardFilterItems;
window.wizardSelectAll = wizardSelectAll;
window.wizardClearAll = wizardClearAll;
window.wizardBack = wizardBack;
window.wizardGoTo = wizardGoTo;
window.wizardGoStep = wizardGoStep;
window.wizardAddToEstimate = wizardAddToEstimate;

// ════════════════════════════════════════════════════
// ── CUSTOMER PICKER (New Job Modal) ──
// ════════════════════════════════════════════════════
function jobCustomerSearch(q) {
  const drop = document.getElementById('jobCustomerDrop');
  if (!drop) return;
  const val = q.trim().toLowerCase();
  // Clear linked customer id whenever user edits the name field
  document.getElementById('jobCustomerId').value = '';

  const matches = val.length === 0
    ? allCustomers.slice().sort((a,b) => (a.name||'').localeCompare(b.name||''))
    : allCustomers.filter(c => (c.name||'').toLowerCase().includes(val));

  let html = '';

  if (matches.length > 0) {
    html += matches.map(c => {
      const phone = c.phone ? `<span style="color:var(--muted);font-size:.75rem;margin-left:8px">${esc(c.phone)}</span>` : '';
      const email = c.email ? `<div style="color:var(--muted);font-size:.73rem;margin-top:1px">${esc(c.email)}</div>` : '';
      return `<div onclick="jobPickCustomer('${c.id}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--line)" onmouseover="this.style.background='rgba(217,119,6,.12)'" onmouseout="this.style.background=''">
        <div style="font-size:.85rem;font-weight:600">${esc(c.name||'')}${phone}</div>${email}
      </div>`;
    }).join('');
  } else if (val.length > 0) {
    html += `<div style="padding:10px 14px;font-size:.82rem;color:var(--muted);font-style:italic;border-bottom:1px solid var(--line)">No match — "${esc(q)}" will be saved as new</div>`;
  }

  // Always show Add Customer button at bottom
  html += `<div onclick="jobOpenAddCustomer()" style="padding:10px 14px;cursor:pointer;font-size:.83rem;font-weight:700;color:var(--amber);display:flex;align-items:center;gap:7px" onmouseover="this.style.background='rgba(217,119,6,.08)'" onmouseout="this.style.background=''">
    <span style="font-size:1rem">＋</span> Add New Customer
  </div>`;

  drop.innerHTML = html;
  drop.style.display = 'block';
}

function jobPickCustomer(id) {
  const c = allCustomers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('jobCustomerId').value = id;
  document.getElementById('jobClient').value = c.name || '';
  document.getElementById('jobPhone').value = c.phone || '';
  document.getElementById('jobEmail').value = c.email || '';
  if (c.address) document.getElementById('jobAddress').value = c.address;
  document.getElementById('jobCustomerDrop').style.display = 'none';
}
function jobOpenAddCustomer() {
  // Remember what was typed in the job name field so we can restore it
  const jobNameVal = document.getElementById('jobName')?.value || '';
  window._pendingJobName = jobNameVal;
  // Close dropdown
  const drop = document.getElementById('jobCustomerDrop');
  if (drop) drop.style.display = 'none';
  // Pre-fill customer name from whatever was typed in the picker
  const typedName = document.getElementById('jobClient')?.value.trim() || '';
  // Open customer modal (existing function)
  openCustomerModal();
  if (typedName) {
    const custNameEl = document.getElementById('custName');
    if (custNameEl) custNameEl.value = typedName;
  }
  // After customer modal closes and saves, auto-pick the new customer
  // We hook into saveCustomer via a one-time flag
  window._afterCustomerSaveForJob = true;
}
window.jobOpenAddCustomer = jobOpenAddCustomer;

// Patch saveCustomer to re-open New Job modal after adding from job picker
const _origSaveCustomer = window.saveCustomer;
window.saveCustomer = function(goToNewJob) {
  const forJob = window._afterCustomerSaveForJob;
  window._afterCustomerSaveForJob = false;
  if (typeof _origSaveCustomer === 'function') {
    _origSaveCustomer(goToNewJob);
  }
  if (forJob) {
    // Wait for Firestore to update allCustomers, then re-open New Job
    setTimeout(() => {
      openNewJobModal();
      // Restore job name
      const jnEl = document.getElementById('jobName');
      if (jnEl && window._pendingJobName) jnEl.value = window._pendingJobName;
      // Find the newest customer (last added) and auto-select it
      if (allCustomers.length > 0) {
        const newest = allCustomers[allCustomers.length - 1];
        setTimeout(() => jobPickCustomer(newest.id), 200);
      }
    }, 800);
  }
};

// Patch openNewJobModal to also clear jobCustomerId
const _origOpenNewJobModalCustPick = window.openNewJobModal;
window.openNewJobModal = function() {
  _origOpenNewJobModalCustPick();
  const cidEl = document.getElementById('jobCustomerId');
  if (cidEl) cidEl.value = '';
  const drop = document.getElementById('jobCustomerDrop');
  if (drop) drop.style.display = 'none';
};

// Full saveJob override to include customerId
window.saveJob = function(openEstimate) {
  const name = document.getElementById('jobName').value.trim();
  const client = document.getElementById('jobClient').value.trim();
  if (!name || !client) { alert('Job name and client name are required.'); return; }

  const customerId = document.getElementById('jobCustomerId')?.value.trim() || '';

  const data = {
    name, client,
    customerId,
    phone: document.getElementById('jobPhone').value.trim(),
    email: document.getElementById('jobEmail').value.trim(),
    address: document.getElementById('jobAddress').value.trim(),
    status: document.getElementById('jobStatus').value,
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
    coll('jobs').doc(conEditingJobId).update(data)
      .then(() => kClose('newJobModal'))
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
          openJobDetail(ref.id);
          setTimeout(() => {
            if (openEstimate) {
              document.querySelectorAll('#jobDetailModal .con-subtab').forEach(btn => {
                if (btn.textContent.includes('Estimate')) btn.click();
              });
            }
          }, 400);
        }, 300);
      })
      .catch(e => alert('Error saving: ' + e.message));
  }
};

// ════════════════════════════════════════════════════
// ── JOB WEATHER ──
// ════════════════════════════════════════════════════
async function loadJobWeather(address) {
  const el = document.getElementById('detailWeather');
  if (!el) return;
  el.innerHTML = '<div class="small muted">Loading weather...</div>';

  try {
    // Use Open-Meteo geocoding — free, no API key, no referrer restrictions
    const city = address.split(',').slice(0,2).join(',').trim();
    const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=en&format=json');
    const geoData = await geoRes.json();

    let lat, lng;
    if (geoData.results && geoData.results.length) {
      lat = geoData.results[0].latitude;
      lng = geoData.results[0].longitude;
    } else {
      lat = 38.6270; lng = -90.1994; // St. Louis fallback
    }

    const wxRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7');
    const wx = await wxRes.json();
    const cur = wx.current;
    const daily = wx.daily;

    const wmoIcon = function(code) {
      if (code === 0) return '☀️';
      if (code <= 3) return '⛅';
      if (code <= 49) return '🌫️';
      if (code <= 67) return '🌧️';
      if (code <= 77) return '❄️';
      if (code <= 82) return '🌦️';
      return '⛈️';
    };
    const wmoLabel = function(code) {
      if (code === 0) return 'Clear';
      if (code <= 3) return 'Partly Cloudy';
      if (code <= 49) return 'Foggy';
      if (code <= 67) return 'Rain';
      if (code <= 77) return 'Snow';
      if (code <= 82) return 'Showers';
      return 'Thunderstorms';
    };

    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let dailyHtml = '';
    (daily.time || []).slice(0,7).forEach(function(date, i) {
      const d = new Date(date + 'T12:00:00');
      dailyHtml += '<div style="text-align:center;font-size:.75rem">' +
        '<div style="color:var(--muted)">' + days[d.getDay()] + '</div>' +
        '<div style="font-size:1rem">' + wmoIcon(daily.weathercode[i]) + '</div>' +
        '<div style="font-weight:700;color:#eaf0fb">' + Math.round(daily.temperature_2m_max[i]) + '°</div>' +
        '<div style="color:var(--muted)">' + Math.round(daily.temperature_2m_min[i]) + '°</div>' +
        '</div>';
    });

    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
      '<div style="font-size:2.5rem">' + wmoIcon(cur.weathercode) + '</div>' +
      '<div><div style="font-size:1.6rem;font-weight:900;color:#eaf0fb">' + Math.round(cur.temperature_2m) + '°F</div>' +
      '<div style="font-size:.8rem;color:var(--muted)">' + wmoLabel(cur.weathercode) + ' · Wind ' + Math.round(cur.windspeed_10m) + ' mph</div></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' + dailyHtml + '</div>';
  } catch(e) {
    console.error('Weather error:', e);
    el.innerHTML = '<div class="small muted">Weather unavailable</div>';
  }
}

// ════════════════════════════════════════════════════
// ── JOB ACTIVITY FEED ──
// ════════════════════════════════════════════════════
let _jobActivityListener = null;

function loadJobActivity(jobId, mode) {
  if (!jobId || !conDb) return;
  const feedEl = document.getElementById(mode === 'full' ? 'detailActivityFull' : 'detailActivityFeed');
  if (!feedEl) return;
  feedEl.innerHTML = '<div class="small muted" style="text-align:center;padding:16px">Loading...</div>';

  // Load logs and notes as activity
  const activityItems = [];

  // Get daily logs
  coll('jobs').doc(jobId).collection('logs').orderBy('date','desc').limit(50).get()
    .then(snap => {
      snap.forEach(d => {
        const log = d.data();
        activityItems.push({
          type: 'log',
          icon: '📝',
          iconBg: 'rgba(59,130,246,.15)',
          text: log.notes || 'Daily log entry',
          sub: (log.date || '') + (log.userName ? ' · ' + log.userName : ''),
          time: log.date || '',
          ts: log.date || '0',
        });
      });

      // Get invoices
      return coll('jobs').doc(jobId).collection('invoices').orderBy('date','desc').limit(20).get();
    })
    .then(snap => {
      snap.forEach(d => {
        const inv = d.data();
        activityItems.push({
          type: 'invoice',
          icon: '🧾',
          iconBg: 'rgba(217,119,6,.15)',
          text: (inv.number || 'Invoice') + ' — ' + (inv.type || '') + ' — $' + (inv.total||0).toLocaleString(),
          sub: inv.date + ' · ' + (inv.status || 'Draft'),
          time: inv.date || '',
          ts: inv.date || '0',
        });
      });

      // Get phases
      return coll('jobs').doc(jobId).collection('phases').orderBy('startDate').get();
    })
    .then(snap => {
      snap.forEach(d => {
        const p = d.data();
        activityItems.push({
          type: 'phase',
          icon: '📅',
          iconBg: 'rgba(139,92,246,.15)',
          text: p.name + ' · ' + (p.status || 'Not Started'),
          sub: (p.startDate || '') + (p.endDate ? ' → ' + p.endDate : ''),
          time: p.startDate || '',
          ts: p.startDate || '0',
        });
      });

      // Sort by time descending
      activityItems.sort((a,b) => b.ts.localeCompare(a.ts));

      if (!activityItems.length) {
        feedEl.innerHTML = '<div class="small muted" style="text-align:center;padding:20px">No activity yet</div>';
        return;
      }

      feedEl.innerHTML = activityItems.map(item => `
        <div class="activity-item">
          <div class="activity-icon" style="background:${item.iconBg}">${item.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.83rem;color:#eaf0fb;line-height:1.4">${esc(item.text)}</div>
            <div class="activity-meta">${esc(item.sub)}</div>
          </div>
        </div>`).join('');
    })
    .catch(() => {
      feedEl.innerHTML = '<div class="small muted" style="text-align:center;padding:16px">Could not load activity</div>';
    });
}

function addJobActivity(type) {
  if (!conCurrentJobId) return;
  const note = prompt('Add a note to this job:');
  if (!note?.trim()) return;
  coll('jobs').doc(conCurrentJobId).collection('logs').add({
    date: new Date().toISOString().split('T')[0],
    notes: note.trim(),
    userName: conCurrentUser?.displayName || conCurrentUser?.email || 'Unknown',
    type: 'note',
    companyId: currentCompanyId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(() => {
    loadJobActivity(conCurrentJobId);
    renderLogList();
  });
}
window.addJobActivity = addJobActivity;

// ════════════════════════════════════════════════════
// ── JOB PHOTO UPLOADS ──
// ════════════════════════════════════════════════════
function openJobPhotos() {
  switchDetailTab('documents', null);
  // Find and click correct tab button
  document.querySelectorAll('#jobDetailModal .con-subtab').forEach(btn => {
    if (btn.textContent.includes('Files')) btn.click();
  });
}

function loadJobPhotos(jobId) {
  // Photos are stored as base64 in Firestore documents subcollection
  // or we display uploaded docs with image preview
  loadJobDocs(jobId); // reuse existing doc loader
}

function uploadJobFiles(input) {
  if (!conCurrentJobId || !input.files?.length) return;
  const files = Array.from(input.files);
  const listEl = document.getElementById('detailFilesList');
  if (listEl) listEl.innerHTML = '<div class="small muted" style="text-align:center;padding:20px;grid-column:1/-1">Uploading ' + files.length + ' file(s)...</div>';

  // Convert to base64 and store in Firestore
  Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({ name: file.name, type: file.type, size: file.size, data: e.target.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }))).then(async results => {
    for (const f of results) {
      // Only store files under 900KB (Firestore 1MB doc limit)
      if (f.size > 900000) {
        alert(f.name + ' is too large (max 900KB). Skipping.');
        continue;
      }
      await coll('jobs').doc(conCurrentJobId).collection('documents').add({
        name: f.name,
        type: f.type,
        size: f.size,
        data: f.data,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploadedBy: conCurrentUser?.email || '',
        companyId: currentCompanyId,
      });
    }
    loadJobDocs(conCurrentJobId);
  }).catch(e => alert('Upload error: ' + e.message));
}
window.uploadJobFiles = uploadJobFiles;
window.openJobPhotos = openJobPhotos;

// ════════════════════════════════════════════════════
// ── RETROSPECTIVE & BURNDOWN CHART ──
// ════════════════════════════════════════════════════

let _burndownChartInstance = null;

async function loadRetrospective(jobId) {
  if (!jobId || !conDb) return;

  // Load time entries for this job
  const teSnap = await coll('timeentries').where('jobId','==',jobId).get();
  const timeEntries = [];
  teSnap.forEach(d => timeEntries.push({ id: d.id, ...d.data() }));

  // Also check logs with type=time
  const logSnap = await coll('jobs').doc(jobId).collection('logs')
    .where('type','==','time').get().catch(() => ({ forEach: ()=>{} }));
  logSnap.forEach(d => timeEntries.push({ id: d.id, ...d.data() }));

  renderBurndownChart(jobId, timeEntries);
  renderRetroPhaseTable(timeEntries);
  renderRetroInsights(timeEntries);
  renderTradeAccuracy();
}

function renderBurndownChart(jobId, timeEntries) {
  const canvas = document.getElementById('burndownChart');
  const emptyEl = document.getElementById('burndownEmpty');
  if (!canvas) return;

  const totalEstHours = conPhases.reduce((s,p) => s + (p.estHours||0), 0);
  if (!totalEstHours || !conPhases.length) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  // Determine date range
  const job = conJobs.find(j => j.id === jobId);
  const startDate = job?.startDate || conPhases.map(p=>p.startDate).filter(Boolean).sort()[0];
  const endDate = job?.endDate || conPhases.map(p=>p.endDate).filter(Boolean).sort().reverse()[0];
  if (!startDate) { canvas.style.display='none'; if(emptyEl) emptyEl.style.display='block'; return; }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30*86400000);
  const today = new Date();
  const chartEnd = today > end ? today : end;
  const totalDays = Math.ceil((chartEnd - start) / 86400000) + 1;

  // Build daily labels
  const labels = [];
  const idealLine = [];
  const actualLine = [];
  const d = new Date(start);
  let remaining = totalEstHours;

  // Sort time entries by date
  const entriesByDay = {};
  timeEntries.forEach(te => {
    const date = (te.date || te.clockInISO || '').split('T')[0];
    if (date) entriesByDay[date] = (entriesByDay[date] || 0) + (te.hours || 0);
  });

  for (let i = 0; i < totalDays; i++) {
    const dateStr = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('en-US',{month:'short',day:'numeric'}));

    // Ideal: linear burn
    const idealRemaining = Math.max(0, totalEstHours * (1 - i/(totalDays-1)));
    idealLine.push(parseFloat(idealRemaining.toFixed(2)));

    // Actual: subtract hours logged on this day
    if (d <= today) {
      remaining = Math.max(0, remaining - (entriesByDay[dateStr] || 0));
      actualLine.push(parseFloat(remaining.toFixed(2)));
    } else {
      actualLine.push(null);
    }

    d.setDate(d.getDate() + 1);
  }

  // Destroy existing chart
  if (_burndownChartInstance) { _burndownChartInstance.destroy(); _burndownChartInstance = null; }

  // Draw with Canvas2D (no library needed)
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 200;
  canvas.width = W;
  canvas.height = H;

  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxVal = totalEstHours * 1.1;

  const toX = i => pad.left + (i / (labels.length-1)) * chartW;
  const toY = v => pad.top + chartH - (v / maxVal) * chartH;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(110,145,210,.1)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = toY(maxVal * g / 4);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W-pad.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((maxVal*g/4).toFixed(0)+'h', pad.left-5, y+4);
  }

  // X axis labels (show ~6)
  const step = Math.max(1, Math.floor(labels.length/6));
  ctx.fillStyle = 'rgba(148,163,184,.6)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    if (i % step === 0 || i === labels.length-1) {
      ctx.fillText(lbl, toX(i), H - pad.bottom + 14);
    }
  });

  // Today line
  const todayStr = new Date().toISOString().split('T')[0];
  const todayIdx = labels.length - actualLine.filter(v=>v!==null).length;
  if (todayIdx >= 0 && todayIdx < labels.length) {
    ctx.strokeStyle = 'rgba(239,68,68,.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,3]);
    ctx.beginPath();
    ctx.moveTo(toX(actualLine.filter(v=>v!==null).length-1), pad.top);
    ctx.lineTo(toX(actualLine.filter(v=>v!==null).length-1), H-pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ideal line (dashed amber)
  ctx.strokeStyle = 'rgba(217,119,6,.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,4]);
  ctx.beginPath();
  idealLine.forEach((v,i) => {
    if (i===0) ctx.moveTo(toX(i), toY(v));
    else ctx.lineTo(toX(i), toY(v));
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Actual line (solid blue/green)
  const actualData = actualLine.filter(v=>v!==null);
  if (actualData.length > 1) {
    const isAhead = actualData[actualData.length-1] <= idealLine[actualData.length-1];
    ctx.strokeStyle = isAhead ? '#34d399' : '#f87171';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    actualData.forEach((v,i) => {
      if (i===0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
  }

  // Legend
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(217,119,6,.7)';
  ctx.fillRect(pad.left, 5, 20, 3);
  ctx.fillStyle = 'rgba(148,163,184,.8)';
  ctx.textAlign = 'left';
  ctx.fillText('Ideal', pad.left+24, 11);

  ctx.fillStyle = actualData.length > 1 && actualData[actualData.length-1] <= idealLine[actualData.length-1] ? '#34d399' : '#f87171';
  ctx.fillRect(pad.left+80, 5, 20, 3);
  ctx.fillStyle = 'rgba(148,163,184,.8)';
  ctx.fillText('Actual', pad.left+104, 11);

  // Summary
  const summaryEl = document.getElementById('burndownSummary');
  if (summaryEl && actualData.length) {
    const lastActual = actualData[actualData.length-1];
    const lastIdeal = idealLine[actualData.length-1];
    const diff = lastIdeal - lastActual;
    const ahead = diff >= 0;
    summaryEl.innerHTML =
      '<div style="font-size:.9rem;font-weight:900;color:'+(ahead?'#34d399':'#f87171')+'">'+
      (ahead?'▲ '+diff.toFixed(1)+'h ahead':'▼ '+Math.abs(diff).toFixed(1)+'h behind')+'</div>'+
      '<div style="font-size:.75rem;color:var(--muted)">'+lastActual.toFixed(1)+'h remaining of '+totalEstHours+'h</div>';
  }
}

function renderRetroPhaseTable(timeEntries) {
  const el = document.getElementById('retroPhaseTable');
  if (!el) return;
  if (!conPhases.length) { el.innerHTML = '<div class="small muted">No phases on this job yet.</div>'; return; }

  // Hours per phase from time entries
  const hoursByPhase = {};
  timeEntries.forEach(te => {
    if (te.phaseId) hoursByPhase[te.phaseId] = (hoursByPhase[te.phaseId]||0) + (te.hours||0);
  });

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.84rem';
  table.innerHTML = '<thead><tr style="border-bottom:2px solid rgba(110,145,210,.12)">' +
    '<th style="text-align:left;padding:8px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Phase</th>' +
    '<th style="text-align:right;padding:8px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Est Hours</th>' +
    '<th style="text-align:right;padding:8px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Act Hours</th>' +
    '<th style="text-align:right;padding:8px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Variance</th>' +
    '<th style="text-align:left;padding:8px;font-size:.72rem;color:var(--muted);text-transform:uppercase">Accuracy</th>' +
    '</tr></thead>';

  const tbody = document.createElement('tbody');
  let totalEst = 0, totalAct = 0;

  conPhases.forEach(p => {
    const estH = p.estHours || 0;
    const actH = hoursByPhase[p.id] || p._actualHours || 0;
    const variance = actH - estH;
    const accuracy = estH > 0 ? (actH / estH * 100) : null;
    const color = !accuracy ? 'var(--muted)' : accuracy <= 100 ? '#34d399' : accuracy <= 120 ? '#f59e0b' : '#f87171';
    totalEst += estH; totalAct += actH;

    // Mini progress bar
    const barPct = estH > 0 ? Math.min(actH/estH*100, 150) : 0;
    const barColor = !accuracy ? '#64748b' : accuracy <= 100 ? '#34d399' : accuracy <= 120 ? '#f59e0b' : '#f87171';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(110,145,210,.07)';
    tr.innerHTML =
      '<td style="padding:10px 8px"><div style="font-weight:600">'+esc(p.name)+'</div><div style="font-size:.72rem;color:var(--muted)">'+esc(p.trade||'')+(p.assigned?' · '+esc(p.assigned):'')+'</div></td>' +
      '<td style="padding:10px 8px;text-align:right;font-weight:700">'+(estH||'—')+'</td>' +
      '<td style="padding:10px 8px;text-align:right;font-weight:700;color:'+(actH>0?color:'var(--muted)')+'>'+(actH>0?actH.toFixed(1):'—')+'</td>' +
      '<td style="padding:10px 8px;text-align:right;font-weight:700;color:'+(variance>0?'#f87171':variance<0?'#34d399':'var(--muted)')+'>'+(estH>0?(variance>0?'+':'')+variance.toFixed(1)+'h':'—')+'</td>' +
      '<td style="padding:10px 8px"><div style="display:flex;align-items:center;gap:8px">'+
      (accuracy !== null ? '<div style="flex:1;background:rgba(255,255,255,.06);border-radius:4px;height:6px;overflow:hidden"><div style="width:'+Math.min(barPct,100)+'%;height:100%;background:'+barColor+'"></div></div><span style="font-size:.78rem;color:'+color+';font-weight:700;white-space:nowrap">'+accuracy.toFixed(0)+'%</span>' : '<span style="color:var(--muted);font-size:.78rem">No data</span>')+
      '</div></td>';
    tbody.appendChild(tr);
  });

  // Totals row
  const totalVariance = totalAct - totalEst;
  const totalAccuracy = totalEst > 0 ? (totalAct/totalEst*100) : null;
  const totTr = document.createElement('tr');
  totTr.style.cssText = 'border-top:2px solid rgba(110,145,210,.2);font-weight:800;background:rgba(110,145,210,.04)';
  totTr.innerHTML =
    '<td style="padding:10px 8px">TOTAL</td>' +
    '<td style="padding:10px 8px;text-align:right">'+(totalEst.toFixed(1))+'h</td>' +
    '<td style="padding:10px 8px;text-align:right;color:'+(totalAct>totalEst?'#f87171':'#34d399')+'">'+(totalAct.toFixed(1))+'h</td>' +
    '<td style="padding:10px 8px;text-align:right;color:'+(totalVariance>0?'#f87171':totalVariance<0?'#34d399':'var(--muted)')+'">'+
    (totalVariance>0?'+':'')+totalVariance.toFixed(1)+'h</td>' +
    '<td style="padding:10px 8px">'+(totalAccuracy?'<span style="font-weight:900;color:'+(totalAccuracy<=100?'#34d399':totalAccuracy<=120?'#f59e0b':'#f87171')+'">'+totalAccuracy.toFixed(0)+'%</span>':'—')+'</td>';
  tbody.appendChild(totTr);

  table.appendChild(tbody);
  el.innerHTML = '';
  el.appendChild(table);
}

function renderRetroInsights(timeEntries) {
  const el = document.getElementById('retroInsights');
  if (!el) return;
  if (!conPhases.length) { el.innerHTML = '<div class="small muted">No phases to analyze yet.</div>'; return; }

  const insights = [];
  const hoursByPhase = {};
  timeEntries.forEach(te => {
    if (te.phaseId) hoursByPhase[te.phaseId] = (hoursByPhase[te.phaseId]||0)+(te.hours||0);
  });

  conPhases.forEach(p => {
    const estH = p.estHours || 0;
    const actH = hoursByPhase[p.id] || p._actualHours || 0;
    if (!estH || !actH) return;
    const pct = actH/estH*100;
    const trade = p.trade || 'General';

    if (pct > 130) {
      insights.push({ type: 'over', icon: '🔴', msg: `<strong>${esc(p.name)}</strong> ran ${(actH-estH).toFixed(1)}h over estimate (${pct.toFixed(0)}% of est). Consider raising ${trade} phase estimates by ~${Math.round((pct-100)/10)*10}%.` });
    } else if (pct > 110) {
      insights.push({ type: 'warn', icon: '🟡', msg: `<strong>${esc(p.name)}</strong> ran ${(actH-estH).toFixed(1)}h over (${pct.toFixed(0)}%). Slightly under-estimated — watch this trade.` });
    } else if (pct < 70) {
      insights.push({ type: 'under', icon: '🟢', msg: `<strong>${esc(p.name)}</strong> came in ${(estH-actH).toFixed(1)}h under estimate (${pct.toFixed(0)}%). You may be padding ${trade} phases — consider tightening estimates.` });
    } else {
      insights.push({ type: 'good', icon: '✅', msg: `<strong>${esc(p.name)}</strong> was well-estimated (${pct.toFixed(0)}% of estimate used).` });
    }
  });

  // Overall job insight
  const totalEst = conPhases.reduce((s,p)=>s+(p.estHours||0),0);
  const totalAct = conPhases.reduce((s,p)=>s+(hoursByPhase[p.id]||p._actualHours||0),0);
  if (totalEst > 0 && totalAct > 0) {
    const pct = totalAct/totalEst*100;
    if (pct > 115) insights.unshift({ type: 'over', icon: '⚠️', msg: `This job is <strong>${(totalAct-totalEst).toFixed(1)}h over budget overall</strong>. Review your estimation process for similar jobs.` });
    else if (pct < 85) insights.unshift({ type: 'under', icon: '💡', msg: `This job came in <strong>${(totalEst-totalAct).toFixed(1)}h under budget</strong>. You may be over-estimating — this creates pricing room to compete.` });
    else insights.unshift({ type: 'good', icon: '🎯', msg: `<strong>Strong estimation accuracy</strong> — this job is ${pct.toFixed(0)}% of the estimated hours. Well done.` });
  }

  if (!insights.length) { el.innerHTML = '<div class="small muted">Log time against phases to generate insights.</div>'; return; }

  el.innerHTML = insights.map(ins =>
    `<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(110,145,210,.07)">
      <div style="font-size:1.1rem;flex-shrink:0">${ins.icon}</div>
      <div style="font-size:.84rem;line-height:1.5;color:#cbd5e1">${ins.msg}</div>
    </div>`
  ).join('');
}

async function renderTradeAccuracy() {
  const el = document.getElementById('retroTradeAccuracy');
  if (!el) return;
  el.innerHTML = '<div class="small muted">Analyzing all jobs...</div>';

  try {
    // Gather phases across all jobs
    const tradeStats = {}; // { trade: { totalEst, totalAct, count } }

    // We already have conJobs - fetch phases for completed ones
    const completedJobs = conJobs.filter(j => j.status === 'Complete' || j.status === 'Closed Won').slice(0, 20);
    if (!completedJobs.length) {
      el.innerHTML = '<div class="small muted">Complete some jobs to see trade accuracy trends.</div>';
      return;
    }

    for (const job of completedJobs) {
      const phaseSnap = await coll('jobs').doc(job.id).collection('phases').get();
      phaseSnap.forEach(d => {
        const p = d.data();
        if (!p.estHours || !p.actualHours) return;
        const trade = p.trade || 'General';
        if (!tradeStats[trade]) tradeStats[trade] = { totalEst:0, totalAct:0, count:0 };
        tradeStats[trade].totalEst += p.estHours;
        tradeStats[trade].totalAct += p.actualHours;
        tradeStats[trade].count++;
      });
    }

    const trades = Object.entries(tradeStats).sort((a,b) => b[1].count - a[1].count);
    if (!trades.length) {
      el.innerHTML = '<div class="small muted">No completed phases with actual hours yet. Log time against phases to build this analysis.</div>';
      return;
    }

    el.innerHTML = trades.map(([trade, stats]) => {
      const pct = stats.totalEst > 0 ? (stats.totalAct/stats.totalEst*100) : 0;
      const color = pct <= 100 ? '#34d399' : pct <= 120 ? '#f59e0b' : '#f87171';
      return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <div style="font-weight:700;font-size:.85rem">${esc(trade)}</div>
          <div style="font-size:.82rem;color:${color};font-weight:800">${pct.toFixed(0)}% <span style="color:var(--muted);font-weight:400">(${stats.count} phases)</span></div>
        </div>
        <div style="background:rgba(255,255,255,.06);border-radius:6px;height:8px;overflow:hidden">
          <div style="width:${Math.min(pct,150)}%;height:100%;background:${color};border-radius:6px;transition:width .5s"></div>
        </div>
        <div style="font-size:.73rem;color:var(--muted);margin-top:3px">${stats.totalAct.toFixed(1)}h actual vs ${stats.totalEst.toFixed(1)}h estimated</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="small muted">Could not load trade data.</div>';
  }
}

window.loadRetrospective = loadRetrospective;

// Boot
conLoadFirebase();
// Check for portal mode on every page load
checkPortalMode();


// ═══════════════════════════════════════════════════════════════════════
// JOBSpan Schedule Redesign — Epic/Feature/Task/Sprint data-model layer
// Added: 06/Jul/2026 · v1.9.17-prep
//
// STATUS: Additive only. Nothing in this file is called by existing UI yet.
// It introduces the new hierarchy as a layer ON TOP of the existing
// estimateGroups → subgroups → items tree, per the locked design:
//   Epic    = estimateGroups doc      (+ sprintEnabled)
//   Feature = subgroups doc           (+ status, sprintId, dependsOn,
//                                        assignedTeamLead, requestedStatus)
//   Task    = items doc                (+ taskStatus, assignedTo)
//   Sprint  = NEW jobs/{id}/sprints subcollection
//
// Nothing here mutates estimateGroups/subgroups/items on its own. New
// fields are only written by the explicit functions below, and only when
// called from real UI. The old `phases` collection is untouched by this
// file — see migrate-phases-to-features.js for that (separate, gated script).
// ═══════════════════════════════════════════════════════════════════════

// ── Reads: walk the tree as Epic → Feature → Task ──────────────────────

/**
 * Load the full Epic→Feature→Task tree for a job, in the new vocabulary.
 * Read-only. Returns a plain JS structure, does not touch conJobs/estGroups.
 *
 * Shape returned:
 * [{ id, name, order, sprintEnabled, features: [
 *      { id, name, order, status, sprintId, dependsOn, assignedTeamLead,
 *        requestedStatus, tasks: [
 *          { id, name, qty, cost, price, taskStatus, assignedTo }
 *        ]
 *      }
 *  ]}]
 */
function loadEpicTree(jobId) {
  const jobRef = coll('jobs').doc(jobId);
  return jobRef.collection('estimateGroups').get()
    .then(async groupSnap => {
      const epics = [];
      for (const groupDoc of groupSnap.docs) {
        const epicData = groupDoc.data();
        const epic = {
          id: groupDoc.id,
          name: epicData.name,
          order: epicData.order || 0,
          sprintEnabled: !!epicData.sprintEnabled,
          features: [],
        };

        const subSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id)
          .collection('subgroups').get();

        for (const subDoc of subSnap.docs) {
          const featData = subDoc.data();
          const feature = {
            id: subDoc.id,
            name: featData.name,
            order: featData.order || 0,
            status: featData.status || 'not-started',
            sprintId: featData.sprintId || null,
            dependsOn: featData.dependsOn || [],
            assignedTeamLead: featData.assignedTeamLead || null,
            requestedStatus: featData.requestedStatus || null,
            tasks: [],
          };

          const itemSnap = await jobRef.collection('estimateGroups').doc(groupDoc.id)
            .collection('subgroups').doc(subDoc.id).collection('items').get();

          itemSnap.forEach(itemDoc => {
            const t = itemDoc.data();
            feature.tasks.push({
              id: itemDoc.id,
              name: t.desc || t.name || t.description || '(unnamed task)',
              qty: t.qty || 0,
              cost: t.unitCost || t.cost || 0,
              price: t.unitPrice || t.price || 0,
              taskStatus: t.taskStatus || 'todo',
              assignedTo: t.assignedTo || null,
            });
          });

          epic.features.push(feature);
        }
        epic.features.sort((a, b) => a.order - b.order);
        epics.push(epic);
      }
      epics.sort((a, b) => a.order - b.order);
      return epics;
    });
}
window.loadEpicTree = loadEpicTree;

/**
 * Task-checklist progress for a single Feature, e.g. "6/9 tasks done".
 * Pure function, no Firestore access — pass it a feature from loadEpicTree().
 */
function featureTaskProgress(feature) {
  const total = feature.tasks.length;
  const done = feature.tasks.filter(t => t.taskStatus === 'done').length;
  return { done, total, label: `${done}/${total} tasks done` };
}
window.featureTaskProgress = featureTaskProgress;

/**
 * Auto-suggest logic: when all Tasks under a Feature are done, the system
 * suggests a requestedStatus of 'complete' (per locked design — this does
 * NOT commit status, only sets the suggestion field for PM review).
 * Pure function — caller is responsible for writing the result to Firestore.
 */
function suggestedRequestedStatus(feature) {
  if (!feature.tasks.length) return null;
  const allDone = feature.tasks.every(t => t.taskStatus === 'done');
  return allDone && feature.status !== 'complete' ? 'complete' : null;
}
window.suggestedRequestedStatus = suggestedRequestedStatus;

// ── Writes: gated by the three-tier authority model ────────────────────
// These are the ONLY functions that should ever write status/requestedStatus.
// UI (board drag-drop) should call these, never write Firestore directly,
// so the authority model stays enforced in one place.

/**
 * Team Lead drags a Feature card. Does NOT commit `status` — only sets
 * `requestedStatus` for Owner/PM review, per the locked stage-authority model.
 * Safe to call for both auto-suggest and manual Team Lead requests.
 */
function requestFeatureStatus(jobId, epicId, featureId, requestedStatus) {
  if (!hasPermission('phases') && !isOwnerOrAdmin()) {
    return Promise.reject(new Error('No permission to request status changes'));
  }
  return coll('jobs').doc(jobId)
    .collection('estimateGroups').doc(epicId)
    .collection('subgroups').doc(featureId)
    .update({
      requestedStatus,
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      requestedBy: (conAuth.currentUser && conAuth.currentUser.email) || null,
    });
}
window.requestFeatureStatus = requestFeatureStatus;

/**
 * Owner/PM commits a Feature's status. This is the ONLY path that writes
 * the real `status` field — reused by both a direct Owner drag AND approving
 * a Team Lead's pending request (per locked design: "Approving a Team Lead's
 * request also just calls the same commit path").
 */
function commitFeatureStatus(jobId, epicId, featureId, newStatus) {
  if (!isOwnerOrAdmin()) {
    return Promise.reject(new Error('Only Owner/PM can commit status changes'));
  }
  return coll('jobs').doc(jobId)
    .collection('estimateGroups').doc(epicId)
    .collection('subgroups').doc(featureId)
    .update({
      status: newStatus,
      requestedStatus: null, // clear the pending request once committed
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
}
window.commitFeatureStatus = commitFeatureStatus;

/**
 * Field crew (any role) marks a Task done/in-progress. Task-level only —
 * per locked design, non-leads get NO Feature-level stage-change UI at all.
 */
function updateTaskStatus(jobId, epicId, featureId, taskId, taskStatus) {
  return coll('jobs').doc(jobId)
    .collection('estimateGroups').doc(epicId)
    .collection('subgroups').doc(featureId)
    .collection('items').doc(taskId)
    .update({
      taskStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
}
window.updateTaskStatus = updateTaskStatus;

// ── Sprints (new top-level subcollection) ──────────────────────────────

function loadSprints(jobId) {
  return coll('jobs').doc(jobId).collection('sprints').orderBy('startDate').get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
window.loadSprints = loadSprints;

function createSprint(jobId, sprintFields) {
  const name = sprintFields.name;
  const startDate = sprintFields.startDate;
  const endDate = sprintFields.endDate;
  const status = sprintFields.status || 'planned';
  if (!isOwnerOrAdmin()) {
    return Promise.reject(new Error('Only Owner/PM can create sprints'));
  }
  return coll('jobs').doc(jobId).collection('sprints').add({
    name: name, startDate: startDate, endDate: endDate, status: status,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
window.createSprint = createSprint;

// ── Dependency check (for Gantt warnings) ──────────────────────────────

/**
 * Given a Feature and a featureId->feature lookup map, returns a warning
 * string if any of its dependsOn Features are not yet complete, or null
 * if clear. e.g. "Electrical can't start — Framing not done."
 */
function dependencyWarning(feature, allFeaturesById) {
  if (!feature.dependsOn || !feature.dependsOn.length) return null;
  const blockers = feature.dependsOn
    .map(function(id) { return allFeaturesById[id]; })
    .filter(function(f) { return f && f.status !== 'complete'; });
  if (!blockers.length) return null;
  const names = blockers.map(function(f) { return f.name; }).join(', ');
  return feature.name + " can't start — " + names + ' not done.';
}
window.dependencyWarning = dependencyWarning;

/**
 * Flatten an epic tree into a featureId -> feature lookup map, needed by
 * dependencyWarning() to resolve dependsOn references across Epics.
 */
function flattenFeaturesById(epics) {
  const map = {};
  epics.forEach(function(epic) {
    epic.features.forEach(function(f) { map[f.id] = f; });
  });
  return map;
}
window.flattenFeaturesById = flattenFeaturesById;

// ═══════════════════════════════════════════════════════════════════════
// JOBSpan Board View — Epic/Feature/Task Kanban
// Added: 06/Jul/2026 · v1.9.19
//
// Renders the estimateGroups→subgroups tree as Epic/Feature cards in the
// same 4-lane layout as the existing Phases Kanban. Uses tap-based
// Request/Approve buttons instead of drag-and-drop (native HTML5 drag is
// unreliable on iPad Safari) — functionally equivalent to the locked
// three-tier authority model:
//   Field crew    -> tap tasks done/in-progress only, no status UI
//   Team Lead     -> "Request move" button -> sets requestedStatus only
//   Owner/PM      -> "Move to..." buttons that commit status directly,
//                    or "Approve" a pending Team Lead request
// ═══════════════════════════════════════════════════════════════════════

let _boardEpics = [];          // last-loaded epic tree for the open job
let _boardFeaturesById = {};   // flattened lookup, for dependency warnings
let _boardOpenFeature = null;  // {epicId, epicName, feature} currently in the modal

const BOARD_LANES = {
  'not-started': { el: 'boardLane0', count: 'boardCount0' },
  'in-progress': { el: 'boardLane1', count: 'boardCount1' },
  'complete':    { el: 'boardLane2', count: 'boardCount2' },
  'blocked':     { el: 'boardLane3', count: 'boardCount3' },
};

function renderEpicBoard() {
  if (!conCurrentJobId) return;
  const lanes = {};
  Object.entries(BOARD_LANES).forEach(([status, ids]) => {
    lanes[status] = document.getElementById(ids.el);
    if (lanes[status]) lanes[status].innerHTML = '<div class="small muted" style="padding:8px">Loading…</div>';
  });

  loadEpicTree(conCurrentJobId).then(epics => {
    _boardEpics = epics;
    _boardFeaturesById = flattenFeaturesById(epics);

    const counts = { 'not-started':0, 'in-progress':0, 'complete':0, 'blocked':0 };
    Object.values(lanes).forEach(l => { if (l) l.innerHTML = ''; });

    const hasFeatures = epics.some(e => e.features.length);
    const hasPhases = (conPhases || []).length > 0;

    if (!hasFeatures && !hasPhases) {
      const emptyLane = lanes['not-started'];
      if (emptyLane) emptyLane.innerHTML = '<div class="small muted" style="padding:8px">Nothing on the board yet. Add items to the Estimate tab, or use + Add Phase.</div>';
      Object.entries(BOARD_LANES).forEach(([status, ids]) => {
        const el = document.getElementById(ids.count); if (el) el.textContent = '0';
      });
      return;
    }

    // ── Legacy Phase cards (older jobs / manually-added phases) ──
    (conPhases || []).forEach(phase => {
      const status = phase.status || 'not-started';
      counts[status] = (counts[status] || 0) + 1;
      const lane = lanes[status];
      if (!lane) return;
      const color = phase.color || '#d97706';
      const estH = phase.estHours || 0;
      const actH = phase._actualHours || 0;

      const card = document.createElement('div');
      card.className = 'phase-card';
      card.onclick = () => openEditPhaseModal(phase.id);
      card.innerHTML =
        '<div class="phase-card-accent" style="background:' + color + '"></div>' +
        '<div class="phase-card-name">' + esc(phase.name) + '</div>' +
        '<div class="phase-card-meta">' +
          (phase.assigned ? '👤 ' + esc(phase.assigned) + '<br>' : '') +
          (phase.trade ? '🔧 ' + esc(phase.trade) + '<br>' : '') +
          '⏱️ ' + actH.toFixed(1) + 'h / ' + estH.toFixed(1) + 'h est' +
        '</div>';
      lane.appendChild(card);
    });

    // ── Feature cards (Estimate-driven Epic/Feature/Task model) ──
    epics.forEach(epic => {
      epic.features.forEach(feature => {
        const status = feature.status || 'not-started';
        counts[status] = (counts[status] || 0) + 1;
        const lane = lanes[status];
        if (!lane) return;

        const progress = featureTaskProgress(feature);
        const warning = dependencyWarning(feature, _boardFeaturesById);
        const pendingBadge = feature.requestedStatus
          ? `<span style="background:rgba(217,119,6,.2);color:var(--amber);padding:1px 7px;border-radius:999px;font-size:.68rem;font-weight:700">⏳ ${esc(feature.requestedStatus)} requested</span>`
          : '';

        const card = document.createElement('div');
        card.className = 'phase-card';
        card.onclick = () => openFeatureModal(epic.id, epic.name, feature);
        card.innerHTML =
          '<div class="phase-card-accent" style="background:' + (warning ? '#f87171' : '#d97706') + '"></div>' +
          '<div class="phase-card-name">' + esc(feature.name) +
            (warning ? ' <span style="color:#f87171;font-size:.7rem">⚠ blocked</span>' : '') + '</div>' +
          '<div class="phase-card-meta">' +
            '🗂️ ' + esc(epic.name) + '<br>' +
            '✅ ' + progress.label +
            (feature.assignedTeamLead ? '<br>👤 ' + esc(feature.assignedTeamLead) : '') +
          '</div>' +
          (pendingBadge ? '<div style="padding:6px 0 0 8px">' + pendingBadge + '</div>' : '');
        lane.appendChild(card);
      });
    });

    Object.entries(BOARD_LANES).forEach(([status, ids]) => {
      const el = document.getElementById(ids.count);
      if (el) el.textContent = counts[status] || 0;
    });
  }).catch(err => {
    Object.values(lanes).forEach(l => { if (l) l.innerHTML = ''; });
    const first = lanes['not-started'];
    if (first) first.innerHTML = '<div class="small" style="padding:8px;color:#f87171">Error loading board: ' + esc(err.message) + '</div>';
  });
}
window.renderEpicBoard = renderEpicBoard;

function closeFeatureModal() {
  kClose('featureDetailModal');
  renderEpicBoard();
}
window.closeFeatureModal = closeFeatureModal;

function openFeatureModal(epicId, epicName, feature) {
  _boardOpenFeature = { epicId, epicName, feature };
  document.getElementById('featureEpicName').textContent = '🗂️ ' + epicName;
  document.getElementById('featureModalTitle').textContent = feature.name;

  const metaEl = document.getElementById('featureMeta');
  metaEl.innerHTML =
    'Status: <b>' + esc(feature.status || 'not-started') + '</b>' +
    (feature.assignedTeamLead ? ' · Team Lead: ' + esc(feature.assignedTeamLead) : '') +
    (feature.dependsOn && feature.dependsOn.length ? '<br>Depends on: ' + feature.dependsOn.map(id => esc((_boardFeaturesById[id]||{}).name || id)).join(', ') : '');

  const warning = dependencyWarning(feature, _boardFeaturesById);
  const banner = document.getElementById('featureRequestBanner');
  const suggestion = suggestedRequestedStatus(feature);
  if (warning) {
    banner.style.display = 'block';
    banner.innerHTML = '<div style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:8px 12px;color:#f87171;font-size:.82rem">⚠ ' + esc(warning) + '</div>';
  } else if (feature.requestedStatus) {
    banner.style.display = 'block';
    banner.innerHTML = '<div style="background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.3);border-radius:8px;padding:8px 12px;color:var(--amber);font-size:.82rem">⏳ ' + esc(feature.assignedTeamLead || 'A Team Lead') + ' requested moving this to <b>' + esc(feature.requestedStatus) + '</b>.</div>';
  } else if (suggestion && isOwnerOrAdmin()) {
    banner.style.display = 'block';
    banner.innerHTML = '<div style="background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);border-radius:8px;padding:8px 12px;color:#34d399;font-size:.82rem;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
      '<span>✅ All tasks done — mark this Feature as complete?</span>' +
      '<button class="btn-amber" style="padding:5px 12px;font-size:.78rem" onclick="commitBoardStatus(\'complete\')">Mark Complete</button></div>';
  } else {
    banner.style.display = 'none';
    banner.innerHTML = '';
  }

  renderFeatureTaskList(feature);
  renderFeatureStatusActions(feature);
  kOpen('featureDetailModal');
}
window.openFeatureModal = openFeatureModal;

function renderFeatureTaskList(feature) {
  const listEl = document.getElementById('featureTaskList');
  if (!feature.tasks.length) {
    listEl.innerHTML = '<div class="small muted">No tasks yet. Add line items to this Feature in the Estimate tab.</div>';
    return;
  }
  listEl.innerHTML = feature.tasks.map(t => {
    const done = t.taskStatus === 'done';
    return '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(8,18,36,.6);border:1px solid rgba(110,145,210,.12);border-radius:8px;cursor:pointer">' +
      '<input type="checkbox" ' + (done ? 'checked' : '') + ' onchange="toggleBoardTask(\'' + t.id + '\', this.checked)" style="width:16px;height:16px;flex-shrink:0">' +
      '<span style="' + (done ? 'text-decoration:line-through;color:var(--muted)' : '') + ';font-size:.85rem">' + esc(t.name) + '</span>' +
      (t.assignedTo ? '<span class="small muted" style="margin-left:auto">' + esc(t.assignedTo) + '</span>' : '') +
    '</label>';
  }).join('');
}

function toggleBoardTask(taskId, checked) {
  if (!_boardOpenFeature) return;
  const { epicId, feature } = _boardOpenFeature;
  updateTaskStatus(conCurrentJobId, epicId, feature.id, taskId, checked ? 'done' : 'todo')
    .then(() => {
      // Reflect locally so the checklist + auto-suggest banner update
      // without a full board reload.
      const t = feature.tasks.find(x => x.id === taskId);
      if (t) t.taskStatus = checked ? 'done' : 'todo';
      renderFeatureTaskList(feature);
      renderEpicBoard(); // keep the card's "x/y tasks done" count in sync live
      const suggestion = suggestedRequestedStatus(feature);
      if (suggestion && isOwnerOrAdmin()) {
        // Owner viewing it themselves — just show the option, don't auto-write.
      }
      if (suggestion && !isOwnerOrAdmin()) {
        requestFeatureStatus(conCurrentJobId, epicId, feature.id, suggestion).then(() => {
          feature.requestedStatus = suggestion;
          openFeatureModal(epicId, _boardOpenFeature.epicName, feature);
        }).catch(() => {});
      }
    })
    .catch(err => alert('Error updating task: ' + err.message));
}
window.toggleBoardTask = toggleBoardTask;

function renderFeatureStatusActions(feature) {
  const el = document.getElementById('featureStatusActions');
  const epicId = _boardOpenFeature.epicId;
  const owner = isOwnerOrAdmin();
  const statuses = ['not-started', 'in-progress', 'complete', 'blocked'];
  let html = '';

  if (owner) {
    if (feature.requestedStatus) {
      html += '<button class="btn-amber" onclick="approveBoardRequest()">✓ Approve → ' + esc(feature.requestedStatus) + '</button>' +
              '<button class="btn" onclick="dismissBoardRequest()">Dismiss request</button>';
    }
    html += '<div style="width:100%;font-size:.72rem;color:var(--muted);margin:8px 0 4px">Move to:</div>';
    statuses.filter(s => s !== (feature.status||'not-started')).forEach(s => {
      html += '<button class="btn" onclick="commitBoardStatus(\'' + s + '\')">' + esc(s) + '</button>';
    });
  } else {
    if (feature.requestedStatus) {
      html += '<div class="small muted">Request pending Owner/PM approval.</div>';
    } else {
      html += '<div style="width:100%;font-size:.72rem;color:var(--muted);margin-bottom:4px">Request move to:</div>';
      statuses.filter(s => s !== (feature.status||'not-started')).forEach(s => {
        html += '<button class="btn" onclick="requestBoardStatus(\'' + s + '\')">' + esc(s) + '</button>';
      });
    }
  }
  el.innerHTML = html;
}

function requestBoardStatus(newStatus) {
  if (!_boardOpenFeature) return;
  const { epicId, feature } = _boardOpenFeature;
  requestFeatureStatus(conCurrentJobId, epicId, feature.id, newStatus)
    .then(() => { feature.requestedStatus = newStatus; openFeatureModal(epicId, _boardOpenFeature.epicName, feature); renderEpicBoard(); })
    .catch(err => alert('Error: ' + err.message));
}
window.requestBoardStatus = requestBoardStatus;

function commitBoardStatus(newStatus) {
  if (!_boardOpenFeature) return;
  const { epicId, feature } = _boardOpenFeature;
  commitFeatureStatus(conCurrentJobId, epicId, feature.id, newStatus)
    .then(() => { feature.status = newStatus; feature.requestedStatus = null; kClose('featureDetailModal'); renderEpicBoard(); })
    .catch(err => alert('Error: ' + err.message));
}
window.commitBoardStatus = commitBoardStatus;

function approveBoardRequest() {
  if (!_boardOpenFeature) return;
  const { epicId, feature } = _boardOpenFeature;
  commitFeatureStatus(conCurrentJobId, epicId, feature.id, feature.requestedStatus)
    .then(() => { feature.status = feature.requestedStatus; feature.requestedStatus = null; kClose('featureDetailModal'); renderEpicBoard(); })
    .catch(err => alert('Error: ' + err.message));
}
window.approveBoardRequest = approveBoardRequest;

function dismissBoardRequest() {
  if (!_boardOpenFeature) return;
  const { epicId, feature } = _boardOpenFeature;
  requestFeatureStatus(conCurrentJobId, epicId, feature.id, null)
    .then(() => { feature.requestedStatus = null; openFeatureModal(epicId, _boardOpenFeature.epicName, feature); renderEpicBoard(); })
    .catch(err => alert('Error: ' + err.message));
}
window.dismissBoardRequest = dismissBoardRequest;
