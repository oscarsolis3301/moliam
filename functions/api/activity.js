/** ============================================================================
   GET/POST /api/activity -- Client Activity Feed Backend
   
   Returns client's activity feed from client_activity table with filtering options.
   
   SECURITY FEATURES:
    - Token extraction from URL params, hash fragment, or cookies (fallback chain)
    - Parameterized queries prevent SQL injection - uses ? binding throughout
    - Session validation with expiry checking and is_active flag
    - Client-only view of their own activity (admin can see all if role=admin/superadmin)
   
   QUERY PARAMETERS:
    - action=list: Return paginated list of user's activities (GET/POST supported)
    - action=delete: Delete specific activity by ID (admin only)
    - action=count: Return total activity count for user
   
   LIMIT PARAMETER: max results to return (default 20, max 100)
   
   RESPONSES:
    - 401 Invalid/expired session → {success:false, message:"Session invalid or expired."}
    - 403 Forbidden for non-admin trying to access other user's data
    - 503 Database unavailable → {success:false, message:"Database service unavailable."}
    - 200 Success → {success:true, data:[...], total: N, fetchAt: 'ISO-8601'}
    
   @param {Object} context - Request context from Cloudflare Pages
   @param {Request} context.request - Incoming request with query params and cookies
   @param {MOLIAM_DB} context.env.MOLIAM_DB - Bound D1 database
   @returns {Response} JSON response with activity data or status 401/503

   EXAMPLES:
   GET /api/activity?action=list&limit=20 → Paginated activities for current user
   POST /api/activity?action=list (with body) → Same as GET but with optional filtering params
   GET /api/activity?action=count → Returns {"data":{"count":42}}
========================================================================= */

import { jsonResp, generateRequestId } from './lib/standalone.js';

const SLOW_QUERY_THRESHOLD = 50;

async function trackQuery(env, queryName, dbOperation) {
    const start = Date.now();
    
    try {
        const result = await dbOperation();
        const duration = Date.now() - start;
        
        if (duration > SLOW_QUERY_THRESHOLD) {
            console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`);
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error(`[QUERY ERROR] ${queryName}:`, error.message);
        throw error;
    }
}

export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        const db = env.MOLIAM_DB;

        if (!db) {
            return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
        }

        // --- Parse token from URL params or cookies ---
        let token;
        
        // Try to get token from query params first
        const url = new URL(request.url);
        token = (url.searchParams.get('token') || '').trim();
        
        // Try to get token from URL hash fragment if query param not found
        try {
            const hashIdx = request.url.indexOf('#');
            if (hashIdx > -1) {
                const hash = request.url.substring(hashIdx + 1);
                const query = new URLSearchParams(hash.split('&')[0]);
                token = (query.get('token') || '').trim();
            }
        } catch (urlErr) {
            console.warn("Token extraction from URL fragment failed:", urlErr.message);
        }
        
        // Fall back to cookie extraction if no token found in hash
        if (!token) {
            const cookies = request.headers.get('Cookie') || '';
            const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
            token = (cookieMatch ? cookieMatch[1] : null);
        }
        
        // Extract action type
        const action = url.searchParams.get('action') || 'list';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

        // --- Session validation with parameterized query ---
        const session = (await db.prepare(
            `SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')`
        ).bind(token).first()));

        if (!session) {
            return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
        }

        const isAdmin = session.role === 'admin' || session.role === 'superadmin';
        const clientId = session.id;

        // Handle different actions
        if (action === 'count') {
            const countResult = await trackQuery(env, 'activity-count-query', () => 
                db.prepare(
                    isAdmin ? 'SELECT COUNT(*) as c FROM client_activity' 
                           : 'SELECT COUNT(*) as c FROM client_activity WHERE user_id=?'
                ).bind(isAdmin ? undefined : clientId).first()
            );
            
            return jsonResp(200, {
                success: true,
                action: 'count',
                data: { count: (countResult?.c || 0) },
                fetchAt: new Date().toISOString()
            }, request);
        }

        // DEFAULT: action=list - Return activities list
        let activities;
        
        if (isAdmin) {
            const result = await trackQuery(env, 'activity-list-admin', () => 
                db.prepare(`
                    SELECT ca.*, u.email as client_email, u.name as client_name
                    FROM client_activity ca
                    JOIN users u ON ca.user_id = u.id
                    ORDER BY ca.created_at DESC LIMIT ?`).bind(limit).all());
            activities = (result?.results || []);
        } else {
            const result = await trackQuery(env, 'activity-list-user', () => 
                db.prepare(`
                    SELECT * FROM client_activity 
                    WHERE user_id=? 
                    ORDER BY created_at DESC LIMIT ?`).bind(clientId, limit).all());
            activities = (result?.results || []);
        }

        return jsonResp(200, {
            success: true,
            action: 'list',
            data: activities,
            total: activities.length,
            limit: limit,
            fetchAt: new Date().toISOString()
        }, request);

    } catch (err) {
        console.error('Activity API error:', err.message);
        return jsonResp(500, { success: false, message: 'Server error.' }, request);
    }
}

