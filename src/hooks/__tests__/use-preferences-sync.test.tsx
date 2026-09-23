import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { usePreferencesSync } from '@/hooks/use-preferences-sync';
import { resetPreferencesSync, syncPreferences } from '@/lib/preferences-sync';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

let mockStatus: 'loading' | 'authed' | 'guest' = 'guest';
let mockLanguage: 'ko' | 'en' = 'ko';
let sessionClearedListener: (() => void) | null = null;
jest.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ language: mockLanguage, setLanguage: () => {} }),
}));
jest.mock('@/api/auth', () => ({
  onSessionCleared: (listener: () => void) => {
    sessionClearedListener = listener;
    return () => {
      sessionClearedListener = null;
    };
  },
}));
jest.mock('@/lib/preferences-sync', () => ({
  syncPreferences: jest.fn(async () => true),
  resetPreferencesSync: jest.fn(),
}));
const syncMock = syncPreferences as jest.MockedFunction<typeof syncPreferences>;
const resetMock = resetPreferencesSync as jest.MockedFunction<typeof resetPreferencesSync>;

let appStateListener: ((state: AppStateStatus) => void) | null = null;
beforeEach(() => {
  mockStatus = 'guest';
  mockLanguage = 'ko';
  syncMock.mockClear();
  resetMock.mockClear();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    appStateListener = cb as (state: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('usePreferencesSync (#1410)', () => {
  it('게스트일 땐 보내지 않고 foreground도 듣지 않는다', async () => {
    await renderHook(() => usePreferencesSync(), { wrapper: queryWrapper() });
    expect(syncMock).not.toHaveBeenCalled();
    expect(appStateListener).toBeNull();
  });

  it('로그인 상태면 현재 언어를 보내고, 언어가 바뀌면 다시 보내며 서버 캐시를 비운다', async () => {
    mockStatus = 'authed';
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { rerender } = await renderHook(() => usePreferencesSync(), {
      wrapper: queryWrapper(client),
    });
    expect(syncMock).toHaveBeenCalledWith('ko');
    expect(invalidate).not.toHaveBeenCalled();

    mockLanguage = 'en';
    await act(async () => rerender(undefined));
    expect(syncMock).toHaveBeenLastCalledWith('en');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('foreground로 돌아오면 시간대를 다시 확인하려고 한 번 더 보낸다', async () => {
    mockStatus = 'authed';
    await renderHook(() => usePreferencesSync(), { wrapper: queryWrapper() });
    expect(syncMock).toHaveBeenCalledTimes(1);
    await act(async () => appStateListener?.('background'));
    expect(syncMock).toHaveBeenCalledTimes(1);
    await act(async () => appStateListener?.('active'));
    expect(syncMock).toHaveBeenCalledTimes(2);
  });

  it('세션이 지워지면 마지막 전송 기억을 지운다', async () => {
    await renderHook(() => usePreferencesSync(), { wrapper: queryWrapper() });
    expect(sessionClearedListener).not.toBeNull();
    sessionClearedListener?.();
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
