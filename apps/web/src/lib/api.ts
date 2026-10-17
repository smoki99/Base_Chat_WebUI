/**
 * Minimal fetch helper for the admin API.
 *
 * All admin endpoints are served under `/api/admin` (Vite proxies `/api`
 * to the API server in dev; the reverse proxy does the same in prod) and
 * respond with `{ "data": ... }` or `{ "error": { "message": ... } }`.
 */

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
