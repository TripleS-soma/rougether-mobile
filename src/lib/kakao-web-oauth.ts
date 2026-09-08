/**
 * 카카오 웹 로그인의 순수 조각 — 인가 URL·리다이렉트 파싱·토큰 요청 본문.
 * 브라우저 전역(location·sessionStorage)을 만지지 않아 네이티브 테스트에서도
 * 검증된다. 브라우저 배선은 `kakao-auth.web.ts`.
 *
 * 흐름(카카오 REST API 인가 코드 방식): 로그인 페이지 → kauth `/oauth/authorize`
 * 로 이동 → 동의 후 `redirect_uri?code=…&state=…`로 복귀 → `/oauth/token`으로
 * access token 교환 → 서버 `/auth/kakao`(네이티브와 동일 계약).
 */

export const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
export const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';

export type KakaoRedirect =
  | { kind: 'code'; code: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: string }
  | { kind: 'state_mismatch' };

/** 인가 요청 URL. `state`는 CSRF 방지용 — 복귀 시 대조한다. */
export function buildKakaoAuthorizeUrl(params: {
  restApiKey: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.restApiKey,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    state: params.state,
  });
  return `${KAKAO_AUTHORIZE_URL}?${q.toString()}`;
}

/**
 * 리다이렉트 복귀 쿼리를 해석한다. 카카오 파라미터가 없으면 null(일반 진입).
 * 사용자가 동의 화면에서 취소하면 `error=access_denied`로 돌아온다.
 */
export function parseKakaoRedirect(
  search: string,
  expectedState: string | null,
): KakaoRedirect | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const code = q.get('code');
  const error = q.get('error');
  if (!code && !error) return null;
  if (!expectedState || q.get('state') !== expectedState) return { kind: 'state_mismatch' };
  if (error) return error === 'access_denied' ? { kind: 'cancelled' } : { kind: 'error', error };
  return { kind: 'code', code: code as string };
}

/** 토큰 교환 요청 본문(x-www-form-urlencoded). */
export function buildKakaoTokenBody(params: {
  restApiKey: string;
  redirectUri: string;
  code: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.restApiKey,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
}

/** 복귀 URL에서 카카오 파라미터만 걷어낸 주소(히스토리 정리용). */
export function stripKakaoParams(href: string): string {
  const url = new URL(href);
  for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
  return url.toString();
}
