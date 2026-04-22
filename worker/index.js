// Cloudflare Worker — Twilio API Proxy for Lead Manager PWA
// Environment variables needed:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AUTH_PIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

const COSTA_PHONE = '+17344761457';

// Per-site forwarding overrides — tenant numbers or alternate destinations
// Key: Twilio inbound number | Value: forward-to number
// If a number isn't listed here, calls forward to COSTA_PHONE (default)
const SITE_FORWARD = {
  // PHX Pool Resurfacing forward removed 2026-04-22 per Costa
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
  '+14027714422': "Hey, I'm sorry I missed your call! Is it refinishing, new installation, or board repairs? Please reply with what you need and your location and I'll get right back to you. — Costa | Elkhorn Hardwood",
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
  '+14027714422': 'Elkhorn Hardwood',
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
  '+15094619375': 'https://selkirkhardwood.com',
  '+18137233209': 'https://poolresurfacingusa.com',
  '+16232949154': 'https://phxpoolresurfacing.com',
  '+18707713364': 'https://deltatreedoctors.com',
  '+14695296768': 'https://ntxtreeexperts.com',
  '+17207347645': 'https://boulderbathroomremodeling.com',
  '+13195285190': 'https://fiveseasonsradon.com',
  '+13375482811': 'https://contrabandbayoutree.com',
  '+15807811781': 'https://comanchetreeexperts.com',
  '+15092367423': 'https://inlandnwhottubs.com',
  '+12255354918': 'https://redsticksidingandroof.com',
  '+16056405642': 'https://badlandsradon.com',
  '+13374920960': 'https://bayoutecheseptic.com',
  '+17857064425': 'https://flinthillsfoundation.com',
  '+13375208573': 'https://lakecharlesbathroomremodeling.com',
  '+14064767479': 'https://rimrockradon.com',
  '+19529007486': 'https://bloomingtonbathroomremodeling.com',
  '+14052813672': 'https://scissortailbath.com',
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

    // ── Retell Voice Agent: report-spam (public, secret-gated) ──
    if (path === '/report-spam' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.secret !== env.WEBHOOK_SECRET) return json({ error: 'Forbidden' }, 403);
        const rawNumber = body.caller_number || body.from_number || '';
        const number = String(rawNumber).startsWith('+') ? rawNumber : `+1${String(rawNumber).replace(/\D/g, '')}`;
        if (!number || number.length < 10) return json({ error: 'invalid number' }, 400);
        const reason = body.reason || 'retell-voice-agent';
        const callId = body.call_id || '';
        if (env.SPAM_LOG) {
          await env.SPAM_LOG.put(`dyn_block:${number}`, JSON.stringify({
            reason: `retell:${reason}`,
            blocked_at: new Date().toISOString(),
            source_call_id: callId,
            flagged_by: 'retell-agent'
          }), { expirationTtl: 5184000 }); // 60 days
        }
        return json({ ok: true, blocked: number, reason });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── Retell Voice Agent: Twilio → Retell SIP bridge (public) ──
    // Twilio posts here when call hits the Bayou Teche number.
    // We register the call with Retell, then return TwiML that dials Retell over SIP.
    if (path.startsWith('/twilio-voice/') && request.method === 'POST') {
      const agentId = path.slice('/twilio-voice/'.length);
      try {
        const form = await request.formData();
        const from = form.get('From') || '';
        const to = form.get('To') || '';
        const callSid = form.get('CallSid') || '';

        // Blocklist check — both static and KV-stored dynamic blocks
        const blocked = BLOCKED_CALLERS.has(from) ||
          (env.SPAM_LOG && await env.SPAM_LOG.get(`dyn_block:${from}`));
        if (blocked) {
          return twiml('<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>');
        }

        const reg = await fetch('https://api.retellai.com/v2/register-phone-call', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RETELL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: agentId,
            from_number: from,
            to_number: to,
            direction: 'inbound',
            metadata: { twilio_call_sid: callSid }
          })
        });

        if (!reg.ok) {
          const err = await reg.text();
          console.error('Retell register failed:', reg.status, err);
          return twiml('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Sorry, we are having trouble connecting your call. Please try again shortly.</Say><Hangup/></Response>');
        }

        const { call_id } = await reg.json();
        const sip = `sip:${call_id}@sip.retellai.com;transport=tcp`;
        return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true"><Sip>${sip}</Sip></Dial></Response>`);
      } catch (e) {
        console.error('twilio-voice error:', e.message);
        return twiml('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, system error.</Say><Hangup/></Response>');
      }
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

    // ── CRM Lead Dashboard endpoints ──
    // Auth: ?pin= query param OR Authorization: Bearer <pin> OR X-Auth-Token header
    const pinParam = url.searchParams.get('pin');
    const bearerHeader = (request.headers.get('Authorization') || '').replace('Bearer ', '');
    const xAuthHeader = request.headers.get('X-Auth-Token');
    const providedPin = pinParam || bearerHeader || xAuthHeader;

    if (path === '/api/leads' && request.method === 'GET') {
      if (providedPin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      return await getUnifiedLeads(url, env);
    }

    if (path.startsWith('/api/leads/') && path.endsWith('/status') && request.method === 'POST') {
      if (providedPin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      const leadId = path.replace('/api/leads/', '').replace('/status', '');
      return await updateLeadStatus(request, leadId, env);
    }

    if (path.startsWith('/api/leads/') && request.method === 'GET') {
      if (providedPin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      const leadId = path.replace('/api/leads/', '');
      return await getLeadDetail(leadId, env);
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
  '+17344761457',  // Costa personal cell — exclude from leads
  '+19360317459',  // form spam — BANGE backpack bot — 2026-04-21
]);

// Numbers to exclude from the leads dashboard (internal test calls etc.)
const INTERNAL_NUMBERS = new Set(['+17344761457']);

// Form lead spam: known bot emails and message keywords (case-insensitive)
const SPAM_EMAILS = new Set([
  'ericjonesmyemail@gmail.com',
  'sales@bruntnell.bangeshop.com',
]);
// Spam email domains — any email @these domains is silently dropped
const SPAM_DOMAINS = new Set([
  'bangeshop.com',
]);
const SPAM_KEYWORDS = [
  'web visitors into leads',
  'visitorsintoleads',
  'bange backpack',
  'sling bag',
  'anti-theft bag',
  'built-in usb',
];

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

  // Persist SMS to KV so it appears in the PWA CRM dashboard
  if (from && env.SPAM_LOG) {
    try {
      const ts = Date.now();
      const phoneHash = from.replace(/\D/g, '').slice(-10);
      const smsKey = `sms:${ts}:${phoneHash}`;
      const smsRecord = {
        id: smsKey,
        source: 'sms',
        timestamp: new Date(ts).toISOString(),
        site: siteLabel,
        phone: from,
        to,
        name: 'SMS Lead',
        email: '',
        address: '',
        service: '',
        urgency: '',
        status: 'new',
        summary: (body || '').slice(0, 500),
        recording_url: null,
        transcript: null
      };
      await env.SPAM_LOG.put(smsKey, JSON.stringify(smsRecord), { expirationTtl: 7776000 });

      // Update unified leads index
      const idxRaw = await env.SPAM_LOG.get('leads:index');
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      idx.unshift(smsKey);
      if (idx.length > 500) idx.splice(500);
      await env.SPAM_LOG.put('leads:index', JSON.stringify(idx), { expirationTtl: 7776000 });
    } catch (e) {
      console.error('KV SMS store failed:', e.message);
    }
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

    // Form spam filter — known bot emails, domains, and message keyword patterns
    const rawEmail  = (fields.email || fields.Email || '').toLowerCase().trim();
    const emailDomain = rawEmail.split('@')[1] || '';
    const rawMsg    = (fields.message || fields.Message || fields.problem_description || fields.description || '').toLowerCase();
    if (
      SPAM_EMAILS.has(rawEmail) ||
      SPAM_DOMAINS.has(emailDomain) ||
      SPAM_KEYWORDS.some(kw => rawMsg.includes(kw))
    ) {
      return json({ success: true }); // silent drop
    }

    const name    = fields.name    || fields.Name    || fields.customer_name || 'Unknown';
    const email   = fields.email   || fields.Email   || '';
    const phone   = fields.phone   || fields.Phone   || '';
    const address = fields.address || fields.Address || '';
    const service = fields.service_requested || '';
    const urgency = fields.urgency || '';
    const message = fields.message || fields.Message || fields.problem_description || fields.description
                  || [service, urgency].filter(Boolean).join(' — ') || '';
    const source  = fields.site_domain || fields._source || (request.headers.get('Referer') || 'Unknown Site').replace(/https?:\/\//, '').split('/')[0];
    const subject = fields._subject || `New Lead — ${source}`;

    if (!email && !phone) return json({ error: 'No contact info' }, 400);

    const rows = [
      ['Source', source],
      ['Name', name],
      email   ? ['Email',   `<a href="mailto:${email}">${email}</a>`]   : null,
      phone   ? ['Phone',   `<a href="tel:${phone}">${phone}</a>`]       : null,
      address ? ['Address', address] : null,
      service ? ['Service', service] : null,
      urgency ? ['Urgency', urgency] : null,
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

    // ── Auto-SMS form link for voice leads (Retell → SMS handoff) ──
    // Only fires for calls coming from the voice agent. Sends the caller a link
    // to the site's intake form so they can fill in details at their own pace.
    if (phone && (fields._source === 'retell-voice' || source.includes('retell'))) {
      const siteDomain = fields.site_domain || source;
      const formUrl = `https://${siteDomain}/estimate/`;
      const smsBody = `Hey ${name.split(' ')[0] || 'there'}, this is Sarah from Bayou Teche Septic. Here's the quick form I mentioned — fill this out and upload any pics if ya got 'em, then my team'll reach out to lock in a time: ${formUrl}`;
      const fromNumber = fields.to_number || '+13374920960';
      try {
        await twilioPost(env, 'Messages.json', { From: fromNumber, To: phone, Body: smsBody });
      } catch (e) {
        console.error('SMS form send failed:', e.message);
      }
    }

    const tgText = `🔔 <b>New Lead</b>\n<b>Site:</b> ${source}\n<b>Name:</b> ${name}` +
      (phone   ? `\n<b>Phone:</b> ${phone}`   : '') +
      (email   ? `\n<b>Email:</b> ${email}`   : '') +
      (address ? `\n<b>Address:</b> ${address}` : '') +
      (service ? `\n<b>Service:</b> ${service}` : '') +
      (urgency ? `\n<b>Urgency:</b> ${urgency}` : '') +
      (message ? `\n<b>Note:</b> ${message.slice(0, 200)}` : '');
    await sendTelegramAlert(env, tgText);

    // ── Store lead in KV for CRM dashboard ──
    if (env.SPAM_LOG) {
      try {
        const ts = Date.now();
        const phoneHash = phone ? phone.replace(/\D/g, '').slice(-10) : email.replace(/[^a-z0-9]/gi, '').slice(0, 10);
        const leadKey = `lead:${ts}:${phoneHash}`;
        const leadRecord = {
          id: leadKey,
          source: 'form',
          timestamp: new Date(ts).toISOString(),
          site: source,
          name,
          phone,
          email,
          address,
          service,
          urgency,
          status: 'new',
          summary: message.slice(0, 500),
          recording_url: null,
          transcript: null,
          raw: fields
        };
        await env.SPAM_LOG.put(leadKey, JSON.stringify(leadRecord), { expirationTtl: 7776000 }); // 90 days

        // Update index
        const idxRaw = await env.SPAM_LOG.get('leads:index');
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        idx.unshift(leadKey);
        // Keep index at 500 entries max
        if (idx.length > 500) idx.splice(500);
        await env.SPAM_LOG.put('leads:index', JSON.stringify(idx), { expirationTtl: 7776000 });
      } catch (e) {
        console.error('KV lead store failed:', e.message);
      }
    }

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

// ── CRM Lead Dashboard ──────────────────────────────────────────────────────

async function getUnifiedLeads(url, env) {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '200');

    // 1. Pull KV form leads
    const kvLeads = [];
    if (env.SPAM_LOG) {
      try {
        const idxRaw = await env.SPAM_LOG.get('leads:index');
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        const keys = idx.slice(0, limit);
        const fetched = await Promise.all(keys.map(k => env.SPAM_LOG.get(k)));
        for (const raw of fetched) {
          if (raw) {
            try { kvLeads.push(JSON.parse(raw)); } catch (e) {}
          }
        }
      } catch (e) {
        console.error('KV leads fetch error:', e.message);
      }
    }

    // 2. Pull Retell voice calls
    const retellLeads = [];
    if (env.RETELL_API_KEY) {
      try {
        const res = await fetch('https://api.retellai.com/v2/list-calls', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RETELL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agent_id: ['agent_c89f789b30dde8b7e1edcd9ec9'],
            limit: 200
          })
        });
        if (res.ok) {
          const data = await res.json();
          const calls = data.calls || data || [];
          for (const call of calls) {
            const analysis = call.call_analysis || {};
            const phone = call.from_number || call.caller_id || '';
            if (INTERNAL_NUMBERS.has(phone)) continue;
            const ts = call.start_timestamp
              ? new Date(call.start_timestamp).toISOString()
              : new Date(call.created_at || Date.now()).toISOString();
            const tsMs = call.start_timestamp
              ? (typeof call.start_timestamp === 'number' ? call.start_timestamp : new Date(call.start_timestamp).getTime())
              : Date.now();

            retellLeads.push({
              id: `retell:${call.call_id}`,
              source: 'voice',
              timestamp: ts,
              _tsMs: tsMs,
              site: analysis.custom_analysis_data?.site_domain
                || call.agent_name
                || 'Retell Voice Agent',
              name: analysis.custom_analysis_data?.customer_name
                || analysis.customer_name
                || extractNameFromTranscript(call.transcript)
                || 'Unknown Caller',
              phone,
              email: '',
              address: analysis.custom_analysis_data?.address
                || analysis.address
                || '',
              service: analysis.custom_analysis_data?.service_requested
                || analysis.service_requested
                || '',
              urgency: analysis.custom_analysis_data?.urgency
                || analysis.urgency
                || '',
              status: 'new',
              summary: analysis.call_summary || analysis.custom_analysis_data?.call_summary || '',
              recording_url: call.recording_url || null,
              transcript: call.transcript || null,
              lead_quality: analysis.custom_analysis_data?.lead_quality || analysis.lead_quality || '',
              call_id: call.call_id,
              raw: { call_analysis: analysis, duration: call.duration_ms }
            });
          }
        }
      } catch (e) {
        console.error('Retell fetch error:', e.message);
      }
    }

    // 3. Load status overrides from KV
    const allLeads = [...kvLeads, ...retellLeads];
    if (env.SPAM_LOG && allLeads.length) {
      const statusKeys = allLeads.map(l => `lead_status:${l.id}`);
      // Batch fetch in groups of 25
      const chunks = [];
      for (let i = 0; i < statusKeys.length; i += 25) chunks.push(statusKeys.slice(i, i + 25));
      for (const chunk of chunks) {
        const statuses = await Promise.all(chunk.map(k => env.SPAM_LOG.get(k).catch(() => null)));
        chunk.forEach((key, i) => {
          if (statuses[i]) {
            const leadId = key.replace('lead_status:', '');
            const lead = allLeads.find(l => l.id === leadId);
            if (lead) lead.status = statuses[i];
          }
        });
      }
    }

    // 4. Deduplicate voice + form leads by phone + 5-min window
    const deduped = deduplicateLeads(allLeads);

    // 5. Sort most-recent first
    deduped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Strip internal fields
    const clean = deduped.map(({ _tsMs, ...rest }) => rest);

    return json({ leads: clean, total: clean.length, generated_at: new Date().toISOString() });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function getLeadDetail(leadId, env) {
  try {
    // Try KV first (form leads and SMS leads both stored in KV)
    if (env.SPAM_LOG && (leadId.startsWith('lead:') || leadId.startsWith('sms:'))) {
      const raw = await env.SPAM_LOG.get(leadId);
      if (raw) {
        const lead = JSON.parse(raw);
        // Load status override
        const statusOverride = await env.SPAM_LOG.get(`lead_status:${leadId}`).catch(() => null);
        if (statusOverride) lead.status = statusOverride;
        return json(lead);
      }
    }

    // Try Retell
    if (leadId.startsWith('retell:')) {
      const callId = leadId.replace('retell:', '');
      const res = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
        headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` }
      });
      if (res.ok) {
        const call = await res.json();
        const analysis = call.call_analysis || {};
        const statusOverride = env.SPAM_LOG
          ? await env.SPAM_LOG.get(`lead_status:${leadId}`).catch(() => null)
          : null;

        return json({
          id: leadId,
          source: 'voice',
          timestamp: call.start_timestamp
            ? new Date(call.start_timestamp).toISOString()
            : new Date().toISOString(),
          site: analysis.custom_analysis_data?.site_domain || 'Retell Voice Agent',
          name: analysis.custom_analysis_data?.customer_name || analysis.customer_name || 'Unknown Caller',
          phone: call.from_number || '',
          email: '',
          address: analysis.custom_analysis_data?.address || analysis.address || '',
          service: analysis.custom_analysis_data?.service_requested || analysis.service_requested || '',
          urgency: analysis.custom_analysis_data?.urgency || analysis.urgency || '',
          status: statusOverride || 'new',
          summary: analysis.call_summary || '',
          recording_url: call.recording_url || null,
          transcript: call.transcript || null,
          lead_quality: analysis.custom_analysis_data?.lead_quality || analysis.lead_quality || '',
          call_id: callId,
          raw: call
        });
      }
    }

    return json({ error: 'Lead not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function updateLeadStatus(request, leadId, env) {
  try {
    const body = await request.json();
    const status = body.status;
    const validStatuses = ['new', 'contacted', 'qualified', 'closed', 'junk'];
    if (!validStatuses.includes(status)) {
      return json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') }, 400);
    }
    if (env.SPAM_LOG) {
      await env.SPAM_LOG.put(`lead_status:${leadId}`, status, { expirationTtl: 7776000 });
    }
    return json({ ok: true, id: leadId, status });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function deduplicateLeads(leads) {
  const FIVE_MIN = 5 * 60 * 1000;
  const result = [];
  const seen = new Map(); // phone -> [{ ts, idx }]

  for (const lead of leads) {
    if (!lead.phone) {
      result.push(lead);
      continue;
    }
    const phone = lead.phone.replace(/\D/g, '').slice(-10);
    const ts = new Date(lead.timestamp).getTime();
    const existing = seen.get(phone) || [];
    const dup = existing.find(e => Math.abs(e.ts - ts) <= FIVE_MIN);
    if (dup) {
      // Merge: prefer the richer source (voice wins if it has recording)
      const other = result[dup.idx];
      if (lead.source === 'voice' && other.source === 'form') {
        // Merge voice data into form lead
        result[dup.idx] = { ...other, ...lead, source: 'voice+form', status: other.status };
      } else if (lead.source === 'form' && other.source === 'voice') {
        result[dup.idx] = { ...lead, ...other, source: 'voice+form', status: other.status };
      }
      // Same source duplicate — skip
    } else {
      const idx = result.length;
      result.push(lead);
      existing.push({ ts, idx });
      seen.set(phone, existing);
    }
  }

  return result;
}

function extractNameFromTranscript(transcript) {
  if (!transcript) return null;
  // Try to find a name from common patterns like "I'm John" or "My name is Jane"
  const match = transcript.match(/(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i);
  return match ? match[1] : null;
}
