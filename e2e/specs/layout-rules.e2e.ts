import roomContract from '../../src/components/room/room-render-contract.v2.json';
import { HOUSE_FIXTURES } from '../fixtures/house';
import { expect, test, type StartTab } from '../support/app';
import {
  expectAspectRatio,
  expectClearOf,
  expectInFirstScreen,
  expectNoHorizontalScroll,
  stableRect,
} from '../support/layout';

/** 방 그림 비율 — 방 렌더 계약(`room.aspectRatio`)이 단일 출처. */
const ROOM_RATIO = roomContract.room.aspectRatio;
/**
 * 2층(4인) CLASSIC 집 그림 비율 — `src/resources/house-frame.ts`의
 * `resolveHouseFrame(…, { maxMembers: 4 }).aspectRatio`(= `stackedGeometry(4)`, 86행):
 * 원본 1024 × (872 + 352), 창문에 맞춰 방 비율만큼 눌러 그린다.
 * 그 모듈은 expo-asset·i18n을 끌어와 Playwright(Node)에서 import할 수 없어 산식을 옮겨 적는다
 * — 그 산식을 바꾸면 여기도 고칠 것.
 */
const HOUSE_RATIO_2F = (1024 / (872 + 352)) * ROOM_RATIO;
/**
 * 기본(DIORAMA) 집 그림 비율 — `src/resources/house-diorama.ts` 13행 `HOUSE_DIORAMA_ASPECT`.
 * 층수와 무관한 한 장 그림이다. 그 모듈은 .webp 에셋을 import해 Node에서 읽을 수 없다.
 */
const HOUSE_RATIO_DIORAMA = 2 / 3;

/** 기본 픽스처의 집은 DIORAMA(층수와 무관한 2:3 한 장 그림)라, 층수별 틀이 그려지는 CLASSIC으로 연다. */
const CLASSIC_HOUSE = {
  'GET /me/houses': {
    items: HOUSE_FIXTURES['GET /me/houses'].items.map((h) => ({ ...h, displayMode: 'CLASSIC' })),
  },
  'GET /houses/:id': { ...HOUSE_FIXTURES['GET /houses/:id'], displayMode: 'CLASSIC' },
};

const TABS: StartTab[] = ['myRoom', 'calendar', 'house', 'feed', 'myPage'];

// 규칙 1의 머리 버튼 — 접근성 이름으로 찾는다. 집의 채팅 버튼은 보이는 글자가 '채팅'이고
// 접근성 이름이 '집 채팅'이다.
const HEADER_BUTTONS: { tab: StartTab; name: string }[] = [
  { tab: 'calendar', name: '다음 달' },
  { tab: 'house', name: '집 채팅' },
  { tab: 'myPage', name: '설정' },
];

/**
 * 나의 방 탭의 화면. 달력 탭도 같은 화면의 두 번째 인스턴스이고(방 그림 없음), 집 탭의
 * 창문마다 방 그림이 있어서 방 그림을 가진 나의 방 화면으로 좁힌다.
 */
const roomScreen = (page: Parameters<typeof expectNoHorizontalScroll>[0]) =>
  page.getByTestId('my-room-screen').filter({ has: page.getByTestId('room-canvas') });

test.beforeEach(({ app }) => {
  test.skip(!['phone', 'desktop'].includes(app.device.name), '기준 폰·데스크톱 전용');
});

for (const tab of TABS) {
  test(`규칙 6: 다섯 탭 어디에도 가로 스크롤이 없다 — ${tab}`, async ({ app, page }) => {
    await app.open({ tab });
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalScroll(page);
  });
}

test('규칙 3: 방 그림이 계약 비율이고 잘리지 않는다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const roomCanvas = roomScreen(page).getByTestId('room-canvas');
  await expect(roomCanvas).toBeVisible();
  await expectAspectRatio(roomCanvas, ROOM_RATIO);
  await expectInFirstScreen(page, roomCanvas);
});

test('규칙 3: 집 그림이 층수별 비율이다', async ({ app, page }) => {
  await app.open({ tab: 'house', overrides: CLASSIC_HOUSE });
  const houseFrame = page.getByTestId('house-frame');
  await expect(houseFrame).toBeVisible();
  await expectAspectRatio(houseFrame, HOUSE_RATIO_2F);
});

test('규칙 3: 기본(디오라마) 집 그림이 2:3 비율이다', async ({ app, page }) => {
  await app.open({ tab: 'house' });
  const houseFrame = page.getByTestId('house-frame');
  await expect(houseFrame).toBeVisible();
  await expectAspectRatio(houseFrame, HOUSE_RATIO_DIORAMA);
});

test('규칙 2: 출석 모달의 닫기 버튼이 화면 안에 있고 누르면 닫힌다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  const modal = page.getByRole('dialog', { name: '크리스마스' });
  const close = modal.getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeVisible();
  await expectInFirstScreen(page, close);
  await close.click();
  await expect(modal).toBeHidden();
});

test('규칙 5: 방 탭에서 할 일 첫 항목이 탭 바 위로 보인다', async ({ app, page }) => {
  test.skip(app.device.name !== 'phone', '기준 폰 전용');
  await app.open({ tab: 'myRoom' });
  await app.dismissModals();
  const firstItem = roomScreen(page).locator('[data-testid^="routine-row-"]').first();
  await expect(firstItem).toBeVisible();
  const tabBar = await stableRect(page.getByTestId('bottom-nav-pill'));
  await expectInFirstScreen(page, firstItem, app.device.viewport.height - tabBar.y);
});

for (const { tab, name } of HEADER_BUTTONS) {
  // 기준 폰·데스크톱은 시스템 영역이 비어 있어 늘 통과한다 — 접힌 화면(Task 4)이 쓸 호출 경로를 잠근다.
  test(`규칙 1: 탭 화면의 머리 버튼이 시스템 영역과 겹치지 않는다 — ${tab} ${name}`, async ({
    app,
    page,
  }) => {
    await app.open({ tab });
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expectClearOf(button, app.device.obstructions);
  });
}
