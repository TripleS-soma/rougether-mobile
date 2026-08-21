/**
 * 개발 빌드는 GA4로 아무것도 안 보낸다 (#954).
 *
 * 모듈 상태(initialized·ga)가 한 번 정해지면 안 바뀌므로, 켜짐/꺼짐을 같은
 * 파일에서 볼 수 없다 — 이 파일이 **꺼짐 경로 전용**이다.
 * 켜짐 경로는 `analytics.test.ts`가 `{ collect: true }`로 본다.
 */
import { identifyUser, initAnalytics, screenView, track } from '@/lib/analytics';

const mockLogEvent = jest.fn(() => Promise.resolve());
const mockScreenView = jest.fn(() => Promise.resolve());
const mockSetUserId = jest.fn(() => Promise.resolve());
const mockSetCollection = jest.fn((..._a: unknown[]) => Promise.resolve());

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => ({}),
  logEvent: () => mockLogEvent(),
  logScreenView: () => mockScreenView(),
  setUserId: () => mockSetUserId(),
  setAnalyticsCollectionEnabled: (...a: unknown[]) => mockSetCollection(...a),
}));

describe('개발 빌드 수집 차단 (#954)', () => {
  beforeAll(() => {
    // 인자를 안 주면 기본값 !__DEV__ — jest에서 __DEV__는 true라 꺼진다.
    initAnalytics();
  });

  it('수집 자체를 끈다 — logEvent만 막으면 SDK 자동 이벤트가 새어나간다', () => {
    // first_open·session_start는 우리가 부르는 게 아니라 네이티브가 쏜다.
    expect(mockSetCollection).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('우리 이벤트도 한 건도 나가지 않는다', () => {
    track('login_success');
    screenView('myRoom');
    identifyUser(4);
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockScreenView).not.toHaveBeenCalled();
    expect(mockSetUserId).not.toHaveBeenCalled();
  });

  it('꺼져 있어도 호출부가 죽지 않는다 — 분석은 앱을 멈추면 안 된다', () => {
    expect(() => {
      track('routine_complete', { items: 3 });
      screenView('house');
    }).not.toThrow();
  });
});
