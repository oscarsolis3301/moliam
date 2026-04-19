"""
Instant Memory Integration for Toby API
Adds sub-millisecond memory retrieval to existing endpoints
"""

import sys
from pathlib import Path
import time

# Add paths
sys.path.insert(0, "/Users/clark/.openclaw/workspace")

from openclaw_memory import OpenClawMemory

# Initialize memory systems
PERSONAL_MEMORY = OpenClawMemory("/Users/clark/.openclaw/workspace/openclaw-memories/knowledge.mv2")
TOBY_KNOWLEDGE = OpenClawMemory("/Users/clark/.openclaw/workspace/openclaw-memories/toby-knowledge.mv2")

def search_combined(query: str, top_k: int = 5) -> dict:
    """
    Search both personal and Toby knowledge
    Returns combined results with metadata
    """
    start = time.time()
    
    # Search personal memories
    personal_results = PERSONAL_MEMORY.search(query, top_k=top_k//2)
    
    # Search Toby knowledge base
    toby_results = TOBY_KNOWLEDGE.search(query, top_k=top_k//2)
    
    elapsed = (time.time() - start) * 1000
    
    return {
        "personal": personal_results,
        "knowledge_base": toby_results,
        "time_ms": elapsed,
        "total_hits": len(personal_results) + len(toby_results)
    }

def enhance_prompt_with_memory(query: str) -> str:
    """
    Enhance user query with relevant memory context
    Used before sending to AI model
    """
    # Get relevant context
    results = search_combined(query, top_k=3)
    
    context_parts = []
    
    # Add personal context
    if results["personal"]:
        context_parts.append("## Personal Context:")
        for hit in results["personal"]:
            context_parts.append(f"- {hit['text'][:200]}...")
    
    # Add knowledge base context
    if results["knowledge_base"]:
        context_parts.append("## Knowledge Base Context:")
        for hit in results["knowledge_base"]:
            source = hit["metadata"].get("source", "unknown")
            if "doc_id" in hit["metadata"]:
                context_parts.append(f"- Document {hit['metadata']['doc_id']}: {hit['text'][:200]}...")
            else:
                context_parts.append(f"- {hit['text'][:200]}...")
    
    if context_parts:
        enhanced = "\n\n".join([
            "Context from memory:",
            "\n".join(context_parts),
            "",
            f"User query: {query}",
            "",
            "Based on the above context and your knowledge, please respond."
        ])
        return enhanced
    
    return query

def get_memory_stats():
    """Get combined memory statistics"""
    return {
        "personal_memory": PERSONAL_MEMORY.stats(),
        "toby_knowledge": TOBY_KNOWLEDGE.stats(),
        "total_entries": PERSONAL_MEMORY.stats()["total_entries"] + TOBY_KNOWLEDGE.stats()["total_entries"]
    }
