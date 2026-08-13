import sharedEndpoints from '@/config/shared-endpoints.json';

/**
 * API base URL. Source of truth is the `EXPO_PUBLIC_API_URL` env var (.env for
 * dev/preview, EAS environment for store builds), inlined at bundle time. 전용
 * production 인프라가 생기기 전까지는 dev/preview/production이 같은 AWS 공용
 * 환경을 쓴다 — 폴백은 그 공용 주소의 단일 출처(shared-endpoints.json, #738).
 * Includes the `/api/v1` prefix so callers pass bare paths like `/routines`.
 */
const FALLBACK_SHARED_API_URL = sharedEndpoints.apiBase;

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_SHARED_API_URL).replace(
  /\/+$/,
  '',
);

// Store-release tripwire: production bundles must never ship plain HTTP (the
// ATS/cleartext exceptions in app.json go away once the HTTPS domain lands).
if (!__DEV__ && API_BASE.startsWith('http://')) {
  console.warn(`[api/config] API_BASE is plain HTTP in a production bundle: ${API_BASE}`);
}
