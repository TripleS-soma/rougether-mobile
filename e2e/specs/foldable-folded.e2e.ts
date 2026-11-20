/**
 * 접힌 Duo(466×678, 안전 영역 오른쪽 84·아래 34)의 배치 — 1단계에서 "실패 예상"으로 잠갔던
 * 결함 8건이 모두 고쳐져(#1792 안전 영역, 짧은 화면 그림 높이) 일반 테스트가 됐다.
 *
 * 준비(화면 열기, 대상이 보이는지)와 측정(`stableRect`)을 먼저 하고 잰 값으로 규칙을 단언한다.
 * 시스템 영역은 기기의 안전 영역 인셋으로 주입한다(`e2e/devices.ts`의 `insets`) — 규칙 1은
 * 조작 요소가 안전 영역 밖의 띠와 겹치지 않는지를 좌표로 본다.
 */
import { expect, test } from '../support/app';
import { expectClearOf, expectInFirstScreen, stableRect } from '../support/layout';

/** 나의 방 탭의 화면 — 달력 탭의 인스턴스·집 창문의 방 그림과 구분한다(layout-rules 참고). */
const roomScreen = (page: Parameters<typeof expectInFirstScreen>[0]) =>
  page.getByTestId('my-room-screen').filter({ has: page.getByTestId('room-canvas') });

/** 하단 탭 바가 덮는 화면 아래쪽 높이 — 규칙 5의 bottomInset. */
async function tabBarInset(page: Parameters<typeof expectInFirstScreen>[0], height: number) {
  const tabBar = await stableRect(page.getByTestId('bottom-nav-pill'));
  return height - tabBar.y;
}

test.beforeEach(({ app }) => {
  test.skip(app.device.name !== 'duo-folded', '접힌 Duo 전용');
});

test('출석 모달 닫기 버튼이 시스템 영역과 겹치지 않는다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const close = page
    .getByRole('dialog', { name: '크리스마스' })
    .getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeVisible();
  const rect = await stableRect(close);
  await expectClearOf(rect, app.device.obstructions);
});

// 머리 버튼 — 접근성 이름으로 찾는다. 집의 채팅 버튼은 보이는 글자가 '채팅', 이름이 '집 채팅'.
const HEADER_BUTTONS = [
  { title: '달력의 다음 달 버튼', tab: 'calendar', name: '다음 달' },
  { title: '집의 채팅 버튼', tab: 'house', name: '집 채팅' },
  { title: '내 정보의 설정 버튼', tab: 'myPage', name: '설정' },
] as const;

for (const { title, tab, name } of HEADER_BUTTONS) {
  test(`${title}이 시스템 영역과 겹치지 않는다`, async ({ app, page }) => {
    await app.open({ tab });
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const rect = await stableRect(button);
    await expectClearOf(rect, app.device.obstructions);
  });
}

test('방 그림 높이가 화면 높이의 절반 이하다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const roomCanvas = roomScreen(page).getByTestId('room-canvas');
  await expect(roomCanvas).toBeVisible();
  const limit = app.device.viewport.height / 2;
  const { height } = await stableRect(roomCanvas);
  expect(
    height,
    `방 그림 높이 ${height.toFixed(1)}, 기대 ${limit} 이하 (뷰포트 높이 ${app.device.viewport.height}의 절반)`,
  ).toBeLessThanOrEqual(limit);
});

test('방 탭에서 할 일 첫 항목이 탭 바 위로 보인다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  const firstItem = roomScreen(page).locator('[data-testid^="routine-row-"]').first();
  await expect(firstItem).toBeVisible();
  const rect = await stableRect(firstItem);
  const inset = await tabBarInset(page, app.device.viewport.height);
  await expectInFirstScreen(page, rect, inset);
});

test('집 그림 전체가 첫 화면에 보인다', async ({ app, page }) => {
  await app.open({ tab: 'house' });
  // 집은 화면·머리·알약 줄을 잰 뒤 한 번 더 그려 크기를 맞춘다 — 맞춘 폭(max-width)이 실린 뒤에 잰다.
  await app.dismissModals();
  const houseFrame = page.getByTestId('house-frame');
  await expect(houseFrame).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId('house-frame-viewport').evaluate((el) => getComputedStyle(el).maxWidth),
    )
    .not.toBe('none');
  const rect = await stableRect(houseFrame);
  const inset = await tabBarInset(page, app.device.viewport.height);
  await expectInFirstScreen(page, rect, inset);
});

test('방 꾸미기에서 가구 목록 첫 줄이 적용하기 버튼 위로 보인다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  await page.getByRole('button', { name: '방 꾸미기', exact: true }).click();
  // 적용하기는 누르지 않는다 — 위치만 잰다.
  const apply = page.getByRole('button', { name: '적용하기', exact: true });
  await expect(apply).toBeVisible();
  // 가구 목록 첫 줄 = 격자의 첫 타일.
  const firstTile = page.getByTestId('decor-grid').getByRole('button').first();
  await expect(firstTile).toBeVisible();
  const rect = await stableRect(firstTile);
  const applyTop = (await stableRect(apply)).y;
  await expectInFirstScreen(page, rect, app.device.viewport.height - applyTop);
});
