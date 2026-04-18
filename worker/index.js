// Cloudflare Worker — Twilio API Proxy for Lead Manager PWA
// Environment variables needed:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AUTH_PIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

const COSTA_PHONE = '+17344761457';

// Per-site forwarding overrides — tenant numbers or alternate destinations
// Key: Twilio inbound number | Value: forward-to number
// If a number isn't listed here, calls forward to COSTA_PHONE (default)
const SITE_FORWARD = {
  '+16232949154': '+18327701658',  // PHX Pool Resurfacing → tenant (updated 2026-04-03)
};

// Tailored missed-call SMS per Twilio number
const MISSED_CALL_MESSAGES = {
  '+19187232096': "Hey, I'm sorry I missed your call! Is it water damage, flooding, or mold? Please reply with what you need and your location and I'll get right back to you. — Costa | Tulsa Water Damage Pros",
  '+12562159287': "Hey, I'm sorry I missed your call! Is it your AC, heating, or a new system install? Please reply with what you need and your location and I'll get right back to you. — Costa | Huntsville HVAC Pros",
  '+17262685597': "Hey, I'm sorry I missed your call! Is it pool replastering, resurfacing, or tile work? Please reply with what you need and your location and I'll get right back to you. — Costa | Alamo Pool Resurfacing",
  '+19042044753': "Hey, I'm sorry I missed your call! Is it a garage floor, basement, or commercial space? Please reply with what you need and your location and I'll get right back to you. — Costa | 904 Epoxy Floors",
  '+18137059021': "Hey, I'm sorry I missed your call! Is it a driveway, patio, or pool deck? Please reply with what you need and your location and I'll get right back to you. — Costa | Tampa Concrete Pros",
  '+18653788377': "Hey, I'm sorry I missed your call! Is it your driveway, house exterior, or deck? Please reply with what you need and your location and I'll get right back to you. — Costa | Knox Pressure Pros",
  '+17194968287': "Hey, I'm sorry I missed your call! Is it mold removal, an inspection, or water damage? Please reply with what you need and your location and I'll get right back to you. — Costa | Springs Mold Solutions",
  '+14235891682': "Hey, I'm sorry I missed your call! Is it a full detail, interior cleaning, or paint correction? Please reply with what you need and your location and I'll get right back to you. — Costa | Peak Shine Detailing",
  '+17192158962': "Hey, I'm sorry I missed your call! Is it refinishing, new installation, or board repairs? Please reply with what you need and your location and I'll get right back to you. — Costa | Elkhorn Hardwood",
  '+15094619375': "Hey, I'm sorry I missed your call! Is it refinishing, new installation, or board repairs? Please reply with what you need and your location and I'll get right back to you. — Costa | Selkirk Hardwood",
  '+16232949154': "Hey, I'm sorry I missed your call! Is it replastering, resurfacing, or tile work? Please reply with what you need and I'll get right back to you. — Costa | PHX Pool Resurfacing",
  '+18707713364': "Hey, I'm sorry I missed your call! Is it tree removal, trimming, or storm cleanup? Please reply with what you need and I'll get right back to you. — Costa | Delta Tree Doctors",
  '+14695296768': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | McKinney Tree Service",
  '+17207347645': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Boulder Bathroom Remodeling",
  '+13195285190': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Cedar Rapids Radon",
  '+13375482811': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Lake Charles Tree Service",
  '+15807811781': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Lawton Tree Service",
  '+15092367423': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Spokane Hot Tub Repair",
  '+12255354918': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Baton Rouge Siding",
  '+16056405642': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Rapid City Radon",
  '+13374920960': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Lafayette Septic Service",
  '+17857064425': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Topeka Foundation Repair",
  '+13375208573': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Lake Charles Bathroom",
  '+14064767479': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Billings Radon",
  '+19529007486': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Bloomington Bathroom",
  '+14052813672': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Edmond Bathroom",
  '+14027714422': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Elkhorn Hardwood NE",
  '+18507263411': "Hey, I'm sorry I missed your call! Is it a brake job, diagnostics, battery, or something else? Reply with what you need and I'll get right back to you. — Costa | Tally Mobile Mechanic",
  '+18137233209': "Hey, I'm sorry I missed your call! Please reply with what you need and your address and I'll get right back to you. — Costa | Pool Resurfacing USA",
  '+14073262707': "Hey, I'm sorry I missed your call! Is it a driveway, patio, or pool deck? Please reply with what you need and your address and I'll get right back to you. — Costa | Orlando Concrete Driveway",
};

