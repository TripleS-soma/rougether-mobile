import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { AppShell } from '@/components/app/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { QueryProvider } from '@/test-utils/query-wrapper';
import { renderWithProviders } from '@/test-utils/render';

// 푸시 탭 콜백을 붙잡아 테스트에서 직접 발화한다 (#405).
let notificationTapCb: ((n?: { type?: string }) => void) | null = null;
let notificationReceivedCb: ((n: { type?: string; title: string; body: string }) => void) | null =
  null;

jest.mock('@/lib/push-events', () => ({
  onNotificationTap: (cb: (n?: { type?: string }) => void) => {
    notificationTapCb = cb;
    return () => {
      notificationTapCb = null;
    };
  },
  // 인앱 푸시 배너 수신 구독 (#902) — 테스트가 직접 알림을 흘려보낼 수 있게 잡아둔다.
  onNotificationReceived: (cb: (n: { type?: string; title: string; body: string }) => void) => {
    notificationReceivedCb = cb;
    return () => {
      notificationReceivedCb = null;
    };
  },
}));

// AppShell loads my-room data from the API on mount; return empty payloads so
// the render is deterministic and hits no network.
const emptyRes = (url: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify(
      url.endsWith('/today') ? { categories: [], summary: {}, streak: {} } : { items: [] },
    ),
});
const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => emptyRes(url)) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

// --- 집(2)·미션 세계 (#578 계열 테스트 셋이 같이 쓴다) — 카테고리·루틴·미션만 바꿔 끼우고,
// 특정 요청(POST·PUT 등)은 `extra`가 먼저 받는다. 나머지 응답은 세 벌이 글자 그대로 같았다.
type ApiCall = { url: string; method: string; body?: string };
const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});
const weeklyMission = (missionId: number, title: string, status = 'ACTIVE') => ({
  missionId,
  title,
  missionType: 'WEEKLY_MEMBER_COUNT',
  targetValue: 5,
  currentValue: 0,
  status,
});
function houseWorld(
  calls: ApiCall[],
  world: {
    categories: unknown[];
    routines: unknown[];
    missions: unknown[];
    /** 공통 라우트보다 먼저 — 값을 돌려주면 그 본문으로 응답한다. */
    extra?: (url: string, method: string) => unknown;
  },
) {
  return async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/auth/')) return okJson({ accessToken: 't', refreshToken: 'r' });
    const hit = world.extra?.(url, method);
    if (hit !== undefined) return okJson(hit);
    if (url.includes('/categories')) return okJson({ items: world.categories });
    if (url.endsWith('/routines')) return okJson({ items: world.routines });
    if (url.endsWith('/me/houses')) return okJson({ items: [{ houseId: 2, name: 'TripleS' }] });
    if (url.includes('/houses/2/missions')) return okJson({ items: world.missions });
    if (url.includes('/houses/2/members')) return okJson({ items: [] });
    if (url.includes('/houses/2')) return okJson({ houseId: 2, name: 'TripleS', myRole: 'OWNER' });
    if (url.endsWith('/today')) return okJson({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return okJson({ userId: 4, nickname: '준서' });
    return okJson({ items: [] });
  };
}

describe('AppShell — 푸시 탭 라우팅 (#405)', () => {
  it.each(['APP_INACTIVITY_REMINDER', 'ROOM_COBWEB_APPEARED'])(
    '%s 알림을 누르면 알림함에서 내 방으로 돌아간다',
    async (type) => {
      const view = await renderWithProviders(<AppShell />);
      await act(async () => notificationTapCb?.());
      await waitFor(() => expect(view.getByText('알림')).toBeTruthy());
      await act(async () => notificationTapCb?.({ type }));
      await waitFor(() => expect(view.queryByText('알림')).toBeNull());
      expect(view.getByLabelText('알림')).toBeTruthy();
    },
  );

  it('알림 탭 콜백이 발화하면 알림 목록 화면으로 이동한다', async () => {
    const { getByText } = await renderWithProviders(<AppShell />);
    expect(notificationTapCb).toBeTruthy();

    await act(async () => notificationTapCb?.());

    await waitFor(() => getByText('알림'));
  });
});

describe('AppShell — 알림함 카드 탭·떠날 때 읽음 (2026-10-08)', () => {
  const calls: { url: string; method: string }[] = [];
  beforeEach(() => {
    calls.splice(0);
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.includes('/notifications?') || url.endsWith('/notifications'))
        return okJson({
          items: [
            { notificationId: 1, type: 'ROUTINE_REMINDER', title: '물 마시기 할 시간', body: '', isRead: false, createdAt: '2026-10-08T00:00:00Z' }, // prettier-ignore
          ],
          hasNext: false,
        });
      return emptyRes(url);
    }) as unknown as typeof fetch;
  });

  it('카드를 누르면 그 화면으로 가고, 탭 자체로는 개별 읽음을 보내지 않으며, 떠나면 모두 읽음', async () => {
    const view = await renderWithProviders(<AppShell />);
    await act(async () => notificationTapCb?.());
    await waitFor(() => view.getByText('물 마시기 할 시간'));

    await fireEvent.press(view.getByLabelText('물 마시기 할 시간'));
    // 루틴 리마인드 → 나의 방.
    await waitFor(() => expect(view.queryByText('물 마시기 할 시간')).toBeNull());
    expect(calls.some((c) => c.method === 'PATCH' && /\/notifications\/1\/read$/.test(c.url))).toBe(
      false,
    );
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/notifications/read-all')),
      ).toBe(true),
    );
  });

  it('뒤로 나가도 안 읽은 알림을 모두 읽음 처리한다', async () => {
    const view = await renderWithProviders(<AppShell />);
    await act(async () => notificationTapCb?.());
    await waitFor(() => view.getByText('물 마시기 할 시간'));
    expect(calls.some((c) => c.url.endsWith('/notifications/read-all'))).toBe(false);

    await fireEvent.press(view.getByLabelText('뒤로 가기'));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/notifications/read-all')),
      ).toBe(true),
    );
  });
});

