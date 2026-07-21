/**
 * API base URL. Source of truth is the `EXPO_PUBLIC_API_URL` env var (.env for
 * dev/preview, EAS environment for store builds), inlined at bundle time. The
 * fallback keeps env-less runs (Jest) on the shared dev server. Includes the
 * `/api/v1` prefix so callers pass bare paths like `/routines`.
 */
const FALLBACK_DEV_API_URL = 'http://3.35.167.122:8080/api/v1';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_DEV_API_URL).replace(
  /\/+$/,
  '',
);

// Store-release tripwire: production bundles must never ship plain HTTP (the
// ATS/cleartext exceptions in app.json go away once the HTTPS domain lands).
if (!__DEV__ && API_BASE.startsWith('http://')) {
  console.warn(`[api/config] API_BASE is plain HTTP in a production bundle: ${API_BASE}`);
}
