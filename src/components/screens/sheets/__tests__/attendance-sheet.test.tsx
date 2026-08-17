import { act, fireEvent, render } from '@testing-library/react-native';

import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';

const rewards = (claimedThrough: number) =>
  Array.from({ length: 10 }, (_, i) => ({
    day: i + 1,
    coinAmount: i + 1 === 5 ? 50 : 30,
    furnitureReward: i + 1 === 10,
    claimed: i + 1 <= claimedThrough,
  }));

const STATUS: AttendanceStatus = {
  eventId: 7,
  code: 'ATTENDANCE_10D_2026',
  title: '10일 연속 출석',
  startsOn: '2026-08-16',
  endsOn: '2026-09-14',
  targetDays: 10,
  currentStreak: 3,
  checkedInToday: false,
  completed: false,
  checkInDates: ['2026-08-15', '2026-08-16', '2026-08-17'],
  dailyRewards: rewards(3),
  reward: {
    itemId: 42,
    name: '10일 출석 기념 트로피',
    assetKey: 'items/events/trophy.png',
    userItemId: null,
    received: false,
  },
};

const result = (over: Partial<AttendanceCheckInResult> = {}): AttendanceCheckInResult => ({
  newCheckIn: true,
  coinRewardAmount: 30,
  coinBalance: 190,
  rewardGrantedNow: false,
  status: { ...STATUS, currentStreak: 4, checkedInToday: true, dailyRewards: rewards(4) },
  ...over,
});

describe('AttendanceSheet', () => {
  it('이벤트 제목·기간·연속일수와 10칸 출석부를 보여준다', async () => {
    const { getByText } = await render(<AttendanceSheet visible status={STATUS} />);
    expect(getByText('10일 연속 출석')).toBeTruthy();
    expect(getByText('8월 16일 ~ 9월 14일')).toBeTruthy();
    expect(getByText('3일차')).toBeTruthy();
    expect(getByText('목표 10일')).toBeTruthy();
    // 5일차 보너스 50코인이 보상표에 있다.
    expect(getByText('50')).toBeTruthy();
  });

  it('오늘 이미 출석했으면 버튼을 잠근다', async () => {
    const onCheckIn = jest.fn();
    const { getByText } = await render(
      <AttendanceSheet
        visible
        status={{ ...STATUS, checkedInToday: true }}
        onCheckIn={onCheckIn}
      />,
    );
    fireEvent.press(getByText('오늘 출석 완료'));
    expect(onCheckIn).not.toHaveBeenCalled();
  });

  it('완주하면 버튼이 완주 문구로 잠긴다', async () => {
    const { getByText } = await render(
      <AttendanceSheet visible status={{ ...STATUS, completed: true }} />,
    );
    expect(getByText('이벤트를 완주했어요')).toBeTruthy();
  });

  /**
   * 멱등 재호출에 연출을 쏘면 받지도 않은 보상을 받은 것처럼 보인다 (#830과
   * 같은 계약). newCheckIn=false면 트로피 리빌이 뜨면 안 된다.
   */
  it('멱등 재호출(newCheckIn=false)에는 완주 연출을 쏘지 않는다', async () => {
    const onCheckIn = jest.fn(async () =>
      result({ newCheckIn: false, coinRewardAmount: 0, rewardGrantedNow: true }),
    );
    const { getByText, queryByTestId } = await render(
      <AttendanceSheet visible status={STATUS} onCheckIn={onCheckIn} />,
    );
    await act(async () => {
      fireEvent.press(getByText('오늘 출석하기'));
    });
    expect(onCheckIn).toHaveBeenCalled();
    expect(queryByTestId('attendance-trophy-reveal')).toBeNull();
  });

  /**
   * 10일차라도 보상 가구를 **이미 보유**했다면 rewardGrantedNow=false다 —
   * 새로 받은 게 없으므로 리빌하지 않는다.
   */
  it('이미 보유한 가구로 완주하면(rewardGrantedNow=false) 리빌하지 않는다', async () => {
    const onCheckIn = jest.fn(async () => result({ rewardGrantedNow: false }));
    const { getByText, queryByTestId } = await render(
      <AttendanceSheet visible status={STATUS} onCheckIn={onCheckIn} />,
    );
    await act(async () => {
      fireEvent.press(getByText('오늘 출석하기'));
    });
    expect(queryByTestId('attendance-trophy-reveal')).toBeNull();
  });

  it('이번에 가구를 새로 받으면 트로피 리빌을 띄운다', async () => {
    const onCheckIn = jest.fn(async () => result({ rewardGrantedNow: true }));
    const { getByText, getByTestId } = await render(
      <AttendanceSheet visible status={STATUS} onCheckIn={onCheckIn} />,
    );
    await act(async () => {
      fireEvent.press(getByText('오늘 출석하기'));
    });
    expect(getByTestId('attendance-trophy-reveal')).toBeTruthy();
    expect(getByText('10일 출석 기념 트로피 획득!')).toBeTruthy();
  });

  it('출석 요청이 실패해도(null) 연출 없이 조용히 넘어간다', async () => {
    const onCheckIn = jest.fn(async () => null);
    const { getByText, queryByTestId } = await render(
      <AttendanceSheet visible status={STATUS} onCheckIn={onCheckIn} />,
    );
    await act(async () => {
      fireEvent.press(getByText('오늘 출석하기'));
    });
    expect(queryByTestId('attendance-trophy-reveal')).toBeNull();
  });
});
