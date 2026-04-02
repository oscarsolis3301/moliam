/**
 * Contact Form Backend (CloudFlare Pages Function) - runs in production!
 * POST /api/contact endpoint handler with rate limiting + Discord integration + D1 database
 */

const RATE_WINDOW_MS = 360000;      // 6 min window milliseconds
const MAX_SUBMISSIONS_PER_WINDOW = 5;    // Max submissions/IP within window

export default {  
    async POST(request) {  
        // Validate & parse incoming JSON body safely with error handling  
        let data; try { data = await request.json(); } catch(e) { return jsonError(400, 'Invalid request format.'); }  

         // Required field validation (name + valid email regex + message min length check)
          if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.message && data.message.trim().length < 10) {  
              return jsonError(400, 'Name, valid email, and 10+ char message are required.');  
         }

       // Extract & sanitize input values for database storage (prevent XSS/spam injection attacks!)    
          const name = String(data.name).trim();  
         const cleanEmail = data.email.toLowerCase().trim();    
           const phone = data.phone ? String(data.phone).replace(/[^\d()\-+]/g, '') : null;     
           const company = data.company ? String(data.company).trim() : null;   
           const messageText = data.message ? data.message.trim() : '';    

        // Build rate limit check: get IP hash from CloudFlare headers or remote address + lookup existing limits
          const clientIPHash = hashIP(request);        
         if (isRateLimited(clientIPHash)) return jsonError(429, 'Too many submissions — please wait 6 minutes before trying again.');

        try {    
         // Query D1 database to insert submission record + auto-create linked lead row with status='new'  
             const subResult = await MOLIAM_DB.prepare(`
                 INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution)
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)  
             `.bind(name, cleanEmail, phone || null, company || null, messageText, String(request.headers.get('user-agent') || ''),'').run();    
             
           const submissionId = subResult.meta.lastWriteId;       // Auto-generated DB ID from last insert operation

         // Create associated lead row (auto-foreign-key + status=new by default):
            await MOLIAM_DB.prepare(`
                 INSERT INTO leads (submission_id, status, created_at)  
              VALUES (?, 'new', CURRENT_TIMESTAMP)  
           `.bind(submissionId).run();

          // Attempt Discord webhook if configured URL is NOT placeholder/empty:
             const discordWebhook = DISCORD_WEBHOOK_URL || '';     // Fallback to empty string if no env var set!   
                  if (discordWebhook && /^[^\s]*(https?:\/\/|file:\/\/)[^\s]*$/.test(discordWebhook) && !/^https:\/\/discord\.com\/api\/webhooks\/YOUR_.*/.test(discordWebhook)) {      
                         try { await fetch(discordWebhook, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ username:'Moliam Contact',embeds:[{ title:`📩 NEW SUBMISSION from ${name}`,color:17258999,fields:[{ name:'Email',value:`<${cleanEmail}>`,inline:true },{ name:'Phone',value:phone || '—', inline:true }] }]) });} catch(err) {}   // Silently fail Discord if webhook fails - don't crash user!    
                        

          // Mark IP as rate-limited for next 6 minutes with submission count reset to 1 (new window start timestamp)
             await MOLIAM_DB.prepare(`INSERT OR REPLACE INTO rate_limits (hash, window_start, request_count, timestamp) VALUES (?, CURRENT_TIMESTAMP, 1, NOW())`).bind(clientIPHash).run();

         // Return success response to frontend with submission ID for reference:  
             return jsonSuccess({ 'success': true, 'message': 'Thanks! We will contact you within 5 business days.',submissionId });        

          } catch (dbError) { console.error('Database error:', dbError); return jsonError(500, 'Something went wrong — try email directly or call us. Error logged.'); }  
      }  
};

/** Helper: Rate limit check using IP hash + rolling window logic */  
function isRateLimited(hashStr = 'unknown') {  
    const NOW = Date.now();     // Current timestamp for window comparison  
       const existingRow = MOLIAM_DB.prepare(`SELECT * FROM rate_limits WHERE hash = ?`).bind(hashStr).first();   
         if (!existingRow) return false;       // No prior record for this IP: allow submission!  
      const windowStartMs = parseInt(existingRow.window_start || '0');      
         const windowDuration = NOW - windowStartMs;     // How long since first submission in this window?  
         if (windowDuration > RATE_WINDOW_MS) return false;   // Window expired (6 min passed): allow again!  

       // Still within window: check count vs max threshold
            if (existingRow.request_count >= MAX_SUBMISSIONS_PER_WINDOW) {    // Already hit cap of 5 submissions? Block!  
                const secondsUntilAvailable = Math.round((RATE_WINDOW_MS - windowDuration)/1000);    
               return true;   // TRUE = blocked, client should retry after N seconds.    
           } else {   
               MOLIAM_DB.prepare(`UPDATE rate_limits SET request_count = request_count + 1, timestamp = NOW() WHERE hash = ?`).bind(hashStr).run();      
               return false;    // Still under cap: allow this submission & increment count!  
           }     // END: window duration logic  
}

/** SHA-256 hashing for IP-based rate limiting (prevent direct IP tracking/spam) */  
async function hashIP(requestObj = {}) {    
       const ipHeader = requestObj.headers.get('cf-connecting-ip') || requestObj.socket?.remoteAddress || 'unknown';     
         return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ipHeader))).then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join(''));   
            }

/* Helper: JSON response wrapper for errors */  
function jsonError(code, message) { return Response.json({ error:true,code,message },{ status:200 }); }   

/** Success response envelope (always 200 OK from CloudFlare Pages Functions perspective) */   
function jsonSuccess(bodyObj = {}) { const respBody = Object.assign({ success:true }, bodyObj); return Response.json(respBody,{ status:200 }); }
