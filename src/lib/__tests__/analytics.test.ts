/**
 * 분석 레이어의 계약: **어떤 경우에도 앱을 죽이지 않는다** (#912).
 *
 * 실제로 두 군데서 새어나갔다:
 *   1. `items`는 GA4 예약 파라미터라 네이티브가 배열로 캐스팅한다 — 숫자를
 *      넘겼더니 iOS `-[__NSCFNumber enumerateObjectsUsingBlock:]`,
 *      Android `java.lang.Double cannot be cast to ReadableArray`로 터졌다.
 *   2. `logEvent`가 준 Promise를 `void`로 버려서, 거부가 try/catch를 지나쳐
 *      unhandled rejection이 됐다. RNFB 26(#1031)은 모듈러 함수가 그 Promise를
 *      스스로 버리므로 앱은 인스턴스 메서드 `ga.logEvent`를 부른다 — 목도
 *      그 경로를 모듈 `logEvent` 호출 모양으로 흘린다.
 */
import {
  identifyUser,
  initAnalytics,
  resetAnalyticsUser,
  screenView,
  track,
} from '@/lib/analytics';

// jest.mock 팩토리는 `mock` 접두 변수만 참조할 수 있다.
const mockLogEvent = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockSetCollection = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockSetUserId = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockLogScreenView = jest.fn((..._a: unknown[]) => Promise.resolve());

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => {
    const instance = {
      logEvent: (...a: unknown[]) => mockLogEvent(instance, ...a),
    };
    return instance;
  },
  logEvent: (...a: unknown[]) => mockLogEvent(...a),
  setUserId: (...a: unknown[]) => mockSetUserId(...a),
  logScreenView: (...a: unknown[]) => mockLogScreenView(...a),
  setAnalyticsCollectionEnabled: (...a: unknown[]) => mockSetCollection(...a),
}));

describe('analytics (#912)', () => {
  // jest는 __DEV__가 true라, 수집 켜짐 경로를 보려면 명시해야 한다 (#954).
  beforeAll(() => initAnalytics({ collect: true }));
  beforeEach(() => jest.clearAllMocks());

  it('예약 파라미터 items를 그대로 보내지 않는다', () => {
    track('room_save', { items: 3 });
    const props = mockLogEvent.mock.calls[0]?.[2] as Record<string, unknown> | undefined;
    expect(props).toBeDefined();
    expect(props).not.toHaveProperty('items');
    expect(props).toMatchObject({ app_items: 3 });
  });

  it('예약어가 없으면 파라미터를 그대로 넘긴다', () => {
    track('room_save', { item_count: 3 });
    expect(mockLogEvent.mock.calls[0]?.[2]).toMatchObject({ item_count: 3 });
  });

  /**
   * 수집 켜짐 경로의 나머지 셋 (#1031 리뷰) — `setUserId`·`logScreenView`는 RNFB 26
   * 모듈러 함수가 여전히 Promise를 주므로 모듈 함수 그대로 부른다. 인스턴스
   * 경로로 옮긴 건 `logEvent`뿐이다.
   */
  it('identifyUser / resetAnalyticsUser는 모듈 setUserId를 문자열 id·null로 부른다', () => {
    identifyUser(4);
    expect(mockSetUserId).toHaveBeenCalledWith(expect.anything(), '4');
    resetAnalyticsUser();
    expect(mockSetUserId).toHaveBeenLastCalledWith(expect.anything(), null);
  });

  it('screenView는 모듈 logScreenView에 screen_name·screen_class를 넘긴다', () => {
    screenView('myRoom');
    expect(mockLogScreenView).toHaveBeenCalledWith(expect.anything(), {
      screen_name: 'myRoom',
      screen_class: 'myRoom',
    });
  });

  /** 거부를 흘리면 unhandled rejection이 되어 Sentry에 error로 잡힌다. */
  it('logEvent가 거부해도 밖으로 새지 않는다', async () => {
    mockLogEvent.mockImplementationOnce(() => Promise.reject(new Error('native boom')));
    expect(() => track('routine_complete', { kind: 'routine' })).not.toThrow();
    // 마이크로태스크를 비워 미처리 거부가 있으면 드러나게 한다.
    await Promise.resolve();
    await Promise.resolve();
  });
});
