/**
 * Low-level HTTP layer: a single `rawRequest` that speaks the API's JSON
 * conventions and throws a typed `ApiError` on non-2xx. It does NOT inject auth
 * headers or handle token refresh — that lives in `client.ts`. Keeping this
 * dependency-free lets `auth.ts` use it without an import cycle.
 */
import { API_BASE } from './config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Build a `?a=b&c=d` query string, skipping null/undefined values. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export type RawRequestOptions = {
  /** Extra headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /** JSON-serialised as the request body; sets Content-Type automatically. */
  body?: unknown;
};

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: HttpMethod,
    readonly path: string,
    readonly bodyText?: string,
  ) {
    super(`API ${status}: ${method} ${path}`);
    this.name = 'ApiError';
  }
}

export async function rawRequest<T>(
  method: HttpMethod,
  path: string,
  options: RawRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });

  if (!res.ok) {
    const text = await res.text().catch(() => undefined);
    throw new ApiError(res.status, method, path, text);
  }

  // 204 No Content and empty bodies resolve to undefined.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
