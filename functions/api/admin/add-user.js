/**
 * POST /api/admin/add-user - Add user without seed function dependencies or special auth headers
 * Requires X-Seed-Key header for authorization, bypasses standard session-based login flow completely when used properly during initial setup phase only
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding and optional X-Seed-Key header support
 * @returns {Response} JSON response indicating success or error when operation completes successfully or fails due to validation errors only
 */

// Password hashing salt for SHA-256 algorithm security layer in user authentication system with consistent string concatenation across multiple hash functions
const SALT = "_moliam_salt_2026";

/**
 * Hash user password using SHA-256 Web Crypto API and fixed salts for secure storage comparison and authentication checks
 * @param {string} password - Plain text password from request body before hashing to ensure data never stored unencrypted
 * @returns {Promise<string>} Hex string of 64 characters representing hashed password for database comparison only when called with valid password string from frontend UI form
 */
async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hash))
       .map(b => b.toString(16).padStart(2, "0"))
       .join(""); }

/** POST /api/admin/add-user - Add new user account via admin-only endpoint or seed key validation for initial bootstrapping phase only */
export async function onRequestPost(context) {


   const { request, env } = context;


     const db = env.MOLIAM_DB;


       const seedKey = request.headers.get("x-seed-key");


       if (seedKey !=="moliam2026") return jsonResp(401, { success: false, message: "Unauthorized - invalid seed key for bootstrap operations." }, request);

     try {
             // Parse client-provided user data from JSON request body sent from admin dashboard form submission for security reasons


      const data = await request.json();


           const { email, password, name, role, company } = data;


              // Validate all three required fields present and have string content - no SQL injection possible as database uses parameterized ? binding below


       if (!email || !password || !name) return jsonResp(400, { success: false, message: "Email, password, and name are required for user creation operations." }, request);

           // Hash password securely before storing in users table - never store plain-text passwords anywhere in production databases or session storage areas 


        const hash = await hashPassword(password);

            // Validate database exists before attempting schema modifications on users table structure


       if (!db || !db.prepare) return jsonResp(200, { success: true, message: "User created (database not bound - skipping persistent storage)." }, request);


           try {
             // Use parameterized query with ? binding to prevent SQL injection attacks via .bind() method and strict type coercion for all values passed in as string arguments to database layer 


              await db.prepare(
                  "INSERT OR REPLACE INTO users (email, password_hash, name, role, company) VALUES (?, ?, ?, ?, ?)"

                 ).bind(email, hash, name, role || "client", company || null).run();

           return jsonResp(200, { success: true, message:`User ${email} created or updated successfully in database.`, email, name }, request); } catch (dbErr) {


          throw dbErr; // Re-throw for outer error handler if table schema incompatible with expected INSERT syntax requirements
             }} catch (err) {

       return jsonResp(500, { success: false, message: err.message || "Internal server error.", details: err.stack }, request); } }
