/**
 * QR Code API — Pure JS QR encoder → SVG output
 * GET /api/qr?url=https://example.com&size=256&color=3B82F6
 * No npm deps. Byte-mode encoding, EC level M, versions 1-10.
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target || !target.trim()) {
      return json400('Missing required parameter: url');
    }

    // Validate size (128-1024)
    let size = parseInt(url.searchParams.get('size')) || 256;
    size = Math.max(128, Math.min(1024, size));

    // Validate + normalize color
    let color = (url.searchParams.get('color') || '3B82F6').replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(color)) {
      color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    if (!/^[0-9a-f]{6}$/.test(color)) {
      return json400('Invalid color. Use hex format: 3B82F6 or #3bf');
    }

    // Rate limit: 30 req/min per IP via KV (graceful if KV not bound)
    if (env.RATE_LIMIT) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const key = `qr:${ip}`;
      try {
        const val = parseInt(await env.RATE_LIMIT.get(key)) || 0;
        if (val >= 30) {
          return new Response(JSON.stringify({ error: 'Rate limited. 30 req/min max.', retryAfter: 60 }), {
            status: 429, headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Retry-After': '60' }
          });
        }
        await env.RATE_LIMIT.put(key, String(val + 1), { expirationTtl: 60 });
      } catch (_) { /* KV error — don't block the request */ }
    }

    try {
      const modules = encode(target.trim());
      const svg = toSVG(modules, size, '#' + color);
      return new Response(svg, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=604800, immutable',
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'QR generation failed', detail: e.message }), {
        status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
  }
};

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };
}

function json400(msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

// ── QR Encoder (byte mode, EC level M, versions 1-10) ──────────────

// Version capacities for byte mode, EC level M (data codewords)
const VERSION_CAPACITY = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];

// EC codewords per block for each version at level M
const EC_CODEWORDS = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

// Number of EC blocks per version at level M
const EC_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 4, 4];

// Alignment pattern center positions per version
const ALIGN_POS = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
];

function encode(text) {
  const data = new TextEncoder().encode(text);
  if (data.length > 216) throw new Error('URL too long (max ~216 bytes for QR version 10)');

  // Pick smallest version that fits
  let ver = 1;
  while (ver <= 10 && data.length > VERSION_CAPACITY[ver]) ver++;
  if (ver > 10) throw new Error('Data too large for supported QR versions');

  const totalCodewords = VERSION_CAPACITY[ver] + EC_CODEWORDS[ver] * EC_BLOCKS[ver];
  const size = 17 + ver * 4;

  // Build data bitstream: mode(4) + count(8 or 16) + data + terminator + padding
  const countBits = ver >= 10 ? 16 : 8;
  let bits = toBits(4, 4); // byte mode indicator = 0100
  bits += toBits(data.length, countBits);
  for (const b of data) bits += toBits(b, 8);

  // Terminator (up to 4 zero bits)
  const dataCodewords = VERSION_CAPACITY[ver];
  const dataBitsNeeded = dataCodewords * 8;
  const termLen = Math.min(4, dataBitsNeeded - bits.length);
  bits += '0'.repeat(termLen);

  // Byte-align
  if (bits.length % 8 !== 0) bits += '0'.repeat(8 - (bits.length % 8));

  // Pad to fill data capacity
  const padBytes = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < dataBitsNeeded) {
    bits += toBits(padBytes[pi % 2], 8);
    pi++;
  }

  // Split into data codewords
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(parseInt(bits.substring(i, i + 8), 2));
  }

  // EC calculation per block
  const numBlocks = EC_BLOCKS[ver];
  const ecPerBlock = EC_CODEWORDS[ver];
  const cwPerBlock = Math.floor(dataCodewords / numBlocks);
  const remainder = dataCodewords % numBlocks;

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockLen = cwPerBlock + (b >= numBlocks - remainder ? 1 : 0);
    const block = codewords.slice(offset, offset + blockLen);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
    offset += blockLen;
  }

  // Interleave data blocks
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  const interleaved = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  // Interleave EC blocks
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }

  // Convert to bitstream
  let finalBits = '';
  for (const cw of interleaved) finalBits += toBits(cw, 8);

  // Remainder bits for versions 2-6: 7 bits
  if (ver >= 2 && ver <= 6) finalBits += '0000000';

  // Build module grid
  const grid = Array.from({ length: size }, () => new Uint8Array(size)); // 0=white
  const reserved = Array.from({ length: size }, () => new Uint8Array(size)); // 1=reserved

  placeFinderPattern(grid, reserved, 0, 0, size);
  placeFinderPattern(grid, reserved, size - 7, 0, size);
  placeFinderPattern(grid, reserved, 0, size - 7, size);

  // Separators (white border around finders — already white, just mark reserved)
  for (let i = 0; i < 8; i++) {
    markReserved(reserved, i, 7, size);
    markReserved(reserved, 7, i, size);
    markReserved(reserved, size - 8 + i, 7, size);
    markReserved(reserved, size - 8, i, size);
    markReserved(reserved, i, size - 8, size);
    markReserved(reserved, 7, size - 8 + i, size);
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = (i % 2 === 0) ? 1 : 0;
    grid[i][6] = (i % 2 === 0) ? 1 : 0;
    reserved[6][i] = 1;
    reserved[i][6] = 1;
  }

  // Alignment patterns
  if (ver >= 2) {
    const positions = ALIGN_POS[ver];
    for (const r of positions) {
      for (const c of positions) {
        // Skip if overlapping finder pattern
        if (r < 9 && c < 9) continue;
        if (r < 9 && c > size - 9) continue;
        if (r > size - 9 && c < 9) continue;
        placeAlignPattern(grid, reserved, r, c, size);
      }
    }
  }

  // Dark module
  grid[size - 8][8] = 1;
  reserved[size - 8][8] = 1;

  // Reserve format info areas (will fill after masking)
  for (let i = 0; i < 9; i++) {
    markReserved(reserved, 8, i, size);
    markReserved(reserved, i, 8, size);
  }
  for (let i = 0; i < 8; i++) {
    markReserved(reserved, 8, size - 8 + i, size);
    markReserved(reserved, size - 1 - i, 8, size);
  }

  // Place data bits (upward/downward zigzag from bottom-right)
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    const rows = upward ? rangeReverse(size - 1, 0) : rangeForward(0, size - 1);
    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (col < 0 || col >= size) continue;
        if (reserved[row][col]) continue;
        if (bitIdx < finalBits.length) {
          grid[row][col] = finalBits[bitIdx] === '1' ? 1 : 0;
        }
        bitIdx++;
      }
    }
    upward = !upward;
  }

  // Apply best mask
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(grid, reserved, m, size);
    const score = penaltyScore(masked, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
    }
  }

  const final = applyMask(grid, reserved, bestMask, size);

  // Write format info (EC level M = 00, mask pattern 3 bits)
  const formatBits = getFormatBits(0, bestMask); // 0 = M level
  writeFormatInfo(final, formatBits, size);

  return final;
}

