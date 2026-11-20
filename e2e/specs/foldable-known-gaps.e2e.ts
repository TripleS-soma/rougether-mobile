/**
 * 접힌 Duo(466×678)의 알려진 배치 결함 — 고칠 목록을 "실패 예상"으로 잠근다.
 * 다음 계획이 결함을 하나 고칠 때마다 해당 테스트의 `test.fail()`을 지운다.
 *
 * 테스트마다 순서가 중요하다: 준비(화면 열기, 대상 요소가 보이는지 단언)를 먼저 하고,
 * **그 뒤에** `test.fail()`을 부른 다음 규칙을 단언한다. `test.fail()`을 먼저 부르면
 * 요소를 못 찾아 깨진 테스트도 "예상대로 실패"로 집계돼 결함이 고쳐졌는지 영영 모른다.
 * 준비 단계의 실패는 실패 예상 표시 전이라 그대로 빨간 실패로 드러난다.
 * 같은 이유로 네트워크 검사(고정 응답 없는 api/v1 요청·밖으로 나가려던 요청)도
 * `test.fail()` 직전에 `app.expectNoUnmockedRequests()`로 한다 — 테스트 끝 검사의 실패는
 * 실패 예상 아래에서 삼켜진다.
 *
 * 웹에는 시스템 영역이 없으므로 규칙 1은 "앱이 그 자리를 피하는가"를 좌표로만 본다.
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
  await app.expectNoUnmockedRequests();
  test.fail();
  await expectClearOf(close, app.device.obstructions);
});

// 머리 버튼 — 접근성 이름으로 찾는다. 집의 채팅 버튼은 보이는 글자가 '채팅', 이름이 '집 채팅'.
// 고친 버튼은 그 줄의 knownGap을 false로 바꾼다.
const HEADER_BUTTONS = [
  { title: '달력의 다음 달 버튼', tab: 'calendar', name: '다음 달', knownGap: true },
  { title: '집의 채팅 버튼', tab: 'house', name: '집 채팅', knownGap: true },
  { title: '내 정보의 설정 버튼', tab: 'myPage', name: '설정', knownGap: true },
] as const;

for (const { title, tab, name, knownGap } of HEADER_BUTTONS) {
  test(`${title}이 시스템 영역과 겹치지 않는다`, async ({ app, page }) => {
    await app.open({ tab });
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await app.expectNoUnmockedRequests();
    test.fail(knownGap);
    await expectClearOf(button, app.device.obstructions);
  });
}

test('방 그림 높이가 화면 높이의 절반 이하다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const roomCanvas = roomScreen(page).getByTestId('room-canvas');
  await expect(roomCanvas).toBeVisible();
  const limit = app.device.viewport.height / 2;
  const { height } = await stableRect(roomCanvas);
  await app.expectNoUnmockedRequests();
  test.fail();
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
  const inset = await tabBarInset(page, app.device.viewport.height);
  await app.expectNoUnmockedRequests();
  test.fail();
  await expectInFirstScreen(page, firstItem, inset);
});

test('집 그림 전체가 첫 화면에 보인다', async ({ app, page }) => {
  await app.open({ tab: 'house' });
  const houseFrame = page.getByTestId('house-frame');
  await expect(houseFrame).toBeVisible();
  const inset = await tabBarInset(page, app.device.viewport.height);
  await app.expectNoUnmockedRequests();
  test.fail();
  await expectInFirstScreen(page, houseFrame, inset);
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
  const applyTop = (await stableRect(apply)).y;
  await app.expectNoUnmockedRequests();
  test.fail();
  await expectInFirstScreen(page, firstTile, app.device.viewport.height - applyTop);
});
