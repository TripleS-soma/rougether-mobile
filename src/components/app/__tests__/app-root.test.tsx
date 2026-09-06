import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppRoot } from '@/components/app/app-root';
import { AuthProvider } from '@/hooks/use-auth';
import { QueryProvider } from '@/test-utils/query-wrapper';

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
    <QueryProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </QueryProvider>,
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

  it('시작 화면 설정이 마이페이지면 앱이 마이페이지로 열린다 (#1139)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    await AsyncStorage.setItem('rougether.start-tab', 'myPage');
    const { getByText, queryByText } = await renderApp();
    await waitFor(() => expect(getByText('프로필 편집')).toBeTruthy());
    expect(queryByText('오늘의 할 일')).toBeNull();
  });

  it('튜토리얼 다시 보기로 들어오면 건너뛰기가 생기고, 누르면 앱으로 돌아온다 (#1023)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    const { getByText, getByLabelText } = await renderApp();
    await waitFor(() => expect(getByText('내 방')).toBeTruthy());

    // 설정은 마이페이지 헤더의 톱니 뒤 서브화면 (#1088).
    await fireEvent.press(getByLabelText('마이페이지'));
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

  it('중도 종료한 계정은 관심사 추천으로 재개하고 나중에 선택하면 다음 실행에 강제하지 않는다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '71');
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['5'] }));
    await AsyncStorage.setItem(
      'rougether.starter-routine.v1.71',
      JSON.stringify({
        status: 'pending',
        goals: [{ id: '5', code: 'reading', label: '독서' }],
      }),
    );
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('작게 시작해볼까요?')).toBeTruthy());
    expect(ui.getByText('책 2쪽 읽기')).toBeTruthy();
    await fireEvent.press(ui.getByText('나중에 할게요'));
    await waitFor(() => expect(ui.getByText('내 방')).toBeTruthy());
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.71'))!).status,
    ).toBe('skipped');
    expect(ui.queryByText('첫 루틴 등록하기')).toBeNull();
    await ui.unmount();
    const restarted = await renderApp();
    await waitFor(() => expect(restarted.getByText('내 방')).toBeTruthy());
    expect(restarted.queryByText('작게 시작해볼까요?')).toBeNull();
  });

  it('미완료 추천이 남아도 루틴이 이미 있으면 추가 요청 없이 앱으로 들어간다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['5'] }));
    await AsyncStorage.setItem(
      'rougether.starter-routine.v1.72',
      JSON.stringify({
        status: 'pending',
        goals: [{ id: '5', code: 'reading', label: '독서' }],
      }),
    );
    const posts: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(url);
      if (url.endsWith('/routines'))
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              items: [{ id: 3, title: '기존 루틴', repeatType: 'DAILY', authType: 'CHECK' }],
            }),
        };
      return emptyRes(url);
    }) as unknown as typeof fetch;
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('내 방')).toBeTruthy());
    expect(posts.filter((url) => url.endsWith('/routines'))).toEqual([]);
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.72'))!).status,
    ).toBe('existing');
  });

  it('첫 온보딩에서 관심사를 골라 루틴을 생성하면 미션 시트 없이 오늘 할 일로 이어진다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '73');
    let created = false;
    const routine = { id: 101, title: '책 2쪽 읽기', repeatType: 'DAILY', authType: 'CHECK' };
    const posts: unknown[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const body = (value: unknown) => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(value),
      });
      if (url.endsWith('/goals'))
        return body({ items: [{ id: 91, code: 'reading', name: '독서' }] });
      if (url.endsWith('/routines')) {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(init.body as string));
          created = true;
          return body(routine);
        }
        return body({ items: created ? [routine] : [] });
      }
      return emptyRes(url);
    }) as unknown as typeof fetch;
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('5번째 슬라이드로 이동'));
    await fireEvent.press(ui.getByText('목표 선택하기'));
    await fireEvent.press(ui.getByText('독서'));
    await fireEvent.press(ui.getByText('시작하기'));
    await fireEvent.changeText(ui.getByLabelText('닉네임 입력'), '테스트');
    await fireEvent.press(ui.getByText('시작하기'));
    await waitFor(() => expect(ui.getByText('작게 시작해볼까요?')).toBeTruthy());
    await waitFor(() => expect(ui.queryByLabelText('내 루틴 확인 중')).toBeNull());
    await fireEvent.press(ui.getByLabelText('책 2쪽 읽기'));
    await fireEvent.press(ui.getByText('이 루틴으로 시작하기'));
    await waitFor(() => expect(ui.getByText('내 방')).toBeTruthy());
    expect(posts).toEqual([{ title: '책 2쪽 읽기', authType: 'CHECK', repeatType: 'DAILY' }]);
    await waitFor(() => expect(ui.getAllByText('책 2쪽 읽기').length).toBeGreaterThan(0));
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.73'))!).status,
    ).toBe('created');
    expect(ui.queryByText('뽑기 1회 해보기')).toBeNull();
  });
});
