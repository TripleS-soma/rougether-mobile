/**
 * 애플 네이티브 로그인 래퍼 (#489 소셜 3차) — expo-apple-authentication.
 * Sign in with Apple 시트를 띄워 identityToken(JWT)을 얻는다. 서버(/auth/apple)가
 * 서명·발급자·aud(번들 ID com.triples.rougether)·만료를 검증한다.
 * 이 라이브러리는 iOS 전용 — Android/웹에서는 버튼 자체를 노출하지 않는다
 * (login-screen의 Platform 가드).
 */
import * as AppleAuthentication from 'expo-apple-authentication';

export type AppleCredential = {
  identityToken: string;
  /** 회원탈퇴 revoke용 (#547, 서버 #235) — 서버가 refresh token으로 교환·보관. */
  authorizationCode: string;
};

/**
 * 애플 로그인 시트를 띄우고 identityToken + authorizationCode를 반환한다.
 * - 사용자가 취소하면 null (에러 아님 — 조용히 로그인 화면 유지).
 * - 그 외 실패는 throw — 호출부가 실패 문구를 띄운다.
 * 이름/이메일 스코프는 최초 1회만 내려오지만 서버는 토큰만 쓰므로 무시해도 된다.
 */
export async function getAppleCredential(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('no identityToken in Apple credential');
    // 서버 계약(#235)이 탈퇴 revoke 준비를 위해 코드를 필수로 받는다 — 없이
    // 보내면 어차피 400이라 여기서 실패시켜 실패 문구 경로로 보낸다.
    if (!credential.authorizationCode) throw new Error('no authorizationCode in Apple credential');
    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
    };
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}
