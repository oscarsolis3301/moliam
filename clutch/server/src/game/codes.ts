import { randomInt } from 'node:crypto';
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from '../../../shared/constants.js';

export function generateSessionCode(length = SESSION_CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SESSION_CODE_ALPHABET[randomInt(0, SESSION_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a code that isn't present according to `exists`. Up to 5 attempts.
 * Throws if we can't find a unique code in that budget (effectively impossible
 * at the scales we care about, but surfaces a clear error if the code space
 * ever gets saturated).
 */
export function generateUniqueSessionCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode();
    if (!exists(code)) return code;
  }
  throw new Error('Could not generate a unique session code after 5 attempts');
}

/** Format a session code for display: "QZ7X-4K". Pure, used for display only. */
export function formatSessionCode(code: string): string {
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
