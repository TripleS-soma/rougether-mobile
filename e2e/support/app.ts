import { expect, test as base } from '@playwright/test';

import { E2E_USER_ID } from '../fixtures/common';
import { DEVICES, type E2eDevice } from '../devices';
import { isOutbound, mockApi, type MockOverrides } from './api-mock';

export type StartTab = 'myRoom' | 'calendar' | 'house' | 'feed' | 'myPage';

type App = {
  device: E2eDevice;
  /**
   * 세션을 심고 앱을 연다. 열린 뒤 자동으로 뜨는 모달은 그대로 둔다. 테스트당 한 번만.
   * `session: false`면 세션 없이(로그아웃 상태로) 연다 — 셸을 기다리지 않는다.
   */
  open(opts?: { tab?: StartTab; overrides?: MockOverrides; session?: boolean }): Promise<void>;
  /** 화면에 떠 있는 모달을 닫기 버튼으로 전부 닫는다. */
  dismissModals(): Promise<void>;
  /**
   * 요청이 잦아든 뒤, 지금까지 고정 응답 없는 api/v1 요청도, 밖으로 나가려던 요청도 없음을
   * 단언한다 — 테스트 끝 검사와 같은 조건. `test.fail()` 아래에서는 끝 검사의 실패까지
   * "예상대로 실패"로 삼켜지므로, 실패 예상 테스트는 `test.fail()` 직전에 이걸 부른다.
   */
  expectNoUnmockedRequests(): Promise<void>;
};

const UNMOCKED_MESSAGE = '고정 응답이 없는 api/v1 요청';
const ESCAPED_MESSAGE = 'mockApi 없이 밖으로 나가려던 요청 — app.open() 또는 mockApi()를 거칠 것';

/** 테스트 시계 — 2026-11-19 KST 정오. 달력·출석이 날짜에 따라 달라지지 않게 고정한다. */
const TEST_CLOCK = new Date('2026-11-19T03:00:00Z');
/** `src/lib/start-tab.ts`의 START_TAB_KEY. */
const START_TAB_KEY = 'rougether.start-tab';
/** 가짜 세션 — 앱은 토큰을 해석하지 않고 Authorization 헤더로만 보낸다. */
const SESSION = {
  'rougether.auth.accessToken': 'e2e-access',
  'rougether.auth.refreshToken': 'e2e-refresh',
  'rougether.auth.userId': String(E2E_USER_ID),
};
/** 앱 공용 닫기 버튼의 접근성 이름(`common.close`). */
const CLOSE_LABEL = '닫기';

export const test = base.extend<{ app: App; networkGuard: string[] }>({
  // 서비스워커가 요청을 가로채면 page.route가 못 본다 — 테스트에서는 등록하지 않는다.
  serviceWorkers: 'block',
  /**
   * 모든 테스트에 자동으로 걸리는 그물 — `mockApi`를 깜빡한 테스트도 로컬 정적 서버 밖으로는
   * 한 건도 못 나간다. 컨텍스트에 걸어 `window.open`으로 뜬 팝업도 덮는다. 페이지의 route가
   * 컨텍스트의 route보다 먼저 받으므로 `mockApi`(페이지)가 답하는 요청은 여기 오지 않는다.
   * 웹소켓은 route가 못 보므로 따로 건다 — 서버에 잇지 않고(connectToServer 없음) 바로 닫는다.
   * 여기 걸린 요청은 끊고(abort) 테스트를 실패시킨다. 걸린 요청 목록을 `app`에 넘긴다.
   */
  networkGuard: [
    async ({ context }, use) => {
      const escaped: string[] = [];
      await context.route(isOutbound, (route) => {
        escaped.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket(isOutbound, (ws) => {
        escaped.push(`WS ${ws.url()}`);
        return ws.close();
      });
      await use(escaped);
      expect(escaped, ESCAPED_MESSAGE).toEqual([]);
    },
    { auto: true },
  ],
  app: async ({ page, networkGuard: escaped }, use, testInfo) => {
    const device = DEVICES[testInfo.project.name as E2eDevice['name']];
    if (!device) throw new Error(`DEVICES에 없는 프로젝트: ${testInfo.project.name}`);
    let unmocked: string[] = [];
    let opened = false;

    const app: App = {
      device,
      async open({ tab, overrides, session = true } = {}) {
        // 두 번째 호출은 init script·route·시계가 겹쳐 쌓인다 — 조용히 섞이지 않게 막는다.
        if (opened) throw new Error('app.open()은 테스트당 한 번만 부를 수 있다.');
        opened = true;
        const storage: Record<string, string> = session ? { ...SESSION } : {};
        if (tab) storage[START_TAB_KEY] = tab;
        if (Object.keys(storage).length > 0) {
          await page.context().addInitScript((entries) => {
            for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
          }, storage);
        }
        unmocked = await mockApi(page, overrides);
        // 안전 영역 인셋 주입 — 웹에는 시스템 영역이 없으니 기기 값을 env(safe-area-inset-*)로 넣는다.
        if (Object.values(device.insets).some((v) => v > 0)) {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: device.insets });
        }
        await page.clock.install({ time: TEST_CLOCK });
        await page.goto('/');
        // 셸이 그려졌다 = 세션 복원·온보딩 관문을 지났다(하단 탭은 모든 탭 화면에 있다).
        if (session) {
          await expect(page.getByRole('button', { name: '나의 방', exact: true })).toBeVisible();
        }
      },
      async dismissModals() {
        // 자동 모달은 데이터가 도착한 뒤 열린다 — 요청이 잦아든 뒤에 본다.
        await page.waitForLoadState('networkidle');
        const close = page
          .getByRole('dialog')
          .getByRole('button', { name: CLOSE_LABEL, exact: true });
        // 하나를 닫으면 다음 모달이 이어서 뜰 수 있다(출석 → 안내 팝업). 무한 반복은 막는다.
        for (let i = 0; i < 5; i++) {
          const visible = await close
            .first()
            .waitFor({ state: 'visible', timeout: 1_000 })
            .then(() => true)
            .catch(() => false);
          if (!visible) return;
          const before = await close.count();
          await close.last().click();
          await expect(close).toHaveCount(before - 1);
        }
        throw new Error('모달이 닫히지 않는다 — 닫기 버튼이 계속 남아 있다.');
      },
      async expectNoUnmockedRequests() {
        await page.waitForLoadState('networkidle');
        expect(unmocked, UNMOCKED_MESSAGE).toEqual([]);
        expect(escaped, ESCAPED_MESSAGE).toEqual([]);
      },
    };

    await use(app);

    // 고정 응답이 없는 요청은 실패다 — 앱이 새 API를 부르기 시작하면 여기서 드러난다.
    expect(unmocked, UNMOCKED_MESSAGE).toEqual([]);
  },
});

export { expect } from '@playwright/test';
