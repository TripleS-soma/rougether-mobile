/**
 * Auth session: JWT access/refresh tokens for the bearer-secured API. Tokens are
 * cached in memory and mirrored to AsyncStorage so a session survives app
 * restarts. The public auth endpoints (dev-login / refresh / logout, all
 * `security: []`) are called here via the low-level `rawRequest`; the authed
 * `client.ts` reads/refreshes the session but never imports it the other way,
 * avoiding an import cycle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/error-reporting';

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
let sessionRevision = 0;

/** Load a persisted session into memory (call once at app startup). */
export async function loadSession(isCurrent: () => boolean = () => true): Promise<Session | null> {
  const revision = sessionRevision;
  const [access, refresh, userId] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  if (!isCurrent() || revision !== sessionRevision) return session;
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
  sessionRevision += 1;
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

/**
 * 세션이 지워진 이유 (#1388). 사용자가 스스로 나간 것(logout·withdraw)과 서버가 갱신을 거부해
 * **강제로** 풀린 것을 가른다 — "하루에도 여러 번 로그인이 풀린다"는 보고의 실제 빈도·경로를
 * 보려면 후자만 따로 세야 한다.
 */
export type SessionClearReason = 'logout' | 'withdraw' | 'refresh_rejected' | 'refresh_empty';

/** 강제 로그아웃 계측 — 앱이 앞에 있었는지(foreground)와 서버 오류 코드를 함께 남긴다. */
function reportForcedLogout(
  reason: SessionClearReason,
  detail: { status?: number; code?: string },
) {
  const props = {
    reason,
    status: String(detail.status ?? 0),
    code: detail.code ?? 'none',
    app_state: AppState.currentState ?? 'unknown',
  };
  track('session_forced_logout', props);
  reportError(new Error(`forced logout: ${reason}`), props);
}

/** Clear the in-memory + persisted session (e.g. on logout or refresh failure). */
export async function clearSession(
  reason: SessionClearReason = 'logout',
  detail: { status?: number; code?: string } = {},
): Promise<void> {
  if (reason === 'refresh_rejected' || reason === 'refresh_empty')
    reportForcedLogout(reason, detail);
  sessionRevision += 1;
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
 * 소셜 로그인 공통 옵션. `allowNewAccount` 는 서버가 409
 * AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER(같은 이메일의 활성 계정이 다른 provider로
 * 있음)로 가입을 막았을 때, 사용자가 "새 계정으로 계속"을 고른 재요청에서만 true.
 */
export type SocialLoginOptions = { allowNewAccount?: boolean };

/**
 * 서버 스펙에 `allowNewAccount`가 올라오기 전까지의 클라 전용 바디 확장. `types.ts`는
 * 생성 파일이라 손으로 고치면 재생성 때 사라진다(#733) — 스펙 반영 후 `npm run
 * gen:api-types` 로 필드가 들어오면 이 타입은 지운다.
 */
type LoginFlags = { allowNewAccount?: true };

/** 기본 요청 바디는 그대로 두고, 켜졌을 때만 플래그를 싣는다 (기존 바디 계약 유지). */
function loginFlags(options?: SocialLoginOptions): LoginFlags {
  return options?.allowNewAccount ? { allowNewAccount: true } : {};
}

/**
 * 구글 로그인 (#489): 네이티브 SDK가 얻은 id token을 서버로 보내 토큰 쌍을
 * 받고 세션을 시작한다. 최초 로그인이면 서버가 자동 가입(isNewUser: true).
 * 서버는 JWK로 서명·aud를 검증한다 (aud 허용목록 fail-closed).
 */
export async function googleLogin(
  idToken: string,
  options?: SocialLoginOptions,
): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/google', {
    body: { idToken, ...loginFlags(options) } satisfies GoogleLoginRequest & LoginFlags,
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
export async function kakaoLogin(
  accessToken: string,
  options?: SocialLoginOptions,
): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/kakao', {
    body: { accessToken, ...loginFlags(options) } satisfies KakaoLoginRequest & LoginFlags,
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
 * 서명·발급자·aud(번들 ID)·만료를 검증한다. authorizationCode는 서버(#235)가
 * refresh token으로 교환·보관해 회원탈퇴 revoke에 쓴다 — 필수(없으면 400).
 */
export async function appleLogin(
  idToken: string,
  authorizationCode: string,
  options?: SocialLoginOptions,
): Promise<LoginResponse> {
  const res = await rawRequest<LoginResponse>('POST', '/auth/apple', {
    body: {
      idToken,
      authorizationCode,
      ...loginFlags(options),
    } satisfies AppleLoginRequest & LoginFlags,
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

/**
 * 웹 탭 간 갱신 직렬화 (#1261). 탭마다 JS 프로세스(=메모리 `session`)가 다르고
 * 저장소(localStorage)만 공유하므로, 두 탭이 동시에 회전하면 진 쪽의 refresh가
 * "재사용"으로 잡혀 서버가 **모든 토큰을 폐기**한다. Web Locks가 있으면 그 안에서
 * 갱신하고, 없거나 네이티브면 그대로 실행한다(네이티브는 프로세스 하나).
 */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (locks?.request) return locks.request('rougether.auth.refresh', fn) as Promise<T>;
  return fn();
}

/**
 * 저장소의 쌍이 메모리와 다르면 다른 탭(또는 다른 진입점)이 이미 회전한 것 —
 * 서버를 부르지 않고 그 쌍을 채택한다 (#1261). 채택 뒤 재시도가 다시 401이면
 * 다음 갱신은 저장된 refresh(최신)로 뛴다.
 */
async function adoptStoredSessionIfNewer(): Promise<boolean> {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  if (!access || !refresh) return false;
  if (access === session?.accessToken && refresh === session?.refreshToken) return false;
  session = { accessToken: access, refreshToken: refresh, userId: session?.userId };
  return true;
}

function doRefreshSession(): Promise<boolean> {
  return withRefreshLock(async () => {
    // 잠금을 얻는 사이 다른 탭이 끝냈을 수 있다 — 먼저 저장소를 본다.
    if (await adoptStoredSessionIfNewer()) return true;
    return exchangeRefreshToken();
  });
}

/**
 * 갱신이 거부된 뒤, 우리가 보낸 refresh와 **다른** 쌍이 저장소에 있으면 다른 실행 맥락이 이미
 * 회전한 것이다 (#1388) — Android 백그라운드 작업(앱 아이콘)이나 다른 탭이 같은 저장소로 먼저
 * 갱신한 경우. 서버는 우리 토큰을 "재사용"으로 봤지만 저장소의 새 쌍은 살아 있으니 채택한다.
 */
async function adoptStoredAfterRejection(sentRefresh: string): Promise<boolean> {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  if (!access || !refresh || refresh === sentRefresh) return false;
  session = { accessToken: access, refreshToken: refresh, userId: session?.userId };
  track('session_refresh_adopted', { app_state: AppState.currentState ?? 'unknown' });
  return true;
}

async function exchangeRefreshToken(): Promise<boolean> {
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
    await clearSession('refresh_empty');
    return false;
  } catch (err) {
    // 서버가 토큰을 명시적으로 거부(4xx)했을 때만 로그아웃한다 (#515) —
    // 네트워크 오류(TypeError)는 물론, 재배포 순단·게이트웨이 타임아웃 같은
    // 5xx도 세션을 보존한다. 보존된 세션은 다음 요청의 401 → 재갱신 경로에서
    // 다시 기회를 얻는다.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      if (await adoptStoredAfterRejection(refreshToken)) return true;
      await clearSession('refresh_rejected', { status: err.status, code: err.code });
    }
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