// Human-readable site labels for Telegram alerts
const SITE_LABELS = {
  '+19187232096': 'Tulsa Water Damage',
  '+12562159287': 'Huntsville HVAC',
  '+17262685597': 'SA Pool Resurfacing',
  '+19042044753': 'Jacksonville Epoxy',
  '+18137059021': 'Tampa Concrete',
  '+18653788377': 'Knox Pressure',
  '+17194968287': 'Springs Mold',
  '+14235891682': 'Peak Shine Detailing',
  '+17192158962': 'Elkhorn Hardwood',
  '+15094619375': 'Selkirk Hardwood',
  '+18137233209': 'Pool Directory',
  '+14073262707': 'Orlando Concrete Driveway',
  '+16232949154': 'PHX Pool Resurfacing',
  '+18707713364': 'Delta Tree Doctors',
  '+14695296768': 'McKinney Tree Service',
  '+17207347645': 'Boulder Bathroom Remodeling',
  '+13195285190': 'Cedar Rapids Radon',
  '+13375482811': 'Lake Charles Tree Service',
  '+15807811781': 'Lawton Tree Service',
  '+15092367423': 'Spokane Hot Tub Repair',
  '+12255354918': 'Baton Rouge Siding',
  '+16056405642': 'Rapid City Radon',
  '+13374920960': 'Lafayette Septic Service',
  '+17857064425': 'Topeka Foundation Repair',
  '+13375208573': 'Lake Charles Bathroom',
  '+14064767479': 'Billings Radon',
  '+19529007486': 'Bloomington Bathroom',
  '+14052813672': 'Edmond Bathroom',
  '+14027714422': 'Elkhorn Hardwood NE',
  '+18507263411': 'Tally Mobile Mechanic',
};

