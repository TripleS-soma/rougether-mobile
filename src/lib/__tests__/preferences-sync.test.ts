import { updatePreferences } from '@/api/me';
import {
  __lastSentPreferencesForTests,
  detectDeviceTimeZone,
  isIanaTimeZone,
  resetPreferencesSync,
  syncPreferences,
} from '@/lib/preferences-sync';

let mockDeviceTz: string | null = 'Asia/Seoul';
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ko' }],
  getCalendars: () => [{ timeZone: mockDeviceTz }],
}));
jest.mock('@/api/me', () => ({ updatePreferences: jest.fn(async () => ({})) }));
const updateMock = updatePreferences as jest.MockedFunction<typeof updatePreferences>;

beforeEach(() => {
  mockDeviceTz = 'Asia/Seoul';
  updateMock.mockClear();
  updateMock.mockImplementation(async () => ({}));
  resetPreferencesSync();
});

describe('preferences-sync (#1410, 서버 #396)', () => {
  it('IANA ID만 시간대로 인정한다 — 고정 오프셋·빈 값은 서버가 400이라 거른다', () => {
    expect(isIanaTimeZone('Asia/Seoul')).toBe(true);
    expect(isIanaTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isIanaTimeZone('Etc/GMT+9')).toBe(true);
    expect(isIanaTimeZone('UTC')).toBe(true);
    expect(isIanaTimeZone('+09:00')).toBe(false);
    expect(isIanaTimeZone('GMT')).toBe(false);
    expect(isIanaTimeZone('')).toBe(false);
    expect(isIanaTimeZone(null)).toBe(false);
  });

  it('기기 시간대는 expo-localization에서, 못 읽으면 Intl로 폴백한다', () => {
    expect(detectDeviceTimeZone()).toBe('Asia/Seoul');
    mockDeviceTz = '+09:00';
    expect(detectDeviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('처음엔 언어·시간대를 보내고, 같은 값이면 다시 보내지 않으며, 바뀐 것만 다시 보낸다', async () => {
    expect(await syncPreferences('en')).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ language: 'en', timeZone: 'Asia/Seoul' });
    expect(await syncPreferences('en')).toBe(false);
    expect(updateMock).toHaveBeenCalledTimes(1);

    mockDeviceTz = 'America/New_York';
    expect(await syncPreferences('en')).toBe(true);
    expect(updateMock).toHaveBeenLastCalledWith({ language: 'en', timeZone: 'America/New_York' });

    expect(await syncPreferences('ko')).toBe(true);
    expect(updateMock).toHaveBeenLastCalledWith({ language: 'ko', timeZone: 'America/New_York' });
    expect(__lastSentPreferencesForTests()).toEqual({
      language: 'ko',
      timeZone: 'America/New_York',
    });
  });

  it('실패하면 기억하지 않아 다음 호출(foreground)에서 재시도한다', async () => {
    updateMock.mockRejectedValueOnce(new Error('offline'));
    expect(await syncPreferences('en')).toBe(false);
    expect(__lastSentPreferencesForTests()).toBeNull();
    expect(await syncPreferences('en')).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it('동시 호출은 직렬화되어 한 번만 보낸다', async () => {
    const results = await Promise.all([syncPreferences('en'), syncPreferences('en')]);
    expect(results).toEqual([true, false]);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('세션이 지워지면 다음 로그인에 다시 보낸다', async () => {
    await syncPreferences('ko');
    resetPreferencesSync();
    expect(await syncPreferences('ko')).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
