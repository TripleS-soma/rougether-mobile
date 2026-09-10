import { fireEvent, render } from '@testing-library/react-native';
import { MyRoomScreen, type CalendarDayItem } from '@/components/screens/my-room-screen';

const date = '2026-09-08';
const items: CalendarDayItem[] = [
  { id: 'r-1', kind: 'routine', title: '독서', completed: true },
  { id: 't-1', kind: 'todo', title: '회의 준비', completed: false },
];
const day = {
  date,
  routineCount: 1,
  routineCompletedCount: 1,
  todoCount: 1,
  todoCompletedCount: 0,
};
const props = {
  view: 'calendar' as const,
  today: '2026-09-09',
  selectedDate: date,
  onSelectDate: jest.fn(),
  routines: [],
  calendarMonthDays: [day],
  calendarDays: { [date]: items },
};
it('종류 필터가 월 링의 집계와 선택일 목록에 함께 적용된다', async () => {
  const ui = await render(<MyRoomScreen {...props} />);
  expect(ui.getByLabelText(`${date}, 1개 완료, 전체 2개`)).toBeTruthy();
  expect(ui.getByRole('header', { name: '2026년 9월 8일' })).toBeTruthy();
  expect(ui.queryByText(/남은|완료 \/ 전체|하루하루 쌓인|지난 날짜도/)).toBeNull();
  expect(ui.queryByText('완료')).toBeNull();
  expect(ui.queryByText('1/2')).toBeNull();
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  expect(ui.getByLabelText(`${date}, 1개 완료, 전체 1개`)).toBeTruthy();
  expect(ui.queryByText('회의 준비')).toBeNull();
  expect(ui.getByText('독서')).toBeTruthy();
  await fireEvent.press(ui.getByRole('tab', { name: '할 일' }));
  expect(ui.getByLabelText(`${date}, 0개 완료, 전체 1개`)).toBeTruthy();
  expect(ui.queryByText('독서')).toBeNull();
  expect(ui.getByText('회의 준비')).toBeTruthy();
});
it('미래일은 작은 표식과 목록을 보여주고 정확한 수는 접근성 라벨로 제공한다', async () => {
  const future = '2026-09-10';
  const ui = await render(
    <MyRoomScreen
      {...props}
      selectedDate={future}
      calendarMonthDays={[{ ...day, date: future, routineCompletedCount: 0 }]}
      calendarDays={{ [future]: items.map((i) => ({ ...i, completed: false })) }}
    />,
  );
  expect(ui.getByLabelText(`${future}, 예정 2개`)).toBeTruthy();
  expect(ui.queryByText('0 / 2')).toBeNull();
  expect(ui.getByTestId(`calendar-schedule-dot-${future}`)).toBeTruthy();
  expect(ui.queryByText(/예정/)).toBeNull();
  expect(ui.getByText('회의 준비')).toBeTruthy();
  expect(ui.getByTestId(`calendar-routine-dot-${future}`)).toBeTruthy();
  expect(ui.getByTestId(`calendar-todo-dot-${future}`)).toBeTruthy();
  expect(ui.getByTestId('calendar-glass')).toBeTruthy();
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  expect(ui.getByTestId(`calendar-routine-dot-${future}`)).toBeTruthy();
  expect(ui.queryByTestId(`calendar-todo-dot-${future}`)).toBeNull();
  expect(ui.queryByText('회의 준비')).toBeNull();
  expect(ui.getByTestId('calendar-filter-glass-routine')).toBeTruthy();
});
it('조회 오류와 재시도를 보여주고 기존 완료값을 보존한다', async () => {
  const retryMonth = jest.fn();
  const retryDay = jest.fn();
  const ui = await render(
    <MyRoomScreen
      {...props}
      calendarMonthError
      calendarDayError
      onRetryCalendarMonth={retryMonth}
      onRetryCalendarDay={retryDay}
    />,
  );
  expect(ui.getByLabelText(`${date}, 1개 완료, 전체 2개`)).toBeTruthy();
  expect(ui.getByText('독서')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('월 달성도 다시 불러오기'));
  await fireEvent.press(ui.getByLabelText('선택일 기록 다시 불러오기'));
  expect(retryMonth).toHaveBeenCalledTimes(1);
  expect(retryDay).toHaveBeenCalledTimes(1);
});
it('처음 조회가 실패한 날은 빈 기록이나 영구 로딩으로 표시하지 않는다', async () => {
  const ui = await render(
    <MyRoomScreen {...props} calendarDays={{}} calendarDayError onRetryCalendarDay={jest.fn()} />,
  );
  expect(ui.getByText('이 날의 기록을 새로 불러오지 못했어요')).toBeTruthy();
  expect(ui.queryByText(/기록 없음/)).toBeNull();
});

it('완료 수가 없는 월 응답도 알고 있는 할 일 표시는 남긴다', async () => {
  const ui = await render(
    <MyRoomScreen
      {...props}
      calendarMonthDays={[{ date, routineCount: 1, todoCount: 1 }]}
      markedTodoDates={new Set([date])}
    />,
  );
  expect(ui.getByLabelText(`${date}, 집계 확인 중, 할 일 있음`)).toBeTruthy();
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  expect(ui.getByLabelText(`${date}, 집계 확인 중`)).toBeTruthy();
});

it('오늘 목록의 첫 조회 실패를 일정 없음으로 표시하지 않는다', async () => {
  const retry = jest.fn();
  const ui = await render(
    <MyRoomScreen {...props} selectedDate={props.today} loadError onRetry={retry} />,
  );
  expect(ui.getByText('이 날의 기록을 새로 불러오지 못했어요')).toBeTruthy();
  expect(ui.queryByText(`${props.today} · 일정 없음`)).toBeNull();
  await fireEvent.press(ui.getByLabelText('선택일 기록 다시 불러오기'));
  expect(retry).toHaveBeenCalledTimes(1);
});