/** Handle POST requests to activity endpoint - same as GET but allows filtering in body */
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        const db = env.MOLIAM_DB;

        if (!db) {
            return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
        }

        let token;
        try {
            const url = new URL(request.url);
            token = (url.searchParams.get('token') || '').trim();
            
            try {
                const hashIdx = request.url.indexOf('#');
                if (hashIdx > -1) {
                    const hash = request.url.substring(hashIdx + 1);
                    const query = new URLSearchParams(hash.split('&')[0]);
                    token = (query.get('token') || '').trim();
                }
            } catch (urlErr) {}
            
            if (!token) {
                const cookies = request.headers.get('Cookie') || '';
                const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
                token = (cookieMatch ? cookieMatch[1] : null);
            }

        } catch (parseErr) {
            return jsonResp(400, { success: false, message: 'Invalid request format.' }, request);
        }

        const url = new URL(request.url);
        
        // Session validation
        const session = (await db.prepare(
            `SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')`
        ).bind(token).first()));

        if (!session) {
            return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
        }
        
        const email = session.email;
        const isAdmin = session.role === 'admin' || session.role === 'superadmin';
        
        // Extract post body if present (filtering options)
        let limit = 20;
        try {
            const contentType = request.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                const body = await request.json();
                limit = Math.min(parseInt(body.limit || '20', 10), 100);
            }
        } catch (bodyErr) {
            // Ignore body parsing errors, use defaults
        }

        // Handle CREATE action - allow creating new activity entries (for admin or auto-generated by backend)
        const urlObj = new URL(request.url);
        const action = urlObj.searchParams.get('action') || 'list';
        
        if (action === 'create' && !isAdmin) {
            return jsonResp(403, { success: false, message: "Admin access required to create activities." }, request);
        }

        if (action === 'create') {
            try {
                const body = await request.json();
                
                const newActivity = await db.prepare(`
                    INSERT INTO client_activity (user_id, action_type, details, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                ).bind(
                    parseInt(body.user_id || session.id),
                    body.action_type || 'info',
                    body.details || ''
                ).run();

                return jsonResp(201, {
                    success: true,
                    message: 'Activity created.',
                    data: {
                        id: newActivity.meta?.lastInsertRowid,
                        user_id: session.id,
                        action_type: body.action_type,
                        details: body.details,
                        created_at: new Date().toISOString()
                    }
                }, request);

            } catch (dbErr) {
                console.error('Create activity failed:', dbErr.message);
                return jsonResp(500, { success: false, message: 'Failed to create activity.' }, request);
            }
        }

        if (action === 'delete') {
            if (!isAdmin) {
                return jsonResp(403, { success: false, message: "Admin access required to delete activities." }, request);
            }

            const activityId = parseInt(urlObj.searchParams.get('id') || '0', 10);
            
            const result = await db.prepare(`
                DELETE FROM client_activity WHERE id=?`).bind(activityId).run();

            return jsonResp(200, {
                success: true,
                message: 'Activity deleted.',
                changes: (result.changes || 0)
            }, request);
        }

        // DEFAULT POST: Same as list but with potential body filters
        const activities = (await db.prepare(`
            SELECT * FROM client_activity 
            WHERE user_id=? 
            ORDER BY created_at DESC LIMIT ?`).bind(
                isAdmin ? parseInt(body.user_id || session.id) : session.id,
                limit
            ).all()).results || [];

        return jsonResp(200, {
            success: true,
            action: 'list',
            data: activities,
            total: activities.length,
            limit: limit,
            fetchAt: new Date().toISOString()
        }, request);

    } catch (err) {
        console.error('Activity API POST error:', err.message);
        return jsonResp(500, { success: false, message: 'Server error.' }, request);
    }
}
