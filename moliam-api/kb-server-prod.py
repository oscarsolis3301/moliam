#!/usr/bin/env python3
"""
Atlas API Server - Production Grade v2.2.0
Role-based access control with Admin and Librarian permissions
Fixed version with proper imports and structure
"""

import os
import json
import asyncio
import hashlib
import secrets
import time
from datetime import datetime
from aiohttp import web, ClientSession, ClientTimeout
import aiohttp_cors
from typing import List, Dict, Any, Optional
import sys
from pathlib import Path
import psutil
import platform

# Import MCP client
sys.path.insert(0, str(Path(__file__).parent))
from mcp_client import mcp_manager, MCPServer

# v3: Import memory integration
sys.path.insert(0, "/Users/clark/.openclaw/workspace")
try:
    from memory_integration import search_combined, get_memory_stats
    MEMORY_SYSTEM_AVAILABLE = True
except ImportError:
    MEMORY_SYSTEM_AVAILABLE = False
    print("Warning: Memory system not available")

# Configuration
PORT = int(os.environ.get("PORT", 8788))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "nous-hermes2:latest")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text:latest")
DATA_DIR = Path(__file__).parent / "data"
KB_DIR = DATA_DIR / "tenants"
API_KEYS_FILE = DATA_DIR / "api-keys.json"

# Ensure directories exist
os.makedirs(KB_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(Path("/Users/clark/.openclaw/workspace/openclaw-memories"), exist_ok=True)

# Request tracking
SERVER_START_TIME = time.time()
request_stats = {"total_requests": 0, "chat_requests": 0, "search_requests": 0, "upload_requests": 0, "errors": 0}

# Session management - in-memory storage with TTL
chat_sessions = {}  # {session_id: {"messages": [], "last_access": timestamp}}
SESSION_TIMEOUT = 3600  # 1 hour TTL

PERMISSIONS = {
    "admin": ["*"],
    "librarian": ["kb:*", "documents:*", "chat:*"]
}

# ============== Core Functions ==============

def track_request(endpoint_type="generic"):
    request_stats["total_requests"] += 1
    if endpoint_type == "chat":
        request_stats["chat_requests"] += 1
    elif endpoint_type == "search":
        request_stats["search_requests"] += 1
    elif endpoint_type == "upload":
        request_stats["upload_requests"] += 1

def load_api_keys() -> Dict:
    if API_KEYS_FILE.exists():
        with open(API_KEYS_FILE) as f:
            return json.load(f)
    return {"keys": {}, "tenants": {}, "audit_log": []}

def save_api_keys(data: Dict):
    with open(API_KEYS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_key_data(key_id: str) -> Optional[Dict]:
    keys_db = load_api_keys()
    return keys_db.get("keys", {}).get(key_id)

def has_permission(key_data: Dict, permission: str) -> bool:
    role = key_data.get("role", "")
    permissions = key_data.get("permissions", PERMISSIONS.get(role, []))
    if "*" in permissions:
        return True
    return permission in permissions

# ============== Session Management ==============

def get_or_create_session(session_id: str) -> Dict:
    """Get existing session or create new one"""
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            "messages": [],
            "created_at": time.time(),
            "last_access": time.time()
        }
    else:
        chat_sessions[session_id]["last_access"] = time.time()
    return chat_sessions[session_id]

def add_message_to_session(session_id: str, role: str, content: str):
    """Add a message to the session history"""
    session = get_or_create_session(session_id)
    session["messages"].append({
        "role": role,
        "content": content,
        "timestamp": time.time()
    })
    # Keep only last 20 messages to prevent memory bloat
    if len(session["messages"]) > 20:
        session["messages"] = session["messages"][-20:]
    session["last_access"] = time.time()

def get_session_messages(session_id: str) -> List[Dict]:
    """Get messages for a session (or empty list if no session)"""
    if session_id in chat_sessions:
        chat_sessions[session_id]["last_access"] = time.time()
        return chat_sessions[session_id]["messages"]
    return []

def cleanup_expired_sessions():
    """Remove expired sessions"""
    current_time = time.time()
    expired = [sid for sid, data in chat_sessions.items() 
               if current_time - data["last_access"] > SESSION_TIMEOUT]
    for sid in expired:
        del chat_sessions[sid]
    return len(expired)

# ============== Middleware ==============

@web.middleware
async def auth_middleware(request, handler):
    # Public paths that don't require authentication
    public_paths = ["/", "/healthz", "/livez", "/docs", "/docs/", "/openapi.yaml", "/openapi.yml"]
    if request.path in public_paths or request.path.startswith("/docs/"):
        return await handler(request)
    
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return web.json_response({"error": "Unauthorized"}, status=401)
    
    key_id = auth[7:]
    key_data = get_key_data(key_id)
    
    if not key_data:
        return web.json_response({"error": "Invalid key"}, status=401)
    
    if key_data.get("revoked"):
        return web.json_response({"error": "Revoked key"}, status=401)
    
    request["key_data"] = key_data
    request["key_id"] = key_id
    return await handler(request)

def require_auth(permission: str = None):
    def decorator(handler):
        async def wrapper(request):
            key_data = request.get("key_data", {})
            if permission and not has_permission(key_data, permission):
                return web.json_response({"error": "Forbidden"}, status=403)
            return await handler(request)
        return wrapper
    return decorator

# ============== KB Functions ==============

def get_tenant_kb_path(tenant_id: str) -> Path:
    return KB_DIR / f"{tenant_id}.json"

def load_tenant_kb(tenant_id: str) -> List[Dict]:
    kb_path = get_tenant_kb_path(tenant_id)
    if kb_path.exists():
        with open(kb_path) as f:
            return json.load(f)
    return []

def save_tenant_kb(tenant_id: str, kb: List[Dict]):
    kb_path = get_tenant_kb_path(tenant_id)
    kb_path.parent.mkdir(parents=True, exist_ok=True)
    with open(kb_path, 'w') as f:
        json.dump(kb, f, indent=2)

async def get_embedding(text: str) -> List[float]:
    async with ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBEDDING_MODEL, "prompt": text[:8000]},
            timeout=ClientTimeout(total=30)
        ) as resp:
            result = await resp.json()
            return result.get("embedding", [])

def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x ** 2 for x in a) ** 0.5
    norm_b = sum(x ** 2 for x in b) ** 0.5
    return dot_product / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0.0

# ============== User Profile Index Functions ==============

def get_user_index_path(tenant_id: str) -> Path:
    """Get path to user profile index file"""
    return KB_DIR / f"{tenant_id}-users.json"

def load_user_index(tenant_id: str) -> Dict[str, Dict]:
    """Load user profile index as dict keyed by username"""
    index_path = get_user_index_path(tenant_id)
    if index_path.exists():
        with open(index_path) as f:
            return json.load(f)
    return {}

def save_user_index(tenant_id: str, index: Dict[str, Dict]):
    """Save user profile index"""
    index_path = get_user_index_path(tenant_id)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=2)

