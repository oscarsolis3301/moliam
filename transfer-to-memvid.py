#!/usr/bin/env python3
"""
Transfer all OpenClaw memories to instant memory system
"""

import sys
sys.path.insert(0, "/Users/clark/.openclaw/workspace")

from openclaw_memory import OpenClawMemory
from pathlib import Path
import time

def transfer_memories():
    """Transfer all existing memories"""
    print("Transferring memories to instant storage...")
    
    mem = OpenClawMemory()
    
    # Transfer daily memory files
    memory_dir = Path("/Users/clark/.openclaw/workspace/memory")
    if memory_dir.exists():
        mem_files = list(memory_dir.glob("*.md"))
        print(f"  Found {len(mem_files)} daily memory files")
        
        for mem_file in sorted(mem_files):
            content = mem_file.read_text()
            mem.put(
                text=content,
                metadata={
                    "source": mem_file.name,
                    "type": "daily_memory",
                    "date": mem_file.stem
                }
            )
    
    # Transfer MEMORY.md
    memory_md = Path("/Users/clark/.openclaw/workspace/MEMORY.md")
    if memory_md.exists():
        print("  Transferring MEMORY.md...")
        content = memory_md.read_text()
        mem.put(
            text=content,
            metadata={
                "source": "MEMORY.md",
                "type": "long_term_memory"
            }
        )
    
    # Transfer AGENTS.md, SOUL.md, etc
    for file in ["AGENTS.md", "SOUL.md", "TOOLS.md", "USER.md"]:
        file_path = Path(f"/Users/clark/.openclaw/workspace/{file}")
        if file_path.exists():
            print(f"  Transferring {file}...")
            mem.put(
                text=file_path.read_text(),
                metadata={
                    "source": file,
                    "type": "configuration"
                }
            )
    
    # Commit
    mem.commit()
    print(f"\n✓ Transferred {len(mem.frames)} memories")
    return mem

def performance_test(mem):
    """Comprehensive performance tests"""
    print("\n=== PERFORMANCE TESTS ===")
    
    test_queries = [
        "Toby deployment",
        "rollback system",
        "Hermes bot",
        "Moliam API",
        "memory system",
        "v3 migration",
        "Discord integration",
        "GitHub versions",
        "user profile",
        "FHIR error",
        "Oscar Solis",
        "Vinh Nguyen"
    ]
    
    times = []
    
    for query in test_queries:
        # Warm up
        _ = mem.search(query, top_k=5)
        
        # Timed run
        start = time.time()
        results = mem.search(query, top_k=5)
        elapsed = (time.time() - start) * 1000
        times.append(elapsed)
        
        hit_count = len(results)
        print(f"  '{query[:25]:25s}' {elapsed:7.3f}ms - {hit_count} hits")
    
    # Statistics
    avg = sum(times) / len(times)
    min_t = min(times)
    max_t = max(times)
    p50 = sorted(times)[len(times) // 2]
    
    print(f"\n═══════════════════════════════════════════════════════════")
    print(f"  Total memories: {mem.stats()['total_entries']}")
    print(f"  Average query:  {avg:.3f}ms")
    print(f"  P50 query:      {p50:.3f}ms")
    print(f"  Min query:      {min_t:.3f}ms")
    print(f"  Max query:      {max_t:.3f}ms")
    print(f"  Target (<5ms):  {'✅ PASS' if avg < 5 else '❌ FAIL'}")
    print(f"═══════════════════════════════════════════════════════════")

def create_backup():
    """Create backup before modifications"""
    import shutil
    backup_dir = Path("/Users/clark/.openclaw/workspace/backup-v3-pre-memvid")
    backup_dir.mkdir(exist_ok=True)
    
    # Backup memory file
    mem_file = Path("/Users/clark/.openclaw/workspace/openclaw-memories/knowledge.mv2")
    if mem_file.exists():
        shutil.copy(mem_file, backup_dir / "knowledge.mv2")
        print(f"✓ Backup created: {backup_dir}")

if __name__ == "__main__":
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║  Memory Transfer - v3 Migration                          ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    
    create_backup()
    mem = transfer_memories()
    performance_test(mem)
    
    print("\n✓ Memory system operational")
    print(f"  Location: {mem.path}")
    print(f"  Usage: from openclaw_memory import memory")
