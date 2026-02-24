#!/bin/bash
# Lead Manager PWA - Cloudflare Worker Deploy Script
# Run this in your terminal to deploy the worker
# Credentials are read from your local .env file (never committed to git)

set -e

WORKSPACE="$HOME/Documents/Rank and Rent \$"
cd "$(dirname "$0")/worker"

echo "🚀 Lead Manager API - Cloudflare Worker Deploy"
echo "================================================"

# Load credentials from workspace .env
if [ -f "$WORKSPACE/.env" ]; then
  source "$WORKSPACE/.env"
  echo "✅ Loaded credentials from workspace .env"
else
  echo "❌ No .env file found at $WORKSPACE/.env"
  echo "   Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"
  exit 1
fi

# Check wrangler
if ! command -v wrangler &> /dev/null; then
  echo "📦 Installing wrangler..."
  npm install -g wrangler
fi

# Override any broken API token — use OAuth instead
unset CLOUDFLARE_API_TOKEN
echo ""
echo "🔑 Logging in to Cloudflare (browser will open)..."
wrangler login

echo ""
echo "🔐 Setting secrets from .env..."
echo "$TWILIO_AUTH_TOKEN" | wrangler secret put TWILIO_AUTH_TOKEN
echo "$TWILIO_ACCOUNT_SID" | wrangler secret put TWILIO_ACCOUNT_SID

echo ""
echo "🔒 Set your PWA PIN (used to authenticate the app):"
read -p "Enter PIN (e.g. 1234): " pin
echo "$pin" | wrangler secret put AUTH_PIN

echo ""
echo "📦 Creating KV namespace for push subscriptions..."
wrangler kv namespace create PUSH_SUBS 2>&1 | tee /tmp/kv_output.txt

# Extract KV namespace ID and add to wrangler.toml
KV_ID=$(grep -oE "id = \"[a-f0-9]{32}\"" /tmp/kv_output.txt | grep -oE '[a-f0-9]{32}' | head -1)

if [ -n "$KV_ID" ]; then
  echo ""
  echo "✅ KV namespace created: $KV_ID"
  # Add KV binding to wrangler.toml (only if not already there)
  if ! grep -q "PUSH_SUBS" wrangler.toml; then
    cat >> wrangler.toml << EOF

[[kv_namespaces]]
binding = "PUSH_SUBS"
id = "$KV_ID"
EOF
    echo "Updated wrangler.toml with KV binding"
  fi
fi

echo ""
echo "🚀 Deploying worker..."
wrangler deploy

echo ""
echo "✅ DONE! Your worker is deployed."
echo "📱 Frontend: https://deme-cyber11.github.io/pwa-lead-manager/"
echo ""
echo "Next steps:"
echo "1. Copy the worker URL from above (ends in .workers.dev)"
echo "2. Open the PWA frontend on your phone"
echo "3. Enter the worker URL + your PIN"
echo "4. Add to home screen (browser menu → Add to Home Screen)"
