// === Business Configuration ===
const WORKER_URL = 'https://lead-manager-api.irontigerdigital.workers.dev';

const BUSINESSES = [
  // Legacy live sites
  { id: 'phxpool',     name: 'PHX Pool Resurfacing',          short: 'PHX Pool',     number: '+16232949154', color: '#06b6d4' },
  { id: 'sapool',      name: 'SA Pool Resurfacing',           short: 'SA Pool',      number: '+17262685597', color: '#0ea5e9' },
  { id: 'spokane',     name: 'Selkirk Hardwood',              short: 'Selkirk',      number: '+15094619375', color: '#c8a45a' },
  { id: 'elkhorn',     name: 'Elkhorn Hardwood',              short: 'Elkhorn',      number: '+17192158962', color: '#8B4513' },
  { id: 'peak',        name: 'Peak Shine Detailing',          short: 'Peak Shine',   number: '+14235891682', color: '#a855f7' },
  { id: 'knox',        name: 'Knox Pressure',                 short: 'Knox',         number: '+18653788377', color: '#22c55e' },
  { id: 'springs',     name: 'Springs Mold',                  short: 'Springs',      number: '+17194968287', color: '#f97316' },
  { id: 'huntsville',  name: 'Huntsville HVAC',               short: 'Huntsville',   number: '+12562159287', color: '#9333ea' },
  { id: 'tampa',       name: 'Tampa Concrete',                short: 'Tampa',        number: '+18137059021', color: '#4a90d9' },
  { id: 'jax',         name: 'Jacksonville Epoxy',            short: 'Jax Epoxy',    number: '+19042044753', color: '#f59e0b' },
  { id: 'tulsa',       name: 'Tulsa Water Damage',            short: 'Tulsa',        number: '+19187232096', color: '#dc2626' },
  { id: 'poolusa',     name: 'Pool Resurfacing USA',          short: 'Pool USA',     number: '+18137233209', color: '#1d4ed8' },
  // New builds
  { id: 'jonesboro',   name: 'Delta Tree Doctors',            short: 'Delta Tree',   number: '+18707713364', color: '#16a34a' },
  { id: 'mckinney',    name: 'NTX Tree Experts',              short: 'NTX Tree',     number: '+14695296768', color: '#15803d' },
  { id: 'boulder',     name: 'Boulder Bathroom Remodeling',   short: 'Boulder Bath', number: '+17207347645', color: '#7c3aed' },
  { id: 'cedarrapids', name: 'Five Seasons Radon',            short: 'Five Seasons', number: '+13195285190', color: '#0891b2' },
  { id: 'lakecharles', name: 'Contraband Bayou Tree',         short: 'CB Tree',      number: '+13375482811', color: '#166534' },
  { id: 'lawton',      name: 'Comanche Tree Experts',         short: 'Comanche',     number: '+15807811781', color: '#14532d' },
  { id: 'spokane_htub',name: 'Inland NW Hot Tubs',            short: 'Inland NW',    number: '+15092367423', color: '#0369a1' },
  { id: 'batonrouge',  name: 'Red Stick Siding & Roof',       short: 'Red Stick',    number: '+12255354918', color: '#b91c1c' },
  { id: 'rapidcity',   name: 'Badlands Radon',                short: 'Badlands',     number: '+16056405642', color: '#78716c' },
  { id: 'lafayette',   name: 'Bayou Teche Septic',            short: 'Bayou Teche',  number: '+13374920960', color: '#65a30d' },
  { id: 'topeka',      name: 'Flint Hills Foundation',        short: 'Flint Hills',  number: '+17857064425', color: '#92400e' },
  { id: 'lkcbath',     name: 'Lake Charles Tile & Stone',     short: 'LC Tile',      number: '+13375208573', color: '#be185d' },
  { id: 'billings',    name: 'Rim Rock Radon',                short: 'Rim Rock',     number: '+14064767479', color: '#6d28d9' },
  { id: 'bloomington', name: 'Bloomington Bathroom',          short: 'Bloomington',  number: '+19529007486', color: '#0f766e' },
  { id: 'edmond',      name: 'Scissortail Bath',              short: 'Scissortail',  number: '+14052813672', color: '#c2410c' },
  { id: 'elkhorn_ne',  name: 'Elkhorn Hardwood NE',           short: 'Elkhorn NE',   number: '+14027714422', color: '#a16207' },
  { id: 'tally',       name: 'Tally Mobile Mechanic',         short: 'Tally Mech',   number: '+18507263411', color: '#0f4c81' },
];

