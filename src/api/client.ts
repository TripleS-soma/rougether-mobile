/**
 * Minimal API client for the Rougether business API. Data is fetched from the
 * (future) business server; in dev/test the requests are intercepted by MSW
 * (see src/mocks). Conventions follow the spec api.md: `/api/v1` prefix, list
 * responses wrapped in `items`.
 */
export const API_BASE = 'https://api.rougether.dev/api/v1';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: GET ${path}`);
  return (await res.json()) as T;
}

/** GET a list endpoint and unwrap the spec's `{ items: [...] }` envelope. */
export async function apiGetList<T>(path: string): Promise<T[]> {
  const data = await apiGet<{ items: T[] }>(path);
  return data.items;
}
