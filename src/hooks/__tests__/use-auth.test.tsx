import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoNativeLogin } from '@react-native-kakao/user';
import * as AppleAuthentication from 'expo-apple-authentication';

import { clearSession, devLogin } from '@/api';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { syncPushToken } from '@/lib/push-token';

jest.mock('@/lib/push-token', () => ({
  syncPushToken: jest.fn(async () => null),
  clearPushToken: jest.fn(async () => {}),
}));

function StatusProbe() {
  const { status } = useAuth();
  return <Text>{`status:${status}`}</Text>;
}

const res = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

const realFetch = global.fetch;
afterEach(async () => {
  await clearSession();
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('AuthProvider', () => {
  it('restores to guest when no session is persisted', async () => {
    const { getByText } = await render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );
    await waitFor(() => getByText('status:guest'));
  });

  it('syncs the push token when restoring a persisted session (#405)', async () => {
    global.fetch = jest.fn(async () =>
      res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
    ) as unknown as typeof fetch;
    await devLogin(1);
    (syncPushToken as jest.Mock).mockClear();

    const { getByText } = await render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );
    await waitFor(() => getByText('status:authed'));

    expect(syncPushToken).toHaveBeenCalledTimes(1);
  });

  it('flips to guest when the API layer clears an invalid session', async () => {
    global.fetch = jest.fn(async () =>
      res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
    ) as unknown as typeof fetch;
    await devLogin(1);

    const { getByText } = await render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );
    await waitFor(() => getByText('status:authed'));

    // Simulates a failed token refresh: client.ts calls clearSession().
    await act(async () => {
      await clearSession();
    });
    await waitFor(() => getByText('status:guest'));
  });
});

// 소셜 로그인 취소/실패 매핑 (#489 리뷰 반영) — SDK 목을 조작해 lib 판별
// 로직과 use-auth의 'ok'/'cancelled'/'failed' 매핑을 함께 검증한다.
describe('AuthProvider — 소셜 로그인 매핑', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('구글: 성공 → ok, 계정 시트 취소 → cancelled (서버 호출 없음)', async () => {
    global.fetch = jest.fn(async () =>
      res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
    ) as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      expect(await result.current.loginWithGoogle()).toBe('ok');
    });

    (global.fetch as jest.Mock).mockClear();
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'cancelled' });
    await act(async () => {
      expect(await result.current.loginWithGoogle()).toBe('cancelled');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('구글: idToken 없는 성공 응답은 failed', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: null },
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect(await result.current.loginWithGoogle()).toBe('failed');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('카카오: 취소는 구조화 code(Cancelled)로 판별해 cancelled', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    (kakaoNativeLogin as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('user cancelled.'), { code: 'Cancelled' }),
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect(await result.current.loginWithKakao()).toBe('cancelled');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    // 취소가 아닌 SDK 오류는 failed.
    (kakaoNativeLogin as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('network unreachable'), { code: 'Unknown' }),
    );
    await act(async () => {
      expect(await result.current.loginWithKakao()).toBe('failed');
    });
  });

  it('애플: 시트 취소(ERR_REQUEST_CANCELED)는 cancelled, 성공은 ok', async () => {
    global.fetch = jest.fn(async () =>
      res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
    ) as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });

    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
    );
    await act(async () => {
      expect(await result.current.loginWithApple()).toBe('cancelled');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.loginWithApple()).toBe('ok');
    });
  });
});
