import { checkHostToken } from './api.js';

// Persistent "remember me" for host-mode auth.
//
// The token lives in localStorage so it survives page reloads and tab
// restores — crucial for the lobby flow where the host might leave and come
// back from a phone. The server-issued token has a 30-day soft expiry baked
// into its signature, so a leaked entry in localStorage decays on its own.

const STORAGE_KEY = 'clutch:host-auth:token';

export function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* private mode / disabled storage — re-prompt next visit, no-op */
  }
}

export function forgetToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Returns true if a stored token is valid against the server. Used at
 * dashboard mount and "Host a game" click to skip the PIN prompt.
 */
export async function hasValidStoredAuth(): Promise<boolean> {
  const t = readStoredToken();
  if (!t) return false;
  const ok = await checkHostToken(t);
  if (!ok) forgetToken();
  return ok;
}