// === State ===
let currentBiz = 0;
let conversations = {}; // { bizId: { phoneNumber: { messages: [], calls: [] } } }
let currentContact = null;
let unreadCounts = {};
let pullStartY = 0;
let crmContacts = {}; // { "+15551234567": { name: "Francisco", business: "ABC Plumbing" } }
let blockedCallers = new Set(); // fetched from worker on init

// === Config ===
const CONFIG_KEY = 'lead-mgr-config';
const AUTH_KEY = 'lead-mgr-auth';
const READ_KEY  = 'lead-mgr-read';

// === Read Tracking ===
function getReadTimestamps() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); }
  catch { return {}; }
}
function markConversationRead(bizId, contactNumber) {
  const reads = getReadTimestamps();
  reads[`${bizId}|${contactNumber}`] = Date.now();
  localStorage.setItem(READ_KEY, JSON.stringify(reads));
}
function isMessageUnread(msg, bizId, contactNumber) {
  if (!msg.direction.includes('inbound')) return false;
  const reads = getReadTimestamps();
  const lastRead = reads[`${bizId}|${contactNumber}`] || 0;
  const msgTime = new Date(msg.date_created || msg.date_sent).getTime();
  return msgTime > lastRead;
}

function getConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  const cfg = saved ? JSON.parse(saved) : {};
  cfg.workerUrl = WORKER_URL; // always hardcoded — no setup prompt needed
  cfg.pin = '7111';
  return cfg;
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  // Handle ?reset=1 — nuke caches + service worker, then reload clean
  if (new URLSearchParams(location.search).get('reset') === '1') {
    (async () => {
      // Clear all caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Unregister service workers
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      // Clear localStorage read state
      localStorage.removeItem(READ_KEY);
      // Redirect without ?reset
      location.replace(location.pathname);
    })();
    return;
  }

  // Check if configured
  const cfg = getConfig();

  // If no worker URL, show setup prompt
  if (!cfg.workerUrl) {
    showSetupPrompt();
    return;
  }

  // Check auth
  const authed = sessionStorage.getItem(AUTH_KEY);
  if (authed) {
    initApp(cfg);
  } else {
    showAuth();
  }
});

function showSetupPrompt() {
  const auth = document.getElementById('auth-screen');
  auth.innerHTML = `
    <div class="auth-container">
      <h1>🏠 Lead Manager</h1>
      <p>First-time setup</p>
      <input type="url" id="setup-url" value="https://lead-manager-api.irontigerdigital.workers.dev" placeholder="Cloudflare Worker URL" style="width:100%;max-width:320px;padding:12px;background:var(--bg2);border:2px solid var(--bg3);border-radius:var(--radius);color:var(--text);font-size:15px;outline:none;">
      <input type="text" id="setup-pin" placeholder="Set a PIN (4-6 digits)" inputmode="numeric" maxlength="6" style="width:200px;padding:12px;background:var(--bg2);border:2px solid var(--bg3);border-radius:var(--radius);color:var(--text);font-size:15px;text-align:center;outline:none;">
      <button id="setup-save" class="btn-primary">Save & Continue</button>
    </div>
  `;
  auth.classList.add('active');

  document.getElementById('setup-save').addEventListener('click', () => {
    const url = document.getElementById('setup-url').value.trim();
    const pin = document.getElementById('setup-pin').value.trim();
    if (!url || !pin) { toast('Fill in both fields'); return; }
    saveConfig({ workerUrl: url, pin });
    sessionStorage.setItem(AUTH_KEY, '1');
    initApp({ workerUrl: url, pin });
  });
}