// Website URLs — used to hyperlink alerts
const SITE_URLS = {
  '+19187232096': 'https://tulsawaterdamagepros.com',
  '+12562159287': 'https://huntsvillehvacpros.com',
  '+17262685597': 'https://alamopoolresurfacing.com',
  '+19042044753': 'https://904epoxyfloors.com',
  '+18137059021': 'https://tampaconcretepros.com',
  '+18653788377': 'https://knoxpressurepros.com',
  '+17194968287': 'https://springsmoldsolutions.com',
  '+14235891682': 'https://peakshinedetailing.com',
  '+17192158962': 'https://elkhornhardwood.com',
  '+15094619375': 'https://selkirkhardwood.com',
  '+18137233209': 'https://poolresurfacingusa.com',
  '+16232949154': 'https://phxpoolresurfacing.com',
  '+18707713364': 'https://deltatreedoctors.com',
  '+14695296768': 'https://ntxtreeexperts.com',
  '+17207347645': 'https://boulderbathroomremodeling.com',
  '+13195285190': 'https://rimrockradon.com',
  '+13375482811': 'https://deltatreedoctors.com',
  '+15807811781': 'https://comanchetreeexperts.com',
  '+15092367423': 'https://inlandnwhottubs.com',
  '+12255354918': 'https://redsticksidingandroof.com',
  '+16056405642': 'https://rapidcityradon.com',
  '+13374920960': 'https://acadiaseptic.com',
  '+17857064425': 'https://flinthillsfoundation.com',
  '+13375208573': 'https://lakecharlestileandstone.com',
  '+14064767479': 'https://rimrockradon.com',
  '+19529007486': 'https://bloomingtonbathroomremodeling.com',
  '+14052813672': 'https://edmondbathroomremodeling.com',
  '+14027714422': 'https://elkhornhardwood.com',
  '+18507263411': 'https://tallymobilemechanic.com',
  '+14073262707': 'https://orlandoconcretedriveway.com',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Twilio webhooks — no PIN auth required ──

    if (path === '/webhook/missed-call' && request.method === 'POST') {
      const secret = url.searchParams.get('secret');
      if (secret !== env.WEBHOOK_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      return await handleMissedCall(request, env);
    }

    if (path === '/webhook/sms' && request.method === 'POST') {
      return await handleIncomingSMS(request, env);
    }

    // ── /webhook/voice — unified call handler with spam filtering + forwarding ──
    // Used by all 28 numbers. Replaces /webhook/call and /voice endpoints.
    if (path === '/webhook/voice' && request.method === 'POST') {
      return await handleVoiceCall(request, env);
    }

    // ── /webhook/call-status — fires for EVERY call completion (configured via
    // StatusCallback on each Twilio number). Catches edge cases where forwarded
    // flag wasn't set (e.g. KV write failed). Short calls (<30s) with no
    // forwarded-call record in KV get a missed-call SMS as a fallback.
    if (path === '/webhook/call-status' && request.method === 'POST') {
      return await handleCallStatus(request, env);
    }

    // Legacy aliases — kept for backward compat with call-screen.xml numbers
    if (path === '/webhook/call' && request.method === 'POST') {
      return await handleVoiceCall(request, env);
    }
    if (path === '/voice' && request.method === 'POST') {
      return await handleVoiceCall(request, env);
    }

    if (path === '/webhook/whisper') {
      const site = url.searchParams.get('site') || 'Iron Tiger Digital';
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Incoming call from ${site}. Connecting now.</Say></Response>`;
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
    }

    // Public health check
    if (path === '/health') {
      const tgOk = !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
      const twOk = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
      return json({ ok: true, ts: Date.now(), worker: 'lead-manager-api', telegram: tgOk, twilio: twOk });
    }

    // ── Form Lead Intake ──
    if (path === '/ingest' && (request.method === 'POST' || request.method === 'OPTIONS')) {
      return await handleLeadIngest(request, env);
    }

    // ── Stripe Checkout ──
    if (path === '/stripe/checkout' && request.method === 'POST') {
      const PRICE_IDS = {
        premium:    'price_1TDtlcRxpHV3ISsgFfDlERsr',
        highticket: 'price_1T7pxWRxpHV3ISsgBkzr3ML5',
        midrange:   'price_1TDtldRxpHV3ISsg4WjqjU5L',
        standard:   'price_1T7pxZRxpHV3ISsgypq9YT32',
      };
      try {
        const body = await request.json();
        const priceId = PRICE_IDS[body.priceType];
        if (!priceId) return json({ error: 'Invalid plan' }, 400);
        if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 500);

        const params = new URLSearchParams({
          'mode': 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          'success_url': 'https://www.irontigerdigital.com/success.html?session_id={CHECKOUT_SESSION_ID}',
          'cancel_url': 'https://www.irontigerdigital.com/checkout.html',
          'allow_promotion_codes': 'true',
        });

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const session = await stripeRes.json();
        if (!session.url) return json({ error: session.error?.message || 'Stripe error' }, 500);
        return json({ url: session.url });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // Auth check for all other routes
    const authToken = request.headers.get('X-Auth-Token');
    if (authToken !== env.AUTH_PIN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      if (path === '/messages' && request.method === 'GET') return await getMessages(url, env);
      if (path === '/messages' && request.method === 'POST') return await sendMessage(request, env);
      if (path === '/calls' && request.method === 'GET') return await getCalls(url, env);
      if (path === '/spam-stats' && request.method === 'GET') return await getSpamStats(env);
      if (path === '/portfolio-stats' && request.method === 'GET') {
        return await getPortfolioStats(url, env);
      }
      if (path === '/blocked-callers' && request.method === 'GET') {
        // Merge static + dynamic blocklist
        const dynamicBlocked = [];
        if (env.SPAM_LOG) {
          try {
            const list = await env.SPAM_LOG.list({ prefix: 'dyn_block:' });
            for (const key of list.keys) {
              const num = key.name.replace('dyn_block:', '');
              const meta = await env.SPAM_LOG.get(key.name);
              dynamicBlocked.push({ number: num, ...(meta ? JSON.parse(meta) : {}) });
            }
          } catch (e) { /* non-blocking */ }
        }
        return json({ blocked: [...BLOCKED_CALLERS], dynamic: dynamicBlocked });
      }

      // POST /block — add a number to dynamic blocklist
      if (path === '/block' && request.method === 'POST') {
        const secret = url.searchParams.get('secret');
        if (secret !== env.WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
        const body = await request.json();
        const number = body.number?.startsWith('+') ? body.number : `+1${body.number.replace(/\D/g, '')}`;
        const reason = body.reason || 'manual';
        if (env.SPAM_LOG) {
          await env.SPAM_LOG.put(`dyn_block:${number}`, JSON.stringify({
            reason, blocked_at: new Date().toISOString()
          }), { expirationTtl: 2592000 }); // 30 days
        }
        return json({ ok: true, blocked: number, reason });
      }

      // DELETE /block — remove a number from dynamic blocklist
      if (path === '/block' && request.method === 'DELETE') {
        const secret = url.searchParams.get('secret');
        if (secret !== env.WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
        const body = await request.json();
        const number = body.number?.startsWith('+') ? body.number : `+1${body.number.replace(/\D/g, '')}`;
        if (env.SPAM_LOG) {
          await env.SPAM_LOG.delete(`dyn_block:${number}`);
        }
        return json({ ok: true, unblocked: number });
      }
      if (path === '/contacts' && request.method === 'GET') return await getContacts(env);
      if (path === '/call' && request.method === 'POST') return await initiateCall(request, env);
      if (path === '/push/vapid-key') return json({ key: env.VAPID_PUBLIC_KEY || '' });
      if (path === '/push/subscribe' && request.method === 'POST') {
        const body = await request.json();
        if (env.PUSH_SUBS) {
          const id = crypto.randomUUID();
          await env.PUSH_SUBS.put(`sub:${id}`, JSON.stringify(body.subscription), { expirationTtl: 86400 * 30 });
        }
        return json({ ok: true });
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

// Manual call blocklist — known spam/robocallers that bypass Nomorobo
const BLOCKED_CALLERS = new Set([
  '+12252300428',  // Angi's List robocall — 2026-03-31
  '+17254856981',  // spam — Knox Pressure — 2026-03-31
  '+12393967331',  // spam — SA Pool — 2026-03-31
  '+15098165463',  // Angi's List — Spokane Hot Tub — 2026-03-31
  '+14696636976',  // Angi's List — 2026-04-01
  '+13372423834',  // Angi's List — Lafayette Septic — 2026-04-01
  '+16233230339',  // Angi's List — PHX Pool — 2026-04-02
]);

// ── Voice Call Handler — spam check + direct forward (no press-1 gate) ──

async function handleVoiceCall(request, env) {
  const formData = await request.formData();
  const from      = formData.get('From') || '';
  const to        = formData.get('To') || '';
  const callSid   = formData.get('CallSid') || '';
  const workerUrl = new URL(request.url).origin;

  const siteLabel = SITE_LABELS[to] || to;
  const siteUrl   = SITE_URLS[to];
  const siteLink  = siteUrl ? `<a href="${siteUrl}">${siteLabel}</a>` : siteLabel;
  const callerFmt = from.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');

  // ── Step 0: Manual blocklist check ──
  if (BLOCKED_CALLERS.has(from)) {
    return twiml(`<Response><Reject/></Response>`);
  }

  // ── Step 0.5: Dynamic blocklist (KV-based, added via /block API or auto-detection) ──
  if (env.SPAM_LOG) {
    try {
      const dynBlocked = await env.SPAM_LOG.get(`dyn_block:${from}`);
      if (dynBlocked) {
        return twiml(`<Response><Reject/></Response>`);
      }
    } catch (e) { /* non-blocking */ }
  }

  // ── Step 0.6: Multi-site spam detection ──
  // If the same number calls 2+ different site numbers within 24h, it's a sales dialer.
  // Real customers don't call your tree service AND your pool guy.
  if (env.SPAM_LOG) {
    try {
      const callerKey = `caller_sites:${from}`;
      const raw = await env.SPAM_LOG.get(callerKey);
      const sites = raw ? JSON.parse(raw) : [];
      if (!sites.includes(to)) {
        sites.push(to);
        await env.SPAM_LOG.put(callerKey, JSON.stringify(sites), { expirationTtl: 86400 }); // 24h window
      }
      if (sites.length >= 2) {
        // Auto-block this number — it's a sales dialer
        await env.SPAM_LOG.put(`dyn_block:${from}`, JSON.stringify({
          reason: 'multi-site',
          sites: sites.map(s => SITE_LABELS[s] || s),
          blocked_at: new Date().toISOString()
        }), { expirationTtl: 2592000 }); // block for 30 days
        await sendTelegramAlert(env,
          `🚫 <b>Auto-blocked spam caller</b>\n📲 ${callerFmt}\n🔍 Called ${sites.length} different sites in 24h: ${sites.map(s => SITE_LABELS[s] || s).join(', ')}`
        );
        return twiml(`<Response><Reject/></Response>`);
      }
    } catch (e) { /* non-blocking — don't break call flow for KV errors */ }
  }

  // ── Step 1: Check Nomorobo spam score ──
  let spamScore = 0;
  try {
    const addonsRaw = formData.get('AddOns');
    if (addonsRaw) {
      const addons = JSON.parse(addonsRaw);
      const nomorobo = addons?.results?.nomorobo_spamscore?.result?.status;
      const score    = addons?.results?.nomorobo_spamscore?.result?.score;
      if (nomorobo === 'successful' && score === 1) spamScore = 1;
    }
  } catch (e) { /* no add-on data, continue */ }

  // Reject confirmed spam immediately — no ring-through, no Telegram noise
  if (spamScore === 1) {
    try {
      if (env.SPAM_LOG) {
        const key = `spam_count:${to}`;
        const existing = await env.SPAM_LOG.get(key);
        await env.SPAM_LOG.put(key, String(existing ? parseInt(existing) + 1 : 1));
      }
    } catch (e) { /* non-blocking */ }
    return twiml(`<Response><Reject/></Response>`);
  }

  // ── Step 2: Alert Telegram + forward directly ──
  await sendTelegramAlert(env,
    `📲 <b>Incoming call — ${siteLink}</b>\n📲 ${callerFmt}`
  );

  // Mark as forwarded BEFORE dialing so handleCallStatus doesn't double-send
  // a missed-call SMS if the call ends quickly (caller hangs up while ringing).
  if (callSid && env.SPAM_LOG) {
    try {
      await env.SPAM_LOG.put(`forwarded:${callSid}`, '1', { expirationTtl: 3600 });
    } catch (e) { /* non-blocking */ }
  }

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${from}" timeout="30" action="${workerUrl}/webhook/missed-call?secret=${env.WEBHOOK_SECRET || ''}&amp;site=${encodeURIComponent(siteLabel)}&amp;to=${encodeURIComponent(to)}">
    <Number url="${workerUrl}/webhook/whisper?site=${encodeURIComponent(siteLabel)}">${SITE_FORWARD[to] || COSTA_PHONE}</Number>
  </Dial>
</Response>`);
}

// ── Call Status Callback — backup catch for short/dropped calls ──────────────
// Fires for every call completion via StatusCallback. Sends missed-call SMS if:
//   1. Call duration < 90 seconds (likely dropped or hit voicemail), AND
//   2. No "forwarded:{callSid}" flag in KV (call never reached Costa), AND
//   3. Primary handler (handleMissedCall via <Dial> action) didn't already fire
async function handleCallStatus(request, env) {
  const formData    = await request.formData();
  const callStatus  = formData.get('CallStatus') || '';
  const callSid     = formData.get('CallSid')    || '';
  const from        = formData.get('From')        || '';
  const to          = formData.get('To')          || '';
  const duration    = parseInt(formData.get('CallDuration') || '0', 10);

  // Only act on completed calls
  if (callStatus !== 'completed') {
    return new Response('OK', { status: 200 });
  }

  // If call lasted 90+ seconds, caller had a real conversation — skip
  if (duration >= 90) {
    return new Response('OK', { status: 200 });
  }

  // If forwarded AND short duration, call likely went to voicemail — send SMS anyway.
  // Only skip if it was forwarded AND a real conversation (>=90s, caught above).
  // Note: handleMissedCall (via <Dial> action) fires for true no-answer/busy.
  // This catches the voicemail case where DialCallStatus = 'completed' (voicemail answered).

  // Check if handleMissedCall already sent SMS for this call (dedup)
  if (callSid && env.SPAM_LOG) {
    try {
      const alreadySent = await env.SPAM_LOG.get(`missed_sms:${callSid}`);
      if (alreadySent) {
        return new Response('OK', { status: 200 }); // already handled
      }
    } catch (e) { /* non-blocking, proceed with send */ }
  }

  // Alert Telegram — short/dropped call that wasn't caught by primary handler
  const siteLabel = SITE_LABELS[to] || to;
  const callerFmt = from.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
  await sendTelegramAlert(env,
    `🔴 <b>Missed call — ${siteLabel}</b>\n📲 ${callerFmt}\n⏱ ${duration}s (short/dropped)`
  );

  // Skip SMS for blocked callers
  if (BLOCKED_CALLERS.has(from)) {
    return new Response('OK', { status: 200 });
  }

  // Short call — send missed-call SMS.
  const message = MISSED_CALL_MESSAGES[to] ||
    "Hey, I'm sorry I missed your call! Please reply with what you need and your location and I'll get right back to you. — Costa";

  await twilioPost(env, 'Messages.json', { From: to, To: from, Body: message });

  return new Response('OK', { status: 200 });
}

// ── Twilio API Helpers ──

function twilioAuth(env) {
  return 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
}

function twilioUrl(env, resource) {
  return `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/${resource}`;
}

async function twilioGet(env, resource, params = {}) {
  const url = new URL(twilioUrl(env, resource));
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), { headers: { 'Authorization': twilioAuth(env) } });
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

