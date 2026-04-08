/**
 * Pre-Qualification System — CloudFlare Pages Function
 * GET /api/prequalify - Get qualification form
 * POST /api/prequalify - Submit pre-qualification data
 * 
 * Filters leads based on:
 * - Budget threshold (minimum $2k)
 * - Timeline urgency (immediate or within 30 days preferred)
 * - Industry fit
 * - Qualification score calculation
 */

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    success: true,
    form_url: "/booking/prequalify.html",
    criteria: {
      min_budget: 2000,
      preferred_timeline: ["immediate", "within_week", "next_month"],
      support_industries: ["real_estate", "financial_services", "healthcare", "retail"]
    }
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.MOLIAM_DB;

  let data;
  try {
    data = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: true, message: "Invalid JSON" }), { status: 400 });
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
  
  // Budget validation
  if (!budget_range || budget_range === 'unknown') {
    errors.push("Budget range required");
  } else if (max_budget && max_budget < 2000) {
    errors.push("Minimum project budget is $2,000. Please adjust your requirements.");
  }

  // Industry validation - can continue even if not supported, but will score lower
  if (!primary_industry || primary_industry === 'unknown') {
    errors.push("Primary industry required");
  }

  if (errors.length) {
    return new Response(JSON.stringify({ error: true, message: "Validation failed", errors }), { status: 400 });
  }

  // Calculate qualification score (0-100)
  let score = 50; // Base start
  const factors = {
   // Budget scoring (50 points max)
    budget: () => {
      if (max_budget >= 10000) return 50;
      if (max_budget >= 5000) return 40;
      if (max_budget >= 3000) return 30;
      if (budget_range === 'under_1k') return 20;
      if (max_budget && max_budget < 2000) return 15;
      return 10;
    },
    
   // Urgency scoring (30 points max)
    urgency: () => {
      if (timeline_urgency === 'immediate') return 30;
      if (timeline_urgency === 'within_week') return 25;
      if (timeline_urgency === 'next_month') return 20;
      if (timeline_urgency === 'flexible') return 10;
      return 10;
    },
    
   // Industry fit (20 points max) - support vs non-support industries
    industry: () => {
      const supported = ['real_estate', 'financial_services', 'healthcare', 'retail', 'technology'];
      if (supported.includes(primary_industry)) return 15;
      return 10;
    },
    
   // Pain points depth - the more detailed, the better score
    details: () => {
      const painPoints = (pain_points || '').toLowerCase();
      if (painPoints.length > 200) return 20;
      if (painPoints.length > 100) return 15;
      if (painPoints.length > 50) return 10;
      return 5;
    }
  };

  score = Math.min(100, score + factors.budget() + factors.urgency() + factors.industry() + factors.details());

  let calendarAccessGranted = 0;
  
  // Auto-approve if score >= 60 and budget >= min threshold
  if (score >= 60 && (!max_budget || max_budget >= 2000)) {
    calendarAccessGranted = 1;
  }

  try {
    const res = await db.prepare(`
      INSERT INTO prequalifications 
      (submission_id, budget_range, max_budget, timeline_urgency, project_start_date, 
       primary_industry, current_stack, pain_points, qualification_score, calendar_access_granted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      submission_id || null,
      budget_range || 'unknown',
      max_budget || null,
      timeline_urgency || 'flexible',
      project_start_date || null,
      primary_industry || 'unknown',
      current_stack || '',
      pain_points || '',
      score,
      calendarAccessGranted
    ).run();

    const prequalId = res.meta.last_row_id;

    // If qualified, insert into appointments table with auto-generated booking
    if (calendarAccessGranted && submission_id) {
      await generateBooking(context, prequalId);
    }

return new Response(JSON.stringify({ 
      success: true, 
      message: calendarAccessGranted ? "✓ You're qualified! Click the link below to book." : "Thanks for your response. We'll review and get back to you.",
      score,
      calendar_access_granted: calendarAccessGranted,
      next_step: calendarAccessGranted ? 'booking' : 'review',
      cors_info: { origin: context.request.headers.get('Origin') || "*" } // Log CORS origin for debugging
     }), { 
           status: 200,
           headers: {  
                 "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                 "Access-Control-Allow-Methods": "POST, OPTIONS",
                 "Access-Control-Allow-Headers": "Content-Type",
                  "Cache-Control": "no-cache" 
                       }
         });

  } catch (err) {
    console.error("Pre-qualify error:", err);
    return new Response(JSON.stringify({ error: true, message: "Something went wrong" }), { status: 500 });
  }
}

/** Auto-generate booking link for qualified leads */
async function generateBooking(context, prequalId) {
  const db = context.env.MOLIAM_DB;
  
   // Generate unique booking reference
  const bookingRef = 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // For Cal.com integration - generate personalized calendar link
  // You can customize this based on your Calendly/Cal.com setup
  const calLinkBase = "https://calendly.com/visualark/discovery-call";
  const personalizedLink = `${calLinkBase}?prequal=${bookingRef}`;

   // Get prequalification data for context
  const prequal = await db.prepare(`SELECT * FROM prequalifications WHERE id = ?`).bind(prequalId).first();
  
  if (prequal) {
    // Insert booking record
    const now = new Date().toISOString();
    await db.prepare(
      "INSERT INTO appointments (prequalification_id, calendar_link, status, scheduled_with) VALUES (?, ?, 'pending', ?)"
    ).bind(prequalId, personalizedLink, context.env.ADMIN_EMAIL || "hello@moliam.com").run();

    // Send booking confirmation email to lead
    await sendBookingConfirmationEmail(context, prequal, personalizedLink);
    
    // Auto-schedule initial demo slot (30-day window from today)
    const baseDate = new Date();
    const targetDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
    
   console.log(`Auto-generated booking #${bookingRef} for qualified lead: ${prequal.id}`);
    return { booking_ref: bookingRef, calendar_link: personalizedLink };
  }

  return null;
}

