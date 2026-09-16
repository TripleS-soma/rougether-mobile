import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { readInstallReferrerInvite, resetInstallReferrerForTests } from '@/lib/install-referrer';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const mockGetInstallReferrer = jest.fn<Promise<string | null>, []>();
let mockModuleAvailable = true;
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () =>
    mockModuleAvailable ? { getInstallReferrer: () => mockGetInstallReferrer() } : null,
}));

const READ_KEY = 'rougether.install-referrer.read.v1';
const originalOS = Platform.OS;

beforeEach(() => {
  resetInstallReferrerForTests();
  mockGetInstallReferrer.mockReset();
  mockTrack.mockClear();
  mockModuleAvailable = true;
  Platform.OS = 'android';
});
afterAll(() => {
  Platform.OS = originalOS;
});

describe('readInstallReferrerInvite (#1007 — 설치당 1회)', () => {
  it('첫 실행에 referrer의 초대코드를 돌려주고 읽음 표시를 남긴다', async () => {
    mockGetInstallReferrer.mockResolvedValue('invite_type=friend&invite_code=abcd2345');
    await expect(readInstallReferrerInvite()).resolves.toEqual({
      kind: 'invite',
      invite: { kind: 'friend', code: 'ABCD2345' },
    });
    expect(await AsyncStorage.getItem(READ_KEY)).not.toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('invite_referrer_result', { kind: 'friend' });
  });

  it('이미 읽었으면 네이티브를 부르지 않는다 (다음 실행)', async () => {
    await AsyncStorage.setItem(READ_KEY, '2026-09-16T00:00:00.000Z');
    await expect(readInstallReferrerInvite()).resolves.toEqual({ kind: 'skipped' });
    expect(mockGetInstallReferrer).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('유기적 설치는 none — 그래도 읽음 표시는 남겨 다시 읽지 않는다', async () => {
    mockGetInstallReferrer.mockResolvedValue('utm_source=google-play&utm_medium=organic');
    await expect(readInstallReferrerInvite()).resolves.toEqual({ kind: 'none' });
    expect(await AsyncStorage.getItem(READ_KEY)).not.toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('invite_referrer_result', { kind: 'none' });
  });

  it('Play 서비스 일시 오류면 표시를 남기지 않아 다음 실행에 다시 시도한다', async () => {
    mockGetInstallReferrer.mockRejectedValue(new Error('ERR_INSTALL_REFERRER_UNAVAILABLE'));
    await expect(readInstallReferrerInvite()).resolves.toEqual({ kind: 'skipped' });
    expect(await AsyncStorage.getItem(READ_KEY)).toBeNull();

    resetInstallReferrerForTests();
    mockGetInstallReferrer.mockResolvedValue('invite_type=house&invite_code=HOME77');
    await expect(readInstallReferrerInvite()).resolves.toEqual({
      kind: 'invite',
      invite: { kind: 'house', code: 'HOME77' },
    });
  });

  it('같은 실행에서 여러 번 불러도 네이티브 호출은 한 번', async () => {
    mockGetInstallReferrer.mockResolvedValue('invite_type=friend&invite_code=ABCD2345');
    const [a, b] = await Promise.all([readInstallReferrerInvite(), readInstallReferrerInvite()]);
    expect(a).toEqual(b);
    expect(mockGetInstallReferrer).toHaveBeenCalledTimes(1);
  });

  it('Android가 아니거나 모듈이 없는 빌드(구 바이너리·웹)는 조용히 건너뛴다', async () => {
    Platform.OS = 'ios';
    await expect(readInstallReferrerInvite()).resolves.toEqual({ kind: 'skipped' });
    expect(mockGetInstallReferrer).not.toHaveBeenCalled();

    resetInstallReferrerForTests();
    Platform.OS = 'android';
    mockModuleAvailable = false;
    await expect(readInstallReferrerInvite()).resolves.toEqual({ kind: 'skipped' });
    expect(mockGetInstallReferrer).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(READ_KEY)).toBeNull();
  });
});
