#!/bin/bash
# Daily Performance Test - Runs automatically
# Save this as a cron job: 0 9 * * * /Users/clark/.openclaw/workspace/moliam-api/performance-tracking/daily-test.sh

BASE="https://atlas.moliam.com"
ADMIN_KEY="atlas-admin-venzeti-2026"
LIBRARIAN_KEY="atlas-lib-thinktank-2026"

echo "Running daily performance test..."
DATE=$(date +%Y%m%d)
TIME=$(date +%H%M%S)
RESULTS_DIR="/Users/clark/.openclaw/workspace/moliam-api/performance-tracking/speed-tests"

# Create daily summary
SUMMARY_FILE="$RESULTS_DIR/daily-${DATE}.json"

# Test 1: Health Check
START=$(date +%s%N)
curl -s $BASE/healthz -H "Authorization: Bearer $ADMIN_KEY" > /dev/null
END=$(date +%s%N)
HEALTH_TIME=$(( (END - START) / 1000000 ))

# Test 2: Name Query
START=$(date +%s%N)
NAME_RESP=$(curl -s -X POST $BASE/v1/chat/completions \
  -H "Authorization: Bearer $LIBRARIAN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is your name?"}]}')
END=$(date +%s%N)
NAME_TIME=$(( (END - START) / 1000000 ))

# Test 3: User Query
START=$(date +%s%N)
USER_RESP=$(curl -s -X POST $BASE/v1/chat/completions \
  -H "Authorization: Bearer $LIBRARIAN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Who is Oscar Solis?"}]}')
END=$(date +%s%N)
USER_TIME=$(( (END - START) / 1000000 ))

# Test 4: Document List
START=$(date +%s%N)
curl -s "$BASE/v1/documents?limit=10" -H "Authorization: Bearer $LIBRARIAN_KEY" > /dev/null
END=$(date +%s%N)
DOC_TIME=$(( (END - START) / 1000000 ))

# Test 5: GitHub Versions
START=$(date +%s%N)
curl -s $BASE/v1/admin/github/versions -H "Authorization: Bearer $ADMIN_KEY" > /dev/null
END=$(date +%s%N)
GH_TIME=$(( (END - START) / 1000000 ))

# Save results
cat > "$SUMMARY_FILE" << EOF
{
  "test_type": "daily_performance",
  "date": "$DATE",
  "time": "$TIME",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "results": {
    "health_check_ms": $HEALTH_TIME,
    "name_query_ms": $NAME_TIME,
    "user_query_ms": $USER_TIME,
    "document_list_ms": $DOC_TIME,
    "github_versions_ms": $GH_TIME
  },
  "status": "complete"
}
EOF

# Push to GitHub
cd /Users/clark/.openclaw/workspace/moliam-api
TOKEN=$(cat .github-token 2>/dev/null)
if [ -n "$TOKEN" ]; then
    git add performance-tracking/speed-tests/
    git commit -m "Daily performance test: $DATE" 2> /dev/null
    git remote set-url origin https://oscarsolis3301:${TOKEN}@github.com/oscarsolis3301/atlas-api.git 2> /dev/null
    git push origin main 2> /dev/null
    echo "✓ Pushed to GitHub"
fi

echo "Daily test complete: $SUMMARY_FILE"
