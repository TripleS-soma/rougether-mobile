/**
 * 펼친 Duo(951×669, 안전 영역 위 82·아래 34)의 배치 — 터치 기기의 넓은 창은 좌우 2단으로 창을
 * 다 쓴다(규칙 4). 방·달력 탭부터. 집·피드·내 정보의 2단은 다음 단계다.
 *
 * 시스템 표시(시계·와이파이)는 오른쪽 위 모서리에만 있는데 인셋은 위쪽 전체 폭으로 온다. 왼쪽 칸은
 * 그 띠를 비우지 않고 쓰고, 오른쪽 칸은 모서리를 피한다(`e2e/devices.ts`의 obstructions).
 */
import { ROOM_RENDER_CONTRACT } from '../../src/components/room/room-render-contract';
import { expect, test } from '../support/app';
import {
  expectAspectRatio,
  expectClearOf,
  expectFillsWidth,
  expectInFirstScreen,
  expectNoHorizontalScroll,
  stableRect,
} from '../support/layout';

type Page = Parameters<typeof expectNoHorizontalScroll>[0];

/** 칸 하나의 최소 폭 — 이보다 좁으면 2단을 켜지 않는다(`TOUCH_SPLIT_MIN_WIDTH`의 절반). */
const MIN_PANE_WIDTH = 320;

// 방·달력 탭은 같은 화면의 두 인스턴스 — 방 그림/달력 격자를 가진 쪽으로 좁힌다.
const SCREENS = {
  myRoom: (page: Page) =>
    page.getByTestId('my-room-screen').filter({ has: page.getByTestId('room-canvas') }),
  calendar: (page: Page) =>
    page
      .getByTestId('my-room-screen')
      .filter({ has: page.getByRole('button', { name: '다음 달' }) }),
} as const;

test.beforeEach(({ app }) => {
  test.skip(app.device.name !== 'duo-open', '펼친 Duo 전용');
});

for (const tab of ['myRoom', 'calendar'] as const) {
  test(`규칙 4: ${tab} 탭의 두 칸이 나란히 배치 폭을 다 쓴다`, async ({ app, page }) => {
    await app.open({ tab });
    await app.dismissModals();
    const screen = SCREENS[tab](page);
    const left = screen.getByTestId('my-room-split-hero');
    const right = screen.getByTestId('my-room-split-list');
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    const { viewport, insets } = app.device;
    await expectFillsWidth(page, [left, right], viewport.width - insets.left - insets.right);
    for (const pane of [left, right]) {
      const { width } = await stableRect(pane);
      expect(
        width,
        `칸 폭 ${width.toFixed(1)}, 기대 ${MIN_PANE_WIDTH} 이상`,
      ).toBeGreaterThanOrEqual(MIN_PANE_WIDTH);
    }
    await expectNoHorizontalScroll(page);
  });
}

test('규칙 3·5: 방 그림은 계약 비율로 왼쪽 칸에 다 보이고, 할 일 첫 항목이 오른쪽 칸 첫 화면에 있다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  const screen = SCREENS.myRoom(page);
  const roomCanvas = screen.getByTestId('room-canvas');
  await expect(roomCanvas).toBeVisible();
  await expectAspectRatio(roomCanvas, ROOM_RENDER_CONTRACT.room.aspectRatio);
  const room = await stableRect(roomCanvas);
  const left = await stableRect(screen.getByTestId('my-room-split-hero'));
  expect(room.x, '방 그림이 왼쪽 칸 안에서 시작').toBeGreaterThanOrEqual(left.x);
  expect(room.x + room.width, '방 그림이 왼쪽 칸 안에서 끝').toBeLessThanOrEqual(
    left.x + left.width + 1,
  );
  const tabBar = await stableRect(page.getByTestId('bottom-nav-pill'));
  await expectInFirstScreen(page, room, app.device.viewport.height - tabBar.y);
  const firstItem = screen.locator('[data-testid^="routine-row-"]').first();
  await expect(firstItem).toBeVisible();
  const item = await stableRect(firstItem);
  const right = await stableRect(screen.getByTestId('my-room-split-list'));
  expect(item.x, '할 일이 오른쪽 칸에 있다').toBeGreaterThanOrEqual(right.x);
  await expectInFirstScreen(page, item, app.device.viewport.height - tabBar.y);
  // 왼쪽 칸은 위 안전 영역 띠를 비워 두지 않는다 — 방이 그 높이 안에서 시작한다.
  expect(room.y, `방 그림 시작 y ${room.y.toFixed(1)}`).toBeLessThan(app.device.insets.top);
  // 방 아래 버튼 줄도 탭 바 위에 다 보인다.
  const actions = await stableRect(screen.getByTestId('room-actions'));
  await expectInFirstScreen(page, actions, app.device.viewport.height - tabBar.y);
  // 오른쪽 칸 머리의 추가 버튼은 모서리의 시스템 표시와 겹치지 않는다.
  const add = right.x; // 오른쪽 칸 안의 조작 요소만 본다
  for (const button of await screen.getByRole('button').all()) {
    const rect = await button.boundingBox();
    if (rect && rect.x >= add && rect.width > 0) await expectClearOf(rect, app.device.obstructions);
  }
});

test('규칙 4: 방 꾸미기의 두 칸(방 | 가구 목록)이 나란히 배치 폭을 다 쓴다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  await page.getByRole('button', { name: '방 꾸미기', exact: true }).click();
  const left = page.getByTestId('decor-split-hero');
  const right = page.getByTestId('decor-split-panel');
  await expect(left).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(page, [left, right], viewport.width - insets.left - insets.right);
  // 가구 목록 첫 줄이 떠 있는 되돌리기·재화 줄에 가리지 않는다.
  const firstTile = await stableRect(page.getByTestId('decor-grid').getByRole('button').first());
  const undo = await stableRect(page.getByRole('button', { name: '실행 취소' }));
  expect(firstTile.y, '가구 목록이 떠 있는 줄 아래에서 시작').toBeGreaterThanOrEqual(
    undo.y + undo.height,
  );
  // 방 그림은 위 안전 영역 띠 안에서 시작해 적용하기 버튼 위에서 끝난다.
  const canvas = await stableRect(page.getByTestId('decor-canvas'));
  const apply = await stableRect(page.getByRole('button', { name: '적용하기', exact: true }));
  expect(canvas.y, `방 그림 시작 y ${canvas.y.toFixed(1)}`).toBeLessThan(app.device.insets.top);
  expect(canvas.y + canvas.height, '방 그림이 적용하기 위에서 끝난다').toBeLessThanOrEqual(apply.y);
  for (const name of ['실행 취소', '다시 실행']) {
    await expectClearOf(page.getByRole('button', { name }), app.device.obstructions);
  }
  await expectNoHorizontalScroll(page);
});
