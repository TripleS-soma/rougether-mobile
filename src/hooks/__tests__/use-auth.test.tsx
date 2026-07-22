import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

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
