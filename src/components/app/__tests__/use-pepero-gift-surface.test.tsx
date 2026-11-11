import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId, type LoginGift } from '@/api';
import { usePeperoGiftSurface } from '@/components/app/use-pepero-gift-surface';
import { usePeperoGift } from '@/hooks/use-pepero-gift';

jest.mock('@/api', () => ({ ...jest.requireActual('@/api'), getSessionUserId: jest.fn(() => 7) }));
jest.mock('@/hooks/use-pepero-gift');
jest.mock('@/components/screens/events/pepero-gift-popup', () => ({ PeperoGiftPopup: () => null }));
const gift: LoginGift = {
  participationId: 62,
  code: 'PEPERO_DAY_20261111',
  title: '빼빼로데이',
  eligibleAt: '2026-11-11T00:00:00+09:00',
  grantedAt: '2026-11-11T00:00:01+09:00',
  acknowledgedAt: null,
  coinAmount: 111,
  reward: { itemId: 238, name: '11:11 소원 관측기', assetKey: 'wish.png', userItemId: 900 },
};
const state = { gift, inWindow: true, loading: false, dismissing: false, acknowledge: jest.fn() };
const args = { home: true, ready: true, blocked: false, onGoDecor: jest.fn() };
const props = (value: ReturnType<typeof usePeperoGiftSurface>) => value.overlay!.props;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSessionUserId).mockReturnValue(7);
  state.acknowledge.mockResolvedValue(true);
  jest.mocked(usePeperoGift).mockReturnValue(state);
});

it('waits behind another modal and navigates exactly once after the native dismissal', async () => {
  const { result, rerender } = await renderHook(
    (input: typeof args) => usePeperoGiftSurface(input),
    {
      initialProps: { ...args, blocked: true },
    },
  );
  expect(result.current.overlay).toBeNull();
  await rerender(args);
  await waitFor(() => expect(props(result.current).visible).toBe(true));
  await act(async () => props(result.current).onGoDecor(false));
  expect(args.onGoDecor).not.toHaveBeenCalled();
  expect(state.acknowledge).not.toHaveBeenCalled();
  const dismissed = props(result.current).onDismissed;
  await act(async () => dismissed());
  expect(args.onGoDecor).toHaveBeenCalledTimes(1);
  await act(async () => dismissed());
  expect(args.onGoDecor).toHaveBeenCalledTimes(1);
  await rerender(args);
  expect(result.current.overlay).toBeNull();
});

it('retains the popup on acknowledgement failure and retries without paying again', async () => {
  state.acknowledge.mockResolvedValueOnce(false);
  const { result } = await renderHook(() => usePeperoGiftSurface(args));
  await waitFor(() => expect(props(result.current).visible).toBe(true));
  await act(async () => props(result.current).onClose(true));
  expect(props(result.current)).toMatchObject({ error: true, visible: true });
  await act(async () => props(result.current).onClose(true));
  expect(props(result.current).visible).toBe(false);
  expect(state.acknowledge).toHaveBeenCalledTimes(2);
});

it('does not show acknowledged gifts or a missing receipt', async () => {
  jest
    .mocked(usePeperoGift)
    .mockReturnValue({ ...state, gift: { ...gift, acknowledgedAt: gift.grantedAt } });
  const { result, rerender } = await renderHook(() => usePeperoGiftSurface(args));
  expect(result.current.overlay).toBeNull();
  jest.mocked(usePeperoGift).mockReturnValue({ ...state, gift: null });
  await rerender({});
  expect(result.current.overlay).toBeNull();
});

it('drops delayed account A dismissal and navigation after switching to B', async () => {
  let finish!: (saved: boolean) => void;
  state.acknowledge.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result, rerender } = await renderHook(() => usePeperoGiftSurface(args));
  await waitFor(() => expect(props(result.current).visible).toBe(true));
  let pending!: Promise<void>;
  await act(async () => {
    pending = props(result.current).onGoDecor(true);
  });
  jest.mocked(getSessionUserId).mockReturnValue(8);
  jest.mocked(usePeperoGift).mockReturnValue({ ...state, gift: null });
  await rerender({});
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(result.current.overlay).toBeNull();
  expect(args.onGoDecor).not.toHaveBeenCalled();
});
