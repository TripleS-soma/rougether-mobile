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
import type { SocialLoginOptions } from '@/api/auth';
import type { LoginResponse } from '@/api/types';
import { getAppleCredential } from '@/lib/apple-auth';
import { getGoogleIdToken, signOutGoogle } from '@/lib/google-auth';
import { getKakaoAccessToken, signOutKakao } from '@/lib/kakao-auth';
import { saveLastLoginProvider, type SocialProvider } from '@/lib/last-login';
import { clearPushToken, syncPushToken } from '@/lib/push-token';
import { resetAnalyticsUser, track } from '@/lib/analytics';
import { clearErrorUser, reportError } from '@/lib/error-reporting';
import {
  type LoginConflict,
  parseLoginConflict,
  type SocialLoginResult,
} from '@/lib/login-conflict';
import { clearLoginFailure, describeLoginError, rememberLoginFailure } from '@/lib/login-error';
import { wipeLocalAppData } from '@/lib/local-wipe';

type AuthStatus = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  status: AuthStatus;
  /** Dev-login by userId — omit to create a fresh user. Resolves true on success. */
  login: (userId?: number) => Promise<boolean>;
  /**
   * 구글 로그인 (#489): 계정 시트 → id token → POST /auth/google.
   * 'ok' 성공 / 'cancelled' 사용자가 시트를 닫음(조용히 무시) / 'failed' 실패 /
   * `LoginConflict` 같은 이메일의 활성 계정이 다른 provider로 있어 서버가 가입을
   * 막음(409) — 화면이 [OO로 로그인] / [새 계정으로 계속]을 띄운다.
   */
  loginWithGoogle: () => Promise<SocialLoginResult>;
  /** 카카오 로그인 (#489 소셜 2차): 카카오 SDK → access token → POST /auth/kakao. */
  loginWithKakao: () => Promise<SocialLoginResult>;
  /** 애플 로그인 (#489 소셜 3차, iOS 전용): Apple 시트 → identityToken → POST /auth/apple. */
  loginWithApple: () => Promise<SocialLoginResult>;
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
/**
 * 로그인 실패를 남긴다 (#959) — 종전엔 `catch {}` 로 에러를 통째로 버려서
 * 배포본 장애의 원인을 알 방법이 없었다. GA4에는 코드·힌트를, Sentry에는
 * 에러 자체를 보낸다.
 */
function reportLoginFailure(provider: 'google' | 'kakao' | 'apple', err: unknown) {
  const f = describeLoginError(err);
  rememberLoginFailure(f);
  track('login_failed', {
    provider,
    // 값이 없으면 파라미터를 비우지 않고 'unknown'으로 — GA4에서 "코드가 안
    // 온 실패"와 "이벤트가 안 온 것"을 구분할 수 있어야 한다.
    code: f.code ?? 'unknown',
    ...(f.hint ? { hint: f.hint } : {}),
    // 코드가 없는 실패(라이브러리가 코드를 안 주는 경로)에서는 메시지가
    // 유일한 단서다 — 이게 빠지면 'unknown'만 남아 아무것도 못 가린다.
    ...(f.message ? { detail: f.message } : {}),
  });
  reportError(err, {
    scope: 'login',
    provider,
    ...(f.code ? { code: f.code } : {}),
    ...(f.message ? { detail: f.message } : {}),
  });
}

/**
 * 자격증명 → 서버 교환 → 세션 시작. 409(같은 이메일 타 provider 계정 안내)는 실패가
 * 아니라 선택지다 — 자격증명을 닫아둔 채 `continueAsNew`(allowNewAccount 재요청)를
 * 돌려주고, 그 재요청에서 또 409가 오면 더는 안내하지 않고 실패로 본다.
 */
async function exchangeCredential(
  provider: SocialProvider,
  exchange: (options: SocialLoginOptions) => Promise<LoginResponse>,
  onAuthed: () => void,
  options: SocialLoginOptions = {},
): Promise<'ok' | 'failed' | LoginConflict> {
  try {
    await exchange(options);
  } catch (err) {
    const conflict = options.allowNewAccount ? null : parseLoginConflict(err);
    if (conflict) {
      // 퍼널 계측 (#799 결) — 실패도 성공도 아닌 갈림길이라 따로 센다.
      track('login_conflict', { provider, existing: conflict.providers.join('|') });
      return {
        status: 'conflict',
        ...conflict,
        continueAsNew: async () => {
          track('login_conflict_continue', { provider });
          const retry = await exchangeCredential(provider, exchange, onAuthed, {
            allowNewAccount: true,
          });
          return retry === 'ok' ? 'ok' : 'failed';
        },
      };
    }
    reportLoginFailure(provider, err);
    return 'failed';
  }
  onAuthed();
  // 최근 로그인 배지(#489 후속) — 다음 로그인 화면이 이 버튼을 표시.
  saveLastLoginProvider(provider);
  // 퍼널 첫 칸 (#799). 취소('cancelled')는 사용자가 스스로 물러난
  // 것이라 실패로 세지 않는다 — 실패율이 부풀면 신호가 죽는다.
  clearLoginFailure();
  track('login_success', { provider });
  void syncPushToken();
  return 'ok';
}

/** 네이티브 시트(취소 → null, 실패 → throw) 뒤 서버 교환까지 — 세 provider 공통 골격. */
async function socialLogin<C>(
  provider: SocialProvider,
  obtain: () => Promise<C | null>,
  exchange: (credential: C, options: SocialLoginOptions) => Promise<LoginResponse>,
  onAuthed: () => void,
): Promise<SocialLoginResult> {
  let credential: C | null;
  try {
    credential = await obtain();
  } catch (err) {
    reportLoginFailure(provider, err);
    return 'failed';
  }
  if (credential == null) return 'cancelled';
  const obtained = credential;
  return exchangeCredential(provider, (options) => exchange(obtained, options), onAuthed);
}

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

  const value = useMemo<AuthContextValue>(() => {
    const onAuthed = () => setStatus('authed');
    return {
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
      loginWithGoogle: () =>
        socialLogin(
          'google',
          getGoogleIdToken,
          (idToken, options) => googleLogin(idToken, options),
          onAuthed,
        ),
      loginWithKakao: () =>
        socialLogin(
          'kakao',
          getKakaoAccessToken,
          (accessToken, options) => kakaoLogin(accessToken, options),
          onAuthed,
        ),
      loginWithApple: () =>
        socialLogin(
          'apple',
          getAppleCredential,
          (credential, options) =>
            appleLogin(credential.identityToken, credential.authorizationCode, options),
          onAuthed,
        ),
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
        // 계정 파생 로컬 데이터 전량 삭제 (#922) — 이게 없으면 재가입해도
        // 온보딩이 안 뜨고, 홈 화면 위젯에 이전 계정의 방이 남는다.
        await wipeLocalAppData();
        setStatus('guest');
        return true;
      },
    };
  }, [status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
