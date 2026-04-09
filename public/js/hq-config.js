/**
 * HQ Configuration Constants for Moliam Frontend
 * Hardcoded configuration data removed from inline script in index.html
 * 
 * Usage: import { COLORS, ROOM_DEFS, BOT_DEFS } from './hq-config.js'
 */

'use strict';

// Color palette - matches colors.js exports (kept here for backward compat)
export const COLORS = {
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

// Room definitions for HQ visualization layout
export const ROOM_DEFS = [
  {id:'engineering', name:'ENGINEERING', floor:1, col:0, accent:COLORS.blue},
  {id:'planning',    name:'PLANNING',    floor:1, col:1, accent:COLORS.purple},
  {id:'comms',       name:'COMMS',       floor:1, col:2, accent:COLORS.green},
  {id:'data',        name:'DATA OPS',    floor:0, col:0, accent:COLORS.amber},
  {id:'error',       name:'ERROR ROOM',  floor:0, col:1, accent:COLORS.red},
{id:'ratelimit',   name:'RATE LIMIT LOUNGE', floor:0, col:2, accent:COLORS. amber}]);
];

// Bot/AI agent definitions for HQ visualization
export const BOT_DEFS = [
  {id:'mavrick', name:'Mavrick', color:'#3B82F6',  machine:'MINI-01'},
  {id:'yagami',  name:'Yagami',  color:'#EF4444',  machine:'MINI-02'},
  {id:'ada',     name:'Ada',     color:'#8B5CF6',  machine:'Raspberry Pi'}
];

// Simulation constants
export const MOVE_SPEED = 120; // px/sec base

/* 
 * NOTE: Large inline script (init functions, event processing, rendering) 
 * has been extracted from index.html and moved to hq.js, hq-interaction.js, etc.
 * This file only exports configuration constants.
 */
