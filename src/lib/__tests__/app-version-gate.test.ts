import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { storeAppUrl, storeWebUrl } from '@/constants/store-links';
import {
  decideVersionGate,
  fetchVersionGate,
  installedRuntime,
  parseVersionGate,
} from '@/lib/app-version-gate';

const IOS = 'a'.repeat(40);
const ANDROID = 'b'.repeat(40);
const CURRENT = 'c'.repeat(40);

let mockRuntime: string | undefined = IOS;
jest.mock('expo-updates', () => ({
  get runtimeVersion() {
    return mockRuntime;
  },
}));

const SRC = join(__dirname, '..', '..');
const realFetch = global.fetch;

beforeEach(() => {
  mockRuntime = IOS;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('parseVersionGate', () => {
  it('지문 목록과 표시용 버전을 읽는다', () => {
    expect(
      parseVersionGate({
        latestVersion: '1.5.4',
        staleRuntimes: [IOS, ANDROID],
        blockedRuntimes: [],
      }),
    ).toEqual({ latestVersion: '1.5.4', staleRuntimes: [IOS, ANDROID], blockedRuntimes: [] });
  });

  it('지문 꼴이 아닌 항목은 버린다 — 오타가 섞여도 나머지는 살린다', () => {
    const config = parseVersionGate({
      staleRuntimes: [IOS, '', 'nope', 'A'.repeat(40), 123, null, ANDROID],
    });
    expect(config.staleRuntimes).toEqual([IOS, ANDROID]);
  });

  it('목록이 배열이 아니거나 없으면 빈 목록', () => {
    expect(parseVersionGate({ staleRuntimes: 'all' }).staleRuntimes).toEqual([]);
    expect(parseVersionGate({}).blockedRuntimes).toEqual([]);
    expect(parseVersionGate(null).staleRuntimes).toEqual([]);
    expect(parseVersionGate('nope').blockedRuntimes).toEqual([]);
  });

  it('latestVersion이 문자열이 아니면 생략한다', () => {
    expect(parseVersionGate({ latestVersion: 154 }).latestVersion).toBeUndefined();
  });
});

describe('decideVersionGate', () => {
  const config = {
    latestVersion: '1.5.4',
    staleRuntimes: [IOS],
    blockedRuntimes: [ANDROID],
  };

  it('목록에 없는 지문은 통과 — 최신 바이너리', () => {
    expect(decideVersionGate(config, CURRENT).level).toBe('ok');
  });

  it('stale 목록에 있으면 안내', () => {
    expect(decideVersionGate(config, IOS)).toEqual({
      level: 'recommended',
      latestVersion: '1.5.4',
    });
  });

  it('blocked 목록에 있으면 막는다', () => {
    expect(decideVersionGate(config, ANDROID)).toEqual({
      level: 'blocked',
      latestVersion: '1.5.4',
    });
  });

  it('두 목록에 다 있으면 막는 쪽이 이긴다', () => {
    // 랜딩 스모크가 겹침을 막지만, 우선순위 자체를 여기서 잠근다 —
    // 안내와 막기가 동시에 뜨는 상태가 없어야 한다.
    const overlap = {
      latestVersion: '1.5.4',
      staleRuntimes: [IOS],
      blockedRuntimes: [IOS],
    };
    expect(decideVersionGate(overlap, IOS).level).toBe('blocked');
  });

  it('모르면 통과시킨다 — 설정 없음·지문 미확인', () => {
    // 웹·개발 빌드·Expo Go가 여기로 온다. 안내를 못 하는 것보다
    // 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
    expect(decideVersionGate(undefined, IOS).level).toBe('ok');
    expect(decideVersionGate(config, undefined).level).toBe('ok');
  });

  it('목록을 안 채워 두면 아무도 안 조른다 — 잊었을 때 안전한 쪽', () => {
    // "최신 지문만 적고 그 밖은 구버전"으로 뒤집으면 적는 걸 잊은 순간
    // 최신 사용자에게 업데이트를 조른다. 그래서 나열 방식이다.
    expect(decideVersionGate({ staleRuntimes: [], blockedRuntimes: [] }, IOS).level).toBe('ok');
  });
});

describe('installedRuntime', () => {
  it('바이너리의 런타임 지문을 읽는다', () => {
    expect(installedRuntime()).toBe(IOS);
  });

  it('지문이 없으면 undefined — 웹·개발 빌드', () => {
    mockRuntime = undefined;
    expect(installedRuntime()).toBeUndefined();
    mockRuntime = '';
    expect(installedRuntime()).toBeUndefined();
  });
});

describe('fetchVersionGate', () => {
  it('받은 JSON을 설정으로 준다', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ latestVersion: '1.5.4', staleRuntimes: [IOS] }),
    })) as unknown as typeof fetch;
    await expect(fetchVersionGate()).resolves.toEqual({
      latestVersion: '1.5.4',
      staleRuntimes: [IOS],
      blockedRuntimes: [],
    });
  });

  it('캐시를 쓰지 않는다 — 목록을 고친 직후 반영되어야 한다', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await fetchVersionGate();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('캐시 우회 쿼리를 붙인다', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await fetchVersionGate();
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\?t=\d+$/);
  });

  /**
   * 조회 실패를 예외로 올리면 react-query 실패 경로를 타고 Sentry로 간다 —
   * 랜딩이 잠깐 404·5xx를 내는 동안 설치본 수만큼 이벤트가 쌓여 월 한도를
   * 노이즈로 채운다. 어차피 "모르면 통과"라 빈 설정과 결과가 같다.
   */
  it('응답이 실패면 빈 설정 — 예외로 올리지 않는다(Sentry 노이즈)', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(fetchVersionGate()).resolves.toEqual({
      staleRuntimes: [],
      blockedRuntimes: [],
    });
  });

  it('JSON이 깨졌거나 아예 못 받았으면 빈 설정', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    })) as unknown as typeof fetch;
    await expect(fetchVersionGate()).resolves.toEqual({
      staleRuntimes: [],
      blockedRuntimes: [],
    });

    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(fetchVersionGate()).resolves.toEqual({
      staleRuntimes: [],
      blockedRuntimes: [],
    });
  });
});

