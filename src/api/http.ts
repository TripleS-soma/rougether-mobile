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
  /**
   * Request body. Plain values are JSON-serialised (Content-Type set
   * automatically); a FormData passes through untouched so fetch can set the
   * multipart boundary itself (버그 제보 스크린샷 등 파일 업로드, #496).
   */
  body?: unknown;
};

/** `code` field of the server's JSON error body, when it parses as such. */
function parseErrorCode(bodyText?: string): string | undefined {
  if (!bodyText) return undefined;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
      const code = (parsed as { code: unknown }).code;
      if (typeof code === 'string') return code;
    }
  } catch {
    // Non-JSON body (HTML error page, plain text) — no structured code.
  }
  return undefined;
}

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  /**
   * Structured server error code (예: 'HOUSE_NOT_OWNER') parsed from the JSON
   * body — undefined when the body isn't JSON or has no string `code`. Compare
   * against `ErrorCode` (#557) instead of substring-matching `bodyText`.
   */
  readonly code?: string;

  constructor(
    readonly status: number,
    readonly method: HttpMethod,
    readonly path: string,
    readonly bodyText?: string,
  ) {
    super(`API ${status}: ${method} ${path}`);
    this.name = 'ApiError';
    this.code = parseErrorCode(bodyText);
  }
}

export async function rawRequest<T>(
  method: HttpMethod,
  path: string,
  options: RawRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body: string | FormData | undefined;
  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
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
