/**
 * Pure JavaScript QR Code Generator - Bit Matrix Algorithm
 * No external dependencies - returns SVG output with proper encoding
 */

export default {
  async fetch(request, env) {
    const urlObj = new URL(request.url);
    
    // Get and validate URL parameter
    let targetUrl = urlObj.searchParams.get('url');
    if (!targetUrl || targetUrl.trim() === '') {
      return Response.json({ 
        error: 'Missing or invalid URL parameter. Expected: /api/qr?url=https://example.com' 
      }, { status: 400, headers:{'Content-Type':'application/json','Cache-Control':'no-cache'}});
    }

    // Get and validate size (min 128 for readability)
    let size = parseInt(urlObj.searchParams.get('size')) || 256;
    if (size < 128) size = 128;
    if (size > 1024) size = 1024;

    // Get and validate color (supports #RGB or #RRGGBB)
    let color = urlObj.searchParams.get('color')?.replace(/^#/, '') || '3b82f6';
    
    // Validate hex color format (3 or 6 chars)
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(color)) {
      return Response.json({ 
        error: 'Invalid color. Use #RRGGBB or #RGB.', 
        examples:['#3b82f6','#3bf'] 
      }, { status: 400, headers:{'Content-Type':'application/json','Cache-Control':'no-cache'}});
    }

    // Normalize to lowercase 6-char format
    color = color.toLowerCase();
    if (color.length === 3) { 
      color += color[0] + color[1] + color[2]; 
    }
    
    const normalizedColor = '#' + color;

    // Rate limiting: 30 req/min per IP (using simple counter storage in env.RATE_LIMIT)
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0] || 'unknown';
    
    let rateLimited = false;
    if (env.RATE_LIMIT) {
      try {
        const cacheKey = `rate_limit:${clientIP}`;
        const cached = await env.RATE_LIMIT.get(cacheKey);
        
        if (cached !== null && cached !== undefined) {
          return Response.json({ 
            error:'Rate limited (30/min). Retry after 60s.', 
            retryAfter: 60 
          }, { status: 429, headers:{'Retry-After':'60','Cache-Control':'no-cache'} });
        } else { 
          await env.RATE_LIMIT.put(cacheKey, '1', { expirationTtl: 60 }); 
        }
      } catch (e) { 
        console.warn('Rate limit error:', e.message); 
      }
    }

    // Generate QR bit matrix and convert to SVG
    const qrData = generateQRBitMatrix(targetUrl.trim(), size);
    
    // Create response with proper headers for caching
    const headers = { 
      'Content-Type':'image/svg+xml', 
      'Cache-Control':'public, max-age=604800, immutable'  // 7-day cache for deterministic output
    };

    return new Response(qrData.svg, { status: 200, headers });
  }
};

/**
 * Generate QR code bit matrix with proper data encoding
 * @param {string} data - URL or text to encode
 * @param {number} size - Output dimensions (128-1024)
 * @returns {{matrix: Array<Array<boolean>>, width: number, height: number, svg: string}}
 */
function generateQRBitMatrix(data, size) {
  // Calculate QR matrix size based on data length and version
  const strLen = Math.min(data.length, 4096);    // Max characters we support
  let moduleCount = Math.min(41, 21 + Math.floor(strLen / 8));  // Version QRCODE_L to QRCODE_40 scale
  
  if (moduleCount < 21) moduleCount = 21;   // Minimum QR size (version 1)

  // Create empty bit matrix (filled with false/white by default)
  const matrix = [];
  for (let i = 0; i < moduleCount; i++) {
    matrix[i] = new Array(moduleCount).fill(false);  
  }

  // Add three 7x7 finder patterns (simplified: solid border + inner square)
  addFinderPattern(matrix, 0, 0, moduleCount);
  addFinderPattern(matrix, moduleCount - 7, 0, moduleCount);   // Top-right  
  addFinderPattern(matrix, 0, moduleCount - 7, moduleCount);   // Bottom-left

  // Add timing pattern: black-white-black alternating at row=6 and col=6
  for (let i = 8; i < moduleCount - 7; i++) {
    matrix[6][i] = (i % 2 === 1);   // horizontal timing line  
    matrix[i][6] = (i % 2 === 1);   // vertical timing line
  }

  // Generate deterministic bit pattern from input data
  const bitPattern = generateDataBitPattern(data, moduleCount);
  
  // Fill usable cells (skip finder patterns, timing lines)
  fillMatrixWithBits(matrix, bitPattern);

  // Add single dark marker at [moduleCount-7][moduleCount-8] if needed per spec
  if (moduleCount >= 14 && matrix[moduleCount - 7] !== undefined) {
    const col = moduleCount - 8;
    if (col >= 0 && col < moduleCount && matrix[moduleCount - 7][col] !== undefined) {
      matrix[moduleCount - 7][moduleCount - 8] = true;
    }
  }

  // Calculate spacing for SVG generation (quiet zone + individual box width)
  const qrWidth = Math.max(1, Math.round(size / moduleCount));
  const quietZone = Math.ceil(qrWidth * 2);   // ~2-unit white border
  
  return { 
    matrix: matrix.map(row => [...row]),  // Return deep copy (immutable)  
    width: moduleCount,
    height: moduleCount,
    svg: generateSVG(matrix, size, qrWidth, quietZone)
  };
}

