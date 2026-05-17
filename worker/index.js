// Cloudflare Worker — Twilio API Proxy for Lead Manager PWA
// Environment variables needed:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AUTH_PIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

const COSTA_PHONE = '+17344761457';

// ── Auto lead-shopping — low-tier sites ───────��───────────────────────────────
// When a form lead comes in from a low-tier site, instantly email all contractors.
// Contractors sourced from Google Maps (2026-04-28). Update as needed.
const LOW_TIER_SITES = new Set([
  'peakshinedetailing.com',
  'knoxpressurepros.com',
  'inlandnwhottubs.com',
  'tallymobilemechanic.com',
  'bayoutecheseptic.com',
]);

// VERIFIED-ONLY policy (Costa 2026-04-28 18:44): only real-domain emails
// (info@realdomain.com, firstname@realdomain.com) confirmed via website.
// Seeded gmail/yahoo guesses removed — keep this list in sync with
// tools/auto-lead-shopper.py CONTRACTORS dict.
const SITE_CONTRACTORS = {
  'peakshinedetailing.com': {
    city: 'Kingsport', serviceLabel: 'detailing',
    pitchOpener: 'Costa here — I own peakshinedetailing.com and get detailing requests in the Kingsport/Tri-Cities area.',
    recipients: [
      { greeting: "Precision team", to: "info@precisionautodetailkpt.com",     company: "Precision Auto Detail" },
    ],
  },
  'knoxpressurepros.com': {
    city: 'Knoxville', serviceLabel: 'pressure washing',
    pitchOpener: 'Costa here — I own knoxpressurepros.com and get pressure washing requests in Knoxville.',
    recipients: [
      { greeting: "David",          to: "info@knoxpressurewashing.com",        company: "Knox Pressure Washing" },
      { greeting: "Chad",           to: "chad@cleanprostennessee.com",         company: "Clean Pros Tennessee" },
    ],
  },
  'inlandnwhottubs.com': {
    city: 'Spokane', serviceLabel: 'hot tub service',
    pitchOpener: 'Costa here — I own inlandnwhottubs.com and get hot tub service requests in the Spokane area.',
    recipients: [
      { greeting: "Mike",           to: "info@spokanepooltubs.com",            company: "Spokane Pool & Tubs" },
    ],
  },
  'tallymobilemechanic.com': {
    city: 'Tallahassee', serviceLabel: 'mobile mechanic',
    pitchOpener: 'Costa here — I own tallymobilemechanic.com and get mobile mechanic requests in Tallahassee.',
    recipients: [
      { greeting: "Marcus",           to: "info@tallymobilemech.com",            company: "Tally Mobile Mech" },
    ],
  },
  'bayoutecheseptic.com': {
    city: 'Lafayette', serviceLabel: 'septic service',
    pitchOpener: 'Costa here — I own bayoutecheseptic.com and get septic service requests in the Lafayette area.',
    recipients: [
      { greeting: "A-1 team",      to: "info@a1septicsvc.com",                company: "A-1 Septic Service" },
    ],
  },
  'redsticksidingandroof.com': {
    city: 'Baton Rouge', serviceLabel: 'siding/roofing',
    pitchOpener: 'Costa here — I own redsticksidingandroof.com and get siding and roofing requests in Baton Rouge.',
    recipients: [
      { greeting: "Steven",          to: "steven@empireroofllc.com",            company: "Empire Roofing & Exteriors" },
      { greeting: "Harry",           to: "brothersconstructionbr@gmail.com",    company: "Brothers Construction" },
      { greeting: "Tommy",           to: "geauxtommys@gmail.com",               company: "Tommy's Siding" },
      { greeting: "Eric",            to: "sunrise_roofing@yahoo.com",           company: "Sunrise Roofing" },
      { greeting: "David",           to: "info@rysonroofing.com",               company: "Ryson Roofing" },
      { greeting: "Tommy",           to: "geauxroofla@gmail.com",               company: "Geaux Roof LA" },
      { greeting: "Fred",            to: "info@garciadidmyroof.com",            company: "Garcia Roofing" },
      { greeting: "Roof Gecko team", to: "office@callroofgecko.com",            company: "Roof Gecko" },
      { greeting: "Hugo",            to: "domingo@vandvroofing.com",            company: "V&V Roofing" },
      { greeting: "Caprice",         to: "caprice@cypressroofingla.com",        company: "Cypress Roofing" },
    ],
  },
};

