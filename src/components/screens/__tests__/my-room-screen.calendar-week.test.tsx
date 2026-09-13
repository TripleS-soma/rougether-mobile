import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { calendarHeading, TODAY, TOMORROW } from '@/test-utils/my-room-screen-fixtures';

const dateLabel = (date: string) => new RegExp(`^${date}(?:,|$)`);

describe('MyRoomScreen — 달력 월/주 모드 (#1327)', () => {
  it('월 모드에 onOpenDay가 있으면 목록을 숨기고 날짜 탭에만 부른다', async () => {
    const onOpenDay = jest.fn();
    const onSelectedDateChange = jest.fn();
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        view="calendar"
        onOpenDay={onOpenDay}
        onSelectedDateChange={onSelectedDateChange}
        selectedDate={TOMORROW}
      />,
    );
    expect(ui.queryByRole('header', { name: calendarHeading(TOMORROW) })).toBeNull();
    expect(ui.queryByLabelText('선택한 날에 추가')).toBeNull();
    expect(ui.queryByText('주간 보기')).toBeNull();
    // '오늘로'는 선택만 — 주간 보기를 열지 않는다.
    await fireEvent.press(ui.getByLabelText('오늘로'));
    expect(onSelectedDateChange).toHaveBeenLastCalledWith(TODAY);
    expect(onOpenDay).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText(dateLabel(TOMORROW)));
    expect(onSelectedDateChange).toHaveBeenLastCalledWith(TOMORROW);
    expect(onOpenDay).toHaveBeenCalledWith(TOMORROW);
  });

  it('onOpenDay가 없으면 종전처럼 목록이 아래에 남는다', async () => {
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} view="calendar" />);
    expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
  });

  it('주 모드는 헤더·접힌 달력·그날 목록을 그리고, 뒤로는 펼친 뒤 onBack', async () => {
    jest.useFakeTimers();
    try {
      const onBack = jest.fn();
      const onOpenDay = jest.fn();
      const ui = await render(
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          view="calendar"
          calendarMode="week"
          onBack={onBack}
          onOpenDay={onOpenDay}
        />,
      );
      expect(ui.getByText('주간 보기')).toBeTruthy();
      expect(ui.getByLabelText('다음 주')).toBeTruthy();
      expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
      expect(ui.getByLabelText('선택한 날에 추가')).toBeTruthy();
      // 주 모드의 날짜 탭은 선택만 — 또 열지 않는다.
      await fireEvent.press(ui.getByLabelText(dateLabel(TOMORROW)));
      expect(onOpenDay).not.toHaveBeenCalled();
      expect(ui.getByRole('header', { name: calendarHeading(TOMORROW) })).toBeTruthy();

      await fireEvent.press(ui.getByLabelText('뒤로 가기'));
      // 펼침이 끝나기 전엔 닫지 않는다.
      expect(onBack).not.toHaveBeenCalled();
      expect(ui.getByLabelText('다음 달')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    } finally {
      jest.useRealTimers();
    }
  });

  it('주 모드는 셸의 뒤로 가로채기에 자신을 등록하고, 그 경로도 펼친 뒤 onBack (#1327 후속)', async () => {
    jest.useFakeTimers();
    try {
      const onBack = jest.fn();
      const backInterceptorRef = { current: null as (() => boolean) | null };
      const ui = await render(
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          view="calendar"
          calendarMode="week"
          onBack={onBack}
          backInterceptorRef={backInterceptorRef}
        />,
      );
      expect(backInterceptorRef.current).not.toBeNull();
      await act(async () => {
        expect(backInterceptorRef.current!()).toBe(true);
      });
      // 펼침 중 — 아직 닫지 않고, 두 번째 뒤로도 삼킨다.
      expect(onBack).not.toHaveBeenCalled();
      expect(ui.getByLabelText('다음 달')).toBeTruthy();
      await act(async () => {
        expect(backInterceptorRef.current!()).toBe(true);
      });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
      // 월 모드로 다시 그리면(떠남) 등록이 풀린다.
      await ui.rerender(
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          view="calendar"
          backInterceptorRef={backInterceptorRef}
        />,
      );
      expect(backInterceptorRef.current).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
