#!/bin/bash
# Deploy to PRODUCTION — ONLY Ada runs this after verifying staging
set -e
cd "$(dirname "$0")"

# Safety check: verify progressive form exists
PF_COUNT=$(grep -c "pf-step\|progressive-form" public/index.html 2>/dev/null || echo "0")
if [ "$PF_COUNT" -lt "10" ]; then
  echo "❌ BLOCKED: Progressive form not found in index.html ($PF_COUNT matches)"
  echo "   This looks like an old version. Aborting to protect production."
  exit 1
fi

# Verify file isn't truncated
LINES=$(wc -l < public/index.html)
if [ "$LINES" -lt "3000" ]; then
  echo "❌ BLOCKED: index.html only has $LINES lines (expected 3000+)"
  echo "   File may be truncated. Aborting."
  exit 1
fi

TAIL=$(tail -1 public/index.html)
if [[ "$TAIL" != *"</html>"* ]]; then
  echo "❌ BLOCKED: index.html doesn't end with </html>"
  echo "   File is truncated. Aborting."
  exit 1
fi

echo "✅ Pre-deploy checks passed ($PF_COUNT progressive-form refs, $LINES lines)"
echo "🚀 Deploying to PRODUCTION (moliam.com)..."
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-cfut_AZwIcZS8Njtriv4N2tv9GnC6sK7jvXiR2XykCM6Hd92ecdac}" \
  npx wrangler pages deploy ./public --project-name=moliam --branch=main
echo "✅ Production deploy complete. Live at moliam.com"
