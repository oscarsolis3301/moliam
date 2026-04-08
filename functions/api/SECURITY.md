# API Security Audit & Documentation

## Overview
All API endpoints in `functions/api/` have been hardened with the following security measures:

### Completed Hardening (Tasks 1-4)
✓ **Try/Catch Error Handling** - Every exported function wrapped in try/catch blocks  
✓ **Input Sanitization** - Email validation via regex, HTML tag stripping, field length limits  
✓ **Parameterized Queries** - All SQL uses `db.prepare(?).bind()` pattern to prevent SQL injection  
✓ **Consistent JSON Responses** - All responses use `{success: bool, data/error: object}` format via `jsonResp()`  

### CORS Configuration
All endpoints include CORS headers supporting:
- Production domains: `moliam.com`, `moliam.pages.dev`  
- Development URLs (localhost, 127.0.0.1)
- Wildcard `*` for flexibility  

### Input Validation Rules
| Endpoint | Field | Validation | Limit |
|----------|-------|-----------|-------|
| contact.js | email | regex match | max 254 chars |
| contact.js | name | strip HTML | max 100 chars |
| contact.js | message | strip HTML | max 2000 chars |
| lead-intake.js | email | regex match | max 254 chars |
| messages.js | text | strip HTML + client_id check | 500/1000 chars |

## File Status
- **Total API files**: 15 JavaScript endpoints  
- **Backup files cleaned**: Removed `client-message.js.bak`  
- **Dead code removed**: Null checks, unused imports  

## Database Security
All D1 queries use parameterized bindings:
```javascript
db.prepare("SELECT * FROM submissions WHERE email = ?").bind(email).all()
```

Never concatenate user input directly into SQL strings.

## Audit Date
Updated: Week of April 8, 2026 by Mavrick  
Next audit recommended: Q3 2026 or after major endpoint changes
