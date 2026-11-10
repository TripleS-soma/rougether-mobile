import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useGachaSurface } from '@/components/app/use-gacha-surface';
import { ToastProvider } from '@/components/ui/toast';
import { queryKeys } from '@/lib/query-keys';
import { createQueryClient } from '@/lib/query-client';
import { queryWrapper } from '@/test-utils/query-wrapper';
import { jsonRes } from '@/test-utils/fetch';

jest.mock('@/components/screens/gacha-screen', () => ({ GachaScreen: () => null }));
jest.mock('@/hooks/use-starter-gacha', () => ({
  useStarterGacha: () => ({
    unavailable: true,
    state: undefined,
    loading: false,
    error: false,
    retry: jest.fn(),
    draw: jest.fn(),
  }),
}));
const ActualGachaScreen = jest.requireActual('@/components/screens/gacha-screen').GachaScreen;
const catalogue = [
  { gachaId: 101, code: 'wallpaper_gacha', category: 'WALLPAPER' as const, costAmount: 25 },
  { gachaId: 102, code: 'floor_gacha', category: 'FLOOR' as const, costAmount: 25 },
  { gachaId: 103, code: 'furniture_gacha', category: 'FURNITURE' as const, costAmount: 25 },
];
const args = {
  screen: 'gacha' as 'gacha' | 'myRoom',
  initialMachineId: undefined as number | undefined,
  wallet: { coin: 5600, diamond: 120 },
  characterUnlocked: true,
  characterUnlockLevel: 10,
  starterFlow: false,
  soundEffectsEnabled: false,
  goBack: jest.fn(),
  placeableFurnitureIds: [],
  goPlaceDrawn: jest.fn(),
  onFirstDrawConfirmed: jest.fn(),
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
function Harness(props: typeof args) {
  const { subScreen } = useGachaSurface(props);
  return (
    <ToastProvider>{subScreen ? <ActualGachaScreen {...subScreen.props} /> : null}</ToastProvider>
  );
}

it('keeps ordinary caching, then refetches on the event CTA and cannot draw a fallback while verifying', async () => {
  let active = false;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return jsonRes({ results: [] });
    if (url.includes('catalog=category')) return jsonRes({ items: catalogue });
    if (!active) return jsonRes({ items: [] });
    await pending;
    return jsonRes({ items: [{ gachaId: 812, code: 'christmas_2026', costAmount: 47 }] });
  }) as unknown as typeof fetch;
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, gcTime: Infinity },
    mutations: { gcTime: Infinity },
  });
  const ui = await render(<Harness {...args} />, { wrapper: queryWrapper(client) });
  await waitFor(() => expect(ui.getByLabelText('1회 뽑기, 25 코인')).toBeEnabled());
  expect(global.fetch).toHaveBeenCalledTimes(2);
  await ui.rerender(<Harness {...args} screen="myRoom" />);
  await ui.rerender(<Harness {...args} />);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  await ui.rerender(<Harness {...args} screen="myRoom" />);
  active = true;
  await ui.rerender(<Harness {...args} initialMachineId={812} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
  expect(ui.getByLabelText('1회 뽑기, 25 코인')).toBeDisabled();
  await fireEvent.press(ui.getByLabelText('1회 뽑기, 25 코인'));
  expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false,
  );
  await act(async () => finish());
  await waitFor(() => expect(ui.getByLabelText('1회 뽑기, 47 코인')).toBeEnabled());
  expect(ui.getByRole('tab', { name: '크리스마스' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(ui.getByLabelText('1회 뽑기, 47 코인'));
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/gacha\/812\/draw$/),
    expect.objectContaining({ method: 'POST' }),
  );
  expect(
    (global.fetch as jest.Mock).mock.calls.some(
      ([url, init]) => init?.method === 'POST' && url.endsWith('/103/draw'),
    ),
  ).toBe(false);
  await ui.unmount();
  client.clear();
});

it('recovers a failed fresh-catalogue request with one explicit retry before enabling the requested draw', async () => {
  let failed = true;
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('catalog=category'))
      return failed ? jsonRes({}, 503) : jsonRes({ items: catalogue });
    return jsonRes({ items: [{ gachaId: 812, code: 'christmas_2026', costAmount: 47 }] });
  }) as unknown as typeof fetch;
  const client = createQueryClient();
  client.setQueryDefaults(queryKeys.gachas, {
    staleTime: 60 * 60_000,
    retry: false,
    gcTime: Infinity,
  });
  client.setQueryData(queryKeys.gachas, catalogue);
  const ui = await render(<Harness {...args} initialMachineId={812} />, {
    wrapper: queryWrapper(client),
  });
  const retry = await ui.findByText('다시 시도');
  expect(ui.queryByLabelText('1회 뽑기, 25 코인')).toBeNull();
  failed = false;
  await fireEvent.press(retry);
  await waitFor(() => expect(ui.getByLabelText('1회 뽑기, 47 코인')).toBeEnabled());
  expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false,
  );
  await ui.unmount();
  client.clear();
});
