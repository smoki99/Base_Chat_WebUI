/**
 * Minimal fetch helper for the admin API.
 *
 * All admin endpoints are served under `/api/admin` (Vite proxies `/api`
 * to the API server in dev; the reverse proxy does the same in prod) and
 * respond with `{ "data": ... }` or `{ "error": { "message": ... } }`.
 */
import type { CustomPrompt, SystemStatus } from 'shared';

/** Error thrown for non-2xx admin responses (or network failures). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface AdminResponse<T> {
  data?: T;
  error?: { message?: string };
}

/**
 * Perform an admin API request and return the `data` payload.
 *
 * @param path  - Route path relative to `/api/admin`, e.g. `/tables`.
 * @param token - Admin token (sent as `Authorization: Bearer <token>`).
 * @param init  - Optional `RequestInit` (method, body, ...).
 */
export async function adminRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'API nicht erreichbar');
  }
  const payload = (await res.json().catch(() => null)) as AdminResponse<T> | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.error?.message ?? `Request fehlgeschlagen (${res.status})`
    );
  }
  if (payload && 'data' in payload) return payload.data as T;
  return payload as unknown as T;
}

/**
 * Download a binary file from the admin API and trigger a browser save.
 *
 * The admin token stays in the `Authorization` header (never in the URL).
 * The filename is taken from the `Content-Disposition` header with a
 * fallback.
 *
 * @param path          - Route path relative to `/api/admin`, e.g. `/tables/products/export?format=csv`.
 * @param token         - Admin token (sent as `Authorization: Bearer <token>`).
 * @param fallbackName  - Filename used when the server does not send one.
 */
export async function adminDownload(
  path: string,
  token: string,
  fallbackName: string
): Promise<void> {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, { headers });
  } catch {
    throw new ApiError(0, 'API nicht erreichbar');
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new ApiError(
      res.status,
      payload?.error?.message ?? `Export fehlgeschlagen (${res.status})`
    );
  }
  const blob = await res.blob();
  const dispo = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(dispo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Perform a token-protected API request under `/api` (same envelope as the
 * admin API) and return the `data` payload.
 *
 * @param path  - Route path including `/api`, e.g. `/chat/custom-prompt`.
 * @param token - Admin token (sent as `Authorization: Bearer <token>`).
 * @param init  - Optional `RequestInit` (method, body, ...).
 */
async function apiRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'API nicht erreichbar');
  }
  const payload = (await res.json().catch(() => null)) as AdminResponse<T> | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.error?.message ?? `Request fehlgeschlagen (${res.status})`
    );
  }
  if (payload && 'data' in payload) return payload.data as T;
  return payload as unknown as T;
}

/** Load the stored custom chatbot prompt (Story-0036). Returns '' when unset. */
export async function fetchCustomPrompt(token: string): Promise<string> {
  const data = await apiRequest<CustomPrompt>('/api/chat/custom-prompt', token);
  return data.content;
}

/**
 * Fetch the system status (Story-0037): LLM / database / voice reachability.
 * Public endpoint (no token), used by the sidebar status dot and the
 * Settings → Verbindung diagnostics tab.
 */
export async function fetchSystemStatus(): Promise<SystemStatus> {
  return apiRequest<SystemStatus>('/api/status', '');
}

/** Store (or clear with `''`) the custom chatbot prompt. Returns stored text. */
export async function saveCustomPrompt(token: string, content: string): Promise<string> {
  const data = await apiRequest<CustomPrompt>('/api/chat/custom-prompt', token, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  return data.content;
}