function showAuth() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');

  const pinInput = document.getElementById('pin-input');
  const pinSubmit = document.getElementById('pin-submit');
  const authError = document.getElementById('auth-error');

  function tryAuth() {
    const cfg = getConfig();
    if (pinInput.value === cfg.pin) {
      authError.classList.add('hidden');
      sessionStorage.setItem(AUTH_KEY, '1');
      initApp(cfg);
    } else {
      authError.classList.remove('hidden');
      pinInput.value = '';
      pinInput.focus();
    }
  }

  pinSubmit.addEventListener('click', tryAuth);
  pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });
  pinInput.focus();
}

async function initApp(cfg) {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  TwilioAPI.init(cfg.workerUrl, cfg.pin);

  // Load CRM contacts for name lookups (non-blocking — dashboard still works without it)
  TwilioAPI.getContacts().then(data => {
    crmContacts = data.contacts || {};
    console.log(`CRM contacts loaded: ${Object.keys(crmContacts).length}`);
  }).catch(() => { /* silent fail — fallback to SMS parsing */ });

  // Load blocked callers list — filter spam from dashboard
  TwilioAPI.getBlockedCallers().then(data => {
    blockedCallers = new Set(data.blocked || []);
    console.log(`Blocked callers loaded: ${blockedCallers.size}`);
  }).catch(() => { /* silent fail */ });

  buildTabs();
  selectBiz(0);
  setupEventListeners();
  registerSW();
}

// === Service Worker ===
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('SW registered');
    } catch (e) {
      console.error('SW registration failed:', e);
    }
  }
}

// === Tabs ===
function buildTabs() {
  const nav = document.getElementById('biz-tabs');
  nav.innerHTML = BUSINESSES.map((b, i) => `
    <button class="biz-tab${i === 0 ? ' active' : ''}" data-idx="${i}" style="border-bottom-color: ${i === 0 ? b.color : 'transparent'}">
      ${b.short}
      <span class="badge hidden" id="badge-${b.id}">0</span>
    </button>
  `).join('');

  nav.addEventListener('click', e => {
    const tab = e.target.closest('.biz-tab');
    if (tab) selectBiz(parseInt(tab.dataset.idx));
  });

  // Site search/filter
  const searchInput = document.getElementById('site-search');
  const searchClear = document.getElementById('site-search-clear');
  
  searchInput.addEventListener('input', e => {
    const query = e.target.value.toLowerCase().trim();
    searchClear.classList.toggle('hidden', !query);
    
    // Filter tabs
    document.querySelectorAll('.biz-tab').forEach((tab, idx) => {
      const biz = BUSINESSES[idx];
      const match = !query || biz.label.toLowerCase().includes(query) || biz.short.toLowerCase().includes(query);
      tab.style.display = match ? '' : 'none';
    });
  });
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    document.querySelectorAll('.biz-tab').forEach(tab => tab.style.display = '');
    searchClear.classList.add('hidden');
  });
}

function selectBiz(idx) {
  currentBiz = idx;
  currentContact = null;

  // Update tabs
  document.querySelectorAll('.biz-tab').forEach((t, i) => {
    const biz = BUSINESSES[i];
    t.classList.toggle('active', i === idx);
    t.style.borderBottomColor = i === idx ? biz.color : 'transparent';
  });

  // Update header
  document.getElementById('current-biz-name').textContent = BUSINESSES[idx].name;

  // Show conversation list, hide detail
  document.getElementById('conversation-list').classList.remove('hidden');
  document.getElementById('conversation-detail').classList.add('hidden');

  loadBizData(idx);
}

