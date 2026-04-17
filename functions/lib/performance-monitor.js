/* ============================================================================
   Performance Monitoring Library for Moliam Backend
    
   This module provides tools for:
   1. D1 slow query logging with timing analysis
   2. Custom metrics via Cloudflare Worker KV cache
   3. Query pattern tracking and optimization recommendations
   4. Request duration tracking with percentile calculations
   
   Usage: Import createPerformanceMonitor() from this file and configure it
   in your API endpoints.

   Features:
   - Tracks query execution time in milliseconds
   - Logs slow queries (>50ms threshold) to console for debugging
   - Maintains rolling 1-hour window of query performance data in KV cache
   - Generates summary reports with p50, p95, p99 percentiles
   - Detects query patterns (frequent vs occasional)

   Configuration:
   - SLOW_QUERY_THRESHOLD_MS: Minimum time to log as slow query (default 50ms)
   - KV_STORAGE_KEY: KV storage key for performance data (default 'moliam-perf')
   - ROLLING_WINDOW_HOURS: How far back to keep performance data (default 1 hour)

   Example Usage:
   
   import { createPerformanceMonitor } from './lib/performance-monitor.js';

   const monitor = createPerformanceMonitor({
     slowQueryThreshold: 50, // log queries > 50ms
     kvStorageKey: 'moliam-perf',
   });

   // Wrap database queries for timing analysis
   const startTime = Date.now();
   const result = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).all();
   const duration = Date.now() - startTime;
   
   monitor.logQuery('SELECT users query', 'GET /api/dashboard', duration, result);

   // Get performance summary for current hour
   const stats = monitor.getPerformanceSummary();
   
   // Rate limit monitoring
   monitor.trackRateLimit('/api/contact', 429); // logged when rate limited

   // Daily summary report (call from cron job or scheduled task)
   await monitor.generateDailyReport();

   ============================================================================ */

// Configuration defaults
const SLOW_QUERY_THRESHOLD_MS = 50;
const KV_STORAGE_KEY = 'moliam-perf';
const ROLLING_WINDOW_HOURS = 1;

/**
 * Create a performance monitoring instance with configurable settings.
 * 
 * @param {Object} options - Configuration object
 * @param {number} [options.slowQueryThreshold=SLOW_QUERY_THRESHOLD_MS] - Minimum query time in ms to log as slow
 * @param {string} [options.kvStorageKey=KV_STORAGE_KEY] - KV storage key for performance data
 * @param {number} [options.rollingWindowHours=ROLLING_WINDOW_HOURS] - How far back to keep data (hours)
 * @returns {Object} Performance monitor instance with methods for tracking queries and generating reports
 */
