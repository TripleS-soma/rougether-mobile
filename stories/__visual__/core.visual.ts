import { expect, test } from '@playwright/test';

/**
 * 핵심 스토리 × 라이트/다크 스크린샷 비교. 기준 이미지는 linux(CI) 전용이라 다른 OS에서는
 * 건너뛴다 — 로컬 macOS 폰트 렌더와 섞이면 CI가 항상 빨개진다.
 */
test.skip(
  process.platform !== 'linux' && !process.env.VISUAL_FORCE,
  '시각 회귀 기준 이미지는 CI(linux)에서만 비교한다',
);

const STORIES = [
  'components-button--primary',
  'components-button--danger',
  'components-card--content',
  'components-bottom-sheet--open',
  'components-bottom-nav--with-badge',
  'foundations-colors--active-theme',
] as const;

for (const id of STORIES) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${id} · ${mode}`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=mode:${mode}`);
      await page.waitForSelector('#storybook-root > *');
      // 웹 폰트와 스프링 등장(바텀시트) 안정화.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(`${id}-${mode}.png`, { fullPage: true });
    });
  }
}
