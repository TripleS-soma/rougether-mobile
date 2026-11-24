import { expect, test } from '../support/app';

test('세션이 없으면 로그인 화면이 뜬다', async ({ app, page }) => {
  await app.open({ session: false });
  await expect(page.getByRole('button', { name: 'Kakao로 시작' })).toBeVisible();
});
