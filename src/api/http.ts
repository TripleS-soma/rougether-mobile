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

type ParsedErrorBody = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

/** `code` / `message` / `details` of the server's JSON error body, when it parses as such. */
function parseErrorBody(bodyText?: string): ParsedErrorBody {
  if (!bodyText) return {};
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (!parsed || typeof parsed !== 'object') return {};
    const { code, message, details } = parsed as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    return {
      code: typeof code === 'string' ? code : undefined,
      message: typeof message === 'string' ? message : undefined,
      details:
        details && typeof details === 'object' && !Array.isArray(details)
          ? (details as Record<string, unknown>)
          : undefined,
    };
  } catch {
    // Non-JSON body (HTML error page, plain text) — no structured fields.
    return {};
  }
}

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  /**
   * Structured server error code (예: 'HOUSE_NOT_OWNER') parsed from the JSON
   * body — undefined when the body isn't JSON or has no string `code`. Compare
   * against `ErrorCode` (#557) instead of substring-matching `bodyText`.
   */
  readonly code?: string;
  /**
   * Human-readable `message` from the server body — safe to show verbatim when
   * it is guidance, e.g. the 409 AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER notice.
   */
  readonly serverMessage?: string;
  /**
   * Structured `details` the server attaches when `code`/`message` alone can't
   * drive a decision, e.g. `providers: ['APPLE']` on that same 409.
   */
  readonly details?: Record<string, unknown>;

  constructor(
    readonly status: number,
    readonly method: HttpMethod,
    readonly path: string,
    readonly bodyText?: string,
  ) {
    super(`API ${status}: ${method} ${path}`);
    this.name = 'ApiError';
    const parsed = parseErrorBody(bodyText);
    this.code = parsed.code;
    this.serverMessage = parsed.message;
    this.details = parsed.details;
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
