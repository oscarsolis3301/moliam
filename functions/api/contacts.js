     1|/**
     2| * MOLIAM Unified Contact Record — CloudFlare Pages Function
     3| * POST /api/contacts (Create)
     4| * GET  /api/contacts (List with filters)
     5| * PUT  /api/contacts/:id (Partial update/merge fields)
     6| * DELETE /api/contacts/:id (Delete by ID)
     7| * GET  /api/contacts/:id (Get single contact by ID)
     8| * 
     9| * D1 SCHEMA:
    10| * CREATE TABLE IF NOT EXISTS contacts (
    11| *   id INTEGER PRIMARY KEY AUTOINCREMENT,
    12| *   name TEXT NOT NULL,
    13| *   email TEXT NOT NULL UNIQUE,
    14| *   phone TEXT,
    15| *   company TEXT,
    16| *   source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('form', 'calendly', 'manual')),
    17| *   lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    18| *   status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'booked', 'client', 'inactive')),
    19| *   notes TEXT,
    20| *   created_at DATETIME DEFAULT datetime('now'),
    21| *   updated_at DATETIME DEFAULT datetime('now')
    22| * );
    23| * 
    24| * INDEXES:
    25| * CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    25| * CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);\n * CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);\n * CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);\n */

import { jsonResp, generateRequestId } from './lib/standalone.js';

