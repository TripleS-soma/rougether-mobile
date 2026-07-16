import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { AuthProvider } from '@/hooks/use-auth';

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

  it('adding a mission routine reuses the existing house category (no duplicate)', async () => {
    const { getByLabelText, getByText } = await render(
      <AuthProvider>
        <AppShell />
      </AuthProvider>,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('/houses/2/missions'))).toBe(true));

    await fireEvent.press(getByLabelText('집'));
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
});