// ── Reed-Solomon over GF(256) ──────────────────────────────────────

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11D : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data, ecCount) {
  // Build generator polynomial
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }

  const msg = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return msg.slice(data.length);
}

// ── Grid helpers ────────────────────────────────────────────────────

function placeFinderPattern(grid, reserved, row, col, size) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const gr = row + r, gc = col + c;
      if (gr < 0 || gr >= size || gc < 0 || gc >= size) continue;
      // Finder: solid border, white ring, solid 3x3 center
      const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[gr][gc] = (isBorder || isCenter) ? 1 : 0;
      reserved[gr][gc] = 1;
    }
  }
}

function placeAlignPattern(grid, reserved, centerR, centerC, size) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const gr = centerR + r, gc = centerC + c;
      if (gr < 0 || gr >= size || gc < 0 || gc >= size) continue;
      const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      grid[gr][gc] = (isBorder || isCenter) ? 1 : 0;
      reserved[gr][gc] = 1;
    }
  }
}

function markReserved(reserved, row, col, size) {
  if (row >= 0 && row < size && col >= 0 && col < size) reserved[row][col] = 1;
}

function rangeForward(start, end) {
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function rangeReverse(start, end) {
  const arr = [];
  for (let i = start; i >= end; i--) arr.push(i);
  return arr;
}

// ── Masking ─────────────────────────────────────────────────────────

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

function applyMask(grid, reserved, maskIdx, size) {
  const result = grid.map(row => new Uint8Array(row));
  const fn = MASK_FNS[maskIdx];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }
  return result;
}

function penaltyScore(grid, size) {
  let score = 0;

  // Rule 1: runs of 5+ same-color modules in rows/cols
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) { run++; }
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) { run++; }
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) dark++;
    }
  }
  const pct = (dark * 100) / (size * size);
  const prev5 = Math.floor(pct / 5) * 5;
  const next5 = prev5 + 5;
  score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

  return score;
}

// ── Format info ─────────────────────────────────────────────────────

// Pre-computed format info strings for EC level M (indicator = 00)
const FORMAT_STRINGS = [
  '101010000010010', // mask 0
  '101000100100101', // mask 1
  '101111001111100', // mask 2
  '101101101001011', // mask 3
  '100010111111001', // mask 4
  '100000011001110', // mask 5
  '100111110010111', // mask 6
  '100101010100000', // mask 7
];

function getFormatBits(ecLevel, mask) {
  return FORMAT_STRINGS[mask];
}

function writeFormatInfo(grid, bits, size) {
  // Horizontal: row 8, skipping col 6
  const hCols = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2];
  for (let i = 0; i < 15; i++) {
    grid[8][hCols[i]] = bits[i] === '1' ? 1 : 0;
  }

  // Vertical: col 8, skipping row 6
  const vRows = [size - 1, size - 2, size - 3, size - 4, size - 5, size - 6, size - 7, size - 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) {
    grid[vRows[i]][8] = bits[i] === '1' ? 1 : 0;
  }
}

// ── SVG output ──────────────────────────────────────────────────────

function toSVG(modules, size, color) {
  const n = modules.length;
  const quiet = 4; // standard 4-module quiet zone
  const total = n + quiet * 2;
  const cellSize = size / total;

  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) {
        const x = ((quiet + c) * cellSize).toFixed(2);
        const y = ((quiet + r) * cellSize).toFixed(2);
        const w = cellSize.toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${color}"/>`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" fill="#fff"/>
${rects}
</svg>`;
}

function toBits(value, length) {
  return value.toString(2).padStart(length, '0');
}
