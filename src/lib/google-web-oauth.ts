/**
 * 구글 웹 로그인의 순수 조각 (#1532) — 인가 URL·리다이렉트 복귀 해석. 브라우저
 * 전역(location·sessionStorage)을 만지지 않아 네이티브 테스트에서도 검증된다.
 * 브라우저 배선은 `google-auth.web.ts`.
 *
 * 흐름(OpenID Connect 암묵 흐름, id token만): 로그인 페이지 → accounts.google.com
 * `/o/oauth2/v2/auth`(response_type=id_token)로 이동 → 계정 선택 후
 * `redirect_uri#id_token=…&state=…`로 복귀 → 서버 `/auth/google`(네이티브와 같은
 * 계약 — aud는 같은 웹 클라이언트 ID). 토큰은 프래그먼트(#)로 와서 서버 로그에
 * 남지 않는다. `state`는 CSRF, `nonce`는 토큰 재사용을 막으려고 대조한다.
 */

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export type GoogleRedirect =
  | { kind: 'token'; idToken: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: string }
  | { kind: 'state_mismatch' }
  | { kind: 'nonce_mismatch' };

/** 인가 요청 URL — 매번 계정을 고르게 한다(최근 로그인 배지가 "누구로"를 안내). */
export function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE_URL}?${q.toString()}`;
}

/** JWT 본문(payload)의 nonce — 서명 검증은 서버 몫이고 여기선 대조만 한다. */
export function idTokenNonce(idToken: string): string | null {
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(decodeURIComponent(escape(atob(padded)))) as { nonce?: unknown };
    return typeof json.nonce === 'string' ? json.nonce : null;
  } catch {
    return null;
  }
}

/**
 * 복귀 프래그먼트(`#…`)를 해석한다. 구글 파라미터가 없으면 null(일반 진입).
 * 사용자가 동의 화면에서 취소하면 `error=access_denied`로 돌아온다.
 */
export function parseGoogleRedirect(
  hash: string,
  expected: { state: string | null; nonce: string | null },
): GoogleRedirect | null {
  const q = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const idToken = q.get('id_token');
  const error = q.get('error');
  if (!idToken && !error) return null;
  if (!expected.state || q.get('state') !== expected.state) return { kind: 'state_mismatch' };
  if (error) return error === 'access_denied' ? { kind: 'cancelled' } : { kind: 'error', error };
  if (!expected.nonce || idTokenNonce(idToken as string) !== expected.nonce) {
    return { kind: 'nonce_mismatch' };
  }
  return { kind: 'token', idToken: idToken as string };
}

/** 복귀 URL에서 프래그먼트를 걷어낸 주소(히스토리 정리 — 토큰이 주소창에 남지 않게). */
export function stripGoogleFragment(href: string): string {
  const url = new URL(href);
  url.hash = '';
  return url.toString();
}
