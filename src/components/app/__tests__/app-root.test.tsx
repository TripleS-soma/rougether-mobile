import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { AppRoot } from '@/components/app/app-root';
import { renderWithProviders } from '@/test-utils/render';

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

const renderApp = () => renderWithProviders(<AppRoot />);

describe('AppRoot', () => {
  beforeEach(async () => {
    // Seed an authed session so the auth gate lets the app render.
    await AsyncStorage.setItem('rougether.auth.accessToken', 'access');
    await AsyncStorage.setItem('rougether.auth.refreshToken', 'refresh');
    global.fetch = jest.fn(async (url: string) => emptyRes(url)) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  // #1282 — 소개는 로그인 전(로그인 라우트)으로 옮겼다. 로그인 뒤 첫 실행은
  // 곧장 목표 설문이다.
  it('shows onboarding on first launch — goal survey first (#1282)', async () => {
    const { getByText, queryByText } = await renderApp();
    await waitFor(() => expect(getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
    expect(queryByText('루게더에 오신 걸 환영해요')).toBeNull();
  });

  // #1023 — 첫 실행과 다시 보기는 둘 다 `onboarded === false`라 화면만으로는
  // 구분이 안 된다. 루트가 `replay`를 넘겨야 소개와 건너뛰기가 생긴다.
  it('첫 실행 온보딩에는 건너뛰기도 돌아갈 소개도 없다 (#1023, #1282)', async () => {
    const { queryByText, getByText } = await renderApp();
    await waitFor(() => expect(getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
    expect(queryByText('건너뛰기')).toBeNull();
    expect(queryByText('이전')).toBeNull();
  });

  it('시작 화면 설정이 내 정보면 앱이 내 정보로 열린다 (#1139)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    await AsyncStorage.setItem('rougether.start-tab', 'myPage');
    const { getByText, queryByText } = await renderApp();
    await waitFor(() => expect(getByText('프로필 편집')).toBeTruthy());
    expect(queryByText('오늘의 할 일')).toBeNull();
  });

  it('튜토리얼 다시 보기로 들어오면 건너뛰기가 생기고, 누르면 앱으로 돌아온다 (#1023)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    const { getByText, getByLabelText } = await renderApp();
    await waitFor(() => expect(getByText('오늘의 할 일')).toBeTruthy());

    // 설정은 내 정보 헤더의 톱니 뒤 서브화면 (#1088).
    await fireEvent.press(getByLabelText('내 정보'));
    await fireEvent.press(getByLabelText('설정'));
    await waitFor(() => expect(getByText('튜토리얼 다시 보기')).toBeTruthy());
    await fireEvent.press(getByText('튜토리얼 다시 보기'));

    // 온보딩이 다시 열리고, 이번엔 출구가 있다.
    await waitFor(() => expect(getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    await fireEvent.press(getByText('건너뛰기'));

    // 목표 설문을 거치지 않고 바로 앱 — 저장된 선택은 그대로다.
    await waitFor(() => expect(getByText('오늘의 할 일')).toBeTruthy());
  });

  it('goes straight to the app when onboarding was already completed', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: [] }));

    const { getByText } = await renderApp();

    await waitFor(() => expect(getByText('오늘의 할 일')).toBeTruthy());
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

    await waitFor(() => expect(getByText('오늘의 할 일')).toBeTruthy());
  });

  it('첫 가입: 온보딩 완료 → 추천 루틴 게이트 → 게이트를 닫으면 미션 1(뽑기) 배너가 뜬다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
    await fireEvent.press(ui.getByText('운동'));
    await fireEvent.press(ui.getByText('시작하기'));
    await fireEvent.changeText(ui.getByLabelText('닉네임 입력'), '준서');
    await fireEvent.press(ui.getByText('시작하기'));
    // 관심사 추천 루틴 게이트(#1149)가 먼저 — 여기서는 미션 배너가 없다.
    await waitFor(() => expect(ui.getByText('작게 시작해볼까요?')).toBeTruthy());
    expect(ui.queryByTestId('mission-banner')).toBeNull();
    await fireEvent.press(ui.getByText('나중에 할게요'));
    // 게이트가 닫히면 셸이 뜨고, 첫 루틴 등록 없이 뽑기 미션부터 시작한다.
    await waitFor(() => expect(ui.getByTestId('mission-banner')).toBeTruthy());
    expect(ui.getByText('뽑기 1회 해보기')).toBeTruthy();
    expect(ui.queryByText('첫 루틴 등록하기')).toBeNull();
  });

  /**
   * 같은 기기에서 다른 계정으로 새로 가입하면 튜토리얼 미션이 안 떴다 (2026-09-11 제보).
   * 온보딩 캐시·미션 플래그가 **기기 단위** 키였고 로그아웃은 세션만 지운다 — 앞 계정의
   * 흔적이 새 계정을 "온보딩 끝남·미션 끝남"으로 보이게 했다.
   */
  it('앞 계정이 온보딩을 마친 기기에서 새 계정이 로그인하면 온보딩부터 시작한다', async () => {
    // 앞 계정(41)이 이 기기에서 온보딩·추천 루틴까지 마쳤다.
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    await AsyncStorage.setItem(
      'rougether.starter-routine.v1.41',
      JSON.stringify({ status: 'skipped', goals: [] }),
    );
    // 새 계정(72) — 서버는 온보딩 미완료(기본 응답에 completed 없음).
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
  });

  it('앞 계정이 미션을 끝낸 기기에서도 새 계정의 첫 가입에는 미션 배너가 뜬다', async () => {
    await AsyncStorage.setItem('rougether.onboarding-missions.v1', 'completed');
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
    await fireEvent.press(ui.getByText('운동'));
    await fireEvent.press(ui.getByText('시작하기'));
    await fireEvent.changeText(ui.getByLabelText('닉네임 입력'), '새친구');
    await fireEvent.press(ui.getByText('시작하기'));
    await waitFor(() => expect(ui.getByText('작게 시작해볼까요?')).toBeTruthy());
    await fireEvent.press(ui.getByText('나중에 할게요'));
    await waitFor(() => expect(ui.getByTestId('mission-banner')).toBeTruthy());
  });

  /**
   * 옛 기기 기록의 주인 판별 — 서버에 이 계정의 목표가 있으면 온보딩을 거친 기존
   * 사용자다(캐릭터 저장 409로 completed=false인 경우 포함). 업데이트 뒤에도 온보딩을
   * 다시 보지 않고, 기록은 계정별 키로 옮겨진다.
   */
  it('서버에 목표가 있는 기존 사용자는 옛 기기 기록으로 그대로 앱에 들어가고 계정별로 옮긴다', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ characterId: 'cat', goals: ['exercise'] }));
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/onboarding'))
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ goals: [{ goalId: 1, code: 'exercise' }], completed: false }),
        };
      return emptyRes(url);
    }) as unknown as typeof fetch;

    const ui = await renderApp();
    await waitFor(() => expect(ui.getByText('오늘의 할 일')).toBeTruthy());
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(`${KEY}.72`)).toBe(
        JSON.stringify({ characterId: 'cat', goals: ['exercise'] }),
      ),
    );
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('중도 종료한 계정은 관심사 추천으로 재개하고 나중에 선택하면 다음 실행에 강제하지 않는다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '71');
    // 이 계정이 이 기기에서 마친 온보딩 — 계정별 키에 있다.
    await AsyncStorage.setItem(`${KEY}.71`, JSON.stringify({ characterId: 'cat', goals: ['5'] }));
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
    await waitFor(() => expect(ui.getByText('오늘의 할 일')).toBeTruthy());
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.71'))!).status,
    ).toBe('skipped');
    expect(ui.queryByText('첫 루틴 등록하기')).toBeNull();
    await ui.unmount();
    const restarted = await renderApp();
    await waitFor(() => expect(restarted.getByText('오늘의 할 일')).toBeTruthy());
    expect(restarted.queryByText('작게 시작해볼까요?')).toBeNull();
  });

  it('미완료 추천이 남아도 루틴이 이미 있으면 추가 요청 없이 앱으로 들어간다', async () => {
    await AsyncStorage.setItem('rougether.auth.userId', '72');
    await AsyncStorage.setItem(`${KEY}.72`, JSON.stringify({ characterId: 'cat', goals: ['5'] }));
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
    await waitFor(() => expect(ui.getByText('오늘의 할 일')).toBeTruthy());
    expect(posts.filter((url) => url.endsWith('/routines'))).toEqual([]);
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.72'))!).status,
    ).toBe('existing');
  });

  it('첫 온보딩에서 관심사를 골라 루틴을 생성하면 오늘 할 일로 이어지고 뽑기 미션이 시작된다', async () => {
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
    await waitFor(() => expect(ui.getByText('관심 있는 목표를 골라주세요')).toBeTruthy());
    await fireEvent.press(ui.getByText('독서'));
    await fireEvent.press(ui.getByText('시작하기'));
    await fireEvent.changeText(ui.getByLabelText('닉네임 입력'), '테스트');
    await fireEvent.press(ui.getByText('시작하기'));
    await waitFor(() => expect(ui.getByText('작게 시작해볼까요?')).toBeTruthy());
    await waitFor(() => expect(ui.queryByLabelText('내 루틴 확인 중')).toBeNull());
    await fireEvent.press(ui.getByLabelText('책 2쪽 읽기'));
    await fireEvent.press(ui.getByText('이 루틴으로 시작하기'));
    await waitFor(() => expect(ui.getByText('오늘의 할 일')).toBeTruthy());
    expect(posts).toEqual([{ title: '책 2쪽 읽기', authType: 'CHECK', repeatType: 'DAILY' }]);
    await waitFor(() => expect(ui.getAllByText('책 2쪽 읽기').length).toBeGreaterThan(0));
    expect(
      JSON.parse((await AsyncStorage.getItem('rougether.starter-routine.v1.73'))!).status,
    ).toBe('created');
    // 첫 루틴 등록 미션은 뺐다(게이트가 대신) — 게이트가 닫히면 뽑기 미션부터 시작한다.
    await waitFor(() => expect(ui.getByTestId('mission-banner')).toBeTruthy());
    expect(ui.getByText('뽑기 1회 해보기')).toBeTruthy();
  });
});
