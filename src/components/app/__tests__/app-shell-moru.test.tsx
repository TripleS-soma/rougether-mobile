import { fireEvent, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { renderWithProviders } from '@/test-utils/render';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

it('lets a Moru owner choose the reward while preserving the current character until tapped', async () => {
  const selectBodies: unknown[] = [];
  const frames = ['idle', 'wave', 'pose-cycle', 'lying'].map((motion, i) => ({
    id: i + 1,
    sortOrder: (i + 1) * 10,
    assetKey: `characters/moru/animations/${motion}.webp`,
  }));
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    let body: unknown = { items: [] };
    if (url.endsWith('/today')) body = { categories: [], summary: {}, streak: {} };
    if (url.endsWith('/me/characters')) {
      body = {
        items: [
          { characterId: 7, code: 'cat', name: '고양이', selected: true },
          { characterId: 10, code: 'moru', name: '모루', poses: frames, selected: false },
        ],
      };
    }
    if (url.endsWith('/me/characters/select')) {
      selectBodies.push(JSON.parse(String(init?.body)));
      body = { selectedCharacterId: 10 };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  }) as unknown as typeof fetch;
  const view = await renderWithProviders(<AppShell />);
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/me/characters'),
      expect.anything(),
    ),
  );
  expect(selectBodies).toEqual([]);
  await fireEvent.press(view.getByLabelText('메뉴'));
  await waitFor(() => expect(view.getByText('캐릭터 교체')).toBeTruthy());
  await fireEvent.press(view.getByText('캐릭터 교체'));
  await fireEvent.press(view.getByLabelText('모루 착용'));
  await waitFor(() => expect(selectBodies).toEqual([{ characterId: 10 }]));
  await waitFor(() =>
    expect(
      view
        .getAllByTestId('cdn-animation')
        .some((node) => node.props.source[0].uri.includes('characters/moru/animations/idle.webp')),
    ).toBe(true),
  );
});

it('keeps the picker hidden when the reward has not been granted', async () => {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify(
        url.endsWith('/today')
          ? { categories: [], summary: {}, streak: {} }
          : url.endsWith('/me/characters')
            ? { items: [{ characterId: 7, code: 'cat', name: '고양이', selected: true }] }
            : { items: [] },
      ),
  })) as unknown as typeof fetch;
  const view = await renderWithProviders(<AppShell />);
  await fireEvent.press(view.getByLabelText('메뉴'));
  expect(view.queryByText('캐릭터 교체')).toBeNull();
});
