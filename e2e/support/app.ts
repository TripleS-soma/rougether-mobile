import { expect, test as base } from '@playwright/test';

import { E2E_USER_ID } from '../fixtures/common';
import { DEVICES, type E2eDevice } from '../devices';
import { mockApi, type MockOverrides } from './api-mock';

export type StartTab = 'myRoom' | 'calendar' | 'house' | 'feed' | 'myPage';

type App = {
  device: E2eDevice;
  /** 세션을 심고 앱을 연다. 열린 뒤 자동으로 뜨는 모달은 그대로 둔다. */
  open(opts?: { tab?: StartTab; overrides?: MockOverrides }): Promise<void>;
  /** 화면에 떠 있는 모달을 닫기 버튼으로 전부 닫는다. */
  dismissModals(): Promise<void>;
};

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

export const test = base.extend<{ app: App }>({
  // 서비스워커가 요청을 가로채면 page.route가 못 본다 — 테스트에서는 등록하지 않는다.
  serviceWorkers: 'block',
  app: async ({ page }, use, testInfo) => {
    const device = DEVICES[testInfo.project.name as E2eDevice['name']];
    if (!device) throw new Error(`DEVICES에 없는 프로젝트: ${testInfo.project.name}`);
    let unmocked: string[] = [];

    const app: App = {
      device,
      async open({ tab, overrides } = {}) {
        const storage: Record<string, string> = { ...SESSION };
        if (tab) storage[START_TAB_KEY] = tab;
        await page.context().addInitScript((entries) => {
          for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
        }, storage);
        unmocked = await mockApi(page, overrides);
        await page.clock.install({ time: TEST_CLOCK });
        await page.goto('/');
        // 셸이 그려졌다 = 세션 복원·온보딩 관문을 지났다(하단 탭은 모든 탭 화면에 있다).
        await expect(page.getByRole('button', { name: '나의 방', exact: true })).toBeVisible();
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
    };

    await use(app);

    // 고정 응답이 없는 요청은 실패다 — 앱이 새 API를 부르기 시작하면 여기서 드러난다.
    expect(unmocked, '고정 응답이 없는 api/v1 요청').toEqual([]);
  },
});

export { expect } from '@playwright/test';
