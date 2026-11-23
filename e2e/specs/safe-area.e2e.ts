/**
 * 안전 영역 — 조작 요소가 기기의 안전 영역 밖(시스템 표시 영역 띠)에 놓이지 않는다.
 * 모든 화면 크기에서 돈다. 인셋이 없는 기기(기준 폰·데스크톱)에서는 띠가 없어 늘 통과한다.
 * Duo의 값은 실측(`e2e/devices.ts`): 접힘은 오른쪽 84·아래 34, 펼침은 위 82·아래 34.
 */
import { expect, test } from '../support/app';
import { expectClearOf } from '../support/layout';

test('탭 바(아래 알약 또는 왼쪽 세로 줄)의 탭들이 안전 영역 안에 있다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  // 넓은 창(펼친 Duo·데스크톱)은 왼쪽 세로 줄, 그 밖은 아래 알약 — 둘 중 하나만 있다.
  const rail = page.getByTestId('nav-rail');
  const pill = page.getByTestId('bottom-nav-pill');
  const wide = ['open', 'desktop'].includes(app.device.posture);
  await expect(wide ? rail : pill).toBeVisible();
  await expect(wide ? pill : rail).toHaveCount(0);
  if (!wide) return expectClearOf(pill, app.device.obstructions);
  for (const tab of await rail.getByRole('button').all()) {
    await expectClearOf(tab, app.device.obstructions);
  }
});

test('출석 모달 카드가 안전 영역 안에 있다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const dialog = page.getByRole('dialog', { name: '크리스마스' });
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeVisible();
  // 카드가 화면보다 길면 안에서 스크롤된다 — 카드 자체와 닫기 버튼이 안전 영역 안이면 된다.
  await expectClearOf(dialog, app.device.obstructions);
  await expectClearOf(close, app.device.obstructions);
});

test('방의 메뉴 팝오버가 안전 영역 안에 뜬다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  const popover = page.getByTestId('nav-menu-popover');
  await expect(popover).toBeVisible();
  await expectClearOf(popover, app.device.obstructions);
});
