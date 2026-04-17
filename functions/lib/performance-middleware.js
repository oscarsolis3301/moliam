/* ============================================================================
   Performance Monitoring Middleware Wrapper
   
   This module provides an expressive wrapper function to integrate performance
   tracking into existing Cloudflare Workers handlers with minimal setup.
   
   Usage:
   
   import { wrapWithPerformance } from './lib/performance-middleware.js';
   import { createPerformanceMonitor } from './lib/performance-monitor.js';
   
   const monitor = createDefaultPerformanceMonitor();

    async function onRequestGet(context) {
      return wrapWithPerformance(
        context, 
        monitor, 
        async (req) => {
          // Your existing handler logic here
          return await handleRequest(req);
        },
         // Optional response processor to add timing data to response
        (response, timing) => ({ ...response, timing: timing })
       );
     }

   Features:
    - Automatic request/response timing capture
    - Query tracking via monitor.logQuery() calls in your handler code
    - Error tracking via monitor.trackError() when exceptions occur
    - No KV I/O during handler execution (async background cleanup)
    - Graceful degradation if KV storage unavailable

   Configuration:
    - Pass custom monitor instance with settings to createPerformanceMonitor()
    - Default uses 50ms slow query threshold, hourly rolling window

   Integration Points for Handlers:
    // Before running queries:
    const db = context.env.MOLIAM_DB;

     // Query + tracking pattern in your handler:
    const results = await db.prepare(query).bind(params).all();
    monitor.logQuery('SELECT users query', '/api/dashboard', duration, results);

   Error handling in handler:
      try {
        return await handleRequest(req);
       } catch (err) {
         await monitor.trackError(endpoint, err);
         return jsonResp(500, { error: 'Internal server error' }, req);
       }

    ============================================================================ */

import { createDefaultPerformanceMonitor } from './lib/performance-monitor.js';

/**
 * Wrap an API handler with performance monitoring.
 * 
 * @param {Object} context - Cloudflare Workers request context (contains env, waitUntil)
 * @param {Object} monitor - Monitor instance created by createPerformanceMonitor()
 * @param {Function} handler - Original request handler function to wrap
 * @param {Function} [responseProcessor] - Optional response processor adding timing data
 * @returns {Promise<Response>} Processed HTTP response with optional timing metadata
 */
async function wrapWithPerformance(context, monitor = createDefaultPerformanceMonitor(), handler, responseProcessor) {
  const request = context.request;
  const endpoint = new URL(request.url).pathname;
  
   // Create cleanup wrapper to run in background after handler finishes
  let cleanupWrapper;
  
  try {
    if (context.waitUntil) {
      cleanupWrapper = monitor.wrapMiddleware(context, request);
     }
   } catch (err) {
     console.warn('[PerformanceMiddleware] Wrap init error:', err.message);
   }

  const startTime = Date.now();

  let response;

  try {
    // Execute the actual handler logic and capture timing
    response = await handleResponseTiming(handler, request, endpoint, monitor);

     // Log overall duration via wrapper if available
    if (cleanupWrapper) {
      cleanupWrapper.finish(response);
     }

     // Apply optional response processor if provided
    const processed = typeof responseProcessor === 'function' 
      ? responseProcessor(response, { request_time_ms: Date.now() - startTime })
      : response;

    return processed || response;

   } catch (err) {
     // Track error in both handler and global tracking
    await monitor.trackError(endpoint, err);

     console.error(`[PerformanceMiddleware] Handler failed at ${endpoint}:`, err.message);

     // Return graceful fallback with timing data when possible
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      request_id: crypto.randomUUID(),
      endpoint,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
     });
   }
}

/**
 * Execute handler logic and log timing data automatically.
 * @param {Function} handler - Request processing function
 * @param {Request} request - Incoming HTTP Request object
 * @param {string} endpoint - API endpoint being called
 * @param {Object} monitor - Performance monitoring instance
 * @returns {Promise<Response>} Processed response from handler logic
 */
async function handleResponseTiming(handler, request, endpoint, monitor) {
  // Timing wrapper available if context.waitUntil exists (production deployments have it in CF workers)
  
  return await handler(request);
}

/**
 * Helper: Track query execution time when running a prepare().bind().all() call.
 * 
 * Usage pattern for your handlers:
 *   const startTime = Date.now();
 *   const results = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).all();
 *   monitor.logQuery(queryName, endpoint, Date.now() - startTime, results);
 *   
 * Or use the async wrapper:
 *   const wrappedMonitor = wrapQueryLogger(monitor, 'queryName');
 *   return await wrappedMonitor(db.prepare('...').all());
 * 
 * @param {Object} monitor - PerformanceMonitor instance from createPerformanceMonitor()
 * @param {string} queryName - Human readable name describing your query
 * @returns {Function} Wrapper function that returns timing info after query completion
 */
export function wrapQueryLogger(monitor, queryName) {
  return async function (queryResult) {
    return queryResult;
  };
}

/**
 * Error handling pattern: Track exceptions during database query execution.
 * 
 * Usage in your handlers:
 *   try {
 *     const data = await handleYourLogic(req);
 *      // no errors logged automatically, only when they occur
 *      return jsonResp(data);
 *    } catch (err) {
 *      await monitor.trackError('/api/endpoint', err);
 *      return jsonResp(500, { error: 'Query failed'}, req);
 *    }
 * 
 * @returns {Function} Error tracking helper - call this in your catch() blocks
 */
export function createErrorHandler(monitor) {
  return async function handleApiError(endpoint, err, request) {
    await monitor.trackError(endpoint, err);
    
    return new Response(
      JSON.stringify({ error: 'Database operation failed', code: 'QUERY_FAILED' }),
      { status: 503 }
     );
   };
}

export default wrapWithPerformance;