// === Data Loading ===
async function loadBizData(idx) {
  const biz = BUSINESSES[idx];
  const list = document.getElementById('conversation-list');
  const loading = document.getElementById('loading');

  loading.classList.remove('hidden');
  list.innerHTML = '';

  try {
    const [msgData, callData] = await Promise.all([
      TwilioAPI.getMessages(biz.number),
      TwilioAPI.getCalls(biz.number)
    ]);

    const messages = msgData.messages || [];
    const calls = callData.calls || [];
    const spamBlocked = callData.spam_blocked || 0;

    // Show spam indicator in header if any spam was blocked
    const spamBadge = document.getElementById('spam-badge');
    if (spamBadge) {
      if (spamBlocked > 0) {
        spamBadge.textContent = `🚫 ${spamBlocked} spam blocked`;
        spamBadge.classList.remove('hidden');
      } else {
        spamBadge.classList.add('hidden');
      }
    }

    // Group messages by contact number
    const contactMap = {};

    messages.forEach(msg => {
      const contact = msg.direction === 'inbound' ? msg.from : msg.to;
      if (contact === biz.number) return; // skip self
      if (blockedCallers.has(contact)) return; // skip spam/blocked
      const key = contact;
      if (!contactMap[key]) contactMap[key] = { number: contact, messages: [], calls: [], lastActivity: null };
      contactMap[key].messages.push(msg);
      const d = new Date(msg.date_created || msg.date_sent);
      if (!contactMap[key].lastActivity || d > contactMap[key].lastActivity) contactMap[key].lastActivity = d;
    });

    const COSTA_PERSONAL = '+17344761457'; // Never show on dashboard — Costa's personal callback number
    calls.forEach(call => {
      // Skip Twilio forwarding legs — these are outbound dials to the business/associate, not customers
      if (call.direction === 'outbound-dial' || call.direction === 'outbound-api') return;
      const contact = call.direction === 'inbound' ? call.from : call.to;
      if (contact === biz.number) return;
      if (contact === COSTA_PERSONAL) return; // Skip Costa's own outbound callbacks
      if (blockedCallers.has(contact)) return; // Skip spam/blocked numbers
      const key = contact;
      if (!contactMap[key]) contactMap[key] = { number: contact, messages: [], calls: [], lastActivity: null };
      contactMap[key].calls.push(call);
      const d = new Date(call.date_created || call.start_time);
      if (!contactMap[key].lastActivity || d > contactMap[key].lastActivity) contactMap[key].lastActivity = d;
    });

    // Store and sort
    conversations[biz.id] = contactMap;
    const sorted = Object.values(contactMap).sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));

    loading.classList.add('hidden');

    if (sorted.length === 0) {
      list.innerHTML = '<div class="empty-state"><span class="emoji">📭</span><p>No conversations yet</p></div>';
      return;
    }

    list.innerHTML = sorted.map(contact => {
      const lastMsg = contact.messages.sort((a, b) => new Date(b.date_created || b.date_sent) - new Date(a.date_created || a.date_sent))[0];
      const lastCall = contact.calls.sort((a, b) => new Date(b.date_created || b.start_time) - new Date(a.date_created || a.start_time))[0];

      let preview = '';
      let previewIcon = '';
      let lastTime = contact.lastActivity;

      if (lastMsg && (!lastCall || new Date(lastMsg.date_created || lastMsg.date_sent) > new Date(lastCall.date_created || lastCall.start_time))) {
        preview = lastMsg.body || '';
        previewIcon = lastMsg.direction === 'outbound-api' || lastMsg.direction === 'outbound' ? '↗ ' : '';
      } else if (lastCall) {
        const dur = formatDuration(lastCall.duration);
        preview = `${lastCall.direction === 'inbound' ? '📥' : '📤'} Call ${dur}`;
      }

      const unread = contact.messages.filter(m => isMessageUnread(m, biz.id, contact.number)).length;
      const contactName = getContactName(contact.number, contact);
      const contactBiz  = getContactBusiness(contact.number);
      const avatarText  = contactName ? nameInitials(contactName) : contact.number.replace(/\D/g,'').slice(1,4);
      const displayName = contactName
        ? (contactBiz ? `${contactName} — ${contactBiz}` : contactName)
        : formatPhone(contact.number);

      return `
        <div class="conv-item" data-number="${contact.number}">
          <div class="conv-avatar" style="background:${biz.color}">${avatarText}</div>
          <div class="conv-info">
            <div class="conv-name">${escapeHtml(displayName)}</div>
            <div class="conv-preview">${previewIcon}${escapeHtml(preview.substring(0, 60))}</div>
          </div>
          <div class="conv-meta">
            <span class="conv-time">${formatTime(lastTime)}</span>
            ${unread > 0 ? `<span class="conv-unread">${unread}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Update badge
    const totalUnread = sorted.reduce((sum, c) => sum + c.messages.filter(m => isMessageUnread(m, biz.id, c.number)).length, 0);
    updateBadge(biz.id, totalUnread);

  } catch (err) {
    loading.classList.add('hidden');
    list.innerHTML = `<div class="empty-state"><span class="emoji">⚠️</span><p>Error loading data</p><p style="font-size:13px;color:var(--red)">${escapeHtml(err.message)}</p></div>`;
  }
}

