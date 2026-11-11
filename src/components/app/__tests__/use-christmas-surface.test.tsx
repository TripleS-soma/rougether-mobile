import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useChristmasSurface } from '@/components/app/use-christmas-surface';
import { getSessionUserId } from '@/api';
import { todayIso } from '@/utils/datetime';
import { useChristmasEvent } from '@/hooks/use-christmas-event';

jest.mock('@/api', () => ({ ...jest.requireActual('@/api'), getSessionUserId: jest.fn(() => 7) }));
jest.mock('@/hooks/use-christmas-event');
jest.mock('@/utils/datetime', () => ({
  ...jest.requireActual('@/utils/datetime'),
  todayIso: jest.fn(() => '2026-11-09'),
}));
jest.mock('@/components/screens/christmas/christmas-attendance-modal', () => ({
  ChristmasAttendanceModal: () => null,
}));
jest.mock('@/components/screens/christmas/christmas-event-popup', () => ({
  ChristmasEventPopup: () => null,
}));

const event = {
  active: true,
  popupDismissed: false,
  gachaId: 812,
  title: '크리스마스',
  endsOn: '2026-12-25',
};
const status = { availableToday: true, completed: false, progressDays: 4, targetDays: 30 };
const state = {
  event,
  status,
  fetching: false,
  loaded: true,
  freshForToday: true,
  loading: false,
  error: false,
  checkingIn: false,
  dismissing: false,
  refresh: jest.fn(),
  checkIn: jest.fn(),
  claimCharacter: jest.fn(),
  dismissPopup: jest.fn(),
};
const args = { home: true, ready: true, blocked: false, onGoGacha: jest.fn() };
const props = (value: ReturnType<typeof useChristmasSurface>, index: number) =>
  value.overlays.props.children[index].props;
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(todayIso).mockReturnValue('2026-11-09');
  jest.mocked(getSessionUserId).mockReturnValue(7);
  state.refresh.mockResolvedValue(null);
  jest
    .mocked(useChristmasEvent)
    .mockReturnValue(state as unknown as ReturnType<typeof useChristmasEvent>);
});

it('opens attendance first and waits for full dismissal before the announcement, ignoring repeated callbacks', async () => {
  const { result } = await renderHook(() => useChristmasSurface(args));
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  expect(props(result.current, 1).visible).toBe(false);
  await act(async () => props(result.current, 0).onClose());
  expect(props(result.current, 1).visible).toBe(false);
  const dismissed = props(result.current, 0).onDismissed;
  await act(async () => dismissed());
  await waitFor(() => expect(props(result.current, 1).visible).toBe(true));
  await act(async () => dismissed());
  expect(props(result.current, 1).visible).toBe(true);
});

it('defers behind onboarding, permissions and ordinary sheets and never bypasses a status fetch', async () => {
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    {
      initialProps: { ...args, blocked: true },
    },
  );
  expect(result.current.active).toBe(false);
  await rerender({ ...args, blocked: false });
  await waitFor(() => expect(result.current.active).toBe(true));
});

it('skips checked-in attendance while respecting permanent popup dismissal and manual entry', async () => {
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: { ...event, popupDismissed: true },
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  const { result } = await renderHook(() => useChristmasSurface(args));
  expect(result.current.active).toBe(false);
  await act(async () => result.current.open());
  expect(props(result.current, 0).visible).toBe(true);
  expect(props(result.current, 1).visible).toBe(false);
  expect(state.refresh).toHaveBeenCalled();
});

it('keeps dismissal failures in the same popup and navigates only after it has fully closed', async () => {
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  state.dismissPopup.mockResolvedValue(false);
  const { result } = await renderHook(() => useChristmasSurface(args));
  await waitFor(() => expect(props(result.current, 1).visible).toBe(true));
  await act(async () => props(result.current, 1).onClose(true));
  expect(props(result.current, 1)).toMatchObject({ visible: true, error: true });
  await act(async () => props(result.current, 1).onGoEvent(false));
  expect(props(result.current, 0).visible).toBe(false);
  expect(args.onGoGacha).not.toHaveBeenCalled();
  await act(async () => props(result.current, 1).onDismissed());
  expect(args.onGoGacha).toHaveBeenCalledWith(812);
});

it('refreshes yesterday cached attendance before consuming a new KST home-entry queue', async () => {
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: { ...event, popupDismissed: true },
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: args },
  );
  expect(result.current.active).toBe(false);
  await rerender({ ...args, home: false });
  jest.mocked(todayIso).mockReturnValue('2026-11-10');
  let finish!: () => void;
  state.refresh.mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve(null);
    }),
  );
  await rerender(args);
  expect(result.current.active).toBe(false);
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: { ...event, popupDismissed: true },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  await act(async () => finish());
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
});

it('clears an old account modal and ignores its delayed reward when the account changes', async () => {
  let finish!: () => void;
  state.checkIn.mockReturnValue(
    new Promise((resolve) => {
      finish = () =>
        resolve({
          result: {
            newCheckIn: true,
            coinRewardAmount: 60,
            status: { checkedInToday: true, checkInDates: ['2026-11-09'] },
          },
          recovered: false,
        });
    }),
  );
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: args },
  );
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  let action!: Promise<void>;
  await act(() => {
    action = props(result.current, 0).onCheckIn();
  });
  jest.mocked(getSessionUserId).mockReturnValue(8);
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: null,
    status: null,
    loaded: false,
    loading: true,
  } as unknown as ReturnType<typeof useChristmasEvent>);
  await rerender(args);
  await act(async () => {
    finish();
    await action;
  });
  expect(result.current.active).toBe(false);
  expect(props(result.current, 0)).toMatchObject({ visible: false, result: null });
  expect(props(result.current, 1).visible).toBe(false);
});

