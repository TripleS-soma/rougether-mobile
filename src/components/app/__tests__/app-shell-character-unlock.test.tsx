import { fireEvent, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { renderWithProviders } from '@/test-utils/render';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

/**
 * 캐릭터 교체는 방 레벨 10에 열린다 (2026-10-14) — 판정은 서버 내 방 응답 `characterUnlocked`.
 * 예전엔 레벨 5 보상 모루를 가지면 열렸는데, 모루는 제거됐다.
 */
function mockServer(room: Record<string, unknown>, selectBodies: unknown[] = []) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    let body: unknown = { items: [] };
    if (url.endsWith('/today')) body = { categories: [], summary: {}, streak: {} };
    if (url.endsWith('/rooms/me')) body = room;
    if (url.endsWith('/me/characters')) {
      body = {
        items: [
          { characterId: 1, code: 'cat', name: '고양이', selected: true },
          { characterId: 2, code: 'dog', name: '강아지', selected: false },
          // 서버는 모루 보유 기록을 남긴다 — 앱 목록에는 나오면 안 된다.
          { characterId: 10, code: 'moru', name: '모루', selected: false },
        ],
      };
    }
    if (url.endsWith('/me/characters/select')) {
      selectBodies.push(JSON.parse(String(init?.body)));
      body = { selectedCharacterId: 2 };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  }) as unknown as typeof fetch;
}

it('opens the picker at room level 10 and hides the removed Moru', async () => {
  const selectBodies: unknown[] = [];
  mockServer({ growthLevel: 10, characterUnlocked: true, characterUnlockLevel: 10 }, selectBodies);
  const view = await renderWithProviders(<AppShell />);
  await fireEvent.press(view.getByLabelText('메뉴'));
  await waitFor(() => expect(view.getByText('캐릭터 교체')).toBeTruthy());
  await fireEvent.press(view.getByText('캐릭터 교체'));
  await waitFor(() => expect(view.getByLabelText('강아지 착용')).toBeTruthy());
  expect(view.queryByLabelText('모루 착용')).toBeNull();
  await fireEvent.press(view.getByLabelText('강아지 착용'));
  await waitFor(() => expect(selectBodies).toEqual([{ characterId: 2 }]));
});

it('shows a locked menu item below level 10 that explains when it opens', async () => {
  const selectBodies: unknown[] = [];
  mockServer({ growthLevel: 4, characterUnlocked: false, characterUnlockLevel: 10 }, selectBodies);
  // 잠금 안내는 토스트로 뜬다 — 토스트를 그리는 Provider가 있어야 보인다.
  const view = await renderWithProviders(
    <ToastProvider>
      <AppShell />
    </ToastProvider>,
  );
  await fireEvent.press(view.getByLabelText('메뉴'));
  await waitFor(() => expect(view.getByText('캐릭터 교체')).toBeTruthy());
  await fireEvent.press(view.getByText('캐릭터 교체'));
  await waitFor(() => expect(view.getByText('캐릭터 교체는 방 레벨 10에 열려요')).toBeTruthy());
  expect(view.queryByLabelText('강아지 착용')).toBeNull();
  expect(selectBodies).toEqual([]);
});
