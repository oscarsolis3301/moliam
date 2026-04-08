import os, re

api_dir = "/Users/clark/moliam/functions/api"

def list_all_js(directory, depth=0):
    files = []
    if depth > 4:
        return files
    
    try:
        for item in sorted(os.listdir(directory)):
            path = f"{directory}/{item}"
            if os.path.isdir(path) and not item.startswith('.'):
                sub = list_all_js(path, depth + 1)
                files.extend(sub or [])
            elif item.endswith('.js') and 'seed_temp' not in item:
                files.append(path)
    except:
        pass
    
    return files

files = list_all_js(api_dir)

print("=== Task 2 Audit: All API Functions ===\n")

needs_fixing = []

for fpath in sorted(files):
    filename = os.path.basename(fpath)[:-3] if fpath.endswith('.js') else ""
    
    with open(fpath, 'r', encoding='utf-8') as file:
        content = file.read()
        
    try_count = len(re.findall(r'\btry\s*\{', content))
    catch_count = len(re.findall(r'\} ?catch\s*\(', content))
    
    has_error_handling = 'jsonResp(' in content or 'sendError(' in content or '{ "error"' in content
        
    needs_fix = False
    
    if filename.lower() in ['health', 'qr', 'updates']:   # trivial, skip
        needs_fix = False
        
    elif try_count == 0 and catch_count == 0 and not has_error_handling:
         # No error handling at all - needs fixing
        needs_fix = True
            
    elif try_count > 0 and catch_count < try_count:
           # Has try but no proper catch - suspicious
        if filename.lower() != 'seed':     # seed is already fixed
            needs_fix = True
    
    marker = "!" if (try_count > 0 and catch_count < try_count) else ""
        
    status = "❌ NEEDS FIX" if needs_fix else "✅ OK"
    print(f"{status} {filename:<30} try:{try_count} catch:{catch_count}{marker}")
    
    if needs_fix:
        needs_fixing.append((fpath, filename))

print(f"\n=== Files requiring Task 2 work ({len(needs_fixing)}): ===")
for fpath, fn in needs_fixing:
    print(f"- {fn}")