// ── Routes ──

async function getMessages(url, env) {
  const number = url.searchParams.get('number');
  const limit  = url.searchParams.get('limit') || '50';
  const [sent, received] = await Promise.all([
    twilioGet(env, 'Messages.json', { From: number, PageSize: limit }),
    twilioGet(env, 'Messages.json', { To: number, PageSize: limit })
  ]);
  const all = [...(sent.messages || []), ...(received.messages || [])];
  const unique = Object.values(Object.fromEntries(all.map(m => [m.sid, m])));
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
  const limit  = url.searchParams.get('limit') || '50';
  const [fromCalls, toCalls] = await Promise.all([
    twilioGet(env, 'Calls.json', { From: number, PageSize: limit }),
    twilioGet(env, 'Calls.json', { To: number, PageSize: limit })
  ]);
  const all = [...(fromCalls.calls || []), ...(toCalls.calls || [])];
  const unique = Object.values(Object.fromEntries(all.map(c => [c.sid, c])));
  unique.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

  // Attach spam_blocked count so dashboard can show accurate call volume
  let spamBlocked = 0;
  try {
    if (env.SPAM_LOG && number) {
      const val = await env.SPAM_LOG.get(`spam_count:${number}`);
      spamBlocked = val ? parseInt(val) : 0;
    }
  } catch (e) { /* non-blocking */ }

  return json({ calls: unique.slice(0, parseInt(limit)), spam_blocked: spamBlocked });
}

