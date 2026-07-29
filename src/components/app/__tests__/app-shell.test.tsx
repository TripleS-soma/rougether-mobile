import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { AppShell } from '@/components/app/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';

// 푸시 탭 콜백을 붙잡아 테스트에서 직접 발화한다 (#405).
let notificationTapCb: (() => void) | null = null;
jest.mock('@/lib/push-events', () => ({
  onNotificationTap: (cb: () => void) => {
    notificationTapCb = cb;
    return () => {
      notificationTapCb = null;
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

describe('AppShell — 푸시 탭 라우팅 (#405)', () => {
  it('알림 탭 콜백이 발화하면 알림 목록 화면으로 이동한다', async () => {
    const { getByText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    expect(notificationTapCb).toBeTruthy();

    await act(async () => notificationTapCb?.());

    await waitFor(() => getByText('알림'));
  });
});

describe('AppShell — 온보딩 미션 체인 (#571)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  // 미션 1(루틴 등록) 성공 왕복이 있는 세계 — 추천 루틴이 붙을 카테고리 포함.
  const missionFetch = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body =
      method === 'POST' && url.endsWith('/routines')
        ? { id: 99, title: '독서 30분', categoryId: 20, repeatType: 'DAILY' }
        : url.includes('/auth/')
          ? { accessToken: 't', refreshToken: 'r' }
          : url.includes('/categories')
            ? { items: [{ id: 20, name: '취미' }] }
            : url.endsWith('/today')
              ? { categories: [], summary: {}, streak: {} }
              : { items: [] };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };

  it('startMissions면 미션 1 배너가 뜨고, 배너 탭이 루틴 추가 화면으로 보낸다', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(
      <AuthProvider>
        <AppShell startMissions />
      </AuthProvider>,
    );
    await waitFor(() => getByTestId('mission-banner'));
    expect(getByText('미션 1/4')).toBeTruthy();
    expect(getByText('첫 루틴 등록하기')).toBeTruthy();

    await fireEvent.press(getByLabelText('미션 1 첫 루틴 등록하기'));
    await waitFor(() => getByText('루틴 추가'));
  });

  it('루틴 등록 성공 → 완료 시트 → 하러 가기로 미션 2(뽑기)로 이어진다', async () => {
    global.fetch = jest.fn(missionFetch) as unknown as typeof fetch;
    const { getByText, getByTestId, getByLabelText } = await render(
      <AuthProvider>
        <AppShell startMissions />
      </AuthProvider>,
    );
    await waitFor(() => getByTestId('mission-banner'));

    // 배너 → 루틴 추가 화면에서 추천 루틴으로 등록.
    await fireEvent.press(getByLabelText('미션 1 첫 루틴 등록하기'));
    await fireEvent.press(getByText('추천 루틴'));
    await fireEvent.press(getByText('독서 30분'));
    await fireEvent.press(getByText('월'));
    await fireEvent.press(getByText('루틴 추가하기'));

    // 완료 전환 시트 — 다음 미션 안내와 하러 가기.
    await waitFor(() => getByText('✅ 미션 1 완료!'));
    expect(getByText('다음 미션: 뽑기 1회 해보기')).toBeTruthy();
    await fireEvent.press(getByLabelText('다음 미션 하러 가기'));
    await waitFor(() => getByText('미션 2/4'));
    expect(getByText('뽑기 1회 해보기')).toBeTruthy();
  });

  it('건너뛰기는 확인을 거쳐 배너를 없애고, startMissions 없으면 배너가 없다', async () => {
    const off = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await act(async () => {});
    expect(off.queryByTestId('mission-banner')).toBeNull();

    const on = await render(
      <AuthProvider>
        <AppShell startMissions />
      </AuthProvider>,
    );
    await waitFor(() => on.getByTestId('mission-banner'));
    await fireEvent.press(on.getByLabelText('미션 건너뛰기'));
    await fireEvent.press(on.getByLabelText('미션 건너뛰기 확인'));
    await waitFor(() => expect(on.queryByTestId('mission-banner')).toBeNull());
    // 스킵 플래그 영속 — 다음 시작에 다시 시작하지 않는다.
    expect(await AsyncStorage.getItem('rougether.onboarding-missions.v1')).toBe('skipped');
  });
});

describe('AppShell', () => {
  it('opens on the my-room screen with the bottom nav', async () => {
    const { getByText, getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    expect(getByText('준서의 방')).toBeTruthy(); // MyRoomScreen default
    expect(getByText('오늘의 루틴')).toBeTruthy();
    // Bottom nav tabs present.
    expect(getByLabelText('나의 방')).toBeTruthy();
    expect(getByLabelText('집')).toBeTruthy();
    expect(getByLabelText('설정')).toBeTruthy();
  });
});

// --- 미션 ↔ 루틴 연동 통합 (#272): 이름 기반 매칭이 셸에서 실제로 이어지는지. ---
describe('AppShell — 공동미션 연동', () => {
  const json = (body: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  let calls: { url: string; method: string; body?: string }[] = [];

  const worldFetch = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/auth/')) return json({ accessToken: 't', refreshToken: 'r' });
    if (method === 'POST' && url.includes('/missions/6/contribute'))
      return json({ missionId: 6, myContribution: 1, currentValue: 1, achieved: false });
    if (method === 'POST' && url.endsWith('/routines'))
      return json({ id: 99, title: '물 마시기', categoryId: 20, repeatType: 'DAILY' });
    if (method === 'POST' && url.includes('/routines/44/logs')) return json({ rewardAmount: 0 });
    if (url.includes('/categories')) return json({ items: [{ id: 20, name: 'TripleS' }] });
    if (url.endsWith('/routines'))
      return json({
        items: [{ id: 44, title: '아침 스트레칭', categoryId: 20, repeatType: 'DAILY' }],
      });
    if (url.endsWith('/me/houses')) return json({ items: [{ houseId: 2, name: 'TripleS' }] });
    if (url.includes('/houses/2/missions'))
      return json({
        items: [
          {
            missionId: 6,
            title: '아침 스트레칭',
            missionType: 'WEEKLY_MEMBER_COUNT',
            targetValue: 5,
            currentValue: 0,
            status: 'ACTIVE',
          },
          {
            missionId: 7,
            title: '물 마시기',
            missionType: 'WEEKLY_MEMBER_COUNT',
            targetValue: 5,
            currentValue: 0,
            status: 'ACTIVE',
          },
        ],
      });
    if (url.includes('/houses/2/members')) return json({ items: [] });
    if (url.includes('/houses/2')) return json({ houseId: 2, name: 'TripleS', myRole: 'OWNER' });
    if (url.endsWith('/today')) return json({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return json({ userId: 4, nickname: '준서' });
    return json({ items: [] });
  };

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(worldFetch) as unknown as typeof fetch;
  });

  it('completing a house-category routine auto-contributes to the matching mission', async () => {
    const { getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    // 이름 매칭에 houses가 필요 — 집 상세까지 로드된 뒤에 완료를 누른다.
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('아침 스트레칭'));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'POST' && c.url.includes('/houses/2/missions/6/contribute')),
      ).toBe(true),
    );
  });

  it('blocks un-toggling a linked routine — contributions cannot be revoked', async () => {
    const { getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    // 완료(기여) 후 다시 누르면 서버 호출 없이 차단된다.
    await fireEvent.press(getByLabelText('아침 스트레칭'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url.includes('/routines/44/logs'))).toBe(
        true,
      ),
    );
    const callsBefore = calls.length;
    await fireEvent.press(getByLabelText('아침 스트레칭'));
    // Un-complete would be a DELETE on the log — none may fire.
    expect(calls.slice(callsBefore).some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('adding a mission routine reuses the existing house category (no duplicate)', async () => {
    const { getByLabelText, getByText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    // 공동 미션은 플로팅 버튼 → 시트 (#287).
    await fireEvent.press(getByLabelText('공동 미션'));
    await fireEvent.press(getByLabelText('물 마시기 내 루틴에 추가'));
    expect(getByText('내 루틴에 추가하시겠습니까?')).toBeTruthy();
    await fireEvent.press(getByLabelText('루틴 추가 확인'));

    await waitFor(() => {
      const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/routines'));
      expect(JSON.parse(create?.body ?? '{}').categoryId).toBe(20);
    });
    // ensureCategory가 서버 재조회로 기존 TripleS(20)를 재사용 — 중복 생성 없음.
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/categories'))).toBe(false);
  });

  it('미션 삭제 시 연동 루틴도 함께 삭제된다 (#338)', async () => {
    const { getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('공동 미션'));
    await fireEvent.press(getByLabelText('아침 스트레칭 삭제'));
    await fireEvent.press(getByLabelText('미션 삭제 확인'));

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'DELETE' && c.url.includes('/houses/2/missions/6')),
      ).toBe(true),
    );
    // 미션 제목과 같은 TripleS 카테고리 루틴(44)이 함께 지워진다.
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/44'))).toBe(true),
    );
  });

  it('집 나가기/삭제 시 그 집 미션들의 연동 루틴도 정리된다 (#338)', async () => {
    const { getByLabelText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
    await fireEvent.press(getByLabelText('구성원 목록'));
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
  const json = (body: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  let calls: { url: string; method: string }[] = [];

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.includes('/auth/')) return json({ accessToken: 't', refreshToken: 'r' });
      if (url.includes('/categories')) return json({ items: [{ id: 20, name: 'TripleS' }] });
      if (url.endsWith('/routines'))
        return json({
          items: [
            // 44는 살아있는 미션과 제목 일치, 45는 미션이 사라진 잔여물.
            { id: 44, title: '아침 스트레칭', categoryId: 20, repeatType: 'DAILY' },
            { id: 45, title: '사라진 미션', categoryId: 20, repeatType: 'DAILY' },
          ],
        });
      if (url.endsWith('/me/houses')) return json({ items: [{ houseId: 2, name: 'TripleS' }] });
      if (url.includes('/houses/2/missions'))
        return json({
          items: [
            {
              missionId: 6,
              title: '아침 스트레칭',
              missionType: 'WEEKLY_MEMBER_COUNT',
              targetValue: 5,
              currentValue: 0,
              status: 'ACTIVE',
            },
          ],
        });
      if (url.includes('/houses/2/members')) return json({ items: [] });
      if (url.includes('/houses/2')) return json({ houseId: 2, name: 'TripleS', myRole: 'OWNER' });
      if (url.endsWith('/today')) return json({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return json({ userId: 4, nickname: '준서' });
      return json({ items: [] });
    }) as unknown as typeof fetch;
  });

  it('미션이 사라진 연동 루틴은 로드 후 자동 삭제되고, 일치하는 루틴은 남는다', async () => {
    await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/45'))).toBe(true),
    );
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/routines/44'))).toBe(false);
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
        <AuthProvider>
          <AppShell />
        </AuthProvider>
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
        <AuthProvider>
          <AppShell />
        </AuthProvider>
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