describe('AppShell — 인앱 푸시 배너 (#902)', () => {
  it('앱이 켜져 있을 때 도착한 알림을 상단 배너로 띄우고, 탭하면 알림함으로 간다', async () => {
    const { getByText, getByLabelText, queryByTestId } = await renderWithProviders(<AppShell />);
    expect(notificationReceivedCb).toBeTruthy();
    // 아무것도 안 왔으면 배너도 없다.
    expect(queryByTestId('notification-banner')).toBeNull();

    await act(async () =>
      notificationReceivedCb?.({
        type: 'FRIEND_CHEER',
        title: '응원이 도착했어요',
        body: '오늘도 화이팅!',
      }),
    );
    await waitFor(() => getByText('응원이 도착했어요'));

    await act(async () => {
      await fireEvent.press(getByLabelText('응원이 도착했어요. 오늘도 화이팅!'));
    });
    await waitFor(() => getByText('알림'));
  });
});

describe('AppShell — 온보딩 미션 체인 (#571)', () => {
  it('startMissions면 미션 1(루틴 완료) 배너와 잠금 코치마크가 뜨고, 완료하면 미션 2(뽑기)로 넘어간다 (#1324)', async () => {
    const ui = await renderWithProviders(<AppShell startMissions />);
    await waitFor(() => ui.getByTestId('mission-banner'));
    // 배너와 코치마크 말풍선이 같은 진행 라벨을 단다.
    expect(ui.getAllByText(/미션 1\/4/).length).toBeGreaterThanOrEqual(1);
    expect(ui.getByText('오늘 루틴 1개 완료하기')).toBeTruthy();
    // 완전 잠금 오버레이 — 건너뛰기·다음 버튼이 없다.
    expect(ui.getByTestId('coach-overlay')).toBeTruthy();
    expect(ui.queryByLabelText('튜토리얼 건너뛰기')).toBeNull();
    expect(ui.queryByLabelText('다음 단계')).toBeNull();
    expect(ui.getByText('오늘 루틴을 완료해 봐요')).toBeTruthy();
  });

  it('건너뛰기는 확인을 거쳐 배너를 없애고, startMissions 없으면 배너가 없다', async () => {
    const off = await renderWithProviders(<AppShell />);
    await act(async () => {});
    expect(off.queryByTestId('mission-banner')).toBeNull();

    const on = await renderWithProviders(<AppShell startMissions missionSkipEnabled />);
    await waitFor(() => on.getByTestId('mission-banner'));
    await fireEvent.press(on.getByLabelText('미션 건너뛰기'));
    await fireEvent.press(on.getByLabelText('미션 건너뛰기 확인'));
    await waitFor(() => expect(on.queryByTestId('mission-banner')).toBeNull());
    // 스킵 플래그 영속 — 다음 시작에 다시 시작하지 않는다.
    expect(await AsyncStorage.getItem('rougether.onboarding-missions.v1')).toBe('skipped');
  });

  // #1023 — 첫 실행 체인에는 건너뛰기를 두지 않는다. 다시 보기로 되돌린
  // 체인에서만(missionSkipEnabled) 출구가 붙는다.
  it('첫 실행 체인의 배너에는 건너뛰기가 없다 (#1023)', async () => {
    const ui = await renderWithProviders(<AppShell startMissions />);
    await waitFor(() => ui.getByTestId('mission-banner'));
    expect(ui.queryByLabelText('미션 건너뛰기')).toBeNull();
    expect(ui.getByText('오늘 루틴 1개 완료하기')).toBeTruthy();
  });
});

