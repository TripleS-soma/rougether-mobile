/**
 * 카카오 **웹** 로그인 — `kakao-auth.ts`의 웹 변형. Metro가 웹 번들에서만 이
 * 파일을 고르므로 네이티브 SDK(@react-native-kakao)는 웹에 들어가지 않는다.
 *
 * 카카오 JS SDK 대신 REST 인가 코드 흐름을 직접 쓴다(`kakao-web-oauth.ts`).
 * 팝업이 아니라 **페이지 리다이렉트**라 `getKakaoAccessToken`은 두 번에 걸쳐
 * 완성된다: 1차 호출은 kauth로 떠나며 끝나지 않는 Promise를 돌려주고(페이지가
 * 내려감), 복귀 후 로그인 화면이 `hasKakaoRedirect()`를 보고 다시 호출하면
 * 코드를 access token으로 바꿔 돌려준다 — 그 뒤는 네이티브와 같은 `/auth/kakao`.
 *
 * 필요한 설정(카카오 개발자 콘솔, 같은 앱 1501738 — 서버가 app_id를 대조한다):
 * - 플랫폼 > Web 사이트 도메인에 웹앱 origin, 카카오 로그인 > Redirect URI에
 *   `<origin>/login`.
 * - 토큰 교환을 브라우저가 하므로 **클라이언트 시크릿을 "사용 안함"** 으로 둬야
 *   한다(시크릿을 번들에 넣을 수는 없다). 시크릿을 켜려면 교환을 서버로 옮겨야
 *   한다(`/auth/kakao`에 code·redirectUri 계약 추가 — 서버 결정 사항).
 * - REST API 키는 `EXPO_PUBLIC_KAKAO_REST_API_KEY`로 주입(빌드 시 인라인).
 */
import {
  buildKakaoAuthorizeUrl,
  buildKakaoTokenBody,
  KAKAO_TOKEN_URL,
  parseKakaoRedirect,
  stripKakaoParams,
} from './kakao-web-oauth';

const STATE_KEY = 'rougether.kakao-web.state';
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

function redirectUri(): string {
  return `${window.location.origin}/login`;
}

function readState(): string | null {
  try {
    return window.sessionStorage.getItem(STATE_KEY);
  } catch {
    return null;
  }
}

function createState(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 카카오에서 리다이렉트로 돌아온 진입인가 — 로그인 화면이 나머지 절반을 이어가게 한다. */
export function hasKakaoRedirect(): boolean {
  return parseKakaoRedirect(window.location.search, readState()) != null;
}

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: buildKakaoTokenBody({
      restApiKey: REST_API_KEY as string,
      redirectUri: redirectUri(),
      code,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`kakao token exchange failed: ${res.status} ${body.error ?? ''}`.trim());
  }
  return body.access_token;
}

/**
 * 카카오 로그인 — 복귀 진입이면 코드를 access token으로 바꿔 반환하고, 아니면
 * kauth로 떠난다(반환하지 않는 Promise).
 * - 사용자가 동의 화면에서 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 키 미설정·state 불일치·교환 실패는 throw — 호출부가 실패 문구를 띄운다.
 */
export async function getKakaoAccessToken(): Promise<string | null> {
  if (!REST_API_KEY) throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY is not set for web');
  const state = readState();
  const back = parseKakaoRedirect(window.location.search, state);
  if (back) {
    // 복귀 파라미터는 1회용 — 새로고침으로 같은 코드를 다시 교환하지 않게 즉시 걷어낸다.
    window.sessionStorage.removeItem(STATE_KEY);
    window.history.replaceState(null, '', stripKakaoParams(window.location.href));
    if (back.kind === 'cancelled') return null;
    if (back.kind === 'state_mismatch') throw new Error('kakao redirect state mismatch');
    if (back.kind === 'error') throw new Error(`kakao authorize error: ${back.error}`);
    return exchangeCode(back.code);
  }
  const fresh = createState();
  window.sessionStorage.setItem(STATE_KEY, fresh);
  window.location.assign(
    buildKakaoAuthorizeUrl({ restApiKey: REST_API_KEY, redirectUri: redirectUri(), state: fresh }),
  );
  return new Promise<string | null>(() => {
    // 페이지가 kauth로 떠나므로 여기서 끝나지 않는다.
  });
}

/** 웹은 카카오 세션이 브라우저(kauth 쿠키) 것이라 앱 로그아웃에서 건드리지 않는다. */
export async function signOutKakao(): Promise<void> {
  // no-op
}
