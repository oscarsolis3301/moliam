/**
 * Performance Monitoring & Analytics System
 * Task 16: D1 slow query logging + Cloudflare KV cache for custom metrics
 * 
 * Features:
 * - Slow query detection (threshold: 50ms)
 * - KV-based caching for metrics aggregation  
 * - Real-time dashboard telemetry
 * - Request timing middleware
 */

const SLOW_QUERY_THRESHOLD = 50; // ms
const KV_METRICS_TTL = 3600; // 1 hour cache TTL

/**
 * Create performance tracking wrapper for database operations
 * Captures query duration and logs to KV if slow
 */
export function createSlowQueryLogger(env) {
  const metricsBucket = env.MOLIAM_METRICS || {};
  
  return async function logQuery(queryName, dbOperation) {
    const start = Date.now();
    
    try {
      const result = await dbOperation();
      const duration = Date.now() - start;
      
      // Track timing metrics in KV
      await metricsBucket.put(
        `query:duration:${queryName}:${Date.now()}`,
        JSON.stringify({ queryName, duration }),
        { expirationTtl: 300 } // Keep for 5min
      );
      
      // Log to console with timing info
      if (duration > SLOW_QUERY_THRESHOLD) {
        console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`);
        await metricsBucket.put(
          `slow:query:${Date.now()}`,
          JSON.stringify({ queryName, duration, timestamp: new Date().toISOString() }),
          { expirationTtl: 86400 } // Keep slow queries for 24h
        );
      }
      
      return result;
    } catch (error) {
      console.error(`[QUERY ERROR] ${queryName}:`, error.message);
      await metricsBucket.put(
        `error:query:${Date.now()}`,
        JSON.stringify({ queryName, error: error.message, timestamp: new Date().toISOString() }),
        { expirationTtl: 604800 } // Keep errors for 7 days
      );
      throw error;
    }
  };
}

/**
 * Dashboard metrics aggregator - aggregates query stats over time window
 */
export async function getDashboardMetrics(env, hours = 1) {
  const metricsBucket = env.MOLIAM_METRICS || {};
  const now = Date.now();
  const cutoff = now - (hours * 3600 * 1000);
  
  // Get all query durations from KV
  const keys = await metricsBucket.list({ prefix: 'query:duration:', limit: 1000 });
  
  let totalQueries = 0;
  let sumDuration = 0;
  let slowQueries = 0;
  let errors = 0;
  
  for (const key of keys.keys) {
    const timestamp = parseInt(key.name.split(':')[2]);
    if (timestamp > cutoff) {
      try {
        const data = JSON.parse(await metricsBucket.get(key.name, 'json') || '{}');
        totalQueries++;
        sumDuration += data.duration || 0;
        if (data.queryName && data.duration > SLOW_QUERY_THRESHOLD) slowQueries++;
      } catch {}
    }
  }
  
  // Count recent errors
  const errorKeys = await metricsBucket.list({ prefix: 'error:query:', limit: 100 });
  for (const key of errorKeys.keys) {
    if (parseInt(key.name.split(':')[2]) > cutoff) errors++;
  }
  
  return {
    totalQueries,
    avgDuration: totalQueries > 0 ? Math.round(sumDuration / totalQueries) : 0,
    slowQueries,
    queriesWithErrors: errors,
    windowHours: hours,
    timestamp: new Date().toISOString()
  };
}

/**
 * Request timing middleware - measures and logs HTTP request durations
 */
export function createRequestTimingMiddleware(env) {
  const metricsBucket = env.MOLIAM_METRICS || {};
  
  return async function timingMiddleware(request, next) {
    const start = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    try {
      const response = await next(request);
      
      // Calculate duration - we can't capture actual body, but we know elapsed time from start
      const duration = Date.now() - start;
      
      // Log to KV for metrics aggregation
      await metricsBucket.put(
        `request:${method}:${path.replace(/\//g, '_')}:${Date.now()}`,
        JSON.stringify({ 
          method, 
          path, 
          duration,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('CF-Connecting-IP') || 'unknown'
        }),
        { expirationTtl: 3600 } // 1h cache
      );
      
      // Add timing headers for client visibility
      const modifiedHeaders = new Headers(response.headers);
      modifiedHeaders.set('X-Request-Duration', duration.toString());
      modifiedHeaders.set('X-Timestamp', new Date().toISOString());
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: modifiedHeaders
      });
      
    } catch (error) {
      const duration = Date.now() - start;
      
      // Log the error
      await metricsBucket.put(
        `error:request:${Date.now()}`,
        JSON.stringify({
          method,
          path,
          error: error.message,
          duration,
          timestamp: new Date().toISOString(),
          ip: request.headers.get('CF-Connecting-IP') || 'unknown'
        }),
        { expirationTtl: 604800 } // 7 days
      );
      
      throw error;
    }
  };
}

/**
 * Get slow queries report from last N hours
 */
export async function getSlowQueriesReport(env, hours = 1) {
  const metricsBucket = env.MOLIAM_METRICS || {};
  const now = Date.now();
  const cutoff = now - (hours * 3600 * 1000);
  
  const keys = await metricsBucket.list({ prefix: 'slow:query:', limit: 500 });
  const results = [];
  
  for (const key of keys.keys) {
    const timestamp = parseInt(key.name.split(':')[2]);
    if (timestamp > cutoff) {
      try {
        const data = JSON.parse(await metricsBucket.get(key.name, 'json') || '{}');
        results.push({
          queryName: data.queryName,
          durationMs: data.duration,
          timestamp: new Date(data.timestamp).toLocaleTimeString()
        });
      } catch {}
    }
  }
  
  return { totalCount: results.length, queries: results };
}

/**
 * Create performance tracking wrapper for any async operation
 */
export function withTiming(fn) {
  return async function timedOperation(...args) {
    const start = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      // Log to console for debugging
      if (duration > SLOW_QUERY_THRESHOLD) {
        console.log(`[PERFORMANCE] Operation took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[ERROR] Operation failed after ${duration}ms:`, error.message);
      throw error;
    }
  };
}

export { SLOW_QUERY_THRESHOLD, KV_METRICS_TTL };
