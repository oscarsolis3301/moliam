# Memvid Persistent Memory — Tool Reference

> **⚠️ ALREADY INSTALLED — Do NOT reinstall, rebuild, or modify the binary or database.**

## Overview

You have access to a persistent memory system powered by **memvid**. This gives you searchable long-term memory that survives across sessions. The database contains 13,000+ frames of operational knowledge from Ada's experience — project details, client info, deployment procedures, architecture notes, and more.

## File Locations

| Component | Path |
|-----------|------|
| Memory database | `/Users/clark/.hermes/ada-memory.mv2` |
| CLI binary | `/usr/local/bin/ada-memory` |
| Search shortcut | `/usr/local/bin/ada-search` |

## Commands

### Search Memory (PRIMARY — use this FIRST before asking questions)

```bash
# Quick search (recommended)
ada-search "query here" 5

# Equivalent long form
ada-memory search "query here" 5
```

The number at the end is how many results to return (default: 5, max ~20).

**Examples:**
```bash
ada-search "moliam deploy" 5          # Find deployment procedures
ada-search "client OnePlus" 3         # Find client info
ada-search "cloudflare credentials" 3 # Find CF tokens/config
ada-search "pricing" 5               # Find pricing info
ada-search "agent fleet" 5           # Find fleet architecture
```

### Store New Knowledge

```bash
# Pipe content into memory
echo 'The deployment succeeded at 2026-04-06 03:00 UTC' | ada-memory put 'deployment-log' source agent_name

# Store multi-line content
cat <<'EOF' | ada-memory put 'title-of-memory' source agent_name
Line 1 of knowledge
Line 2 of knowledge
More details here
EOF
```

**Parameters for `put`:**
- First arg after `put`: title/label for the memory
- `source`: where this info came from (e.g., `observation`, `task`, `discovery`)
- `agent_name`: your agent name (e.g., `mavrick` or `yagami`)

### Check Database Stats

```bash
ada-memory stats
```

Shows frame count and index status.

## When to Use Memory

1. **BEFORE starting any task** — search for relevant context first
2. **After completing a task** — store key learnings and outcomes
3. **When you encounter new information** — client details, credentials, architecture decisions
4. **When debugging** — search for known issues and past solutions

## Important Notes

- The memory database is **shared knowledge from Ada** — treat it as authoritative
- **Do NOT** attempt to reinstall, rebuild, or `cargo build` memvid — it's already compiled and working
- **Do NOT** modify the `.mv2` file directly — only use the CLI commands
- Search is lexical + vector hybrid — natural language queries work well
- Store important discoveries so other agents benefit from your learnings
