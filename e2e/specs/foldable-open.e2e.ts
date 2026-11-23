/**
 * 펼친 Duo(951×669, 안전 영역 위 82·아래 34)의 배치 — 터치 기기의 넓은 창은 좌우 2단으로 창을
 * 다 쓴다(규칙 4). 다섯 탭 모두(방·달력·집·피드·내 정보). 탭 바는 왼쪽 세로 줄이라
 * 창 폭은 [세로 줄 | 왼쪽 칸 | 오른쪽 칸]이 나눠 쓰고, 아래에는 홈 인디케이터 자리만 비운다.
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
    await expectFillsWidth(
      page,
      [page.getByTestId('nav-rail'), left, right],
      viewport.width - insets.left - insets.right,
    );
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
  // 세로 탭 줄이라 아래에 떠 있는 탭 바가 없다 — 홈 인디케이터 자리만 뺀다.
  const bottomInset = app.device.insets.bottom;
  await expectInFirstScreen(page, room, bottomInset);
  const firstItem = screen.locator('[data-testid^="routine-row-"]').first();
  await expect(firstItem).toBeVisible();
  const item = await stableRect(firstItem);
  const right = await stableRect(screen.getByTestId('my-room-split-list'));
  expect(item.x, '할 일이 오른쪽 칸에 있다').toBeGreaterThanOrEqual(right.x);
  await expectInFirstScreen(page, item, bottomInset);
  // 왼쪽 칸은 위 안전 영역 띠를 비워 두지 않는다 — 방이 그 높이 안에서 시작한다.
  expect(room.y, `방 그림 시작 y ${room.y.toFixed(1)}`).toBeLessThan(app.device.insets.top);
  // 방 아래 버튼 줄도 탭 바 위에 다 보인다.
  const actions = await stableRect(screen.getByTestId('room-actions'));
  await expectInFirstScreen(page, actions, bottomInset);
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
  await expectFillsWidth(
    page,
    // 방 꾸미기는 탭 화면이 아니라 세로 탭 줄 없이 창 전체를 쓴다.
    [left, right],
    viewport.width - insets.left - insets.right,
  );
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

test('규칙 3·4: 집 탭은 [집 그림 | 집 정보] 두 칸이 창을 다 쓰고, 집 그림 전체가 한 화면에 보인다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'house' });
  await app.dismissModals();
  const left = page.getByTestId('house-screen');
  const right = page.getByTestId('house-side-panel');
  await expect(right).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), left, right],
    viewport.width - insets.left - insets.right,
  );
  // 집 그림(2:3)은 왼쪽 칸 안에서 탭 바 위까지 전체가 보인다.
  const houseFrame = page.getByTestId('house-frame');
  await expect
    .poll(() =>
      page.getByTestId('house-frame-viewport').evaluate((el) => getComputedStyle(el).maxWidth),
    )
    .not.toBe('none');
  await expectAspectRatio(houseFrame, 2 / 3);
  const frame = await stableRect(houseFrame);
  const pane = await stableRect(left);
  expect(frame.x + frame.width, '집 그림이 왼쪽 칸 안에서 끝난다').toBeLessThanOrEqual(
    pane.x + pane.width + 1,
  );
  // 세로 탭 줄이라 아래에 떠 있는 탭 바가 없다 — 홈 인디케이터 자리만 뺀다.
  const bottomInset = app.device.insets.bottom;
  await expectInFirstScreen(page, frame, bottomInset);
  // 그림 위에 떠 있던 알약·레일은 없고, 같은 진입점이 오른쪽 칸에 하나씩 있다 — 모서리의 시스템 표시와 안 겹친다.
  await expect(page.getByTestId('house-level-pill')).toHaveCount(0);
  for (const name of ['집 채팅', '집 피드', '집 추가', '우리 집의 목표 전체 보기', '구성원 관리']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toHaveCount(1);
    await expectClearOf(button, app.device.obstructions);
  }
  await expectNoHorizontalScroll(page);
});

test('규칙 4: 피드 탭은 [글 목록 | 고른 글] 두 칸 — 첫 글이 오른쪽 칸에 열려 있다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'feed' });
  await app.dismissModals();
  const left = page.getByTestId('feed-split-list');
  const right = page.getByTestId('feed-split-detail');
  await expect(right).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), left, right],
    viewport.width - insets.left - insets.right,
  );
  // 목록의 첫 글이 고른 상태이고, 그 글의 본문이 오른쪽 칸에 보인다.
  const bg = (id: number) =>
    left.getByTestId(`feed-post-${id}`).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(right.getByText('오늘도 스트레칭 완료')).toBeVisible();
  await expect.poll(async () => (await bg(904)) !== (await bg(903))).toBe(true);
  const selectedColor = await bg(904);
  // 다른 글을 눌러도 화면이 넘어가지 않고 두 칸이 그대로다 — 고른 표시만 옮겨 간다.
  await left.getByTestId('feed-post-903').click();
  await expect.poll(() => bg(903)).toBe(selectedColor);
  expect(await bg(904)).not.toBe(selectedColor);
  await expect(left).toBeVisible();
  // 오른쪽 칸의 조작 요소는 모서리의 시스템 표시와 겹치지 않는다.
  for (const button of await right.getByRole('button').all()) {
    const rect = await button.boundingBox();
    if (rect && rect.width > 0) await expectClearOf(rect, app.device.obstructions);
  }
  await expectNoHorizontalScroll(page);
});

test('규칙 4: 내 정보 탭은 [프로필·지표·바로가기 | 메뉴·설정] 두 칸이 창을 다 쓴다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'myPage' });
  await app.dismissModals();
  const left = page.getByTestId('my-page-main-pane');
  const right = page.getByTestId('my-page-menu-pane');
  await expect(right).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), left, right],
    viewport.width - insets.left - insets.right,
  );
  await expect(left.getByTestId('my-page-profile-card')).toBeVisible();
  await expect(right.getByText('도움말')).toBeVisible();
  // 설정은 머리의 톱니가 아니라 오른쪽 칸의 행이다 — 톱니 자리는 모서리의 시스템 표시와 겹쳤다.
  await expect(page.getByTestId('my-page-settings')).toHaveCount(0);
  const settings = right.getByRole('button', { name: '설정' });
  await expect(settings).toBeVisible();
  for (const button of await right.getByRole('button').all()) {
    const rect = await button.boundingBox();
    if (rect && rect.width > 0) await expectClearOf(rect, app.device.obstructions);
  }
  // 왼쪽 칸은 위 안전 영역 띠를 통째로 비우지 않는다 — 제목이 그 띠 안에서 시작한다.
  const header = await stableRect(left.getByTestId('screen-header'));
  expect(header.y, `제목 시작 y ${header.y.toFixed(1)}`).toBeLessThan(insets.top / 2);
  await expectNoHorizontalScroll(page);
});

test('내 정보의 설정은 화면을 넘기지 않고 오른쪽 칸에 열린다 — 뒤로 가면 메뉴로 돌아온다', async ({
  app,
  page,
}) => {
  await app.open({ tab: 'myPage' });
  await app.dismissModals();
  const left = page.getByTestId('my-page-main-pane');
  const pane = page.getByTestId('split-detail-pane');
  await page.getByTestId('my-page-menu-pane').getByRole('button', { name: '설정' }).click();
  // 왼쪽 칸(프로필)과 세로 탭 줄은 그대로, 오른쪽 칸에 설정 화면.
  await expect(pane.getByText('다크 모드')).toBeVisible();
  await expect(left.getByTestId('my-page-profile-card')).toBeVisible();
  await expect(page.getByTestId('nav-rail')).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), left, pane],
    viewport.width - insets.left - insets.right,
  );
  // 칸 안의 조작 요소(뒤로 버튼 포함)는 모서리의 시스템 표시와 겹치지 않는다.
  const back = pane.getByRole('button', { name: '뒤로 가기', exact: true });
  await expectClearOf(back, app.device.obstructions);
  // 설정 안의 하위 화면도 같은 칸에서 열리고, 뒤로 가면 한 단계씩 돌아온다.
  await pane.getByText('테마 색상').click();
  await expect(pane.getByText('테마 색상').first()).toBeVisible();
  await expect(left.getByTestId('my-page-profile-card')).toBeVisible();
  await pane.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await expect(pane.getByText('다크 모드')).toBeVisible();
  await pane.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.getByTestId('my-page-menu-pane').getByText('도움말')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const { name, title } of [
  { name: '구성원 관리', title: '구성원 관리' },
  { name: '우리 집의 목표 전체 보기', title: '우리 집의 목표' },
]) {
  test(`집의 '${name}'는 집 그림을 그대로 두고 오른쪽 칸에 열린다`, async ({ app, page }) => {
    await app.open({ tab: 'house' });
    await app.dismissModals();
    const left = page.getByTestId('house-screen');
    await page.getByTestId('house-side-panel').getByRole('button', { name, exact: true }).click();
    const pane = page.getByTestId('split-detail-pane');
    await expect(pane.getByText(title).first()).toBeVisible();
    // 집 그림과 세로 탭 줄은 그대로다.
    await expect(left.getByTestId('house-frame')).toBeVisible();
    await expect(page.getByTestId('nav-rail')).toBeVisible();
    const { viewport, insets } = app.device;
    await expectFillsWidth(
      page,
      [page.getByTestId('nav-rail'), left, pane],
      viewport.width - insets.left - insets.right,
    );
    const back = pane.getByRole('button', { name: '뒤로 가기', exact: true });
    await expectClearOf(back, app.device.obstructions);
    // 뒤로 가면 칸이 걷히고 집 정보가 다시 보인다.
    await back.click();
    await expect(pane).toHaveCount(0);
    await expect(page.getByTestId('house-side-panel')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}

// 방·피드의 하위 화면도 탭 화면의 오른쪽 칸에 열린다 — 왼쪽 칸(방 그림·글 목록)은 그대로다.
test('방의 알림함은 방 그림을 그대로 두고 오른쪽 칸에 열린다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  const screen = SCREENS.myRoom(page);
  await screen.getByRole('button', { name: '알림', exact: true }).click();
  const pane = page.getByTestId('split-detail-pane');
  await expect(pane).toBeVisible();
  await expect(screen.getByTestId('room-canvas')).toBeVisible();
  await expect(page.getByTestId('nav-rail')).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), screen.getByTestId('my-room-split-hero'), pane],
    viewport.width - insets.left - insets.right,
  );
  await pane.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await expect(pane).toHaveCount(0);
  await expect(screen.locator('[data-testid^="routine-row-"]').first()).toBeVisible();
});

test('피드의 글쓰기는 글 목록을 그대로 두고 오른쪽 칸에 열린다', async ({ app, page }) => {
  await app.open({ tab: 'feed' });
  await app.dismissModals();
  const list = page.getByTestId('feed-split-list');
  await list.getByRole('button', { name: '게시물 쓰기', exact: true }).click();
  const pane = page.getByTestId('split-detail-pane');
  await expect(pane).toBeVisible();
  await expect(list.getByTestId('feed-post-904')).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), list, pane],
    viewport.width - insets.left - insets.right,
  );
  await expectNoHorizontalScroll(page);
});

test("집의 '집 추가'(집 탐색)는 내 집 그림을 그대로 두고 오른쪽 칸에 열린다", async ({
  app,
  page,
}) => {
  await app.open({ tab: 'house' });
  await app.dismissModals();
  const left = page.getByTestId('house-screen');
  await page
    .getByTestId('house-side-panel')
    .getByRole('button', { name: '집 추가', exact: true })
    .click();
  const pane = page.getByTestId('split-detail-pane');
  await expect(pane).toBeVisible();
  await expect(left.getByTestId('house-frame')).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(
    page,
    [page.getByTestId('nav-rail'), left, pane],
    viewport.width - insets.left - insets.right,
  );
  await pane.getByRole('button', { name: '뒤로 가기', exact: true }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.getByTestId('house-side-panel')).toBeVisible();
});

// 로그인은 앱 셸 밖이라 탭 화면의 칸에 열 수 없다 — 왼쪽 칸에 앱 소개를 채우고 오른쪽 칸에 화면을 둔다.
test('로그인은 [앱 소개 | 로그인] 두 칸이 창을 다 쓴다', async ({ app, page }) => {
  await app.open({ session: false });
  const left = page.getByTestId('brand-split-brand');
  const right = page.getByTestId('brand-split-content');
  await expect(left).toBeVisible();
  await expect(left.getByText('루게더')).toBeVisible();
  const { viewport, insets } = app.device;
  await expectFillsWidth(page, [left, right], viewport.width - insets.left - insets.right);
  // 두 칸은 1:1이다.
  const [l, r] = [await stableRect(left), await stableRect(right)];
  expect(Math.abs(l.width - r.width), `칸 폭 ${l.width} / ${r.width}`).toBeLessThanOrEqual(1);
  // 앱 이름은 왼쪽 칸에 한 번만 — 오른쪽 칸의 로그인 화면은 로고를 다시 그리지 않는다.
  await expect(page.getByText('루게더', { exact: true })).toHaveCount(1);
  const kakao = right.getByRole('button', { name: /Kakao/ });
  await expect(kakao).toBeVisible();
  await expectClearOf(kakao, app.device.obstructions);
  await expectNoHorizontalScroll(page);
});