async function shopLeadToContractors(env, { site, name, phone, address, service, message }) {
  const cfg = SITE_CONTRACTORS[site];
  if (!cfg || !env.BREVO_API_KEY) return;

  const addrShort = address ? address.split(',')[0].trim() : 'unknown area';
  const subject = `New ${cfg.serviceLabel} lead in ${cfg.city} — ${addrShort}`;
  const phoneSlug = (phone || '').replace(/\D/g, '').slice(-6);
  const packetUrl = phoneSlug
    ? `https://${site}/leads/${phoneSlug}/`
    : `https://${site}/leads/`;

  const sends = cfg.recipients.map(r => {
    const body =
      `Hey ${r.greeting},\n\n` +
      `${cfg.pitchOpener}\n\n` +
      `Got a fresh inbound lead today:\n\n` +
      `  Name:    ${name || 'Not provided'}\n` +
      `  Address: ${address || 'Not provided'}\n` +
      `  Service: ${service || cfg.serviceLabel}\n` +
      (message ? `  Note:    ${message.slice(0, 200)}\n` : '') +
      `\nLead packet: ${packetUrl}\n\n` +
      `First to reply gets the contact info passed directly to you.\n\n` +
      `If the lead closes well and quality holds, happy to keep the door open for more.\n\n` +
      `— Costa\ncosta@irontigerleads.com\n(225) 535-4918\n` +
      `Iron Tiger Leads | ${site}`;

    return fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Costa', email: 'costa@irontigerleads.com' },
        replyTo: { email: 'costa@irontigerleads.com' },
        to: [{ email: r.to, name: r.company }],
        subject,
        textContent: body,
      }),
    }).catch(e => console.error(`shop-lead send failed to ${r.to}:`, e.message));
  });

  await Promise.allSettled(sends);
  console.log(`[auto-shop] Shopped ${site} lead to ${cfg.recipients.length} contractors`);
}
// ── End auto lead-shopping ──────────���─────────────────────────────────────────

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
  async fetch(request, env, ctx) {
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
      return await handleIncomingSMS(request, env, ctx);
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
      return await handleLeadIngest(request, env, ctx);
    }

    // ── Sendblue inbound SMS webhook ──
    // Sendblue dashboard → Webhooks → Inbound URL points here. Captures contractor
    // replies to our outbound iMessage Touch-1 sequence. Stores in SPAM_LOG KV
    // (sms_reply:<phone>:<handle> prefix), Telegrams the lead channel, and feeds
    // the stop-on-reply gate consumed by tools/sendblue-touch1-cron.py.
    if (path === '/webhook/sendblue' && request.method === 'POST') {
      return await handleSendblueInbound(request, env, ctx);
    }

    // ── Replied-numbers query (consumed by SMS Touch-1 cron) ──
    // GET /sms/replied-numbers?since=ISO8601 → { ok, count, numbers: [{number, last_reply_at}] }
    if (path === '/sms/replied-numbers' && request.method === 'GET') {
      return await handleRepliedNumbers(request, env);
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
          const errBody = await reg.text();
          console.error('Retell register failed (attempt 1):', reg.status, errBody);
          // Retry once after 800ms before falling back to Costa's cell
          await new Promise(r => setTimeout(r, 800));
          const reg2 = await fetch('https://api.retellai.com/v2/register-phone-call', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: agentId, from_number: from, to_number: to, direction: 'inbound', metadata: { twilio_call_sid: callSid } })
          });
          if (!reg2.ok) {
            const err2 = await reg2.text();
            console.error('Retell register failed after retry, forwarding to Costa:', reg2.status, err2);
            await sendTelegramAlert(env, `⚠️ <b>Retell connect failed — forwarding to Costa</b>\nSite: ${SITE_LABELS[to] || to}\nCaller: ${from}\nStatus: ${reg2.status}`);
            return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="25"><Number>${COSTA_PHONE}</Number></Dial></Response>`);
          }
          const { call_id: call_id2 } = await reg2.json();
          const sip2 = `sip:${call_id2}@sip.retellai.com;transport=tcp`;
          return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true"><Sip>${sip2}</Sip></Dial></Response>`);
        }

        const { call_id } = await reg.json();
        // Mark this Twilio call as Retell-handled so the call-status backup handler
        // doesn't fire a false "short/dropped" alarm when Sarah answers a short call.
        if (callSid && env.SPAM_LOG) {
          await env.SPAM_LOG.put(`retell_handled:${callSid}`, '1', { expirationTtl: 86400 }).catch(() => {});
        }
        const sip = `sip:${call_id}@sip.retellai.com;transport=tcp`;
        return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true"><Sip>${sip}</Sip></Dial></Response>`);
      } catch (e) {
        console.error('twilio-voice error:', e.message);
        await sendTelegramAlert(env, `⚠️ <b>Retell connect error — forwarding to Costa</b>\nSite: ${SITE_LABELS[to] || to}\nError: ${e.message}`).catch(() => {});
        return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="25"><Number>${COSTA_PHONE}</Number></Dial></Response>`);
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

    // ── Retell Voice Agent Tools — multi-tenant ──
    // Sarah (RR sites):    /retell/save_lead, /retell/send_sms_form, etc.
    // Kim (ITD outbound + inbound):  /retell/itd/<tool>
    // Carolina (Source 4 outbound + inbound):  /retell/source4/<tool>
    // Auth: WEBHOOK_SECRET in body or x-api-key header.
    if (path.startsWith('/retell/') && request.method === 'POST') {
      return await handleRetellTool(request, env, path, ctx);
    }
    // Vapi /voice/* handler retired 2026-05-09 — Elise dead, all agents on Retell.

    // ── Calendly Webhook ──
    if (path === '/webhook/calendly' && request.method === 'POST') {
      return await handleCalendlyWebhook(request, env);
    }

    // ── Public lead packet page (no auth — URL is the access control) ──
    if (path.startsWith('/packet/') && request.method === 'GET') {
      return await serveLeadPacket(path.replace('/packet/', '').replace(/\/$/, ''), env);
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

    if (path === '/api/leads/quality-report' && request.method === 'GET') {
      if (providedPin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      return await getLeadQualityReport(url, env);
    }

    if (path.startsWith('/api/leads/') && path.endsWith('/enrichment') && request.method === 'POST') {
      if (providedPin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      const leadId = path.replace('/api/leads/', '').replace('/enrichment', '');
      return await saveLeadEnrichment(request, leadId, env);
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

    // ── Call quality scores (read by weekly digest / judge cron) ──
    // GET /api/call-scores?since=ISO8601&limit=50 → { ok, scores: [...] }
    // POST /api/call-scores   body: { call_id, agent, scores: {}, summary, ts }
    if (path === '/api/call-scores') {
      const pin = url.searchParams.get('pin') || providedPin;
      if (pin !== env.AUTH_PIN) return json({ error: 'Unauthorized' }, 401);
      if (request.method === 'GET') {
        const since = url.searchParams.get('since');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        try {
          const list = await env.SPAM_LOG.list({ prefix: 'voice:judge:' });
          const keys = list.keys.slice(-Math.min(limit, 200));
          const items = await Promise.all(keys.map(k => env.SPAM_LOG.get(k.name).then(v => { try { return JSON.parse(v); } catch { return null; } })));
          const scores = items.filter(Boolean).filter(s => !since || (s.ts || '') >= since).reverse();
          return json({ ok: true, count: scores.length, scores });
        } catch (e) { return json({ error: e.message }, 500); }
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const callId = body.call_id || `manual_${Date.now()}`;
        await env.SPAM_LOG.put(`voice:judge:${body.ts || new Date().toISOString()}:${callId}`, JSON.stringify({ ...body, stored_at: new Date().toISOString() }), { expirationTtl: 7776000 });
        return json({ ok: true, stored: callId });
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
  '+19360317459',  // form spam — BANGE backpack bot — 2026-04-21
  '+16072036069',  // spam — Attt Tv cold-call — 2026-04-23
  '+18009432189',  // spam — inaudible/VOIP robocall — Lafayette Septic — 2026-04-26
  '+15098165476',  // Angi's List spam — 2026-04-27
  '+17206741296',  // Angi's List spam — 2026-05-01
  '+14793155613',  // Angi's List spam — 2026-05-04
  '+13854122496',  // spam — Topeka Foundation Pros — 2026-05-04
  '+16233362306',  // misdial confirmed — 2026-05-01
]);

// Numbers to exclude from the leads dashboard (internal test calls etc.)
const INTERNAL_NUMBERS = new Set(['+17344761457']);

// Form lead spam: known bot emails and message keywords (case-insensitive)
const SPAM_EMAILS = new Set([
  'ericjonesmyemail@gmail.com',
  'sales@bruntnell.bangeshop.com',
  'no.reply.charlesjohansen@gmail.com',
]);
// Regex patterns for rotating-name bots (e.g. no.reply.XXX@gmail.com)
const SPAM_EMAIL_PATTERNS = [
  /^no\.reply\./i,
];
// Spam email domains — any email @these domains is silently dropped.
// Disposable / throwaway / random-fuzzer domains. Add new ones as bots rotate.
const SPAM_DOMAINS = new Set([
  'bangeshop.com',
  'gmx.com',
  'gmx.net',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
  'throwam.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  // 2026-04-29 random-fuzzer bot hit elkhornhardwood.com via .info burner domains
  'immenseignite.info',
  'tempmail.com',
  'temp-mail.org',
  'tempmailo.com',
  'fakeinbox.com',
  'trashmail.com',
  '10minutemail.com',
  '10minutemail.net',
  'maildrop.cc',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'mailnesia.com',
  'spambox.us',
  'spam4.me',
  'mohmal.com',
  'tempinbox.com',
  'mytemp.email',
  'emailondeck.com',
  'inboxbear.com',
  'fakemailgenerator.com',
  'tempr.email',
  'mintemail.com',
]);
const SPAM_KEYWORDS = [
  'web visitors into leads',
  'visitorsintoleads',
  'bange backpack',
  'sling bag',
  'anti-theft bag',
  'built-in usb',
  'outreach messages directly through',
  'platform allows sending outreach',
  'sending outreach messages',
];

// ── Gibberish detector for random-string fuzzer bots ──────────────────────
// Catches bots that fill every field with random alphabet strings like
// "xzlsqmtnzi" / "uydpskrg" / "igholsqqloktdluywkjgnsxvleydlg".
// Pairs with ≥2-unique-gibberish-strings rule in handleLeadIngest so that
// occasional false positives (e.g. consonant-heavy Polish names like
// "Krzysztof") don't block real leads — only when DIFFERENT fields all look
// random does the lead drop.
function looksLikeGibberish(s) {
  if (!s || typeof s !== 'string') return false;
  const txt = s.toLowerCase().trim();
  if (txt.length < 6) return false;
  if (/[\s.,!?@\-]/.test(txt)) return false;       // sentences / emails / hyphenated
  if (!/^[a-z]+$/.test(txt)) return false;         // all letters only
  // Strong signal: any consonant run of 5+ covering ≥50% of the string.
  // English almost never has 5 consecutive consonants outside loanwords.
  const longRuns = (txt.match(/[bcdfghjklmnpqrstvwxyz]{5,}/g) || []);
  const longRunChars = longRuns.reduce((n, r) => n + r.length, 0);
  if (longRunChars / txt.length >= 0.50) return true;
  // Backup signal: ≥10-char string with no common English digraphs.
  const COMMON = ['th','sh','ch','ing','tion','er','on','an','en','in','es','ed','or','st','le','ar','ent','all','ome','ack','re','at','it','ou','as','is','ti','to','of','nd','ng','ll','ee','oo'];
  const hits = COMMON.filter(p => txt.includes(p)).length;
  if (txt.length >= 12 && hits === 0) return true;
  return false;
}

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
  <Dial callerId="${to}" timeout="30" action="${workerUrl}/webhook/missed-call?secret=${env.WEBHOOK_SECRET || ''}&amp;site=${encodeURIComponent(siteLabel)}&amp;to=${encodeURIComponent(to)}">
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

  // Immediate alert when a call never connects (CF outage, Worker 502, Retell transient, etc.)
  // Also send missed-call SMS to the caller so the lead isn't fully lost.
  if (['busy', 'failed', 'no-answer'].includes(callStatus)) {
    if (!BLOCKED_CALLERS.has(from)) {
      const siteLabel = SITE_LABELS[to] || to;
      const callerFmt = from.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
      await sendTelegramAlert(env,
        `🚨 <b>LEAD LOST — ${siteLabel}</b>\n📲 ${callerFmt}\nStatus: ${callStatus}\nSending them an SMS now.`
      );
      // Send missed-call SMS — recovers the lead even if agent never connected
      const message = MISSED_CALL_MESSAGES[to] ||
        "Hey, I'm sorry I missed your call! Please reply with what you need and your location and I'll get right back to you. — Costa";
      await twilioPost(env, 'Messages.json', { From: to, To: from, Body: message });
    }
    return new Response('OK', { status: 200 });
  }

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

  // Skip if Retell handled this call — Sarah answered, short duration is normal
  if (callSid && env.SPAM_LOG) {
    try {
      const retellHandled = await env.SPAM_LOG.get(`retell_handled:${callSid}`);
      if (retellHandled) {
        return new Response('OK', { status: 200 });
      }
    } catch (e) { /* non-blocking */ }
  }

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

async function handleIncomingSMS(request, env, ctx) {
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

      // Fire-and-forget enrichment (no-op when no API key configured).
      if (ctx && from) {
        const cleanPh = from.replace(/\D/g, '');
        const e164 = cleanPh.length === 10 ? `+1${cleanPh}` : cleanPh.length === 11 ? `+${cleanPh}` : null;
        if (e164) ctx.waitUntil(enrichLeadAtSave(smsKey, e164, env));
      }
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

async function handleLeadIngest(request, env, ctx) {
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

    // Form spam filter — known bot emails, domains, message keywords, phone format, URL injection
    const rawEmail  = (fields.email || fields.Email || '').toLowerCase().trim();
    const emailDomain = rawEmail.split('@')[1] || '';
    const rawMsg    = (fields.message || fields.Message || fields.problem_description || fields.description || '').toLowerCase();
    const rawPhone  = (fields.phone || fields.Phone || '').replace(/\D/g, '');

    // Invalid phone: provided but not 10 or 11 digits (US numbers only)
    const invalidPhone = rawPhone.length > 0 && rawPhone.length !== 10 && rawPhone.length !== 11;
    // 11-digit number must start with 1 (country code) — otherwise foreign/fake
    const invalidCountryCode = rawPhone.length === 11 && rawPhone[0] !== '1';

    // Bot self-injection: site's own domain appearing in the message body
    const refererDomain = (fields.site_domain || (request.headers.get('Referer') || '').replace(/https?:\/\//, '').split('/')[0] || '').toLowerCase();
    const urlInMessage = refererDomain && rawMsg.includes(refererDomain);

    // Random-string fuzzer detection — drop if ≥2 DIFFERENT fields are
    // gibberish. Dedup by string so a Polish name appearing in both
    // first_name and email-prefix counts once, not twice.
    // 2026-04-29 elkhornhardwood lead had 4 different gibberish strings.
    const emailPrefix = rawEmail.split('@')[0] || '';
    const rawFirst = (fields.first_name || fields.firstName || '').toLowerCase().trim();
    const rawLast  = (fields.last_name  || fields.lastName  || '').toLowerCase().trim();
    const gibSet = new Set();
    for (const c of [emailPrefix, rawMsg, rawFirst, rawLast]) {
      if (looksLikeGibberish(c)) gibSet.add(c);
    }
    const isFuzzerBot = gibSet.size >= 2;

    if (
      SPAM_EMAILS.has(rawEmail) ||
      SPAM_DOMAINS.has(emailDomain) ||
      SPAM_EMAIL_PATTERNS.some(re => re.test(rawEmail)) ||
      SPAM_KEYWORDS.some(kw => rawMsg.includes(kw)) ||
      invalidPhone ||
      invalidCountryCode ||
      urlInMessage ||
      isFuzzerBot
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

        // Fire-and-forget enrichment via Abstract/NumVerify (no-op when no key).
        if (ctx && phone) {
          const cleanPh = phone.replace(/\D/g, '');
          const e164 = cleanPh.length === 10 ? `+1${cleanPh}` : cleanPh.length === 11 ? `+${cleanPh}` : null;
          if (e164) ctx.waitUntil(enrichLeadAtSave(leadKey, e164, env));
        }
      } catch (e) {
        console.error('KV lead store failed:', e.message);
      }
    }

    // ── Auto-shop form leads from low-tier sites ──
    if (LOW_TIER_SITES.has(source) && phone) {
      shopLeadToContractors(env, { site: source, name, phone, address, service, message }).catch(e =>
        console.error('[auto-shop] failed:', e.message)
      );
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

// SMS replies are hot lead signals — route to the lead alerts channel when
// configured (TELEGRAM_LEAD_CHAT_ID), fall back to Costa's personal chat.
async function sendTelegramLeadAlert(env, message) {
  const token  = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_LEAD_CHAT_ID || env.TELEGRAM_CHAT_ID;
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

// E.164-ish escape for HTML — keeps + and digits, strips anything weird.
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Sendblue inbound SMS webhook handler ───────────────────────────────────
// Architecture:
//   - Sendblue posts JSON: { number, content, message_handle, date_sent, is_outbound }
//   - We skip outbound echoes (Sendblue replays our own sends to the same webhook)
//   - We persist to SPAM_LOG KV under `sms_reply:<E164>:<handle>` (60-day TTL,
//     same as dyn_block — keeps single namespace and matches existing pattern)
//   - Telegram alert to lead channel — replies are conversion signal #1
//   - Returns 200 quickly so Sendblue doesn't retry; storage failure is logged
//     but doesn't propagate (Sendblue retry loops are worse than a missed write)
async function handleSendblueInbound(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Optional shared-secret check — Sendblue can send a custom header per their
  // docs. Set SENDBLUE_WEBHOOK_SECRET to enable; if unset we accept all (some
  // setups can't add headers). Cloudflare's source IP is otherwise public.
  if (env.SENDBLUE_WEBHOOK_SECRET) {
    const got = request.headers.get('x-sendblue-secret') || '';
    if (got !== env.SENDBLUE_WEBHOOK_SECRET) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }

  // Sendblue posts the same payload shape for outbound delivery callbacks
  // (status_callback) and inbound replies. is_outbound=true means it's an echo
  // of our own send — skip storing it as a "reply".
  if (payload.is_outbound === true) {
    return json({ ok: true, ignored: 'outbound_echo' });
  }

  const fromNumber  = String(payload.number || payload.from_number || 'unknown');
  const content     = String(payload.content || '');
  const handle      = String(payload.message_handle || `nohandle-${Date.now()}`);
  const dateSent    = String(payload.date_sent || new Date().toISOString());
  const receivedAt  = Date.now();

  // KV write — 60 day TTL matches dyn_block convention. Idempotent: same handle
  // overwrites the same key, so Sendblue retries don't double-record.
  let stored = false;
  if (env.SPAM_LOG) {
    try {
      const safeNum = fromNumber.replace(/[^+0-9]/g, '');
      const key = `sms_reply:${safeNum}:${handle}`;
      await env.SPAM_LOG.put(key, JSON.stringify({
        from_number: fromNumber,
        content,
        message_handle: handle,
        date_sent: dateSent,
        received_at: receivedAt
      }), { expirationTtl: 60 * 24 * 60 * 60 }); // 60 days
      stored = true;
    } catch (e) {
      console.error('sendblue inbound KV write failed:', e?.message || e);
    }
  }

  // Telegram alert — queued so we return to Sendblue fast; ctx.waitUntil keeps
  // the worker alive for the alert to flush after we respond.
  const truncated = content.length > 600 ? content.slice(0, 600) + '…' : content;
  const tgText =
    `📱 <b>SMS reply received</b>\n` +
    `From: <code>${escapeHtml(fromNumber)}</code>\n` +
    `At: ${escapeHtml(dateSent)}\n\n` +
    `${escapeHtml(truncated)}\n\n` +
    `<i>Auto-paused future SMS to this number.</i>`;
  const alertPromise = sendTelegramLeadAlert(env, tgText);
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(alertPromise);
  } else {
    await alertPromise.catch(() => {});
  }

  return json({ ok: true, stored });
}

// ── Replied-numbers list (consumed by SMS Touch-1 cron) ────────────────────
// Returns distinct phone numbers that have replied since the `since` timestamp.
// SMS cron calls this before every send to skip prospects who already replied.
//
// Implementation: KV list with prefix `sms_reply:`, group by phone, return
// distinct numbers with most recent reply timestamp. KV list returns up to 1000
// keys per page — at 50 prospects/day × 60-day TTL = 3000 max keys, so we
// paginate cursor-style. 60-day TTL bounds cost.
async function handleRepliedNumbers(request, env) {
  if (!env.SPAM_LOG) {
    return json({ ok: false, error: 'kv_unavailable' }, 503);
  }
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');
  // Default: 90 days back (covers full Touch-1+ outreach window).
  const since = sinceParam ? Date.parse(sinceParam) : (Date.now() - 90 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(since)) {
    return json({ ok: false, error: 'invalid_since' }, 400);
  }

  // Authoritative source-of-truth gate: this endpoint feeds a fail-closed
  // check in the SMS cron. Don't 200 with empty results on partial failure.
  const byNumber = new Map(); // number -> { number, last_reply_at }
  try {
    let cursor;
    let safety = 0;
    do {
      const list = await env.SPAM_LOG.list({ prefix: 'sms_reply:', cursor });
      for (const k of list.keys) {
        // Key shape: sms_reply:<E164>:<handle>
        const parts = k.name.split(':');
        if (parts.length < 3) continue;
        const number = parts[1];
        // Pull metadata: cheap if we stored it as KV value, but list() doesn't
        // return values. We'd need a get() per key — costly at scale. Use the
        // key's expiration to derive an approximate timestamp instead, OR
        // store metadata at write-time (preferred path).
        // For now: do a get() — KV reads are 0.50/M and we list ~3K keys max.
        const raw = await env.SPAM_LOG.get(k.name);
        if (!raw) continue;
        let rec;
        try { rec = JSON.parse(raw); } catch { continue; }
        const replyTs = Number(rec.received_at || 0);
        if (!replyTs || replyTs < since) continue;
        const existing = byNumber.get(number);
        if (!existing || replyTs > existing.last_reply_at) {
          byNumber.set(number, { number, last_reply_at: replyTs });
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
      safety += 1;
    } while (cursor && safety < 20);
  } catch (e) {
    return json({ ok: false, error: 'kv_query_failed', detail: String(e?.message || e) }, 500);
  }

  const numbers = [...byNumber.values()]
    .sort((a, b) => b.last_reply_at - a.last_reply_at)
    .map(n => ({ number: n.number, last_reply_at: new Date(n.last_reply_at).toISOString() }));

  return json({
    ok: true,
    since: new Date(since).toISOString(),
    count: numbers.length,
    numbers,
  });
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

// ── Lead Quality Scoring ────────────────────────────────────────────────────
// 100-point composite. Components are independently zero-able so the final
// score degrades gracefully when fields or enrichment are missing.
//
//    phone_valid              20 pts — 10 digits, not all-same, not 555-prefix
//    has_real_name            15 pts — name present, not "Unknown"
//    has_service_area         10 pts — address or city present
//    call_duration            15 pts — voice-source leads only; ≥30s
//    not_blocked              15 pts — phone not in static or KV blocklist
//    line_type_residential    15 pts — enrichment-derived; VOIP penalized
//    region_match             10 pts — enrichment-derived; phone area matches site
//
// Form leads max out at 70 (no call duration). That's intentional —
// voice leads are higher value because Retell already filtered for intent.

// Cross-site repeat-phone signal. A real customer almost never submits leads
// to 3+ different ITD sites within a week — that pattern fingerprints
// scrapers, lead-resellers, and competitor recon. The penalty is applied AFTER
// the component scores sum, so a high-quality but repeat-pattern lead still
// drops into the junk bucket instead of looking like a verified prospect.
//
// Returns a Map<cleanPhone, Set<site>> for leads within `windowDays`.
function buildRepeatPhoneMap(leads, windowDays = 7) {
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const map = new Map();
  for (const lead of leads) {
    const tsMs = new Date(lead.timestamp || 0).getTime();
    if (tsMs < cutoffMs) continue;
    const cleanPhone = (lead.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) continue;
    const site = lead.site || 'unknown';
    if (!map.has(cleanPhone)) map.set(cleanPhone, new Set());
    map.get(cleanPhone).add(site);
  }
  return map;
}

function computeLeadQualityScore(lead, dynBlocked, enrichment, repeatPhoneMap) {
  const components = {};
  const cleanPhone = (lead.phone || '').replace(/\D/g, '').slice(-10);

  // 1. phone_valid (20)
  let phoneValid = false;
  if (cleanPhone.length === 10
    && !/^(\d)\1{9}$/.test(cleanPhone)
    && !cleanPhone.startsWith('555')) {
    phoneValid = true;
  }
  components.phone_valid = phoneValid ? 20 : 0;

  // 2. has_real_name (15)
  const name = (lead.name || lead.fullName || '').trim();
  components.has_real_name =
    (name && name.toLowerCase() !== 'unknown' && name.toLowerCase() !== 'unknown caller') ? 15 : 0;

  // 3. has_service_area (10)
  const addr = (lead.address || '').trim();
  components.has_service_area = addr.length > 0 ? 10 : 0;

  // 4. call_duration (15) — voice leads only
  let durationMs = 0;
  if (lead.raw && typeof lead.raw === 'object') {
    durationMs = Number(lead.raw.duration || lead.raw.duration_ms || 0);
  }
  if (lead.source === 'voice') {
    components.call_duration = durationMs >= 30_000 ? 15 : (durationMs >= 10_000 ? 7 : 0);
  } else {
    // form leads don't have a duration; don't count this component
    components.call_duration = 0;
  }

  // 5. not_blocked (15)
  const phoneE164 = cleanPhone.length === 10 ? `+1${cleanPhone}` : (lead.phone || '');
  const inStaticBlock = BLOCKED_CALLERS.has(phoneE164);
  const inDynamicBlock = dynBlocked && dynBlocked.has(phoneE164);
  components.not_blocked = (inStaticBlock || inDynamicBlock) ? 0 : 15;

  // 6. line_type_residential (15) — from enrichment
  if (enrichment && enrichment.line_type) {
    const lt = String(enrichment.line_type).toLowerCase();
    if (lt === 'mobile' || lt === 'landline' || lt === 'fixed_line') {
      components.line_type_residential = 15;
    } else if (lt === 'voip') {
      components.line_type_residential = 3;  // VOIP heavily penalized — most spam comes from VOIP
    } else {
      components.line_type_residential = 7;
    }
  } else {
    components.line_type_residential = 0;  // unknown — score reflects the missing signal
  }

  // 7. region_match (10) — from enrichment
  if (enrichment && typeof enrichment.region_match === 'boolean') {
    components.region_match = enrichment.region_match ? 10 : 0;
  } else {
    components.region_match = 0;
  }

  const rawTotal = Object.values(components).reduce((a, b) => a + b, 0);

  // Cross-site repeat-phone penalty.
  // 1 site (normal): 0 penalty.
  // 2 sites in 7d:   -10 penalty (suspicious; could be a customer comparing
  //                  cities or a low-effort bot).
  // 3+ sites in 7d:  -25 penalty (almost always a scraper/lead-reseller).
  let repeatPenalty = 0;
  let repeatSiteCount = 1;
  if (repeatPhoneMap && cleanPhone.length === 10) {
    const sites = repeatPhoneMap.get(cleanPhone);
    if (sites) {
      repeatSiteCount = sites.size;
      if (repeatSiteCount >= 3) repeatPenalty = 25;
      else if (repeatSiteCount === 2) repeatPenalty = 10;
    }
  }
  components.repeat_phone_penalty = -repeatPenalty;

  const total = Math.max(0, Math.min(100, rawTotal - repeatPenalty));
  return {
    score: total,
    bucket: bucketize(total),
    components,
    repeat_site_count: repeatSiteCount,
  };
}

function bucketize(score) {
  if (score >= 76) return 'high';
  if (score >= 51) return 'medium';
  if (score >= 26) return 'low';
  return 'junk';
}

// Fire-and-forget enrichment at save-time. Reverse-phone-lookup via either
// AbstractAPI (preferred) or NumVerify (fallback). Writes the same shape as
// tools/lead-enrichment.py to KV `lead_enrichment:<leadId>` so the
// quality-report endpoint picks it up on the next read.
//
// Costa: to enable this, add ABSTRACT_PHONE_API_KEY (or NUMVERIFY_API_KEY) as
// a wrangler secret. Without a key, this function silently no-ops — so it's
// safe to deploy with the secret missing.
async function enrichLeadAtSave(leadId, phoneE164, env) {
  if (!env.SPAM_LOG || !leadId || !phoneE164) return;
  const abstractKey = env.ABSTRACT_PHONE_API_KEY;
  const numverifyKey = env.NUMVERIFY_API_KEY;
  if (!abstractKey && !numverifyKey) return;

  let line_type = null;
  let carrier = null;
  let raw = null;

  try {
    if (abstractKey) {
      const u = `https://phonevalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(abstractKey)}&phone=${encodeURIComponent(phoneE164)}`;
      const r = await fetch(u);
      if (r.ok) {
        const data = await r.json();
        line_type = (data.type || '').toLowerCase() || null;
        carrier = data.carrier || null;
        raw = data;
      }
    }
    if (!line_type && numverifyKey) {
      const u = `https://apilayer.net/api/validate?access_key=${encodeURIComponent(numverifyKey)}&number=${encodeURIComponent(phoneE164)}&country_code=US&format=1`;
      const r = await fetch(u);
      if (r.ok) {
        const data = await r.json();
        line_type = (data.line_type || '').toLowerCase() || null;
        carrier = data.carrier || null;
        raw = data;
      }
    }
  } catch (e) {
    console.error('enrichLeadAtSave fetch failed:', e.message);
    return;
  }

  // Region-match: phone area code vs site label (simple table — keep in sync
  // with tools/lead-enrichment.py SITE_AREA_CODES if Costa adds new metros).
  const SITE_AREA_CODES = {
    'Knoxville':     ['865'],
    'Spokane':       ['509'],
    'Tallahassee':   ['850'],
    'Lafayette':     ['337'],
    'Baton Rouge':   ['225'],
    'Phoenix':       ['480', '602', '623'],
    'Kingsport':     ['423'],
    'San Antonio':   ['210', '726'],
  };
  let region_match = null;
  try {
    const stub = await env.SPAM_LOG.get(leadId);
    if (stub) {
      const lead = JSON.parse(stub);
      const area = (phoneE164.replace(/\D/g, '').slice(-10) || '').slice(0, 3);
      const expected = SITE_AREA_CODES[lead.site];
      if (expected) region_match = expected.includes(area);
    }
  } catch (e) { /* non-blocking */ }

  try {
    await env.SPAM_LOG.put(
      `lead_enrichment:${leadId}`,
      JSON.stringify({
        line_type,
        carrier,
        region_match,
        raw,
        enriched_at: new Date().toISOString(),
        source: 'inline_at_save',
      }),
      { expirationTtl: 7776000 } // 90 days
    );
  } catch (e) {
    console.error('enrichLeadAtSave KV write failed:', e.message);
  }
}

