# Backend Code Consolidation Plan - Task 4

## Current State Analysis

**Two helper libraries exist causing duplication:**
1. `api-helpers.js` (12KB) - Basic helpers used by older files
2. `lib/standalone.js` (20KB) - Comprehensive, modern utilities

**Breakdown:**
- Files using `standalone.js`: 4 (client-message, lead-intake, messages, contact - partially)
- Files using `api-helpers.js`: 7 (bookings, calendly-webhook, calendly, dashboard, followup, health, qr, prequalify)

## Refactoring Strategy

### Phase 1: Unify Helper Library (IN PROGRESS)
**Goal:** Delete api-helpers.js, update all imports to use lib/standalone.js

**Files to refactor:**
1. **bookings.js** (11KB) - Only uses `jsonResp` from api-helpers → migrate to standalone
2. **calendly-webhook.js** (8KB) - Uses `jsonResp` → migrate to standalone  
3. **calendly.js** (1KB) - Uses `jsonResp` → migrate to standalone
4. **dashboard.js** (9KB) - Uses `jsonResp` → migrate to standalone
5. **followup.js** (6KB) - Uses `jsonResp` → migrate to standalone
6. **health.js** (4KB) - Uses `jsonResp, balanceSuccessError` → migrate to standalone
7. **qr.js** (12KB) - Uses `jsonResp` → migrate to standalone
8. **prequalify.js** (12KB) - Uses `jsonResp` → migrate to standalone

### Phase 2: Extract Common Patterns from Backend Files

**Identified patterns for extraction:**
- Discord webhook sending with priority handling
- Rate limiting logic (varied implementations across files)
- CRM sync fire-and-forget pattern
- Email queueing system

### Phase 3: Create Standard Response Object Format

**Currently inconsistent:**
- Some responses use `{ success: true, error: false }` 
- Others use `{ status: 201, body: { ... } }` (messages.js style)
- Error formatting varies: `{error: "message"}` vs `{success: false, message: "..."}`

**Standard format to adopt:**
```javascript
{ success: true, data: { submissionId: 1, score: 85, category: 'hot' } }
// OR for errors:
{ success: false, error: "Description" }
```

## Execution Checklist

- [x] Analyze existing helper libraries
- [ ] Delete `api-helpers.js` and consolidate ALL functions to lib/standalone.js
- [ ] Update import statements in 8 remaining backend files (bookings, calendly-webhook, etc.)
- [ ] Remove internal duplication in lead-intake.js (calculateLeadScore, sendDiscordWebhook, initiateCrmSync duplicated functions) 
- [ ] Standardize response object format across all endpoints
- [ ] Add documentation/update REFACTOR.md with changes
- [ ] Run `node -c file.js` validation on each refactored file
- [ ] Commit after EACH file (v4 [backend/refactor]: description - Tag <@1466244456088080569>)

## Files Requiring Full Refactoring

### 1. BOOKINGS.JS (~11KB)
**Issues:**
- Only uses `jsonResp` from api-helpers (unused import convenience functions)
- Helper functions embedded inline (createAppointment, updateAppointmentStatus)  
- Incomplete code at line 244 (truncated file?)

**Actions needed:**
- Replace import with standalone.js version of jsonResp
- Consider extracting appointment helper methods to lib/ if reusable elsewhere


### 3. CONTACT.JS (~8KB)
**Issues:**
- Already imported from standalone BUT has `sendWebhook()` function duplicated (lines 184-189)
- Inconsistent error handling between D1-bound and non-D1 branches

**Actions:**
- Delete internal `sendWebhook()` function, replace with `sendDiscordWebhook(env, params)` import


### 5. LEAD-INTAKE.JS (~15KB) 
**Issues:**
- Has duplicate `calculateLeadScore()`, `sendDiscordAlert()`, `initiateCrmSync()`, `queueEmailSequences()` functions that EXIST in lib/standalone.js
- Uses standalone imports BUT then creates redundant local copies

**Actions:**
- Delete internal methods 172-354 (calculateLeadScore through queueEmailSequences)
- Import all from lib/standalone: `calculateLeadScore`, `sendDiscordWebhook`, and create shared `fireAndForget` wrapper

### 6. CLIENT-MESSAGE.JS / MESSAGES.JS (~7-14KB each)
**Already using standalone.js**, but check for duplicate response patterns (object vs string style mix)


## Expected Outcome

After completion:
- **Total backend code reduction**: ~40-50KB removed through unified library
- **Single import point**: `lib/standalone.js` exports EVERYTHING any endpoint needs  
- **Standardized responses**: Every endpoint returns consistent format
- **Maintainability**: One place to update validators, response helpers, email/Discord logic

