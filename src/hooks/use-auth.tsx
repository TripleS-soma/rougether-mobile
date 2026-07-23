import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { devLogin, loadSession, logout as apiLogout, onSessionCleared } from '@/api';
import { clearPushToken, syncPushToken } from '@/lib/push-token';
import { resetAnalyticsUser } from '@/lib/analytics';

type AuthStatus = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  /** Dev-login by userId — omit to create a fresh user. Resolves true on success. */
  login: (userId?: number) => Promise<boolean>;
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
      logout: async () => {
        resetAnalyticsUser();
        // 이 기기로 오는 푸시를 먼저 끊고 세션을 정리한다 (#250).
        await clearPushToken();
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
