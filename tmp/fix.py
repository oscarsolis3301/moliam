#!/usr/bin/env python3
with open('/Users/clark/moliam/public/js/dashboard.js', 'r') as f:
    lines = f.readlines()

new_lines = []
fixed = 0

for line in lines:
    if '${sess...}' in line:
        fixed += 1
        line=line.replace('${sess...}','${session_token}')")+"
    elif '&${sess...n},{ ' in line:
        fixed += 1
        line = line.replace('&${sess...n},{', "&token=${session_token}\n,")+"
    new_lines.append(line)

with open('/Users/clark/moliam/public/js/dashboard.js', 'w') as f:
    f.writelines(new_lines)

print('Fixed %d broken refs'%fixed)
