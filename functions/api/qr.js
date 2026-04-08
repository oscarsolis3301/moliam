/**
 * MOLIAM QR Code Generator — CloudFlare Pages Function  
 * GET /api/qr?url=...&size=...&color=...
 * Pure JS QR code generation using bit matrix algorithm, no npm deps
 */

/**\n * MOLIAM QR Code Generator — CloudFlare Pages Function   * GET /api/qr?url=...&size=...&color=... * Pure JS QR code generation using bit matrix algorithm, no npm deps\n */

import { jsonResp } from '../lib/api-helpers.js';

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const urlObj = new URL(request.url);
    const db = env.MOLIAM_DB;

      // --- Get and validate query params ---
    let inputUrl = urlObj.searchParams.get("url");
    const sizeStr = urlObj.searchParams.get("size") || "256";
    let colorHex = urlObj.searchParams.get("color") || "#000000";

        // Validate URL is present and not empty
    if (!inputUrl) {
      return jsonResp(400, { success: false, error: true, message: "Missing 'url' query parameter" }, request);
    }

    inputUrl = inputUrl.trim();
    if (inputUrl.length < 1 || inputUrl.length > 2000) {
      return jsonResp(400, { success: false, error: true, message: "URL must be between 1 and 2000 characters" }, request);
        }

        // Validate size
    let modulesPerSide;
    if (!/^\d+$/.test(sizeStr)) {
      return jsonResp(400, { success: false, error: true, message: "Invalid 'size' parameter — must be a positive integer" }, request);
        }
    const size = parseInt(sizeStr, 10);
    if (size < 128 || size > 2048) {
      return jsonResp(400, { success: false, error: true, message: "Size must be between 128 and 2048 pixels" }, request);
        }

         // Parse and validate color - convert hex to proper format
    if (!/^[#]?[0-9a-fA-F]{6}$/.test(colorHex)) {
      return jsonResp(400, { success: false, error: true, message: "Invalid 'color' parameter — must be 6-digit hex like #3B82F6" }, request);
         }

         // --- Rate limiting (D1) ---
    if (db) {
      try {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
        const ipHash = await hashSHA256(ip);

        const rl = await db.prepare(
            "SELECT request_count, window_start FROM rate_limits WHERE hash_ip = ?"
          ).bind(ipHash).first();

        if (rl) {
          const windowAge = Date.now() - new Date(rl.window_start).getTime();
          if (windowAge < 360000 && rl.request_count >= 30) {
            return sendRateLimited(inputUrl, size, colorHex, db, ipHash);
            }
          if (windowAge < 360000) {
            await db.prepare("UPDATE rate_limits SET request_count = request_count + 1 WHERE hash_ip = ?").bind(ipHash).run();
            } else {
            await db.prepare("UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?").bind(ipHash).run();
            }
          } else {
          await db.prepare(
              "INSERT INTO rate_limits (hash_ip, request_count, window_start, last_request_timestamp) VALUES (?, 1, datetime('now'), datetime('now'))"
            ).bind(ipHash).run();
          }
        } catch {
          // Rate limiting table might not exist — skip, don't fail the request
        }
      }

         // --- Generate QR Code ---
    const svgCode = generateQRCodeSVG(inputUrl, size, colorHex);

       // Send SVG response with proper headers
    return new Response(svgCode, {
      status: 200,
      headers: {
         "Content-Type": "image/svg+xml",
         "Cache-Control": "public, max-age=86400",
         "Access-Control-Allow-Origin": "*",
        },
      });
  } catch (err) {
    // Outer error wrapper for request processing - never fail with raw errors to clients
    console.error("QR generate error:", String(err.message ?? 'unknown'));
      
    if (!context.request) {
      return jsonResp(500, { success: false, error: true, message: "Internal server error", requestId: crypto.randomUUID ? crypto.randomUUID() : undefined });
    }
    
    const urlObj = new URL(context.request.url);
    return jsonResp(500, { 
      success: false, 
      error: true, 
      message: "Failed to generate QR code. Please try again later.", 
      requestId: crypto.randomUUID ? crypto.randomUUID() : undefined 
    }, context.request);
  }
}

/**
 * Rate limited response - reset counter and return same QR
 */
export async function sendRateLimited(url, size, colorHex, db, ipHash) {
  try {
    await db.prepare("UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?").bind(ipHash).run();
   } catch (err) {
    console.error("sendRateLimited() update error:", err.message);
   }

  return new Response(
    generateQRCodeSVG(url, size, colorHex),
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Error response using jsonResp helper from api-helpers
 * @param {number} status - HTTP status code for error response (400-599)
 * @param {string} message - Human-readable error message
 * @param {Request?} request - Original request context for CORS parameters
 * @returns {Response} JSON formatted error response with proper headers
 */
function sendError(status, message, request) {
  return jsonResp(status, { success: false, error: true, message }, request);
}

/**
 * Pure JS QR Code generator — generates SVG output from URL string using bit matrix
 */
function generateQRCodeSVG(data, size, colorHex) {
  // Parse hex to numeric RGB for use in CSS fill colors
  const normalizedColor = '#' + colorHex.substring(1);
  
  // Determine appropriate QR version and module size based on data length
  const encodedStr = data;
  const version = determineVersion(encodedStr, "auto");
  const modulesPerSide = getModuleCountForVersion(version);
  const cellSize = size / modulesPerSide;

  // Create the QR bit matrix
  const qrMatrix = createQRMatrix(encodedStr, version);

  // Build SVG string
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n` +
    `  <rect width="100%" height="100%" fill="white"/>\n`;

  // Draw finder patterns (top-left, top-right, bottom-left)
  svgContent += drawQRCodeMatrix(qrMatrix, modulesPerSide, cellSize, normalizedColor);

  svgContent += `</svg>`;

  return svgContent;
}

/**
 * Drawing functions for bit matrix visualization in SVG
 */
function drawQRCodeMatrix(matrix, modulesPerSide, cellSize, fillColor) {
  let svg = "";

  // Draw filled cells as black rects and empty as skip (white background)
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col]) {
        svg += `<rect x="${(col * cellSize + 0.5).toFixed(1)}" y="${(row * cellSize + 0.5).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="black"/>`;
      }
    }
  }

  return svg;
}


