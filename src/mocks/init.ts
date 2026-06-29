/**
 * Start MSW in development so screens fetch from the mock business API. No-op in
 * production. `msw/native` is imported dynamically so it never ships in release
 * bundles.
 */
export async function startMockServer() {
  if (!__DEV__) return;
  const { setupServer } = await import('msw/native');
  const { handlers } = await import('./handlers');
  setupServer(...handlers).listen({ onUnhandledRequest: 'bypass' });
}
