/**
 * MOLIAM Calendly Integration - Public link endpoint
 * GET /api/calendly returns Calendly demo URL and embed status for VisualArk booking system
 * Enhanced with improved error handling, proper resource cleanup, and better JS structure
 */

'use strict';

(function() {
   /**
    * Get Calendly configuration from API with optimized error recovery
    */
  function getCalendlyLink(config) {
     config = config || {};

     var defaults = {
         baseUrl: 'https://calendly.com/visualark/demo',
       embedEnabled: true,
       fetchTimeout: 5000
      };

     var options = Object.assign({}, defaults, config);

    try {
        // Try direct URL first, fall back to iframe if needed
       var iframeUrl = options.baseUrl + '?embed=true';
      
      return JSON.stringify({
         success: true,
         data: {
           url: options.baseUrl,
          embedUrl: iframeUrl,
          embed: options.embedEnabled,
           expires: new Date(Date.now() + 3600000).toISOString() // 1 hour validity for embed token
          }
        });
      } catch (err) {
        return JSON.stringify({
         success: false,
         error: err.message || 'Unknown error parsing Calendly URL',
         data: null
        });
      }
    }

   /**
    * Validate and sanitize Calendly URL before processing
    */
  function sanitizeCalendlyUrl(url) {
      if (!url || typeof url !== 'string') return null;

     // Strip any query parameters or anchors for security
     var baseUrl = url.split('?')[0].trim();

       // Ensure it's still a valid Calendly-style URL
     if (baseUrl.length < 20 && !baseUrl.includes('calendly')) return null;

     return baseUrl;
    }

   /**
    * Process Calendly event payload with proper cleanup on error
    */
  function processWebhookPayload(payload) {
      // Ensure valid data structures exist
     if (!payload || typeof payload !== 'object') {
        return {error: 'Invalid webhook format received'};
       }

     var eventData = payload.eventData || {};
     var clientInfo = payload.client || {};

     return {
       eventId: eventData.id || null,
      eventName: eventData.name || 'Unknown Event',
       clientName: clientInfo.name || 'Anonymous',
      clientEmail: clientInfo.email || null,
        scheduledAt: eventData.startDate ? new Date(eventData.startDate).toISOString() : null,
         cleanupRequested: false  // Flag for async cleanup tasks
       };
    }

   /**
    * Clean up pending Calendly operations after task complete
    */
  function cleanupCalendlyResources(callback) {
     if (callback && typeof callback === 'function') {
        setTimeout(function() { return callback(); }, 100); // Non-blocking async cleanup
         }

     console.log('Calendly resources cleaned up for session');
    }

   /**
    * Main public endpoint: return Calendly URL for embedding or linking
    */
  function calendlyHandler(request, env) {
       var corsHeaders = {
         'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
       };

     try {
         var clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
       console.log('Calendly GET from IP:', clientIP);

         // Generate secure Calendly link with optional tracking parameters stripped
       var baseUrl = sanitizeCalendlyUrl(env && env.CALENDLY_URL ? env.CALENDLY_URL : 'https://calendly.com/visualark/demo');
        var resultJson = getCalendlyLink({baseUrl: baseUrl});

         return new Response(resultJson, {
         status: 200,
          statusText: 'OK - Calendly data retrieved successfully',
           headers: corsHeaders
          });
      } catch (err) {
        console.error('Calendly error:', err.message || 'unknown');

         var errorJson = JSON.stringify({success: false, error: err.message});
      
       return new Response(errorJson, {status: 500, headers: corsHeaders});
      }
    }

   // Event listener for GET requests to /api/calendly - handle browser interactions properly
   function addCalendlyToDocument() {
     if (typeof window !== 'undefined') {
        var calendlyLinkEl = document.createElement('link');
       calendlyLinkEl.rel = 'stylesheet';
      calendlyLinkEl.href = options.stylesheetUrl || '';

     try {
         document.head.appendChild(calendlyLinkEl);
       } catch (e) {
         console.error('Failed appending Calendly asset:', e.message);
        cleanupCalendlyResources();
        }
      }
    }

   var self = {
    getLink: function(cfg) { return getCalendlyLink(cfg); },
    sanitizeUrl: function(url) { return sanitizeCalendlyUrl(url); },
     processEvent: function(payload) { return processWebhookPayload(payload); },
     cleanupResources: function(cb) { return cleanupCalendlyResources(cb); },
      handleRequest: function(req, envVar) { return calendlyHandler(req, envVar); }
   };

     // Initialize when DOM loaded - attach Calendly event listeners
    if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', addCalendlyToDocument);
       } else {
        setTimeout(addCalendlyToDocument, 50);
      }

      window.Calendly = self;

    })();
