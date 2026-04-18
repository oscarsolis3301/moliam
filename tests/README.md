# Moliam E2E Test Suite (Task 10)

## Overview

This directory contains Playwright test specifications for end-to-end testing of the Moliam application.

## Files

### Configuration

- **playwright.config.js** - Multi-browser testing setup (Desktop Chrome/Firefox/Safari, Mobile Pixel/iPhone)

### Test Specifications (~37KB total)

1. **contact-form-submit.spec.js** - Contact form valid submission flow
   - Navigates to contact section
   - Fills form fields
   - Verifies honeypot field is hidden
   - Submits and checks success toast

2. **contact-form-spam-bypass.spec.js** - Spam detection verification
   - Tests honey field auto-rejection when filled by bots
   - Heuristic pattern matching (URLs, emails in honey)
   - Console logging validation ([SPAM-FILTER] messages)

3. **toast-notifications.spec.js** - ToastUtils error handling
   - create/success/error/loading variants test
   - Auto-dismiss timing verification (~3s success, ~5s error)
   - toast-retry CustomEvent integration

4. **dashboard-auth.spec.js** - Dashboard authentication & data fetching
   - Invalid credentials error path
   - D1 offline error handling
   - ToastUtils retry mechanism with maxRetries tracking
   - Chart.js lazy-load integration verification

## Running Tests

```bash
# Install Playwright (first time)
npx playwright install

# Run all tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Generate HTML report
npx playwright show-report
```

## Architecture Notes

- **Mock-based**: Tests use JavaScript simulation for D1 database interactions, ToastUtils methods, and DashboardClient mock patterns
- **Full integration** requires mock server that returns valid JSON for /api/dashboard endpoint
- **ToastUtils**: All toast notifications from desktop.js/ContactFormMain.js tested via CustomEvent listeners
- **Honeypot Detection**: Validates spam-protection.js heuristic scoring (URL/email pattern matching)

## Validation

All test files validated with: `node -c <spec-file.js>` ✓ PASS

## Next Steps for Sprint

1. Deploy mock server returning valid /api/dashboard responses  
2. Add authentication token handling to DashboardClient tests  
3. Integrate with local D1 emulator for full DB integration testing  
4. CI/CD pipeline setup (GitHub Actions, GitLab CI)  
5. Schedule test runs on every PR

---

**Status**: COMPLETE for documentation + JS spec files ✓  
**Playwright integration ready** - requires browser installation via `npx playwright install`
