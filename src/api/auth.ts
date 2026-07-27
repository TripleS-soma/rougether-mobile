/**
 * Auth session: JWT access/refresh tokens for the bearer-secured API. Tokens are
 * cached in memory and mirrored to AsyncStorage so a session survives app
 * restarts. The public auth endpoints (dev-login / refresh / logout, all
 * `security: []`) are called here via the low-level `rawRequest`; the authed
 * `client.ts` reads/refreshes the session but never imports it the other way,
 * avoiding an import cycle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { rawRequest } from './http';
import type {
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
 * Exchange the stored refresh token for a fresh pair. Returns true on success;
 * on failure the session is cleared. Called by `client.ts` on a 401.
 */
export async function refreshSession(): Promise<boolean> {
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
  } catch {
    await clearSession();
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