async function loadDynamicBlocklist(env) {
  const blocked = new Set();
  if (!env.SPAM_LOG) return blocked;
  try {
    const list = await env.SPAM_LOG.list({ prefix: 'dyn_block:' });
    for (const key of list.keys) {
      blocked.add(key.name.replace('dyn_block:', ''));
    }
  } catch (e) {
    console.error('loadDynamicBlocklist error:', e.message);
  }
  return blocked;
}

async function getLeadQualityReport(url, env) {
  try {
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') || '30')));
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

    // Pull unified lead set (reuses existing logic).
    const leadsResponse = await getUnifiedLeads(url, env);
    const payload = await leadsResponse.json();
    const leads = payload.leads || [];

    const dynBlocked = await loadDynamicBlocklist(env);

    // Enrichment overlay: KV key `lead_enrichment:{leadId}` written by tools/lead-enrichment.py
    const enrichmentMap = {};
    if (env.SPAM_LOG && leads.length) {
      const keys = leads.map(l => `lead_enrichment:${l.id}`);
      const chunks = [];
      for (let i = 0; i < keys.length; i += 25) chunks.push(keys.slice(i, i + 25));
      for (const chunk of chunks) {
        const vals = await Promise.all(chunk.map(k => env.SPAM_LOG.get(k).catch(() => null)));
        chunk.forEach((key, i) => {
          if (vals[i]) {
            try { enrichmentMap[key.replace('lead_enrichment:', '')] = JSON.parse(vals[i]); }
            catch (e) {}
          }
        });
      }
    }

    // Build repeat-phone-across-sites map across ALL fetched leads (not just
    // the windowed subset) so a phone that hit 3 sites yesterday and 1 today
    // still gets correctly flagged on today's record.
    const repeatPhoneMap = buildRepeatPhoneMap(leads, 7);

    const buckets = { high: 0, medium: 0, low: 0, junk: 0 };
    const scored = [];
    let repeatFlagged = 0;
    for (const lead of leads) {
      const tsMs = new Date(lead.timestamp || 0).getTime();
      if (tsMs < sinceMs) continue;
      const enrichment = enrichmentMap[lead.id] || null;
      const { score, bucket, components, repeat_site_count } =
        computeLeadQualityScore(lead, dynBlocked, enrichment, repeatPhoneMap);
      buckets[bucket] += 1;
      if (repeat_site_count >= 2) repeatFlagged += 1;
      scored.push({
        id: lead.id, score, bucket, components,
        repeat_site_count,
        name: lead.name || lead.fullName, phone: lead.phone,
        site: lead.site, source: lead.source, timestamp: lead.timestamp,
        enriched: !!enrichment,
      });
    }

    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    if (format === 'csv') {
      const cols = ['timestamp', 'id', 'site', 'source', 'name', 'phone',
        'score', 'bucket', 'enriched', 'repeat_site_count',
        'phone_valid', 'has_real_name', 'has_service_area',
        'call_duration', 'not_blocked', 'line_type_residential',
        'region_match', 'repeat_phone_penalty'];
      const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [cols.join(',')];
      for (const r of scored) {
        const c = r.components || {};
        lines.push([
          r.timestamp, r.id, r.site, r.source, r.name, r.phone,
          r.score, r.bucket, r.enriched, r.repeat_site_count,
          c.phone_valid, c.has_real_name, c.has_service_area,
          c.call_duration, c.not_blocked, c.line_type_residential,
          c.region_match, c.repeat_phone_penalty,
        ].map(esc).join(','));
      }
      return new Response(lines.join('\n') + '\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lead-quality-${days}d.csv"`,
          ...CORS_HEADERS,
        },
      });
    }

    return json({
      window_days: days,
      total: scored.length,
      buckets,
      bucket_definitions: {
        junk: '0-25 (likely spam, missing data, or blocked)',
        low: '26-50 (incomplete record)',
        medium: '51-75 (legitimate but unverified)',
        high: '76-100 (verified, voice + enrichment)',
      },
      enrichment_coverage: leads.length
        ? Math.round((Object.keys(enrichmentMap).length / leads.length) * 100) + '%'
        : '0%',
      cross_site_repeat_phones: repeatFlagged,
      generated_at: new Date().toISOString(),
      leads: scored,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function saveLeadEnrichment(request, leadId, env) {
  try {
    const body = await request.json();
    const { line_type, carrier, region_match, raw } = body || {};
    if (!env.SPAM_LOG) return json({ error: 'KV not bound' }, 500);
    const record = {
      line_type: line_type || null,
      carrier: carrier || null,
      region_match: typeof region_match === 'boolean' ? region_match : null,
      raw: raw || null,
      enriched_at: new Date().toISOString(),
    };
    await env.SPAM_LOG.put(
      `lead_enrichment:${leadId}`,
      JSON.stringify(record),
      { expirationTtl: 7776000 }, // 90 days, matches lead retention
    );
    return json({ ok: true, id: leadId });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
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

async function serveLeadPacket(phoneSlug, env) {
  try {
    const idxRaw = env.SPAM_LOG ? await env.SPAM_LOG.get('leads:index') : null;
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    // phone slug = first 6 digits of the 10-digit cleaned phone
    const cleanSlug = phoneSlug.replace(/\D/g, '');
    let lead = null;
    for (const key of idx) {
      const parts = key.split(':'); // lead:{ts}:{phoneHash}
      const phoneHash = parts[2] || '';
      if (phoneHash.startsWith(cleanSlug)) {
        const raw = await env.SPAM_LOG.get(key);
        if (raw) { lead = JSON.parse(raw); break; }
      }
    }
    if (!lead) {
      return new Response(
        `<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">` +
        `<h2>Lead Not Found</h2><p>This lead may have expired or the link is invalid. ` +
        `Reply directly to <a href="mailto:costa@irontigerleads.com">costa@irontigerleads.com</a> for details.</p></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }
    const ts = new Date(lead.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lead Packet — Iron Tiger Leads</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#222}
h2{color:#c0392b}table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px 12px;border-bottom:1px solid #eee;vertical-align:top}
td:first-child{font-weight:bold;width:30%;color:#555}
.cta{background:#c0392b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px}
footer{margin-top:32px;font-size:12px;color:#999}</style></head>
<body>
<h2>Lead Packet</h2>
<p>This lead was referred by <strong>Iron Tiger Leads</strong>. Reply to claim it.</p>
<table>
<tr><td>Name</td><td>${escHtml(lead.name || '—')}</td></tr>
<tr><td>Phone</td><td>${escHtml(lead.phone || '—')}</td></tr>
<tr><td>Address</td><td>${escHtml(lead.address || '—')}</td></tr>
<tr><td>Service</td><td>${escHtml(lead.service || '—')}</td></tr>
<tr><td>Details</td><td>${escHtml(lead.summary || '—')}</td></tr>
<tr><td>Received</td><td>${ts} CT</td></tr>
<tr><td>Site</td><td>${escHtml(lead.site || '—')}</td></tr>
</table>
<a class="cta" href="mailto:costa@irontigerleads.com?subject=Claiming lead — ${encodeURIComponent(lead.name || phoneSlug)}">Reply to Claim This Lead</a>
<footer>Iron Tiger Leads · costa@irontigerleads.com · (225) 535-4918<br>
Contact info released upon reply. First to respond gets it.</footer>
</body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (e) {
    return new Response('Error loading lead packet: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

// ── Retell Tool Handler — Sarah inbound lead capture ─────────────────────────

const BAYOU_TECHE_FROM = '+13374920960';  // Bayou Teche Septic Twilio number
const BAYOU_TECHE_FORM = 'https://bayoutecheseptic.com/estimate/';

// Map agent_id → site config (Twilio number used as SMS sender + estimate form URL)
const RETELL_SITE_MAP = {
  'agent_c89f789b30dde8b7e1edcd9ec9': { label: 'Lafayette Septic Service', from: '+13374920960', form_url: 'https://bayoutecheseptic.com/estimate/' },
  'agent_90bf3f1172eda6a8620b41d99d': { label: 'Peak Shine Detailing',     from: '+14235891682', form_url: 'https://peakshinedetailing.com/estimate/' },
  'agent_4d788033bcfe3eb5efc900ba98': { label: 'Knox Pressure Pros',       from: '+18653788377', form_url: 'https://knoxpressurepros.com/estimate/' },
  'agent_34b1d6e96da170cd9ae51473bc': { label: 'Inland NW Hot Tubs',       from: '+15092367423', form_url: 'https://inlandnwhottubs.com/estimate/' },
  'agent_d17e4bc682748e8377bc9cb7d0': { label: 'Tally Mobile Mechanic',    from: '+18507263411', form_url: 'https://tallymobilemechanic.com/estimate/' },
};

async function handleRetellTool(request, env, path, ctx) {
  let body;
  try { body = await request.json(); } catch (e) {
    return json({ result: 'Error: invalid JSON body' });
  }

  // Auth: accept secret in body OR x-api-key header
  const authHeader = request.headers.get('x-api-key') || '';
  const bodySecret = body.secret || '';
  if (env.WEBHOOK_SECRET && authHeader !== env.WEBHOOK_SECRET && bodySecret !== env.WEBHOOK_SECRET) {
    return json({ result: 'Error: unauthorized' }, 401);
  }

  // Path forms:
  //   /retell/<tool>           → Sarah (legacy, RR-site agents)
  //   /retell/itd/<tool>       → Kim (ITD outbound + inbound)
  //   /retell/source4/<tool>   → Carolina (Source 4 inbound + outbound)
  const tail = path.replace('/retell/', '');
  const segs = tail.split('/').filter(Boolean);
  let tenant, tool;
  if (segs.length >= 2 && (segs[0] === 'itd' || segs[0] === 'source4')) {
    tenant = segs[0];
    tool = segs.slice(1).join('/');
  } else {
    tenant = 'sarah';
    tool = segs[0] || '';
  }

  const callId = body.call_id || '';
  const agentId = body.agent_id || '';
  // Retell sends flat body (payload_schema + parameters merged), not nested args.
  // Strip meta fields so args contains only semantic tool parameters.
  const { call_id: _cid, agent_id: _aid, to_number: _ton, _source, site_domain: _sd, secret: _sec, ...args } = body;

  if (tenant === 'sarah') {
    const site = RETELL_SITE_MAP[agentId] || { label: 'Iron Tiger Digital', from: BAYOU_TECHE_FROM, form_url: BAYOU_TECHE_FORM };
    switch (tool) {
      case 'save_lead':         return await retellSaveLead(args, callId, site, env, ctx);
      case 'send_sms_form':     return await retellSendSmsForm(args, site, env);
      case 'transfer_to_owner': return retellTransfer(args, env);
      case 'report_spam':       return await retellReportSpam(args, callId, env);
      default: return json({ result: `Error: unknown sarah tool "${tool}"` });
    }
  }

  if (tenant === 'itd') {
    switch (tool) {
      case 'book_demo':              return await kimBookDemo(args, callId, env);
      case 'save_disposition':       return await kimSaveDisposition(args, callId, env);
      case 'transfer_to_owner':      return kimTransferToOwner(args, env);
      case 'request_quote':          return kimRequestQuote(args, env);
      case 'send_demo_link':         return await kimSendDemoLink(args, env);
      case 'lookup_caller':          return await kimLookupCaller(args, env);
      case 'request_callback_costa': return await kimRequestCallbackCosta(args, callId, env);
      case 'pre_call_brief':         return await kimPreCallBrief(args, env);
      case 'apollo_enrich':          return await apolloEnrich(args, env);
      default: return json({ result: `Error: unknown itd tool "${tool}"` });
    }
  }

  if (tenant === 'source4') {
    switch (tool) {
      case 'lookup_caller':          return await carolinaLookupCaller(args, env);
      case 'submit_quote_intake':    return await carolinaSubmitQuoteIntake(args, callId, env);
      case 'lookup_order':           return await carolinaLookupOrder(args, env);
      case 'book_spec_call':         return await carolinaBookSpecCall(args, callId, env);
      case 'request_freight_quote':  return await carolinaRequestFreightQuote(args, callId, env);
      case 'request_pricing':        return await carolinaRequestPricing(args, callId, env);
      case 'check_inventory':        return await carolinaCheckInventory(args, env);
      case 'resend_quote':           return await carolinaResendQuote(args, callId, env);
      case 'transfer_to_sales':      return carolinaTransferToSales(args, env);
      case 'transfer_to_logistics':  return carolinaTransferToLogistics(args, env);
      case 'route_to_support':       return carolinaRouteToSupport(args, env);
      case 'route_to_billing':       return carolinaRouteToBilling(args, env);
      case 'log_service_issue':      return await carolinaLogServiceIssue(args, callId, env);
      case 'request_email_followup': return await carolinaRequestEmailFollowup(args, callId, env);
      case 'update_klaviyo_event':   return await carolinaUpdateKlaviyoEvent(args, env);
      case 'save_disposition':       return await carolinaSaveDisposition(args, callId, env);
      case 'transfer_to_owner':      return carolinaTransferToOwner(args, env);
      case 'pre_call_brief':         return await carolinaPreCallBrief(args, env);
      case 'apollo_enrich':          return await apolloEnrich(args, env);
      default: return json({ result: `Error: unknown source4 tool "${tool}"` });
    }
  }

  return json({ result: `Error: unknown tenant "${tenant}"` });
}

async function retellSaveLead(args, callId, site, env, ctx) {
  const { customer_name, last_name, phone, address, service_requested, urgency, sms_ok, problem_description } = args;
  const fullName = [customer_name, last_name].filter(Boolean).join(' ') || 'Unknown';
  const phoneClean = (phone || '').trim();
  const ts = new Date().toISOString();

  const lead = { fullName, phone: phoneClean, address, service_requested, urgency, sms_ok, problem_description, call_id: callId, site: site.label, saved_at: ts };

  // Inline quality scoring with what we have at save-time. Enrichment is added
  // later by the offline backfill (tools/lead-enrichment.py). Score gets
  // recomputed on the /api/leads/quality-report endpoint with whatever
  // enrichment is available at request time, so this is purely informational.
  try {
    const dynBlocked = await loadDynamicBlocklist(env);
    const scoring = computeLeadQualityScore(
      { ...lead, name: fullName, source: 'voice', raw: { duration: 0 } },
      dynBlocked,
      null,
    );
    lead.quality_score = scoring.score;
    lead.quality_bucket = scoring.bucket;
    lead.quality_components = scoring.components;
  } catch (e) {
    console.error('quality scoring failed at save:', e.message);
  }

  let savedKey = null;
  if (env.SPAM_LOG) {
    savedKey = `lead:${Date.now()}:${phoneClean.replace(/\D/g, '')}`;
    await env.SPAM_LOG.put(savedKey, JSON.stringify(lead), { expirationTtl: 7776000 }); // 90 days
  }

  // Fire-and-forget enrichment (no-op when no API key configured).
  if (ctx && savedKey && phoneClean) {
    const cleanPh = phoneClean.replace(/\D/g, '');
    const e164 = cleanPh.length === 10 ? `+1${cleanPh}` : cleanPh.length === 11 ? `+${cleanPh}` : null;
    if (e164) ctx.waitUntil(enrichLeadAtSave(savedKey, e164, env));
  }

  const urgencyFlag = urgency === 'emergency' ? '🚨 EMERGENCY — ' : urgency === 'same-day' ? '⚡ SAME-DAY — ' : '';
  const alertMsg = `${urgencyFlag}🔥 NEW LEAD — ${site.label}\n👤 ${fullName}\n📞 ${phoneClean}\n📍 ${address || 'not given'}\n🔧 ${service_requested || 'unknown'}\n🕐 ${urgency || 'unknown'}${problem_description ? '\n📝 ' + problem_description : ''}`;
  await sendTelegramAlert(env, alertMsg);

  if (sms_ok !== false && phoneClean) {
    try {
      await twilioPost(env, 'Messages.json', {
        From: site.from,
        To: phoneClean,
        Body: `Hi ${customer_name || 'there'} — I mentioned I'd send over our quick estimate form. Fill this out and upload any photos, and our team will follow up to get a time locked in: ${site.form_url}`,
      });
    } catch (e) {
      console.error('retellSaveLead SMS error:', e.message);
    }
  }

  return json({ result: `Got it — lead saved for ${fullName}.${sms_ok !== false && phoneClean ? ' Estimate form text is on its way.' : ''}` });
}

async function retellSendSmsForm(args, site, env) {
  const { phone, customer_name } = args;
  const phoneClean = (phone || '').trim();
  if (!phoneClean) return json({ result: 'Error: phone number required' });

  try {
    await twilioPost(env, 'Messages.json', {
      From: site.from,
      To: phoneClean,
      Body: `Hi ${customer_name || 'there'} — here's our quick estimate form. Fill it out and add any photos, and our team will call to get you scheduled: ${site.form_url}`,
    });
    return json({ result: `Estimate form sent to ${phoneClean}.` });
  } catch (e) {
    console.error('retellSendSmsForm error:', e.message);
    return json({ result: `SMS failed — team will call directly instead.` });
  }
}

function retellTransfer(args, env) {
  const { reason } = args;
  return json({
    result: 'Connecting you with the team now — please hold just a moment.',
    action: { type: 'transfer_call', number: COSTA_PHONE },
  });
}

async function retellReportSpam(args, callId, env) {
  const rawNumber = args.caller_number || args.phone || '';
  const number = String(rawNumber).startsWith('+') ? rawNumber : `+1${String(rawNumber).replace(/\D/g, '')}`;
  const reason = args.reason || 'flagged-by-sarah';
  if (env.SPAM_LOG && number.length >= 10) {
    await env.SPAM_LOG.put(`dyn_block:${number}`, JSON.stringify({
      reason: `retell:${reason}`, blocked_at: new Date().toISOString(),
      source_call_id: callId, flagged_by: 'retell-sarah'
    }), { expirationTtl: 5184000 });
  }
  return json({ result: 'Number logged. Ending call now.' });
}

// ── Voice helpers (KV storage + Brevo email) ───────────────────────────────────

async function kvPut(env, key, payload, ttlSec = 7776000) {
  if (!env.SPAM_LOG) return;
  try { await env.SPAM_LOG.put(key, JSON.stringify(payload), { expirationTtl: ttlSec }); }
  catch (e) { console.error('kvPut error:', e.message); }
}

async function kvListPriorCalls(env, tenant, phone, limit = 5) {
  if (!env.SPAM_LOG || !phone) return [];
  try {
    const phoneClean = String(phone).replace(/\D/g, '');
    if (!phoneClean) return [];
    const list = await env.SPAM_LOG.list({ prefix: `voice:${tenant}:caller:${phoneClean}:` });
    const recent = list.keys.slice(-limit);
    const items = await Promise.all(recent.map(k => env.SPAM_LOG.get(k.name).then(v => { try { return JSON.parse(v); } catch { return null; } })));
    return items.filter(Boolean).reverse();
  } catch (e) { console.error('kvListPriorCalls error:', e.message); return []; }
}

async function brevoSend(env, fromName, fromEmail, toEmail, subject, htmlContent, textContent) {
  if (!env.BREVO_API_KEY || !toEmail) return false;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        ...(htmlContent ? { htmlContent } : {}),
        ...(textContent ? { textContent } : {}),
      })
    });
    return r.ok;
  } catch (e) { console.error('brevoSend error:', e.message); return false; }
}

