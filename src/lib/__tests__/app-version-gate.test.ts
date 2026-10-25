import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  decideVersionGate,
  installedBuildNumber,
  parseVersionGate,
  ruleForPlatform,
} from '@/lib/app-version-gate';
import { storeAppUrl, storeWebUrl } from '@/constants/store-links';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { platform: { ios: { buildNumber: '125' }, android: { versionCode: 12 } } },
}));

const SRC = join(__dirname, '..', '..');

describe('parseVersionGate', () => {
  it('정수 빌드 번호만 받는다', () => {
    const config = parseVersionGate({
      ios: { minimumBuild: 100, recommendedBuild: 126, latestVersion: '1.5.4' },
      android: { minimumBuild: 0, recommendedBuild: 13 },
    });
    expect(config.ios).toEqual({
      minimumBuild: 100,
      recommendedBuild: 126,
      latestVersion: '1.5.4',
    });
    expect(config.android).toEqual({ minimumBuild: 0, recommendedBuild: 13 });
  });

  it('형식이 어긋난 규칙은 버린다 — 문자열·소수·음수·누락', () => {
    expect(
      parseVersionGate({ ios: { minimumBuild: '100', recommendedBuild: 126 } }).ios,
    ).toBeUndefined();
    expect(
      parseVersionGate({ ios: { minimumBuild: 1.5, recommendedBuild: 126 } }).ios,
    ).toBeUndefined();
    expect(
      parseVersionGate({ ios: { minimumBuild: -1, recommendedBuild: 126 } }).ios,
    ).toBeUndefined();
    expect(parseVersionGate({ ios: { recommendedBuild: 126 } }).ios).toBeUndefined();
    expect(parseVersionGate(null).ios).toBeUndefined();
    expect(parseVersionGate('nope').android).toBeUndefined();
  });

  it('막는 기준이 권하는 기준보다 높으면 막는 쪽을 버린다 — 사람이 잘못 적은 값', () => {
    // 안내를 놓치는 건 복구되지만 멀쩡한 설치본을 막는 건 아니다.
    expect(parseVersionGate({ ios: { minimumBuild: 999, recommendedBuild: 126 } }).ios).toEqual({
      minimumBuild: 0,
      recommendedBuild: 126,
      latestVersion: undefined,
    });
  });

  it('latestVersion이 문자열이 아니면 생략한다', () => {
    expect(
      parseVersionGate({ ios: { minimumBuild: 0, recommendedBuild: 1, latestVersion: 154 } }).ios
        ?.latestVersion,
    ).toBeUndefined();
  });
});

describe('decideVersionGate', () => {
  const rule = { minimumBuild: 100, recommendedBuild: 126, latestVersion: '1.5.4' };

  it('최신이면 통과', () => {
    expect(decideVersionGate(rule, 126).level).toBe('ok');
    expect(decideVersionGate(rule, 200).level).toBe('ok');
  });

  it('권장 미달이면 안내 — 다시 안내할 기준으로 recommendedBuild를 함께 준다', () => {
    expect(decideVersionGate(rule, 125)).toEqual({
      level: 'recommended',
      latestVersion: '1.5.4',
      recommendedBuild: 126,
    });
  });

  it('최소 미달이면 막는다', () => {
    expect(decideVersionGate(rule, 99)).toEqual({ level: 'blocked', latestVersion: '1.5.4' });
  });

  it('0은 게이트 끔', () => {
    expect(decideVersionGate({ minimumBuild: 0, recommendedBuild: 0 }, 1).level).toBe('ok');
  });

  it('모르면 통과시킨다 — 규칙 없음·설치본 번호 미확인', () => {
    // 개발 빌드·Expo Go·웹이 여기로 온다. 안내를 못 하는 것보다
    // 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
    expect(decideVersionGate(undefined, 1).level).toBe('ok');
    expect(decideVersionGate(rule, undefined).level).toBe('ok');
  });
});

describe('installedBuildNumber', () => {
  it('플랫폼별 바이너리 번호를 읽는다', () => {
    expect(installedBuildNumber('ios')).toBe(125);
    expect(installedBuildNumber('android')).toBe(12);
  });

  it('웹은 번호가 없다', () => {
    expect(installedBuildNumber('web')).toBeUndefined();
  });
});

describe('ruleForPlatform', () => {
  it('플랫폼 규칙만 고르고 웹은 없다', () => {
    const config = parseVersionGate({
      ios: { minimumBuild: 1, recommendedBuild: 2 },
      android: { minimumBuild: 3, recommendedBuild: 4 },
    });
    expect(ruleForPlatform(config, 'ios')?.recommendedBuild).toBe(2);
    expect(ruleForPlatform(config, 'android')?.recommendedBuild).toBe(4);
    expect(ruleForPlatform(config, 'web')).toBeUndefined();
    expect(ruleForPlatform(undefined, 'ios')).toBeUndefined();
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
