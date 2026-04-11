import os

api_dir = "/Users/clark/moliam/functions/api" 
files = [f for f in os.listdir(api_dir) if f.endswith('.js') and not os.path.isdir(os.path.join(api_dir, f))]

results = {}
for f in files:
    filepath = os.path.join(api_dir, f)
    with open(filepath, 'r') as fh: content = fh.read()
    has_try_catch = 'try {' in content and 'catch' in content
    has_onrequest = ('export async function onRequest' in content or 'export const onRequest' in content or 'export function handleOptions' in content)
    results[f] = has_onrequest and has_try_catch

passed = sum(1 for r in results.values() if r)
print(f"\n{'='*40}")
print("ERROR HANDLING AUDIT: functions/api/")
print(f"{'='*40}")
print(f"Files checked: {len(files)}")
print(f"With error handling: {passed}/{len(files)}")

for f, has_handling in sorted(results.items()):
    status = "✅" if has_handling else "❌"
    print(f"{status} {f:30s}")
    
if passed == len(files):
    print(f"\nSTATUS: All API files have try/catch error handling - Task 1 COMPLETE")
else:
    missing = [f for f, h in results.items() if not h]
    print(f"\nNEEDS ATTENTION: {', '.join(missing)}")
