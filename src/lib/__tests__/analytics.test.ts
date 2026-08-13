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
