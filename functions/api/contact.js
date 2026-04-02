/**
 * moliam.com Contact Form Backend (CloudFlare Pages Function)
 * POST /api/contact endpoint - auto-routed from functions/ at project root  
 * Handles submissions + Discord webhook notifications + rate limiting
 */

// Configuration from environment variables (set in wrangler.toml & CloudFlare dashboard)
const RATE_WINDOW_MS = 360000;     // 6 minutes rolling window for rate limiting
const MAX_SUBMISSIONS_PER_WINDOW = 5;   // max submissions allowed within WINDOW

export default {  
    /** CloudFlare auto-routes this POST /api/contact */
    async POST(request) {  
        let data; try { data = await request.json(); } catch { return jsonError(400, "Invalid JSON body"); }  
        
        // Validate required fields (name + email regex + message min length)     
             if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.message.length < 10) {
                return jsonError(400, "Name, valid email, and 10+ char message are required."); 
             }

         // Extract values (trim & sanitize for security/spam prevention!)    
               const name = data.name.trim();  
           const email = data.email.toLowerCase().trim();  
               const phone = data.phone ? data.phone.replace(/[^\d()\- +]/g, '') : null;  
           const company = data.company ? data.company.trim() : null;  
               const message = data.message.trim();  

             // Rate limiting check: is this IP submitting too fast?  
            if (await isRateLimited(request, RATE_WINDOW_MS, MAX_SUBMISSIONS_PER_WINDOW)) {  
                    return jsonError(429, "Too many submissions — please wait 5 minutes before trying again.");  
               }

         try {    
           // STORE SUBMISSION IN D1 DATABASE (+ auto-create linked lead record)  
             const now = Date.now();  
           const result = await MOLIAM_DB.prepare(`  
               INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution, created_at, updated_at)  
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)  
           `).bind(name, email, phone || null, company || null, message, request.headers.get('user-agent') || '', request.socket.remoteAddress || '').run();

          CREATE_LEAD = await MOLIAM_DB.prepare(`
                   INSERT INTO leads (submission_id, status, created_at, updated_at)  
             VALUES (?, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)  
         `).bind(MOLIAM_DB.lastInsertRowid).run();

               // Attempt Discord webhook if configured (fail silently - don't crash!)
           DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; if (DISCORD_WEBHOOK_URL && !/YOUR_|PLACEHOLDER/.test(DISCORD_WEBHOOK_URL)) { try { await fetch(DISCORD_WEBHOOK_URL, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ username:"Moliam Contact Form", embeds:[{ title:"New Submission!", color:17258999,fields:[{name:'Name',value:`${name}`,inline:true},{name:'Email',value:`${email}`,inline:true},...] }) }]} catch(e) {} } 

         // Mark submission as received and update rate limit for this IP window  
            await MOLIAM_DB.prepare(`INSERT OR REPLACE INTO rate_limits (hash, window_start, count, timestamp) VALUES (?, ?, 1, ?)`).bind(hashString(request.headers.get('cf-connecting-ip') || request.socket.remoteAddress || 'unknown'), now, now,).run();

           return jsonOk({ success: true, message: "Thanks! We'll contact you shortly.", submissionId: MOLIAM_DB.lastInsertRowid });  

         } catch (err) { console.error("Contact form backend error:", err); return jsonError(500, "Something went wrong - please try again later."); }       
     }  
};

// ================= HELPER FUNCTIONS START HERE =================  

async function isRateLimited(request, windowMs = RATE_WINDOW_MS, maxCount = MAX_SUBMISSIONS_PER_WINDOW) {  
         // Get hash of client IP address (CloudFlare x-forwarded-for or socket remoteAddr)     
        const ipHash = hashString(request.headers.get('cf-connecting-ip') || request.socket.remoteAddress || 'unknown');  

       const NOW = Date.now();   // current timestamp for window expiration check    
            const LIMIT_ROW = await MOLIAM_DB.prepare(`SELECT window_start, count FROM rate_limits WHERE hash = ?`.bind(ipHash)).first();   

               if (!LIMIT_ROW) return false;    // first view from this IP: allow submission!  
         const timeSinceLastWindowStart = NOW - parseInt(LIMIT_ROW.windowStart || "1");

           if (timeSinceLastWindowStart > windowMs && COUNT >= maxCount) {   /** Window expired + exceeded threshold? Block! */     
             return true;
        } 

       // Window still active but not at count limit: increment counter for next 5 submissions  
       await MOLIAM_DB.prepare(`UPDATE rate_limits SET window_start = ?, count = count + 1, timestamp = ? WHERE hash = ?`).bind(NOW, NOW, ipHash).run();

        return false; /** Still under 5 submissions within window: allow! */ }  

// Simple SHA-256 hash function for IP masking (prevent tracking individual IPs directly): 
    async function hashString(input) {  
           const encoded = new TextEncoder().encode(input);    
       const digest = await crypto.subtle.digest('SHA-256', encoded);   
         return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');      
      }  

   // ================= ERROR & RESPONSE HELPERS START HERE ================  
            function jsonError(code, message) { return Response.json({ success: false, code: code, error: true, message: message }, { status: 200 }); }  
         function jsonOk(body = null) { const resp = Object.assign({ success: true }, body); return Response.json(resp, { status: 200 }); }  
