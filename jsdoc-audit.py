#!/usr/bin/env python3
"""Audit JSDoc coverage in functions/api/ files (not api/lib/)"""

import os
import re

api_dir = "functions/api"

# Skip lib subdirectories
skip_dirs = ["lib"]

def has_jsdoc_block(content):
    """Check if content has JSDoc comments"""
    return bool(re.search(r'/\*\*[\s\S]*?\*/', content))

def find_functions_without_jsdoc(content, filename):
    """Find all functions that are missing JSDoc"""
    # Match function declarations and arrow functions
    patterns = [
        r'function\s+(\w+)\s*\([^)]*\)',  # function name(...)
        r'(\w+)\s*[:=]\s*(async\s*)?\(.*?\)\s*=>',  # name = (...) => or async (..) =>
        r'(\w+)\s*\([^)]*\)\s*\{',  # name(...) {
    ]
    
    functions_missing = []
    
    for pattern in patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            func_name = match.group(1)
            if func_name.startswith('_') or func_name in ['Object', 'Array', 'Function']:
                continue
                
            start_pos = match.start()
            # Check if there's JSDoc before this function
            preceding_text = content[max(0, start_pos-200):start_pos]
            if not re.search(r'/\*\*[\s\S]{5,60}\*' , preceding_text):
                functions_missing.append((func_name, match.group(0)[:50]))
    
    # Also check exported functions
    exports = re.findall(r'export\s+(?:async\s+)?function\s+(\w+)', content)
    for exp in exports:
        if exp not in [f[0] for f in functions_missing]:
            functions_missing.append((exp, f"export function {exp}"))
    
    return functions_missing

def count_sql_placeholders(content):
    """Count unparameterized SQL (?) placeholders"""
    # Find raw query strings with template literals
    queries = re.findall(r'(\w+)\s*=\s*`(?:[^`]*\\u\{\w+\}[^`]*|`{2}[^`]*(?:`{3,}?[^`]*|`{2})+)+`', content)
    
    # Check for pattern WHERE clause = variable (SQL injection risk)
    risky_patterns = re.findall(r'(WHERE\s+.*?)\s*=\s*\1|SELECT.*?\\u\{\w+\}', content, re.IGNORECASE | re.DOTALL)
    
    return len(re.findall(r"\\.u\{[^}]+\}", content))

files_to_check = [f for f in os.listdir(api_dir) if os.path.isfile(os.path.join(api_dir, f)) and not f.startswith('.')]

print("=" * 70)
print("JSDoc & SQL Injection Audit - functions/api/")
print("=" * 70)

for filename in sorted(files_to_check):
    filepath = os.path.join(api_dir, filename)
    if any(skip in filepath for skip in skip_dirs):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    functions_missing = find_functions_without_jsdoc(content, filename)
    sql_risks = count_sql_placeholders(content)
    
    has_db_exports = "db." in content or "D1Database" in content
    
    if functions_missing or sql_risks > 0:
        print(f"\n📄 {filename}:")
        
        if functions_missing and not has_db_exports:
            print(f"   ⚠️ Functions missing JSDoc ({len(functions_missing)}):")
            for func_name, signature in functions_missing[:10]:
                print(f"      - {func_name}")
            
        if sql_risks > 0:
            print(f"   ⚠️ Potential SQL injection patterns: {sql_risks}")

print("\n" + "=" * 70)
