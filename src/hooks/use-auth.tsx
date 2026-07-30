import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  appleLogin,
  devLogin,
  googleLogin,
  kakaoLogin,
  loadSession,
  logout as apiLogout,
  onSessionCleared,
} from '@/api';
import { getAppleIdentityToken } from '@/lib/apple-auth';
import { getGoogleIdToken, signOutGoogle } from '@/lib/google-auth';
import { getKakaoAccessToken, signOutKakao } from '@/lib/kakao-auth';
import { saveLastLoginProvider } from '@/lib/last-login';
import { clearPushToken, syncPushToken } from '@/lib/push-token';
import { resetAnalyticsUser } from '@/lib/analytics';

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
          void syncPushToken();
          return 'ok';
        } catch {
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
          void syncPushToken();
          return 'ok';
        } catch {
          return 'failed';
        }
      },
      loginWithApple: async () => {
        try {
          const idToken = await getAppleIdentityToken();
          if (idToken == null) return 'cancelled';
          await appleLogin(idToken);
          setStatus('authed');
          saveLastLoginProvider('apple');
          void syncPushToken();
          return 'ok';
        } catch {
          return 'failed';
        }
      },
      logout: async () => {
        resetAnalyticsUser();
        // 이 기기로 오는 푸시를 먼저 끊고 세션을 정리한다 (#250).
        await clearPushToken();
        // 소셜 세션도 정리 — 다음 로그인 때 계정 선택이 다시 뜨게 (best-effort).
        await signOutGoogle();
        await signOutKakao();
        await apiLogout();
        setStatus('guest');
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
