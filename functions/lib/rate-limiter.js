/**
 * Enterprise-grade rate limiting library for Moliam API handlers
 * Sliding window algorithm with memory cache + D1 persistence fallback
 * Auto-generates clientId hashes from IP + user-agent combinations
 */

export function generateClientId(ip = request.headers.get('x-forwarded-for') || 'unknown', userAgent = request.headers.get('user-agent') || 'unknown') {
  const hashBuffer = crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + userAgent));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createRateLimiterMiddleware(request, endpointName, env, baseRate = 50, burstFactor = 2) {
  const headers = new Headers(request.headers);
  const clientId = generateClientId(headers.get('x-forwarded-for') || headers.get('cf-connecting-ip') || 'unknown', headers.get('user-agent') || 'unknown');
  
  const now = Date.now();
  let requestCount = 0;
  let nextResetSeconds = 60;

  async function checkRateLimit(clientId, baseRate, burstFactor) {
    if (env && env.MOLIAM_DB) {
      try {
        const limitStateStmt = env.MOLIAM_DB.prepare(
          `SELECT count, expires_at, updated_at FROM rate_limits WHERE client_id = ? AND expires_at > ?`
        );
        const limitStateResult = await limitStateStmt.bind(clientId, now).first();

        if (limitStateResult && limitStateResult.expires_at && limitStateResult.expires_at > now) {
          requestCount = limitStateResult.count || 0;
          nextResetSeconds = Math.ceil((limitStateResult.expires_at - now) / 1000);
        } else {
          const baseLimit = parseInt(baseRate, 10) || 50;
          const burstLimit = baseLimit * (parseInt(burstFactor, 10) || 2);

          if (requestCount >= burstLimit) {
            return {success: false, error: "Rate limit exceeded", status: 429, retryAfter: nextResetSeconds};
          }

          const expiresAt = now + 60000;
          await env.MOLIAM_DB.prepare(
            `INSERT OR REPLACE INTO rate_limits (client_id, count, expires_at, updated_at) VALUES (?, ?, ?, ?)`
          ).bind(clientId, requestCount > 0 ? requestCount + 1 : 1, expiresAt, now).run();
          
          requestCount += 1;
          nextResetSeconds = 60;
        }

        const currentRateLimit = parseInt(baseRate, 10) || 50;
        if (requestCount >= currentRateLimit * (parseInt(burstFactor, 10) || 2)) {
          return {success: false, error: "Rate limit exceeded", status: 429, retryAfter: nextResetSeconds};
        }

        const stats = getRateLimitStats(clientId, env.MOLIAM_DB);

        headers.set("X-RateLimit-Limit", currentRateLimit.toString());
        headers.set("X-RateLimit-Remaining", Math.max(0, currentRateLimit - requestCount).toString());
        headers.set("X-RateLimit-Reset", nextResetSeconds.toString());

        return {success: true, count: requestCount, clientId, stats, headers};
      } catch (dbError) {
        console.warn("[rate-limiter] D1 DB not available, using memory fallback for client:", clientId);

        const memoryState = rateLimitMemory.get(clientId);
        const windowMs = 60 * 1000; 
        
        if (memoryState && memoryState.windowStart + windowMs > now) {
          requestCount = memoryState.count || 0;
          nextResetSeconds = Math.ceil((memoryState.windowStart + windowMs - now) / 1000);

          const baseLimit = parseInt(baseRate, 10) || 50;
          const burstLimit = baseLimit * (parseInt(burstFactor, 10) || 2);

          if (requestCount >= burstLimit) {
            return {success: false, error: "Rate limit exceeded", status: 429, retryAfter: nextResetSeconds};
          }

          const newCount = requestCount + 1;
          memoryState.count = newCount;
          rateLimitMemory.set(clientId, memoryState);

          headers.set("X-RateLimit-Limit", baseLimit.toString());
          headers.set("X-RateLimit-Remaining", Math.max(0, burstLimit - newCount).toString());
          headers.set("X-RateLimit-Reset", nextResetSeconds.toString());

          return {success: true, count: newCount, clientId, stats: memoryState.stats, headers};
        } else {
          if (memoryState) rateLimitMemory.delete(clientId);
          
          const cleanState = {count: 1, windowStart: now};
          rateLimitMemory.set(clientId, cleanState);

          const baseLimit = parseInt(baseRate, 10) || 50;
          nextResetSeconds = 60;

          headers.set("X-RateLimit-Limit", baseLimit.toString());
          headers.set("X-RateLimit-Remaining", (baseLimit - 1).toString());
          headers.set("X-RateLimit-Reset", nextResetSeconds.toString());

          return {success: true, count: 1, clientId, stats: cleanState, headers};
        }
      }
    } else {
      const memoryState = rateLimitMemory.get(clientId);
      const windowMs = 60 * 1000; 
      
      if (memoryState && memoryState.windowStart + windowMs > now) {
        requestCount = memoryState.count || 0;
        nextResetSeconds = Math.ceil((memoryState.windowStart + windowMs - now) / 1000);

        const baseLimit = parseInt(baseRate, 10) || 50;
        const burstLimit = baseLimit * (parseInt(burstFactor, 10) || 2);

        if (requestCount >= burstLimit) {
          return {success: false, error: "Rate limit exceeded", status: 429, retryAfter: nextResetSeconds};
        }

        const newCount = requestCount + 1;
        memoryState.count = newCount;
        rateLimitMemory.set(clientId, memoryState);

        headers.set("X-RateLimit-Limit", baseLimit.toString());
        headers.set("X-RateLimit-Remaining", Math.max(0, burstLimit - newCount).toString());
        headers.set("X-RateLimit-Reset", nextResetSeconds.toString());

        return {success: true, count: newCount, clientId, stats: memoryState.stats, headers};
      } else {
        if (memoryState) rateLimitMemory.delete(clientId);

        const cleanState = {count: 1, windowStart: now};
        rateLimitMemory.set(clientId, cleanState);

        const baseLimit = parseInt(baseRate, 10) || 50;
        nextResetSeconds = 60;

        headers.set("X-RateLimit-Limit", baseLimit.toString());
        headers.set("X-RateLimit-Remaining", (baseLimit - 1).toString());
        headers.set("X-RateLimit-Reset", nextResetSeconds.toString());

        return {success: true, count: 1, clientId, stats: cleanState, headers};
      }
    }
  }

  const rateLimitMemory = new Map();

  return checkRateLimit(clientId, baseRate, burstFactor);
}

