#!/usr/bin/env python3
import os
import subprocess

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout + result.stderr
    except Exception as e:
        return f"Error: {e}"

print("=== Disk Space ===")
print(run_cmd("df -h /"))
print("=== Git folder size ===")  
print(run_cmd("du -sh .git 2>/dev/null or ls -la | head -10"))
print("\n=== Top level dir ===")
print(run_cmd("ls -la | head -5"))
