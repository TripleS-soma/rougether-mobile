/**
 * 구글 **웹** 로그인 — `google-auth.ts`의 웹 변형. Metro가 웹 번들에서만 이
 * 파일을 고르므로 네이티브 SDK(@react-native-google-signin)는 웹에 들어가지 않는다.
 *
 * 카카오 웹(`kakao-auth.web.ts`)처럼 **페이지 리다이렉트**다(#1532). 예전엔 GIS
 * 공식 버튼을 화면 밖에 숨겨 두고 JS로 눌렀는데, GIS가 버튼을 구글 도메인 iframe
 * 안에 그리도록 바뀌어 그 클릭이 막혔다(2026-10). 공식 버튼을 그대로 보이면 크기·
 * 모양이 고정이라(최대 400×40) 우리 버튼과 맞지 않아 리다이렉트로 바꿨다.
 *
 * `getGoogleIdToken`은 두 번에 걸쳐 완성된다: 1차 호출은 accounts.google.com으로
 * 떠나며 끝나지 않는 Promise를 돌려주고(페이지가 내려감), 복귀 후 로그인 화면이
 * `hasGoogleRedirect()`를 보고 다시 호출하면 프래그먼트의 id token을 돌려준다 —
 * 그 뒤는 네이티브와 같은 `/auth/google`.
 *
 * 필요한 설정(Google Cloud Console, 프로젝트 rougether, 웹 클라이언트
 * `GOOGLE_WEB_CLIENT_ID`): 승인된 리디렉션 URI에 `<origin>/login`
 * (운영 https://app.rougether.com/login, 로컬 http://localhost:8081/login).
 */
import {
  buildGoogleAuthorizeUrl,
  parseGoogleRedirect,
  stripGoogleFragment,
} from './google-web-oauth';
import { GOOGLE_WEB_CLIENT_ID } from './oauth-client-ids';

const STATE_KEY = 'rougether.google-web.state';
const NONCE_KEY = 'rougether.google-web.nonce';

function redirectUri(): string {
  return `${window.location.origin}/login`;
}

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function randomHex(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function expected() {
  return { state: read(STATE_KEY), nonce: read(NONCE_KEY) };
}

/** 구글에서 리다이렉트로 돌아온 진입인가 — 로그인 화면이 나머지 절반을 이어가게 한다. */
export function hasGoogleRedirect(): boolean {
  return parseGoogleRedirect(window.location.hash, expected()) != null;
}

/**
 * 구글 로그인 — 복귀 진입이면 id token을 반환하고, 아니면 accounts.google.com으로
 * 떠난다(반환하지 않는 Promise).
 * - 사용자가 동의 화면에서 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - state·nonce 불일치, 그 밖의 인가 오류는 throw — 호출부가 실패 문구를 띄운다.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  const back = parseGoogleRedirect(window.location.hash, expected());
  if (back) {
    // 복귀 파라미터는 1회용 — 새로고침으로 같은 토큰을 다시 쓰지 않게, 토큰이
    // 주소창·히스토리에 남지 않게 즉시 걷어낸다.
    window.sessionStorage.removeItem(STATE_KEY);
    window.sessionStorage.removeItem(NONCE_KEY);
    window.history.replaceState(null, '', stripGoogleFragment(window.location.href));
    if (back.kind === 'cancelled') return null;
    if (back.kind === 'state_mismatch') throw new Error('google redirect state mismatch');
    if (back.kind === 'nonce_mismatch') throw new Error('google redirect nonce mismatch');
    if (back.kind === 'error') throw new Error(`google authorize error: ${back.error}`);
    return back.idToken;
  }
  const state = randomHex();
  const nonce = randomHex();
  window.sessionStorage.setItem(STATE_KEY, state);
  window.sessionStorage.setItem(NONCE_KEY, nonce);
  window.location.assign(
    buildGoogleAuthorizeUrl({
      clientId: GOOGLE_WEB_CLIENT_ID,
      redirectUri: redirectUri(),
      state,
      nonce,
    }),
  );
  return new Promise<string | null>(() => {
    // 페이지가 accounts.google.com으로 떠나므로 여기서 끝나지 않는다.
  });
}

/** 웹은 구글 세션이 브라우저 것이라 앱 로그아웃에서 건드리지 않는다. */
export async function signOutGoogle(): Promise<void> {
  // no-op
}
