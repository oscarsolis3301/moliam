/**
 * Simulation Main Engine - Complete visualization system extracted from index.html
 * Sections: Layout, State Management, Bot Movement, Event System, Rendering
 * Extracted from inline script block (lines 9-1083)
 */

// ═══════════════════════════════════════
// SECTION: Constants & Global State
// ═══════════════════════════════════════

/* COLORS - moved from inline script */
const COLORS = {
  bgDeep:'#0B0E14', 
  bgBuilding:'#111827', 
  bgRoom:'#1F2937', 
  borderRoom:'#374151',
  blue:'#3B82F6', 
  purple:'#8B5CF6', 
  green:'#10B981', 
  amber:'#F59E0B',
  red:'#EF4444', 
  cyan:'#06B6D4', 
  textPri:'#F9FAFB', 
  textSec:'#9CA3AF', 
  textDim:'#6B7280'
};

const ROOM_DEFS = [
    {id:'engineering', name:'ENGINEERING', floor:1, col:0, accent:COLORS.blue},
    {id:'planning',    name:'PLANNING',    floor:1, col:1, accent:COLORS.purple},
    {id:'comms',       name:'COMMS',       floor:1, col:2, accent:COLORS.green},
    {id:'data',        name:'DATA OPS',    floor:0, col:0, accent:COLORS.amber},
    {id:'error',       name:'ERROR ROOM',  floor:0, col:1, accent:COLORS.red},
    {id:'ratelimit',   name:'RATE LIMIT LOUNGE', floor:0, col:2, accent:'#9a7a2a'}
];

const BOT_DEFS = [
    {id:'mavrick', name:'Mavrick', color:'#3B82F6',  machine:'MINI-01'},
    {id:'yagami',  name:'Yagami',  color:'#EF4444',  machine:'MINI-02'},
    {id:'ada',     name:'Ada',     color:'#8B5CF6',  machine:'Raspberry Pi'}
];

const MOVE_SPEED = 120; // px/sec base
let simSpeed = 1;

