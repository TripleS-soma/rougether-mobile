import { renderHook } from '@testing-library/react-native';

import { toGachaMachine } from '@/api/adapters';
import { useGachaSurface } from '@/components/app/use-gacha-surface';
import { useGacha } from '@/hooks/use-gacha';
import { useStarterGacha } from '@/hooks/use-starter-gacha';

jest.mock('@/components/screens/gacha-screen', () => ({ GachaScreen: () => null }));
jest.mock('@/hooks/use-gacha');
jest.mock('@/hooks/use-starter-gacha');

const floor = toGachaMachine({ gachaId: 95, code: 'floor_gacha', costAmount: 90 });
const christmas = toGachaMachine({ gachaId: 812, code: 'christmas_2026', costAmount: 47 });
const props = {
  screen: 'gacha' as const,
  wallet: { coin: 500, diamond: 10 },
  characterUnlocked: true,
  characterUnlockLevel: 10,
  starterFlow: false,
  soundEffectsEnabled: false,
  goBack: jest.fn(),
  placeableFurnitureIds: [],
  goPlaceDrawn: jest.fn(),
  onFirstDrawConfirmed: jest.fn(),
};

beforeEach(() => {
  jest.mocked(useGacha).mockReturnValue({
    gachas: [floor, christmas],
    loading: false,
    error: false,
    retry: jest.fn(),
    draw: jest.fn(),
  });
  jest.mocked(useStarterGacha).mockReturnValue({
    state: undefined,
    unavailable: false,
    loading: false,
    error: false,
    retry: jest.fn(),
    draw: jest.fn(),
  } as ReturnType<typeof useStarterGacha>);
});

it('uses the actual response machine and bundled Christmas presentation', async () => {
  const { result } = await renderHook(() => useGachaSurface(props));
  const screen = result.current.subScreen!;
  expect(screen.props.seasonalGacha).toMatchObject({
    machine: { id: 812, costAmount: 47 },
    title: '크리스마스',
    endsLabel: '12.25까지',
  });
  expect(screen.props.seasonalGacha.machine).toBe(christmas);
  expect(screen.props.gachas).toEqual([floor, christmas]);
});

it('does not invent a seasonal tab when no live Christmas machine was returned', async () => {
  jest.mocked(useGacha).mockReturnValue({
    gachas: [floor],
    loading: false,
    error: false,
    retry: jest.fn(),
    draw: jest.fn(),
  });
  const { result } = await renderHook(() => useGachaSurface(props));
  expect(result.current.subScreen!.props.seasonalGacha).toBeUndefined();
  expect(result.current.subScreen!.props.gachas).toEqual([floor]);
});

it('keeps the free starter flow separate from live seasonal and paid machines', async () => {
  const { result } = await renderHook(() => useGachaSurface({ ...props, starterFlow: true }));
  const screen = result.current.subScreen!;
  expect(screen.props.seasonalGacha).toBeUndefined();
  expect(screen.props.gachas).toHaveLength(1);
  expect(screen.props.gachas[0]).toMatchObject({ id: -1, costAmount: 0 });
  expect(screen.props.onLoadRewards).toBeUndefined();
});
