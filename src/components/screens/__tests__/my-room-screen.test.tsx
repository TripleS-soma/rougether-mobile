import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { todayIso } from '@/utils/datetime';

const TODAY = todayIso();
// A non-today date guaranteed to sit in the calendar's current month view:
// the 1st, or the 2nd when today is the 1st.
const OTHER_DAY = `${TODAY.slice(0, 8)}${TODAY.endsWith('01') ? '02' : '01'}`;

/** TODAY shifted by n days (local), "YYYY-MM-DD". */
const isoShift = (days: number) => {
  const [y, m, d] = TODAY.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
};
const YESTERDAY = isoShift(-1);
const TOMORROW = isoShift(1);

/** Open the 달력 tab and select a date, hopping months when needed. */
const pickCalendarDate = async (
  ui: { getByText: (t: string) => any; getByLabelText: (t: string) => any },
  date: string,
) => {
  await fireEvent.press(ui.getByText('달력'));
  if (date.slice(0, 7) < TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('이전 달'));
  if (date.slice(0, 7) > TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('다음 달'));
  await fireEvent.press(ui.getByLabelText(date));
};

describe('MyRoomScreen', () => {
  it('renders the room title, streak, and today progress', async () => {
    // Completion is per date: mark 3 of the 5 routines done today.
    const completions = { '1': [TODAY], '2': [TODAY], '3': [TODAY] };
    const { getByText } = await render(
      <MyRoomScreen
        userName="준서"
        streakDays={7}
        routines={SAMPLE_ROUTINES}
        completions={completions}
      />,
    );
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('7일')).toBeTruthy();
    // 3 of 5 routines completed today.
    expect(getByText('3 / 5')).toBeTruthy();
  });

  it('toggles only via the checkbox; the row body opens the menu sheet', async () => {
    const onToggleCompletion = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );

    // Per-category quick-add todo button still renders.
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();

    // The checkbox (labelled by the routine title) toggles completion.
    await fireEvent.press(getByLabelText('하루 회고'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);

    // The row body (title text) opens the bottom-sheet menu, no extra toggle.
    await fireEvent.press(getByText('하루 회고'));
    expect(getByText('수정하기')).toBeTruthy();
    expect(getByText('삭제하기')).toBeTruthy();
    expect(onToggleCompletion).toHaveBeenCalledTimes(1);
  });

  it('keeps the quick-add button reachable on empty categories', async () => {
    // No routines at all — every category header (and its +) must still render.
    const { getByLabelText } = await render(<MyRoomScreen routines={[]} />);
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('취미 할 일 추가')).toBeTruthy();
  });

  it('opens the hamburger menu and routes each item', async () => {
    const onEdit = jest.fn();
    const onAddRoutine = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onEdit={onEdit} onAddRoutine={onAddRoutine} />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    // getByLabelText: the bottom 방 꾸미기 button uses a distinct label (열기).
    await fireEvent.press(getByLabelText('방 꾸미기'));
    expect(onEdit).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('루틴 관리'));
    expect(onAddRoutine).toHaveBeenCalledTimes(1);

    // 카테고리 관리 opens the manager sheet in-place.
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('카테고리 관리'));
    expect(queryByText('새 카테고리 만들기')).toBeTruthy();
  });

  it('hides routines not scheduled today from the 방 tab (repeat days respected)', async () => {
    const todayWd = new Date().getDay();
    const otherWd = (todayWd + 1) % 7;
    const routines = [
      { id: '1', title: '오늘 루틴', kind: 'routine' as const, days: [todayWd] },
      { id: '2', title: '다른 요일 루틴', kind: 'routine' as const, days: [otherWd] },
      { id: '3', title: '매일 루틴', kind: 'routine' as const },
    ];
    const { getByText, queryByText } = await render(<MyRoomScreen routines={routines} />);

    expect(getByText('오늘 루틴')).toBeTruthy();
    expect(getByText('매일 루틴')).toBeTruthy();
    // Edited to a different weekday → must drop out of today's list.
    expect(queryByText('다른 요일 루틴')).toBeNull();
    expect(getByText('0 / 2')).toBeTruthy();
  });

  it('renders uncategorized routines even when the user has no categories', async () => {
    // API state after a fresh account adds routines without a category:
    // categories = [], routines have no category → must show in a 기타 group,
    // not vanish while the counter says 0 / 2.
    const routines = [
      { id: '2', title: '아침 기상', kind: 'routine' as const },
      { id: '3', title: '독서 30분', kind: 'routine' as const },
    ];
    const { getByText } = await render(<MyRoomScreen routines={routines} categories={[]} />);
    expect(getByText('아침 기상')).toBeTruthy();
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getByText('기타')).toBeTruthy();
    expect(getByText('0 / 2')).toBeTruthy();
  });

  it('renders the server list for non-today dates and blocks past routine toggles', async () => {
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
            { id: '99', label: '옛것', emoji: '✨', color: '#FF0000', visibility: 'partial', deleted: true }, // prettier-ignore
          ]}
        />
      </ToastProvider>,
    );
    const { getByText, queryByText } = ui;

    await pickCalendarDate(ui, YESTERDAY);
    expect(onSelectDate).toHaveBeenCalledWith(YESTERDAY);
    expect(getByText('옛 카테고리 루틴')).toBeTruthy();
    // Grouped under the record-time (deleted) category, like the room tab.
    expect(getByText('옛것')).toBeTruthy();
    expect(getByText('지난 날짜는 할 일만 완료 체크할 수 있어요.')).toBeTruthy();

    // Past routines don't toggle — the server accepts today-only logs.
    await fireEvent.press(ui.getByLabelText('옛 카테고리 루틴'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();
    expect(queryByText('지난 루틴 완료는 서버 준비 중이에요')).toBeTruthy();
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
    expect(ui.getByText('미래 날짜는 아직 완료할 수 없어요.')).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('내일 할 일'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();
    expect(ui.getByText('미래 날짜는 완료할 수 없어요')).toBeTruthy();
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

  it('shows a loading state, an error state with retry, and an empty state', async () => {
    const loading = await render(<MyRoomScreen loading />);
    expect(loading.getByText('불러오는 중…')).toBeTruthy();

    const onRetry = jest.fn();
    const failed = await render(<MyRoomScreen loadError onRetry={onRetry} />);
    await fireEvent.press(failed.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Brand-new user: no categories, no routines → guided empty state.
    const empty = await render(<MyRoomScreen routines={[]} categories={[]} />);
    expect(empty.getByText('아직 루틴이 없어요.')).toBeTruthy();
  });

  // Camera test last: its photo path leaves a resolved promise that can disrupt
  // a following test's render in this harness.
  it('requires a camera photo to complete a 인증사진형 routine', async () => {
    const onToggleCompletion = jest.fn();
    const onRequestPhoto = jest.fn().mockResolvedValue('file://verify.jpg');
    const { getByLabelText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onToggleCompletion={onToggleCompletion}
        onRequestPhoto={onRequestPhoto}
      />,
    );

    // '하루 회고' (id 5): no photoVerify → the checkbox toggles today immediately.
    fireEvent.press(getByLabelText('하루 회고'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);

    // '영어 공부' (id 4): photoVerify → camera, then toggle today.
    fireEvent.press(getByLabelText('영어 공부'));
    await waitFor(() => expect(onToggleCompletion).toHaveBeenCalledWith('4', TODAY));
    expect(onRequestPhoto).toHaveBeenCalled();
  });
});
