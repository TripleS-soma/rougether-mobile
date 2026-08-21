import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoNativeLogin } from '@react-native-kakao/user';
import * as AppleAuthentication from 'expo-apple-authentication';

import { clearSession, devLogin } from '@/api';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { getLastLoginFailure } from '@/lib/login-error';
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

  /**
   * 배포본에서만 나는 로그인 장애는 재현이 안 된다 — 원격 신호가 유일한
   * 단서인데 종전엔 `catch {}` 가 에러를 통째로 버렸다 (#959).
   */
  it('실패하면 제공자 코드를 실어 보내고 기억한다', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    // DEVELOPER_ERROR(10) = SHA-1/패키지명이 콘솔과 안 맞음.
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('sign in failed'), { code: 10 }),
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect(await result.current.loginWithGoogle()).toBe('failed');
    });
    // 화면이 문구 뒤에 붙일 수 있게 남는다.
    expect(getLastLoginFailure()).toMatchObject({ code: '10' });
    expect(getLastLoginFailure()?.hint).toContain('서명');
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

// 애플 로그인 계약 변경 (#547, 서버 #235) — authorizationCode 필수.
describe('AuthProvider — 애플 authorizationCode', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('요청 바디에 idToken과 authorizationCode를 함께 싣는다', async () => {
    const fetchMock = jest.fn(async () =>
      res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect(await result.current.loginWithApple()).toBe('ok');
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({
      idToken: 'test-apple-identity-token',
      authorizationCode: 'test-apple-auth-code',
    });
  });

  it('authorizationCode가 없으면 서버 호출 없이 failed', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: 'test-apple-identity-token',
      authorizationCode: null,
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      expect(await result.current.loginWithApple()).toBe('failed');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// 회원탈퇴 (#547, 서버 #235) — DELETE /me 성공 시 로컬 정리 + guest 전환.
describe('AuthProvider — 회원탈퇴', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('성공: DELETE /me 후 세션이 지워지고 guest가 된다', async () => {
    const fetchMock = jest.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') return res(204);
      return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(1);
    });
    expect(result.current.status).toBe('authed');

    let ok = false;
    await act(async () => {
      ok = await result.current.withdraw();
    });
    expect(ok).toBe(true);
    expect(result.current.status).toBe('guest');
    const deleteCall = fetchMock.mock.calls.find(
      ([, init]) => (init as { method?: string })?.method === 'DELETE',
    );
    expect(String(deleteCall?.[0])).toContain('/me');
  });

  it('성공: 계정 파생 로컬 데이터를 남김없이 지운다 (#922)', async () => {
    await AsyncStorage.multiSet([
      ['rougether.onboarding.v1', 'done'],
      ['rougether.widget.room-image.v1', 'data:image/png;base64,AAAA'],
      ['rougether.roomLayout.v1.1.11', '[]'],
      ['rougether.theme', 'cozy'],
    ]);
    const fetchMock = jest.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') return res(204);
      return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(1);
    });

    await act(async () => {
      await result.current.withdraw();
    });

    // 온보딩 플래그가 남으면 재가입해도 온보딩이 안 뜬다 — 이 제보의 본체.
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('실패: 탈퇴가 실패하면 로컬 데이터를 지우지 않는다', async () => {
    await AsyncStorage.setItem('rougether.onboarding.v1', 'done');
    const fetchMock = jest.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') return res(500, { message: 'boom' });
      return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(1);
    });

    await act(async () => {
      await result.current.withdraw();
    });

    // 계정이 살아 있는데 로컬만 날리면 멀쩡한 계정이 초기화된 앱을 만난다.
    expect(await AsyncStorage.getItem('rougether.onboarding.v1')).toBe('done');
  });

  it('실패: 서버 오류면 false를 돌려주고 세션을 유지한다', async () => {
    const fetchMock = jest.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE') return res(500, { message: 'boom' });
      return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(1);
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.withdraw();
    });
    expect(ok).toBe(false);
    expect(result.current.status).toBe('authed');
  });
});