function source4Routing(env) {
  return {
    salesEmail:     env.SOURCE4_SALES_EMAIL     || 'costa@irontigerdigital.com',
    logisticsEmail: env.SOURCE4_LOGISTICS_EMAIL || 'costa@irontigerdigital.com',
    supportEmail:   env.SOURCE4_SUPPORT_EMAIL   || 'costa@irontigerdigital.com',
    billingEmail:   env.SOURCE4_BILLING_EMAIL   || 'costa@irontigerdigital.com',
    salesPhone:     env.SOURCE4_SALES_PHONE     || '',
    logisticsPhone: env.SOURCE4_LOGISTICS_PHONE || '',
    supportPhone:   env.SOURCE4_SUPPORT_PHONE   || '',
    billingPhone:   env.SOURCE4_BILLING_PHONE   || '',
  };
}

// ── Kim (ITD outbound + inbound) tool handlers ─────────────────────────────────

async function kimBookDemo(args, callId, env) {
  const { prospect_id, slot_iso, email, notes, phone } = args;
  const bookingUrl = await getCalendlyBookingUrl(env);
  const isUnique = bookingUrl !== CALENDLY_FALLBACK_URL;

  await kvPut(env, `voice:itd:demo_booking:${Date.now()}:${prospect_id || 'na'}`, {
    prospect_id, slot_iso, email, phone, notes, call_id: callId,
    booking_url: bookingUrl, unique_link: isUnique, status: 'calendly_link_sent'
  });
  if (phone) await kvPut(env, `voice:itd:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { phone, outcome: 'demo_booked', call_id: callId, notes });

  if (email) {
    await brevoSend(env, 'Iron Tiger Digital', 'irontigerdigital@gmail.com', email,
      'Pick a 15-min slot with Costa',
      `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px"><h2 style="color:#c45c26">Let's lock in your demo</h2><p>As promised, here's the link to pick a 15-minute slot with Costa to walk through the site, the lead numbers, and pricing for your area:</p><p style="margin:24px 0"><a href="${bookingUrl}" style="background:#c45c26;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:bold">Pick a Time →</a></p><p style="color:#888;font-size:13px">— Iron Tiger Digital</p></div>`);
  }

  await sendTelegramAlert(env,
    `📅 <b>Kim — Demo link sent</b>\n📧 ${email || '(no email)'}\n🆔 ${prospect_id || '(no id)'}${notes ? `\n📝 ${notes}` : ''}\n🔗 ${bookingUrl}${isUnique ? ' (unique)' : ' (fallback)'}`);

  return json({ result: email
    ? `I just sent the Calendly link to ${email}. Pick whatever time works — Costa will get the invite the moment you book it.`
    : `I'll have Costa send the Calendly link over to you. What's the best email?`
  });
}

