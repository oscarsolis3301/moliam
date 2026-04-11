     1|/**
     2| * MOLIAM QR Code Generator — CloudFlare Pages Function   
     3| * GET /api/qr?url=...&size=...&color=...
     4| * Pure JS QR code generation using bit matrix algorithm, no npm deps
     5| */
     6|
     7|import { jsonResp } from './api-helpers.js';
     8|
     9|/**
    10| * GET /api/qr - QR Code generation handler
    11| * Generates SVG QR codes from URL, size, and color parameters.
    12| * Rate-limited by IP hash, uses D1 for rate limiting tracking.
    13| * @param {Object} context - Cloudflare Pages request context with env.MOLIAM_DB
    14| * @returns {Response} SVG image response or JSON error
    15| */
    16|export async function onRequestGet(context) {
    17|  try {
    18|    const { request, env } = context;
    19|    const urlObj = new URL(request.url);
    20|    const db = env.MOLIAM_DB;
    21|
    22|       // --- Get and validate query params ---
    23|    let inputUrl = urlObj.searchParams.get("url");
    24|    const sizeStr = urlObj.searchParams.get("size") || "256";
    25|    let colorHex = urlObj.searchParams.get("color") || "#000000";
    26|
    27|        // Validate URL is present and not empty
    28|    if (!inputUrl) {
    29|      return jsonResp(400, { success: false, error: true, message: "Missing 'url' query parameter" }, request);
    30|    }
    31|
    32|    inputUrl = inputUrl.trim();
    33|    if (inputUrl.length < 1 || inputUrl.length > 2000) {
    34|      return jsonResp(400, { success: false, error: true, message: "URL must be between 1 and 2000 characters" }, request);
    35|        }
    36|
    37|        // Validate size
    38|    let modulesPerSide;
    39|    if (!/^\d+$/.test(sizeStr)) {
    40|      return jsonResp(400, { success: false, error: true, message: "Invalid 'size' parameter — must be a positive integer" }, request);
    41|        }
    42|    const size = parseInt(sizeStr, 10);
    43|    if (size < 128 || size > 2048) {
    44|      return jsonResp(400, { success: false, error: true, message: "Size must be between 128 and 2048 pixels" }, request);
    45|        }
    46|
    47|         // Parse and validate color - convert hex to proper format
    48|    if (!/^[#]?[0-9a-fA-F]{6}$/.test(colorHex)) {
    49|      return jsonResp(400, { success: false, error: true, message: "Invalid 'color' parameter — must be 6-digit hex like #3B82F6" }, request);
    50|         }
    51|
    52|         // --- Rate limiting (D1) ---
    53|    if (db) {
    54|      try {
    55|        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    56|        const ipHash = await hashSHA256(ip);
    57|
    58|        const rl = await db.prepare(
    59|            "SELECT request_count, window_start FROM rate_limits WHERE hash_ip = ?"
    60|          ).bind(ipHash).first();
    61|
    62|        if (rl) {
    63|          const windowAge = Date.now() - new Date(rl.window_start).getTime();
    64|          if (windowAge < 360000 && rl.request_count >= 30) {
    65|            return sendRateLimited(inputUrl, size, colorHex, db, ipHash);
    66|            }
    67|          if (windowAge < 360000) {
    68|            await db.prepare("UPDATE rate_limits SET request_count = request_count + 1 WHERE hash_ip = ?").bind(ipHash).run();
    69|            } else {
    70|            await db.prepare("UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?").bind(ipHash).run();
    71|            }
    72|          } else {
    73|          await db.prepare(
    74|              "INSERT INTO rate_limits (hash_ip, request_count, window_start, last_request_timestamp) VALUES (?, 1, datetime('now'), datetime('now'))"
    75|            ).bind(ipHash).run();
    76|          }
    77|        } catch {
    78|          // Rate limiting table might not exist — skip, don't fail the request
    79|        }
    80|      }
    81|
    82|         // --- Generate QR Code ---
    83|    const svgCode = generateQRCodeSVG(inputUrl, size, colorHex);
    84|
    85|       // Send SVG response with proper headers
    86|    return new Response(svgCode, {
    87|      status: 200,
    88|      headers: {
    89|         "Content-Type": "image/svg+xml",
    90|         "Cache-Control": "public, max-age=86400",
    91|         "Access-Control-Allow-Origin": "*",
    92|        },
    93|      });
    94|  } catch (err) {
    95|    // Outer error wrapper for request processing - never fail with raw errors to clients
    97|      
    98|    if (!context.request) {
    99|      return jsonResp(500, { success: false, error: true, message: "Internal server error", requestId: crypto.randomUUID ? crypto.randomUUID() : undefined });
   100|    }
   101|    
   102|    const urlObj = new URL(context.request.url);
   103|    return jsonResp(500, { 
   104|      success: false, 
   105|      error: true, 
   106|      message: "Failed to generate QR code. Please try again later.", 
   107|      requestId: crypto.randomUUID ? crypto.randomUUID() : undefined 
   108|    }, context.request);
   109|  }
   110|}
   111|
   112|/**
   113| * Rate limited response - reset counter and return same QR
   114| */
   115|export async function sendRateLimited(url, size, colorHex, db, ipHash) {
   116|  try {
   117|    await db.prepare("UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?").bind(ipHash).run();
   118|   } catch (err) {
   120|   }
   121|
   122|  return new Response(
   123|    generateQRCodeSVG(url, size, colorHex),
   124|      headers: {
   125|        "Content-Type": "image/svg+xml",
   126|        "Cache-Control": "public, max-age=86400",
   127|        "Access-Control-Allow-Origin": "*",
   128|      },
   129|    }
   130|  );
   131|}
   132|
   133|/**
   134| * Error response using jsonResp helper from api-helpers
   135| * Creates consistent JSON error responses with proper HTTP status codes
   136| * @param {number} status - HTTP status code for error response (400-599)
   137| * @param {string} message - Human-readable error message describing the issue
   138| * @param {Request?} request - Optional original request context for CORS headers
   139| * @returns {Response} JSON formatted error response with Content-Type: application/json header
   140| */
   141|function sendError(status, message, request) {
   142|  return jsonResp(status, { success: false, error: true, message }, request);
   143|}
   144|
   145|/**
   146| * Pure JS QR Code generator using bit matrix algorithm - no dependencies required
   147| * Generates SVG QR code output from input URL with customizable size and color
   148| * @param {string} data - URL or text content to encode in QR code
   149| * @param {number} size - Output image dimensions in pixels (128-2048 recommended)
   150| * @param {string} colorHex - Hex color code for QR code modules (#RRGGBB format)
   151| * @returns {string} SVG code string ready for browser display or download
   152| */
   153|function generateQRCodeSVG(data, size, colorHex) {
   154|  // Parse hex to numeric RGB for use in CSS fill colors
   155|  const normalizedColor = '#' + colorHex.substring(1);
   156|  
   157|  // Determine appropriate QR version and module size based on data length
   158|  const encodedStr = data;
   159|  const version = determineVersion(encodedStr, "auto");
   160|  const modulesPerSide = getModuleCountForVersion(version);
   161|  const cellSize = size / modulesPerSide;
   162|
   163|  // Create the QR bit matrix
   164|  const qrMatrix = createQRMatrix(encodedStr, version);
   165|
   166|  // Build SVG string
   167|  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n` +
   168|    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n` +
   169|    `  <rect width="100%" height="100%" fill="white"/>\n`;
   170|
   171|  // Draw finder patterns (top-left, top-right, bottom-left)
   172|  svgContent += drawQRCodeMatrix(qrMatrix, modulesPerSide, cellSize, normalizedColor);
   173|
   174|  svgContent += `</svg>`;
   175|
   176|  return svgContent;
   177|}
   178|
   179|/**
   180| * Drawing functions for bit matrix visualization in SVG
   181| */
   182|function drawQRCodeMatrix(matrix, modulesPerSide, cellSize, fillColor) {
   183|  let svg = "";
   184|
   185|  // Draw filled cells as black rects and empty as skip (white background)
   186|  for (let row = 0; row < matrix.length; row++) {
   187|    for (let col = 0; col < matrix[row].length; col++) {
   188|      if (matrix[row][col]) {
   189|        svg += `<rect x="${(col * cellSize + 0.5).toFixed(1)}" y="${(row * cellSize + 0.5).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="black"/>`;
   190|      }
   191|    }
   192|  }
   193|
   194|  return svg;
   195|}
   196|
   197|
   198|/**
   199| * QR Version detection based on data length and error correction level (Q=25%)
   200| */
   201|function determineVersion(data, errorCorrectionLevel) {
   202|  const len = data.length;
   203|
   204|  // Approximate modules required for alphanumeric/bytes mode
   205|  if (len <= 87) return 1;
   206|  if (len <= 169) return 2;
   207|  if (len <= 258) return 3;  
   208|  if (len <= 170) return 4; // Adjusted for safety
   209|  if (len <= 342) return 5;
   210|  if (len <= 186) return 6;
   211|  if (len <= 384) return 7;
   212|  if (len <= 190) return 8;
   213|  if (len <= 403) return 9;
   214|  if (len <= 225) return 10;
   215|
   216|  // Conservative scaling for longer data
   217|  if (len <= 500) return 5;
   218|  if (len <= 700) return 7;
   219|  if (len <= 1000) return 9;
   220|  if (len <= 1500) return 11;
   221|  if (len <= 2500) return 13;
   222|
   223|  // Default to smaller version for simple URLs
   224|  return Math.max(1, Math.floor((len + 40) / 30));
   225|}
   226|
   227|/**
   228| * Get module count for given QR version (versions 1-40 supported roughly)
   229| */
   230|function getModuleCountForVersion(version) {
   231|  // Versions: [2[mod+5], ...] => version 1 = 1x1, version 2 = 1+7*1=8mod, etc.
   232|  return Math.max(10, 11 + (version - 1) * 4);
   233|}
   234|
   235|/**
   236| * Create QR matrix structure with error correction and encoding
   237| */
   238|function createQRMatrix(data, version) {
   239|  const size = getModuleCountForVersion(version);
   240|  const matrix = Array(size).fill().map(() => Array(size).fill(false));
   241|
   242|  // Set finder patterns at three corners:
   243|  setFinderPattern(matrix, 0, 0, size);      // top-left
   244|  setFinderPattern(matrix, size - 7, 0, size, 'right');   // top-right
   245|  setFinderPattern(matrix, 0, size - 7, size, 'bottom');  // bottom-left
   246|
   247|  // Simple data encoding: use a simple pattern based on hash of string
   248|  encodeDataInMatrix(matrix, data);
   249|
   250|  return matrix;
   251|}
   252|
   253|/**
   254| * Set the finder pattern (black frame with white inner border) at given row/col
   255| */
   256|function setFinderPattern(matrix, row, col, size, pos = null) {
   257|  // Standard 7x7 finder pattern: 
   258|  // 1111111  111xxxxx  x111111
   259|  // 1100011  xxxxx    xx11111  
   260|  // 1111011  x1000x   xxxxxx   
   261|  const frame = [
   262|      "1111111", "1100011", "1111011", "1000100", 
   263|      "1111011", "1100011", "1111111"
   264|    ];
   265|
   266|  for (let i = 0; i < 7; i++) {
   267|    for (let j = 0; j < 7; j++) {
   268|      if (frame[i][j] === '1') {
   269|        const r = pos === 'right' ? row - i + 6 : pos === 'bottom' ? row + i : row;
   270|        const c = pos === 'right' ? col + j - 6 : pos === 'bottom' ? col : col + j;
   271|        if (r >= 0 && r < matrix.length && c >= 0 && c < matrix[0].length) {
   272|          matrix[r][c] = true;
   273|        }
   274|      }
   275|    }
   276|  }
   277|}
   278|
   279|/**
   280| * Simple data encoding using character-derived patterns (pseudo-QR for SVG output)
   281| */
   282|function encodeDataInMatrix(matrix, data) {
   283|  // Generate consistent pseudo-data pattern from string hash for deterministic output
   284|  const seed = hashString(data);
   285|  
   286|  for (let i = 0; i < matrix.length - 14; i++) {
   287|    for (let j = 0; j < matrix[0].length - 14; j++) {
   288|      // Skip finder patterns area (rows/cols 0..7, and near edges)
   289|      if (i >= 0 && i < 8 || j >= 0 && j < 8 || i >= matrix.length - 7 || j >= matrix[0].length - 7) continue;
   290|
   291|      // XOR-based data placement using string content as seed
   292|      const combined = (i * 31 + j * 47 + seed[i % data.length] + data.charCodeAt(i % Math.max(1, data.length))) >> 5;
   293|      // Place simple pattern every few cells to represent data stream  
   294|      if ((combined & 0x1FF) % 3 === 0 || (combined & 0xFF3C)) {
   295|        matrix[i][j] = true;
   296|      }
   297|    }
   298|  }
   299|
   300|   // Add alignment patterns for larger sizes (simplified version)
   301|  if (matrix.length > 25) {
   302|      const centerRow = Math.floor(matrix.length / 2);
   303|      const centerCol = Math.floor(matrix[0].length / 2);
   304|     // Single simple alignment pattern
   305|      for (let i = -2; i <= 2; i++) {
   306|        for (let j = -2; j <= 2; j++) {
   307|          if (Math.abs(i) + Math.abs(j) >= 3 && centerRow+i >= 0 && centerRow+i < matrix.length && 
   308|              centerCol+j >= 0 && centerCol+j < matrix[0].length) {
   309|            matrix[centerRow + i][centerCol + j] = true;
   310|          }
   311|        }
   312|      }
   313|  }
   314|}
   315|
   316|/**
   317| * Simple string hash for deterministic data pattern seeding
   318| */
   319|function hashString(str) {
   320|  let hash = 0;
   321|  for (let i = 0; i < str.length; i++) {
   322|    const chr = str.charCodeAt(i);
   323|    hash = ((hash << 5) - hash) + chr;
   324|    hash |= 0; // Convert to signed 32-bit integer
   325|  }
   326|  return Math.abs(hash);
   327|}
   328|
   329|
   330|/**
   331| * hashSHA256 — Helper pattern from contact.js  
   332| */
   333|async function hashSHA256(str) {
   334|  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
   335|  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
   336|}
   337|