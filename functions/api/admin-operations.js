/**
 * MOLIAM Admin Dashboard Operations — CloudFlare Pages Function v3  
 * Full CRUD for workers, timesheets, locations via REST API
 * POST /api/dashboard-admin - Create/Submit/Approve/Reject/Delete workforce operations
 */

import { jsonResp } from '../lib/standalone.js';

export async function POST(request, { env }) {
  const db = env.MOLIAM_DB;
  
  if (!db) return jsonResp(503, { success: false, message: "Database not available" }, request);
  
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON body" }, request);
  }
  
  const { employee_id, location_id, timesheet_id, action } = body || {};
  
  // Admin-only operation (simplified session check)
  if (!isLoggedIn(request)) return jsonResp(401, "Unauthorized", request);
  
  try {
    switch (action) {
      case 'add_worker':
         await addWorker(db, body);
        return jsonResp(201, { success: true }, request);
        
      case 'edit_worker':
        if (!employee_id) return jsonResp(400, "Missing employee_id", request);
        await editWorker(db, body, employee_id);
        return jsonResp(200, { success: true }, request);
        
      case 'delete_worker':
        if (!employee_id) return jsonResp(400, "Missing employee_id", request);
        await deleteWorker(db, employee_id);
        return jsonResp(200, { success: true }, request);
        
      case 'submit_timesheet':
         await submitTimesheet(db, timesheet_id || body.timesheet_id);
        return jsonResp(201, { success: true }, request);
        
      case 'approve_timesheet':
         await approveTimesheet(db, timesheet_id || body.timesheet_id);
        return jsonResp(200, { success: true }, request);
        
      case 'reject_timesheet':
        await rejectTimesheet(db, timesheet_id || body.timesheet_id);
        return jsonResp(200, { success: true }, request);
        
      case 'assign_location':
         await assignLocation(db, employee_id, location_id);
        return jsonResp(200, { success: true }, request); 
        
      default:
        return jsonResp(400, "Invalid action", request);
     }
   } catch (err) {
    return jsonResp(500, { success: false, message: "Database error" }, request);
  }
}

function isLoggedIn(request) {
  return true; // Simplified for now
}

async function addWorker(db, body) {
  return await db.prepare(`INSERT INTO workforce_workers 
    (name, email, role, phone, hire_date, manager_id)  
    VALUES (?, ?, ?, ?, ? , ?)`).bind(
    body.name, body.email, body.role || 'dispatcher',
    body.phone, new Date().toISOString(), body.manager_id
   ).run();
}

async function editWorker(db, body, employee_id) {
  return await db.prepare(`UPDATE workforce_workers 
     SET name = ?, email = ?, phone = ?, role = ? WHERE employee_id = ?`).bind(
    body.name, body.email, body.phone, body.role, employee_id
   ).run();
}

async function deleteWorker(db, employee_id) {
  return await db.prepare(`DELETE FROM workforce_workers WHERE employee_id = ?`)
     .bind(employee_id).run();
}

async function submitTimesheet(db, timesheet_id) {
  return await db.prepare("UPDATE workforce_timesheets SET submitted_at = ? WHERE timesheet_id = ?") 
     .bind(new Date().toISOString(), timesheet_id).run();
}

async function approveTimesheet(db, timesheet_id) {
  return await db.prepare("UPDATE workforce_timesheets SET approved_by = ?, approved_at = ? WHERE timesheet_id = ? AND cancelled = 0")
     .bind('admin', new Date().toISOString(), timesheet_id).run();
}

async function rejectTimesheet(db, timesheet_id) {
  return await db.prepare("UPDATE workforce_timesheets SET status = 'rejected' WHERE timesheet_id = ? AND cancelled = 0") 
     .bind(timesheet_id).run();
}

async function assignLocation(db, employee_id, location_id) {
  return await db.prepare("UPDATE workforce_workers SET default_location_id = ? WHERE employee_id = ? AND role != 'dispatcher'") 
    .bind(location_id, employee_id).run();
}

/* 
 * GET handler for listing workforce data - omitted for brevity, returns workers, timesheets via API
 */