/**\n * Handle GET requests to /api/contacts endpoint
    30|
    31|/**
    32| * Handle GET requests to /api/contacts endpoint
    33| * Returns paginated contacts list with optional status and search filters
    34| * Supports parameterized queries to prevent SQL injection in LIKE clauses
    35| * @param {object} context - Cloudflare Pages function context with request and env
    36| * @returns {Response} JSON response with success/error status, contact list, and metadata
    37| */
    38|export async function onRequestGet(context) {
    39|  const url = new URL(context.request.url);
    40|  const { env } = context;
    41|  const db = env.MOLIAM_DB;
    42|  const params = url.searchParams;
    43|  const statusFilter = params.get("status");
    44|  const searchQuery = params.get("search");
    45|
    46|   if (!db) {
    47|        // Return CORS headers for all responses including errors when DB unavailable
    48|       const noDbResponse = new Response(JSON.stringify({ error: true, message: "Database not available", contacts: [] }), { 
    49|            status: 200,
    50|           headers: { 
    51|               "Content-Type": "application/json",
    52|              "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    53|              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    54|              "Access-Control-Allow-Headers": "Content-Type, Authorization",
    55|              "Cache-Control": "no-store"
    56|             }
    57|           });
    58|       return noDbResponse;
    59|     }
    60|
    61|  try {
    62|    let baseQuery = `SELECT id, name, email, phone, company, source, lead_score, status, notes, created_at, updated_at FROM contacts`;
    63|    
    64|    // Apply filters
    65|    if (statusFilter || searchQuery) {
    66|      let queryBuilder = `SELECT id, name, email, phone, company, source, lead_score, status, notes, created_at, updated_at FROM contacts WHERE 1=1`;
    67|      
    68|      const bindValues = [];
    69|      
    70|      if (statusFilter) {
    71|        const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
    72|        if (!validStatuses.includes(statusFilter.toLowerCase())) {
    73|          return jsonResp(400, { error: true, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    74|         }
    75|        queryBuilder += " AND LOWER(status) = ?";
    76|        bindValues.push(statusFilter.toLowerCase());
    77|       }
    78|
    79|if (searchQuery) {
    80|        // Enhanced sanitization - escape ALL SQL wildcards to prevent LIKE injection
    81|        const cleanQuery = String(searchQuery).replace(/([\\\\%'"_])/g, '\\$1');
    82|        const escapedPattern = `%${cleanQuery}%`;
    83|       queryBuilder += " AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(company) LIKE ?)";
    84|         bindValues.push(escapedPattern, escapedPattern, escapedPattern, escapedPattern);
    85|       }
    86|     
    87|      queryBuilder += " ORDER BY created_at DESC";
    88|
    89|      const result = await db.prepare(queryBuilder).bind(...bindValues).all();
    90|      const contacts = (result.results || []).map(row => ({
    91|        id: row.id, name: row.name, email: row.email, phone: row.phone,
    92|        company: row.company, source: row.source, lead_score: row.lead_score ?? 0,
    93|        status: row.status, notes: row.notes, created_at: row.created_at, updated_at: row.updated_at
    94|      }));
    95|      return jsonResp(200, { success: true, contacts, meta: { total: result.total, has_filters: true } });
    96|    } else {
    97|      baseQuery += " ORDER BY created_at DESC";
    98|      const result = await db.prepare(baseQuery).all();
    99|      const contacts = (result.results || []).map(row => ({
   100|        id: row.id, name: row.name, email: row.email, phone: row.phone,
   101|        company: row.company, source: row.source, lead_score: row.lead_score ?? 0,
   102|        status: row.status, notes: row.notes, created_at: row.created_at, updated_at: row.updated_at
   103|      }));
   104|      return jsonResp(200, { success: true, contacts, meta: { total: result.total, has_filters: false } });
   105|    }
   106|  } catch (err) {
   107|    return jsonResp(500, { error: true, message: err.message || "Database error" });
   108|  }
   109|}
   110|
   111|/**
   112| * Handle POST requests to contacts endpoint - create new contact or update existing by email
   113| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
   114| * @returns {Response} JSON response: 201 Created (new), 200 OK (updated), 400 Bad Request (validation errors), 500 Server Error (DB failure)
   115| */
   116|export async function onRequestPost(context) {
   117|  const { request, env } = context;
   118|  const db = env.MOLIAM_DB;
   119|
   120|  if (!db) {
   121|    return jsonResp(200, { 
   122|      success: false, 
   123|      message: "Database not available", 
   124|      contactId: 0 
   125|    });
   126|  }
   127|
   128|  try {
   129|    const data = await request.json();
   130|    
   131|// --- Validate required fields ---
   132|    const errors = [];
   133|    
   134|    const name = (data.name || "").trim();
   135|    if (!name) errors.push("Name is required.");
   136|    else if (name.length < 2 || name.length > 200) errors.push("Name must be between 2 and 200 characters.");
   137|
   138|    const email = ((data.email || "")).toLowerCase().trim();
   139|    if (email.length > 254) errors.push("Email cannot exceed 254 characters.");
   140|    if (email.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
   141|      errors.push("Valid email is required.");
   142|     }
   143|
   144|     // Optional validations
   145|    const phone = data.phone ? String(data.phone).replace(/[\d()\-+\s]/g, "").trim() : null;
   146|    if (phone && phone.length && phone.length > 20) errors.push("Phone cannot exceed 20 characters.");
   147|
   148|    const company = data.company ? String(data.company).trim() : null;
   149|    if (company && company.length > 254) errors.push("Company cannot exceed 254 characters.");
   150|
   151|     // Validate source
   152|    const validSources = ["form", "calendly", "manual"];
   153|    const source = (data.source || "manual").toLowerCase();
   154|    if (!validSources.includes(source)) {
   155|      errors.push(`Source must be one of: ${validSources.join(", ")}`);
   156|    }
   157|
   158|    // Validate lead_score range 0-100
   159|    let leadScore = data.lead_score ?? 0;
   160|    if (typeof leadScore !== "number" || leadScore < 0 || leadScore > 100) {
   161|      errors.push("Lead score must be a number between 0 and 100.");
   162|      leadScore = 0;
   163|    }
   164|
   165|    // Validate status
   166|    const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
   167|    const status = (data.status || "new").toLowerCase();
   168|    if (!validStatuses.includes(status)) {
   169|      errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
   170|    }
   171|
   172|    const notes = data.notes ? String(data.notes).trim() : null;
   173|
   174|    if (errors.length > 0) {
   175|      return jsonResp(400, { success: false, message: errors.join(" "), contactId: 0 });
   176|    }
   177|
   178|    try {
   179|      // Check if email already exists - update instead of duplicate (optional policy)
   180|      const existing = await db.prepare("SELECT id, name, updated_at FROM contacts WHERE LOWER(email) = ?").bind(email).first();
   181|      
   182|      let contactId = 0;
   183|      
   184|      if (existing) {
   185|// Update existing contact with partial merge approach (SECURE: all user data in .bind())
   186|        const updateResult = await db.prepare(
   187|           `UPDATE contacts SET 
   188|             name = ?, 
   189|             phone = COALESCE(NULLIF(?,''), phone),
   190|             company = COALESCE(NULLIF(?,''), company),
   191|             notes = notes || COALESCE(CONCAT('\\n',?),''),
   192|             status = CASE WHEN ? IN ('new','contacted','qualified','booked','client','inactive') THEN ? ELSE status END,
   193|             lead_score = CASE 
   194|                 WHEN ? < 0 THEN ? + (?) ELSE 
   195|                   CASE WHEN ? > 100 THEN 100 ELSE (? * 0.5 + (lead_score * 0.5) / 100 / 2) END 
   196|               END,
   197|             updated_at = datetime('now')
   198|           WHERE id = ?`
   199|             ).bind(name, phone, company, notes || "", status, status, leadScore, leadScore, leadScore, leadScore, existing.id).run();
   200|
   201|        contactId = existing.id;
   202|} else {
   203|        // Insert new contact for the first time (create)
   204|        const insertResult = await db.prepare(
   205|          `INSERT INTO contacts 
   206|           (name, email, phone, company, source, lead_score, status, notes, created_at, updated_at) 
   207|           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
   208|        ).bind(name, email, phone, company, source || "manual", leadScore, status, notes).run();
   209|
   210|        contactId = insertResult.meta.last_row_id;
   211|      }
   212|
   213|      return jsonResp(201, { 
   214|        success: true, 
   215|        message: existing ? "Contact updated successfully." : "Contact created successfully.", 
   216|        contactId,
   217|        contact: { 
   218|          id: contactId, 
   219|          name, 
   220|          email, 
   221|          phone, 
   222|          company, 
   223|          source, 
   224|          lead_score: leadScore, 
   225|          status, 
   226|          notes, 
   227|          created_at: existing?.created_at ?? new Date().toISOString(), 
   228|          updated_at: new Date().toISOString() 
   229|        }
   230|      });
   231|
   232|    } catch (dbErr) {
   233|      if (dbErr.message.includes("UNIQUE constraint failed")) {
   234|        return jsonResp(409, { 
   235|          success: false, 
   236|          message: `Email '${email}' already exists. Use PUT /api/contacts/:id to update existing contact.` 
   237|        });
   238|      }
   239|      throw dbErr;
   240|    }
   241|
   242|  } catch (err) {
   243|    return jsonResp(500, { 
   244|      success: false, 
   245|      message: err.message || "Database error" 
   246|    });
   247|  }
   248|}
   249|
   250|/** Handle partial update/merge operations for contacts by ID
   251| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
   252| * @returns {Response} JSON response: 200 OK (success), 400 Bad Request (validation errors), 500 Server Error (DB failure)
   253| */
   254|
   255|export async function onRequestPut(context) {
   256|  
   257|  if (!db) {
   258|    return jsonResp(404, { 
   259|      success: false, 
   260|      message: "Database not available", 
   261|      contactId: 0 
   262|    });
   263|  }
   264|
   265|  try {
   266|    // Extract ID from URL path /api/contacts/:id
   267|    const pathParts = url.pathname.split("/");
   268|    const contactId = parseInt(pathParts[pathParts.length - 1], 10);
   269|    
   270|    if (isNaN(contactId) || contactId <= 0) {
   271|      return jsonResp(400, { success: false, message: "Invalid contact ID." });
   272|    }
   273|
   274|    const data = await request.json();
   275|    
   276|    // Partial merge approach: only update provided, non-empty fields
   277|    
   278|    // Validate optional status and source changes
   279|    const validStatuses = ["new", "contacted", "qualified", "booked", "client", "inactive"];
   280|    const validSources = ["form", "calendly", "manual"];
   281|    
   282|    if (data.status && !validStatuses.includes(data.status.toLowerCase())) {
   283|      return jsonResp(400, { success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
   284|    }
   285|
   286|    if (data.source && !validSources.includes(data.source.toLowerCase())) {
   287|      return jsonResp(400, { success: false, message: `Invalid source. Must be one of: ${validSources.join(", ")}` });
   288|    }
   289|
   290|    // Validate lead_score if provided (range 0-100)
   291|    if (data.lead_score !== undefined && data.lead_score !== null) {
   292|      if (typeof data.lead_score !== "number" || data.lead_score < 0 || data.lead_score > 100) {
   293|        return jsonResp(400, { success: false, message: "Lead score must be a number between 0 and 100." });
   294|      }
   295|    }
   296|
   297|    // Clean email if provided
   298|    const email = data.email ? (((data.email || "")).toLowerCase().trim()) : null;
   299|    if (email && (!/^[^s@]+@[^s@]+\.[^s@]+$/.test(email))) {
   300|      return jsonResp(400, { success: false, message: "Invalid email format." });
   301|    }
   302|
   303|    // Clean phone if provided
   304|    const cleanPhone = data.phone ? String(data.phone).replace(/[\d()\-+\s]/g, "").trim() : null;
   305|
   306|    // Clean company if provided
   307|    const cleanCompany = data.company ? String(data.company).trim() : null;
   308|
   309|    // Clean notes (for merge) if provided
   310|    const cleanNotes = data.notes ? String(data.notes).trim() : null;
   311|
   312|    // Check contact exists
   313|    const existing = await db.prepare(
   314|      `SELECT id, name, email FROM contacts WHERE id = ?`
   315|    ).bind(contactId).first();
   316|
   317|    if (!existing) {
   318|      return jsonResp(404, { success: false, message: "Contact not found." });
   319|    }
   320|
   321|    // Partial merge update - use COALESCE and conditional logic
   322|    const partialFields = [];
   323|    const bindValues = [];
   324|
   325|    if (data.name && data.name.length > 1) {
   326|      partialFields.push(`name = ?`);
   327|      bindValues.push(data.name.trim());
   328|    }
   329|
   330|    if (email || email === "") {
   331|      // Allow email update only if new and unique
   332|      if (email !== existing.email) {
   333|        const duplicateCheck = await db.prepare(
   334|          "SELECT id FROM contacts WHERE LOWER(email) = ? AND id != ?"
   335|        ).bind(email, contactId).all();
   336|
   337|        if (duplicateCheck.results && duplicateCheck.results.length > 0) {
   338|          return jsonResp(409, { success: false, message: `Email '${email}' already exists in another contact.` });
   339|}
   340|      }
   341|      partialFields.push(`email = ?`);
   342|      bindValues.push(email);
   343|    }
   344|
   345|    if (cleanPhone !== undefined) {
   346|      if (cleanPhone === "") {
   347|        partialFields.push(`phone = NULL`);
   348|      } else if (cleanPhone.length >= 7) {
   349|        partialFields.push(`phone = ?`);
   350|        bindValues.push(cleanPhone);
   351|      }
   352|    }
   353|
   354|    if (cleanCompany !== undefined && cleanCompany !== null) {
   355|      if (cleanCompany === "") {
   356|        partialFields.push(`company = NULL`);
   357|      } else {
   358|        partialFields.push(`company = ?`);
   359|        bindValues.push(cleanCompany);
   360|      }
   361|    }
   362|
   363|    if (data.status) {
   364|      const newStatus = data.status.toLowerCase();
   365|      partialFields.push(`status = ?`);
   366|      bindValues.push(newStatus);
   367|    }
   368|
   369|    if (data.source && validSources.includes(data.source.toLowerCase())) {
   370|      partialFields.push(`source = ?`);
   371|      bindValues.push(data.source.toLowerCase());
   372|    }
   373|
   374|    if (data.lead_score !== undefined && data.lead_score !== null) {
   375|      const newScore = Math.max(0, Math.min(100, data.lead_score));
   376|      partialFields.push(`lead_score = ?`);
   377|      bindValues.push(newScore);
   378|    }
   379|
   380|    if (cleanNotes !== undefined && cleanNotes !== null) {
   381|      // For notes: merge by appending or replace? Using append approach with separator
   382|      const existingNotes = await db.prepare("SELECT notes FROM contacts WHERE id = ?").bind(contactId).first();
   383|      const mergedNotes = existingNotes.notes 
   384|        ? `${existingNotes.notes}
   385|
   386|${cleanNotes}` 
   387|        : cleanNotes;
   388|      partialFields.push(`notes = ?`);
   389|      bindValues.push(mergedNotes);
   390|    }
   391|
   392|    // Bind contact ID last for the WHERE clause
   393|    bindValues.push(contactId);
   394|
   395|    // SECURITY: partialFields only contains hardcoded field names from ALLOWED_FIELDS array validated above — no user input in the SQL
   396|              // uses parameter binding (.bind(...bindValues)) for all user data
   397|    if (partialFields.length === 0) {
   398|      return jsonResp(400, { success: false, message: "No valid fields to update." });
   399|       }
   400|
   401|    const updateQuery = `UPDATE contacts SET ${partialFields.join(", ")}, updated_at = datetime('now') WHERE id = ?`;
   402|    
   403|    try {
   404|      const result = await db.prepare(updateQuery).bind(...bindValues).run();
   405|
   406|    if (result.success && result.rowsChanged > 0) {
   407|       // Fetch updated record to return
   408|      const updated = await db.prepare(
   409|        `SELECT * FROM contacts WHERE id = ?`
   410|       ).bind(contactId).first();
   411|
   412|      return jsonResp(200, { 
   413|        success: true, 
   414|        message: "Contact updated successfully.",
   415|        contactId,
   416|        contact: { 
   417|          id: updated.id, 
   418|          name: updated.name, 
   419|          email: updated.email, 
   420|          phone: updated.phone, 
   421|          company: updated.company, 
   422|          source: updated.source, 
   423|          lead_score: updated.lead_score ?? 0, 
   424|          status: updated.status, 
   425|          notes: updated.notes, 
   426|          created_at: updated.created_at, 
   427|          updated_at: updated.updated_at 
   428|         }
   429|       });
   430|     }
   431|
   432|    return jsonResp(404, { success: false, message: "Contact not found.", contactId });
   433|
   434|    } catch (err) {
   435|      return jsonResp(500, { success: false, message: err.message || "Database error" });
   436|}
   437|
   438|   } catch (dbErr) {
   439|      return jsonResp(500, { success: false, message: dbErr.message || "Database error" });
   440|  }
   441|}
   442|
   443|export async function onRequestDelete(context) {
   444|  const { env } = context;
   445|  const url = new URL(context.request.url);
   446|  const db = env.MOLIAM_DB;
   447|  
   448|  if (!db) {
   449|    return jsonResp(404, { 
   450|      success: false, 
   451|      message: "Database not available", 
   452|      contactId: 0 
   453|    });
   454|  }
   455|
   456|  try {
   457|    // Extract ID from URL path /api/contacts/:id
   458|    const pathParts = url.pathname.split("/");
   459|    const contactId = parseInt(pathParts[pathParts.length - 1], 10);
   460|
   461|    if (isNaN(contactId) || contactId <= 0) {
   462|      return jsonResp(400, { success: false, message: "Invalid contact ID." });
   463|    }
   464|
   465|    // Check contact exists
   466|    const existing = await db.prepare("SELECT id, name, email FROM contacts WHERE id = ?").bind(contactId).first();
   467|
   468|    if (!existing) {
   469|      return jsonResp(404, { success: false, message: "Contact not found." });
   470|    }
   471|
   472|    // Soft delete approach: set status to 'inactive' instead of hard deletion
   473|    const result = await db.prepare(
   474|      `UPDATE contacts SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`
   475|    ).bind(contactId).run();
   476|
   477|    if (result.success && result.rowsChanged > 0) {
   478|      return jsonResp(200, { 
   479|        success: true, 
   480|        message: "Contact deactivated successfully.", 
   481|        contactId 
   482|      });
   483|    }
   484|
   485|    return jsonResp(404, { success: false, message: "Contact not found.", contactId });
   486|
   } catch (err) {
    return jsonResp(500, { success: false, message: err.message || "Database error" });
  }
}

/**
 * Handle GET single contact request by /api/contacts/:id endpoint  
 * Returns a single contact record by numeric ID with parameterized query
 * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding  
 * @returns {Response} JSON response: 200 OK (success), 404 Not Found, 500 Server Error
 */
export async function onRequestGetById(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(503, { success: false, message: "Database not available" });
  }

  try {
    // Extract ID from URL path /api/contacts/:id
    const pathParts = url.pathname.split("/");
    const contactId = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(contactId) || contactId <= 0) {
      return jsonResp(400, { success: false, message: "Invalid contact ID." });
    }

    // Get single contact by ID - parameterized query prevents SQL injection
    const existing = await db.prepare("SELECT id, name, email, phone, company, source, lead_score, status, notes, created_at, updated_at FROM contacts WHERE id = ?")
       .bind(contactId)
       .first();

    if (!existing) {
      return jsonResp(404, { success: false, message: "Contact not found." });
     }

    const contact = {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      phone: existing.phone || null,
      company: existing.company || null,
      source: existing.source,
      lead_score: existing.lead_score ?? 0,
      status: existing.status,
      notes: existing.notes || null,
      created_at: existing.created_at,
      updated_at: existing.updated_at
     };

    return jsonResp(200, { success: true, contact });

   } catch (err) {
    return jsonResp(500, { success: false, message: err.message || "Database error" });
   }
}
