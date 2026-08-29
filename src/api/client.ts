/**
 * Authenticated API client for the Rougether User API v1. Wraps the low-level
 * `rawRequest` with bearer-token injection and a one-shot refresh-on-401 retry.
 * Conventions (spec / OpenAPI): `/api/v1` prefix (baked into `API_BASE`), list
 * responses wrapped in `{ items: [...] }`, JWT bearer auth.
 */
import { track } from '@/lib/analytics';

import { getAccessToken, refreshSession } from './auth';
import { ApiError, type HttpMethod, rawRequest } from './http';

export type RequestOptions = {
  /** Attach the bearer token (default true). Set false for public endpoints. */
  auth?: boolean;
  /**
   * 호출부가 **정상으로 처리하는** 상태코드 — `api_error`로 세지 않는다 (#1010).
   *
   * 없이 두면 "이벤트 없음" 같은 정상 응답이 장애 통계를 덮는다. 2026-08-29
   * GA4 실측에서 엔드포인트가 붙은 api_error 21건 중 18건이
   * `GET /events/attendance`의 404였는데, 그건 useAttendance가 이미
   * `ATTENDANCE_EVENT_NOT_FOUND`로 접고 있는 정상 경로였다. 던지는 것 자체는
   * 그대로다 — **계측에서만 빠진다.**
   */
  expectedStatuses?: number[];
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 실패 1건을 이벤트로 (#799) — 경로는 id를 지운 형태로만 남긴다: 원본을 그대로
 * 보내면 GA4 카디널리티가 터지고 식별정보가 섞인다.
 *
 * **상태코드는 문자열로 보낸다.** 숫자로 보내면 GA4가 `int_value`에 넣는데,
 * 이벤트 범위 맞춤 측정기준은 `string_value`만 읽어 조회가 통째로 비어
 * 나온다 (2026-08-29 실측: endpoint는 값이 붙고 status만 `(not set)`).
 * 우리가 원하는 건 "404가 몇 건"이라 그룹핑이고, 그러려면 측정항목(합계)이
 * 아니라 문자열 측정기준이어야 한다.
 */
function reportApiError(
  method: HttpMethod,
  path: string,
  err: unknown,
  expectedStatuses?: number[],
) {
  if (err instanceof ApiError && expectedStatuses?.includes(err.status)) return;
  track('api_error', {
    endpoint: `${method} ${path.split('?')[0].replace(/\/\d+/g, '/{id}')}`,
    // 네트워크 실패(응답 자체가 없음)는 0 — GA4에서 '0'으로 묶인다.
    status: String(err instanceof ApiError ? err.status : 0),
  });
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, expectedStatuses } = options;
  if (!auth) return rawRequest<T>(method, path, { body });

  try {
    return await rawRequest<T>(method, path, { headers: authHeaders(), body });
  } catch (err) {
    // On an expired token, refresh once and replay; give up (and log out) if the
    // refresh fails or the replay still 401s.
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        // 재요청이 또 실패하는 경로도 계측한다 — 여기서 그냥 던지면 갱신 후
        // 실패가 통계에서 통째로 빠진다(리뷰 지적).
        try {
          return await rawRequest<T>(method, path, { headers: authHeaders(), body });
        } catch (retryErr) {
          reportApiError(method, path, retryErr, expectedStatuses);
          throw retryErr;
        }
      }
      // 세션 정리는 refreshSession이 서버 거부일 때만 스스로 수행한다 (#515)
      // — 네트워크 오류로 갱신에 실패한 경우 세션은 살아 있어야 한다.
    }
    // 이탈 원인 계측 (#799) — 화면마다 토스트로 흩어져 있던 실패를 한곳에서 센다.
    reportApiError(method, path, err, expectedStatuses);
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
