from pathlib import Path
from collections import defaultdict

# Read files
login_path = Path('/Users/clark/moliam/public/login.html')
dashboard_path = Path('/Users/clark/moliam/public/dashboard.html')

with open(login_path, 'r') as f:
    login = f.read()

with open(dashboard_path, 'r') as f:
    dashboard = f.read()

# Login analysis
print("=== TASK 1: LOGIN.HTML ANALYSIS ===")
print(f"Line count: {len(login.splitlines())}")

# Check Forgot password
has_forgot = 'Forgot' in login or 'forgot' in login
print(f"Has Forgot Password link: {'yes' if has_forgot else 'no'}")

# Check mobile responsive
has_media_queries = '@media' in login
print(f"Has @media queries: {has_media_queries}")

# Check aria-labels
aria_count = login.lower().count('aria-label') + login.lower().count('aria-live')
print(f"Aria labels count: {aria_count}")

# Skip link check
has_skip_link = 'skip-link' in login or 'Skip to' in login
print(f"Has skip-link: {'yes' if has_skip_link else 'no'}")

# Check inline styles vs external scripts
inline_style_tags = login.count('<style>')
external_scripts = login.count('src=')
print(f"Inline <style> tags: {inline_style_tags}")
print(f"External script refs: {external_scripts}")

# Dashboard analysis for Task 2
print("\n=== TASK 2: DASHBOARD.HTML ANALYSIS ===")
lines = dashboard.splitlines()
line_count = len(lines)
print(f"Line count: {line_count}")
if line_count >= 430:
    print("OK: Exceeds 430 line minimum requirement")
else:
    print(f"WARNING: Only {line_count} lines, needs work!")

# Look for duplicate CSS rules in dashboard
inside_style = False
css_text = ''
for ln in lines:
    if '<style>' in ln.lower():
        inside_style = True
    elif '</style>' in ln.lower():
        inside_style = False
    if inside_style and not ('<!' in ln):
        css_text += ln + '\n'

# Extract selectors (simplified)
selectors_seen = defaultdict(int)
for line in css_text.splitlines():
    stripped = line.strip()
    base = stripped.split(':')[0].split('{')[0].replace(',', '').strip()
    if base and (stripped.startswith('.') or stripped.startswith('#') or stripped == 'body' or stripped == '*'):
        selectors_seen[base] += 1

dups = [(s, c) for s, c in selectors_seen.items() if c > 1]
print(f"Potential duplicate CSS selectors: {len(dups)}")
for sel, count in dups[:5]:
    print(f"  - {sel}: appears {count} times")