async function initiateCall(request, env) {
  const { from, to } = await request.json();
  const twimlStr = `<Response><Dial callerId="${from}"><Number>${to}</Number></Dial></Response>`;
  const forwardTo = SITE_FORWARD[from] || COSTA_PHONE;
  const result = await twilioPost(env, 'Calls.json', { From: from, To: forwardTo, Twiml: twimlStr });
  return json(result);
}

// ── Webhooks ──

async function handleIncomingSMS(request, env) {
  const formData = await request.formData();
  const from = formData.get('From');
  const to   = formData.get('To');
  const body = formData.get('Body');

  // Check SMS spam blocklist in KV — silently drop blocked numbers
  if (from && env.SPAM_LOG) {
    try {
      const blocked = await env.SPAM_LOG.get(`sms_spam:${from}`);
      if (blocked) {
        return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
      }
    } catch (e) { /* non-blocking */ }
  }

  const siteLabel = SITE_LABELS[to] || to;
  const bodyLower = (body || '').toLowerCase().trim();

  // Auto opt-out detection — STOP, unsubscribe, remove me, etc.
  const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'remove me', 'remove', 'don\'t text', 'dont text', 'no more', 'leave me alone', 'cancel'];
  const isOptOut = OPT_OUT_KEYWORDS.some(kw => bodyLower === kw || bodyLower.startsWith(kw + ' ') || bodyLower.endsWith(' ' + kw));

  if (isOptOut && from && env.SPAM_LOG) {
    try {
      await env.SPAM_LOG.put(`sms_optout:${from}`, JSON.stringify({
        reason: body, opted_out_at: new Date().toISOString(), site: siteLabel
      }));
    } catch (e) { /* non-blocking */ }

    await sendTelegramAlert(env,
      `🚫 <b>SMS OPT-OUT — ${siteLabel}</b>\nFrom: ${from}\nMessage: ${body?.substring(0, 200) || '(no body)'}\n\n<i>Number added to opt-out list. CRM update needed.</i>`
    );

    // Reply confirming removal
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been removed and won't receive any more messages. Thank you.</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  await sendTelegramAlert(env,
    `💬 <b>New SMS — ${siteLabel}</b>\nFrom: ${from}\n\n${body?.substring(0, 300) || '(no body)'}`
  );
  return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
}

