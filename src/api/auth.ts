/**
 * Auth session: JWT access/refresh tokens for the bearer-secured API. Tokens are
 * cached in memory and mirrored to AsyncStorage so a session survives app
 * restarts. The public auth endpoints (dev-login / refresh / logout, all
 * `security: []`) are called here via the low-level `rawRequest`; the authed
 * `client.ts` reads/refreshes the session but never imports it the other way,
 * avoiding an import cycle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, rawRequest } from './http';
import type {
  AppleLoginRequest,
  DevLoginRequest,
  GoogleLoginRequest,
  KakaoLoginRequest,
  LoginResponse,
  TokenResponse,
} from './types';

const ACCESS_KEY = 'rougether.auth.accessToken';
const REFRESH_KEY = 'rougether.auth.refreshToken';
const USER_KEY = 'rougether.auth.userId';

type Session = { accessToken: string; refreshToken: string; userId?: number };

let session: Session | null = null;

/** Load a persisted session into memory (call once at app startup). */
export async function loadSession(): Promise<Session | null> {
  const [access, refresh, userId] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  if (access && refresh) {
    session = {
      accessToken: access,
      refreshToken: refresh,
      userId: userId ? Number(userId) : undefined,
    };
  }
  return session;
}

async function persist(next: Session) {
  session = next;
  await Promise.all([
    AsyncStorage.setItem(ACCESS_KEY, next.accessToken),
    AsyncStorage.setItem(REFRESH_KEY, next.refreshToken),
    next.userId != null
      ? AsyncStorage.setItem(USER_KEY, String(next.userId))
      : AsyncStorage.removeItem(USER_KEY),
  ]);
}

export function getAccessToken(): string | null {
  return session?.accessToken ?? null;
}

/** The signed-in user's id (from dev-login), if known. */
export function getSessionUserId(): number | undefined {
  return session?.userId;
}

type SessionClearedListener = () => void;
const sessionClearedListeners = new Set<SessionClearedListener>();

/**
 * Subscribe to session invalidation — logout, or a failed token refresh inside
 * `client.ts`. Lets the UI layer (AuthProvider) flip to guest and redirect to
 * the login screen even when the session dies mid-request. Returns unsubscribe.
 */
export function onSessionCleared(listener: SessionClearedListener): () => void {
  sessionClearedListeners.add(listener);
  return () => {
    sessionClearedListeners.delete(listener);
  };
}

/** Clear the in-memory + persisted session (e.g. on logout or refresh failure). */
export async function clearSession(): Promise<void> {
  session = null;
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_KEY),
    AsyncStorage.removeItem(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY),
  ]);
  sessionClearedListeners.forEach((listener) => listener());
}

/**
 * Dev-only login: exchange a userId for a token pair and start a session.
 * Omit `userId` to have the server CREATE a fresh user (isNewUser: true).
 */
export async function devLogin(userId?: number): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/dev-login', {
    body: { userId: userId ?? null } as DevLoginRequest,
  });
  if (res.accessToken && res.refreshToken) {
    await persist({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      userId: res.userId,
    });
  }
  return res;
}

/**
 * 구글 로그인 (#489): 네이티브 SDK가 얻은 id token을 서버로 보내 토큰 쌍을
 * 받고 세션을 시작한다. 최초 로그인이면 서버가 자동 가입(isNewUser: true).
 * 서버는 JWK로 서명·aud를 검증한다 (aud 허용목록 fail-closed).
 */
export async function googleLogin(idToken: string): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/google', {
    body: { idToken } as GoogleLoginRequest,
  });
  if (res.accessToken && res.refreshToken) {
    await persist({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      userId: res.userId,
    });
  }
  return res;
}

/**
 * 카카오 로그인 (#489 소셜 2차): 네이티브 SDK가 얻은 access token을 서버로
 * 보내 토큰 쌍을 받고 세션을 시작한다. 최초 로그인이면 자동 가입. 서버가
 * 카카오 API로 토큰 유효성·앱 id를 검증한다.
 */
export async function kakaoLogin(accessToken: string): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/kakao', {
    body: { accessToken } as KakaoLoginRequest,
  });
  if (res.accessToken && res.refreshToken) {
    await persist({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      userId: res.userId,
    });
  }
  return res;
}

/**
 * 애플 로그인 (#489 소셜 3차): Sign in with Apple이 얻은 identityToken을 서버로
 * 보내 토큰 쌍을 받고 세션을 시작한다. 최초 로그인이면 자동 가입. 서버가
 * 서명·발급자·aud(번들 ID)·만료를 검증한다.
 */
export async function appleLogin(idToken: string): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/apple', {
    body: { idToken } as AppleLoginRequest,
  });
  if (res.accessToken && res.refreshToken) {
    await persist({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      userId: res.userId,
    });
  }
  return res;
}

// 진행 중인 갱신 — 동시 401들이 이 Promise를 공유한다 (#515).
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a fresh pair. Returns true on success.
 * Called by `client.ts` on a 401.
 *
 * Single-flight (#515): 리프레시 토큰은 1회용(사용 즉시 폐기·교체)이라,
 * 앱 재개 직후처럼 여러 요청이 동시에 401을 맞아도 갱신은 한 번만 뛰고
 * 전원이 그 결과를 기다렸다가 새 토큰으로 재시도해야 한다 — 각자 갱신하면
 * 진 쪽이 AUTH_REFRESH_TOKEN_INVALID를 받고 세션을 지워 강제 로그아웃됐다.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= doRefreshSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefreshSession(): Promise<boolean> {
  const refreshToken = session?.refreshToken;
  if (!refreshToken) return false;
  try {
    const res = await rawRequest<TokenResponse>('POST', '/auth/refresh', {
      body: { refreshToken },
    });
    if (res.accessToken && res.refreshToken) {
      await persist({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        userId: session?.userId,
      });
      return true;
    }
    await clearSession();
    return false;
  } catch (err) {
    // 서버가 토큰을 명시적으로 거부(4xx)했을 때만 로그아웃한다 (#515) —
    // 네트워크 오류(TypeError)는 물론, 재배포 순단·게이트웨이 타임아웃 같은
    // 5xx도 세션을 보존한다. 보존된 세션은 다음 요청의 401 → 재갱신 경로에서
    // 다시 기회를 얻는다.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) await clearSession();
    return false;
  }
}

/** Revoke the refresh token server-side and clear the local session. */
export async function logout(): Promise<void> {
  const refreshToken = session?.refreshToken;
  if (refreshToken) {
    try {
      await rawRequest<void>('POST', '/auth/logout', { body: { refreshToken } });
    } catch {
      // Best-effort revoke; clear locally regardless.
    }
  }
  await clearSession();
}