/** API Helpers import */
import { jsonResp, balanceSuccessError, validateRequired } from '../lib/api-helpers.js';

// Send booking confirmation to qualified leads
async function sendBookingConfirmationEmail(context, prequal, calendarLink) {
  try {
    const db = context.env.MOLIAM_DB;
    const env = context.env;
    const email = prequal.submission_id ? await getSubEmail(db, prequal.submission_id) : null;
    const name = prequal.submission_id ? await getSubName(db, prequal.submission_id) : 'Valued Client';

    const subject = "🎉 You're Qualified! Book Your Discovery Call Now";
    
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
             <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
               <h2 style="color:#10B981;">✓ You're Qualified for Priority Access!</h2>
               <p>Hi ${name},</p>
               
               <p>Thanks for being honest about your project needs. Based on what you shared, you meet our qualification criteria and we'd love to work with you.</p>
               
               <div style="background:#F0FDF4;border:2px solid #10B981;border-radius:12px;padding:24px;margin:24px 0">
                 <h3 style="color:#065F46;margin-top:0;">📅 Book Your Free Discovery Call</h3>
                 <p style="font-size:14px;color:#1f2937">This 30-minute call will cover:</p>
                 <ul style="margin:8px 0;padding-left:20px">
                   <li>Your current challenges and pain points</li>
                   <li>Our solution approach for your specific needs</li>
                   <li>Timeline and budget alignment discussion</li>
                   <li>No-obligation next steps</li>
                 </ul>
                 
                 <a href="${calendarLink}" style="display:inline-block;background:#10B981;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
                  Select Your Time Slot →
                 </a>
               </div>
               
               <p style="font-size:13px;color:#6B7280;margin-top:24px;">What happens if you're not available yet?</p>
               <p style="font-size:13px;color:#6B7280">No worries! The link above will stay active for 14 days. After that, we'll reach out to reschedule or follow up.</p>
               
               <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
               <p style="color:#9CA3AF;font-size:13px;text-align:center">Moliam — AI-Powered Operations for Modern Agencies<br>Santa Ana, CA</p>
             </div>`
        }],
      }),
    });

    // Send notification to Ada
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.ADMIN_EMAIL || "hello@moliam.com" }] }],
        from: { email: "noreply@moliam.com", name: "Booking System" },
        subject: `🎯 Qualified Lead Booked - ${name}`,
        content: [{
          type: "text/html",
          value: `<p>New booking from qualified lead:<br>Name: ${name}<br>Score: <b>${prequal.qualification_score}</b>/100<br>Calendar link sent to client.`
        }]
      })
    });

  } catch (e) {
    console.error("Email error:", e);
  }
}

async function getSubEmail(db, submissionId) {
  if (!submissionId) return null;
  const sub = await db.prepare("SELECT email FROM submissions WHERE id = ?").bind(submissionId).first();
  return sub ? sub.email : null;
}

async function getSubName(db, submissionId) {
  if (!submissionId) return "Valued Client";
  const sub = await db.prepare("SELECT name FROM submissions WHERE id = ?").bind(submissionId).first();
  return sub ? sub.name : "Valued Client";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
