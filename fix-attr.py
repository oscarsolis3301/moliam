with open('public/index.html', 'r') as f:
    lines = f.readlines()

# Specific fix: "..."aria-label should become " ... aria-label" (add space before aria-)
for i, line in enumerate(lines):
    # Pattern is exactly: "name"aria-label or "Your name"aria-label  
    if '"aria-label' in line:         # Has the issue
        lines[i] = re.sub(r'"([a-zA-Z-]+)="([^\s"]*)([[:space:]]*=")', r'\1 \3', line)

with open('public/index.html', 'w') as f:
    f.writelines(lines)

print("Fixed the specific attribute pattern")