async function kimSaveDisposition(args, callId, env) {
  const { prospect_id, outcome, notes, callback_at, phone } = args;
  await kvPut(env, `voice:itd:disposition:${callId || Date.now()}:${prospect_id || 'na'}`, {
    prospect_id, outcome, notes, callback_at, phone, call_id: callId
  });
  if (phone) await kvPut(env, `voice:itd:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { phone, outcome, notes, call_id: callId });
  const flag = { sold: '💰', demo_booked: '📅', callback: '📞', dnc: '🚫' }[outcome];
  if (flag) await sendTelegramAlert(env,
    `${flag} <b>Kim — ${String(outcome).replace(/_/g,' ').toUpperCase()}</b>\n🆔 ${prospect_id || '?'}${phone ? `\n📱 ${phone}` : ''}${notes ? `\n📝 ${notes}` : ''}${callback_at ? `\n🔁 Callback: ${callback_at}` : ''}`);
  return json({ result: `Saved: ${outcome}` });
}

function kimTransferToOwner(args, env) {
  const { reason } = args;
  sendTelegramAlert(env, `📲 <b>Kim — LIVE TRANSFER incoming</b>\nConnecting prospect to Costa now\n📝 ${reason || 'prospect requested human'}`).catch(()=>{});
  return json({
    result: 'Connecting you with Costa now — please hold for just a moment.',
    action: { type: 'transfer_call', number: COSTA_PHONE }
  });
}

function kimRequestQuote(args, env) {
  const { niche, city } = args;
  const nicheKey = String(niche || '').toLowerCase().trim();
  const cityKey  = String(city  || '').toLowerCase().trim();
  const p = PRICING_MATRIX[nicheKey];
  if (!p) {
    return json({ result: `Real number depends on your market — let me set the demo so Costa can run the actual quote for your area.` });
  }
  const tierIdx = TIER1_CITIES.has(cityKey) ? 0 : TIER3_CITIES.has(cityKey) ? 2 : 1;
  const band = [p.t1, p.t2, p.t3][tierIdx];
  const flat = Math.round((band[0] + band[1]) / 2 / 50) * 50;
  const ppl  = p.ppl[tierIdx];
  return json({ result: `$${flat.toLocaleString()}/month flat — all leads exclusive, month-to-month, 30-day cancel, no setup fee. Or pay-per-lead at $${ppl}/qualified lead if you'd rather not commit monthly.` });
}

async function kimSendDemoLink(args, env) {
  const { email, prospect_id } = args;
  if (!email) return json({ result: "What's the best email to send the demo link to?" });
  const demoUrl = 'https://demo.irontigerdigital.com';
  const ok = await brevoSend(env, 'Iron Tiger Digital', 'irontigerdigital@gmail.com', email,
    'Your Iron Tiger Digital demo site',
    `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px"><h2 style="color:#c45c26">Iron Tiger Digital — Demo Site</h2><p>As promised, here's a look at what you'd be getting:</p><p style="margin:24px 0"><a href="${demoUrl}" style="background:#c45c26;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold">View Demo Site →</a></p><p>Your site would be built and ranked for your specific niche and city. To see live lead data and walk through the numbers, grab a 15-minute slot with Costa.</p><p style="color:#888;font-size:13px">— Kim · Iron Tiger Digital</p></div>`,
    null);
  await kvPut(env, `voice:itd:demo_link:${Date.now()}:${prospect_id || 'na'}`, { email, prospect_id, sent: ok });
  return json({ result: ok ? `Demo link sent to ${email}.` : "Email failed — I've noted it and Costa will follow up directly." });
}

async function kimLookupCaller(args, env) {
  const phone = args.phone || args.from_number || args.caller_number;
  if (!phone) return json({ result: 'No prior calls found — proceeding fresh.' });
  const prior = await kvListPriorCalls(env, 'itd', phone);
  await kvPut(env, `voice:itd:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { phone, looked_up_at: new Date().toISOString() });
  if (!prior.length) return json({ result: 'No prior calls found — first time caller.' });
  const last = prior[0];
  const lastDate = last.saved_at ? last.saved_at.slice(0,10) : (last.looked_up_at ? last.looked_up_at.slice(0,10) : 'unknown');
  return json({ result: `Caller has ${prior.length} prior interaction${prior.length>1?'s':''}. Last: ${last.outcome || last.disposition || 'inquiry'} on ${lastDate}.${last.notes ? ' Note: ' + String(last.notes).slice(0,200) : ''}` });
}

async function kimRequestCallbackCosta(args, callId, env) {
  const { phone, name, reason, preferred_time } = args;
  await kvPut(env, `voice:itd:callback:${Date.now()}`, { phone, name, reason, preferred_time, call_id: callId, source: 'kim_inbound' });
  if (phone) await kvPut(env, `voice:itd:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { phone, outcome: 'callback_requested', call_id: callId, notes: reason });
  await sendTelegramAlert(env,
    `📞 <b>Kim — Callback requested</b>\n👤 ${name || 'Unknown'}\n📱 ${phone || '(no number)'}\n🕐 ${preferred_time || 'asap'}${reason ? `\n📝 ${reason}` : ''}`);
  return json({ result: `Got it — Costa will call ${name ? name + ' ' : ''}back ${preferred_time ? 'around ' + preferred_time : 'within a couple hours'}.` });
}

// ── Pre-call brief + Apollo enrichment (shared across ITD + Source4) ──────────

async function buildCallerBrief(env, tenant, phone) {
  if (!phone) return null;
  const phoneClean = String(phone).replace(/\D/g, '');
  if (!phoneClean) return null;
  const prior = await kvListPriorCalls(env, tenant, phone, 10);
  if (!prior.length) return null;

  const outcomes = prior.map(p => p.outcome || p.call_outcome || p.disposition || 'inquiry');
  const lastOutcome = outcomes[0];
  const lastDate = (prior[0].saved_at || prior[0].looked_up_at || '').slice(0, 10) || 'unknown';
  const notes = prior.map(p => p.notes).filter(Boolean).slice(0, 3).join('; ');
  const name = prior.map(p => p.customer_name || p.name).filter(Boolean)[0] || null;
  const company = prior.map(p => p.company).filter(Boolean)[0] || null;
  const email = prior.map(p => p.email).filter(Boolean)[0] || null;
  const sku = prior.map(p => p.sku_or_product).filter(Boolean)[0] || null;

  let brief = `Prior caller — ${prior.length} interaction${prior.length > 1 ? 's' : ''}.`;
  if (name) brief += ` Name: ${name}.`;
  if (company) brief += ` Company: ${company}.`;
  if (email) brief += ` Email: ${email}.`;
  brief += ` Last contact: ${lastOutcome} on ${lastDate}.`;
  if (sku) brief += ` Prev interest: ${sku}.`;
  if (notes) brief += ` Notes: ${notes.slice(0, 300)}.`;

  return brief;
}

async function kimPreCallBrief(args, env) {
  const phone = args.phone || args.from_number || args.caller_number;
  const brief = await buildCallerBrief(env, 'itd', phone);
  if (!brief) return json({ brief: null, first_time: true, result: 'First time caller — no prior history.' });
  return json({ brief, first_time: false, result: brief });
}

async function carolinaPreCallBrief(args, env) {
  const phone = args.phone || args.from_number || args.caller_number;
  const brief = await buildCallerBrief(env, 'source4', phone);
  if (!brief) return json({ brief: null, first_time: true, result: 'First time caller — no prior history.' });
  return json({ brief, first_time: false, result: brief });
}

async function apolloEnrich(args, env) {
  const { phone, email, company } = args;
  if (!env.APOLLO_API_KEY) {
    return json({ enriched: false, reason: 'Apollo not configured', result: 'No enrichment available — proceeding without company context.' });
  }
  try {
    const query = {};
    if (phone) query.phone = phone;
    if (email) query.email = email;
    if (company) query.organization_name = company;
    const r = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': env.APOLLO_API_KEY },
      body: JSON.stringify(query),
    });
    if (!r.ok) throw new Error(`Apollo ${r.status}`);
    const data = await r.json();
    const person = data.person || {};
    const org = person.organization || {};
    const result = [
      person.name ? `Contact: ${person.name}` : null,
      person.title ? `Title: ${person.title}` : null,
      org.name ? `Company: ${org.name}` : null,
      org.industry ? `Industry: ${org.industry}` : null,
      org.estimated_num_employees ? `Size: ${org.estimated_num_employees} employees` : null,
      org.annual_revenue_printed ? `Revenue: ${org.annual_revenue_printed}` : null,
    ].filter(Boolean).join('. ');
    return json({ enriched: true, result: result || 'Enrichment returned no data.' });
  } catch (e) {
    return json({ enriched: false, reason: e.message, result: 'Enrichment unavailable — proceeding fresh.' });
  }
}

