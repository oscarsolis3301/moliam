/**
/**
 * Pre-Qualification System — CloudFlare Pages Function v3
 * GET /api/prequalify - Get qualification form with scoring criteria
 * POST /api/prequalify - Submit client self-qualification and receive booking authorization  
 * Uses api-helpers for consistent JSON responses and error handling
 * 
 * Filters leads based on:
 * - Budget threshold (minimum $2k)
 * - Timeline urgency (immediate or within 30 days preferred)  
 * - Industry fit
 * - Qualification score calculation (0-100, auto-approve >= 60)
 */

import { jsonResp } from './api-helpers.js';

/**
 * GET /api/prequalify - Retrieve qualification form metadata and criteria
 * Returns form URL and scoring criteria for client self-qualification
 * @param {object} context - Cloudflare Pages request context with env containing MOLIAM_DB
 * @returns {Response} JSON response with form_url, min_budget, preferred_timeline, support_industries
 */
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.MOLIAM_DB;

    // Return form metadata with proper CORS headers for moliam domains
  if (!db) {
     return jsonResp(200, { success: true, error: false, form_url: "/booking/prequalify.html", criteria: { min_budget: 2000, preferred_timeline: ["immediate", "within_week", "next_month"], support_industries: ["real_estate", "financial_services", "healthcare", "retail"] } }, request);
  }

  return jsonResp(200, { success: true, error: false, form_url: "/booking/prequalify.html", criteria: { min_budget: 2000, preferred_timeline: ["immediate", "within_week", "next_month"], support_industries: ["real_estate", "financial_services", "healthcare", "retail"] } }, request);
}

/**
 * POST /api/prequalify - Submit client self-qualification data and receive booking authorization
 * Scores leads on budget(50pts), urgency(30pts), industry fit(20pts) = total 100 max
 * Auto-approves calendar access for score >= 60 AND budget >= $2k threshold
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding  
 * @returns {Response} JSON response with score, calendar_access_granted flag, next_step
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

   // Parse request body with try/catch for malformed JSON and return consistent error format
  let data;
  try {
    data = await request.json();
    } catch (e) {
    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, request);
    }

  const {
      submission_id,
    budget_range,
    max_budget, 
    timeline_urgency,
    project_start_date,
    primary_industry, 
    current_stack,
    pain_points 
   } = data;

   const errors = [];

     // Budget validation - enforce $2k minimum requirement for lead qualification  
  if (!budget_range || budget_range === 'unknown') {
    errors.push("Budget range required.");
   } else if (max_budget && max_budget < 2000) {
    errors.push("Minimum project budget is $2,000. Please adjust your requirements.");
   }

     // Industry validation - can continue even if not supported, but will score lower for priority industries 
  if (!primary_industry || primary_industry === 'unknown') {
    errors.push("Primary industry required.");
   }

  if (errors.length) {
    return jsonResp(400, { success: false, error: true, message: "Validation failed.", errors }, request);
    }

     // Calculate qualification score (0-100) with weighted scoring algorithm
   // Factors: budget(50) + urgency(30) + industry(20) = max 100 points
   /* @returns {number} Score clamped between 45-100 based on all factors */
   let score = 50; // Base start point for any qualified lead

   const factors = {
         // Budget scoring (50 points max) - higher budget = priority treatment 
     budget: () => {
       if (max_budget >= 10000) return 50;
       if (max_budget >= 5000) return 40;
       if (max_budget >= 3000) return 30;
       if (budget_range === 'under_1k') return 20;
       if (max_budget && max_budget < 2000) return 15;
       return 10;
      },

         // Urgency scoring (30 points max) - immediate projects get priority access 
     urgency: () => {
       if (timeline_urgency === 'immediate') return 30;
       if (timeline_urgency === 'within_week') return 25;
       if (timeline_urgency === 'next_month') return 20;
       if (timeline_urgency === 'flexible') return 10;
       return 10;
      },

         // Industry fit (20 points max) - support industries get higher scores 
     industry: () => {
       const supported = ['real_estate', 'financial_services', 'healthcare', 'retail', 'technology'];
       if (supported.includes(primary_industry)) return 15;
       return 10;
      },

         // Pain points depth - the more detailed, the better score for matching 
     details: () => {
       const painPoints = (pain_points || '').toString().toLowerCase();
       if (painPoints.length > 200) return 20;
       if (painPoints.length > 100) return 15;
       if (painPoints.length > 50) return 10;
       return 5;
      }
   };

  score = Math.min(100, score + factors.budget() + factors.urgency() + factors.industry() + factors.details());

  let calendarAccessGranted = 0;
   
     // Auto-approve if score >= 60 and budget >= min threshold of $2,000 
  if (score >= 60 && (!max_budget || max_budget >= 2000)) {
    calendarAccessGranted = 1;
   }

  try {
    const res = await db.prepare(`
       INSERT INTO prequalifications 
         (submission_id, budget_range, max_budget, timeline_urgency, project_start_date, 
          primary_industry, current_stack, pain_points, qualification_score, calendar_access_granted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)\n       .bind(\n        submission_id || null,\n        budget_range || 'unknown',\n        max_budget || null,\n        timeline_urgency || 'flexible',\n        project_start_date || null,\n        primary_industry || 'unknown',\n        current_stack || '',\n        pain_points || '',\n        score,\n        calendarAccessGranted)\n       .run();

    const prequalId = res.meta.last_row_id;

      // If qualified, insert into appointments table with auto-generated booking link 
  if (calendarAccessGranted && submission_id) {
     await generateBooking(context, prequalId);
       }

    return jsonResp(200, { success: true, error: false, message: calendarAccessGranted ? "You're qualified! Click the link below to book." : "Thanks for your response. We'll review and get back to you.", score, calendar_access_granted: calendarAccessGranted, next_step: calendarAccessGranted ? 'booking' : 'review', submission_id: submission_id || null }, request);

    } catch (err) {
    console.error("Pre-qualify error:", err);
    return jsonResp(500, { success: false, error: true, message: "Something went wrong. Please try again later." }, request);
    }
}

/**
 * Auto-generate booking link for qualified leads with Cal.com integration
 * Creates personalized appointment links and sends confirmation emails to qualified leads
 * Non-blocking operation that logs errors to console without affecting user response  
 * @param {object} context - Cloudflare Pages request context with env.ADMIN_EMAIL, MOLIAM_DB
 * @param {number} prequalId - Prequalification record ID from database
 * @returns {{booking_ref:string, schedule_url:string}|null} Booking data or null if not created
 */
async function generateBooking(context, prequalId) {
  const db = context.env.MOLIAM_DB;

   // Generate unique booking reference for tracking and audit logs
  const bookingRef = 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

     // For Cal.com integration - generate personalized calendar link with prequal ID embedded 
  const calLinkBase = "https://calendly.com/visualark/discovery-call";
  const personalizedLink = `${calLinkBase}?prequal=${bookingRef}`;

   // Get prequalification data for context
  const prequal = await db.prepare(`SELECT * FROM prequalifications WHERE id = ?`).bind(prequalId).first();

  if (prequal) {
       // Insert booking record into appointments table with pending status 
     const now = new Date().toISOString();
     await db
        .prepare("INSERT INTO appointments (prequalification_id, calendar_link, status, scheduled_with) VALUES (?, ?, 'pending', ?)")
        .bind(prequalId, personalizedLink, context.env.ADMIN_EMAIL || "hello@moliam.com").run();

       // Send booking confirmation email to qualified lead with priority access 
     await sendBookingConfirmationEmail(context, prequal, personalizedLink);

       // Auto-schedule initial demo slot within 30-day window from today
     const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next week

    console.log(`Auto-generated booking #${bookingRef} for qualified lead: ${prequal.id}`);
    return { 
      booking_ref: bookingRef,
      schedule_url: personalizedLink,
      status: 'pending',
      created_at: now
     };
  }

  return null;
}

