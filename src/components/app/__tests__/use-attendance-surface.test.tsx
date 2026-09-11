import { act, render } from '@testing-library/react-native';

import type { AttendanceStatus } from '@/api/events';
import {
  AUTO_ATTENDANCE_DELAY_MS,
  useAttendanceSurface,
} from '@/components/app/use-attendance-surface';

type SheetProps = { visible: boolean; autoCheckIn?: boolean; onClose?: () => void };

const mockSheetProps: SheetProps[] = [];
jest.mock('@/components/screens/sheets/attendance-sheet', () => ({
  AttendanceSheet: (props: SheetProps) => {
    mockSheetProps.push(props);
    return null;
  },
}));
jest.mock('@/components/screens/sheets/wallet-history-sheet', () => ({
  WalletHistorySheet: () => null,
}));
let mockStatus: AttendanceStatus | null = null;
jest.mock('@/hooks/use-attendance', () => ({
  useAttendance: () => ({
    status: mockStatus,
    loaded: true,
    checkingIn: false,
    checkIn: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-wallet-history', () => ({
  useWalletHistory: () => ({
    entries: [],
    loading: false,
    error: null,
    hasNext: false,
    load: jest.fn(),
    loadMore: jest.fn(),
  }),
}));

const PENDING = {
  eventId: 7,
  checkedInToday: false,
  completed: false,
  dailyRewards: [],
} as unknown as AttendanceStatus;

let surface: ReturnType<typeof useAttendanceSurface>;
function Harness() {
  surface = useAttendanceSurface({ setWallet: jest.fn(), setScreen: jest.fn() });
  return surface.sheets;
}
const lastSheet = () => mockSheetProps[mockSheetProps.length - 1];
const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe('useAttendanceSurface — 그날 첫 완료 자동 출석 (#1294)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSheetProps.length = 0;
    mockStatus = PENDING;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('보상 알약이 끝난 뒤에야 시트를 자동 출석 모드로 연다', async () => {
    await render(<Harness />);
    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS - 1);
    expect(lastSheet().visible).toBe(false);
    await wait(1);
    expect(lastSheet()).toMatchObject({ visible: true, autoCheckIn: true });
  });

  it('오늘 이미 출석했거나 완주했으면 열지 않는다', async () => {
    mockStatus = { ...PENDING, checkedInToday: true };
    await render(<Harness />);
    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS);
    expect(lastSheet().visible).toBe(false);

    mockStatus = { ...PENDING, completed: true };
    await render(<Harness />);
    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS);
    expect(lastSheet().visible).toBe(false);
  });

  it('진행 중인 이벤트가 없으면 시트 자체가 없다', async () => {
    mockStatus = null;
    await render(<Harness />);
    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS);
    expect(mockSheetProps).toHaveLength(0);
  });

  it('같은 날 두 번째 완료는 다시 열지 않는다 — 자동 출석이 실패해 미출석이어도', async () => {
    await render(<Harness />);
    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS);
    expect(lastSheet().visible).toBe(true);
    await act(() => lastSheet().onClose?.());
    expect(lastSheet()).toMatchObject({ visible: false, autoCheckIn: false });

    await act(() => surface.openAttendanceAfterFirstCompletion());
    await wait(AUTO_ATTENDANCE_DELAY_MS);
    expect(lastSheet().visible).toBe(false);
  });

  it('버튼으로 연 시트는 자동 출석 모드가 아니다', async () => {
    await render(<Harness />);
    await act(() => surface.openAttendance());
    expect(lastSheet()).toMatchObject({ visible: true, autoCheckIn: false });
  });
});
