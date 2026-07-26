/**
 * 구글 네이티브 로그인 래퍼 (#489) — @react-native-google-signin/google-signin.
 * 계정 시트를 띄워 서버 검증용 id token을 얻는다. 서버(/auth/google)는 이
 * 토큰의 서명(JWK)과 aud(웹 클라이언트 ID)를 검증하므로, webClientId는
 * Firebase 콘솔의 웹 OAuth 클라이언트와 반드시 일치해야 한다.
 */
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

/** Firebase 웹 OAuth 클라이언트 (google-services.json oauth_client type 3). */
const GOOGLE_WEB_CLIENT_ID =
  '437063052004-99kq37m58jcj7nakm9uhottgskphob95.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/**
 * 구글 계정 시트를 띄우고 id token을 반환한다.
 * - 사용자가 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - Play 서비스 부재/그 외 실패는 throw — 호출부가 실패 메시지를 띄운다.
 */
export async function getGoogleIdToken(): Promise<string | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const res = await GoogleSignin.signIn();
    if (res.type === 'cancelled') return null;
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('no idToken in Google sign-in response');
    return idToken;
  } catch (err) {
    // v16도 취소를 예외로 던지는 경로가 남아 있다 — 코드로 한 번 더 거른다.
    if ((err as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw err;
  }
}

/** 로그아웃 시 구글 세션도 정리(선택) — 실패해도 앱 로그아웃은 막지 않는다. */
export async function signOutGoogle(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // best-effort
  }
}
