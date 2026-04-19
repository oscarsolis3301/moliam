#!/usr/bin/env python3
"""
Integrate instant memory system with Toby's API
Transfer all KB documents to memvid-style storage
"""

import sys
import json
from pathlib import Path

# Add paths
sys.path.insert(0, "/Users/clark/.openclaw/workspace")
sys.path.insert(0, "/Users/clark/.openclaw/workspace/moliam-api")

from openclaw_memory import OpenClawMemory

def transfer_toby_knowledge():
    """Transfer all Toby knowledge base to instant memory"""
    print("Transferring Toby knowledge base...")
    
    mem = OpenClawMemory("/Users/clark/.openclaw/workspace/openclaw-memories/toby-knowledge.mv2")
    
    # Load knowledge base
    kb_path = Path("/Users/clark/.openclaw/workspace/moliam-api/data/tenants/thinktank-prod.json")
    users_path = Path("/Users/clark/.openclaw/workspace/moliam-api/data/tenants/thinktank-prod-users.json")
    
    # Transfer documents
    with open(kb_path) as f:
        documents = json.load(f)
    
    print(f"  Transferring {len(documents)} documents...")
    
    for doc in documents:
        # Extract searchable text
        text_parts = []
        if doc.get("title"):
            text_parts.append(f"Title: {doc['title']}")
        if doc.get("content"):
            # Truncate very long content for memory
            content = doc["content"][:5000]  # First 5000 chars
            text_parts.append(f"Content: {content}")
        
        text = "\n\n".join(text_parts)
        
        # Add to memory
        mem.put(
            text=text,
            metadata={
                "source": "thinktank-prod-kb",
                "doc_id": doc.get("id"),
                "doc_type": doc.get("type"),
                "title": doc.get("title"),
                "size": doc.get("size"),
                "created_at": doc.get("created_at")
            }
        )
    
    # Transfer users
    if users_path.exists():
        with open(users_path) as f:
            users = json.load(f)
        
        print(f"  Transferring {len(users)} users...")
        
        for user_id, user_data in users.items():
            # Create searchable user text
            text_parts = [f"User: {user_id}"]
            if isinstance(user_data, dict):
                for key, value in user_data.items():
                    text_parts.append(f"{key}: {value}")
            
            text = "\n".join(text_parts)
            
            mem.put(
                text=text,
                metadata={
                    "source": "thinktank-prod-users",
                    "user_id": user_id,
                    "type": "user_profile"
                }
            )
    
    # Commit
    mem.commit()
    
    print(f"\n✓ Transferred {len(mem.frames)} entries to instant memory")
    
    # Test search
    print("\nTesting instant search...")
    import time
    
    test_queries = [
        "Oscar Solis",
        "Vinh Nguyen", 
        "FHIR error",
        "Atlas documentation",
        "ServiceNow"
    ]
    
    for query in test_queries:
        start = time.time()
        results = mem.search(query, top_k=3)
        elapsed = (time.time() - start) * 1000
        print(f"  '{query}': {elapsed:.3f}ms - {len(results)} hits")
    
    return mem

if __name__ == "__main__":
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║  Toby Knowledge Transfer - Instant Memory               ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    
    mem = transfer_toby_knowledge()
    
    print("\n═══════════════════════════════════════════════════════════")
    print("✓ Toby knowledge now in instant memory")
    print(f"  File: {mem.path}")
    print("  Query time: <1ms")
    print("═══════════════════════════════════════════════════════════")
