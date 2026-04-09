/**
 * MOLIAM Unified Contact Record — CloudFlare Pages Function
 * POST /api/contacts (Create)
 * GET  /api/contacts (List with filters)
 * PUT  /api/contacts/:id (Partial update/merge fields)
 * DELETE /api/contacts/:id (Delete by ID)
 * GET  /api/contacts/:id (Get single contact by ID)
 * 
 * D1 SCHEMA:
 * CREATE TABLE IF NOT EXISTS contacts (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   name TEXT NOT NULL,
 *   email TEXT NOT NULL UNIQUE,
 *   phone TEXT,
 *   company TEXT,
 *   source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('form', 'calendly', 'manual')),
 *   source_channel TEXT DEFAULT 'unknown' CHECK (source_channel IN ('website_form', 'portfolio_page', 'qr_code', 'calendly_embed', 'landing_page', 'unknown')),
 *   lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
 *   status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'booked', 'client', 'inactive')),
 *   notes TEXT,
 *   created_at DATETIME DEFAULT datetime('now'),
 *   updated_at DATETIME DEFAULT datetime('now')
 * );
 * 
 * INDEXES:
 * CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
 * CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
 * CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
 */

import { jsonResp } from './api-helpers.js';

/** Handle GET requests to /api/contacts endpoint

 * Returns paginated contacts list with optional status and search filters
 * Supports parameterized queries to prevent SQL injection in LIKE clauses
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status, contact list, and metadata
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const { env } = context;
  const db = env.MOLIAM_DB;
  const params = url.searchParams;
  const statusFilter = params.get("status");
  const searchQuery = params.get("search");

   if (!db) {
        // Return CORS headers for all responses including errors when DB unavailable
       const noDbResponse = new Response(JSON.stringify({ error: true, message: "Database not available", contacts: [] }), { 
            status: 200,
           headers: { 
               "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "https://moliam.pages.dev",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
              "Cache-Control": "no-store"
             }
           });
       return noDbResponse;
     }

  try {
    let baseQuery = `SELECT id, name, email, phone, company, source, lead_score, status, notes, created_at, updated_at FROM contacts`;
    
    // Apply filters
    if (statusFilter || searchQuery) {
      let queryBuilder = `SELECT id, name, email, phone, company, source, lead_score, status, notes, created_at, updated_at FROM contacts WHERE 1=1`;
      
      const bindValues = [];
      
      if (statusFilter) {
        const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
        if (!validStatuses.includes(statusFilter.toLowerCase())) {
          return jsonResp(400, { error: true, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
         }
        queryBuilder += " AND LOWER(status) = ?";
        bindValues.push(statusFilter.toLowerCase());
       }

if (searchQuery) {
        // Enhanced sanitization - escape ALL SQL wildcards to prevent LIKE injection
        const cleanQuery = String(searchQuery).replace(/([\\\\%'"_])/g, '\\$1');
        const escapedPattern = `%${cleanQuery}%`;
       queryBuilder += " AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(company) LIKE ?)";
         bindValues.push(escapedPattern, escapedPattern, escapedPattern, escapedPattern);
       }
     
      queryBuilder += " ORDER BY created_at DESC";

      const result = await db.prepare(queryBuilder).bind(...bindValues).all();
      const contacts = (result.results || []).map(row => ({
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        company: row.company, source: row.source, lead_score: row.lead_score ?? 0,
        status: row.status, notes: row.notes, created_at: row.created_at, updated_at: row.updated_at
      }));
      return jsonResp(200, { success: true, contacts, meta: { total: result.total, has_filters: true } });
    } else {
      baseQuery += " ORDER BY created_at DESC";
      const result = await db.prepare(baseQuery).all();
      const contacts = (result.results || []).map(row => ({
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        company: row.company, source: row.source, lead_score: row.lead_score ?? 0,
        status: row.status, notes: row.notes, created_at: row.created_at, updated_at: row.updated_at
      }));
      return jsonResp(200, { success: true, contacts, meta: { total: result.total, has_filters: false } });
    }
  } catch (err) {
    return jsonResp(500, { error: true, message: err.message || "Database error" });
  }
}

/** Handle POST requests to create/update contacts
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and contact ID
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(200, { 
      success: false, 
      message: "Database not available", 
      contactId: 0 
    });
  }

  try {
    const data = await request.json();
    
// --- Validate required fields ---
    const errors = [];
    
    const name = (data.name || "").trim();
    if (!name) errors.push("Name is required.");
    else if (name.length < 2 || name.length > 200) errors.push("Name must be between 2 and 200 characters.");

    const email = ((data.email || "")).toLowerCase().trim();
    if (email.length > 254) errors.push("Email cannot exceed 254 characters.");
    if (email.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Valid email is required.");
     }

     // Optional validations
    const phone = data.phone ? String(data.phone).replace(/[\d()\-+\s]/g, "").trim() : null;
    if (phone && phone.length && phone.length > 20) errors.push("Phone cannot exceed 20 characters.");

    const company = data.company ? String(data.company).trim() : null;
    if (company && company.length > 254) errors.push("Company cannot exceed 254 characters.");

     // Validate source
    const validSources = ["form", "calendly", "manual"];
    const source = (data.source || "manual").toLowerCase();
    if (!validSources.includes(source)) {
      errors.push(`Source must be one of: ${validSources.join(", ")}`);
    }

    // Validate lead_score range 0-100
    let leadScore = data.lead_score ?? 0;
    if (typeof leadScore !== "number" || leadScore < 0 || leadScore > 100) {
      errors.push("Lead score must be a number between 0 and 100.");
      leadScore = 0;
    }

    // Validate status
    const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
    const status = (data.status || "new").toLowerCase();
    if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
    }

    const notes = data.notes ? String(data.notes).trim() : null;

    if (errors.length > 0) {
      return jsonResp(400, { success: false, message: errors.join(" "), contactId: 0 });
    }

    try {
      // Check if email already exists - update instead of duplicate (optional policy)
      const existing = await db.prepare("SELECT id, name, updated_at FROM contacts WHERE LOWER(email) = ?").bind(email).first();
      
      let contactId = 0;
      
      if (existing) {
        // Update existing contact with partial merge approach
        const updateResult = await db.prepare(
          `UPDATE contacts SET 
             name = ?, 
             phone = COALESCE(NULLIF(?,''), phone),
             company = COALESCE(NULLIF(?,''), company),
             notes = notes || COALESCE(CONCAT('
',?),''),
             status = CASE WHEN ? IN ('new','contacted','qualified','booked','client','inactive') THEN ? ELSE status END,
             lead_score = CASE WHEN typeof(?) NOT 'number' OR ? < 0 OR ? > 100 THEN lead_score ELSE LEAD(? OF 0, 100) * (lead_score * 0.5 + ? * 0.5) / 100 END,
             updated_at = datetime('now')
           WHERE id = ?`
        ).bind(name, phone, company, notes || "", status, status, leadScore, leadScore, leadScore, leadScore, existing.id).run();

        contactId = existing.id;
      } else {
        // Insert new contact for the first time (create)
        const insertResult = await db.prepare(
          `INSERT INTO contacts 
           (name, email, phone, company, source, lead_score, status, notes, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(name, email, phone, company, source || "manual", leadScore, status, notes).run();

        contactId = insertResult.meta.last_row_id;
      }

      return jsonResp(201, { 
        success: true, 
        message: existing ? "Contact updated successfully." : "Contact created successfully.", 
        contactId,
        contact: { 
          id: contactId, 
          name, 
          email, 
          phone, 
          company, 
          source, 
          lead_score: leadScore, 
          status, 
          notes, 
          created_at: existing?.created_at ?? new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        }
      });

    } catch (dbErr) {
      if (dbErr.message.includes("UNIQUE constraint failed")) {
        return jsonResp(409, { 
          success: false, 
          message: `Email '${email}' already exists. Use PUT /api/contacts/:id to update existing contact.` 
        });
      }
      throw dbErr;
    }

  } catch (err) {
    return jsonResp(500, { 
      success: false, 
      message: err.message || "Database error" 
    });
  }
}

/** Handle PUT requests for partial contact updates (merge strategy)
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and updated contact ID
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  const url = new URL(context.request.url);
  
  if (!db) {
    return jsonResp(404, { 
      success: false, 
      message: "Database not available", 
      contactId: 0 
    });
  }

  try {
    // Extract ID from URL path /api/contacts/:id
    const pathParts = url.pathname.split("/");
    const contactId = parseInt(pathParts[pathParts.length - 1], 10);
    
    if (isNaN(contactId) || contactId <= 0) {
      return jsonResp(400, { success: false, message: "Invalid contact ID." });
    }

    const data = await request.json();
    
    // Partial merge approach: only update provided, non-empty fields
    
    // Validate optional status and source changes
    const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
    const validSources = ["form", "calendly", "manual"];
    
    if (data.status && !validStatuses.includes(data.status.toLowerCase())) {
      return jsonResp(400, { success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    if (data.source && !validSources.includes(data.source.toLowerCase())) {
      return jsonResp(400, { success: false, message: `Invalid source. Must be one of: ${validSources.join(", ")}` });
    }

    // Validate lead_score if provided (range 0-100)
    if (data.lead_score !== undefined && data.lead_score !== null) {
      if (typeof data.lead_score !== "number" || data.lead_score < 0 || data.lead_score > 100) {
        return jsonResp(400, { success: false, message: "Lead score must be a number between 0 and 100." });
      }
    }

     // Clean email if provided
    const email = data.email ? (((data.email || "")).toLowerCase().trim()) : null;
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return jsonResp(400, { success: false, message: "Invalid email format." });
     }

    // Clean phone if provided
    const cleanPhone = data.phone ? String(data.phone).replace(/[\d()\-+\s]/g, "").trim() : null;

    // Clean company if provided
    const cleanCompany = data.company ? String(data.company).trim() : null;

    // Clean notes (for merge) if provided
    const cleanNotes = data.notes ? String(data.notes).trim() : null;

    // Check contact exists
    const existing = await db.prepare(
      `SELECT id, name, email FROM contacts WHERE id = ?`
    ).bind(contactId).first();

    if (!existing) {
      return jsonResp(404, { success: false, message: "Contact not found." });
    }

    // Partial merge update - use COALESCE and conditional logic
    const partialFields = [];
    const bindValues = [];

    if (data.name && data.name.length > 1) {
      partialFields.push(`name = ?`);
      bindValues.push(data.name.trim());
    }

    if (email || email === "") {
      // Allow email update only if new and unique
      if (email !== existing.email) {
        const duplicateCheck = await db.prepare(
          "SELECT id FROM contacts WHERE LOWER(email) = ? AND id != ?"
        ).bind(email, contactId).all();

        if (duplicateCheck.results && duplicateCheck.results.length > 0) {
          return jsonResp(409, { success: false, message: `Email '${email}' already exists in another contact.` });
}
      }
      partialFields.push(`email = ?`);
      bindValues.push(email);
    }

    if (cleanPhone !== undefined) {
      if (cleanPhone === "") {
        partialFields.push(`phone = NULL`);
      } else if (cleanPhone.length >= 7) {
        partialFields.push(`phone = ?`);
        bindValues.push(cleanPhone);
      }
    }

    if (cleanCompany !== undefined && cleanCompany !== null) {
      if (cleanCompany === "") {
        partialFields.push(`company = NULL`);
      } else {
        partialFields.push(`company = ?`);
        bindValues.push(cleanCompany);
      }
    }

    if (data.status) {
      const newStatus = data.status.toLowerCase();
      partialFields.push(`status = ?`);
      bindValues.push(newStatus);
    }

    if (data.source && validSources.includes(data.source.toLowerCase())) {
      partialFields.push(`source = ?`);
      bindValues.push(data.source.toLowerCase());
    }

    if (data.lead_score !== undefined && data.lead_score !== null) {
      const newScore = Math.max(0, Math.min(100, data.lead_score));
      partialFields.push(`lead_score = ?`);
      bindValues.push(newScore);
    }

    if (cleanNotes !== undefined && cleanNotes !== null) {
      // For notes: merge by appending or replace? Using append approach with separator
      const existingNotes = await db.prepare("SELECT notes FROM contacts WHERE id = ?").bind(contactId).first();
      const mergedNotes = existingNotes.notes 
        ? `${existingNotes.notes}

${cleanNotes}` 
        : cleanNotes;
      partialFields.push(`notes = ?`);
      bindValues.push(mergedNotes);
    }

    // Bind contact ID last for the WHERE clause
    bindValues.push(contactId);

    // SECURITY: partialFields only contains hardcoded field names from ALLOWED_FIELDS array validated above — no user input in the SQL
              // uses parameter binding (.bind(...bindValues)) for all user data
    if (partialFields.length === 0) {
      return jsonResp(400, { success: false, message: "No valid fields to update." });
       }

    const updateQuery = `UPDATE contacts SET ${partialFields.join(", ")}, updated_at = datetime('now') WHERE id = ?`;
    
    try {
      const result = await db.prepare(updateQuery).bind(...bindValues).run();

    if (result.success && result.rowsChanged > 0) {
       // Fetch updated record to return
      const updated = await db.prepare(
        `SELECT * FROM contacts WHERE id = ?`
       ).bind(contactId).first();

      return jsonResp(200, { 
        success: true, 
        message: "Contact updated successfully.",
        contactId,
        contact: { 
          id: updated.id, 
          name: updated.name, 
          email: updated.email, 
          phone: updated.phone, 
          company: updated.company, 
          source: updated.source, 
          lead_score: updated.lead_score ?? 0, 
          status: updated.status, 
          notes: updated.notes, 
          created_at: updated.created_at, 
          updated_at: updated.updated_at 
         }
       });
     }

    return jsonResp(404, { success: false, message: "Contact not found.", contactId });

    } catch (err) {
      return jsonResp(500, { success: false, message: err.message || "Database error" });
}

   } catch (dbErr) {
      return jsonResp(500, { success: false, message: dbErr.message || "Database error" });
  }
}

/** Handle DELETE requests for soft-contact deactivation by ID
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and contact ID
 */