it('ignores an old account popup dismissal failure after the modal queue is reset', async () => {
  let finish!: () => void;
  state.dismissPopup.mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve(false);
    }),
  );
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: args },
  );
  await waitFor(() => expect(props(result.current, 1).visible).toBe(true));
  let action!: Promise<void>;
  await act(() => {
    action = props(result.current, 1).onClose(true);
  });
  jest.mocked(getSessionUserId).mockReturnValue(8);
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: null,
    status: null,
    loaded: false,
    loading: true,
  } as unknown as ReturnType<typeof useChristmasEvent>);
  await rerender(args);
  await act(async () => {
    finish();
    await action;
  });
  expect(result.current.active).toBe(false);
  expect(props(result.current, 1)).toMatchObject({ visible: false, error: false });
});

it('does not consume the KST day while inactive and opens after same-day activation is refetched', async () => {
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: { ...event, active: false },
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: args },
  );
  expect(result.current.active).toBe(false);
  expect(props(result.current, 0).visible).toBe(false);
  expect(props(result.current, 1).visible).toBe(false);
  jest
    .mocked(useChristmasEvent)
    .mockReturnValue(state as unknown as ReturnType<typeof useChristmasEvent>);
  await rerender(args);
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  expect(props(result.current, 1).visible).toBe(false);
});

it('does not consume the day when an inactive event is opened and closed manually before activation', async () => {
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    event: { ...event, active: false },
    status: { ...status, availableToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: { ...args, home: false } },
  );
  await act(async () => result.current.open());
  expect(props(result.current, 0).visible).toBe(true);
  await act(async () => props(result.current, 0).onClose());
  await act(async () => props(result.current, 0).onDismissed());
  expect(result.current.active).toBe(false);
  jest
    .mocked(useChristmasEvent)
    .mockReturnValue(state as unknown as ReturnType<typeof useChristmasEvent>);
  await rerender(args);
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  expect(props(result.current, 1).visible).toBe(false);
});

it('does not consume the new day on a foreground midnight render before the next focus refresh', async () => {
  const subscription = jest.spyOn(AppState, 'addEventListener');
  const yesterday = {
    ...state,
    status: {
      ...status,
      availableToday: false,
      checkedInToday: true,
      checkInDates: ['2026-11-09'],
    },
  };
  jest
    .mocked(useChristmasEvent)
    .mockReturnValue(yesterday as unknown as ReturnType<typeof useChristmasEvent>);
  const { result, rerender } = await renderHook(
    (input: typeof args) => useChristmasSurface(input),
    { initialProps: args },
  );
  await waitFor(() => expect(props(result.current, 1).visible).toBe(true));
  await act(async () => props(result.current, 1).onClose(false));
  await act(async () => props(result.current, 1).onDismissed());
  expect(result.current.active).toBe(false);

  jest.mocked(todayIso).mockReturnValue('2026-11-10');
  jest
    .mocked(useChristmasEvent)
    .mockReturnValue({ ...yesterday, freshForToday: false } as unknown as ReturnType<
      typeof useChristmasEvent
    >);
  await rerender(args); // home stays true, no navigation or focus event has happened yet.
  expect(result.current.active).toBe(false);
  expect(state.refresh).not.toHaveBeenCalled();

  const onAppState = subscription.mock.calls.find(([type]) => type === 'change')![1];
  let finish!: () => void;
  state.refresh.mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve(null);
    }),
  );
  await act(() => onAppState('background'));
  await act(() => onAppState('active'));
  expect(state.refresh).toHaveBeenCalledTimes(1);
  jest.mocked(useChristmasEvent).mockReturnValue({
    ...state,
    status: { ...status, checkedInToday: false },
  } as unknown as ReturnType<typeof useChristmasEvent>);
  await rerender(args);
  expect(result.current.active).toBe(false); // still waiting for the explicit refresh to finish.
  await act(async () => finish());
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  expect(props(result.current, 1).visible).toBe(false);
  subscription.mockRestore();
});

it('keeps a failed character claim on attendance and clears the error after explicit retry', async () => {
  state.claimCharacter
    .mockResolvedValueOnce({ result: null, recovered: false })
    .mockResolvedValueOnce({ result: { grantedNow: true }, recovered: false });
  const { result } = await renderHook(() => useChristmasSurface(args));
  await waitFor(() => expect(props(result.current, 0).visible).toBe(true));
  await act(async () => props(result.current, 0).onClaimCharacter());
  expect(props(result.current, 0).error).toBe(true);
  expect(props(result.current, 0).visible).toBe(true);
  expect(props(result.current, 1).visible).toBe(false);
  await act(async () => props(result.current, 0).onClaimCharacter());
  expect(props(result.current, 0).error).toBe(false);
  expect(state.claimCharacter).toHaveBeenCalledTimes(2);
});