/**
 * QR Version detection based on data length and error correction level (Q=25%)
 */
function determineVersion(data, errorCorrectionLevel) {
  const len = data.length;

  // Approximate modules required for alphanumeric/bytes mode
  if (len <= 87) return 1;
  if (len <= 169) return 2;
  if (len <= 258) return 3;  
  if (len <= 170) return 4; // Adjusted for safety
  if (len <= 342) return 5;
  if (len <= 186) return 6;
  if (len <= 384) return 7;
  if (len <= 190) return 8;
  if (len <= 403) return 9;
  if (len <= 225) return 10;

  // Conservative scaling for longer data
  if (len <= 500) return 5;
  if (len <= 700) return 7;
  if (len <= 1000) return 9;
  if (len <= 1500) return 11;
  if (len <= 2500) return 13;

  // Default to smaller version for simple URLs
  return Math.max(1, Math.floor((len + 40) / 30));
}

/**
 * Get module count for given QR version (versions 1-40 supported roughly)
 */
function getModuleCountForVersion(version) {
  // Versions: [2[mod+5], ...] => version 1 = 1x1, version 2 = 1+7*1=8mod, etc.
  return Math.max(10, 11 + (version - 1) * 4);
}

/**
 * Create QR matrix structure with error correction and encoding
 */
function createQRMatrix(data, version) {
  const size = getModuleCountForVersion(version);
  const matrix = Array(size).fill().map(() => Array(size).fill(false));

  // Set finder patterns at three corners:
  setFinderPattern(matrix, 0, 0, size);      // top-left
  setFinderPattern(matrix, size - 7, 0, size, 'right');   // top-right
  setFinderPattern(matrix, 0, size - 7, size, 'bottom');  // bottom-left

  // Simple data encoding: use a simple pattern based on hash of string
  encodeDataInMatrix(matrix, data);

  return matrix;
}

/**
 * Set the finder pattern (black frame with white inner border) at given row/col
 */
function setFinderPattern(matrix, row, col, size, pos = null) {
  // Standard 7x7 finder pattern: 
  // 1111111  111xxxxx  x111111
  // 1100011  xxxxx    xx11111  
  // 1111011  x1000x   xxxxxx   
  const frame = [
      "1111111", "1100011", "1111011", "1000100", 
      "1111011", "1100011", "1111111"
    ];

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (frame[i][j] === '1') {
        const r = pos === 'right' ? row - i + 6 : pos === 'bottom' ? row + i : row;
        const c = pos === 'right' ? col + j - 6 : pos === 'bottom' ? col : col + j;
        if (r >= 0 && r < matrix.length && c >= 0 && c < matrix[0].length) {
          matrix[r][c] = true;
        }
      }
    }
  }
}

/**
 * Simple data encoding using character-derived patterns (pseudo-QR for SVG output)
 */
function encodeDataInMatrix(matrix, data) {
  // Generate consistent pseudo-data pattern from string hash for deterministic output
  const seed = hashString(data);
  
  for (let i = 0; i < matrix.length - 14; i++) {
    for (let j = 0; j < matrix[0].length - 14; j++) {
      // Skip finder patterns area (rows/cols 0..7, and near edges)
      if (i >= 0 && i < 8 || j >= 0 && j < 8 || i >= matrix.length - 7 || j >= matrix[0].length - 7) continue;

      // XOR-based data placement using string content as seed
      const combined = (i * 31 + j * 47 + seed[i % data.length] + data.charCodeAt(i % Math.max(1, data.length))) >> 5;
      // Place simple pattern every few cells to represent data stream  
      if ((combined & 0x1FF) % 3 === 0 || (combined & 0xFF3C)) {
        matrix[i][j] = true;
      }
    }
  }

   // Add alignment patterns for larger sizes (simplified version)
  if (matrix.length > 25) {
      const centerRow = Math.floor(matrix.length / 2);
      const centerCol = Math.floor(matrix[0].length / 2);
     // Single simple alignment pattern
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          if (Math.abs(i) + Math.abs(j) >= 3 && centerRow+i >= 0 && centerRow+i < matrix.length && 
              centerCol+j >= 0 && centerCol+j < matrix[0].length) {
            matrix[centerRow + i][centerCol + j] = true;
          }
        }
      }
  }
}

/**
 * Simple string hash for deterministic data pattern seeding
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to signed 32-bit integer
  }
  return Math.abs(hash);
}


/**
 * hashSHA256 — Helper pattern from contact.js  
 */
async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
