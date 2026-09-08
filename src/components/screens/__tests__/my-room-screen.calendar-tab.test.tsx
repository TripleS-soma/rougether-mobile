import { fireEvent, render } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import {
  OTHER_DAY,
  pickCalendarDate,
  TODAY,
  TOMORROW,
  YESTERDAY,
} from '@/test-utils/my-room-screen-fixtures';

describe('MyRoomScreen', () => {
  // 달력이 하단 탭으로 (#1138) — 셸이 view를 고정하면 방/달력 알약은 없고, 달력 뷰의
  // '이 날의 할 일' 옆 ＋ 루틴이 고른 날짜를 넘긴다.
  it("view='calendar'면 알약 없이 달력을 그리고, ＋ 루틴이 고른 날짜로 부른다 (#1138)", async () => {
    const onAddRoutineForDate = jest.fn();
    const ui = await render(
      <MyRoomScreen
        routines={[]}
        view="calendar"
        onSelectDate={jest.fn()}
        onAddRoutineForDate={onAddRoutineForDate}
      />,
    );
    expect(ui.queryByLabelText('방')).toBeNull();
    // 상단 '달력' 알약은 없다 — 하단 탭이 이미 이름을 말한다.
    expect(ui.queryByText('달력')).toBeNull();
    expect(ui.queryByTestId('my-room-chrome')).toBeNull();
    expect(ui.getByText('이 날의 할 일')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('이 날에 루틴 추가'));
    expect(onAddRoutineForDate).toHaveBeenCalledWith(TODAY);
  });

  it('달력탭에 선택 날짜의 전체 완료/총 개수와 진행 바가 보인다 (#346)', async () => {
    // 오늘(로컬 날짜): 5개 중 3개 완료 — 방탭과 같은 집계가 달력탭에도 표시.
    const completions = { '1': [TODAY], '2': [TODAY], '3': [TODAY] };
    const local = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} completions={completions} />,
    );
    await fireEvent.press(local.getByText('달력'));
    expect(local.getByText('이 날의 할 일')).toBeTruthy();
    expect(local.getByText('3 / 5')).toBeTruthy();

    // 서버 날짜(어제): completed 플래그로 집계 — 1/2.
    const calendarDays = {
      [YESTERDAY]: [
        {
          id: '1',
          kind: 'routine' as const,
          title: '지난 루틴',
          completed: true,
          category: '건강',
        },
        { id: '2', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '건강' },
      ],
    };
    const server = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
      />,
    );
    await pickCalendarDate(server, YESTERDAY);
    expect(server.getByText('1 / 2')).toBeTruthy();
  });

  it('renders the server list for non-today dates and toggles past routines', async () => {
    const onSelectDate = jest.fn();
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [YESTERDAY]: [
        { id: '1', kind: 'routine' as const, title: '옛 카테고리 루틴', completed: true, category: '99' }, // prettier-ignore
      ],
    };
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          calendarDays={calendarDays}
          onSelectDate={onSelectDate}
          onToggleCalendarItem={onToggleCalendarItem}
          allCategories={[
            { id: '99', name: '옛것', icon: 'sparkle' as const, color: '#FF0000', visibility: 'partial', deleted: true }, // prettier-ignore
          ]}
        />
      </ToastProvider>,
    );
    const { getByText } = ui;

    await pickCalendarDate(ui, YESTERDAY);
    expect(onSelectDate).toHaveBeenCalledWith(YESTERDAY);
    expect(getByText('옛 카테고리 루틴')).toBeTruthy();
    // Grouped under the record-time (deleted) category, like the room tab.
    expect(getByText('옛것')).toBeTruthy();
    expect(
      getByText('지난 날짜도 완료 체크할 수 있어요. (코인은 당일 완료에만 지급돼요)'),
    ).toBeTruthy();

    // Past routines toggle for real — the server accepts past-date logs (#183).
    await fireEvent.press(ui.getByLabelText('옛 카테고리 루틴'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', kind: 'routine' }),
      YESTERDAY,
    );
  });

  it('toggles a past todo in the 달력 tab', async () => {
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't1', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={[]}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onToggleCalendarItem={onToggleCalendarItem}
      />,
    );

    await pickCalendarDate(ui, YESTERDAY);
    // The row body is inert — only the checkbox toggles.
    await fireEvent.press(ui.getByText('지난 할 일'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();

    await fireEvent.press(ui.getByLabelText('지난 할 일'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', kind: 'todo' }),
      YESTERDAY,
    );
  });

  it('달력 탭에서 +로 할 일 추가 — 서버 백업 날짜, 기본 마감일은 선택 날짜 (#323)', async () => {
    const onQuickAddRoutine = jest.fn();
    // 어제엔 기록이 없어도 현재 카테고리 헤더가 렌더돼 +가 접근 가능해야 한다.
    const calendarDays = { [YESTERDAY]: [] };
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onQuickAddRoutine={onQuickAddRoutine}
        quickAddDisabledCategoryIds={['일정']}
      />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    // 미션 연동 카테고리는 달력에서도 + 미노출 (방탭과 같은 규칙).
    expect(ui.queryByLabelText('일정 할 일 추가')).toBeNull();
    await fireEvent.press(ui.getByLabelText('건강 할 일 추가'));
    // 날짜 칩이 선택한 날짜(어제)로 프리필된다.
    expect(ui.getByText(YESTERDAY.replaceAll('-', '.'))).toBeTruthy();
    const input = ui.getByPlaceholderText('할 일 입력 후 완료');
    await fireEvent.changeText(input, '어제 밀린 일');
    await fireEvent(input, 'blur');
    expect(onQuickAddRoutine).toHaveBeenCalledWith('건강', '어제 밀린 일', YESTERDAY);
  });

  it('달력 탭 오늘 날짜에서도 +로 할 일 추가 (#323)', async () => {
    const onQuickAddRoutine = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onQuickAddRoutine={onQuickAddRoutine} />,
    );
    await pickCalendarDate(ui, TODAY);
    await fireEvent.press(ui.getByLabelText('건강 할 일 추가'));
    // 오늘이면 날짜 칩은 '오늘'.
    expect(ui.getByText('오늘')).toBeTruthy();
    const input = ui.getByPlaceholderText('할 일 입력 후 완료');
    await fireEvent.changeText(input, '오늘 할 일');
    await fireEvent(input, 'blur');
    expect(onQuickAddRoutine).toHaveBeenCalledWith('건강', '오늘 할 일', TODAY);
  });

  it('달력 탭 행 본문 탭 → 방탭과 같은 메뉴 시트 (오늘, #323)', async () => {
    const onToggleCompletion = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );
    await pickCalendarDate(ui, TODAY);
    // 카테고리 헤더 아이콘은 방탭과 같은 CategoryIcon(카테고리색 틴트) —
    // 원시 Pictogram이면 탭 간 아이콘 색이 달랐다 (#482 후속).
    expect(ui.getAllByTestId(/^category-icon-/).length).toBeGreaterThan(0);
    await fireEvent.press(ui.getByLabelText('하루 회고 메뉴'));
    expect(ui.getByText('이름 변경')).toBeTruthy();
    expect(ui.getByText('삭제하기')).toBeTruthy();
    // 완료하기는 메뉴를 연 날짜(오늘) 기준으로 토글.
    await fireEvent.press(ui.getByLabelText('하루 회고 완료'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);
  });

  it('달력 서버 날짜의 행도 메뉴 시트 — 완료는 달력 규칙으로 토글 (#323)', async () => {
    const onToggleCalendarItem = jest.fn();
    const todos = [
      {
        id: 't9',
        title: '지난 할 일',
        kind: 'todo' as const,
        dueDate: YESTERDAY,
        category: '건강',
      },
    ];
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't9', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={todos}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onToggleCalendarItem={onToggleCalendarItem}
      />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    await fireEvent.press(ui.getByLabelText('지난 할 일 메뉴'));
    expect(ui.getByText('이름 변경')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('지난 할 일 완료'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't9', kind: 'todo' }),
      YESTERDAY,
    );
  });

  it('blocks completion on future dates with a toast', async () => {
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [TOMORROW]: [
        { id: 't2', kind: 'todo' as const, title: '내일 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen
          routines={[]}
          calendarDays={calendarDays}
          onSelectDate={jest.fn()}
          onToggleCalendarItem={onToggleCalendarItem}
        />
      </ToastProvider>,
    );

    await pickCalendarDate(ui, TOMORROW);
    // 상시 안내는 뺐다 (#1134) — 완료 시도 시 토스트가 안내한다.
    expect(ui.queryByText('미래 날짜는 아직 완료할 수 없어요.')).toBeNull();
    expect(ui.queryByText(/지난 날짜도 완료 체크할 수 있어요/)).toBeNull();

    await fireEvent.press(ui.getByLabelText('내일 할 일'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();
    expect(ui.getByText('미래 날짜는 완료할 수 없어요')).toBeTruthy();
  });

  it('sinks completed items on server-backed 달력 days too', async () => {
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't1', kind: 'todo' as const, title: '한 일', completed: true, category: '' },
        { id: 't2', kind: 'todo' as const, title: '안 한 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen routines={[]} calendarDays={calendarDays} onSelectDate={jest.fn()} />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    const labels = ui.getAllByRole('checkbox').map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual(['안 한 일', '한 일']);
  });

  it('groups the 달력 list by category like the room tab', async () => {
    const { getByText, getAllByText } = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    await fireEvent.press(getByText('달력'));
    // Today's list renders under category headers (emoji + label + count).
    expect(getAllByText('일정').length).toBeGreaterThan(0);
    expect(getAllByText('건강').length).toBeGreaterThan(0);
    expect(getByText('아침 7시 기상')).toBeTruthy();
  });

  it('shows a spinner while a picked date is still loading from the server', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} calendarDays={{}} onSelectDate={jest.fn()} />,
    );
    await fireEvent.press(getByText('달력'));
    await fireEvent.press(getByLabelText(OTHER_DAY));
    expect(queryByText('예정된 루틴이 없어요.')).toBeNull();
  });
});
