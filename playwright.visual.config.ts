import { defineConfig, devices } from '@playwright/test';

/**
 * 스토리북 시각 회귀 (addon 없이 Playwright 스크린샷 비교).
 *
 * 폰트 래스터라이즈가 OS마다 달라 기준 이미지는 **CI(linux)에서만 만들고 비교**한다.
 * macOS 로컬 실행은 테스트 파일이 건너뛴다. 기준 갱신 절차는 docs/storybook.md.
 *
 *   npx --no-install storybook build --output-dir web-build/storybook
 *   npx --no-install playwright test -c playwright.visual.config.ts
 */
export default defineConfig({
  testDir: 'stories/__visual__',
  testMatch: '**/*.visual.ts',
  snapshotPathTemplate: 'stories/__visual__/__screenshots__/{arg}-{platform}{ext}',
  outputDir: 'web-build/visual-results',
  reporter: [['list'], ['html', { outputFolder: 'web-build/visual-report', open: 'never' }]],
  fullyParallel: true,
  retries: 0,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: 'http://127.0.0.1:6008',
    ...devices['Desktop Chrome'],
    viewport: { width: 480, height: 900 },
  },
  webServer: {
    command: 'python3 -m http.server 6008 --bind 127.0.0.1 --directory web-build/storybook',
    url: 'http://127.0.0.1:6008/iframe.html',
    reuseExistingServer: !process.env.CI,
  },
});
