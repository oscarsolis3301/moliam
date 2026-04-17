/**
 * Appointments API - Complete CRUD + Booking Management System  
 * Full CRUD operations for client portal booking management.
 */

import { jsonResp, parseRequestBody, validateSessionToken } from '../lib/standalone.js';

/** @type {D1Database} MOLIAM_DB bound in wrangler.toml */

function getSessionTokenFromRequest(request) {
  const url = new URL(request.url);
  
  if (url.hash && !/^#$/.test(url.hash)) {
    const match = url.hash.match(/token=([^&]*)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }

  const tokenFromParam = url.searchParams.get('token');
  if (tokenFromParam) return decodeURIComponent(tokenFromParam);
  
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
  if (cookies.moliam_session) return decodeURIComponent(cookies.moliam_session);

  return null;
}

function corsResponse(body, method='GET', token=null) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "https://moliam.pages.dev");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  
  if (token) {
    headers.set("Set-Cookie", "moliam_session=" + encodeURIComponent(token) + "; Path=/; SameSite=Strict; HttpOnly");
  }
  return new Response(body, { status: 200, headers });
}

export async function frontend(request){
  const url=new URL(request.url);
  
  if(request.method==="OPTIONS"){return corsResponse(null,"OPTIONS");}
  
  const sessionToken=getSessionTokenFromRequest(request);
  const authResult=validateSessionToken(sessionToken,request);
  const action=url.searchParams.get("action")||"list";

  if(action=="list"){return await handleList(request,authResult);}
  if(action=="get"||action==="view"){return await handleGetById(request,authResult);}
  if(action=="admin-list"){return await handleAdminList(request,authResult);}
  if(action=="create"){return await handleCreate(request,authResult);}
  if(action=="update"){return await handleUpdate(request,authResult);}
  if(action=="reschedule") {
    const body=await parseRequestBody(request,false);
    return await handleReschedule(request,body,authResult);
   }
  if(action=="cancel") {
    const body=await parseRequestBody(request,false);
    return await handleCancel(request,body,authResult);}

  return corsResponse(JSON.stringify(jsonResp(400,null,"Unknown: "+action)),request.method,sessionToken);}

// Listing user's appointments with pagination and optional filters
async function handleList(request,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"GET");}

  const url=new URL(request.url);
  
  try{
    let query=`SELECT * FROM appointments WHERE contact_id IN(SELECT id FROM contacts WHERE email = ?) ORDER BY scheduled_at DESC LIMIT ?`;
    const args=[authResult.session.email];
    
    const statusFilter=url.searchParams.get("status");
    if(statusFilter&&["pending","confirmed","completed","cancelled"].includes(statusFilter)){
      query=query.replace("?","? AND status = ?"); }
    else{query=""+args.pop()+" ORDER BY scheduled_at DESC LIMIT ?";}

    const limitParam=url.searchParams.get("limit");
    if(limitParam&&!isNaN(parseInt(limitParam))){args.push(Math.min(50,parseInt(limitParam)));}else{args.push(20);}

    const stmt=MOLIAM_DB.prepare(query).bind(...args);
    const result=await stmt.all();

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:result.results.map(r=>({...r})),fetchAt:new Date().toISOString()}),"GET"));
  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"Database error:"+e.message)),"GET");}}

// Single appointment by ID with validation and access control
async function handleGetById(request,authResult){
  if(!authResult||!authResult.session.user_id){return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"GET");}

  const url=new URL(request.url);
  const appointmentId=url.searchParams.get("id");

  if(!appointmentId||!/^[0-9]+$/.test(appointmentId)){
    return corsResponse(JSON.stringify(jsonResp(400,null,"Invalid ID. Use ?id=<number>")),"GET");}

  try{
    const stmt=MOLIAM_DB.prepare("SELECT c.*,c2.name as client_name,c2.email as client_email FROM appointments a LEFT JOIN contacts c2 ON contact_id = c2.id WHERE a.id=? LIMIT 1");
    const result=await stmt.bind(appointmentId).all();

    if(result.results.length===0){
      return corsResponse(JSON.stringify(jsonResp(404,null,"Not found: "+appointmentId)),"GET");}

    const appointment=result.results[0];
    
    if(authResult.admin!=="yes"&&authResult.session.email!==appointment.client_email){
      return corsResponse(JSON.stringify(jsonResp(403,null,"Access denied")),"GET");}

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:appointment,fetchAt:new Date().toISOString()}),"GET"));

  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"GET");}}

// Admin listing across ALL clients (no email filter)
async function handleAdminList(request,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"POST");}

  if(authResult.admin!=="yes"){
    return corsResponse(JSON.stringify(jsonResp(403,null,"Admin only")),"GET");}

  const url=new URL(request.url);
  
  try{
    let query="SELECT a.*,c.name as client_name,c.email as client_email FROM appointments a LEFT JOIN contacts c ON a.contact_id = c.id";
    const args=[];

    const statusFilter=url.searchParams.get("status");
    if(statusFilter&&["pending","confirmed","completed","cancelled"].includes(statusFilter)){query=query+" WHERE status=?";args.push(statusFilter);}

    let limit=20;
    const limitParam=url.searchParams.get("limit");
    if(limitParam&&!isNaN(parseInt(limitParam))){limit=Math.min(100,parseInt(limitParam));}

    const stmt=MOLIAM_DB.prepare(query+" LIMIT ?").bind(...args,limit);
    const result=await stmt.all();

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:result.results.map(r=>({...r})),fetchAt:new Date().toISOString()}),"GET"));
  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"GET");}}

