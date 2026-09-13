import { fireEvent, render } from '@testing-library/react-native';

import { DateEditSheet } from '@/components/screens/sheets/date-edit-sheet';
import type { Routine } from '@/constants/routines';
import { calendarToday } from '@/utils/calendar-progress';

const routine: Routine = { id: 'r5', title: '스트레칭', repeat: 'daily' };

describe('DateEditSheet — 루틴 몫 옮기기 (#189)', () => {
  it('오늘 몫은 원래 날짜에서 빠진다고 안내하고, 확인 시 원래 날짜를 함께 넘긴다', async () => {
    const today = calendarToday();
    const onMove = jest.fn();
    const ui = await render(
      <DateEditSheet
        item={routine}
        fromDate={today}
        onClose={() => {}}
        onMoveRoutineOccurrence={onMove}
      />,
    );
    expect(ui.queryByText(/서버 준비 중/)).toBeNull();
    expect(ui.getByText(/원래 날짜에서는 빠지고/)).toBeTruthy();
    fireEvent.press(ui.getByLabelText('확인'));
    expect(onMove).toHaveBeenCalledWith('r5', today, today);
  });

  it('지난 날짜 몫은 그대로 남는다고 안내한다 — 서버가 과거 건너뜀을 받지 않는다', async () => {
    const ui = await render(
      <DateEditSheet
        item={routine}
        fromDate="2020-01-01"
        onClose={() => {}}
        onMoveRoutineOccurrence={() => {}}
      />,
    );
    expect(ui.getByText(/지난 날짜 몫은 그대로 남아요/)).toBeTruthy();
  });

  it('fromDate가 없으면 오늘을 원래 날짜로 쓴다', async () => {
    const onMove = jest.fn();
    const ui = await render(
      <DateEditSheet item={routine} onClose={() => {}} onMoveRoutineOccurrence={onMove} />,
    );
    fireEvent.press(ui.getByLabelText('확인'));
    expect(onMove).toHaveBeenCalledWith('r5', calendarToday(), calendarToday());
  });
});
