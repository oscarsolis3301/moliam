import os, re

api_dir = '/Users/clark/.hermes/workspace/moliam/functions/api'

files = [f for f in os.listdir(api_dir) if f.endswith('.js')]
print('=== API Files Review ===\n')

for file in sorted(files):
  with open(os.path.join(api_dir, file), 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()
    
  export_matches = re.findall(r'export\s+(async\s+)?function\s+onRequest\w*\([^)]*\)', content)
  export_count = len(export_matches)
  
  try_catch_count = len(re.findall(r'try\s*{', content))
  jsdoc_blocks = len(re.findall(r'/\*\*\n[ \t*\*]+\s*', content))
  func_defs = len(re.findall(r'(?:async\s+)?function\s+\w+', content)) + export_count
  
  comment_findings = re.findall(r'//[^/]*(?:TODO|FIXME|HACK|XXX|NOTE:|deprecated|STALE|no real|fire-and-forget|Skips test|non-blocking)[^/]*', content, re.IGNORECASE)
  
  has_param_bindings = '.bind(' in content or len(re.findall(r'SELECT.*?\.?\s*', content)) > 0
  missing_jsdoc = func_defs - jsdoc_blocks if jsdoc_blocks < func_defs else 0
  
  print(f'📄 {file}:')
  print(f'   Exported funcs: ~{export_count}, try/catch blocks: {try_catch_count}')
  print(f'   Total functions: {func_defs}, JSDoc blocks: {jsdoc_blocks}')
  if missing_jsdoc > 0:
    print(f'   Missing JSDoc on {missing_jsdoc} functions')
  print(f'   Dead code clues: {len(comment_findings)} found')
  print(f'   Has parameterized bindings: {'✓' if has_param_bindings else '✗'}')
  if len(comment_findings) > 3:
    dead = [c.strip()[:50] for c in comment_findings[:5]]
    print(f'   Dead code samples: {dead}')
  print()