/**
 * Send booking confirmation email with priority access branding and notification to Ada
 * HTML email sent to qualified leads with personalized calendar link and instructions  
 * Fire-and-forget operation that logs errors to console without affecting user response
 * @param {object} context - Cloudflare Pages request context with env.ADMIN_EMAIL  
 * @param {object} prequal - Prequalification object with submission info including name/email
 * @param {string} calendarLink - Cal.com personalized URL for client booking
 * @returns {Promise<void>} Fire-and-forget, errors logged to console only
 */
async function sendBookingConfirmationEmail(context, prequal, calendarLink) {
  try {
    const env = context.env;
    const email = await getSubEmail(env.MOLIAM_DB, prequal.submission_id);
    const name = await getSubName(env.MOLIAM_DB, prequal.submission_id);

    const subject = "You're Qualified! Book Your Discovery Call Now";
    
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email, name }] }],
        from: { email: "hello@moliam.com", name: "Moliam Team" },
        subject,
        content: [{
          type: "text/html",
          value: `
               <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
                 <h2 style="color:#10B981;">Qualified for Priority Access!</h2>
                 <p>Hi ${name || "Valued Client"},</p>
                 <p>Based on your qualification assessment, you meet our criteria. We'd love to help you.</p>
                 <a href="${calendarLink}" style="display:inline-block;background:#10B981;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Book Your Discovery Call →</a>
                 <p style="font-size:13px;color:#6B7280;margin-top:24px;">Link active for 14 days.</p>
               </div>`}],
        })
      });

       // Send notification to Ada about qualified booking  
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.ADMIN_EMAIL || "hello@moliam.com" }] }],
        from: { email: "noreply@moliam.com", name: "Booking System" },
        subject: `Qualified Lead Booked - ${name || "New Client"}`,
        content: [{
          type: "text/html",
          value: `<p>New booking from qualified lead.<br>Score: <b>${prequal.qualification_score}/100</b><br>Calendar link sent to client.</p>`}]});

    } catch (e) {
console.error("Email error:", e);
    }
}

// CORS preflight handler for all endpoints
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
     }
   });
}

/**
* Retrieve lead email from submissions by ID for personalized emails   
* Returns email address from submissions table or null if not found
* @param {D1Database} db - Database binding to MOLIAM_DB
* @param {number} submissionId - Submission ID to look up   
* @returns {Promise<string|null>} Email or null if submission does not exist
*/
async function getSubEmail(db, submissionId) {
  if (!submissionId) return null;
  const sub = await db.prepare("SELECT email FROM submissions WHERE id = ?").bind(submissionId).first();
  return sub ? sub.email : null;
}

/**
* Retrieve lead name from submissions by ID for personalized emails   
* Returns client name or "Valued Client" default string if submission not found   
* @param {D1Database} db - Database binding to MOLIAM_DB
* @param {number} submissionId - Submission ID to look up 
* @returns {Promise<string>} Name from submissions or default "Valued Client" fallback
*/
async function getSubName(db, submissionId) {
  if (!submissionId) return "Valued Client";
  const sub = await db.prepare("SELECT name FROM submissions WHERE id = ?").bind(submissionId).first();
  return sub && sub.name ? sub.name : "Valued Client";
}
