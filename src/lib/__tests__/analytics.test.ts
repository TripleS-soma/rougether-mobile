import {
  identifyUser,
  initAnalytics,
  resetAnalyticsUser,
  screenView,
  track,
} from '@/lib/analytics';

describe('analytics', () => {
  it('키가 비어 있으면 전 함수가 조용히 무동작한다 (#437)', () => {
    // 키 발급 전 머지·OTA 배포에 안전해야 한다 — 어떤 호출도 던지지 않는다.
    expect(() => {
      initAnalytics();
      identifyUser(4);
      track('routine_complete', { kind: 'routine' });
      track('gacha_draw', { gachaId: 1, count: 10 });
      screenView('myRoom');
      resetAnalyticsUser();
    }).not.toThrow();
  });
});
