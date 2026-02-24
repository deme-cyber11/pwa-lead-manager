# Lead Manager PWA

Replace OpenPhone ($35/mo) with a free PWA for managing calls & SMS across 5 Rank & Rent business numbers via Twilio.

## Architecture

- **Frontend**: Static PWA hosted on GitHub Pages (`docs/`)
- **Backend**: Cloudflare Worker (free tier) proxies Twilio API
- **Auth**: PIN-based — set on first use, stored in localStorage

## Setup

### 1. Deploy Cloudflare Worker

```bash
cd worker/
npm install -g wrangler   # if not installed
wrangler login
wrangler init lead-manager-api
# Copy index.js into the project
```

Create `wrangler.toml`:
```toml
name = "lead-manager-api"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
TWILIO_ACCOUNT_SID = "YOUR_TWILIO_ACCOUNT_SID"

# Use secrets for sensitive values:
# wrangler secret put TWILIO_AUTH_TOKEN
# wrangler secret put AUTH_PIN
```

Set secrets:
```bash
wrangler secret put TWILIO_AUTH_TOKEN
# Enter: your Twilio auth token

wrangler secret put AUTH_PIN
# Enter: your chosen PIN (e.g. 1234)
```

Deploy:
```bash
wrangler deploy
```

Note the worker URL (e.g. `https://lead-manager-api.your-subdomain.workers.dev`).

### 2. Optional: Push Notifications

Create a KV namespace for push subscriptions:
```bash
wrangler kv:namespace create PUSH_SUBS
```

Add to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "PUSH_SUBS"
id = "<your-namespace-id>"
```

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
```

Re-deploy after adding KV binding.

### 3. Optional: Twilio Webhooks (for push on incoming SMS/calls)

In Twilio Console, for each business number:
- SMS webhook: `https://lead-manager-api.your-subdomain.workers.dev/webhook/sms` (POST)
- Voice webhook: `https://lead-manager-api.your-subdomain.workers.dev/webhook/call` (POST)

**Note:** This is additive — your existing call forwarding and SMS auto-replies continue to work.

### 4. Deploy Frontend to GitHub Pages

1. Push this repo to GitHub
2. Go to repo Settings → Pages
3. Set source to `docs/` folder on `main` branch
4. Site will be at `https://yourusername.github.io/pwa-lead-manager/`

### 5. First Use

1. Open the PWA URL on your phone
2. Enter the Cloudflare Worker URL
3. Set your PIN
4. Add to home screen (browser menu → "Add to Home Screen")

## Business Numbers

| Business | Number | Color |
|----------|--------|-------|
| Elkhorn Hardwood | (719) 215-8962 | Brown |
| Tampa Concrete Pros | (813) 705-9021 | Blue |
| Knox Pressure Pros | (865) 378-8377 | Green |
| Springs Mold Solutions | (719) 496-8287 | Orange |
| Peak Shine Detailing | (423) 589-1682 | Purple |

## Features

- 📱 Tabbed inbox per business
- 💬 Send/receive SMS
- 📞 Call logs with duration
- 🔄 Click-to-callback (Twilio calls you, then connects to customer)
- 🔔 Push notifications for new SMS/calls
- 📲 Installable PWA (works offline for cached data)
- 🌙 Dark mode default
- 🔒 PIN-protected

## Cost

- Cloudflare Worker: **Free** (100K requests/day)
- GitHub Pages: **Free**
- Twilio: **Already paying** for numbers
- Total additional cost: **$0/mo** (saves $35/mo vs OpenPhone)