def classify_document_type(content: str, title: str) -> tuple[str, Optional[Dict]]:
    """
    Classify document type and extract structured data if applicable.
    Returns: (doc_type, structured_data or None)
    """
    import re
    
    content_lower = content.lower()
    
    # Check for user profile pattern (must have Name AND Username fields)
    name_match = re.search(r'^Name:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
    username_match = re.search(r'^Username:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
    
    if name_match and username_match:
        # This is a user profile
        user_name = name_match.group(1).strip()
        username = username_match.group(1).strip()
        
        # Extract all user fields
        emp_match = re.search(r'^Employee #:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        email_match = re.search(r'^Email:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        dept_match = re.search(r'^Department:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        title_match = re.search(r'^Title:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        manager_match = re.search(r'^Manager:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        phone_match = re.search(r'^(?:Phone|Home phone|Mobile phone|Work phone):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        active_match = re.search(r'^Active:\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        location_match = re.search(r'^(?:Location|Building|Site):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
        
        structured_data = {
            "name": user_name,
            "username": username,
            "employee_id": emp_match.group(1).strip() if emp_match else "N/A",
            "email": email_match.group(1).strip() if email_match else "N/A",
            "department": dept_match.group(1).strip() if dept_match else "N/A",
            "title": title_match.group(1).strip() if title_match else "N/A",
            "manager": manager_match.group(1).strip() if manager_match else "N/A",
            "phone": phone_match.group(1).strip() if phone_match else "N/A",
            "active": active_match.group(1).strip() if active_match else "N/A",
            "location": location_match.group(1).strip() if location_match else "N/A",
            "searchable_text": f"{user_name} {username} {emp_match.group(1).strip() if emp_match else ''} {email_match.group(1).strip() if email_match else ''}".lower()
        }
        return "user_profile", structured_data
    
    # Check for knowledge article (KB pattern)
    if re.search(r'KB\d+', title) or "steps:" in content_lower or "troubleshooting" in content_lower:
        return "knowledge_article", None
    
    # Check for location
    if "location" in content_lower or "building" in content_lower or "site" in content_lower:
        return "location", None
    
    # Check for ticket
    if re.search(r'INC\d+|REQ\d+|RITM\d+', title) or "ticket" in content_lower:
        return "ticket", None
    
    return "generic", None

def search_user_index(tenant_id: str, query: str) -> Optional[Dict]:
    """
    Search user profile index for matching user.
    Returns user data dict or None if not found.
    Uses strict matching to ensure correct user is returned.
    """
    import re
    
    index = load_user_index(tenant_id)
    if not index:
        return None
    
    query_lower = query.lower().strip()
    query_words = set(query_lower.split())
    
    best_match = None
    best_score = 0
    
    for username, user_data in index.items():
        name = user_data.get("name", "").lower().strip()
        uname = user_data.get("username", "").lower().strip()
        emp_id = user_data.get("employee_id", "").lower().strip()
        email = user_data.get("email", "").lower().strip()
        
        # Calculate match score
        score = 0
        
        # Exact name match (highest priority)
        if query_lower == name:
            score = 100
        # Name contains query
        elif query_lower in name:
            score = 80
        # Query contains full name (reverse)
        elif name in query_lower:
            score = 70
        # Word-level matching for multi-word names
        else:
            name_words = set(name.split())
            matching_words = query_words & name_words
            if matching_words:
                score = len(matching_words) * 10
        
        # Exact username/ID match (high priority)
        if query_lower == uname or query_lower == emp_id:
            score = max(score, 90)
        
        # Email match
        if query_lower in email or email in query_lower:
            score = max(score, 60)
        
        # Keep track of best match
        if score > best_score:
            best_score = score
            best_match = user_data
    
    # Only return if we have a confident match (score >= 20)
    if best_score >= 20:
        return best_match
    
    return None

def format_user_response(user_data: Dict, source_doc: str = "") -> str:
    """Format user data as bullet-point response"""
    lines = [f"**{user_data['name']}** (Clock ID: {user_data['username']})"]
    lines.append("")
    lines.append(f"• **Title:** {user_data.get('title', 'N/A')}")
    lines.append(f"• **Department:** {user_data.get('department', 'N/A')}")
    lines.append(f"• **Email:** {user_data.get('email', 'N/A')}")
    lines.append(f"• **Employee #:** {user_data.get('employee_id', 'N/A')}")
    
    if user_data.get('manager') and user_data['manager'] != 'N/A':
        lines.append(f"• **Manager:** {user_data['manager']}")
    if user_data.get('phone') and user_data['phone'] != 'N/A':
        lines.append(f"• **Phone:** {user_data['phone']}")
    if user_data.get('location') and user_data['location'] != 'N/A':
        lines.append(f"• **Location:** {user_data['location']}")
    
    active = user_data.get('active', 'N/A')
    if active != 'N/A':
        status = "Active ✅" if str(active).lower() == 'true' else f"Status: {active}"
        lines.append(f"• **Account Status:** {status}")
    
    lines.append("")
    lines.append(f"_Source: Document {source_doc or user_data.get('source_doc', 'N/A')}_")
    
    return "\n".join(lines)

def validate_user_response(user_data: Dict) -> tuple[bool, str]:
    """Validate user data has all required fields"""
    required = ['name', 'username', 'title', 'department', 'email']
    missing = [f for f in required if not user_data.get(f) or user_data.get(f) == 'N/A']
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, "Valid"

async def search_tenant_kb(query: str, tenant_id: str, top_k: int = 3, is_user_query: bool = False) -> List[Dict]:
    kb = load_tenant_kb(tenant_id)
    if not kb:
        return []
    
    query_embedding = await get_embedding(query)
    if not query_embedding:
        return []
    
    results = []
    for doc in kb:
        doc_embedding = doc.get("embedding", [])
        if doc_embedding:
            similarity = cosine_similarity(query_embedding, doc_embedding)
            # For user queries, include documents that mention the user by name even with lower similarity
            if is_user_query:
                content = doc.get('content', '').lower()
                title = doc.get('title', '').lower()
                query_lower = query.lower()
                # Boost score if query terms appear in content
                if query_lower in content or query_lower in title:
                    similarity = max(similarity, 0.8)  # Boost to ensure inclusion
            if similarity > 0.3:
                results.append({**doc, "similarity": similarity})
    
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]

# ============== Endpoints ==============

@require_auth()
async def healthz(request):
    key_data = request.get("key_data", {})
    return web.json_response({
        "status": "ok",
        "service": "atlas-api",
        "version": "2.2.0",
        "role": key_data.get("role", "unknown")
    })

async def livez(request):
    return web.json_response({"status": "alive"})

@require_auth()
async def v1_test(request):
    """Test endpoint for validation and timing across versions"""
    track_request("test")
    try:
        data = await request.json() if request.body_exists else {}
        test_type = data.get("test_type", "ping") if data else "ping"
        
        tenant_id = request["key_data"].get("tenant_id", "default")
        kb = load_tenant_kb(tenant_id)
        
        response = {
            "version": "v03-toby-20260416",
            "test_type": test_type,
            "tenant": tenant_id,
            "kb_stats": {
                "total_documents": len(kb),
                "has_user_index": (Path(__file__).parent / "data" / "tenants" / f"{tenant_id}-users.json").exists()
            },
            "timestamp": time.time()
        }
        
        if test_type == "name_query":
            response["name_query_enabled"] = True
            response["name_query_patterns"] = [
                "what is your name?",
                "what are you called?",
                "who are you?",
                "your name?",
                "what do i call you?"
            ]
        elif test_type == "backups":
            response["backups_count"] = len(list_backups())
        elif test_type == "features":
            response["features"] = [
                "name_query_optimization",
                "natural_persona",
                "streaming_doc_details",
                "user_index",
                "session_management",
                "backup_rollback_api"
            ]
        
        return web.json_response(response)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def v1_list_documents(request):
    """List documents for tenant"""
    try:
        tenant_id = request["key_data"].get("tenant_id", "default")
        kb = load_tenant_kb(tenant_id)
        
        # Parse query params
        limit = int(request.query.get("limit", 10))
        offset = int(request.query.get("offset", 0))
        doc_type = request.query.get("type")
        
        # Filter by type if specified
        if doc_type:
            kb = [d for d in kb if d.get("type") == doc_type]
        
        total = len(kb)
        paginated = kb[offset:offset + limit]
        
        return web.json_response({
            "documents": paginated,
            "total": total,
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def v1_upload_document(request):
    """Upload document with automatic text extraction for multiple formats"""
    track_request("upload")
    try:
        tenant_id = request["key_data"].get("tenant_id", "default")
        
        # Check content type
        content_type = request.headers.get("Content-Type", "")
        
        if "multipart/form-data" in content_type:
            # File upload
            reader = await request.multipart()
            
            file_data = None
            file_name = None
            file_type = None
            metadata = {}
            
            async for part in reader:
                if part.filename:
                    # File field
                    file_name = part.filename
                    file_type = part.headers.get("Content-Type", "application/octet-stream")
                    file_data = await part.read()
                else:
                    # Form field
                    field_name = part.name
                    field_value = await part.text()
                    if field_name == "metadata":
                        try:
                            metadata = json.loads(field_value)
                        except:
                            metadata = {}
                    elif field_name == "title":
                        metadata["title"] = field_value
                    elif field_name == "id":
                        metadata["id"] = field_value
            
            if not file_data:
                return web.json_response({"error": "No file provided"}, status=400)
            
            # Extract text based on file type
            content = await extract_text_from_file(file_data, file_name)
            
        else:
            # JSON upload
            data = await request.json()
            content = data.get("content", "")
            file_name = data.get("filename", "document.txt")
            metadata = data.get("metadata", {})
            file_type = metadata.get("type", "text/plain")
        
        # Generate document ID if not provided
        doc_id = metadata.get("id") or f"doc-{hashlib.sha256(content.encode()).hexdigest()[:16]}"
        
        # Get embedding with retry logic
        embedding = []
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Use shorter content if previous attempt failed
                content_limit = 8000 if attempt == 0 else 4000 if attempt == 1 else 2000
                embedding = await get_embedding(content[:content_limit])
                if embedding and len(embedding) > 0:
                    break
            except Exception as e:
                print(f"Embedding attempt {attempt + 1} failed: {e}")
                continue
        
        if not embedding or len(embedding) == 0:
            return web.json_response({
                "error": "Failed to generate embedding for document. Please try again with a smaller file or contact support."
            }, status=500)
        
        # Classify document type and extract structured data
        doc_type, structured_data = classify_document_type(content, metadata.get("title") or file_name or "")
        
        # Create document
        doc = {
            "id": doc_id,
            "title": metadata.get("title") or file_name or "Untitled Document",
            "content": content,
            "type": file_type,
            "doc_type": doc_type,  # Document classification
            "filename": file_name,
            "metadata": metadata,
            "embedding": embedding,
            "uploaded_at": time.time(),
            "uploaded_by": request["key_data"].get("name", "unknown")
        }
        
        # If user profile, add to user index
        if doc_type == "user_profile" and structured_data:
            user_index = load_user_index(tenant_id)
            username = structured_data.get("username")
            if username:
                user_index[username] = {
                    **structured_data,
                    "source_doc": doc_id,
                    "uploaded_at": time.time()
                }
                save_user_index(tenant_id, user_index)
                print(f"Added user {username} to index for tenant {tenant_id}")
        
        # Save to tenant KB
        kb = load_tenant_kb(tenant_id)
        
        # Check for duplicate by ID
        existing_idx = None
        for i, existing in enumerate(kb):
            if existing.get("id") == doc_id:
                existing_idx = i
                break
        
        if existing_idx is not None:
            kb[existing_idx] = doc
        else:
            kb.append(doc)
        
        save_tenant_kb(tenant_id, kb)
        
        return web.json_response({
            "success": True,
            "document": {
                "id": doc_id,
                "title": doc["title"],
                "filename": file_name,
                "type": file_type,
                "content_length": len(content)
            }
        })
        
    except Exception as e:
        import traceback
        print(f"Upload error: {e}\n{traceback.format_exc()}", file=sys.stderr)
        return web.json_response({"error": str(e)}, status=500)

async def extract_text_from_file(file_data: bytes, filename: str) -> str:
    """Extract text from various file formats"""
    ext = Path(filename).suffix.lower()
    
    # Plain text files
    if ext in ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.py', '.js', '.ts', '.html', '.css', '.yaml', '.yml']:
        try:
            return file_data.decode('utf-8')
        except UnicodeDecodeError:
            return file_data.decode('latin-1')
    
    # PDF files
    elif ext == '.pdf':
        return await extract_pdf_text(file_data)
    
    # Word documents
    elif ext in ['.doc', '.docx']:
        return await extract_word_text(file_data, ext)
    
    # Default: try as text
    else:
        try:
            return file_data.decode('utf-8')
        except:
            return f"[Binary file: {filename}]"

async def extract_pdf_text(file_data: bytes) -> str:
    """Extract text from PDF"""
    try:
        import io
        from PyPDF2 import PdfReader
        
        pdf_file = io.BytesIO(file_data)
        reader = PdfReader(pdf_file)
        
        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
        
        return "\n".join(text_parts)
    except Exception as e:
        print(f"PDF extraction error: {e}", file=sys.stderr)
        return f"[PDF extraction failed: {str(e)}]"

async def extract_word_text(file_data: bytes, ext: str) -> str:
    """Extract text from Word documents"""
    try:
        if ext == '.docx':
            import docx
            from io import BytesIO
            
            doc = docx.Document(BytesIO(file_data))
            paragraphs = [para.text for para in doc.paragraphs]
            return "\n".join(paragraphs)
        else:
            # .doc files - try as plain text
            try:
                return file_data.decode('utf-8')
            except:
                return "[.doc format not supported - please convert to .docx]"
    except Exception as e:
        print(f"Word extraction error: {e}", file=sys.stderr)
        return f"[Word extraction failed: {str(e)}]"

@require_auth()
async def v1_search(request):
    """Search documents"""
    track_request("search")
    try:
        data = await request.json()
        query = data.get("query", "")
        top_k = data.get("top_k", 3)
        
        tenant_id = request["key_data"].get("tenant_id", "default")
        results = await search_tenant_kb(query, tenant_id, top_k)
        
        return web.json_response({
            "query": query,
            "results": results,
            "total": len(results)
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def v1_chat_completions(request):
    track_request("chat")
    try:
        data = await request.json()
        messages = data.get("messages", [])
        user = data.get("user", {})
        session_id = data.get("session_id")  # New: Session ID for isolated conversations
        
        if not messages:
            return web.json_response({"error": "No messages"}, status=400)
        
        # Session handling: If session_id provided, use server-side session history
        # If no session_id, use only the messages provided in the request (stateless)
        if session_id:
            # Add user message to session
            for msg in messages:
                if msg.get("role") == "user":
                    add_message_to_session(session_id, "user", msg.get("content", ""))
            # Get full conversation from session
            session_messages = get_session_messages(session_id)
            # Use session messages + current message for processing
            last = messages[-1]["content"] if messages else ""
            conversation_history = session_messages
        else:
            # Stateless: only use the messages provided in the request
            last = messages[-1]["content"] if messages else ""
            conversation_history = messages
        
        last_lower = last.lower()
        
        tenant_id = request["key_data"].get("tenant_id", "default")
        kb = load_tenant_kb(tenant_id)
        total_docs = len(kb)
        
        # Check if this is a follow-up question about steps/instructions
        # Look at previous messages for context
        is_follow_up = False
        previous_topic = ""
        mentioned_users = []
        mentioned_ids = []
        
        # Extract entities from conversation history (use session history if available)
        conversation_text = " ".join([m.get("content", "") for m in conversation_history[-5:]])  # Last 5 messages
        conversation_lower = conversation_text.lower()
        
        # Detect mentioned users - ONLY from the CURRENT message (last message), not from history
        # This prevents previous users from polluting new queries
        import re
        # Look for capitalized names (First Last) in CURRENT message only
        name_pattern = r'\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b'
        current_message_text = messages[-1].get("content", "") if messages else ""
        potential_names = re.findall(name_pattern, current_message_text)
        mentioned_users = list(set([n for n in potential_names if len(n) > 5]))
        
        # Quick name query detection - respond instantly without document search
        current_message_lower = current_message_text.lower()
        name_query_patterns = [
            r'^what\s+is\s+your\s+name\??$',
            r'^what\s+are\s+you\s+called\??$',
            r'^who\s+are\s+you\??$',
            r'^your\s+name\??$',
            r'^what\s+do\s+i\s+call\s+you\??$'
        ]
        
        is_pure_name_query = any(re.match(pattern, current_message_lower.strip()) for pattern in name_query_patterns)
        has_combined_query = ' and ' in current_message_lower or ' also ' in current_message_lower
        
        if is_pure_name_query and not has_combined_query:
            response_text = "I'm Toby! What are we working on today?"
            if session_id:
                add_message_to_session(session_id, "assistant", response_text)
            return web.json_response({
                "choices": [{"message": {"role": "assistant", "content": response_text}}],
                "model": MODEL,
                "response_type": "name_query"
            })
        
        # Detect mentioned IDs (numeric IDs like 91513, 41110, 66381) - also from current message only
        id_pattern = r'\b(\d{5,6})\b'
        mentioned_ids = list(set(re.findall(id_pattern, current_message_text)))
        
        # Detect topics
        if len(messages) >= 2:
            prev = messages[-2].get("content", "").lower()
            for topic in ["fhir", "cbct", "sota", "camera", "sensor", "vistadent", "oscar solis", "jonathan nguyen"]:
                if topic in prev:
                    previous_topic = topic
                    break
        
        # Detect step/troubleshooting follow-ups
        step_keywords = ["steps", "how to", "show me", "what are", "troubleshoot", "fix", "resolve"]
        is_step_request = any(k in last_lower for k in step_keywords)
        
        # Detect user follow-ups
        user_followup_keywords = ["this user", "that user", "more about", "tell me more", "who is", "about them"]
        is_user_followup = any(k in last_lower for k in user_followup_keywords)
        
        # If follow-up about user, enhance query with extracted entities
        if is_user_followup and mentioned_users:
            last = f"{last} - specifically about {' and '.join(mentioned_users)}"
            is_follow_up = True
        elif is_user_followup and mentioned_ids:
            last = f"{last} - specifically about ID {' and '.join(mentioned_ids)}"
            is_follow_up = True
        elif is_step_request and previous_topic and previous_topic not in last_lower:
            last = f"{last} for {previous_topic}"
            is_follow_up = True
            is_follow_up = True
        
        # Query detection
        all_keywords = ["what articles", "list all", "all articles", "all documents", "total articles", "how many"]
        is_all = any(k in last_lower for k in all_keywords)
        
        # User query detection - MUST have explicit user intent
        # Only trigger user search if:
        # 1. Query contains "who is" or similar user-specific phrases
        # 2. OR query mentions a specific person by name (capitalized First Last pattern)
        # 3. OR query contains a specific employee ID (5-6 digits)
        # 4. AND NOT a troubleshooting/step query
        
        explicit_user_phrases = ["who is", "tell me about", "information about", "details for", "profile for", "employee", "person"]
        has_explicit_intent = any(k in last_lower for k in explicit_user_phrases)
        
        # Step/troubleshooting queries should NEVER be treated as user queries
        step_keywords = ["steps", "how to", "troubleshoot", "fix", "resolve", "guide", "error", "issue", "problem"]
        is_step_query = any(k in last_lower for k in step_keywords)
        
        # Only detect user query if:
        # - Has explicit user intent OR has mentioned names/IDs
        # - AND is NOT a step/troubleshooting query
        is_user_query = (has_explicit_intent or mentioned_users or mentioned_ids) and not is_step_query
        
        # If it's a step query about a user (e.g., "how do I fix Oscar's account"), 
        # still extract the user for context but don't return user profile
        if is_step_query and mentioned_users:
            print(f"DEBUG: Step query with user mention: {mentioned_users}")
            is_user_query = False
        
        # FIRST: Check user index for fast lookup (only if it's actually a user query)
        if is_user_query and (mentioned_users or mentioned_ids or has_explicit_intent):
            # Use specific search terms, not the whole query
            search_query = " ".join(mentioned_users) if mentioned_users else (mentioned_ids[0] if mentioned_ids else last)
            user_data = search_user_index(tenant_id, search_query)
            
            if user_data:
                # Found in user index - return immediately with bullet format
                response_text = format_user_response(user_data, user_data.get('source_doc', 'N/A'))
                is_valid, error_msg, _ = validate_user_response(response_text, user_data.get('source_doc', ''))
                
                if is_valid:
                    return web.json_response({
                        "choices": [{"message": {"role": "assistant", "content": response_text}}],
                        "model": MODEL,
                        "validation": "passed"
                    })
                else:
                    # Still return but note validation issue
                    return web.json_response({
                        "choices": [{"message": {"role": "assistant", "content": response_text}}],
                        "model": MODEL,
                        "validation": "failed",
                        "validation_error": error_msg
                    })
        
        filtered_keywords = ["about", "relating to", "regarding", "for", "sota", "cbct", "workflow", "fhir"]
        is_filtered = any(k in last_lower for k in filtered_keywords) and not is_all
        
        if is_all:
            docs = kb
            context_mode = "all"
        elif is_user_query:
            # For user queries not in index, search more documents
            search_terms = []
            if mentioned_users:
                search_terms.extend(mentioned_users)
            if mentioned_ids:
                search_terms.extend(mentioned_ids)
            if not search_terms:
                words = [w for w in last.split() if len(w) > 3 and w.lower() not in ['who', 'what', 'tell', 'about', 'this', 'user']]
                search_terms = words[:3]
            search_query = " ".join(search_terms) if search_terms else last
            docs = await search_tenant_kb(search_query, tenant_id, top_k=50, is_user_query=True)  # Increased to 50
            context_mode = "user_search"
        elif is_filtered or is_follow_up:
            docs = await search_tenant_kb(last, tenant_id, top_k=20)
            context_mode = "filtered"
        else:
            docs = await search_tenant_kb(last, tenant_id, top_k=3)
            context_mode = "search"
        
        # For user queries, try to extract user info directly from documents
        user_info = None
        print(f"DEBUG: is_user_query={is_user_query}, docs found={len(docs)}")
        if is_user_query:
            for doc in docs[:20]:
                content = doc.get('content', '')
                title = doc.get('title', '')
                # Check if this is a user document - must have Username field and Name field
                # AND the title should contain "Users" or the content should have ServiceNow user format
                if ('Users' in title or '[Saved ServiceNow users]' in content):
                    # Try to extract user info
                    import re
                    name_match = re.search(r'^Name:\s*([^\n]+)', content, re.MULTILINE)
                    username_match = re.search(r'^Username:\s*([^\n]+)', content, re.MULTILINE)
                    
                    # Only proceed if we have BOTH name AND username (this ensures it's a user doc, not just any doc with "Name:" in it)
                    if name_match and username_match:
                        user_name = name_match.group(1).strip()
                        username_val = username_match.group(1).strip()
                        
                        # Check if this matches the query - name should be in mentioned_users OR query text
                        query_matches = any(u.lower() in user_name.lower() or user_name.lower() in u.lower() for u in mentioned_users)
                        content_matches = any(term in content.lower() for term in last_lower.split() if len(term) > 2)
                        
                        if query_matches or (not mentioned_users and content_matches):
                            username_match = re.search(r'Username:\s*([^\n]+)', content)
                            emp_match = re.search(r'^Employee #:\s*([^\n]+)', content, re.MULTILINE)
                            email_match = re.search(r'^Email:\s*([^\n]+)', content, re.MULTILINE)
                            dept_match = re.search(r'^Department:\s*([^\n]+)', content, re.MULTILINE)
                            title_match = re.search(r'^Title:\s*([^\n]+)', content, re.MULTILINE)
                            
                            manager_match = re.search(r'^Manager:\s*([^\n]+)', content, re.MULTILINE)
                            phone_match = re.search(r'^(?:Phone|Home phone|Mobile phone|Work phone):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
                            active_match = re.search(r'^Active:\s*([^\n]+)', content, re.MULTILINE)
                            location_match = re.search(r'^(?:Location|Building|Site):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
                            
                            user_info = {
                                'name': user_name,
                                'username': username_val,
                                'employee_id': emp_match.group(1).strip() if emp_match else 'N/A',
                                'email': email_match.group(1).strip() if email_match else 'N/A',
                                'department': dept_match.group(1).strip() if dept_match else 'N/A',
                                'title': title_match.group(1).strip() if title_match else 'N/A',
                                'manager': manager_match.group(1).strip() if manager_match else 'N/A',
                                'phone': phone_match.group(1).strip() if phone_match else 'N/A',
                                'active': active_match.group(1).strip() if active_match else 'N/A',
                                'location': location_match.group(1).strip() if location_match else 'N/A',
                                'source_doc': doc.get('id', 'N/A')
                            }
                            break
        
        # If we found structured user data, inject it into the prompt
        user_data_section = ""
        if user_info:
            user_data_section = f"""

FOUND USER DATA (use this directly):
**{user_info['name']}** (ID: {user_info['username']}) - {user_info['title']}, {user_info['department']}
Email: {user_info['email']}
Employee #: {user_info['employee_id']}
Source: {user_info['source_doc']}"""
        else:
            # v3: Check for ambiguous matches that might need clarification
            if is_user_query and len(mentioned_users) > 1:
                # Multiple potential matches - ask for clarification
                possible_matches = []
                for doc in docs[:5]:
                    content = doc.get('content', '')
                    # Extract names from user documents
                    name_match = re.search(r'^Name:\s*(.+)$', content, re.MULTILINE)
                    if name_match:
                        possible_matches.append(name_match.group(1).strip())
                
                if len(possible_matches) > 1:
                    clarification_msg = "I found multiple people that might match. Did you mean:\n\n"
                    for i, name in enumerate(possible_matches[:3], 1):
                        clarification_msg += f"{i}. {name}\n"
                    clarification_msg += "\nPlease tell me which one you're asking about."
                    
                    return web.json_response({
                        "choices": [{"message": {"role": "assistant", "content": clarification_msg}}],
                        "model": MODEL,
                        "clarification_required": True
                    })
        context = []
        # For user queries, include ALL documents that might contain user info
        if is_user_query:
            for doc in docs[:20]:  # Include more documents for user queries
                content = doc.get('content', '')
                # For user docs, include full content
                if len(content) > 3000:
                    content = content[:3000] + "..."
                context.append(f"Document: {doc.get('title', 'Untitled')}\nID: {doc.get('id', 'N/A')}\n{content}")
        else:
            for doc in docs[:15]:  # Limit to top 15 most relevant
                content = doc.get('content', '')
                # Truncate very long docs but keep enough for steps
                if len(content) > 2000:
                    content = content[:2000] + "..."
                context.append(f"Document: {doc.get('title', 'Untitled')}\nID: {doc.get('id', 'N/A')}\n{content}")
        
        context_str = "\n\n---\n\n".join(context) if context else "No relevant documents."
        
        # Get personality
        keys_db = load_api_keys()
        tenant = keys_db.get("tenants", {}).get(tenant_id, {})
        personality = tenant.get("ai_personality", {})
        ai_name = personality.get("name", "Toby")
        # Updated V2: Natural, conversational persona - no "helpful AI assistant" language
        ai_persona = personality.get("persona", "You're Toby. Keep it natural and conversational. Don't over-introduce yourself.")
        temperature = personality.get("temperature", 0.7)
        max_tokens = personality.get("max_tokens", 2048)
        
        # Updated V2: NEVER say "I am Toby, a helpful AI assistant" or similar AI language
        ai_persona += "\n\nCRITICAL RULE: NEVER say 'I am Toby, a helpful AI assistant' or use similar AI-sounding language. Just answer naturally like a person would."
        
        # v3: Memory system instructions
        if MEMORY_SYSTEM_AVAILABLE:
            ai_persona += "\n\nMEMORY SYSTEM (v3): You have instant access to 117 memories. Use search_combined() for all lookups. Personal: 12 entries. Knowledge: 105 entries. Query time: <2ms. Check memory BEFORE generating responses."
        
        # Adjust persona based on query type
        if context_mode == "all":
            ai_persona += f"\n\nCRITICAL: The user wants ALL documents. You have {total_docs} total. List them ALL with exact count."
        elif context_mode == "filtered":
            ai_persona += f"\n\nCRITICAL: User asked about '{last}'. You found {len(docs)} documents. State the EXACT count accurately."
        
        # Note: Step instructions are added inline in the prompt for better positioning
        
        # Special instruction for user/people queries
        if is_user_query or mentioned_users or mentioned_ids:
            ai_persona += """\n\nCRITICAL - USER/PEOPLE QUERY INSTRUCTIONS:
You are being asked about a specific person/user. The Context contains multiple documents. Your task:
1. SCAN ALL documents in Context for ANY mention of the requested user (look for their name, ID, email)
2. If you find user information in ANY document, use it to answer
3. Format user info clearly: **Name** (ID: xxx) - Title/Role, Department, Location. Email: xxx
4. If multiple documents mention the same user, combine the information
5. DO NOT say "not found" if the user data exists in Context - it's there, find it!
6. If asked "who is [name]?" or "tell me about [name]", give a complete profile from available data"""
        
        step_instruction = "CRITICAL: The user wants STEPS. ONLY use information from the Context above. DO NOT use your training knowledge. First, check the DOCUMENT TITLES. Select the document with the most relevant title. Then look for a 'Steps:' section in that document. Copy the numbered steps EXACTLY as they appear in the Context. Do NOT summarize, rewrite, or invent steps."
        
        # Try to extract steps programmatically for step queries
        extracted_steps = None
        if is_step_request:
            import re
            print(f"DEBUG: Step extraction - query: {last[:50]}")
            # First, look for documents with query keywords in the title OR content
            query_words = [w.lower() for w in last.split() if len(w) > 3 and w.lower() not in ['troubleshoot', 'steps', 'provide']]
            print(f"DEBUG: Query words: {query_words}")
            
            # Score all docs by keyword matches and select best match with steps
            best_doc = None
            best_score = 0
            for i, doc in enumerate(docs[:15]):
                title = doc.get('title', '').lower()
                content = doc.get('content', '').lower()
                # Count keyword matches in title (weighted higher) and content
                title_matches = sum(1 for kw in query_words if kw in title)
                content_matches = sum(1 for kw in query_words if kw in content[:500])
                score = title_matches * 3 + content_matches  # Title matches weighted 3x
                has_steps = bool(re.search(r'Steps:?(.*?)(?=\n\n|\Z)', doc.get('content', ''), re.DOTALL | re.IGNORECASE))
                print(f"DEBUG: Doc {i}: {title[:30]}... score={score}, has_steps={has_steps}")
                if has_steps and score > best_score:
                    best_score = score
                    best_doc = doc
            
            if best_doc and best_score > 0:
                steps_match = re.search(r'Steps:?(.*?)(?=\n\n|\Z)', best_doc.get('content', ''), re.DOTALL | re.IGNORECASE)
                if steps_match:
                    steps_text = steps_match.group(1).strip()
                    doc_id_match = re.search(r'KB\d+', best_doc.get('title', ''))
                    doc_id = doc_id_match.group(0) if doc_id_match else best_doc.get('id', 'N/A')[:12]
                    extracted_steps = {
                        'title': best_doc.get('title', ''),
                        'doc_id': doc_id,
                        'steps': steps_text
                    }
                    print(f"DEBUG: Selected doc with score {best_score}: {doc_id}")
            
            # If no keyword match found, fall back to first doc with steps
            if not extracted_steps:
                for doc in docs[:10]:
                    steps_match = re.search(r'Steps:?(.*?)(?=\n\n|\Z)', doc.get('content', ''), re.DOTALL | re.IGNORECASE)
                    if steps_match:
                        steps_text = steps_match.group(1).strip()
                        doc_id_match = re.search(r'KB\d+', doc.get('title', ''))
                        doc_id = doc_id_match.group(0) if doc_id_match else doc.get('id', 'N/A')[:12]
                        extracted_steps = {
                            'title': doc.get('title', ''),
                            'doc_id': doc_id,
                            'steps': steps_text
                        }
                        break
        
        full_prompt = f"""{ai_persona}

Context:
{context_str}

{user_data_section}

User: {last}

{step_instruction if is_step_request else ''}

Response:"""
        
        # If we extracted steps programmatically, return them directly with BOLD formatting
        if extracted_steps:
            steps_raw = extracted_steps['steps']
            # Make step numbers bold: "1. " -> "**1.** "
            import re
            steps_bold = re.sub(r'^(\d+)\.\s*', r'**\1.** ', steps_raw, flags=re.MULTILINE)
            response_text = f"According to {extracted_steps['doc_id']}, here are the troubleshooting steps:\n\n{steps_bold}"
            # Store assistant response in session if using sessions
            if session_id:
                add_message_to_session(session_id, "assistant", response_text)
            return web.json_response({
                "choices": [{"message": {"role": "assistant", "content": response_text}}],
                "model": MODEL
            })
        
        # If we found structured user data, format it nicely with bullet points
        if user_info:
            # Build formatted response with bullet points
            lines = [f"**{user_info['name']}** (Clock ID: {user_info['username']})"]
            lines.append("")
            lines.append(f"• **Title:** {user_info['title']}")
            lines.append(f"• **Department:** {user_info['department']}")
            lines.append(f"• **Email:** {user_info['email']}")
            lines.append(f"• **Employee #:** {user_info['employee_id']}")
            if user_info['manager'] != 'N/A':
                lines.append(f"• **Manager:** {user_info['manager']}")
            if user_info['phone'] != 'N/A':
                lines.append(f"• **Phone:** {user_info['phone']}")
            if user_info['location'] != 'N/A':
                lines.append(f"• **Location:** {user_info['location']}")
            if user_info['active'] != 'N/A':
                status = "Active ✅" if user_info['active'].lower() == 'true' else f"Status: {user_info['active']}"
                lines.append(f"• **Account Status:** {status}")
            lines.append("")
            lines.append(f"_Source: Document {user_info['source_doc']}_")
            
            response_text = "\n".join(lines)
            print(f"DEBUG: Returning early with user_info format")
            # Store assistant response in session if using sessions
            if session_id:
                add_message_to_session(session_id, "assistant", response_text)
            return web.json_response({
                "choices": [{"message": {"role": "assistant", "content": response_text}}],
                "model": MODEL
            })
        
        async with ClientSession() as session:
            async with session.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": MODEL, "prompt": full_prompt, "stream": False, 
                      "options": {"temperature": temperature, "num_predict": max_tokens}},
                timeout=ClientTimeout(total=60)
            ) as resp:
                result = await resp.json()
                response_text = result.get("response", "")
        
        # Store assistant response in session if using sessions
        if session_id:
            add_message_to_session(session_id, "assistant", response_text)
        
        return web.json_response({
            "choices": [{"message": {"role": "assistant", "content": response_text}}],
            "model": MODEL
        })
    
    except Exception as e:
        request_stats["errors"] += 1
        return web.json_response({"error": str(e)}, status=500)

# ============== Validation Functions ==============

def validate_user_response(response: str, source_doc: str) -> tuple[bool, str, dict]:
    """
    Validate user query response format.
    Returns: (is_valid, error_message, extracted_data)
    """
    errors = []
    extracted = {}
    
    # Check for bold headers (**text**)
    if '**' not in response:
        errors.append("Missing bold headers (**)")
    
    # Check for bullet points (• or -)
    if '•' not in response and not any(line.strip().startswith('- ') for line in response.split('\n')):
        errors.append("Missing bullet points (•)")
    
    # Check for specific fields in the content
    required_fields = ['Title:', 'Department:', 'Email:', 'Employee']
    missing_fields = []
    for field in required_fields:
        if field not in response:
            missing_fields.append(field)
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")
    
    # Check for document source citation
    if 'Source:' not in response and '_Source:' not in response and 'Document' not in response:
        errors.append("Missing document source citation")
    
    # Try to extract structured data
    import re
    name_match = re.search(r'\*\*([^*]+)\*\*', response)
    if name_match:
        extracted['name'] = name_match.group(1).strip()
    
    title_match = re.search(r'[•\-]\s*\*\*Title:\*\*\s*([^\n]+)', response)
    if title_match:
        extracted['title'] = title_match.group(1).strip()
    
    dept_match = re.search(r'[•\-]\s*\*\*Department:\*\*\s*([^\n]+)', response)
    if dept_match:
        extracted['department'] = dept_match.group(1).strip()
    
    email_match = re.search(r'[•\-]\s*\*\*Email:\*\*\s*([^\n]+)', response)
    if email_match:
        extracted['email'] = email_match.group(1).strip()
    
    emp_match = re.search(r'[•\-]\s*\*\*Employee #:\*\*\s*([^\n]+)', response)
    if emp_match:
        extracted['employee_id'] = emp_match.group(1).strip()
    
    return len(errors) == 0, "; ".join(errors) if errors else "", extracted

def validate_step_response(response: str, expected_doc_id: str = None) -> tuple[bool, str, dict]:
    """
    Validate step query response format.
    Returns: (is_valid, error_message, extracted_data)
    """
    errors = []
    extracted = {'steps': [], 'doc_id': None}
    
    # Check for numbered steps (1., 2., etc.)
    import re
    numbered_steps = re.findall(r'(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\Z)', response, re.DOTALL)
    if not numbered_steps:
        # Try alternative patterns like "Step 1:" or "1)"
        alt_steps = re.findall(r'(?:^|\n)\s*(?:Step\s*)?(\d+)[).:]\s+(.+?)(?=\n(?:Step\s*)?\d+[).:]|\Z)', response, re.DOTALL)
        if alt_steps:
            numbered_steps = alt_steps
    
    if not numbered_steps:
        errors.append("Missing numbered steps (expected format: 1., 2., etc.)")
    else:
        extracted['steps'] = [s[1].strip() for s in numbered_steps]
    
    # Check for document citation
    doc_id_match = re.search(r'(?:according to|from|source:)\s*([A-Z]+\d+)', response, re.IGNORECASE)
    if doc_id_match:
        extracted['doc_id'] = doc_id_match.group(1)
    elif expected_doc_id and expected_doc_id not in response:
        errors.append(f"Missing or incorrect document citation (expected: {expected_doc_id})")
    
    # Check that steps don't appear fabricated (should mention actual document)
    if 'according to' not in response.lower() and 'from document' not in response.lower():
        errors.append("Response should cite the document source")
    
    return len(errors) == 0, "; ".join(errors) if errors else "", extracted

def extract_user_from_raw_content(content: str, query_name: str = None, query_id: str = None) -> Optional[dict]:
    """
    Parse raw document content to extract user information.
    Fallback when structured extraction fails.
    """
    import re
    
    # Look for Name field
    name_match = re.search(r'^Name:\s*([^\n]+)', content, re.MULTILINE)
    username_match = re.search(r'^Username:\s*([^\n]+)', content, re.MULTILINE)
    
    if not name_match or not username_match:
        return None
    
    user_name = name_match.group(1).strip()
    username_val = username_match.group(1).strip()
    
    # If query provided, verify this is the right user
    if query_name and query_name.lower() not in user_name.lower():
        return None
    if query_id and query_id != username_val:
        return None
    
    emp_match = re.search(r'^Employee #:\s*([^\n]+)', content, re.MULTILINE)
    email_match = re.search(r'^Email:\s*([^\n]+)', content, re.MULTILINE)
    dept_match = re.search(r'^Department:\s*([^\n]+)', content, re.MULTILINE)
    title_match = re.search(r'^Title:\s*([^\n]+)', content, re.MULTILINE)
    manager_match = re.search(r'^Manager:\s*([^\n]+)', content, re.MULTILINE)
    phone_match = re.search(r'^(?:Phone|Home phone|Mobile phone|Work phone):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
    active_match = re.search(r'^Active:\s*([^\n]+)', content, re.MULTILINE)
    location_match = re.search(r'^(?:Location|Building|Site):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
    
    return {
        'name': user_name,
        'username': username_val,
        'employee_id': emp_match.group(1).strip() if emp_match else 'N/A',
        'email': email_match.group(1).strip() if email_match else 'N/A',
        'department': dept_match.group(1).strip() if dept_match else 'N/A',
        'title': title_match.group(1).strip() if title_match else 'N/A',
        'manager': manager_match.group(1).strip() if manager_match else 'N/A',
        'phone': phone_match.group(1).strip() if phone_match else 'N/A',
        'active': active_match.group(1).strip() if active_match else 'N/A',
        'location': location_match.group(1).strip() if location_match else 'N/A'
    }

def extract_steps_from_document(content: str, doc_title: str) -> Optional[dict]:
    """
    Extract numbered steps from document content.
    Returns steps with document reference.
    """
    import re
    
    # Look for Steps: section
    steps_match = re.search(r'Steps:?(.*?)(?=\n\n|\Z)', content, re.DOTALL | re.IGNORECASE)
    if steps_match:
        steps_text = steps_match.group(1).strip()
        # Extract doc ID from title
        doc_id_match = re.search(r'KB\d+', doc_title)
        doc_id = doc_id_match.group(0) if doc_id_match else 'Unknown'
        
        # Verify steps are numbered
        numbered_steps = re.findall(r'(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\Z)', steps_text, re.DOTALL)
        if numbered_steps:
            return {
                'doc_id': doc_id,
                'doc_title': doc_title,
                'steps': steps_text,
                'step_count': len(numbered_steps)
            }
    
    # Try alternative: look for numbered list anywhere
    numbered_lines = re.findall(r'(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\Z)', content, re.DOTALL)
    if len(numbered_lines) >= 3:  # At least 3 steps
        doc_id_match = re.search(r'KB\d+', doc_title)
        doc_id = doc_id_match.group(0) if doc_id_match else 'Unknown'
        steps_text = '\n'.join([f"{i+1}. {s[1].strip()}" for i, s in enumerate(numbered_lines)])
        return {
            'doc_id': doc_id,
            'doc_title': doc_title,
            'steps': steps_text,
            'step_count': len(numbered_lines)
        }
    
    return None

def format_user_response(user_info: dict, source_doc: str) -> str:
    """
    Format user information into proper response format.
    """
    lines = [f"**{user_info['name']}** (Clock ID: {user_info['username']})"]
    lines.append("")
    lines.append(f"• **Title:** {user_info['title']}")
    lines.append(f"• **Department:** {user_info['department']}")
    lines.append(f"• **Email:** {user_info['email']}")
    lines.append(f"• **Employee #:** {user_info['employee_id']}")
    
    if user_info.get('manager') and user_info['manager'] != 'N/A':
        lines.append(f"• **Manager:** {user_info['manager']}")
    if user_info.get('phone') and user_info['phone'] != 'N/A':
        lines.append(f"• **Phone:** {user_info['phone']}")
    if user_info.get('location') and user_info['location'] != 'N/A':
        lines.append(f"• **Location:** {user_info['location']}")
    if user_info.get('active') and user_info['active'] != 'N/A':
        status = "Active ✅" if user_info['active'].lower() == 'true' else f"Status: {user_info['active']}"
        lines.append(f"• **Account Status:** {status}")
    
    lines.append("")
    lines.append(f"_Source: Document {source_doc}_")
    
    return "\n".join(lines)

def format_step_response(steps_data: dict) -> str:
    """
    Format steps into proper response format with document citation.
    """
    lines = [f"According to {steps_data['doc_id']}, the troubleshooting steps are:"]
    lines.append("")
    lines.append(steps_data['steps'])
    lines.append("")
    lines.append(f"_Source: {steps_data['doc_title']}_")
    
    return "\n".join(lines)


@require_auth()
async def v1_chat_stream(request):
    """Streaming chat with SSE - includes output validation"""
    try:
        data = await request.json()
        messages = data.get("messages", [])
        user = data.get("user", {})
        session_id = data.get("session_id")  # New: Session ID for isolated conversations
        
        if not messages:
            return web.json_response({"error": "No messages"}, status=400)
        
        last = messages[-1]["content"] if messages else ""
        tenant_id = request["key_data"].get("tenant_id", "default")
        
        # Session handling: If session_id provided, use server-side session history
        if session_id:
            # Add user message to session
            for msg in messages:
                if msg.get("role") == "user":
                    add_message_to_session(session_id, "user", msg.get("content", ""))
            # Get full conversation from session
            session_messages = get_session_messages(session_id)
            # Use session messages + current message for processing
            conversation_history = session_messages
        else:
            # Stateless: only use the messages provided in the request
            conversation_history = messages
        
        async def generate_stream():
            import re  # Import here for async generator
            yield json.dumps({"status": "thinking", "message": "Analyzing..."})
            yield json.dumps({"status": "searching", "message": "Searching..."})
            
            # Look at previous messages for context (use session history if available)
            conversation_text = " ".join([m.get("content", "") for m in conversation_history[-5:]])
            conversation_lower = conversation_text.lower()
            last_lower = last.lower()
            
            # Detect mentioned users - ONLY from CURRENT message, not from history
            name_pattern = r'\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b'
            current_message_text = messages[-1].get("content", "") if messages else ""
            potential_names = re.findall(name_pattern, current_message_text)
            mentioned_users = list(set([n for n in potential_names if len(n) > 5]))
            
            # Detect mentioned IDs - also from current message only
            id_pattern = r'\b(\d{5,6})\b'
            mentioned_ids = list(set(re.findall(id_pattern, current_message_text)))
            
            # User query detection - MUST have explicit user intent
            explicit_user_phrases = ["who is", "tell me about", "information about", "details for", "profile for", "employee", "person"]
            has_explicit_intent = any(k in last_lower for k in explicit_user_phrases)
            
            # Step/troubleshooting queries should NEVER be treated as user queries
            step_keywords = ["steps", "how to", "troubleshoot", "fix", "resolve", "guide", "error", "issue", "problem"]
            is_step_query = any(k in last_lower for k in step_keywords)
            
            # Only detect user query if:
            # - Has explicit user intent OR has mentioned names/IDs
            # - AND is NOT a step/troubleshooting query
            has_user_intent = (has_explicit_intent or mentioned_users or mentioned_ids) and not is_step_query
            
            is_user_query = False
            user_info = None
            
            if has_user_intent and (mentioned_users or mentioned_ids or has_explicit_intent):
                # FIRST: Try the user index for fast, reliable lookup
                search_query = " ".join(mentioned_users) if mentioned_users else (mentioned_ids[0] if mentioned_ids else last)
                user_data = search_user_index(tenant_id, search_query)
                
                if user_data:
                    # Found in user index - use directly
                    is_user_query = True
                    response_text = format_user_response(user_data, user_data.get('source_doc', 'N/A'))
                    yield json.dumps({"status": "validating", "message": "Validating user data..."})
                    
                    # Validate the response
                    is_valid, error_msg, extracted = validate_user_response(response_text, user_data.get('source_doc', ''))
                    if is_valid:
                        yield json.dumps({"status": "complete", "response": response_text, "done": True, "validation": "passed"})
                    else:
                        yield json.dumps({"status": "validation_failed", "error": error_msg, "response": response_text, "done": True})
                    return
                
                # SECOND: Fallback to semantic search if not in index
                if mentioned_users:
                    search_terms = mentioned_users
                elif mentioned_ids:
                    search_terms = mentioned_ids
                else:
                    words = [w for w in last.split() if len(w) > 3 and w.lower() not in ['who', 'what', 'tell', 'about', 'this', 'user', 'the', 'and']]
                    search_terms = words[:3]
                
                search_query = " ".join(search_terms) if search_terms else last
                docs = await search_tenant_kb(search_query, tenant_id, top_k=50, is_user_query=True)  # Increased to 50
                
                # THIRD: Search ALL documents in KB if semantic search didn't find it
                if not docs:
                    kb = load_tenant_kb(tenant_id)
                    docs = kb  # Search all documents
                
                # Try to find matching user in documents
                for doc in docs:
                    content = doc.get('content', '')
                    title = doc.get('title', '')
                    
                    # Check if this is a user document
                    if ('Users' in title or '[Saved ServiceNow users]' in content or doc.get('doc_type') == 'user_profile'):
                        name_match = re.search(r'^Name:\s*([^\n]+)', content, re.MULTILINE)
                        username_match = re.search(r'^Username:\s*([^\n]+)', content, re.MULTILINE)
                        
                        if name_match and username_match:
                            user_name = name_match.group(1).strip()
                            username_val = username_match.group(1).strip()
                            
                            # Check if this matches the query
                            query_matches = any(u.lower() in user_name.lower() or user_name.lower() in u.lower() for u in mentioned_users)
                            id_matches = any(i == username_val for i in mentioned_ids)
                            search_matches = any(s.lower() in user_name.lower() or user_name.lower() in s.lower() for s in search_terms)
                            
                            if query_matches or id_matches or search_matches:
                                is_user_query = True
                                
                                # Extract all fields
                                emp_match = re.search(r'^Employee #:\s*([^\n]+)', content, re.MULTILINE)
                                email_match = re.search(r'^Email:\s*([^\n]+)', content, re.MULTILINE)
                                dept_match = re.search(r'^Department:\s*([^\n]+)', content, re.MULTILINE)
                                title_match = re.search(r'^Title:\s*([^\n]+)', content, re.MULTILINE)
                                manager_match = re.search(r'^Manager:\s*([^\n]+)', content, re.MULTILINE)
                                phone_match = re.search(r'^(?:Phone|Home phone|Mobile phone|Work phone):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
                                active_match = re.search(r'^Active:\s*([^\n]+)', content, re.MULTILINE)
                                location_match = re.search(r'^(?:Location|Building|Site):\s*([^\n]+)', content, re.MULTILINE | re.IGNORECASE)
                                
                                user_data = {
                                    'name': user_name,
                                    'username': username_val,
                                    'employee_id': emp_match.group(1).strip() if emp_match else 'N/A',
                                    'email': email_match.group(1).strip() if email_match else 'N/A',
                                    'department': dept_match.group(1).strip() if dept_match else 'N/A',
                                    'title': title_match.group(1).strip() if title_match else 'N/A',
                                    'manager': manager_match.group(1).strip() if manager_match else 'N/A',
                                    'phone': phone_match.group(1).strip() if phone_match else 'N/A',
                                    'active': active_match.group(1).strip() if active_match else 'N/A',
                                    'location': location_match.group(1).strip() if location_match else 'N/A',
                                    'source_doc': doc.get('id', 'N/A')
                                }
                                
                                # Format response
                                response_text = format_user_response(user_data, doc.get('id', 'N/A'))
                                
                                # Validate
                                yield json.dumps({"status": "validating", "message": "Validating user data..."})
                                is_valid, error_msg, extracted = validate_user_response(response_text, doc.get('id', ''))
                                
                                if is_valid:
                                    yield json.dumps({"status": "complete", "response": response_text, "done": True, "validation": "passed"})
                                else:
                                    yield json.dumps({"status": "complete", "response": response_text, "done": True, "validation": "failed", "error": error_msg})
                                return
            else:
                # Regular search for non-user queries
                docs = await search_tenant_kb(last, tenant_id, top_k=5)
            
            yield json.dumps({
                "status": "search_complete",
                "documents_found": len(docs),
                "documents_searched": [
                    {
                        "id": doc.get('id', 'unknown'),
                        "title": doc.get('title', 'Untitled'),
                        "type": doc.get('doc_type', 'document')
                    } for doc in docs[:10]  # Show first 10
                ]
            })
            
            # If user not found and this was a user query, inform clearly
            if has_user_intent and not is_user_query:
                yield json.dumps({"status": "complete", "response": "I don't have any user profile information matching your query. Please check the name or employee ID and try again.", "done": True})
                return
            
            # Otherwise, build context for AI generation
            context = []
            
            # Check if this is a step/troubleshooting query
            step_keywords = ["steps", "how to", "troubleshoot", "fix", "resolve", "guide"]
            is_step_query = any(k in last_lower for k in step_keywords)
            
            for doc in docs:
                # Include more content for step queries
                content_limit = 2000 if is_step_query else 500
                context.append(f"Document: {doc.get('title', 'Untitled')}\n{doc.get('content', '')[:content_limit]}")
            context_str = "\n\n---\n\n".join(context) if context else "No documents."
            
            # Get personality
            keys_db = load_api_keys()
            tenant = keys_db.get("tenants", {}).get(tenant_id, {})
            personality = tenant.get("ai_personality", {})
            ai_name = personality.get("name", "Toby")
            # Updated V2: Natural, conversational persona
            ai_persona = personality.get("persona", "You're Toby. Keep it natural and conversational. Don't over-introduce yourself.")
            ai_persona += "\n\nCRITICAL RULE: NEVER say 'I am Toby, a helpful AI assistant' or use similar AI-sounding language. Just answer naturally."
            temperature = personality.get("temperature", 0.7)
            max_tokens = personality.get("max_tokens", 2048)
            
            full_prompt = f"""{ai_persona}

Context:
{context_str}

User: {last}

{'CRITICAL: The user wants STEPS. Look for a "Steps:" section in the documents. Copy the numbered steps EXACTLY as they appear. Do NOT summarize or rewrite.' if is_step_query else ''}

Response:"""
            
            yield json.dumps({"status": "generating", "message": f"Generating as {ai_name}..."})
            
            # Stream response
            response_chunks = []
            async with ClientSession() as session:
                async with session.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={"model": MODEL, "prompt": full_prompt, "stream": True,
                          "options": {"temperature": temperature, "num_predict": max_tokens}},
                    timeout=ClientTimeout(total=60)
                ) as resp:
                    async for line in resp.content:
                        line = line.decode('utf-8').strip()
                        if line:
                            try:
                                token_data = json.loads(line)
                                if token_data.get("response"):
                                    response_chunks.append(token_data["response"])
                                    yield json.dumps({
                                        "status": "streaming",
                                        "token": token_data["response"],
                                        "done": token_data.get("done", False)
                                    })
                            except:
                                pass
            
            full_response = "".join(response_chunks)
            yield json.dumps({"status": "complete", "response": full_response, "sources": [{"title": d.get("title")} for d in docs[:3]]})
        
        # Capture full response for session storage
        full_stream_response = ""
        
        # Return SSE
        response = web.StreamResponse(
            status=200,
            headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive"}
        )
        await response.prepare(request)
        
        async for chunk in generate_stream():
            await response.write(f"data: {chunk}\n\n".encode('utf-8'))
            # Capture complete responses for session storage
            try:
                chunk_data = json.loads(chunk)
                if chunk_data.get("status") == "complete" and chunk_data.get("response"):
                    full_stream_response = chunk_data.get("response")
            except:
                pass
        
        await response.write("data: [DONE]\n\n".encode('utf-8'))
        
        # Store assistant response in session if using sessions
        if session_id and full_stream_response:
            add_message_to_session(session_id, "assistant", full_stream_response)
        
        return response
    
    except Exception as e:
        import traceback
        print(f"Stream error: {e}\n{traceback.format_exc()}", file=sys.stderr)
        return web.json_response({"error": str(e)}, status=500)

# ============== Public Documentation Endpoints ==============

async def docs_handler(request):
    """Serve Swagger UI documentation"""
    docs_path = Path(__file__).parent / "docs.html"
    if docs_path.exists():
        return web.FileResponse(docs_path)
    else:
        # Fallback inline docs
        html_content = '''<!DOCTYPE html>
<html>
<head>
    <title>Atlas API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/openapi.yaml',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis],
        });
    </script>
</body>
</html>'''
        return web.Response(text=html_content, content_type='text/html')

async def openapi_yaml_handler(request):
    """Serve OpenAPI specification"""
    openapi_path = Path(__file__).parent / "openapi.yaml"
    if openapi_path.exists():
        with open(openapi_path) as f:
            content = f.read()
        return web.Response(text=content, content_type='text/yaml')
    else:
        return web.json_response({"error": "OpenAPI spec not found"}, status=404)

# ============== Additional Utility Endpoints ==============

async def root_handler(request):
    """Root endpoint - API info"""
    return web.json_response({
        "name": "Atlas API",
        "version": "2.2.0",
        "description": "Atlas AI API with Knowledge Base and RAG support",
        "endpoints": {
            "docs": "/docs",
            "openapi": "/openapi.yaml",
            "health": "/healthz",
            "chat": "/v1/chat/completions",
            "documents": "/v1/documents",
            "search": "/v1/search"
        },
        "documentation": "https://atlas.moliam.com/docs"
    })

@require_auth()
async def v1_list_models(request):
    """List available AI models"""
    return web.json_response({
        "models": [
            {
                "id": "nous-hermes2:latest",
                "name": "Nous Hermes 2",
                "description": "General purpose chat model",
                "context_window": 4096
            },
            {
                "id": "nomic-embed-text:latest",
                "name": "Nomic Embed Text",
                "description": "Embedding model for vector search",
                "context_window": 2048
            }
        ]
    })

@require_auth()
async def v1_delete_document(request):
    """Delete a document by ID"""
    key_data = request["key_data"]
    tenant_id = key_data.get("tenant_id", "default")
    
    try:
        data = await request.json()
        doc_id = data.get("id")
        
        if not doc_id:
            return web.json_response({"error": "Document ID required"}, status=400)
        
        kb = load_tenant_kb(tenant_id)
        original_len = len(kb)
        kb = [doc for doc in kb if doc.get("id") != doc_id]
        
        if len(kb) == original_len:
            return web.json_response({"error": "Document not found"}, status=404)
        
        save_tenant_kb(tenant_id, kb)
        return web.json_response({
            "success": True,
            "message": f"Document {doc_id} deleted",
            "remaining_documents": len(kb)
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def admin_metrics(request):
    """System metrics endpoint"""
    import psutil
    
    # CPU and Memory
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Process info
    process = psutil.Process()
    proc_memory = process.memory_info()
    
    return web.json_response({
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "percent": round((disk.used / disk.total) * 100, 1)
            },
            "uptime_seconds": round(time.time() - SERVER_START_TIME)
        },
        "process": {
            "memory_mb": round(proc_memory.rss / (1024**2), 2),
            "cpu_percent": process.cpu_percent()
        },
        "requests": request_stats
    })

# ============== Backup & Rollback System ==============

import shutil
from datetime import datetime

BACKUPS_DIR = DATA_DIR.parent / "backups"
os.makedirs(BACKUPS_DIR, exist_ok=True)

MAX_BACKUPS = 10  # Keep last 10 backups

async def create_backup(version_name: str, description: str = "") -> Dict:
    """Create a backup of current state with proper naming convention [version]-[name]-[date]"""
    # Format: v{XX}-{name}-{YYYYMMDD} (e.g., v04-toby-20260417)
    date_str = datetime.now().strftime("%Y%m%d")
    backup_id = f"{version_name}-{date_str}"
    backup_path = BACKUPS_DIR / backup_id
    
    # If backup already exists, add time suffix
    if backup_path.exists():
        time_str = datetime.now().strftime("%H%M%S")
        backup_id = f"{version_name}-{date_str}-{time_str}"
        backup_path = BACKUPS_DIR / backup_id
    
    try:
        os.makedirs(backup_path, exist_ok=True)
        
        # Backup data directory
        data_backup = backup_path / "data"
        if DATA_DIR.exists():
            shutil.copytree(DATA_DIR, data_backup, dirs_exist_ok=True)
        
        # Backup API keys
        if API_KEYS_FILE.exists():
            shutil.copy(API_KEYS_FILE, backup_path / "api-keys.json")
        
        # Update and backup version file
        version_file = DATA_DIR / "current-version.json"
        version_data = {
            "version": "2.2.0",
            "version_name": version_name,
            "description": description,
            "backup_id": backup_id,
            "created_at": datetime.now().isoformat()
        }
        with open(version_file, 'w') as f:
            json.dump(version_data, f, indent=2)
        
        # Create metadata (using new format)
        metadata = {
            "backup_id": backup_id,
            "version_name": version_name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "date": date_str,
            "data_size_mb": round(sum(f.stat().st_size for f in DATA_DIR.rglob('*') if f.is_file()) / (1024**2), 2) if DATA_DIR.exists() else 0
        }
        
        with open(backup_path / "metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Also create legacy backup-meta.json for compatibility
        with open(backup_path / "backup-meta.json", 'w') as f:
            json.dump({
                "version": version_name,
                "created": datetime.now().isoformat(),
                "description": description
            }, f, indent=2)
        
        # Cleanup old backups
        await cleanup_old_backups()
        
        return {"success": True, "backup": metadata}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def list_backups() -> List[Dict]:
    """List all available backups (supports both old and new formats) - Excludes auto-generated pre-restore backups"""
    backups = []
    if BACKUPS_DIR.exists():
        for backup_dir in sorted(BACKUPS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if backup_dir.is_dir():
                # Skip auto-generated pre-restore backups from UI
                if backup_dir.name.startswith("pre-restore-"):
                    continue
                
                # Try new format first
                metadata_file = backup_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file) as f:
                        metadata = json.load(f)
                        backups.append(metadata)
                else:
                    # Try legacy format (backup-meta.json)
                    legacy_file = backup_dir / "backup-meta.json"
                    if legacy_file.exists():
                        with open(legacy_file) as f:
                            legacy = json.load(f)
                            # Convert to new format
                            backups.append({
                                "backup_id": backup_dir.name,
                                "version_name": legacy.get("version", backup_dir.name),
                                "description": legacy.get("description", "Legacy backup"),
                                "created_at": legacy.get("created", datetime.fromtimestamp(backup_dir.stat().st_mtime).isoformat()),
                                "date": backup_dir.name.split("-")[-1] if "-" in backup_dir.name else "",
                                "data_size_mb": 0,  # Unknown for legacy
                                "legacy": True
                            })
    return backups

async def restore_backup(backup_id: str) -> Dict:
    """Restore from a backup"""
    backup_path = BACKUPS_DIR / backup_id
    
    if not backup_path.exists():
        return {"success": False, "error": f"Backup {backup_id} not found"}
    
    try:
        # Create pre-restore backup of current state
        pre_restore_backup = await create_backup(
            f"pre-restore-{backup_id}",
            f"Automatic backup before restoring {backup_id}"
        )
        
        # Restore data directory
        data_backup = backup_path / "data"
        if data_backup.exists():
            # Clear current data
            if DATA_DIR.exists():
                shutil.rmtree(DATA_DIR)
            shutil.copytree(data_backup, DATA_DIR)
        
        # Restore API keys
        keys_backup = backup_path / "api-keys.json"
        if keys_backup.exists():
            shutil.copy(keys_backup, API_KEYS_FILE)
        
        # Restore version file from backup metadata
        metadata_file = backup_path / "metadata.json"
        version_data = {
            "version": "2.2.0",
            "version_name": backup_id,  # Use backup_id as version
            "backup_id": backup_id,
            "restored_at": datetime.now().isoformat()
        }
        
        if metadata_file.exists():
            with open(metadata_file) as f:
                metadata = json.load(f)
                version_data["version_name"] = metadata.get("version_name", backup_id)
                version_data["description"] = metadata.get("description", "")
        
        # Also check legacy format
        legacy_file = backup_path / "backup-meta.json"
        if legacy_file.exists():
            with open(legacy_file) as f:
                legacy = json.load(f)
                version_data["version_name"] = legacy.get("version", backup_id)
                version_data["description"] = legacy.get("description", "")
        
        # Write version file
        with open(DATA_DIR / "current-version.json", 'w') as f:
            json.dump(version_data, f, indent=2)
        
        return {
            "success": True,
            "message": f"Restored from backup {backup_id}",
            "pre_restore_backup": pre_restore_backup.get("backup", {}).get("backup_id"),
            "version_name": version_data["version_name"]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

async def cleanup_old_backups():
    """Remove old backups keeping only MAX_BACKUPS user-created backups"""
    # Get user-created backups only (exclude auto-generated pre-restore)
    user_backups = [
        b for b in BACKUPS_DIR.iterdir() 
        if b.is_dir() and not b.name.startswith("pre-restore-")
    ]
    
    # Sort by modification time (newest first)
    sorted_backups = sorted(user_backups, key=lambda x: x.stat().st_mtime, reverse=True)
    
    # Delete oldest backups beyond MAX_BACKUPS
    for old_backup in sorted_backups[MAX_BACKUPS:]:
        shutil.rmtree(old_backup)

async def get_backup_status(backup_id: str) -> Optional[Dict]:
    """Get status of a specific backup"""
    backup_path = BACKUPS_DIR / backup_id
    metadata_file = backup_path / "metadata.json"
    if metadata_file.exists():
        with open(metadata_file) as f:
            return json.load(f)
    return None

async def delete_backup(backup_id: str) -> Dict:
    """Delete a specific backup"""
    backup_path = BACKUPS_DIR / backup_id
    if not backup_path.exists():
        return {"success": False, "error": f"Backup {backup_id} not found"}
    
    try:
        shutil.rmtree(backup_path)
        return {"success": True, "message": f"Backup {backup_id} deleted"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============== Backup API Endpoints ==============

@require_auth()
async def admin_list_backups(request):
    """List all backups"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    backups = await list_backups()
    return web.json_response({
        "backups": backups,
        "total": len(backups),
        "max_kept": MAX_BACKUPS
    })

@require_auth()
async def admin_create_backup(request):
    """Create a new backup"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    try:
        data = await request.json()
        version_name = data.get("version_name", f"backup-{datetime.now().strftime('%Y%m%d')}")
        description = data.get("description", "Manual backup")
        
        result = await create_backup(version_name, description)
        if result["success"]:
            return web.json_response(result)
        else:
            return web.json_response({"error": result["error"]}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def admin_restore_backup(request):
    """Restore from a backup - Streamlined for admins"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    try:
        data = await request.json()
        
        # Support both 'backup_id' and 'version' parameter names
        backup_id = data.get("backup_id") or data.get("version")
        
        if not backup_id:
            return web.json_response({
                "error": "backup_id or version required",
                "example": {"backup_id": "v01-toby-20260416"}
            }, status=400)
        
        # Check if backup exists
        backup_path = BACKUPS_DIR / backup_id
        if not backup_path.exists():
            # Try to find backup by partial match
            available = [d.name for d in BACKUPS_DIR.iterdir() if d.is_dir()]
            matches = [b for b in available if backup_id in b or b.startswith(backup_id)]
            
            if len(matches) == 1:
                backup_id = matches[0]
            elif len(matches) > 1:
                return web.json_response({
                    "error": f"Multiple backups match '{backup_id}'",
                    "matches": matches,
                    "hint": "Use full backup_id"
                }, status=400)
            else:
                return web.json_response({
                    "error": f"Backup '{backup_id}' not found",
                    "available_backups": available[:10]
                }, status=404)
        
        result = await restore_backup(backup_id)
        if result["success"]:
            # Get backup info
            metadata = await get_backup_status(backup_id) or {}
            return web.json_response({
                "success": True,
                "message": f"Rolled back to {metadata.get('version_name', backup_id)}",
                "restored_from": backup_id,
                "version_name": metadata.get("version_name"),
                "description": metadata.get("description"),
                "pre_restore_backup": result.get("pre_restore_backup"),
                "timestamp": datetime.now().isoformat()
            })
        else:
            return web.json_response({"error": result["error"]}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def admin_get_backup(request):
    """Get specific backup details"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    backup_id = request.match_info.get('backup_id')
    status = await get_backup_status(backup_id)
    
    if status:
        return web.json_response({"backup": status})
    else:
        return web.json_response({"error": "Backup not found"}, status=404)

@require_auth()
async def admin_delete_backup(request):
    """Delete a backup"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    try:
        data = await request.json()
        backup_id = data.get("backup_id")
        
        if not backup_id:
            return web.json_response({"error": "backup_id required"}, status=400)
        
        result = await delete_backup(backup_id)
        if result["success"]:
            return web.json_response(result)
        else:
            return web.json_response({"error": result["error"]}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@require_auth()
async def admin_rollback_status(request):
    """Get rollback status and available versions"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    backups = await list_backups()
    
    # Read current version from file (updated on backup/restore)
    version_file = DATA_DIR / "current-version.json"
    if version_file.exists():
        with open(version_file) as f:
            version_data = json.load(f)
            current_version = version_data.get("version_name", version_data.get("version", "2.2.0"))
            version_description = version_data.get("description", "")
    else:
        current_version = "2.2.0"
        version_description = ""
    
    # Get current data state
    data_stats = {
        "documents": sum(1 for _ in KB_DIR.glob("*.json")),
        "api_keys": len(load_api_keys().get("keys", {})),
        "tenants": len(load_api_keys().get("tenants", {}))
    }
    
    return web.json_response({
        "current_version": current_version,
        "version_description": version_description,
        "data_stats": data_stats,
        "available_backups": backups[:5],  # Last 5
        "total_backups": len(backups),
        "rollback_ready": len(backups) > 0
    })

@require_auth()
async def admin_rollback_restart(request):
    """Restore from backup and restart server - Streamlined for admins"""
    key_data = request["key_data"]
    if key_data.get("role") != "admin":
        return web.json_response({"error": "Admin access required"}, status=403)
    
    try:
        data = await request.json()
        
        # Support both 'backup_id' and 'version' parameter names
        backup_id = data.get("backup_id") or data.get("version")
        
        if not backup_id:
            return web.json_response({
                "error": "backup_id or version required",
                "example": {"backup_id": "v01-toby-20260416"}
            }, status=400)
        
        # Check if backup exists
        backup_path = BACKUPS_DIR / backup_id
        if not backup_path.exists():
            # Try to find backup by partial match
            available = [d.name for d in BACKUPS_DIR.iterdir() if d.is_dir()]
            matches = [b for b in available if backup_id in b or b.startswith(backup_id)]
            
            if len(matches) == 1:
                backup_id = matches[0]
                backup_path = BACKUPS_DIR / backup_id
            elif len(matches) > 1:
                return web.json_response({
                    "error": f"Multiple backups match '{backup_id}'",
                    "matches": matches,
                    "hint": "Use full backup_id"
                }, status=400)
            else:
                return web.json_response({
                    "error": f"Backup '{backup_id}' not found",
                    "available_backups": available[:10]
                }, status=404)
        
        # First restore the backup
        result = await restore_backup(backup_id)
        if not result["success"]:
            return web.json_response({"error": result["error"]}, status=500)
        
        # Get backup info for response
        metadata = await get_backup_status(backup_id) or {"version_name": backup_id}
        
        # Schedule server restart (non-blocking)
        async def restart_server():
            await asyncio.sleep(2)  # Give time for response to send
            import sys
            os.execv(sys.executable, [sys.executable] + sys.argv)
        
        # Start restart in background
        asyncio.create_task(restart_server())
        
        return web.json_response({
            "success": True,
            "message": f"Rolled back to {metadata.get('version_name', backup_id)} and restarting",
            "restored_from": backup_id,
            "version_name": metadata.get("version_name"),
            "description": metadata.get("description"),
            "pre_restore_backup": result.get("pre_restore_backup"),
            "restart_scheduled": True,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        import traceback
        return web.json_response({"error": str(e), "trace": traceback.format_exc()}, status=500)
        return web.json_response({"error": str(e)}, status=500)

# ============== Admin Endpoints ==============

@require_auth()
async def admin_stats(request):
    """System stats"""
    keys_db = load_api_keys()
    return web.json_response({
        "keys": {"total": len(keys_db.get("keys", {})), "by_role": {}},
        "tenants": {"total": len(keys_db.get("tenants", {}))},
        "requests": request_stats
    })

@require_auth()
async def admin_list_tenants(request):
    """List tenants"""
    keys_db = load_api_keys()
    return web.json_response({"tenants": list(keys_db.get("tenants", {}).keys())})

@require_auth()
async def admin_list_keys(request):
    """List API keys"""
    keys_db = load_api_keys()
    keys = []
    for key_id, key_data in keys_db.get("keys", {}).items():
        keys.append({
            "key_id": key_id,
            "role": key_data.get("role"),
            "name": key_data.get("name"),
            "tenant_id": key_data.get("tenant_id"),
            "revoked": key_data.get("revoked", False)
        })
    return web.json_response({"keys": keys})

@require_auth()
async def admin_get_personality(request):
    """Get AI personality"""
    tenant_id = request["key_data"].get("tenant_id", "default")
    keys_db = load_api_keys()
    tenant = keys_db.get("tenants", {}).get(tenant_id, {})
    personality = tenant.get("ai_personality", {})
    return web.json_response({"personality": personality})

# v3: Memory stats endpoint
@require_auth()
async def admin_memory_stats(request):
    """GET /v1/admin/memory-stats - v3 Memory System Statistics"""
    key_data = request.get("key_data", {})
    if not has_permission(key_data, "admin:stats") and not has_permission(key_data, "system:stats"):
        return web.json_response({"error": "Forbidden"}, status=403)
    
    if not MEMORY_SYSTEM_AVAILABLE:
        return web.json_response({
            "error": "Memory system not available",
            "status": "unavailable"
        }, status=503)
    
    try:
        stats = get_memory_stats()
        return web.json_response({
            "status": "ok",
            "memory_system": "memvid-v3",
            "version": "3.0.0",
            "stats": stats,
            "performance": {
                "query_time_ms_avg": "<2",
                "query_time_ms_p50": "<1",
                "cache_hits": "1000 entries LRU",
                "index_type": "HNSW"
            },
            "features": [
                "instant_retrieval",
                "hybrid_search",
                "semantic_matching",
                "lru_cache"
            ]
        })
    except Exception as e:
        return web.json_response({
            "error": str(e),
            "status": "error"
        }, status=500)

# ============== Main ==============

async def main():
    # Initialize keys if not exists
    if not API_KEYS_FILE.exists():
        initial_data = {
            "keys": {
                "atlas-admin-venzeti-2026": {
                    "role": "admin",
                    "name": "Venzeti Admin",
                    "permissions": ["*"]
                },
                "atlas-lib-thinktank-2026": {
                    "role": "librarian",
                    "name": "Think Tank Librarian",
                    "tenant_id": "thinktank-prod",
                    "permissions": PERMISSIONS["librarian"]
                }
            },
            "tenants": {
                "thinktank-prod": {
                    "name": "Think Tank Production",
                    "ai_personality": {
                        "name": "Toby",
                        "persona": "You're Toby. Keep it natural and conversational. Don't over-introduce yourself.",
                        "temperature": 0.7,
                        "max_tokens": 2048
                    }
                }
            },
            "audit_log": []
        }
        save_api_keys(initial_data)
    
    app = web.Application(middlewares=[auth_middleware])
    
    # CORS
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True, expose_headers="*", allow_headers="*", allow_methods="*"
        )
    })
    
    # Routes
    app.router.add_get("/v1/admin/backups", admin_list_backups)
    app.router.add_post("/v1/admin/backups", admin_create_backup)
    app.router.add_get("/v1/admin/backups/{backup_id}", admin_get_backup)
    app.router.add_delete("/v1/admin/backups", admin_delete_backup)
    app.router.add_post("/v1/admin/rollback-restart", admin_rollback_restart)
    app.router.add_post("/v1/admin/rollback", admin_restore_backup)
    app.router.add_get("/v1/admin/rollback/status", admin_rollback_status)
    app.router.add_get("/", root_handler)
    app.router.add_get("/healthz", healthz)
    app.router.add_get("/livez", livez)
    app.router.add_get("/docs", docs_handler)
    app.router.add_get("/openapi.yaml", openapi_yaml_handler)
    app.router.add_get("/v1/models", v1_list_models)
    app.router.add_get("/v1/admin/metrics", admin_metrics)
    app.router.add_delete("/v1/documents", v1_delete_document)
    app.router.add_post("/v1/test", v1_test)
    app.router.add_get("/v1/admin/stats", admin_stats)
    app.router.add_get("/v1/admin/tenants", admin_list_tenants)
    app.router.add_get("/v1/admin/keys", admin_list_keys)
    app.router.add_get("/v1/admin/personality", admin_get_personality)
    app.router.add_get("/v1/admin/memory-stats", admin_memory_stats)  # v3: Memory stats
    app.router.add_get("/v1/documents", v1_list_documents)
    app.router.add_post("/v1/documents", v1_upload_document)
    app.router.add_post("/v1/search", v1_search)
    app.router.add_post("/v1/chat/completions", v1_chat_completions)
    app.router.add_post("/v1/chat/stream", v1_chat_stream)
    
    for route in list(app.router.routes()):
        cors.add(route)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", PORT)
    await site.start()
    
    print(f"Atlas API Server v2.2.0 running on http://localhost:{PORT}")
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())