describe('AppShell — 집 없는 유저의 집 탭 (#571)', () => {
  it('집이 없으면 집 탭이 빈 상태 대신 집 탐색으로 직행하고, 뒤로는 나의 방', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url);
      return emptyRes(url);
    }) as unknown as typeof fetch;

    const { getByText, getByLabelText, queryByText } = await renderWithProviders(<AppShell />);
    // 집 목록 로드가 끝나(빈 목록 확정) noHouses 판정이 서고 나서 탭을 누른다.
    await waitFor(() => expect(calls.some((u) => u.endsWith('/me/houses'))).toBe(true));
    await act(async () => {});

    await fireEvent.press(getByLabelText('집'));
    expect(getByText('집 탐색')).toBeTruthy();
    expect(getByText('# 초대코드로 들어가기')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();

    // 탐색의 뒤로가기 — (빈) 집 화면이 아니라 나의 방으로 복귀.
    await fireEvent.press(getByLabelText('뒤로 가기'));
    await waitFor(() => getByText('오늘의 할 일'));
  });
});

describe('AppShell', () => {
  it('opens on the my-room screen with the bottom nav', async () => {
    const { getByText, getByLabelText, queryByText } = await renderWithProviders(<AppShell />);
    // The room title is gone, including the fallback used before the nickname loads.
    expect(queryByText('내 방')).toBeNull();
    expect(getByText('오늘의 할 일')).toBeTruthy();
    // Bottom nav tabs present.
    expect(getByLabelText('나의 방')).toBeTruthy();
    expect(getByLabelText('집')).toBeTruthy();
    expect(getByLabelText('내 정보')).toBeTruthy();
    expect(getByText('방')).toBeTruthy();
    expect(getByText('내 정보')).toBeTruthy();
  });

  // 엣지 백 오발화 회귀 (#740) — onTouchesDown의 mgr.fail()은 runOnJS라
  // UI 스레드 활성화와 경쟁한다. fail이 늦게 도착한 상황(= jest처럼
  // onTouchesDown 없이 팬이 끝나는 경우)을 재현해, 탭 루트에서는 커밋
  // 시점 가드가 백을 막는지 본다. 막지 못하면 내 정보 → (집 건너뜀) → 방.
  it('탭 루트에서는 엣지 백이 발화해도 화면이 바뀌지 않는다 (#740)', async () => {
    const { getByText, getByLabelText, queryByText } = await renderWithProviders(<AppShell />);
    await fireEvent.press(getByLabelText('내 정보'));
    // '내 정보'는 탭 라벨과 헤더 양쪽에 있어 화면 고유 문구로 단언한다.
    expect(getByText('프로필 편집')).toBeTruthy();

    await act(async () =>
      fireGestureHandler(getByGestureTestId('edge-back-pan'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END, translationX: 200, velocityX: 1200 },
      ]),
    );

    // 내 정보 탭 유지 — 방(나의 방)으로 튀지 않는다.
    expect(getByText('프로필 편집')).toBeTruthy();
    expect(queryByText('오늘의 할 일')).toBeNull();
  });
});

