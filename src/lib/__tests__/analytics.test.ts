import * as gaMock from '@react-native-firebase/analytics';
import * as crashMock from '@react-native-firebase/crashlytics';

import {
  identifyUser,
  initAnalytics,
  resetAnalyticsUser,
  screenView,
  track,
} from '@/lib/analytics';

describe('analytics', () => {
  it('초기화가 불가능한 환경에서도 전 함수가 조용히 무동작한다 (#437)', () => {
    // 분석은 어떤 경우에도 앱을 죽이면 안 된다 — 스토리지 없는 환경(jest)에서
    // 초기화가 실패해도 이후 호출은 전부 no-op이어야 한다.
    expect(() => {
      initAnalytics();
      identifyUser(4);
      track('routine_complete', { kind: 'routine' });
      track('gacha_draw', { gachaId: 1, count: 10 });
      screenView('myRoom');
      resetAnalyticsUser();
    }).not.toThrow();
  });

  it('track/screenView/identify가 GA4로도 포워딩된다 (#438)', () => {
    initAnalytics();
    track('routine_complete', { kind: 'routine' });
    expect(gaMock.logEvent).toHaveBeenCalledWith(expect.anything(), 'routine_complete', {
      kind: 'routine',
    });

    screenView('myRoom');
    expect(gaMock.logScreenView).toHaveBeenCalledWith(expect.anything(), {
      screen_name: 'myRoom',
      screen_class: 'myRoom',
    });

    identifyUser(4);
    expect(gaMock.setUserId).toHaveBeenCalledWith(expect.anything(), '4');
    expect(crashMock.setUserId).toHaveBeenCalledWith(expect.anything(), '4');

    resetAnalyticsUser();
    expect(gaMock.setUserId).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('퍼널 이벤트가 GA4로 나간다 — 도구는 GA4 하나 (#799)', () => {
    initAnalytics();
    // 설치 → 로그인 → 온보딩 → 루틴 등록 → 완료 → 뽑기 → 방 저장.
    track('login_success', { provider: 'kakao' });
    track('onboarding_complete', { character: 'cat', goals: 2, nickname: 'set' });
    track('routine_create', { kind: 'routine' });
    track('room_save', { items: 5 });
    for (const name of ['login_success', 'onboarding_complete', 'routine_create', 'room_save']) {
      expect(gaMock.logEvent).toHaveBeenCalledWith(expect.anything(), name, expect.anything());
    }
  });

  it('이탈 원인 이벤트도 같은 창구로 나간다 (#799)', () => {
    initAnalytics();
    // 에러로 터지지 않고 조용히 포기하는 순간 — Sentry가 아니라 여기서만 보인다.
    const failures: [string, Record<string, string | number>][] = [
      ['login_failed', { provider: 'apple' }],
      ['purchase_blocked', { currency: 'coin', count: 6 }],
      ['api_error', { endpoint: 'GET /houses/{id}/members/{id}/room', status: 500 }],
    ];
    for (const [name, props] of failures) {
      track(name as Parameters<typeof track>[0], props);
      expect(gaMock.logEvent).toHaveBeenCalledWith(expect.anything(), name, props);
    }
  });

  it('처리되지 않은 JS 에러가 Crashlytics recordError로 남는다 (#438)', () => {
    initAnalytics();
    const errorUtils = (
      globalThis as unknown as {
        ErrorUtils: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void };
      }
    ).ErrorUtils;
    const handler = errorUtils.getGlobalHandler();
    try {
      handler(new Error('boom'), false);
    } catch {
      // RN 기본 핸들러가 rethrow해도 무방 — 기록 여부만 검증한다.
    }
    expect(crashMock.recordError).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      'JsError',
    );
  });
});
