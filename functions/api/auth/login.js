/**
 * Login API Endpoint
 * POST /api/auth/login
 */
export default {
  async post(request, env) {
    try {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Email and password required" 
          }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
           }
         );
      }

      // Hash password with SHA-256: SHA256(password + "_moliam_salt_2026")
      const message = password + "_moliam_salt_2026";
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Find user in D1 database (env.MOLIAM_DB)
      const users = env.MOLIAM_DB.prepare(`
        SELECT id, name, email, role, password_hash 
        FROM users 
        WHERE email = ?
      `.bind(email));

      const userResult = await users.first();

      if (!userResult) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid credentials" 
          }),
          { 
            status: 401,
            headers: { "Content-Type": "application/json" }
           }
         );
      }

      if (userResult.password_hash !== passwordHash) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid credentials" 
          }),
          { 
            status: 401,
            headers: { "Content-Type": "application/json" }
           }
         );
      }

      // Create session with random 64-char hex token
      const tokenArray = new Uint8Array(32);
      crypto.getRandomValues(tokenArray);
      const token = Array.from(tokenArray)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

     // Create session with random 64-char hex token
      const tokenArray = Uint8Array.from({length: 32}, () => crypto.getRandomValues(new Uint8Array(32))[0]);
      const token = Array.from(tokenArray)
             .map(b => b.toString(16).padStart(2, '0'))
             .join('');

     // Store session in sessions table
      await env.MOLIAM_DB.prepare(`
        INSERT INTO sessions (user_id, token, created_at)
        VALUES (?, ?, datetime('now'))
       `.bind(userResult.id, token).run());

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { 
            id: userResult.id,
            name: userResult.name, 
            email: userResult.email,
            role: userResult.role 
          },
          session_token: token
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
         }
       );

    } catch (error) {
      console.error("Login error:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Internal server error" 
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
         }
       );
    }
  }
};