// --- 미션 ↔ 루틴 연동 통합 (#272 → #578): 서버 링크 id 매칭이 셸에서 실제로
// 이어지는지. 루틴 제목은 미션 제목과 다르게 두어 "이름을 바꿔도 연동 유지"를
// 함께 단언한다.
describe('AppShell — 공동미션 연동', () => {
  const calls: ApiCall[] = [];

  const worldFetch = houseWorld(calls, {
    categories: [{ id: 20, name: 'TripleS', houseId: 2 }],
    // 제목은 미션명과 다름 — 연동은 houseMissionId가 판정한다.
    routines: [
      { id: 44, title: '개명한 스트레칭', categoryId: 20, repeatType: 'DAILY', houseMissionId: 6 }, // prettier-ignore
    ],
    missions: [weeklyMission(6, '아침 스트레칭'), weeklyMission(7, '물 마시기')],
    extra: (url, method) => {
      if (method === 'POST' && url.endsWith('/routines'))
        return { id: 99, title: '물 마시기', categoryId: 20, repeatType: 'DAILY', houseMissionId: 7 }; // prettier-ignore
      if (method === 'POST' && url.includes('/routines/44/logs'))
        // 오늘 완료 — 서버가 연동 미션(6)에 자동 기여한 결과가 실려온다 (#578).
        return {
          rewardAmount: 0,
          houseMissionContribution: { missionId: 6, myContribution: 1, currentValue: 1, achieved: false }, // prettier-ignore
        };
      return undefined;
    },
  });

  beforeEach(() => {
    calls.splice(0);
    global.fetch = jest.fn(worldFetch) as unknown as typeof fetch;
  });

  it('완료 시 서버 자동 기여를 반영하고 클라 수동 contribute는 쏘지 않는다 (#578)', async () => {
    const { getByLabelText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));
    const missionFetchesBefore = calls.filter((c) => c.url.includes('/houses/2/missions')).length;

    // 미션명과 다른 제목의 루틴 — id 연동이라 이름이 달라도 이어진다.
    await fireEvent.press(getByLabelText('개명한 스트레칭'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'))).toBe(
        true,
      ),
    );
    // 완료 응답의 기여 결과 반영 → 해당 집만 재동기화(미션 currentValue 갱신).
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/houses/2/missions')).length).toBeGreaterThan(
        missionFetchesBefore,
      ),
    );
    // 수동 기여 왕복은 없다 — 서버가 로그 시점에 이미 기여했다.
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/contribute'))).toBe(false);
  });

  it('blocks un-toggling a linked routine — contributions cannot be revoked', async () => {
    const { getByLabelText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    // 완료(기여) 후 다시 누르면 서버 호출 없이 차단된다 — 제목이 미션명과
    // 달라도 linkedMissionId가 지킨다.
    await fireEvent.press(getByLabelText('개명한 스트레칭'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'))).toBe(
        true,
      ),
    );
    const callsBefore = calls.length;
    await fireEvent.press(getByLabelText('개명한 스트레칭'));
    // Un-complete would be a DELETE on the log — none may fire.
    expect(calls.slice(callsBefore).some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('adding a mission routine reuses the existing house category (no duplicate)', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    // 공동 미션은 요약 줄 → 별도 화면 (#875, 예전엔 FAB → 모달).
    await fireEvent.press(getByLabelText(/우리 집의 목표/));
    await fireEvent.press(getByLabelText('물 마시기 내 루틴에 추가'));
    expect(getByText('내 루틴에 추가하시겠습니까?')).toBeTruthy();
    await fireEvent.press(getByLabelText('루틴 추가 확인'));

    await waitFor(() => {
      const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/routines'));
      const body = JSON.parse(create?.body ?? '{}');
      // houseId 매칭으로 기존 카테고리를 찾고, 생성 요청에 미션 링크 id를 싣는다.
      expect(body.categoryId).toBe(20);
      expect(body.houseMissionId).toBe(7);
    });
    // ensureCategory가 서버 재조회로 기존 TripleS(20)를 재사용 — 중복 생성 없음.
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/categories'))).toBe(false);
  });

  it('미션 삭제 시 연동 루틴도 함께 삭제된다 (#338)', async () => {
    const { getByLabelText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText(/우리 집의 목표/));
    await fireEvent.press(getByLabelText('아침 스트레칭 삭제'));
    await fireEvent.press(getByLabelText('미션 삭제 확인'));

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'DELETE' && c.url.includes('/houses/2/missions/6')),
      ).toBe(true),
    );
    // 미션 6에 연동된(houseMissionId) 루틴 44가 제목과 무관하게 함께 지워진다.
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/44'))).toBe(true),
    );
  });

  it('집 나가기/삭제 시 그 집 미션들의 연동 루틴도 정리된다 (#338)', async () => {
    const { getByLabelText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('집 관리'));
    // 구성원 0명 세계라 1인 방장 = '집 삭제' 라벨.
    await fireEvent.press(getByLabelText(/집 삭제|집 나가기/));
    await fireEvent.press(getByLabelText(/집 삭제 확인|나가기 확인/));

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'DELETE' && c.url.includes('/houses/2/members/me')),
      ).toBe(true),
    );
    // 카테고리 통삭제 — 안의 루틴을 지우고 카테고리 자체도 지운다 (#338).
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/44'))).toBe(true),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/categories/20'))).toBe(
        true,
      ),
    );
  });
});

