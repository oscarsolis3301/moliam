/**
 * Layout & Geometry Calculator Utilities
 * Extracted from inline script - line sections 53-85
 */

// ═══════════════════════════════════════
// SECTION: Layout Calculator
// ═══════════════════════════════════════
let layout = {};

/**
 * Calculate canvas layout based on window尺寸 & DPR
 * Requires: canvas, ctx, dpr to be defined globally
 */
function calcLayout() {
  const W = canvas.width / dpr;
  const H = (canvas.height / dpr);
  const isMobile = W <= 768;
  const margin = isMobile ? 12 : 20;
  const gap = isMobile ? 4 : 8;
  const corridorH = isMobile ? 30 : 40;
  const cols = 3, rows = 2;
  const totalGapX = gap * (cols - 1);
  const rw = ((W - margin*2) - totalGapX) / cols;
  const totalGapY = gap;
  const rh = ((H - margin*2) - corridorH - totalGapY) / rows;
  const corridorY = margin + rh + gap/2;

  layout = {W, H, margin, gap, corridorH, rw, rh, corridorY};

  // Initialize room positions with seat arrays
  rooms = ROOM_DEFS.map(def => {
    const x = margin + def.col * (rw + gap);
    const floorIdx = def.floor; // 1=top, 0=bottom
    const y = floorIdx === 1 ? margin : margin + rh + corridorH + gap;
    const seats = [];
    for(let s=0; s<4; s++) {
      seats.push({x: x + 20 + s * (rw-40)/3, y: y + rh - 50, taken:null});
    }
    return {...def, x, y, w:rw, h:rh, seats, eventLog:[]};
  });
}

/**
 * Get room by ID from rooms array
 * @param {string} id - Room identifier
 * @returns {object|undefined} Room object or undefined
 */
function getRoomById(id) { 
  return rooms.find(r=>r.id===id); 
}

// Export if module context exists (for future use)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcLayout, getRoomById };
}
