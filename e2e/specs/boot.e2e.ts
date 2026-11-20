import { expect, test } from '@playwright/test';

test('세션이 없으면 로그인 화면이 뜬다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Kakao로 시작' })).toBeVisible();
});
