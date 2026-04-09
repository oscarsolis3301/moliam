/**
 * CSS Variable Definitions for Moliam Frontend
 * Maps hardcoded hex colors to CSS custom properties from :root
 * Usage: import { roomColors, botColors } from './style-definitions.js'
 */

'use strict';

export const roomColors = {
  engineering: 'var(--accent-blue)',
  planning: 'var(--accent-purple)',
  comms: 'var(--accent-green)',
  dataops: 'var(--accent-cyan)',
  error: 'var(--accent-red)',
  ratelimit: 'var(--accent-amber)'
};

export const botColors = {
  Ada: 'var(--accent-purple)',
  Mavrick: 'var(--accent-blue)',
  Yagami: 'var(--accent-red)',
  Willow: 'var(--accent-amber)',
  Soni: 'var(--accent-cyan)'
};

export const sparklineColors = {
  stroke: 'var(--accent-blue)',
  fill: 'rgba(59, 130, 246, 0.1)'
};

export const feedDotColors = {
  default: '#9CA3AF',
  online: 'var(--accent-green)',
  offline: 'var(--text-dim)'
};
