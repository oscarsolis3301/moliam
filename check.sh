#!/bin/bash
echo "=== Disk Space ===" && df -h / && echo -e "\n=== Git folder ===" && du -sh .git 2>/dev/null || echo "no .git found" && echo -e "\n=== Top level ===" && ls -la | head -5