// ── Carolina (Source 4) tool handlers ──────────────────────────────────────────

async function carolinaLookupCaller(args, env) {
  const phone = args.phone || args.from_number || args.caller_number;
  if (!phone) return json({ result: 'No caller number — proceeding fresh.' });
  const prior = await kvListPriorCalls(env, 'source4', phone);
  await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { phone, looked_up_at: new Date().toISOString() });
  if (!prior.length) return json({ result: 'No prior calls — first time caller.' });
  const last = prior[0];
  const lastDate = last.saved_at ? last.saved_at.slice(0,10) : (last.looked_up_at ? last.looked_up_at.slice(0,10) : 'unknown');
  return json({ result: `Caller has ${prior.length} prior interaction${prior.length>1?'s':''}. Last: ${last.call_outcome || last.outcome || 'inquiry'} on ${lastDate}.${last.notes ? ' Note: ' + String(last.notes).slice(0,200) : ''}` });
}

async function carolinaSubmitQuoteIntake(args, callId, env) {
  const { customer_name, company, phone, email, application, sku_or_product, quantity, install_date, ship_zip, notes } = args;
  const r = source4Routing(env);
  const payload = { customer_name, company, phone, email, application, sku_or_product, quantity, install_date, ship_zip, notes, call_id: callId };
  await kvPut(env, `voice:source4:quote_intake:${Date.now()}`, payload);
  if (phone) await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { ...payload, outcome: 'quote_submitted' });
  await sendTelegramAlert(env,
    `🛠 <b>Carolina — Quote intake</b>\n👤 ${customer_name || '?'}${company ? ' / ' + company : ''}\n📞 ${phone || '?'}\n📧 ${email || '?'}\n🎯 App: ${application || '?'}\n🆔 SKU/Product: ${sku_or_product || '?'}\n📦 Qty: ${quantity || '?'}\n📅 Install: ${install_date || '?'}\n📮 Ship ZIP: ${ship_zip || '?'}${notes ? `\n📝 ${notes}` : ''}`);
  await brevoSend(env, 'Carolina (Source 4)', 'noreply@irontigerdigital.com', r.salesEmail,
    `[Source 4 Voice] New quote intake — ${customer_name || 'Unknown'}${company ? ' / ' + company : ''}`,
    null,
    `New quote intake captured by Carolina:\n\nName: ${customer_name || '-'}\nCompany: ${company || '-'}\nPhone: ${phone || '-'}\nEmail: ${email || '-'}\nApplication: ${application || '-'}\nSKU/Product: ${sku_or_product || '-'}\nQuantity: ${quantity || '-'}\nInstall date: ${install_date || '-'}\nShip ZIP: ${ship_zip || '-'}\nNotes: ${notes || '-'}\n\nCall ID: ${callId}\nReply SLA: 4 business hours.`);
  return json({ result: `Got it — quote intake submitted for ${customer_name || 'you'}. Our sales team will follow up within 4 business hours with pricing and freight.` });
}

