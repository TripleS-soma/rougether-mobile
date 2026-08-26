/**
 * 분석 레이어의 계약: **어떤 경우에도 앱을 죽이지 않는다** (#912).
 *
 * 실제로 두 군데서 새어나갔다:
 *   1. `items`는 GA4 예약 파라미터라 네이티브가 배열로 캐스팅한다 — 숫자를
 *      넘겼더니 iOS `-[__NSCFNumber enumerateObjectsUsingBlock:]`,
 *      Android `java.lang.Double cannot be cast to ReadableArray`로 터졌다.
 *   2. `logEvent`가 준 Promise를 `void`로 버려서, 거부가 try/catch를 지나쳐
 *      unhandled rejection이 됐다.
 */
import { initAnalytics, track } from '@/lib/analytics';

// jest.mock 팩토리는 `mock` 접두 변수만 참조할 수 있다.
const mockLogEvent = jest.fn((..._a: unknown[]) => Promise.resolve());
const mockSetCollection = jest.fn((..._a: unknown[]) => Promise.resolve());

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => ({}),
  logEvent: (...a: unknown[]) => mockLogEvent(...a),
  setUserId: () => Promise.resolve(),
  logScreenView: () => Promise.resolve(),
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

  /** 거부를 흘리면 unhandled rejection이 되어 Sentry에 error로 잡힌다. */
  it('logEvent가 거부해도 밖으로 새지 않는다', async () => {
    mockLogEvent.mockImplementationOnce(() => Promise.reject(new Error('native boom')));
    expect(() => track('routine_complete', { kind: 'routine' })).not.toThrow();
    // 마이크로태스크를 비워 미처리 거부가 있으면 드러나게 한다.
    await Promise.resolve();
    await Promise.resolve();
  });
});
