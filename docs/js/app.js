// === Business Configuration ===
const BUSINESSES = [
  { id: 'elkhorn', name: 'Elkhorn Hardwood', short: 'Elkhorn', number: '+17192158962', color: '#8B4513' },
  { id: 'tampa', name: 'Tampa Concrete', short: 'Tampa', number: '+18137059021', color: '#4a90d9' },
  { id: 'knox', name: 'Knox Pressure', short: 'Knox', number: '+18653788377', color: '#22c55e' },
  { id: 'springs', name: 'Springs Mold', short: 'Springs', number: '+17194968287', color: '#f97316' },
  { id: 'peak', name: 'Peak Shine', short: 'Peak', number: '+14235891682', color: '#a855f7' }
];

// === State ===
let currentBiz = 0;
let conversations = {}; // { bizId: { phoneNumber: { messages: [], calls: [] } } }
let currentContact = null;
let unreadCounts = {};
let pullStartY = 0;

// === Config ===
const CONFIG_KEY = 'lead-mgr-config';
const AUTH_KEY = 'lead-mgr-auth';

function getConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) return JSON.parse(saved);
  return { workerUrl: '', pin: '' };
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
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
      <input type="url" id="setup-url" placeholder="Cloudflare Worker URL" style="width:100%;max-width:320px;padding:12px;background:var(--bg2);border:2px solid var(--bg3);border-radius:var(--radius);color:var(--text);font-size:15px;outline:none;">
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

function initApp(cfg) {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  TwilioAPI.init(cfg.workerUrl, cfg.pin);
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

    // Group messages by contact number
    const contactMap = {};

    messages.forEach(msg => {
      const contact = msg.direction === 'inbound' ? msg.from : msg.to;
      if (contact === biz.number) return; // skip self
      const key = contact;
      if (!contactMap[key]) contactMap[key] = { number: contact, messages: [], calls: [], lastActivity: null };
      contactMap[key].messages.push(msg);
      const d = new Date(msg.date_created || msg.date_sent);
      if (!contactMap[key].lastActivity || d > contactMap[key].lastActivity) contactMap[key].lastActivity = d;
    });

    calls.forEach(call => {
      const contact = call.direction === 'inbound' ? call.from : call.to;
      if (contact === biz.number) return;
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

      const unread = contact.messages.filter(m => m.direction === 'inbound' && m.status !== 'read').length;
      const initials = contact.number.slice(-2);

      return `
        <div class="conv-item" data-number="${contact.number}">
          <div class="conv-avatar" style="background:${biz.color}">${initials}</div>
          <div class="conv-info">
            <div class="conv-name">${formatPhone(contact.number)}</div>
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
    const totalUnread = sorted.reduce((sum, c) => sum + c.messages.filter(m => m.direction === 'inbound' && m.status !== 'read').length, 0);
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

  document.getElementById('conversation-list').classList.add('hidden');
  document.getElementById('conversation-detail').classList.remove('hidden');
  document.getElementById('detail-contact').textContent = formatPhone(contactNumber);

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

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    currentContact = null;
    document.getElementById('conversation-detail').classList.add('hidden');
    document.getElementById('conversation-list').classList.remove('hidden');
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

  // Auto-refresh every 30 seconds
  setInterval(() => {
    if (!document.hidden) loadBizData(currentBiz);
  }, 30000);
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

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2500);
}
