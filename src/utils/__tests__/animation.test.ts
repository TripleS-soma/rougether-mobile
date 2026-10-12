import type { Platform as PlatformType } from 'react-native';

/** NATIVE_DRIVER는 모듈 최상단 상수라 플랫폼을 바꿀 때마다 새로 읽는다. */
function loadNativeDriver(os: typeof PlatformType.OS): boolean {
  let value = false;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    jest.replaceProperty(Platform, 'OS', os);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    value = (require('@/utils/animation') as typeof import('@/utils/animation')).NATIVE_DRIVER;
  });
  return value;
}

describe('NATIVE_DRIVER', () => {
  afterEach(() => jest.restoreAllMocks());

  it('네이티브(iOS·Android)에서는 켠다', () => {
    expect(loadNativeDriver('ios')).toBe(true);
    expect(loadNativeDriver('android')).toBe(true);
  });

  it('웹에서는 끈다 — 네이티브 애니메이션 모듈이 없어 경고만 찍고 JS로 떨어지므로', () => {
    expect(loadNativeDriver('web')).toBe(false);
  });
});
