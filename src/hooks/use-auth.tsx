import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  appleLogin,
  clearSession,
  deleteMe,
  devLogin,
  googleLogin,
  kakaoLogin,
  loadSession,
  logout as apiLogout,
  onSessionCleared,
} from '@/api';
import { getAppleCredential } from '@/lib/apple-auth';
import { getGoogleIdToken, signOutGoogle } from '@/lib/google-auth';
import { getKakaoAccessToken, signOutKakao } from '@/lib/kakao-auth';
import { saveLastLoginProvider } from '@/lib/last-login';
import { clearPushToken, syncPushToken } from '@/lib/push-token';
import { resetAnalyticsUser, track } from '@/lib/analytics';
import { clearErrorUser } from '@/lib/error-reporting';

type AuthStatus = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  /** Dev-login by userId — omit to create a fresh user. Resolves true on success. */
  login: (userId?: number) => Promise<boolean>;
  /**
   * 구글 로그인 (#489): 계정 시트 → id token → POST /auth/google.
   * 'ok' 성공 / 'cancelled' 사용자가 시트를 닫음(조용히 무시) / 'failed' 실패.
   */
  loginWithGoogle: () => Promise<'ok' | 'cancelled' | 'failed'>;
  /** 카카오 로그인 (#489 소셜 2차): 카카오 SDK → access token → POST /auth/kakao. */
  loginWithKakao: () => Promise<'ok' | 'cancelled' | 'failed'>;
  /** 애플 로그인 (#489 소셜 3차, iOS 전용): Apple 시트 → identityToken → POST /auth/apple. */
  loginWithApple: () => Promise<'ok' | 'cancelled' | 'failed'>;
  logout: () => Promise<void>;
  /**
   * 회원탈퇴 (#547, 서버 #235) — DELETE /me 성공 시 로컬 세션·소셜 세션을
   * 정리하고 guest로 전환한다(AppRoot가 로그인 화면으로 보냄). 실패 시 false —
   * 호출부가 에러 문구를 띄운다.
   */
  withdraw: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Reactive auth session. Restores a persisted session on mount, then exposes
 * `status` (loading → authed | guest) plus login/logout. Wrap the app once in
 * the root layout; consume via `useAuth()`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;
    void loadSession().then((session) => {
      if (active) setStatus(session ? 'authed' : 'guest');
      // 복원된 세션도 토큰을 최신화 (#405) — 자동 로그인만 하는 기기가
      // 재로그인 없이 (재)등록 기회를 갖는다. 실패해도 무해(soft-fail).
      if (session) void syncPushToken();
    });
    return () => {
      active = false;
    };
  }, []);

  // The API layer clears the session when a token refresh fails (expired /
  // invalid tokens). Flip to guest so AppRoot redirects to /login.
  useEffect(() => onSessionCleared(() => setStatus('guest')), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      login: async (userId) => {
        try {
          await devLogin(userId);
          setStatus('authed');
          // 푸시 토큰 등록(#250)은 백그라운드로 — 실패해도 로그인은 막지 않는다.
          void syncPushToken();
          return true;
        } catch {
          return false;
        }
      },
      loginWithGoogle: async () => {
        try {
          const idToken = await getGoogleIdToken();
          if (idToken == null) return 'cancelled';
          await googleLogin(idToken);
          setStatus('authed');
          // 최근 로그인 배지(#489 후속) — 다음 로그인 화면이 이 버튼을 표시.
          saveLastLoginProvider('google');
          // 퍼널 첫 칸 (#799). 취소('cancelled')는 사용자가 스스로 물러난
          // 것이라 실패로 세지 않는다 — 실패율이 부풀면 신호가 죽는다.
          track('login_success', { provider: 'google' });
          void syncPushToken();
          return 'ok';
        } catch {
          track('login_failed', { provider: 'google' });
          return 'failed';
        }
      },
      loginWithKakao: async () => {
        try {
          const accessToken = await getKakaoAccessToken();
          if (accessToken == null) return 'cancelled';
          await kakaoLogin(accessToken);
          setStatus('authed');
          saveLastLoginProvider('kakao');
          // 퍼널 첫 칸 (#799). 취소('cancelled')는 사용자가 스스로 물러난
          // 것이라 실패로 세지 않는다 — 실패율이 부풀면 신호가 죽는다.
          track('login_success', { provider: 'kakao' });
          void syncPushToken();
          return 'ok';
        } catch {
          track('login_failed', { provider: 'kakao' });
          return 'failed';
        }
      },
      loginWithApple: async () => {
        try {
          const credential = await getAppleCredential();
          if (credential == null) return 'cancelled';
          await appleLogin(credential.identityToken, credential.authorizationCode);
          setStatus('authed');
          saveLastLoginProvider('apple');
          // 퍼널 첫 칸 (#799). 취소('cancelled')는 사용자가 스스로 물러난
          // 것이라 실패로 세지 않는다 — 실패율이 부풀면 신호가 죽는다.
          track('login_success', { provider: 'apple' });
          void syncPushToken();
          return 'ok';
        } catch {
          track('login_failed', { provider: 'apple' });
          return 'failed';
        }
      },
      logout: async () => {
        resetAnalyticsUser();
        clearErrorUser();
        // 이 기기로 오는 푸시를 먼저 끊고 세션을 정리한다 (#250).
        await clearPushToken();
        // 소셜 세션도 정리 — 다음 로그인 때 계정 선택이 다시 뜨게 (best-effort).
        await signOutGoogle();
        await signOutKakao();
        await apiLogout();
        setStatus('guest');
      },
      withdraw: async () => {
        try {
          // 서버가 토큰 폐기·기기 토큰 삭제·소셜 unlink까지 한 번에 처리하므로
          // 탈퇴 호출이 먼저다(인증 필요) — 이후는 로컬 정리만.
          await deleteMe();
        } catch {
          return false;
        }
        resetAnalyticsUser();
        clearErrorUser();
        // 서버 기기 토큰은 이미 삭제됨 — 로컬 토큰 상태만 정리(베스트 에포트).
        await clearPushToken().catch(() => {});
        // 기기 소셜 세션 정리 — 재로그인(=신규 가입) 때 계정 선택이 다시 뜨게.
        await signOutGoogle();
        await signOutKakao();
        // apiLogout은 서버에 refresh 폐기를 요청하는데 이미 전량 폐기됨 —
        // 로컬 세션만 지운다.
        await clearSession();
        setStatus('guest');
        return true;
      },
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
