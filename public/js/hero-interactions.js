/**
 * Note: Import visual-utils.js before this file for shared drawing utilities
 */

// SECTION: Corridor Renderer
// ═══════════════════════════════════════
function drawCorridor() {
  const cy = layout.margin + layout.rh;
  const cw = layout.W - layout.margin*2;
   // Corridor bg
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(layout.margin, cy, cw, layout.corridorH);

   // Dashed center line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([8,6]);
  ctx.beginPath();
  ctx.moveTo(layout.margin+8, cy+layout.corridorH/2);
  ctx.lineTo(layout.margin+cw-8, cy+layout.corridorH/2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ═══════════════════════════════════════
// SECTION: Bot Renderer & Animation
// ═══════════════════════════════════════
function drawBot(bot) {
  const bx = bot.x;
  let by = bot.y;

   // Breathing
  if(!bot.moving && bot.state === 'idle') {
    by += Math.sin(bot.breathPhase) * 1;
   }
  bot.breathPhase += 0.03 * simSpeed;

  const bodyColor = bot.dimmed ? dimColor(bot.color, 0.4) : bot.color;
  const headColor = bot.dimmed ? dimColor(bot.color, 0.5) : bot.color;
  const darkerBody = dimColor(bodyColor, 0.8);

   // Thinking glow
  if(bot.state === 'thinking') {
    const glowA = 0.15+0.15*Math.sin(globalTime*4);
    ctx.fillStyle = `rgba(139,92,246,${glowA})`;
    ctx.beginPath();
    ctx.arc(bx+6, by-6, 16, 0, Math.PI*2);
    ctx.fill();
   }

   // Head (12x12 rounded)
  ctx.fillStyle = headColor;
  roundRect(ctx, bx, by-14, 12, 12, 2);
  ctx.fill();

   // Body (16x18)
  ctx.fillStyle = darkerBody;
  roundRect(ctx, bx-2, by, 16, 18, 2);
  ctx.fill();

   // Legs
  const legOffset = bot.moving ? Math.sin(bot.legPhase)*2 : 0;
  ctx.fillStyle = darkerBody;
  ctx.fillRect(bx+1, by+18, 4, 8+legOffset);
  ctx.fillRect(bx+7, by+18, 4, 8-legOffset);

   // Status dot
  const dotColors = {
    active:COLORS.green, thinking:COLORS.purple, blocked:COLORS.red,
    error:COLORS.red, retrying:COLORS.amber, rate_limited:COLORS.textDim, idle:'#374151'
   };
  ctx.fillStyle = dotColors[bot.state] || '#374151';
  ctx.beginPath();
  ctx.arc(bx+14, by-12, 3, 0, Math.PI*2);
  ctx.fill();

   // Blocked/error shake
  if(bot.state === 'error' || bot.state === 'blocked') {
    if(bot.blockShake > 0) {
      const shake = Math.sin(globalTime*30)*2*bot.blockShake;
      ctx.fillStyle = COLORS.red;
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('!', bx+6+shake, by-18);
      bot.blockShake -= 0.02*simSpeed;
     }
   }

   // Rate limit timer arc
  if(bot.state === 'rate_limited' && bot.rateLimitTimer > 0) {
    const pct = bot.rateLimitTimer / bot.rateLimitDuration;
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx+6, by-22, 6, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
    bot.rateLimitTimer -= (1/60)*simSpeed;
    if(bot.rateLimitTimer < 0) bot.rateLimitTimer = 0;
   }

   // Retrying spinner
  if(bot.state === 'retrying') {
    bot.retryAngle += 0.1*simSpeed;
    ctx.save();
    ctx.translate(bx+6, by-20);
    ctx.rotate(bot.retryAngle);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0,0,4,0,Math.PI*1.5);
    ctx.stroke();
     // Arrow
    ctx.beginPath(); ctx.moveTo(3,-2); ctx.lineTo(5,1); ctx.lineTo(1,1); ctx.fill();
    ctx.restore();
   }

   // Task complete checkmark
  if(bot.completeMark > 0) {
    ctx.globalAlpha = bot.completeMark;
    ctx.fillStyle = COLORS.green;
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('✓', bx+6, by-20);
    ctx.globalAlpha = 1;
    bot.completeMark -= 0.02*simSpeed;
   }

   // Name label
  ctx.fillStyle = COLORS.textPri;
  ctx.font = '10px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(bot.name, bx+6, by+32);
}

function dimColor(hex, factor) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

// ═══════════════════════════════════════\n// SECTION: Orb Renderer\n// ═══════════════════════════════════════\n\n/**\n * Orb renderer with error handling for rendering failures\n */\nfunction drawOrb(orb) {\n  try {\n    const x = orb.x;\n    const y = orb.y;\n    \n    // Safe color parsing\n    let fillHex;\n    try { fillHex = (typeof orb.color === 'string' && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(orb.color)) ? orb.color : '#10B981'; } catch(e) { fillHex = '#10B981'; }\n    \n    // Orb body with gradient simulation (no createLinearGradient to keep performance)\n    ctx.fillStyle = fillHex;\n    ctx.beginPath();\n    ctx.arc(x, y, orb.size || 4, 0, Math.PI * 2);\n    ctx.fill();\n    \n    // Border for visual separation\n    ctx.strokeStyle = '#FFFFFF';\n    ctx.lineWidth = 1 / (orb.speed || 1);\n    ctx.beginPath();\n    ctx.arc(x, y, max(3, orb.size > 6 ? 4 : 3), 0, Math.PI * 2);\n    ctx.stroke();\n    \n  } catch(e) {\n    console.warn('[Hero Canvas] Orb rendering error:', e);\n  }\n}\n\n// Safe resize handler with error catching\ncanvas.addEventListener('resize', () => {\n  try { resize(); } catch(e) {\n    console.error('[Hero Canvas] Resize handler error:', e);\n  }\n}, { passive: true });\n\n})(); // Close IIFE with error-safe wrapping\n