#!/bin/bash
# Deploy to STAGING only — agents use this
set -e
cd "$(dirname "$0")"
echo "🔄 Deploying to STAGING (moliam-staging.pages.dev)..."
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-cfut_AZwIcZS8Njtriv4N2tv9GnC6sK7jvXiR2XykCM6Hd92ecdac}" \
  npx wrangler pages deploy ./public --project-name=moliam-staging --branch=main
echo "✅ Staging deploy complete. Preview at moliam-staging.pages.dev"
echo "⚠️  To promote to production, Ada must run deploy-production.sh"
