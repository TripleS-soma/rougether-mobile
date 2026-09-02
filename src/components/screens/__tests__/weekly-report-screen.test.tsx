import { fireEvent, render } from '@testing-library/react-native';

import { WeeklyReportScreen } from '@/components/screens/weekly-report-screen';

describe('WeeklyReportScreen (#1056)', () => {
  it('헤더 뒤로가기와 회고 없음 상태를 그린다', async () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText } = await render(
      <WeeklyReportScreen report={null} onBack={onBack} />,
    );
    expect(getByText('주간회고')).toBeTruthy();
    expect(getByText('아직 회고가 없어요.')).toBeTruthy();
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('회고 본문을 패널로 그린다', async () => {
    const { getByText } = await render(
      <WeeklyReportScreen
        report={{
          reportId: 1,
          weekStartDate: '2026-08-24',
          weekEndDate: '2026-08-30',
          completionRate: 80,
          summary: '지난주엔 아침 루틴을 잘 지켰어요.',
        }}
        onBack={() => {}}
      />,
    );
    expect(getByText('지난주엔 아침 루틴을 잘 지켰어요.')).toBeTruthy();
  });
});