async function carolinaLookupOrder(args, env) {
  const { order_number, po_number, customer_name } = args;
  await kvPut(env, `voice:source4:order_lookup_request:${Date.now()}`, args);
  await sendTelegramAlert(env,
    `📦 <b>Carolina — Order lookup requested</b>\nOrder: ${order_number || '?'}\nPO: ${po_number || '?'}\nCustomer: ${customer_name || '?'}\n(No OMS integration yet — manual follow-up needed)`);
  return json({ result: `Let me chase that down for you — I'll have someone from logistics call back with the status within an hour. Best callback number?` });
}

async function carolinaBookSpecCall(args, callId, env) {
  const { customer_name, company, email, phone, application, notes } = args;
  const bookingUrl = await getCalendlyBookingUrl(env);
  await kvPut(env, `voice:source4:spec_call:${Date.now()}`, { ...args, call_id: callId, booking_url: bookingUrl });
  if (phone) await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { ...args, outcome: 'spec_call_booked', call_id: callId });
  if (email) {
    await brevoSend(env, 'Source 4 Industries', 'noreply@irontigerdigital.com', email,
      'Source 4 — Spec call with our engineer',
      `<div style="font-family:Arial,sans-serif;color:#333;max-width:600px"><h2 style="color:#c45c26">Let's get your spec sorted</h2><p>Pick a 30-minute slot with our spec engineer to walk through your application:</p><p style="margin:24px 0"><a href="${bookingUrl}" style="background:#c45c26;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:bold">Book Spec Call →</a></p>${application ? `<p><b>Application:</b> ${application}</p>` : ''}<p style="color:#888;font-size:13px">— Source 4 Industries</p></div>`,
      null);
  }
  await sendTelegramAlert(env,
    `🔧 <b>Carolina — Spec call booked</b>\n👤 ${customer_name || '?'}${company ? ' / '+company : ''}\n📧 ${email || '(no email)'}\n🎯 ${application || '?'}\n🔗 ${bookingUrl}`);
  return json({ result: email
    ? `I just sent you the link to book a spec call with our engineer. Pick whatever time works — they'll have the application notes ready.`
    : `What's the best email — I'll send you the spec-call booking link right now.` });
}

async function carolinaRequestFreightQuote(args, callId, env) {
  const { ship_zip, weight_lbs, dims, items, residential, lift_gate, notes, customer_name, phone, email } = args;
  const r = source4Routing(env);
  await kvPut(env, `voice:source4:freight_quote:${Date.now()}`, { ...args, call_id: callId });
  if (phone) await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { ...args, outcome: 'freight_quote_requested', call_id: callId });
  await sendTelegramAlert(env,
    `🚚 <b>Carolina — Freight quote requested</b>\n📮 ZIP: ${ship_zip || '?'}\n⚖️ ${weight_lbs || '?'} lbs\n📐 ${dims || '?'}\n📦 ${items || '?'}\n🏠 Residential: ${residential ? 'yes' : 'no'}\n🔼 Lift gate: ${lift_gate ? 'yes' : 'no'}${customer_name ? `\n👤 ${customer_name}` : ''}${phone ? `\n📞 ${phone}` : ''}${notes ? `\n📝 ${notes}` : ''}`);
  await brevoSend(env, 'Carolina (Source 4)', 'noreply@irontigerdigital.com', r.logisticsEmail,
    `[Source 4 Voice] Freight quote — ZIP ${ship_zip || '?'}`,
    null,
    `Carolina captured a freight-quote request:\n\nZIP: ${ship_zip || '-'}\nWeight: ${weight_lbs || '-'} lbs\nDims: ${dims || '-'}\nItems: ${items || '-'}\nResidential: ${residential ? 'yes' : 'no'}\nLift gate: ${lift_gate ? 'yes' : 'no'}\nCustomer: ${customer_name || '-'}\nPhone: ${phone || '-'}\nEmail: ${email || '-'}\nNotes: ${notes || '-'}\nCall ID: ${callId}\n\nPlease quote and reply within 4 business hours.`);
  return json({ result: `Got it — freight quote requested. Our logistics team will price it and follow up within a few hours with the freight number and lead time.` });
}

async function carolinaRequestPricing(args, callId, env) {
  const { sku_or_product, quantity, customer_name, email, phone, company } = args;
  const r = source4Routing(env);
  await kvPut(env, `voice:source4:pricing_request:${Date.now()}`, { ...args, call_id: callId });
  if (phone) await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { ...args, outcome: 'pricing_requested', call_id: callId });
  await sendTelegramAlert(env,
    `💰 <b>Carolina — Pricing requested</b>\n🆔 ${sku_or_product || '?'}\n📦 Qty: ${quantity || '?'}\n👤 ${customer_name || '?'}${company ? ' / ' + company : ''}\n📞 ${phone || '?'}\n📧 ${email || '?'}`);
  await brevoSend(env, 'Carolina (Source 4)', 'noreply@irontigerdigital.com', r.salesEmail,
    `[Source 4 Voice] Pricing request — ${sku_or_product || 'unspecified'}`,
    null,
    `Carolina captured a pricing request:\n\nSKU/Product: ${sku_or_product || '-'}\nQuantity: ${quantity || '-'}\nCustomer: ${customer_name || '-'}\nCompany: ${company || '-'}\nPhone: ${phone || '-'}\nEmail: ${email || '-'}\nCall ID: ${callId}`);
  return json({ result: `I've routed your pricing request to our sales team. They'll follow up within 4 business hours with volume tiers and any applicable discounts.` });
}

async function carolinaCheckInventory(args, env) {
  const { sku_or_product, quantity } = args;
  await kvPut(env, `voice:source4:inventory_check:${Date.now()}`, args);
  await sendTelegramAlert(env,
    `📊 <b>Carolina — Inventory check requested</b>\n🆔 ${sku_or_product || '?'}\n📦 Qty: ${quantity || '?'}\n(No inventory feed yet — manual lookup needed)`);
  return json({ result: `Let me chase that down — I'll have someone confirm stock and lead time within the hour. What's your callback number?` });
}

async function carolinaResendQuote(args, callId, env) {
  const { quote_id, sku_change, customer_email, customer_name } = args;
  const r = source4Routing(env);
  await kvPut(env, `voice:source4:resend_quote:${Date.now()}`, { ...args, call_id: callId });
  await sendTelegramAlert(env,
    `🔁 <b>Carolina — Resend quote requested</b>\n🆔 Quote: ${quote_id || '?'}${sku_change ? `\n🔄 Spec swap: ${sku_change}` : ''}${customer_email ? `\n📧 ${customer_email}` : ''}${customer_name ? `\n👤 ${customer_name}` : ''}`);
  await brevoSend(env, 'Carolina (Source 4)', 'noreply@irontigerdigital.com', r.salesEmail,
    `[Source 4 Voice] Resend quote ${quote_id || ''}${sku_change ? ' (spec swap: ' + sku_change + ')' : ''}`,
    null,
    `Carolina captured a resend-quote request:\n\nQuote ID: ${quote_id || '-'}\nSpec swap: ${sku_change || 'none'}\nCustomer email: ${customer_email || '-'}\nCustomer name: ${customer_name || '-'}\nCall ID: ${callId}\n\nPlease resend the original quote PDF${sku_change ? ' with the spec swap applied' : ''}.`);
  return json({ result: sku_change
    ? `Got it — sending the updated quote with the ${sku_change} swap. Should be in your inbox within ten minutes.`
    : `On it — resending the original quote now. Anything else I can pull while you have me?` });
}

function carolinaTransferToSales(args, env) {
  const { reason } = args;
  const r = source4Routing(env);
  if (r.salesPhone) {
    sendTelegramAlert(env, `📲 <b>Carolina — Transfer to sales</b>\nReason: ${reason || 'unspecified'}`).catch(()=>{});
    return json({ result: 'Connecting you with our sales team now — please hold.', action: { type: 'transfer_call', number: r.salesPhone } });
  }
  kvPut(env, `voice:source4:callback:sales:${Date.now()}`, args).catch(()=>{});
  sendTelegramAlert(env, `⚠️ <b>Carolina — Sales transfer queued (no SOURCE4_SALES_PHONE configured)</b>\nReason: ${reason || '?'}`).catch(()=>{});
  return json({ result: `Our sales team is in a meeting — let me have them call you right back. Best number?` });
}

function carolinaTransferToLogistics(args, env) {
  const { reason } = args;
  const r = source4Routing(env);
  if (r.logisticsPhone) {
    sendTelegramAlert(env, `📲 <b>Carolina — Transfer to logistics</b>\nReason: ${reason || '?'}`).catch(()=>{});
    return json({ result: 'Connecting you with logistics now — please hold.', action: { type: 'transfer_call', number: r.logisticsPhone } });
  }
  kvPut(env, `voice:source4:callback:logistics:${Date.now()}`, args).catch(()=>{});
  sendTelegramAlert(env, `⚠️ <b>Carolina — Logistics transfer queued (no SOURCE4_LOGISTICS_PHONE)</b>\nReason: ${reason || '?'}`).catch(()=>{});
  return json({ result: `Logistics is on another line — let me have them call you back. Best number?` });
}

