/**
 * 카카오 네이티브 로그인 래퍼 (#489 소셜 2차) — @react-native-kakao/user.
 * 카카오톡 앱(설치 시) 또는 카카오계정 웹뷰로 로그인해 access token을 얻는다.
 * 구글(idToken)과 달리 카카오는 access token을 서버(/auth/kakao)로 보내고,
 * 서버가 카카오 API로 유효성·앱 id를 검증한다 (스펙 member/api.md).
 * 네이티브 앱 키 초기화는 app.json의 @react-native-kakao/core 플러그인 값과
 * 같은 키를 사용해야 한다.
 */
import { initializeKakaoSDK } from '@react-native-kakao/core';
import { login as kakaoNativeLogin, logout as kakaoNativeLogout } from '@react-native-kakao/user';

/** 카카오 네이티브 앱 키 — app.json 플러그인(nativeAppKey)과 동일 값. */
const KAKAO_NATIVE_APP_KEY = '51365df21c97a355d92bc098e7677d3f';

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initializeKakaoSDK(KAKAO_NATIVE_APP_KEY);
  initialized = true;
}

/**
 * 카카오 로그인을 띄우고 access token을 반환한다.
 * - 사용자가 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 그 외 실패는 throw — 호출부가 실패 문구를 띄운다.
 */
export async function getKakaoAccessToken(): Promise<string | null> {
  ensureInitialized();
  try {
    const token = await kakaoNativeLogin();
    if (!token.accessToken) throw new Error('no accessToken in Kakao login response');
    return token.accessToken;
  } catch (err) {
    // SDK는 사용자 취소도 예외로 던진다. 양 플랫폼 공히 취소는 Kakao SDK의
    // ClientError(reason=Cancelled)가 reason 이름 그대로 code로 전달된다
    // (Android RNCKakaoUtil.kt reject(e.reason.name…) / iOS "\(reason)") —
    // 구조화된 code 비교가 1차, 메시지 매칭은 SDK 변형 대비 보조.
    const code = (err as { code?: string }).code ?? '';
    if (code === 'Cancelled') return null;
    const msg = `${(err as { message?: string }).message ?? ''} ${code}`;
    if (/cancel/i.test(msg)) return null;
    throw err;
  }
}

/** 로그아웃 시 카카오 세션도 정리(선택) — 실패해도 앱 로그아웃은 막지 않는다. */
export async function signOutKakao(): Promise<void> {
  try {
    ensureInitialized();
    await kakaoNativeLogout();
  } catch {
    // best-effort
  }
}
