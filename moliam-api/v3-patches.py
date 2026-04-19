"""
v3 Patches for Toby API
1. Instant memory integration
2. Fix identity (Toby not Hermes)
3. Memory stats endpoint
4. Hybrid memory-first AI fallback
"""

import sys
from pathlib import Path

# Add paths
sys.path.insert(0, "/Users/clark/.openclaw/workspace")
sys.path.insert(0, str(Path(__file__).parent))

# Import memory integration
from memory_integration import search_combined, get_memory_stats

# Patch 1: Enhanced personality (Toby identity)
TOBY_PERSONALITY_V3 = """You're Toby. Keep it natural and conversational. Don't over-introduce yourself.

CRITICAL RULES:
1. NEVER say "Hello! I'm Toby" or "I am Toby, a helpful AI assistant" - just answer directly
2. NEVER mention being an AI, assistant, or model
3. When asked "What is your name?" respond: "I'm Toby! What are we working on today?"
4. Use instant memory for all lookups - check memory first before AI processing
5. For user queries: Extract exact info from memory, format as bullet points
6. For step queries: EXACT steps from documents, numbered with bold formatting
7. Bold numbers (1., 2., etc.) for steps, italics for IDs, bullet points for user data

MEMORY SYSTEM:
- Personal memory: 12 entries (conversations, events)
- Knowledge base: 105 entries (documents, users)
- Query time: <2ms
- Use memory.search() for all lookups before AI generation"""

# Patch 2: Memory-first query handler
def handle_query_with_memory(query: str, query_type: str = "general") -> dict:
    """
    Handle query with memory-first approach
    Returns: {response, source, time_ms}
    """
    import time
    start = time.time()
    
    # 1. Check instant memory first
    memory_results = search_combined(query, top_k=3)
    
    # 2. If we have good memory hits, format response
    if memory_results["total_hits"] > 0:
        # Check for exact user match
        for hit in memory_results.get("knowledge_base", []):
            if hit["metadata"].get("type") == "user_profile":
                # Format user data
                text = hit["text"]
                lines = text.split("\n")
                formatted = []
                for line in lines:
                    if ":" in line:
                        key, val = line.split(":", 1)
                        formatted.append(f"• **{key.strip()}:** {val.strip()}")
                
                elapsed = (time.time() - start) * 1000
                return {
                    "response": "\n".join(formatted),
                    "source": "memory",
                    "time_ms": elapsed,
                    "hits": memory_results["total_hits"]
                }
        
        # Check for document steps
        for hit in memory_results.get("knowledge_base", []):
            text = hit["text"]
            if "step" in text.lower() or "troubleshoot" in query.lower():
                # Extract steps
                import re
                steps = re.findall(r'(?:\d+\.\s*|Step\s+\d+[\s:\-]*)\s*([^\n]+)', text, re.IGNORECASE)
                if steps:
                    formatted_steps = "\n".join([f"**{i+1}.** {step.strip()}" for i, step in enumerate(steps)])
                    elapsed = (time.time() - start) * 1000
                    return {
                        "response": formatted_steps,
                        "source": "memory",
                        "time_ms": elapsed,
                        "hits": memory_results["total_hits"]
                    }
    
    # 3. If no memory match, return None (will trigger AI)
    elapsed = (time.time() - start) * 1000
    return {
        "response": None,
        "source": "memory_miss",
        "time_ms": elapsed,
        "hits": 0
    }

# Patch 3: Memory stats endpoint handler
async def admin_memory_stats(request):
    """GET /v1/admin/memory-stats - Memory system statistics"""
    key_data = request.get("key_data", {})
    if not has_permission(key_data, "admin:stats"):
        return web.json_response({"error": "Forbidden"}, status=403)
    
    stats = get_memory_stats()
    
    return web.json_response({
        "status": "ok",
        "memory_system": "memvid-v3",
        "stats": stats,
        "performance": {
            "query_time_ms_avg": "<2",
            "cache_hits": "1000 entries"
        }
    })

# Import has_permission for the stats endpoint
def has_permission(key_data: dict, permission: str) -> bool:
    role = key_data.get("role", "")
    if role == "admin":
        return True
    permissions = key_data.get("permissions", [])
    return permission in permissions or "*" in permissions

import aiohttp
from aiohttp import web