// Create new manual appointment from client portal form
async function handleCreate(request,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"POST");}

  try{
    const body=await parseRequestBody(request,false);
    
    if(typeof body.scheduled_at!=="string"){return corsResponse(JSON.stringify(jsonResp(400,null,"Missing scheduled_at")),"POST");}

    const stmt=MOLIAM_DB.prepare("INSERT INTO appointments(contact_id,client_name,client_email,calendar_event_id,calendar_link,booking_source,scheduled_with,appointment_datetime,status,client_timezone) VALUES(?,?,?,?,?,?,?,?,?,?)");
    
    const contactId=body.contact_id||null;
    const clientName=body.client_name||"";
    const clientEmail=body.client_email||"";
    const calendarEventId=body.calendar_event_id||"";
    const calendarLink=body.calendar_link||"";
    const bookingSource=body.booking_source||"manual";
    const scheduledWith=body.scheduled_with||"Roman";
    const appointmentDatetime=body.appointment_datetime||"";
    const status=body.status||"pending";
    const clientTimeZone=body.client_timezone||"America/Los_Angeles";

    const res=await stmt.bind(contactId,clientName,clientEmail,calendarEventId,calendarLink,bookingSource,scheduledWith,appointmentDatetime,status,clientTimeZone).run();

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:{id:res.lastInsertRowid.toString()},message:"Created",fetchAt:new Date().toISOString()}),"POST"));

  }catch(e){if(e.message.includes("UNIQUE")){return corsResponse(JSON.stringify(jsonResp(409,null,"Event ID exists")),"POST");}
    return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"POST");}}

// Update appointment details by ID
async function handleUpdate(request,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"PUT");}

  try{
    const body=await parseRequestBody(request,false);
    const appointmentId=String(body.id||body.appointment_id);

    if(!appointmentId.match(/^[0-9]+$/)){return corsResponse(JSON.stringify(jsonResp(400,null,"Invalid ID")),"PUT");}

    const updates=[];const values=[];
    
    if(typeof body.scheduled_at==="string"){updates.push("scheduled_at=?");values.push(body.scheduled_at);}
    if(typeof body.status!=="undefined"&&body.status!==null){updates.push("status=?");values.push(body.status);}
    if(typeof body.client_timezone!=="undefined"){updates.push("client_timezone=?");values.push(body.client_timezone);}
    if(typeof body.notes!=="undefined"){updates.push("notes=?");values.push(body.notes);}

    if(updates.length===0){return corsResponse(JSON.stringify(jsonResp(400,null,"No fields to update")),"PUT");}

    values.push(appointmentId);const stmt=MOLIAM_DB.prepare("UPDATE appointments SET " + updates.join(",") +" WHERE id=?");
    const result=await stmt.run(...values);

    if(result.changes===0){return corsResponse(JSON.stringify(jsonResp(404,null,"Not found: "+appointmentId)),"PUT");}

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:{id:appointmentId,updated_at:new Date().toISOString()}}),"PUT"));

  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"PUT");}}

// Reschedule appointment - changes status and scheduled time
async function handleReschedule(request,body,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"POST");}

  const appointmentId=String(body.id||body.appointment_id);

  if(!appointmentId.match(/^[0-9]+$/)){return corsResponse(JSON.stringify(jsonResp(400,null,"Invalid ID")),"POST");}
  
  const newScheduledAt=body.scheduled_at||"";
  if(!newScheduledAt){return corsResponse(JSON.stringify(jsonResp(400,null,"Missing scheduled_at for rescheduling")),"POST");}

  try{const stmt=MOLIAM_DB.prepare("UPDATE appointments SET status=?,scheduled_at=?,updated_at=datetime('now') WHERE id=?");
    const result=await stmt.run("rescheduled",newScheduledAt,appointmentId);

    if(result.changes===0){return corsResponse(JSON.stringify(jsonResp(404,null,"Not found: "+appointmentId)),"POST");}

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:{id:appointmentId,new_status:"rescheduled"},"message":"Rescheduled"}),"POST"));

  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"POST");}}

// Cancel/delete appointment by ID
async function handleCancel(request,body,authResult){
  if(!authResult||!authResult.session.user_id){
    return corsResponse(JSON.stringify(jsonResp(401,null,"Session required")),"DELETE");}

  const appointmentId=body.id||String(body.appointment_id);

  if(!appointmentId.match(/^[0-9]+$/)){return corsResponse(JSON.stringify(jsonResp(400,null,"Invalid ID")),"DELETE");}

  try{const stmt=MOLIAM_DB.prepare("UPDATE appointments SET status='cancelled',updated_at=datetime('now') WHERE id=?");
    const result=await stmt.run(appointmentId);

    if(result.changes===0){return corsResponse(JSON.stringify(jsonResp(404,null,"Not found: "+appointmentId)),"DELETE");}

    return corsResponse(JSON.stringify(jsonResp(null,{success:true,data:{id:appointmentId,deleted_at:new Date().toISOString()}),"message":"Cancelled"}),"DELETE"));

  }catch(e){return corsResponse(JSON.stringify(jsonResp(503,null,"DB error:"+e.message)),"DELETE");}}