// --- 미션 목록과 어긋난 잔여 연동 루틴 자동 정리 (#338). ---
describe('AppShell — 연동 루틴 스윕', () => {
  const calls: ApiCall[] = [];

  beforeEach(() => {
    calls.splice(0);
    global.fetch = jest.fn(
      houseWorld(calls, {
        categories: [{ id: 20, name: 'TripleS', houseId: 2 }],
        routines: [
          // 44는 살아있는 미션(6)에 연동, 45는 사라진 미션(99)의 잔여물.
          { id: 44, title: '아침 스트레칭', categoryId: 20, repeatType: 'DAILY', houseMissionId: 6 }, // prettier-ignore
          { id: 45, title: '사라진 미션', categoryId: 20, repeatType: 'DAILY', houseMissionId: 99 }, // prettier-ignore
        ],
        missions: [weeklyMission(6, '아침 스트레칭')],
      }),
    ) as unknown as typeof fetch;
  });

  it('미션이 사라진 연동 루틴은 로드 후 자동 삭제되고, 일치하는 루틴은 남는다', async () => {
    await renderWithProviders(<AppShell />);
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/45'))).toBe(true),
    );
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/44'))).toBe(false);
  });
});

// --- 이름 매칭 연동 승격(#578)은 2026-10-04에 없앴다 — 사용자가 해제한 연동이 다음 실행에 되살아났다. ---
describe('AppShell — 이름 매칭 자동 연동 없음', () => {
  const calls: ApiCall[] = [];

  beforeEach(() => {
    calls.splice(0);
    // 구식 세계: 이름은 맞물리는데(카테고리명 == 집 이름, 루틴명 == 미션명)
    // 링크 id가 없다 — 그래도 부팅 때 연동하지 않는다.
    global.fetch = jest.fn(
      houseWorld(calls, {
        categories: [{ id: 20, name: 'TripleS' }],
        routines: [{ id: 44, title: '아침 스트레칭', categoryId: 20, repeatType: 'DAILY' }],
        // 만료 미션은 승격 대상이 아니다.
        missions: [weeklyMission(6, '아침 스트레칭'), weeklyMission(8, '아침 스트레칭', 'EXPIRED')],
        extra: (url, method) => {
          if (method === 'PUT' && url.includes('/categories/20'))
            return { id: 20, name: 'TripleS', houseId: 2 };
          if (method === 'PUT' && url.includes('/routines/44'))
            return { id: 44, title: '아침 스트레칭', categoryId: 20, repeatType: 'DAILY', houseMissionId: 6 }; // prettier-ignore
          return undefined;
        },
      }),
    ) as unknown as typeof fetch;
  });

  it('이름이 같아도 부팅 때 카테고리·루틴에 링크를 심지 않는다', async () => {
    await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/categories/20'))).toBe(false);
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/routines/44'))).toBe(false);
  });
});