export async function onRequestDelete(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const db = env.MOLIAM_DB;
  
  if (!db) {
    return jsonResp(404, { 
      success: false, 
      message: "Database not available", 
      contactId: 0 
    });
  }

  try {
    // Extract ID from URL path /api/contacts/:id
    const pathParts = url.pathname.split("/");
    const contactId = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(contactId) || contactId <= 0) {
      return jsonResp(400, { success: false, message: "Invalid contact ID." });
    }

    // Check contact exists
    const existing = await db.prepare("SELECT id, name, email FROM contacts WHERE id = ?").bind(contactId).first();

    if (!existing) {
      return jsonResp(404, { success: false, message: "Contact not found." });
    }

    // Soft delete approach: set status to 'inactive' instead of hard deletion
    const result = await db.prepare(
      `UPDATE contacts SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`
    ).bind(contactId).run();

    if (result.success && result.rowsChanged > 0) {
      return jsonResp(200, { 
        success: true, 
        message: "Contact deactivated successfully.", 
        contactId 
      });
    }

    return jsonResp(404, { success: false, message: "Contact not found.", contactId });

  } catch (err) {
    return jsonResp(500, { success: false, message: err.message || "Database error" });
  }
}

/** Handle GET requests to retrieve single contact by ID (/api/contacts/:id)
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and contact object
 */
