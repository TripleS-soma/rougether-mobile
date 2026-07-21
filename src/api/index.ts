/**
 * Rougether User API v1 client. Import domain functions from here, e.g.
 * `import { fetchToday, completeRoutine, devLogin } from '@/api'`.
 *
 * Layers: config (base URL) → http (rawRequest + ApiError) → auth (JWT session)
 * → client (authed apiGet/apiPost/…) → per-domain modules below. Types live in
 * `./types` (generated from the OpenAPI spec).
 */
export { ApiError } from './http';
export {
  apiDelete,
  apiGet,
  apiGetList,
  apiPatch,
  apiPost,
  apiPut,
  type RequestOptions,
} from './client';

export {
  clearSession,
  devLogin,
  getAccessToken,
  getSessionUserId,
  loadSession,
  logout,
  onSessionCleared,
  refreshSession,
} from './auth';

export * from './categories';
export * from './houses';
export * from './masters';
export * from './onboarding';
export * from './me';
export * from './notifications';
export * from './rooms';
export * from './routines';
export * from './shop';
export * from './today';
export * from './todos';

export type * from './types';