export function createPerformanceMonitor(options = {}) {
  const {
    slowQueryThreshold = options.slowQueryThreshold || SLOW_QUERY_THRESHOLD_MS,
    kvStorageKey = options.kvStorageKey || KV_STORAGE_KEY,
    rollingWindowHours = options.rollingWindowHours || ROLLING_WINDOW_HOURS,
  } = options;

  // In-memory cache for current session data (prevents repeated KV reads/writes)
  let sessionCache = null;
  let sessionCacheExpiry = Date.now();

  /**
   * Get current hour bucket ID for partitioning performance data.
   * @returns {string} Hour-formatted string YYYY-MM-DD-HH
   */
  function getCurrentHourBucket() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }

  /**
   * Parse hour bucket from string.
   * @param {string} bucket - Hour bucket string YYYY-MM-DD-HH 
   * @returns {Date} Date object for this hour
   */
  function parseHourBucket(bucket) {
    const [year, month, day, hour] = bucket.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour));
  }

  /**
   * Calculate percentiles from sorted array of values.
   * @param {number[]} values - Array of numeric values (must be sorted ascending)
   * @param {number[]} percentiles - Array of percentile values to compute (e.g., [50, 95, 99])
   * @returns {Object} Object with percentile results as keys
   */
  function calculatePercentiles(values, percentiles = [50, 95, 99]) {
    if (values.length === 0) {
      return percentiles.reduce((acc, p) => ({ ...acc, [`p${p}`]: null }), {});
    }

    const sorted = [...values].sort((a, b) => a - b);
    const result = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Load performance data from KV storage into session cache.
   * @returns {Promise<Object>} Performance data object from KV or empty object if none exists
   */
  async function loadCache() {
    const now = Date.now();
    
    // Check if cache is still valid (within last minute)
    if (sessionCache && sessionCacheExpiry > now) {
      return sessionCache;
    }

    // Load from KV storage if available
    try {
      const result = await env.MOLIAM_PERF.get(kvStorageKey, { type: 'json' });
      
      if (result) {
        sessionCache = result;
        sessionCacheExpiry = now + 60000; // Cache for 1 minute
        return sessionCache;
      }
    } catch (err) {
      console.warn('[PerformanceMonitor] KV read failed:', err.message);
    }

    sessionCache = {};
    sessionCacheExpiry = now + 60000;
    return sessionCache;
  }

  /**
   * Save current performance data back to KV storage.
   * @param {Object} data - Performance data object to store
   * @returns {void}
   */
  async function saveCache(data) {
    try {
      await env.MOLIAM_PERF.put(kvStorageKey, JSON.stringify(data));
      sessionCache = null; // Invalidate local cache on next load
      sessionCacheExpiry = Date.now();
    } catch (err) {
      console.warn('[PerformanceMonitor] KV write failed:', err.message);
    }
  }

  /**
   * Initialize session-specific performance tracking data.
   * @returns {Object} Current hour's query tracking object, initialized if missing
   */
  async function initSessionTracking() {
    const cache = await loadCache();
    const bucket = getCurrentHourBucket();

    // Initialize current hour bucket if not already tracked
    if (!cache[bucket]) {
      cache[bucket] = {
        timestamp: Date.now(),
        queries: [],        // Array of { name, endpoint, duration_ms, result_count }
        errors: 0,           // Number of slow/error queries this hour
        requests: 0,         // Total tracked requests this hour
        avg_durations: [],   // For calculating session average later
        status_codes: {},    // HTTP response code distribution {200:5, 401:2}
      };

      await saveCache(cache);
    }

    return cache[bucket];
  }

  /**
   * Log a database query with timing analysis.
   * @param {string} queryName - Human-readable name describing the query (e.g., "SELECT users by email")
   * @param {string} endpoint - API endpoint path being called
   * @param {number} durationMs - Query execution time in milliseconds
   * @param {Object} result - Optional: query result object to extract count from
   * @returns {void} - Logs slow queries, updates session cache, no blocking I/O if KV unavailable
   */
  function logQuery(queryName, endpoint, durationMs, result) {
    const bucket = getCurrentHourBucket();
    const now = new Date(bucket);

    // Check if slow query threshold exceeded
    if (durationMs >= slowQueryThreshold) {
      console.warn(`[SlowQuery] ${queryName} | ${endpoint} | ${durationMs.toFixed(2)}ms`);
    }

    return initSessionTracking().then(session => {
      session.queries.push({
        name: queryName,
        endpoint,
        duration_ms: Math.round(durationMs * 100) / 100, // round to 2 decimals
        result_count: result?.results?.length || 0,
        timestamp: now.getTime(),
      });

      session.requests++;
      session.avg_durations.push(durationMs);

      // Track HTTP status codes if provided
      const statusCode = result?.status || 200;
      if (typeof statusCode === 'number') {
        const existingStatuses = session.status_codes || {};
        existingStatuses[statusCode] = (existingStatuses[statusCode] || 0) + 1;
        session.status_codes = existingStatuses;
      }

      return saveCache(session);
    }).catch(err => {
      // Silently ignore KV errors - performance monitoring should not break functionality
      console.warn(`[PerformanceMonitor] logQuery error:`, err.message);
    });
  }

  /**
   * Track an error or exception in query execution.
   * @param {string} endpoint - API endpoint where the error occurred
   * @param {Object} error - Error object with message property
   * @returns {Promise<Object>} Session data after tracking error, or empty session if failed
   */
  async function trackError(endpoint, error) {
    const session = await initSessionTracking();
    
    session.errors = (session.errors || 0) + 1;

    return saveCache(session).then(() => session).catch(err => {
      console.warn(`[PerformanceMonitor] trackError:`, err.message);
      return session; // Return session anyway, data loss is logged to console
    });
  }

  /**
   * Track rate limit enforcement events.
   * @param {string} endpoint - API endpoint that was rate limited
   * @param {number} statusCode - HTTP response status code (should be 429)
   * @returns {Promise<Object>} Session data, or empty session if KV failed to save
   */
  function trackRateLimit(endpoint, statusCode = 429) {
    return initSessionTracking().then(session => {
      const limitName = `${endpoint}`;

      // Track which endpoints get rate limited most often
      const rateLimits = session.rate_limited || {};
      rateLimits[limitName] = (rateLimits[limitName] || 0) + 1;
      session.rate_limited = rateLimits;
      
      return saveCache(session).catch(err => {
        console.warn(`[PerformanceMonitor] trackRateLimit error:`, err.message);
        return null; // Return nothing if KV fails
      });
    });
  }

  /**
   * Generate performance summary for current hour with percentiles.
   * @returns {Object} Summary object with p50/p95/p99 of query durations, error counts, request count
   */
  function getPerformanceSummary() {
    return initSessionTracking().then(session => {
      const durations = session.avg_durations || [];
      const percentiles = calculatePercentiles(durations);

      // Calculate error rate if we have requests
      const errors = (session.errors || 0);
      const totalRequests = (session.requests || 1);
      const errorRate = (errors / totalRequests) * 100;

      return {
        bucket: getCurrentHourBucket(),
        window_start: session.timestamp,
        query_count: durations.length,
        request_count: totalRequests,
        ...percentiles, // Spreads p50, p95, p99 into summary object
        error_rate: Math.round(errorRate * 100) / 100, // Round error rate to 2 decimals
        top_slow_queries: durations
          .map((d, i) => ({ index: i, duration: d }))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10), // Top 10 slowest queries this hour
      };
    }).catch(err => {
      console.warn('[PerformanceMonitor] getPerformanceSummary failed:', err.message);
      return null; // Fallback returns when KV storage unavailable
    });
  }

  /**
   * Generate daily aggregation report by merging all hours from today into one summary.
   * @returns {Promise<Object>} Daily report with aggregated metrics across 24 hour buckets
   */
  async function generateDailyReport() {
    const cache = await loadCache();
    const bucket = getCurrentHourBucket();
    const today = bucket.split('-').slice(0, 3).join('-'); // YYYY-MM-DD

    // Collect all hours from current day
    const dailyBuckets = Object.keys(cache)
      .filter(k => k.startsWith(today))
      .map(parseHourBucket);

    // Aggregate metrics across all hourly buckets for today
    let totalQueries = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    const allDurations = [];

    for (const entry of dailyBuckets) {
      const data = cache[getCurrentBucketForDate(entry)];
      if (data && data.queries) {
        totalQueries += data.queries.length;
        totalErrors += (data.errors || 0);
        totalRequests += (data.requests || 0);

        allDurations.push(...(data.avg_durations || []));
      }
    }

    const percentiles = calculatePercentiles(allDurations);

    return {
      report_date: today,
      window: '24h',
      total_queries: totalQueries,
      total_errors,
      total_requests: totalRequests,
      ...percentiles,
      slow_query_count: allDurations.filter(d => d >= slowQueryThreshold).length,
      avg_duration: totalQueries > 0 ? (allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : 0,
    };
  }

  /**
   * Get bucket key for a specific date.
   * @param {Date} date - Date object to get bucket for
   * @returns {string} Bucket string YYYY-MM-DD-HH format
   */
  function getCurrentBucketForDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getHours().toString().padStart(2, '0')}`;
  }

  /**
   * Clear old performance data older than rolling window threshold.
   * @returns {void} - Deletes KV entries outside the rolling time window
   */
  async function cleanupOldData() {
    const cache = await loadCache();
    const now = Date.now();
    const windowStart = now - (rollingWindowHours * 60 * 60 * 1000);

    // Remove timestamps older than the rolling window
    const keysToRemove = Object.keys(cache).filter(bucket => {
      const date = parseHourBucket(bucket);
      return date.getTime() < windowStart;
    });

    if (keysToRemove.length > 0) {
      console.info(`[PerformanceMonitor] Cleaning up ${keysToRemove.length} old buckets`);
      for (const bucket of keysToRemove) {
        await env.MOLIAM_PERF.delete(`${bucket}`);
      }
      await saveCache(cache);
    }
  }

  /**
   * Force purge all cached performance data - dangerous operation, only call when debugging.
   * @returns {Promise<void>}
   */
  async function purgeAllData() {
    const cache = await loadCache();
    const keys = Object.keys(cache);

    console.warn(`[PerformanceMonitor] Purging ${keys.length} buckets...`);

    for (const bucket of keys) {
      await env.MOLIAM_PERF.delete(bucket);
    }

    sessionCache = null;
  }

  /**
   * Log middleware execution timing from Cloudflare Workers context.
   * @param {Object} context - Cloudflare Workers request context with waitUntil method available
   * @param {Request} request - Incoming HTTP Request object being tracked
   * @returns {Object} Timing wrapper function that can be called after the handler completes
   */
  function wrapMiddleware(context, request) {
    const startTime = Date.now();
    
    return {
      // Call this method when your handler has completed
      finish: async (response) => {
        const duration = Date.now() - startTime;

        // Track in session if KV is available
        initSessionTracking().then(session => {
          const respStatus = response?.status || 200;
          
          session.status_codes = session.status_codes || {};
          session.status_codes[respStatus] = (session.status_codes[respStatus] || 0) + 1;

          return saveCache(session);
        }).catch(err => {
          console.warn(`[PerformanceMonitor] wrapMiddleware finish failed:`, err.message);
        });

        // Handle background cleanup in case storage is unavailable or worker shutting down
        if (context.waitUntil) {
          context.waitUntil(cleanupOldData());
        }
      },
    };
  }


  return {
    logQuery,
    trackError,
    trackRateLimit,
    getPerformanceSummary,
    generateDailyReport,
    cleanupOldData,
    purgeAllData,
    wrapMiddleware,
    calculatePercentiles,
  };

}

/**
 * Create performance monitoring with default settings.
 * @returns {Object} Monitored instance with standard defaults for Moliam backend
 */
export function createDefaultPerformanceMonitor() {
  return createPerformanceMonitor();
}


