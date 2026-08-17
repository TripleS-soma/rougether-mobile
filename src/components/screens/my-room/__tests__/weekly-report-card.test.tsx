import { fireEvent, render } from '@testing-library/react-native';

import { WeeklyReportCard } from '@/components/screens/my-room/weekly-report-card';

describe('WeeklyReportCard', () => {
  it('기간과 완료율을 보여주고 누르면 상세를 연다', async () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = await render(
      <WeeklyReportCard
        weekStartDate="2026-08-09"
        weekEndDate="2026-08-15"
        completionRate={0.36}
        completedCount={14}
        scheduledCount={39}
        onPress={onPress}
      />,
    );
    expect(getByText('주간 회고')).toBeTruthy();
    expect(getByText('8월 9일 ~ 8월 15일')).toBeTruthy();
    expect(getByText('36%')).toBeTruthy();
    expect(getByText(/예정 39개 중 14개 완료/)).toBeTruthy();

    fireEvent.press(getByLabelText(/주간 회고 열기/));
    expect(onPress).toHaveBeenCalled();
  });

  /** 예정이 0인 주에 0으로 나누면 NaN 폭이 된다 — 막대가 통째로 사라졌다. */
  it('예정 0개인 주에도 NaN 없이 0%로 그린다', async () => {
    const { getByText } = await render(
      <WeeklyReportCard
        weekStartDate="2026-08-09"
        weekEndDate="2026-08-15"
        completionRate={0}
        completedCount={0}
        scheduledCount={0}
      />,
    );
    expect(getByText('0%')).toBeTruthy();
  });
});