async function handleMissedCall(request, env) {
  const formData   = await request.formData();
  const dialStatus = formData.get('DialCallStatus') || formData.get('CallStatus') || '';
  const from       = formData.get('From') || '';
  const url        = new URL(request.url);
  // Prefer query params (passed from handleVoiceCall) for to/site, fall back to form
  const to         = url.searchParams.get('to') || formData.get('To') || '';
  const siteLabel  = url.searchParams.get('site')
                     ? decodeURIComponent(url.searchParams.get('site'))
                     : (SITE_LABELS[to] || to);

  // Only act on actual missed calls
  const missedStatuses = ['no-answer', 'busy', 'canceled', 'failed'];
  if (!missedStatuses.includes(dialStatus)) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
      { headers: { 'Content-Type': 'text/xml' } });
  }

  // Alert Telegram so Costa knows a call was missed
  const callerFmt = from.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
  await sendTelegramAlert(env,
    `🔴 <b>Missed call — ${siteLabel}</b>\n📲 ${callerFmt}`
  );

  // Skip SMS for blocked callers
  if (BLOCKED_CALLERS.has(from)) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
      { headers: { 'Content-Type': 'text/xml' } });
  }

  // Send SMS to caller
  const message = MISSED_CALL_MESSAGES[to] ||
    "Hey, I'm sorry I missed your call! Please reply with what you need and your location and I'll get right back to you. — Costa";

  await twilioPost(env, 'Messages.json', { From: to, To: from, Body: message });

  // Mark that we already sent SMS for this call — prevents handleCallStatus from double-sending
  const callSid = formData.get('CallSid') || '';
  if (callSid && env.SPAM_LOG) {
    try {
      await env.SPAM_LOG.put(`missed_sms:${callSid}`, '1', { expirationTtl: 3600 });
    } catch (e) { /* non-blocking */ }
  }

  // Play a voice message to the caller instead of dead air
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling. We just missed you, but we're sending you a text message right now. We'll follow up with you shortly. Have a great day.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } });
}

