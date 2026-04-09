/**
 * Hardcoded Color Constants for Moliam Frontend
 * Direct JS colors (not from CSS vars) used in canvas drawing and inline styles
 * Usage: import { sparklineColor, botColors, statusColors } from './colors.js'
 */

'use strict';

export const sparklineColor = '#3B82F6';

export const botColors = {
  Ada: '#8B5CF6',
  Mavrick: '#3B82F6',
  Yagami: '#EF4444',
  Willow: '#F59E0B',
  Soni: '#06B6D4'
};

export const statusColors = {
  online: '#10B981',
  offlinethread: '#374151',
  thinking: '#F59E0B',
  moving: '#3B82F6',
  offlinefallback: 'rgba(107,114,128,0.3)',
  textDisabled: '#9CA3AF',
  grayLight: '#E5E7EB',
  textMuted: '#6B7280',
  textBright: '#F9FAFB'
};

export const feedItemColors = {
  init: '#3B82F6',
  deployed: '#10B981',
  analytics: '#8B5CF6',
  loaded: '#06B6D4',
  success: '#10B981',
  error: '#EF4444'
};