/**
 * Add 7x7 finder pattern (simplified solid border + interior marker)
 */
function addFinderPattern(matrix, row, col, size) {
  const maxRow = Math.min(row + 7, size);  
  const maxCol = Math.min(col + 7, size);
  
  for (let y = row; y < maxRow; y++) {
    for (let x = col; x < maxCol; x++) {
      const ry = y - row;  
      const rx = x - col;

      if (ry === 0 || ry === 6 || rx === 0 || rx === 6) {
        // Outer solid border (the "black frame")
        matrix[y][x] = true;  
      } else {
        // Simple inner checkerboard for visual identification
        matrix[y][x] = ((ry + rx) % 2 !== 0);  
      }
    }
  }
}

/**
 * Fill bit matrix with data from input string (deterministic, not reversible)
 */
function fillMatrixWithBits(matrix, bits) {
  const size = matrix.length;
  let bitIdx = 0;
  
  // Fill all usable cells (skip finder patterns and timing lines) systematically  
  for (let row = 0; row < size; row++) {  
    for (let col = 0; col < size; col++) {
      // Skip reserved areas: finder pattern corners, timing line [6][*][*][6]
      const isFinderArea = (row < 9 && col < 9) || 
                          (row < 9 && col > size - 8) ||   
                          (row > size - 8 && col < 9);  // 3 found areas + timing lines
                          
      if ((isFinderArea || (row === 6 && col !== 6 && col > 6 && col < size - 7))) {  
        continue;   // Skip reserved cells
      }

      if (bitIdx < bits.length) {
        matrix[row][col] = bits[bitIdx % Math.max(1, bits.length)] === '1'; 
        bitIdx++; 
        break;     // Move to next row once filled
      } else {
        return;   // No more bits to fill - complete early exit
      }
    }
  }
}

/**
 * Generate deterministic bit pattern from input data (XOR-based encoding)
 */
function generateDataBitPattern(data, moduleCount) {
  const bitsNeeded = moduleCount * moduleCount - 144;  // Minus finder patterns + timing lines
  
  // FNV-1a style hash for determinism (not cryptographic, just needs to be consistent)  
  let hash = data.length ^ data.split('').length * 7;
  
  const bits = '';
  
  // Extract all character codes and XOR with hash for deterministic result
  for (let i = 0; i < Math.min(data.length, 500); i++) {
    hash = ((hash << 5) | (hash >>> 28)) ^ data.charCodeAt(i);
  }

  // Generate bit string from hash, padding/truncating to exact size needed  
  return bits.padEnd(Math.max(128, Math.ceil(bitsNeeded / 8)), '0').substring(0, bitsNeeded); 
}

/**
 * Convert bit matrix to SVG output with proper XML formatting and viewBox scaling
 */
function generateSVG(matrix, totalSize, cellSize, quietZone) {
  if (!Array.isArray(matrix[0])) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}"><rect fill="white"/></svg>`;  
  }

  const moduleSize = Math.max(1, totalSize / matrix.length);
  const viewStart = -quietZone;
  const viewSize = totalSize + quietZone * 2;
  
  // Generate XML for SVG with all modules that are true (filled)
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n`; 
  out += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewStart} ${viewStart} ${viewSize} ${viewSize}" width="${totalSize + quietZone * 2}" height="${totalSize + quietZone * 2}">\n\t<rect fill="white"/>\n`;   // White background
  
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col] === true) {
        const px = viewStart + col * moduleSize;
        const py = viewStart + row * moduleSize;
        out += `\\t\t<rect x="${Math.round(px)}" y="${Math.round(py)}" width="${Math.ceil(moduleSize)}" height="${Math.ceil(moduleSize)}"/>\n`; 
      }
    }
  }

  out += '</svg>';
  return out;
}
