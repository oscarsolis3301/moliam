# MISSION BOARD — Mavrick (Backend ONLY)

⚠️ DO NOT EDIT ANY .html files. You are backend only.
⚠️ Run bash ~/.hermes/pre-commit-check.sh BEFORE every commit.

## Task 1: Harden API error handling
For every file in functions/api/ (NOT in functions/lib/):
- Ensure every exported function has try/catch
- Return proper JSON errors: new Response(JSON.stringify({error: "message"}), {status: 500, headers: {"Content-Type": "application/json"}})
- Validate required fields before DB queries

## Task 2: Add input sanitization to contact.js
- Validate email format (regex)
- Strip HTML tags from text fields  
- Limit field lengths (name: 100, message: 2000)
- Return 400 with specific error for invalid input

## Task 3: Add input sanitization to lead-intake.js
Same as Task 2 but for lead intake fields.

## Task 4: Improve API response consistency
Every API function should:
- Return {success: true, data: {...}} for success
- Return {error: "message"} for errors
- Include Content-Type: application/json header
- Include CORS headers for moliam.com and moliam.pages.dev

## CONTINUOUS IMPROVEMENT (backend only)
1. Add JSDoc comments to every function in functions/api/
2. Check for SQL injection — ensure all queries use parameterized ? bindings
3. Remove dead code, unused imports, commented-out blocks
4. Ensure consistent error response format across all endpoints

## Task 5: Bookings Audit (IN PROGRESS)
Completed logAudit() TODO fix - now accepts context.env.MOLIAM_DB as originally requested in comments, backward compatible with existing callers that pass just ID string.

See commit 44bdd56 for details.

## Rules
- ⚠️ NEVER edit files in public/ — you are BACKEND ONLY
- Run bash ~/.hermes/pre-commit-check.sh before EVERY commit
- git add -A && git commit -m "type(scope): desc" && git push origin main
- NEVER run wrangler pages deploy
- NEVER create cron jobs