// ── Contacts Lookup ──

async function getContacts(env) {
  try {
    if (!env.SPAM_LOG) return json({ contacts: {} });
    const raw = await env.SPAM_LOG.get('contacts_map');
    const contacts = raw ? JSON.parse(raw) : {};
    return json({ contacts });
  } catch (e) {
    return json({ contacts: {} });
  }
}

// ── Spam Stats ──

async function getSpamStats(env) {
  const allNumbers = Object.keys(SITE_LABELS);
  const counts = {};
  let total = 0;
  if (env.SPAM_LOG) {
    await Promise.all(allNumbers.map(async (num) => {
      try {
        const val = await env.SPAM_LOG.get(`spam_count:${num}`);
        if (val) {
          counts[num] = { label: SITE_LABELS[num], count: parseInt(val) };
          total += parseInt(val);
        }
      } catch (e) { /* skip */ }
    }));
  }
  return json({ spam_counts: counts, total });
}

// ── Portfolio Stats ──

async function getPortfolioStats(url, env) {
  const bust = url.searchParams.get('bust');

  // Check cache first (1 hour TTL) unless bust param present
  if (!bust && env.SPAM_LOG) {
    try {
      const cached = await env.SPAM_LOG.get('portfolio_stats_cache');
      if (cached) {
        const data = JSON.parse(cached);
        return json({ ...data, cached: true });
      }
    } catch (e) { /* cache miss */ }
  }

  const allNumbers = Object.keys(SITE_LABELS);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const sites = await Promise.all(allNumbers.map(async (num) => {
    let totalCalls = 0;
    let qualifiedCalls = 0;
    let spamBlocked = 0;

    // Fetch inbound calls from Twilio
    try {
      const callsUrl = new URL(twilioUrl(env, 'Calls.json'));
      callsUrl.searchParams.set('To', num);
      callsUrl.searchParams.set('Direction', 'inbound');
      callsUrl.searchParams.set('StartTime>', thirtyDaysAgo);
      callsUrl.searchParams.set('PageSize', '100');
      const res = await fetch(callsUrl.toString(), {
        headers: { 'Authorization': twilioAuth(env) }
      });
      const data = await res.json();
      const calls = data.calls || [];
      totalCalls = calls.length;
      qualifiedCalls = calls.filter(c => parseInt(c.duration || 0) >= 60).length;
    } catch (e) { /* skip on error */ }

    // Fetch spam count from KV
    if (env.SPAM_LOG) {
      try {
        const val = await env.SPAM_LOG.get(`spam_count:${num}`);
        spamBlocked = val ? parseInt(val) : 0;
      } catch (e) { /* skip */ }
    }

    return {
      number: num,
      label: SITE_LABELS[num],
      total_calls: totalCalls,
      qualified_calls: qualifiedCalls,
      spam_blocked: spamBlocked,
      has_tenant: num in SITE_FORWARD,
      forwarding_to: SITE_FORWARD[num] || COSTA_PHONE,
    };
  }));

  const result = { sites, generated_at: new Date().toISOString(), cached: false };

  // Cache for 1 hour
  if (env.SPAM_LOG) {
    try {
      await env.SPAM_LOG.put('portfolio_stats_cache', JSON.stringify(result), { expirationTtl: 3600 });
    } catch (e) { /* non-blocking */ }
  }

  return json(result);
}

