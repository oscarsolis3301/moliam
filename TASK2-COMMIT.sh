#!/bin/bash
# Task 2 - Input sanitization for contact.js: email validation, HTML stripping, field length limits

echo "Checking contact.js..."
node -c functions/api/contact.js && echo "✓ Syntax OK"

echo "Running pre-commit check..."
bash ~/.hermes/pre-commit-check.sh

if [ $? -eq 0 ]; then
  git add -A
  git commit -m "v3 [backend]: Input sanitization complete for contact.js - email validation, HTML stripping, field length limits, proper JSON errors" && git push origin main && echo "✓ Committed & pushed"
else
  echo "Pre-commit check failed - fixing before commit..."
  exit 1
fi
