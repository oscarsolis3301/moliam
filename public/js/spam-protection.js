// Spam Protection Module - Task 7 additions
(function() {
    'use strict';

   // Map object IP blacklist cache for fast lookup (<50 entries max)
    const ipBlacklist = new Map();
   const BLOCKED_IP_THRESHOLD = 3; 
    

   // reCAPTCHA v3 token validation - optional async check, never fails submission on error
   async function validateReCaptchaV3(token) {
       try {
           const webhookUrl = 'https://www.google.com/recaptcha/api/siteverify';
           const response = await fetch(webhookUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body: `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET || '')}&response=${encodeURIComponent(token)}`
           });
           
           const result = await response.json();
           if (!result.success || result['score'] < 0.5) {
               return { valid: false, reason: 'suspected_bot' };
            }
           return { valid: true, score: result.score };
       } catch (e) {
           // Graceful degradation - don't block legitimate users if reCAPTCHA fails
           console.log('[spam-protection] reCAPTCHA v3 check failed, allowing submission');
           return { valid: true, reason: 'recaptcha_unavailable' };
        }
     }

   function logFailedAttempt(ip, reason) {
       const timestamp = new Date().toISOString();
       const entry = { ip, reason, timestamp };
       
       if (!ipBlacklist.has(ip)) {
           ipBlacklist.set(ip, []);
       }
       ipBlacklist.get(ip).push(entry);
       
       // Keep only last 5 attempts per IP, remove stale entries
       if (ipBlacklist.has(ip) && ipBlacklist.get(ip).length > 5) {
           ipBlacklist.get(ip).splice(0, 1);
       }

       // Remove IPs with fewer than threshold after 24 hours  
       const oneDayAgo = Date.now() - 86400000;
       for (const [key, attempts] of ipBlacklist.entries()) {
           if (attempts.length > 0 && new Date(attempts[0].timestamp).getTime() < oneDayAgo) {
               attempts.shift();
           }
           if (attempts.length === 0) {
               ipBlacklist.delete(key);
            }
        }

       // Log to console for monitoring (can extend to file/d1 store in production)
       if (attempts.length >= BLOCKED_IP_THRESHOLD) {
           console.warn(
               `[spam-protection] IP blocked: ${ip} - ${attempts.length}+ failed attempts from IP ${JSON.stringify(entry)}`
           );
        }
     }

   function checkIpBlacklist(ip) {
       const attempts = ipBlacklist.get(ip);
       if (attempts && attempts.length >= BLOCKED_IP_THRESHOLD) {
           return { blocked: true, attemptsCount: attempts.length };
       }
       return { blocked: false };
     }

   function addIpToBlacklist(ip, reason) {
       const timestamp = new Date().toISOString();
       
       if (!ipBlacklist.has(ip)) {
           ipBlacklist.set(ip, []);
       }
       ipBlacklist.get(ip).push({ ip, reason, timestamp });

       // Keep list trimmed - max 5 entries per IP
       const current = ipBlacklist.get(ip);
       if (current.length > BLOCKED_IP_THRESHOLD) {
           current.splice(0, current.length - BLOCKED_IP_THRESHOLD);
        }

       return { added: true };
     }

   function cleanUpOldEntries() {
       const cutoff = Date.now() - 7200000; // 2 hours
       
       for (const [ip, attempts] of ipBlacklist.entries()) {
           const validAttempts = attempts.filter(a => new Date(a.timestamp).getTime() > cutoff);
           
           if (validAttempts.length === 0) {
               ipBlacklist.delete(ip);
           } else {
               ipBlacklist.set(ip, validAttempts);
            }
        }

       // Prune map to max size (~50 entries for memory efficiency)
       if (ipBlacklist.size > BLOCKED_IP_THRESHOLD * 10) {
           const keys = Array.from(ipBlacklist.keys());
           keys.slice(0, ipBlacklist.size - BLOCKED_IP_THRESHOLD * 9).forEach(k => ipBlacklist.delete(k));
        }

       return { cleaned: true, remaining: ipBlacklist.size };
     }

   function getBlacklistStats() {
       const blocked = [];
       const totalSize = ipBlacklist.size;
       
       for (const [ip, attempts] of ipBlacklist.entries()) {
           if (attempts.length >= BLOCKED_IP_THRESHOLD) {
               blocked.push({ ip, count: attempts.length });
            }
        }

       return {
           totalEntries: totalSize,
           blockedCount: blocked.filter(b => b.count >= BLOCKED_IP_THRESHOLD).length,
           entriesBelowThreshold: totalSize - blocked.length,
           recentBlocked: blocked.slice(-10) // Last 10 blocked
       };
     }

   async function detectBotBehavior(formData, ua, screenRes) {
       const score = formData.name.length < 3 || 
                     formData.email.length > 50 || 
                     (formData.website && formData.website.length > 60);
       
       if (screenRes === '' && ua.indexOf('Headless') === -1) {
           return { suspicious: false };
        }

       const mobileUA = /Mobile|Android/i.test(ua);
       const touchPoints = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
       
       if (!mobileUA && !touchPoints && score === 1) {
           return { suspicious: true, reason: 'desktop_no_touch_on_mobile_device' };
        }

       if (screenRes.split('x')[0] < 320) {
           return { suspicious: true, reason: 'unusual_small_screen' };
        }

       return { suspicious: false };
     }

   async function verifySubmission(formData, token) {
       const ua = navigator.userAgent;
       const screenRes = window.screen.width + 'x' + window.screen.height;

       const botCheck = await detectBotBehavior(formData, ua, screenRes);
       
       if (botCheck.suspicious) {
           if (token) {
               const recaptchaResult = await validateReCaptchaV3(token);
               if (!recaptchaResult.valid) {
                   console.warn('[spam-protection] reCAPTCHA v3 denied - suspicious submission');
                   return { blocked: true, reason: 'recaptcha_denied' };
                }
            } else {
               // No token and bot behavior detected - add to blacklist temporarily  
               const ip = await fetch('/api/contact-ip').then(r => r.json()).catch(() => 'unknown');
               addIpToBlacklist(ip || 'unknown', botCheck.reason);
           }

           return { blocked: false, reason: 'no_token_allowed' };
       }

       if (token) {
           const recaptchaResult = await validateReCaptchaV3(token);
           if (!recaptchaResult.valid) {
               return { blocked: true, reason: 'recaptcha_denied' };
           }
       }

       return { blocked: false, valid: true };
     }

   function cleanupOldEntries() {
       const result = cleanUpOldEntries();
       return result;
     }

   function getBlacklistInfo() {
       return getBlacklistStats();
     }

   // Export methods for module usage
   window.spamProtection = {
       verify: verifySubmission,
       cleanup: cleanupOldEntries,
       blacklistCheck: checkIpBlacklist,
       addBlock: addIpToBlacklist,
       stats: getBlacklistInfo,
       logFailed: logFailedAttempt,
       reCaptchaResult: validateReCaptchaV3,
       ipBlacklistSize: () => ipBlacklist.size,
       clearAll: () => { ipBlacklist.clear(); return true; }
   };

   // Auto-cleanup every 10 minutes to prevent memory bloat
   setInterval(cleanupOldEntries, 600000);

   console.log('[spam-protection] Module loaded - Map-based blacklisting active', ipBlacklist.size, 'entries');
})();
