#!/bin/bash

set -e

echo "========================================="
echo "Email → KV Population Setup"
echo "========================================="
echo ""

# Check for API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set"
  echo ""
  echo "Please set your Cloudflare API token:"
  echo "  export CLOUDFLARE_API_TOKEN='your-token-here'"
  echo ""
  echo "Get your token from: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

echo "✓ API token found"

# Check if backend is running
if ! curl -s http://localhost:4000/ > /dev/null 2>&1; then
  echo "⚠️  Backend not running"
  echo "Starting backend..."
  cd /sessions/happy-tender-galileo/mnt/email/mobicycle/src/3_workFlowEntrypoints/backend
  bun run src/index.ts &
  BACKEND_PID=$!
  echo "Backend started (PID: $BACKEND_PID)"
  sleep 3
else
  echo "✓ Backend running"
fi

# Check if ProtonMail Bridge is running
if ! curl -s http://localhost:4000/list-folders > /dev/null 2>&1; then
  echo "❌ ProtonMail Bridge not accessible via backend"
  echo "Please ensure ProtonMail Bridge is running on localhost:1143"
  exit 1
fi

echo "✓ ProtonMail Bridge accessible"
echo ""

# Run population script
echo "Populating KV namespaces..."
cd /sessions/happy-tender-galileo
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" bun run populate-kv-api.ts

echo ""
echo "========================================="
echo "✅ Setup complete!"
echo "========================================="
