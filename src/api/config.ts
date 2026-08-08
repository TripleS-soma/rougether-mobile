/**
 * API base URL. Source of truth is the `EXPO_PUBLIC_API_URL` env var (EAS
 * environment for store updates), inlined at bundle time. Until production has
 * dedicated infrastructure, the fallback is the AWS environment shared by
 * dev/preview and production. Includes `/api/v1` so callers pass bare paths
 * such as `/routines`.
 */
const FALLBACK_SHARED_API_URL = 'https://dkfiwkal2ezg9.cloudfront.net/api/v1';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_SHARED_API_URL).replace(
  /\/+$/,
  '',
);

// Store-release tripwire: a production bundle must never regress to plain HTTP.
if (!__DEV__ && API_BASE.startsWith('http://')) {
  console.warn(`[api/config] API_BASE is plain HTTP in a production bundle: ${API_BASE}`);
}
