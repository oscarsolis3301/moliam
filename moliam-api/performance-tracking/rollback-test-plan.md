# Rollback Performance Test Plan

## Objective
Measure and track rollback operation performance over time.

## Metrics to Track
1. **API Response Time** - Time for rollback API to return
2. **Git Checkout Time** - Time to checkout from GitHub
3. **Server Restart Time** - Time for server to come back online
4. **Total Downtime** - Complete time from request to operational

## Test Procedure

### Test 1: GitHub Rollback
```bash
POST /v1/admin/github/rollback
Body: {"version_name": "v01-toby"}
```

**Measurements:**
- T0: Request sent
- T1: API response received
- T2: Server health check passes
- T3: Full operational confirmed

**Expected Results:**
- API Response: < 500ms
- Restart Time: < 5 seconds
- Total Downtime: < 10 seconds

### Test 2: Local Rollback (Legacy)
```bash
POST /v1/admin/rollback-unified
Body: {"version": "v01-toby-20260418"}
```

**Measurements:**
- Same as above
- Compare with GitHub rollback

## Results Tracking

| Date | Version | API Time | Restart Time | Total Time | Success |
|------|---------|----------|--------------|------------|---------|
| 2026-04-18 | v01-toby | TBD | TBD | TBD | ⏳ |

## Historical Data

All results stored in:
- `rollback-tests/rollback-YYYYMMDD.json`
- `rollback-tests/rollback-YYYYMM-summary.json` (monthly rollup)

---

**Note:** Do not run rollback tests during production hours without notice.