export async function persistRateLimitState(clientId, env) {
  if (!env?.MOLIAM_DB) return;

  try {
    const windowMs = 60 * 1000;
    const now = Date.now();

    for (const [key, state] of rateLimitMemory.entries()) {
      if (state.windowStart + windowMs <= now) {
        rateLimitMemory.delete(key);
      }
    }
  } catch (error) {
    console.error("[rate-limiter] Error persisting state:", error);
  }
}

export function getRateLimitStats(clientId, env = null) {
  const memoryState = rateLimitMemory.get(clientId);
  if (memoryState) {
    return {...memoryState.stats, windowStart: memoryState.windowStart, count: memoryState.count};
  }
  if (env?.MOLIAM_DB) {
    try {
      const statsStmt = env.MOLIAM_DB.prepare(
        `SELECT count, expires_at, updated_at FROM rate_limits WHERE client_id = ?`
      );
      return statsStmt.bind(clientId).first() || {count: 0, expires_at: null, updated_at: Date.now()};
    } catch (err) {
      return {count: 0, error: "DB unavailable"};
    }
  }
  return {count: 0};
}

export function resetRateLimit(clientId, env = null) {
  if (env?.MOLIAM_DB) {
    try {
      env.MOLIAM_DB.prepare(
        `DELETE FROM rate_limits WHERE client_id = ?`
      ).bind(clientId).run();
    } catch (err) {console.error("[rate-limiter] Error resetting limit:", err);}
  }
  rateLimitMemory.delete(clientId);
}

export function parseRateLimitedJsonBody(request, env = null) {
  const headers = new Headers(request.headers);
  
  const baseLimit = parseInt(headers.get("X-RateLimit-Limit")) || 50;
  const remaining = parseInt(headers.get("X-RateLimit-Remaining")) || 0;

  return {baseRate: baseLimit, remainingRequests: remaining, headers};
}

// Global rate limit memory store (singleton across all requests)
const globalRateLimitMemory = new Map();

export function getGlobalRateLimitMemory() {
  return globalRateLimitMemory;
}