describe('AppShell — 루트 뒤로가기 더블 백 종료 (#522)', () => {
  it('첫 뒤로가기는 토스트 안내, 2초 안에 한 번 더 누르면 종료한다', async () => {
    const handlers: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, cb) => {
      const handler = () => cb() === true;
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) } as never;
    });
    const exitSpy = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});

    const ui = await render(
      <ToastProvider>
        <QueryProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </QueryProvider>
      </ToastProvider>,
    );

    // 첫 입력 — 종료하지 않고 안내 토스트.
    let handled = false;
    await act(async () => {
      handled = handlers.some((h) => h());
    });
    expect(handled).toBe(true);
    expect(ui.getByText('한 번 더 뒤로가면 앱이 꺼져요')).toBeTruthy();
    expect(exitSpy).not.toHaveBeenCalled();

    // 허용 창(2초) 안의 두 번째 입력 — 종료.
    await act(async () => {
      handlers.some((h) => h());
    });
    expect(exitSpy).toHaveBeenCalled();

    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('허용 창이 지나면 다시 안내부터 시작한다', async () => {
    const handlers: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, cb) => {
      const handler = () => cb() === true;
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) } as never;
    });
    const exitSpy = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, 'now');

    const ui = await render(
      <ToastProvider>
        <QueryProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </QueryProvider>
      </ToastProvider>,
    );

    nowSpy.mockReturnValue(1_000_000);
    await act(async () => {
      handlers.some((h) => h());
    });
    // 2초 창을 지나서 누르면 종료 대신 다시 안내.
    nowSpy.mockReturnValue(1_003_500);
    await act(async () => {
      handlers.some((h) => h());
    });
    expect(exitSpy).not.toHaveBeenCalled();
    expect(ui.getByText('한 번 더 뒤로가면 앱이 꺼져요')).toBeTruthy();

    nowSpy.mockRestore();
    spy.mockRestore();
    exitSpy.mockRestore();
  });
});

// 완료 후 재조회 분기 (성능 장부 N2) — 방 성장·캐릭터는 지급 코인을 따르므로 보상 0 완료는
// 달력만 다시 받는다. 보상이 있으면 방·캐릭터도.
describe('AppShell — 완료 후 재조회 (성능 장부 N2)', () => {
  const json = (body: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  let calls: { url: string; method: string }[] = [];
  let reward = 0;
  const worldFetch = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('/auth/')) return json({ accessToken: 't', refreshToken: 'r' });
    if (method === 'POST' && url.includes('/routines/44/logs'))
      return json({ rewardAmount: reward, rewardCurrencyType: 'COIN' });
    if (url.includes('/categories')) return json({ items: [{ id: 20, name: '건강' }] });
    if (url.endsWith('/routines'))
      return json({ items: [{ id: 44, title: '스트레칭', categoryId: 20, repeatType: 'DAILY' }] });
    if (url.endsWith('/today')) return json({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return json({ userId: 4, nickname: '준서' });
    return json({ items: [] });
  };
  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(worldFetch) as unknown as typeof fetch;
  });

  const completeAndCollect = async () => {
    const { getByLabelText } = await renderWithProviders(<AppShell />);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/rooms/me'))).toBe(true));
    await fireEvent.press(getByLabelText('스트레칭'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'))).toBe(
        true,
      ),
    );
    const at = calls.findIndex((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'));
    // 무효화가 붙인 재조회까지 기다린다(달력은 어느 경우든 다시 받는다).
    await waitFor(() =>
      expect(calls.slice(at).some((c) => c.url.includes('/calendar'))).toBe(true),
    );
    return calls.slice(at + 1).filter((c) => c.method === 'GET');
  };

  it('보상 0 완료 — 방·캐릭터·지갑은 다시 받지 않는다', async () => {
    reward = 0;
    const after = await completeAndCollect();
    expect(after.some((c) => c.url.includes('/rooms/me'))).toBe(false);
    expect(after.some((c) => c.url.includes('/me/characters'))).toBe(false);
    expect(after.some((c) => c.url.includes('/wallets'))).toBe(false);
  });

  it('보상 있는 완료 — 방은 다시 받고, 지갑은 응답으로 반영해 받지 않는다', async () => {
    reward = 10;
    const after = await completeAndCollect();
    const at = calls.findIndex((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'));
    await waitFor(() =>
      expect(
        calls.slice(at + 1).some((c) => c.method === 'GET' && c.url.includes('/rooms/me')),
      ).toBe(true),
    );
    expect(after.some((c) => c.url.includes('/wallets'))).toBe(false);
  });
});
