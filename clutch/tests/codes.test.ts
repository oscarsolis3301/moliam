import { describe, it, expect } from 'vitest';
import { generateSessionCode, generateUniqueSessionCode, formatSessionCode } from '../server/src/game/codes.js';
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from '../shared/constants.js';

describe('session code generator', () => {
  it('produces the right length', () => {
    const c = generateSessionCode();
    expect(c).toHaveLength(SESSION_CODE_LENGTH);
  });

  it('uses only the allowed alphabet', () => {
    const allowed = new Set(SESSION_CODE_ALPHABET);
    for (let i = 0; i < 1000; i++) {
      const c = generateSessionCode();
      for (const ch of c) expect(allowed.has(ch)).toBe(true);
    }
  });

  it('excludes ambiguous characters', () => {
    const disallowed = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 1000; i++) {
      const c = generateSessionCode();
      for (const bad of disallowed) expect(c).not.toContain(bad);
    }
  });

  it('is highly unique across 10k generations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateSessionCode());
    // Birthday collisions possible; but with 31^6 ≈ 8.87e8 space and 10k samples,
    // expected collisions ≈ 0.06 — allow a small number.
    expect(set.size).toBeGreaterThanOrEqual(9995);
  });

  it('respects the existence callback', () => {
    const existing = new Set<string>();
    for (let i = 0; i < 5; i++) existing.add(generateSessionCode());
    const code = generateUniqueSessionCode((c) => existing.has(c));
    expect(existing.has(code)).toBe(false);
  });

  it('throws when space is saturated', () => {
    expect(() => generateUniqueSessionCode(() => true)).toThrow();
  });

  it('formats with dash after 4 chars', () => {
    expect(formatSessionCode('ABCDEF')).toBe('ABCD-EF');
    expect(formatSessionCode('AB')).toBe('AB');
  });
});