describe('스토어 주소', () => {
  it('스토어 앱 주소와 웹 대체 주소를 플랫폼별로 준다', () => {
    expect(storeAppUrl('ios')).toContain('itms-apps://');
    expect(storeWebUrl('ios')).toContain('https://apps.apple.com/');
    expect(storeAppUrl('android')).toContain('market://');
    expect(storeWebUrl('android')).toContain('play.google.com/store/apps/details?id=');
    expect(storeAppUrl('web')).toBeUndefined();
  });

  /**
   * `canOpenURL`은 iOS `LSApplicationQueriesSchemes`·Android manifest `<queries>`
   * 선언을 요구한다 — `app.json`을 건드리면 네이티브 지문이 바뀌고, 그러면 이
   * 기능 자체가 기존 설치본에 OTA로 못 간다. 쓰지 않는 걸 소스에서 잠근다.
   */
  it('게이트 코드에 canOpenURL이 없다 — 지문을 바꾸는 선언이 필요해진다', () => {
    const files = [
      'constants/store-links.ts',
      'lib/app-version-gate.ts',
      'hooks/use-app-version-gate.ts',
      'components/app/app-version-gate.tsx',
      'components/screens/app-update-screen.tsx',
    ];
    // 호출만 금지한다 — 주석으로 "쓰지 말 것"이라 적는 건 막지 않는다.
    const offenders = files.filter((file) =>
      readFileSync(join(SRC, file), 'utf8').includes('canOpenURL('),
    );
    expect(offenders).toEqual([]);
  });
});
