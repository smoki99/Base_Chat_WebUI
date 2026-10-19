/**
 * Shared admin-token persistence (localStorage).
 *
 * Used by the Admin panel (Story-0035) and by the appearance save flow
 * (Story-0038: PUT /api/chat/appearance needs the token, but the token must
 * stay user-managed – it is read on demand, never duplicated).
 */
const TOKEN_STORAGE_KEY = 'admin_token';

/** Read the persisted admin token (empty string when unset). */
export function readStoredToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persist (or remove) the admin token. Ignores storage errors (private mode). */
export function persistToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode) – token stays in memory only.
  }
}

/** localStorage key (exported for tests). */
export const ADMIN_TOKEN_KEY = TOKEN_STORAGE_KEY;