// ── Helpers ──

async function handleLeadIngest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  try {
    let fields = {};
    const ct = request.headers.get('Content-Type') || '';

    if (ct.includes('multipart/form-data')) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v === 'string') fields[k] = v;
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await request.text());
      for (const [k, v] of params.entries()) fields[k] = v;
    } else {
      fields = await request.json().catch(() => ({}));
    }

    // Honeypot
    if (fields._honey || fields.website) return json({ success: true });

    const name    = fields.name    || fields.Name    || 'Unknown';
    const email   = fields.email   || fields.Email   || '';
    const phone   = fields.phone   || fields.Phone   || '';
    const message = fields.message || fields.Message || fields.description || '';
    const address = fields.address || fields.Address || '';
    const source  = fields._source || (request.headers.get('Referer') || 'Unknown Site').replace(/https?:\/\//, '').split('/')[0];
    const subject = fields._subject || `New Lead — ${source}`;

    if (!email && !phone) return json({ error: 'No contact info' }, 400);

    const rows = [
      ['Source', source],
      ['Name', name],
      email   ? ['Email',   `<a href="mailto:${email}">${email}</a>`]   : null,
      phone   ? ['Phone',   `<a href="tel:${phone}">${phone}</a>`]       : null,
      address ? ['Address', address] : null,
      message ? ['Message', message] : null,
    ].filter(Boolean);

    const tableRows = rows.map(([k, v]) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${k}</td><td style="padding:8px;border-bottom:1px solid #eee">${v}</td></tr>`
    ).join('');

    const htmlBody = `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px">
      <h2 style="color:#e94560;margin-bottom:16px">New Form Lead</h2>
      <table style="border-collapse:collapse;width:100%">${tableRows}</table>
    </div>`;

    if (env.BREVO_API_KEY) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Iron Tiger Lead System', email: 'irontigerdigital@gmail.com' },
          to: [{ email: 'irontigerdigital@gmail.com', name: 'Costa Demetral' }],
          subject,
          htmlContent: htmlBody
        })
      });
    }

    const tgText = `🔔 <b>New Form Lead</b>\n<b>Site:</b> ${source}\n<b>Name:</b> ${name}` +
      (phone   ? `\n<b>Phone:</b> ${phone}`   : '') +
      (email   ? `\n<b>Email:</b> ${email}`   : '') +
      (address ? `\n<b>Address:</b> ${address}` : '') +
      (message ? `\n<b>Note:</b> ${message.slice(0, 200)}` : '');
    await sendTelegramAlert(env, tgText);

    const redirect = fields._next || fields._redirect;
    if (redirect) return Response.redirect(redirect, 302);

    return json({ success: true });
  } catch (e) {
    return json({ error: 'Server error', detail: e.message }, 500);
  }
}

async function sendTelegramAlert(env, message) {
  const token  = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
  } catch (e) { /* silent fail */ }
}

function twiml(xml) {
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}