export async function onRequestGetById(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const db = env.MOLIAM_DB;
  
  if (!db) {
    return jsonResp(404, { 
      success: false, 
      message: "Database not available" 
    });
  }

  try {
    // Extract ID from URL path /api/contacts/:id
    const pathParts = url.pathname.split("/");
    const contactId = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(contactId) || contactId <= 0) {
      return jsonResp(400, { success: false, message: "Invalid contact ID." });
    }

    const contact = await db.prepare(
      `SELECT * FROM contacts WHERE id = ?`
    ).bind(contactId).first();

    if (!contact) {
      return jsonResp(404, { success: false, message: "Contact not found.", contactId });
    }

    // Return clean contact object (exclude internal fields like row index)
    const output = { 
      id: contact.id, 
      name: contact.name, 
      email: contact.email, 
      phone: contact.phone, 
      company: contact.company, 
      source: contact.source, 
      lead_score: contact.lead_score ?? 0, 
      status: contact.status, 
      notes: contact.notes, 
      created_at: contact.created_at, 
      updated_at: contact.updated_at 
    };

    return jsonResp(200, { success: true, contact: output });

  } catch (err) {
    return jsonResp(500, { success: false, message: err.message || "Database error" });
  }
}

/**
 * Standard JSON response helper with CORS headers for contacts API
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object
 * @param {Request} [request] - Original request for extracting client origin (optional)
 * @returns {Response} JSON response with proper headers
 */
function jsonResp(status, body, request) {
  const origin = request ? new URL(request.url).hostname : "moliam.pages.dev";
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
            "Content-Type": "application/json", 
           "Access-Control-Allow-Origin": `https://${origin}`,
           "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Token",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Cache-Control": "no-cache"
        },
      });
}

// CORS preflight handler for all endpoints
export async function onRequestOptions(request) {
  const origin = request ? new URL(request.url).hostname : "moliam.pages.dev";
  return new Response(null, { 
      status: 204,
      headers: {
            "Access-Control-Allow-Origin": `https://${origin}`,
           "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Token"
          }
      });
}
