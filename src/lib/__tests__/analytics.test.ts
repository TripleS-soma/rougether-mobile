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
});
