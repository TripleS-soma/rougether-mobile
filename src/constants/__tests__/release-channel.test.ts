import { Platform } from 'react-native';

/**
 * UGC 공개 판정 (2026-10-05) — 심사 때 꺼진 채 통과한 1.5.3 바이너리는 OTA를 받아도 계속
 * 꺼지고, 웹·내부 채널·새 네이티브 빌드는 켜진다.
 */
function load({
  os = 'ios',
  channel = 'production',
  runtimeVersion,
}: {
  os?: typeof Platform.OS;
  channel?: string;
  runtimeVersion: string | null;
}): boolean {
  let value = false;
  jest.isolateModules(() => {
    jest.doMock('expo-updates', () => ({ channel, runtimeVersion }));
    jest.replaceProperty(Platform, 'OS', os);
    // 모듈 최상단 상수라 목을 바꿀 때마다 새로 읽는다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    value = (require('@/constants/release-channel') as typeof import('@/constants/release-channel'))
      .UGC_AVAILABLE;
  });
  return value;
}

describe('UGC_AVAILABLE', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('expo-updates');
  });

  it('1.5.3 스토어 바이너리(iOS·Android 지문)는 꺼진 채다', () => {
    expect(load({ runtimeVersion: '0ed984cc06b576025e715531a8084fb357715377' })).toBe(false);
    expect(
      load({ os: 'android', runtimeVersion: '162a83fa10080142251ab129fd19da4003ce3c29' }),
    ).toBe(false);
  });

  it('새 네이티브 빌드(지문이 다름)는 켜진다', () => {
    expect(load({ runtimeVersion: 'ffffffffffffffffffffffffffffffffffffffff' })).toBe(true);
  });

  it('내부 채널은 1.5.3 지문이어도 켜진다', () => {
    expect(
      load({ channel: 'internal', runtimeVersion: '0ed984cc06b576025e715531a8084fb357715377' }),
    ).toBe(true);
  });

  it('웹은 바로 켜진다', () => {
    expect(load({ os: 'web', runtimeVersion: null })).toBe(true);
  });
});
