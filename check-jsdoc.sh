#!/usr/bin/env bash
# JSDoc Coverage Report for functions/api/*.js

echo "=== JSDoc Coverage Audit ==="

for file in functions/api/*.js functions/api/*/*.js; do
  if [[ -f "$file" ]]; then
    # Count total functions
    total=$(grep -c 'function\|=> {' "$file" || echo 0)
    
    # Count functions WITH JSDoc (3-line comment block before function)
    jsdoc=$(awk '/^\s*\*/{getline; if(/^\s*\* @/){count++}}' "$file" || echo 0)
    
    # List functions without JSDoc  
    echo "File: $file"
    grep -n 'function\|^export.*async function' "$file" | head -10
    
    echo ""
  fi
done
