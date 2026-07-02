/**
 * API base URL. Defaults to the shared dev server; override per-environment with
 * the `EXPO_PUBLIC_API_URL` env var (inlined at build/export time). Includes the
 * `/api/v1` prefix so callers pass bare paths like `/routines`.
 */
const DEFAULT_API_URL = 'http://43.203.209.107:8080/api/v1';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
