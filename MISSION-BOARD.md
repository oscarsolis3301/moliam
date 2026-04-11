      1|# MISSION BOARD — Mavrick (Backend ONLY)
      2|
      3|⚠️ DO NOT EDIT ANY .html FILES. You are backend only.
      4|⚠️ Run `bash ~/.hermes/pre-commit-check.sh` BEFORE every commit.
      5|
      6|## Task 1: Harden API error handling
      7|For every file in `functions/api/` (NOT in functions/lib/):
      8|- Ensure every exported function has try/catch
      9|- Return proper JSON errors: `new Response(JSON.stringify({error: "message"}), {status: 500, headers: {"Content-Type": "application/json"}})`
      10|- Validate required fields before DB queries
      11|
      12|## Task 2: Add input sanitization to contact.js
      13|- Validate email format (regex)
      14|- Strip HTML tags from text fields
      15|- Limit field lengths (name: 100, message: 2000)
      16|- Return 400 with specific error for invalid input
      17|
      18|## Task 3: Add input sanitization to lead-intake.js
      19|Same as Task 2 but for lead intake fields.
      20|
      21|## Task 4: Improve API response consistency
      22|Every API function should:
      23|- Return `{success: true, data: {...}}` for success
      24|- Return `{error: "message"}` for errors
      25|- Include `Content-Type: application/json` header
      26|- Include CORS headers for moliam.com and moliam.pages.dev
      27|
      28|## CONTINUOUS IMPROVEMENT (backend only)
      29|1. Add JSDoc comments to every function in functions/api/
      30|2. Check for SQL injection — ensure all queries use parameterized `?` bindings
      31|3. Remove dead code, unused imports, commented-out blocks
      32|4. Ensure consistent error response format across all endpoints
      33|
      34|## Rules
      35|- ⚠️ NEVER edit files in `public/` — you are BACKEND ONLY
      36|- Run `bash ~/.hermes/pre-commit-check.sh` before EVERY commit
      37|- `git add -A && git commit -m "type(scope): desc" && git push origin main`
      38|- NEVER run wrangler pages deploy
      39|- NEVER create cron jobs
