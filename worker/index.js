// Cloudflare Worker — Twilio API Proxy for Lead Manager PWA
// Environment variables needed:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AUTH_PIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

const COSTA_PHONE = '+17344761457';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Auth check
    const authToken = request.headers.get('X-Auth-Token');
    if (authToken !== env.AUTH_PIN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/messages' && request.method === 'GET') {
        return await getMessages(url, env);
      }
      if (path === '/messages' && request.method === 'POST') {
        return await sendMessage(request, env);
      }
      if (path === '/calls' && request.method === 'GET') {
        return await getCalls(url, env);
      }
      if (path === '/call' && request.method === 'POST') {
        return await initiateCall(request, env);
      }
      if (path === '/push/vapid-key') {
        return json({ key: env.VAPID_PUBLIC_KEY || '' });
      }
      if (path === '/push/subscribe' && request.method === 'POST') {
        // Store subscription in KV if available
        const body = await request.json();
        if (env.PUSH_SUBS) {
          const id = crypto.randomUUID();
          await env.PUSH_SUBS.put(`sub:${id}`, JSON.stringify(body.subscription), { expirationTtl: 86400 * 30 });
        }
        return json({ ok: true });
      }
      // Twilio webhook for incoming SMS/calls (push notifications)
      if (path === '/webhook/sms' && request.method === 'POST') {
        return await handleIncomingSMS(request, env);
      }
      if (path === '/webhook/call' && request.method === 'POST') {
        return await handleIncomingCall(request, env);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

// === Twilio API Helpers ===

function twilioAuth(env) {
  return 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
}

function twilioUrl(env, resource) {
  return `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${resource}`;
}

async function twilioGet(env, resource, params = {}) {
  const url = new URL(twilioUrl(env, resource));
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': twilioAuth(env) }
  });
  return res.json();
}

async function twilioPost(env, resource, body = {}) {
  const formData = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => { if (v !== undefined) formData.set(k, v); });
  const res = await fetch(twilioUrl(env, resource), {
    method: 'POST',
    headers: {
      'Authorization': twilioAuth(env),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });
  return res.json();
}

// === Routes ===

async function getMessages(url, env) {
  const number = url.searchParams.get('number');
  const limit = url.searchParams.get('limit') || '50';

  // Fetch both sent and received in parallel
  const [sent, received] = await Promise.all([
    twilioGet(env, 'Messages.json', { From: number, PageSize: limit }),
    twilioGet(env, 'Messages.json', { To: number, PageSize: limit })
  ]);

  const all = [...(sent.messages || []), ...(received.messages || [])];
  // Deduplicate by SID
  const unique = Object.values(Object.fromEntries(all.map(m => [m.sid, m])));
  // Sort by date descending
  unique.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

  return json({ messages: unique.slice(0, parseInt(limit)) });
}

async function sendMessage(request, env) {
  const { from, to, body } = await request.json();
  const result = await twilioPost(env, 'Messages.json', { From: from, To: to, Body: body });
  return json(result);
}

async function getCalls(url, env) {
  const number = url.searchParams.get('number');
  const limit = url.searchParams.get('limit') || '50';

  const [fromCalls, toCalls] = await Promise.all([
    twilioGet(env, 'Calls.json', { From: number, PageSize: limit }),
    twilioGet(env, 'Calls.json', { To: number, PageSize: limit })
  ]);

  const all = [...(fromCalls.calls || []), ...(toCalls.calls || [])];
  const unique = Object.values(Object.fromEntries(all.map(c => [c.sid, c])));
  unique.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

  return json({ calls: unique.slice(0, parseInt(limit)) });
}

async function initiateCall(request, env) {
  const { from, to } = await request.json();
  // Twilio calls Costa first, then connects to customer
  const twiml = `<Response><Dial callerId="${from}"><Number>${to}</Number></Dial></Response>`;
  const result = await twilioPost(env, 'Calls.json', {
    From: from,
    To: COSTA_PHONE,
    Twiml: twiml
  });
  return json(result);
}

// === Webhooks (for push notifications) ===

async function handleIncomingSMS(request, env) {
  const formData = await request.formData();
  const from = formData.get('From');
  const to = formData.get('To');
  const body = formData.get('Body');

  // Send push notifications to all subscribers
  if (env.PUSH_SUBS) {
    await sendPushToAll(env, {
      title: `SMS from ${from}`,
      body: body?.substring(0, 100) || 'New message',
      tag: `sms-${from}-${Date.now()}`
    });
  }

  // Return empty TwiML (SMS auto-replies handled elsewhere)
  return new Response('<Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}

async function handleIncomingCall(request, env) {
  const formData = await request.formData();
  const from = formData.get('From');
  const callStatus = formData.get('CallStatus');

  if (callStatus === 'ringing' && env.PUSH_SUBS) {
    await sendPushToAll(env, {
      title: `Incoming call from ${from}`,
      body: 'Tap to open Lead Manager',
      tag: `call-${from}-${Date.now()}`
    });
  }

  // Return empty TwiML (call forwarding handled by Twilio config)
  return new Response('<Response></Response>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}

async function sendPushToAll(env, payload) {
  // List all subscriptions from KV
  const list = await env.PUSH_SUBS.list({ prefix: 'sub:' });
  for (const key of list.keys) {
    try {
      const subJson = await env.PUSH_SUBS.get(key.name);
      if (!subJson) continue;
      const sub = JSON.parse(subJson);
      // Note: Full web-push requires crypto signing with VAPID keys
      // For production, use a web-push library or implement JWT signing
      // This is a simplified placeholder — see README for full setup
      await fetch(sub.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // Remove invalid subscription
      await env.PUSH_SUBS.delete(key.name);
    }
  }
}

// === Util ===

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}
