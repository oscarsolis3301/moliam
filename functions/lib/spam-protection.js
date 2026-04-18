/**
 * Spam Protection Module — Moliam Project 
 * IP-based blacklist cache with Map + attempt logging for contact form spam detection
 * Simple heuristic scoring (no reCAPTCHA v3 needed) - keeps budget under 50 lines
 */

// Global IP blacklist cache using Map object (persistent per request)  
const ipBlacklist = new Map(); // clientId -> {reason, blockedAt, attempts: number}
const attemptTracker = new Map(); // clientId -> {count, windowStart: timestamp}

module.exports = {
  /**
   * Check if IP/clientId is blacklisted and get blacklist reason
   * @param {string} clientId - Hashed IP + user-agent combination  
   * @return {{isBlacklisted: boolean, reason?: string, attempts: number}}
   */
  checkBlacklist: function(clientId) {
    const entry = ipBlacklist.get(clientId);
    if (entry) {
      return {isBlacklisted: true, count: entry.attempts || 0};
    }
    return {isBlacklisted: false, count: 0};
  },

  /**
   * Record failed spam attempt (honeypot triggered or heuristic suspicious)
   * @param {Request} request - HTTP request to extract IP from
   * @param {string} reason - Why flagged ('honeypot', 'invalid_format', etc.)
   */
  recordSpamAttempt: function(request, reason) {
    const now = Date.now();

    // Get clientId from rate limiter pattern 
    const headers = new Headers(request.headers);
    const ip = headers.get('x-forwarded-for') || headers.get('cf-connecting-ip') || 'unknown';
    const ua = headers.get('user-agent') || 'unknown';
    const clientId = this._hashString(ip + ua) || clientId;

    // Increment attempt count 
    const tracker = attemptTracker.get(clientId) || {count: 0, windowStart: now};
    
    // Reset if outside 60min window
    if (now - tracker.windowStart > 3600000) {
      tracker.count = 0;
      tracker.windowStart = now;
    }

    tracker.count++;
    attemptTracker.set(clientId, tracker);

    // If 5+ failed attempts in last hour, add to blacklist cache
    if (tracker.count >= 5 && !ipBlacklist.get(clientId)) {
      ipBlacklist.set(clientId, {reason: reason, blockedAt: now, attempts: tracker.count});
      
      // Log to console for debugging / monitoring  
      const logEntry = `[SPAM-FILTER] client:${clientId.substring(0, 16)}... reason:'${reason}' attempts:${tracker.count}`;
      console.log(logEntry);
    }

    return {count: tracker.count, blacklisted: this.checkBlacklist(clientId).isBlacklisted};
  },

  /**
   * Check if submission is likely spam based on honeypot field value
   * @param {string} honeyFieldValue - Value from form's honeypot field
   * @return {{likelyBot: boolean, reason?: string}}
   */
  checkHoneypot: function(honeyFieldValue) {
    const val = String(honeyFieldValue || '').trim();
    
    // Bot heuristics: field has >3 chars OR looks like URL/email
    if (val.length > 3) {
      return {likelyBot: true, reason: 'honeypot_field_filled'};
    }
    
    const hasUrlPattern = val.includes('http') || val.includes('.com');
    const hasEmailPattern = val.includes('@');
    if (hasUrlPattern || hasEmailPattern) {
      return {likelyBot: true, reason: 'suspicious_content_in_honey_field'};
    }

    return {likelyBot: false};
  },

  /**
   * Validate email field format (basic regex-based check, no external deps)
   * @param {string} email - Email address to validate  
   * @return {{valid: boolean, reason?: string}}
   */
  validateEmail: function(email) {
    const val = String(email || '').trim();

    if (!val) {
      return {valid: false, reason: 'email_required'};
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return {valid: false, reason: 'invalid_email_format'};
    }

    // Check for known spammy patterns (temporary domains, etc.)
    const commonSpamDomains = ['tempmail.com', 'throwaway.email', 'mailinator.com'];
    const domain = val.split('@')[1];
    
    if (domain && commonSpamDomains.some(spam => domain.toLowerCase().includes(spam))) {
      // Just flag it, don't block - log for review
      return {valid: true, suspicious: true, reason: 'likely_temporary_email_domain'};
    }

    return {valid: true};
  },

  /**
   * Get blacklist statistics (for monitoring/debugging)  
   * @return {{blacklistSize: number, attemptCount: number, recentAttempts: Array}}
   */
  getStats: function() {
    const recent = [];
    for (const [clientId, data] of ipBlacklist.entries()) {
      if (data && data.reason) {
        recent.push({clientId: clientId.substring(0, 16), reason: data.reason, attempts: data.attempts});
      }
    }

    return {
      blacklistSize: ipBlacklist.size,
      attemptCount: attemptTracker.size,
      recentAttempts: recent.slice(0, 10)
    };
  },

  // Internal helper: simple string hashing (no crypto for budget)  
  _hashString: function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  },

  // Export Map references for direct access if needed  
  ipBlacklist,
  attemptTracker
};