// === Conversation Detail ===
function openConversation(contactNumber) {
  currentContact = contactNumber;
  const biz = BUSINESSES[currentBiz];
  const contact = conversations[biz.id]?.[contactNumber];
  if (!contact) return;

  // Mark conversation as read
  markConversationRead(biz.id, contactNumber);

  document.getElementById('conversation-list').classList.add('hidden');
  document.getElementById('conversation-detail').classList.remove('hidden');
  const detailName = getContactName(contactNumber, contact);
  const detailBiz  = getContactBusiness(contactNumber);
  document.getElementById('detail-contact').textContent = detailName
    ? `${detailName}${detailBiz ? ' · ' + detailBiz : ''} · ${formatPhone(contactNumber)}`
    : formatPhone(contactNumber);

  // Recompute badge for this biz (clear unread count)
  const bizConvs = conversations[biz.id] ? Object.values(conversations[biz.id]) : [];
  const newTotal = bizConvs.reduce((sum, c) => sum + c.messages.filter(m => isMessageUnread(m, biz.id, c.number)).length, 0);
  updateBadge(biz.id, newTotal);

  // Merge messages and calls chronologically
  const items = [];

  contact.messages.forEach(msg => {
    items.push({
      type: 'message',
      date: new Date(msg.date_created || msg.date_sent),
      direction: msg.direction.includes('outbound') ? 'outgoing' : 'incoming',
      body: msg.body,
      status: msg.status
    });
  });

  contact.calls.forEach(call => {
    items.push({
      type: 'call',
      date: new Date(call.date_created || call.start_time),
      direction: call.direction,
      duration: call.duration,
      status: call.status
    });
  });

  items.sort((a, b) => a.date - b.date);

  const container = document.getElementById('messages-container');
  container.innerHTML = items.map(item => {
    if (item.type === 'message') {
      return `
        <div class="msg-bubble ${item.direction}">
          ${escapeHtml(item.body)}
          <div class="msg-time">${formatDateTime(item.date)}</div>
        </div>
      `;
    } else {
      const icon = item.direction === 'inbound' ? '📥' : '📤';
      const dur = formatDuration(item.duration);
      const missed = item.status === 'no-answer' || item.status === 'busy' || item.status === 'canceled';
      return `
        <div class="call-entry" data-number="${contactNumber}" style="${missed ? 'color:var(--red)' : ''}">
          ${icon} ${missed ? 'Missed call' : `Call ${dur}`} · ${formatDateTime(item.date)}
        </div>
      `;
    }
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Focus input
  document.getElementById('msg-input').focus();
}

// === Send Message ===
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const body = input.value.trim();
  if (!body || !currentContact) return;

  const biz = BUSINESSES[currentBiz];
  input.value = '';
  input.disabled = true;

  try {
    await TwilioAPI.sendMessage(biz.number, currentContact, body);

    // Add to UI immediately
    const container = document.getElementById('messages-container');
    container.innerHTML += `
      <div class="msg-bubble outgoing">
        ${escapeHtml(body)}
        <div class="msg-time">${formatDateTime(new Date())}</div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;
    toast('Message sent');
  } catch (err) {
    toast('Send failed: ' + err.message);
    input.value = body;
  }

  input.disabled = false;
  input.focus();
}

// === Click to Call ===
function showCallModal(customerNumber) {
  const biz = BUSINESSES[currentBiz];
  document.getElementById('call-modal-info').textContent =
    `Call ${formatPhone(customerNumber)} from ${biz.name}?`;
  document.getElementById('call-modal').classList.remove('hidden');

  document.getElementById('call-confirm').onclick = async () => {
    document.getElementById('call-modal').classList.add('hidden');
    toast('Initiating call…');
    try {
      await TwilioAPI.initiateCall(biz.number, customerNumber);
      toast('Call initiated! Check your phone.');
    } catch (err) {
      toast('Call failed: ' + err.message);
    }
  };
}

// === Event Listeners ===
function setupEventListeners() {
  // Conversation click
  document.getElementById('conversation-list').addEventListener('click', e => {
    const item = e.target.closest('.conv-item');
    if (item) openConversation(item.dataset.number);
  });

  // Back button — re-render list so read badges clear
  document.getElementById('btn-back').addEventListener('click', () => {
    currentContact = null;
    document.getElementById('conversation-detail').classList.add('hidden');
    document.getElementById('conversation-list').classList.remove('hidden');
    loadBizData(currentBiz);
  });

  // Send message
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });

  // Call button in detail header
  document.getElementById('btn-call').addEventListener('click', () => {
    if (currentContact) showCallModal(currentContact);
  });

  // Call entries in conversation
  document.getElementById('messages-container').addEventListener('click', e => {
    const entry = e.target.closest('.call-entry');
    if (entry) showCallModal(entry.dataset.number);
  });

  // Call modal cancel
  document.getElementById('call-cancel').addEventListener('click', () => {
    document.getElementById('call-modal').classList.add('hidden');
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (currentContact) {
      openConversation(currentContact);
    }
    loadBizData(currentBiz);
    toast('Refreshing…');
  });

  // Notifications
  document.getElementById('btn-notifications').addEventListener('click', async () => {
    toast('Requesting notification permission…');
    const ok = await PushManager2.setup();
    toast(ok ? 'Notifications enabled!' : 'Notifications not available');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  // Pull to refresh on conversation list
  let pulling = false;
  const content = document.getElementById('content');
  content.addEventListener('touchstart', e => {
    if (content.scrollTop === 0) pullStartY = e.touches[0].clientY;
  });
  content.addEventListener('touchmove', e => {
    if (pullStartY && e.touches[0].clientY - pullStartY > 80 && !pulling) {
      pulling = true;
      toast('Refreshing…');
      loadBizData(currentBiz).then(() => { pulling = false; });
    }
  });
  content.addEventListener('touchend', () => { pullStartY = 0; });

  // Stats overlay
  document.getElementById('btn-stats').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.remove('hidden');
    loadPortfolioStats(false);
  });
  document.getElementById('stats-close').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.add('hidden');
  });
  document.getElementById('stats-refresh').addEventListener('click', () => {
    loadPortfolioStats(true);
  });

  // Auto-refresh every 30 seconds
  setInterval(() => {
    if (!document.hidden) loadBizData(currentBiz);
  }, 30000);
}

// === Contact name lookup — CRM first, SMS parse fallback ===
function getContactName(phoneNumber, contact) {
  // 1. CRM lookup (source of truth)
  const crm = crmContacts[phoneNumber];
  if (crm && crm.name) return crm.name;

  // 2. SMS body parse — first name ONLY (we never send last names in outreach)
  const outbounds = (contact.messages || [])
    .filter(m => m.direction === 'outbound-api' || m.direction === 'outbound')
    .sort((a, b) => new Date(a.date_created || a.date_sent) - new Date(b.date_created || b.date_sent));

  for (const msg of outbounds) {
    if (!msg.body) continue;
    // "Hey Name," pattern
    const hey = msg.body.match(/^Hey ([A-Z][a-z'-]{1,20})[,!]/);
    if (hey) return hey[1];
    // "Name," at very start
    const start = msg.body.match(/^([A-Z][a-z'-]{1,20}),/);
    if (start) return start[1];
  }

  return null;
}

// Returns business name from CRM if available
function getContactBusiness(phoneNumber) {
  const crm = crmContacts[phoneNumber];
  return crm && crm.business ? crm.business : null;
}

// Returns initials from a name: "Francisco" → "F", "Francisco M" → "FM"
function nameInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

// === Helpers ===
function formatPhone(number) {
  if (!number) return '';
  const clean = number.replace(/\D/g, '');
  if (clean.length === 11 && clean[0] === '1') {
    return `(${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7)}`;
  }
  return number;
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;

  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds || seconds === '0') return '';
  const s = parseInt(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s/60)}m ${s%60}s`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateBadge(bizId, count) {
  const badge = document.getElementById(`badge-${bizId}`);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// === Portfolio Stats ===
const STATS_CACHE_KEY = 'lead-mgr-portfolio-stats';
const STATS_CACHE_TTL = 30 * 60 * 1000; // 30 min

async function loadPortfolioStats(bustCache) {
  const grid = document.getElementById('stats-grid');
  const summary = document.getElementById('stats-summary');

  // Check localStorage cache first (unless busting)
  if (!bustCache) {
    try {
      const cached = localStorage.getItem(STATS_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < STATS_CACHE_TTL) {
          renderStats(data);
          return;
        }
      }
    } catch (e) { /* cache miss */ }
  }

  grid.innerHTML = '<div class="spinner"></div>';
  summary.innerHTML = '';

  try {
    const data = await TwilioAPI.getPortfolioStats(bustCache);
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    renderStats(data);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><span class="emoji">⚠️</span><p>Error loading stats</p><p style="font-size:13px;color:var(--red)">${escapeHtml(err.message)}</p></div>`;
  }
}

function renderStats(data) {
  const grid = document.getElementById('stats-grid');
  const summary = document.getElementById('stats-summary');
  const sites = data.sites || [];

  // Sort: tenants first, then by total_calls desc
  sites.sort((a, b) => {
    if (a.has_tenant !== b.has_tenant) return b.has_tenant ? 1 : -1;
    return b.total_calls - a.total_calls;
  });

  const totalCalls = sites.reduce((s, x) => s + x.total_calls, 0);
  const totalQualified = sites.reduce((s, x) => s + x.qualified_calls, 0);
  const totalTenants = sites.filter(x => x.has_tenant).length;

  summary.innerHTML = `
    <span class="stat-pill">${sites.length} sites</span>
    <span class="stat-pill blue">${totalCalls} calls</span>
    <span class="stat-pill green">${totalQualified} qualified</span>
    <span class="stat-pill tenant">${totalTenants} tenants</span>
  `;

  grid.innerHTML = sites.map(site => {
    const fwd = site.forwarding_to.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
    return `
      <div class="stat-card">
        <div class="stat-card-name">${escapeHtml(site.label)}</div>
        <div class="stat-card-badges">
          <span class="stat-badge blue">${site.total_calls} calls</span>
          <span class="stat-badge green">${site.qualified_calls} qualified</span>
          ${site.spam_blocked > 0 ? `<span class="stat-badge red">${site.spam_blocked} spam</span>` : ''}
        </div>
        <div class="stat-card-footer">
          <span class="stat-tenant ${site.has_tenant ? 'active' : ''}">${site.has_tenant ? '✓ Tenant' : 'Costa'}</span>
          <span class="stat-fwd">${fwd}</span>
        </div>
      </div>
    `;
  }).join('');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2500);
}
