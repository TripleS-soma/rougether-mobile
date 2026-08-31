import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppRoot } from '@/components/app/app-root';
import { AuthProvider } from '@/hooks/use-auth';

const KEY = 'rougether.onboarding.v1';

// AppRoot gates on a session, then AppShell loads my-room data — mock both.
const emptyRes = (url: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify(
      url.endsWith('/today') ? { categories: [], summary: {}, streak: {} } : { items: [] },
    ),
});
const realFetch = global.fetch;

const renderApp = () =>
  render(
    <AuthProvider>
      <AppRoot />
    </AuthProvider>,
  );

describe('AppRoot', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // Seed an authed session so the auth gate lets the app render.
    await AsyncStorage.setItem('rougether.auth.accessToken', 'access');
    await AsyncStorage.setItem('rougether.auth.refreshToken', 'refresh');
    global.fetch = jest.fn(async (url: string) => emptyRes(url)) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('shows onboarding on first launch', async () => {
    const { getByText } = await renderApp();
    await waitFor(() => expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
  });

  // #1023 — 첫 실행과 다시 보기는 둘 다 `onboarded === false`라 화면만으로는
  // 구분이 안 된다. 루트가 `replay`를 넘겨야 건너뛰기가 생긴다.
  it('첫 실행 온보딩에는 건너뛰기가 없다 (#1023)', async () => {
    const { queryByText, getByText } = await renderApp();
    await waitFor(() => expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    expect(queryByText('건너뛰기')).toBeNull();
  });

  it('튜토리얼 다시 보기로 들어오면 건너뛰기가 생기고, 누르면 앱으로 돌아온다 (#1023)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    const { getByText, getByLabelText } = await renderApp();
    await waitFor(() => expect(getByText('내 방')).toBeTruthy());

    await fireEvent.press(getByLabelText('설정'));
    await waitFor(() => expect(getByText('튜토리얼 다시 보기')).toBeTruthy());
    await fireEvent.press(getByText('튜토리얼 다시 보기'));

    // 온보딩이 다시 열리고, 이번엔 출구가 있다.
    await waitFor(() => expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    await fireEvent.press(getByText('건너뛰기'));

    // 목표 설문을 거치지 않고 바로 앱 — 저장된 선택은 그대로다.
    await waitFor(() => expect(getByText('내 방')).toBeTruthy());
  });

  it('goes straight to the app when onboarding was already completed', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: [] }));

    const { getByText } = await renderApp();

    await waitFor(() => expect(getByText('내 방')).toBeTruthy()); // MyRoom title
  });

  it('skips onboarding when the server says completed (no local cache)', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/onboarding'))
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              goals: [{ goalId: 1, code: 'exercise' }],
              primaryGoalId: 1,
              selectedCharacterId: 1,
              completed: true,
            }),
        };
      if (url.endsWith('/characters'))
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ items: [{ id: 1, code: 'bear', name: '곰' }] }),
        };
      return emptyRes(url);
    }) as unknown as typeof fetch;

    const { getByText } = await renderApp();

    await waitFor(() => expect(getByText('내 방')).toBeTruthy());
  });
});
