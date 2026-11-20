import { defineConfig } from '@playwright/test';

import { DEVICES } from './e2e/devices';

/**
 * 웹 E2E — 내보낸 웹 앱을 화면 크기별 Chromium 프로젝트로 돌린다.
 * 모든 산출물은 web-build/ 아래(무시됨)에만 쓴다.
 *
 *   npx expo export --platform web --output-dir web-build/app
 *   npx --no-install playwright test -c playwright.e2e.config.ts
 */
export default defineConfig({
  testDir: 'e2e/specs',
  testMatch: '**/*.e2e.ts',
  outputDir: 'web-build/e2e-results',
  reporter: [['list'], ['html', { outputFolder: 'web-build/e2e-report', open: 'never' }]],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:6010',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
  },
  projects: Object.values(DEVICES).map((d) => ({
    name: d.name,
    use: {
      browserName: 'chromium' as const,
      viewport: d.viewport,
      hasTouch: d.touch,
      isMobile: d.touch,
      deviceScaleFactor: 1,
    },
  })),
  webServer: {
    command: 'node e2e/support/static-server.mjs web-build/app 6010',
    url: 'http://127.0.0.1:6010/',
    reuseExistingServer: !process.env.CI,
  },
});
