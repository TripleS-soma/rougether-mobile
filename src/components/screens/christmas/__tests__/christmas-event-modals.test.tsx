import { act, fireEvent, render } from '@testing-library/react-native';

import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';
import {
  ChristmasAttendanceModal,
  CHRISTMAS_REWARD_SETTLE_MS,
} from '@/components/screens/christmas/christmas-attendance-modal';
import { ChristmasEventPopup } from '@/components/screens/christmas/christmas-event-popup';

const status: AttendanceStatus = {
  eventId: 32,
  code: 'christmas_2026',
  title: '크리스마스',
  startsOn: '2026-11-09',
  endsOn: '2026-12-25',
  targetDays: 30,
  mode: 'CUMULATIVE',
  progressDays: 4,
  currentStreak: 1,
  checkedInToday: false,
  active: true,
  availableToday: true,
  completed: false,
  checkInDates: [],
  dailyRewards: Array.from({ length: 30 }, (_, index) => ({
    day: index + 1,
    coinAmount: (index + 1) % 5 === 0 ? 60 : 30,
    claimed: index < 4,
    furnitureReward: false,
  })),
  reward: null,
};
const attendanceProps = {
  visible: true,
  status,
  onCheckIn: jest.fn(),
  onClose: jest.fn(),
  onDismissed: jest.fn(),
  onRetry: jest.fn(),
};
const popupProps = {
  visible: true,
  title: '크리스마스',
  endsOn: '2026-12-25',
  onClose: jest.fn(),
  onDismissed: jest.fn(),
  onGoEvent: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

it('renders thirty cumulative envelopes and opens only server-confirmed progress', async () => {
  const screen = await render(<ChristmasAttendanceModal {...attendanceProps} />);
  expect(screen.getByText('4 / 30')).toBeTruthy();
  expect(screen.getAllByLabelText(/번째 출석,/)).toHaveLength(30);
  expect(screen.getAllByLabelText(/선물 수령 완료/)).toHaveLength(4);
  expect(screen.getByLabelText('5번째 출석, 닫힌 선물 봉투')).toBeTruthy();
  expect(screen.getByText('오늘 60코인')).toBeTruthy();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByText(/트리/)).toBeNull();
  await fireEvent.press(screen.getByText('출석하기'));
  expect(attendanceProps.onCheckIn).toHaveBeenCalledTimes(1);
});

it.each([
  { checkedInToday: true, availableToday: false, label: '오늘 출석 완료' },
  { active: false, availableToday: false, label: '이벤트 종료' },
  { completed: true, progressDays: 30, availableToday: false, label: '30회 출석 완료' },
])('locks check-in for $label while preserving progress inspection', async ({ label, ...over }) => {
  const screen = await render(
    <ChristmasAttendanceModal {...attendanceProps} status={{ ...status, ...over }} />,
  );
  await fireEvent.press(screen.getByText(label));
  expect(attendanceProps.onCheckIn).not.toHaveBeenCalled();
  expect(screen.getAllByLabelText(/번째 출석,/)).toHaveLength(30);
});

it('keeps a title, close action and retry available when status cannot load', async () => {
  const screen = await render(
    <ChristmasAttendanceModal {...attendanceProps} status={null} error />,
  );
  expect(screen.getByText('크리스마스')).toBeTruthy();
  await fireEvent.press(screen.getByText('다시 시도'));
  expect(attendanceProps.onRetry).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('닫기'));
  expect(attendanceProps.onClose).toHaveBeenCalledTimes(1);
});

it('shows only the actual newly granted coins and requests close after their animation', async () => {
  jest.useFakeTimers();
  const result: AttendanceCheckInResult = {
    newCheckIn: true,
    coinRewardAmount: 43,
    coinBalance: 100,
    rewardGrantedNow: false,
    status: { ...status, progressDays: 5, checkedInToday: true, availableToday: false },
  };
  const screen = await render(
    <ChristmasAttendanceModal {...attendanceProps} status={result.status} result={result} />,
  );
  expect(screen.getByText('+43코인')).toBeTruthy();
  expect(attendanceProps.onClose).not.toHaveBeenCalled();
  await act(() => {
    jest.advanceTimersByTime(CHRISTMAS_REWARD_SETTLE_MS);
  });
  expect(attendanceProps.onClose).toHaveBeenCalledTimes(1);
});

it('does not animate a second reward during idempotent recovery', async () => {
  jest.useFakeTimers();
  const result: AttendanceCheckInResult = {
    newCheckIn: false,
    coinRewardAmount: 0,
    coinBalance: 100,
    rewardGrantedNow: false,
    status: { ...status, checkedInToday: true, availableToday: false },
  };
  const screen = await render(
    <ChristmasAttendanceModal {...attendanceProps} status={result.status} result={result} />,
  );
  expect(screen.queryByText(/^\+/)).toBeNull();
  await act(() => {
    jest.advanceTimersByTime(0);
  });
  expect(attendanceProps.onClose).toHaveBeenCalledTimes(1);
});

it('waits for native dismissal before releasing the next queued event', async () => {
  jest.useFakeTimers();
  const screen = await render(<ChristmasAttendanceModal {...attendanceProps} />);
  const nativeModal = screen.getByTestId('christmas-modal');
  await screen.rerender(<ChristmasAttendanceModal {...attendanceProps} visible={false} />);
  expect(attendanceProps.onDismissed).not.toHaveBeenCalled();
  await act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(attendanceProps.onDismissed).not.toHaveBeenCalled();
  await act(() => {
    nativeModal.props.onDismiss();
  });
  expect(attendanceProps.onDismissed).toHaveBeenCalledTimes(1);
  await act(() => {
    nativeModal.props.onDismiss();
  });
  expect(attendanceProps.onDismissed).toHaveBeenCalledTimes(1);
});

it('starts the announcement unchecked and sends the permanent preference only when chosen', async () => {
  const screen = await render(<ChristmasEventPopup {...popupProps} />);
  expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false);
  expect(screen.getByRole('header').props.children).toBe('내 방에도 크리스마스');
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByLabelText('닫기'));
  expect(popupProps.onClose).toHaveBeenCalledWith(true);
  expect(screen.queryByText(/루틴·할 일 완료 보상/)).toBeNull();
});

it('exposes an honest save failure and retries the chosen preference', async () => {
  const screen = await render(<ChristmasEventPopup {...popupProps} error />);
  await fireEvent.press(screen.getByRole('checkbox'));
  expect(screen.getByText('숨김 설정을 저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy();
  await fireEvent.press(screen.getByText('다시 시도'));
  expect(popupProps.onClose).toHaveBeenCalledWith(true);
  await fireEvent.press(screen.getByText('이벤트 뽑기 바로가기'));
  expect(popupProps.onGoEvent).toHaveBeenCalledWith(true);
});
