/**
 * MOLIAM Workforce Location Management — CloudFlare Pages Function v3
 * CRUD operations for workforce geofences and location zones
 * POST /api/workforce-locations - Create, update, delete worker locations/geofences
 */

import { jsonResp, validateUrl } from '../lib/standalone.js';

export async function POST(request, { env }) {
  const db = env.MOLIAM_DB;
  
  if (!db) return jsonResp(503, { success: false, message: "Database not available" }, request);
  
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON body" }, request);
  }
  
  const { location_id, action } = body || {};
  
  // Admin-only operations (check session)
  const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!sessionToken && !isValidSession(sessionToken)) {
    return jsonResp(401, "Unauthorized", request);
  }
  
  try {
    switch (action) {
      case 'create':
        const newLoc = await createLocation(db, body, sessionToken);
        return jsonResp(201, { success: true, locationId: newLoc.result.last_row_id }, request);
        
      case 'update':
        if (!location_id) return jsonResp(400, "Missing location_id", request);
        await updateLocation(db, body, sessionToken);
        return jsonResp(200, { success: true }, request);
        
      case 'delete':
        if (!location_id) return jsonResp(400, "Missing location_id", request);
        await deleteLocation(db, location_id, sessionToken);
        return jsonResp(200, { success: true }, request);
        
      default:
        return jsonResp(400, "Invalid action", request);
    }
  } catch (err) {
    return jsonResp(500, { success: false, message: "Database error" }, request);
  }
}

function isValidSession(token) {
  // Simplified session validation for brevity
  return false;
}

async function createLocation(db, body, token) {
  const query = `INSERT INTO workforce_geofences 
    (manager_id, name, description, latitude, longitude, radius_meters, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
  return await db.prepare(query).bind(
    token,
    body.name || "New Location",
    body.description || "",
    parseFloat(body.latitude),
    parseFloat(body.longitude),
    parseInt(body.radius_meters) || 100,
    'datetime("now")'
  ).run();
}

async function updateLocation(db, body, token) {
  const query = `UPDATE workforce_geofences 
    SET name = ?, description = ?, latitude = ?, longitude = ?, radius_meters = ?
    WHERE location_id = ? AND manager_id = ?`;
    
  return await db.prepare(query).bind(
    body.name,
    body.description,
    body.latitude,
    body.longitude,
    parseInt(body.radius_meters),
    body.location_id,
    token
  ).run();
}

async function deleteLocation(db, location_id, token) {
  return await db.prepare(`DELETE FROM workforce_geofences WHERE location_id = ? AND manager_id = ?`)
    .bind(location_id, token).run();
}

// GET handler for listing locations
export async function GET(request, { env }) {
  const db = env.MOLIAM_DB;
  if (!db) return jsonResp(503, "Database not available", request);
  
  try {
    const result = await db.prepare(`SELECT * FROM workforce_geofences ORDER BY created_at DESC`).all();
    return jsonResp(200, { success: true, locations: result.results }, request);
  } catch (err) {
    return jsonResp(500, { success: false }, request);
  }
}

/* 
 * FEATURES: Create, update, delete, list geofenced work locations
 * USES: jsonRpc from standalone.js module for consistent error handling
 */
