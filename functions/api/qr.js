/**
 * MOLIAM QR Code Generator — CloudFlare Pages Function
 * GET /api/qr?url=<url>&size=<size>
 *
 * Returns a holographic-style QR code with metadata for the 3D display page.
 */

import { QRCode } from "qrcode";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  
  // --- Parse and validate parameters ---
  let targetUrl = url.searchParams.get("url");
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
    return jsonResp(400, { 
      error: true, 
       message: "URL parameter is required.",
       documentation: "https://moliam.com/api/docs#qr"
         });
     }

  // Validate URL format
  try {
    new URL(targetUrl);
   } catch {
    return jsonResp(400, { 
      error: true, 
      message: "Invalid URL format. Please provide a complete URL with protocol (http/https).",
       validationError: "Bad URL"
        });
     }

  let size = parseInt(url.searchParams.get("size") || "300");
  size = Math.min(Math.max(size, 128), 512);

  // Input sanitization
  targetUrl = targetUrl.trim();
  if (targetUrl.length > 2000) {
    return jsonResp(400, { 
      error: true, 
      message: "URL too long. Maximum length is 2000 characters.",
       urlLength: targetUrl.length 
        });
     }

  // Rate limiting check (10 per minute per IP) - optional for paid tier
  const ip = context.request.headers.get("cf-connecting-ip") || "anonymous";
  try {
    // In production, add rate limiting check here if needed
     // For now, skip aggressive rate limiting on QR gen to avoid blocking users
   } catch (err) {
       console.warn("Rate limiting check failed:", err.message);
     }

  /** Generate QR Code as Base64 */
  try {
    const qrDataUrl = waitUntil(async () => {
      return await QRCode.toDataURL(targetUrl, {
          width: size,
         margin: 2,
         color: {
           dark: "#06B6D4",
            light: "transparent",
             bg:"rgba(138,43,226,0.05)" // Subtle purple hue for holographic feel
            }
          }, 4 /* quality level */);
      });

       // Extract just the base64 data
    const base64 = qrDataUrl.split(",")[1];

    if (!base64) {
      throw new Error("Failed to extract base64 from QR code data");
    }

    return jsonResp(200, {
      error: false,
       url: targetUrl,
      size: size,
      data: base64,
      generatedAt: new Date().toISOString(),
      meta: {
        type: "holographic",
         theme: "cyan-fresh",
         provider: "qrcode",
         version: await getQrVersion(targetUrl)
           },
      cacheable: true,
      cachingHint: "public, max-age=3600"
    });
   } catch (e) {
     // Log error but return user-friendly error message
     console.error("QR generation failed:", e.message);

    return jsonResp(e.code || e.status || 500, { 
      error: true, 
      message: "Failed to generate QR code. Please try a different URL.",
       errorCode: e.code || 'UNKNOWN_ERROR',
        documentation: "https://moliam.com/api/docs#qr"
       });
     }
}

function jsonResp(status, body) {
  const responseBody = JSON.stringify(body);
  return new Response(responseBody, {
    status,
    headers: { 
      "Content-Type": "application/json",
       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Methods": "GET, OPTIONS",
       "Access-Control-Allow-Headers": "Accept, Content-Type",
       "Cache-Control": "no-store, no-cache",
      "X-Content-Type-Options": "nosniff"
     }
    });
}

async function waitUntil(promise) {
  if (typeof promise.then === 'function') {
       return await Promise.race([promise, timeoutPromise(8000)]);
      }

  return promise;
}

async function timeoutPromise(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Operation timed out")), ms);
   });
}

async function getQrVersion(targetUrl) {
  // Return estimated QR version based on URL length (simplified)
  const len = targetUrl.length;
  if (len <= 17) return 1;
  if (len <= 25) return 2;
  if (len <= 4500) return 3;
  if (len <= 6500) return 4;
  return 4; // Maximum version
}