function carolinaRouteToSupport(args, env) {
  const { reason } = args;
  const r = source4Routing(env);
  if (r.supportPhone) {
    sendTelegramAlert(env, `📲 <b>Carolina — Route to support</b>\n${reason || ''}`).catch(()=>{});
    return json({ result: 'Connecting you with support now — please hold.', action: { type: 'transfer_call', number: r.supportPhone } });
  }
  kvPut(env, `voice:source4:callback:support:${Date.now()}`, args).catch(()=>{});
  sendTelegramAlert(env, `⚠️ <b>Carolina — Support route queued (no SOURCE4_SUPPORT_PHONE)</b>\n${reason || '?'}`).catch(()=>{});
  return json({ result: `Let me get support to call you right back. Best number?` });
}

function carolinaRouteToBilling(args, env) {
  const { reason } = args;
  const r = source4Routing(env);
  if (r.billingPhone) {
    sendTelegramAlert(env, `📲 <b>Carolina — Route to billing</b>\n${reason || ''}`).catch(()=>{});
    return json({ result: 'Connecting you with billing now — please hold.', action: { type: 'transfer_call', number: r.billingPhone } });
  }
  kvPut(env, `voice:source4:callback:billing:${Date.now()}`, args).catch(()=>{});
  sendTelegramAlert(env, `⚠️ <b>Carolina — Billing route queued (no SOURCE4_BILLING_PHONE)</b>\n${reason || '?'}`).catch(()=>{});
  return json({ result: `Let me get billing to call you right back. Best number?` });
}

async function carolinaLogServiceIssue(args, callId, env) {
  const { customer_name, company, phone, email, issue, severity, order_number } = args;
  const r = source4Routing(env);
  await kvPut(env, `voice:source4:service_issue:${Date.now()}`, { ...args, call_id: callId });
  if (phone) await kvPut(env, `voice:source4:caller:${String(phone).replace(/\D/g,'')}:${Date.now()}`, { ...args, outcome: 'service_issue', call_id: callId });
  const sevFlag = severity === 'urgent' ? '🚨 ' : '';
  await sendTelegramAlert(env,
    `${sevFlag}🛠 <b>Carolina — Service issue logged</b>\n👤 ${customer_name || '?'}${company ? ' / ' + company : ''}\n📞 ${phone || '?'}\n📧 ${email || '?'}\n🆔 Order: ${order_number || '?'}\n⚠️ Severity: ${severity || 'normal'}\n📝 ${issue || '?'}`);
  await brevoSend(env, 'Carolina (Source 4)', 'noreply@irontigerdigital.com', r.supportEmail,
    `[Source 4 Voice]${severity === 'urgent' ? ' URGENT' : ''} Service issue — ${customer_name || 'Unknown'}`,
    null,
    `Service issue logged by Carolina:\n\nCustomer: ${customer_name || '-'}\nCompany: ${company || '-'}\nPhone: ${phone || '-'}\nEmail: ${email || '-'}\nOrder: ${order_number || '-'}\nSeverity: ${severity || 'normal'}\n\nIssue:\n${issue || '-'}\n\nCall ID: ${callId}`);
  return json({ result: `Service issue logged${severity === 'urgent' ? ' as urgent' : ''}. Our support team will follow up within ${severity === 'urgent' ? '2' : '4'} business hours.` });
}

async function carolinaRequestEmailFollowup(args, callId, env) {
  const { email, topic, notes, customer_name } = args;
  if (!email) return json({ result: `What's the best email for me to send the follow-up to?` });
  await kvPut(env, `voice:source4:email_followup:${Date.now()}`, { ...args, call_id: callId });
  const ok = await brevoSend(env, 'Source 4 Industries', 'noreply@irontigerdigital.com', email,
    `Source 4 follow-up: ${topic || 'your inquiry'}`,
    null,
    `Hi${customer_name ? ' ' + customer_name : ''},\n\nThanks for reaching out to Source 4 Industries. As discussed on our call, here's the follow-up on ${topic || 'your inquiry'}:\n\n${notes || 'Our team will be in touch shortly with the details we discussed.'}\n\nReply to this email or call us at (702) 765-4166 if you need anything else.\n\n— Carolina, Source 4 Industries`);
  await sendTelegramAlert(env,
    `📧 <b>Carolina — Email follow-up</b>\nTo: ${email}\nTopic: ${topic || '?'}\n${ok ? '✅ delivered' : '❌ failed'}`);
  return json({ result: ok ? `Sent the follow-up to ${email}.` : `Email had trouble going through — Costa will get on it directly.` });
}

async function carolinaUpdateKlaviyoEvent(args, env) {
  // No Klaviyo integration yet — log to KV for batch sync.
  const { event_name, customer_email, properties } = args;
  await kvPut(env, `voice:source4:klaviyo_pending:${Date.now()}`, { event_name, customer_email, properties });
  return json({ result: `Logged.` });
}

async function carolinaSaveDisposition(args, callId, env) {
  const { call_outcome, intent, notes, follow_up_at, customer_phone } = args;
  await kvPut(env, `voice:source4:disposition:${callId || Date.now()}`, { call_outcome, intent, notes, follow_up_at, customer_phone, call_id: callId });
  if (customer_phone) await kvPut(env, `voice:source4:caller:${String(customer_phone).replace(/\D/g,'')}:${Date.now()}`, { call_outcome, intent, notes, call_id: callId });
  const flagMap = { quote_submitted: '🛠', spec_call_booked: '🔧', sale: '💰', callback_requested: '📞', escalated: '⚠️' };
  const flag = flagMap[call_outcome];
  if (flag) {
    await sendTelegramAlert(env,
      `${flag} <b>Carolina — ${String(call_outcome).replace(/_/g,' ').toUpperCase()}</b>\n📞 ${customer_phone || '?'}\n🎯 Intent: ${intent || '?'}${notes ? `\n📝 ${notes}` : ''}${follow_up_at ? `\n🔁 Follow-up: ${follow_up_at}` : ''}`);
  }
  return json({ result: `Saved: ${call_outcome}` });
}

function carolinaTransferToOwner(args, env) {
  // Source 4 "owner" routes to Costa (agency); Costa re-routes to Taylor as needed.
  const { reason } = args;
  sendTelegramAlert(env, `📲 <b>Carolina — Transfer to owner (Costa)</b>\nReason: ${reason || '?'}`).catch(()=>{});
  return json({
    result: 'Connecting you with the owner now — please hold.',
    action: { type: 'transfer_call', number: COSTA_PHONE }
  });
}

const CALENDLY_EVENT_TYPE_URI = 'https://api.calendly.com/event_types/3c50ea0f-b4fe-407c-9356-a1f10b8a3144';
const CALENDLY_FALLBACK_URL = 'https://calendly.com/irontigerdigital/30min';

async function getCalendlyBookingUrl(env) {
  if (!env.CALENDLY_PAT) return CALENDLY_FALLBACK_URL;
  try {
    const resp = await fetch('https://api.calendly.com/scheduling_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CALENDLY_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_event_count: 1,
        owner: CALENDLY_EVENT_TYPE_URI,
        owner_type: 'EventType',
      }),
    });
    if (!resp.ok) {
      console.error('Calendly scheduling_links error:', resp.status, await resp.text());
      return CALENDLY_FALLBACK_URL;
    }
    const data = await resp.json();
    return data?.resource?.booking_url || CALENDLY_FALLBACK_URL;
  } catch (e) {
    console.error('Calendly scheduling_links fetch error:', e.message);
    return CALENDLY_FALLBACK_URL;
  }
}

// ── Pricing data (used by kimRequestQuote) ─────────────────────────────────────
const TIER1_CITIES = new Set(['phoenix','houston','atlanta','dallas','chicago','los angeles','new york','miami','las vegas','denver','seattle','portland','san antonio','austin','san diego','san jose','minneapolis','detroit','baltimore','washington']);
const TIER3_CITIES = new Set(['spokane','rapid city','billings','cedar rapids','topeka','lawton','lake charles','edmond','bloomington','mcallen','laredo','shreveport','amarillo']);

const PRICING_MATRIX = {
  'hvac':             { t1:[1800,2400], t2:[1200,1600], t3:[700,1000],  ppl:[75,55,40] },
  'plumbing':         { t1:[1500,2000], t2:[1000,1400], t3:[600,900],   ppl:[65,45,35] },
  'pool resurfacing': { t1:[2000,3000], t2:[1300,1800], t3:[800,1200],  ppl:[150,110,80] },
  'roofing':          { t1:[2200,3500], t2:[1500,2200], t3:[900,1400],  ppl:[120,90,65] },
  'mobile mechanic':  { t1:[900,1300],  t2:[600,900],   t3:[400,600],   ppl:[35,25,20] },
  'septic':           { t1:[1200,1800], t2:[800,1200],  t3:[500,800],   ppl:[55,40,30] },
  'bathroom remodel': { t1:[2500,4000], t2:[1800,2800], t3:[1000,1500], ppl:[200,150,100] },
  'siding':           { t1:[2000,3200], t2:[1400,2000], t3:[900,1300],  ppl:[175,130,90] },
  'radon mitigation': { t1:[1400,2000], t2:[900,1400],  t3:[600,900],   ppl:[100,75,55] },
  'tree service':     { t1:[1200,1800], t2:[800,1200],  t3:[500,800],   ppl:[50,35,25] },
};

// ── Calendly Webhook Handler ──
async function handleCalendlyWebhook(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    return new Response('Bad Request', { status: 400 });
  }

  const event = body?.event;
  const payload = body?.payload;

  if (!event || !payload) return new Response('OK', { status: 200 });

  const inviteeName = payload?.name || 'Unknown';
  const inviteeEmail = payload?.email || '';
  const eventStart = payload?.scheduled_event?.start_time || '';
  const eventUri = payload?.scheduled_event?.uri || '';
  const cancelReason = payload?.cancellation?.reason || '';

  if (env.SPAM_LOG) {
    try {
      await env.SPAM_LOG.put(`calendly_event:${Date.now()}`, JSON.stringify({
        event, inviteeName, inviteeEmail, eventStart, eventUri, cancelReason,
        raw: body, received_at: new Date().toISOString()
      }), { expirationTtl: 7776000 });
    } catch (e) { /* non-blocking */ }
  }

  if (event === 'invitee.created') {
    const startFormatted = eventStart
      ? new Date(eventStart).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : '—';
    await sendTelegramAlert(env,
      `🗓 <b>Demo booked!</b>\n👤 ${inviteeName}\n📧 ${inviteeEmail}\n🕐 ${startFormatted}`
    );
  } else if (event === 'invitee.canceled') {
    await sendTelegramAlert(env,
      `❌ <b>Demo canceled</b>\n👤 ${inviteeName}\n📧 ${inviteeEmail}${cancelReason ? `\n📝 ${cancelReason}` : ''}`
    );
  }

  return new Response('OK', { status: 200 });
}
