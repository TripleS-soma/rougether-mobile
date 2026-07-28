/**
 * 애플 네이티브 로그인 래퍼 (#489 소셜 3차) — expo-apple-authentication.
 * Sign in with Apple 시트를 띄워 identityToken(JWT)을 얻는다. 서버(/auth/apple)가
 * 서명·발급자·aud(번들 ID com.triples.rougether)·만료를 검증한다.
 * 이 라이브러리는 iOS 전용 — Android/웹에서는 버튼 자체를 노출하지 않는다
 * (login-screen의 Platform 가드).
 */
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * 애플 로그인 시트를 띄우고 identityToken을 반환한다.
 * - 사용자가 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 그 외 실패는 throw — 호출부가 실패 문구를 띄운다.
 * 이름/이메일 스코프는 최초 1회만 내려오지만 서버는 idToken만 쓰므로 무시해도 된다.
 */
export async function getAppleIdentityToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('no identityToken in Apple credential');
    return credential.identityToken;
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}
