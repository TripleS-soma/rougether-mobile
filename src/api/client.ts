/**
 * Authenticated API client for the Rougether User API v1. Wraps the low-level
 * `rawRequest` with bearer-token injection and a one-shot refresh-on-401 retry.
 * Conventions (spec / OpenAPI): `/api/v1` prefix (baked into `API_BASE`), list
 * responses wrapped in `{ items: [...] }`, JWT bearer auth.
 */
import { clearSession, getAccessToken, refreshSession } from './auth';
import { ApiError, type HttpMethod, rawRequest } from './http';

// Re-exported for MSW handlers (which key mocks off the base) and diagnostics.
export { API_BASE } from './config';
export { ApiError } from './http';

export type RequestOptions = {
  /** Attach the bearer token (default true). Set false for public endpoints. */
  auth?: boolean;
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true } = options;
  if (!auth) return rawRequest<T>(method, path, { body });

  try {
    return await rawRequest<T>(method, path, { headers: authHeaders(), body });
  } catch (err) {
    // On an expired token, refresh once and replay; give up (and log out) if the
    // refresh fails or the replay still 401s.
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return rawRequest<T>(method, path, { headers: authHeaders(), body });
      }
      await clearSession();
    }
    throw err;
  }
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/** GET a list endpoint and unwrap the spec's `{ items: [...] }` envelope. */
export async function apiGetList<T>(path: string, options?: RequestOptions): Promise<T[]> {
  const data = await apiGet<{ items?: T[] }>(path, options);
  return data.items ?? [];
}

export function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, body, options);
}

export function apiPut<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('PUT', path, body, options);
}

export function apiPatch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, body, options);
}

export function apiDelete<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, body, options);
}
