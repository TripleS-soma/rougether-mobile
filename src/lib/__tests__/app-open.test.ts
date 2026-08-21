import { AppState, Linking } from 'react-native';

type GaMock = typeof import('@react-native-firebase/analytics');

/**
 * app-open은 "이번 포그라운드에서 이미 셌는가"를 모듈 상태로 들고 있다 —
 * 테스트마다 새 모듈을 받아야 앞 테스트의 상태가 새지 않는다.
 */
const freshModule = () => {
  let mod!: typeof import('@/lib/app-open');
  let ga!: GaMock;
  jest.isolateModules(() => {
    // 격리 레지스트리 안의 인스턴스끼리 물려야 한다 — 바깥에서 받은 GA 모킹은
    // 격리된 analytics가 부르는 그 객체가 아니다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ga = require('@react-native-firebase/analytics');
    // 이 파일은 app_open 이벤트가 나가는지를 보므로 수집을 켠 채로 (#954) —
    // 인자를 안 주면 jest의 __DEV__ true 때문에 수집이 꺼져 아무것도 안 나간다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/lib/analytics') as typeof import('@/lib/analytics')).initAnalytics({
      collect: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/app-open');
  });
  const opens = () => (ga.logEvent as jest.Mock).mock.calls.filter((c) => c[1] === 'app_open');
  return {
    ...mod,
    opens,
    lastSource: () => {
      const all = opens();
      return all.length ? (all[all.length - 1][2] as { source: string }).source : null;
    },
  };
};

/** AppState·Linking 리스너를 붙잡아 백그라운드 왕복·딥링크를 흉내낸다. */
const appStateHandlers: ((s: string) => void)[] = [];
const urlHandlers: ((e: { url: string }) => void)[] = [];
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('app-open 재방문 계기 (#803)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandlers.length = 0;
    urlHandlers.length = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, handler) => {
      appStateHandlers.push(handler as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_e, handler) => {
      urlHandlers.push(handler as (e: { url: string }) => void);
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  it('한 번의 포그라운드에서 계기는 한 건만 — 푸시가 이겼으면 직접 실행은 침묵', () => {
    const app = freshModule();
    app.reportAppOpen('push');
    app.reportAppOpen('direct');
    expect(app.opens()).toHaveLength(1);
    expect(app.lastSource()).toBe('push');
  });

  it('위젯 딥링크로 콜드 스타트하면 widget으로 센다', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('rougether://widget');
    const app = freshModule();
    app.initAppOpenTracking();
    await flush();
    expect(app.lastSource()).toBe('widget');
  });

  it('앱이 떠 있는 상태로 위젯을 눌러도 잡힌다 — 위젯 탭의 대부분이 이 경로다', async () => {
    const app = freshModule();
    app.initAppOpenTracking();
    await flush();
    expect(app.opens()).toHaveLength(1); // 콜드 스타트 direct

    appStateHandlers.forEach((h) => h('background'));
    urlHandlers.forEach((h) => h({ url: 'rougether://widget' }));
    expect(app.lastSource()).toBe('widget');
    expect(app.opens()).toHaveLength(2);
  });

  it('잠깐 다른 앱 다녀온 복귀는 세지 않는다 — direct가 부풀면 비교가 망가진다', async () => {
    const app = freshModule();
    app.initAppOpenTracking();
    await flush();

    appStateHandlers.forEach((h) => h('background'));
    appStateHandlers.forEach((h) => h('active'));
    await flush();
    expect(app.opens()).toHaveLength(1);
  });

  it('30분 넘게 나가 있다 돌아오면 새 방문으로 센다', async () => {
    const app = freshModule();
    app.initAppOpenTracking();
    await flush();

    appStateHandlers.forEach((h) => h('background'));
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 31 * 60 * 1000);
    appStateHandlers.forEach((h) => h('active'));
    await flush();
    expect(app.opens()).toHaveLength(2);
    expect(app.lastSource()).toBe('direct');
  });
});
