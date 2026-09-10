import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import type { RoutineCategoryMeta } from '@/constants/routines';

const TODAY = '2026-09-10';
const SELECTED = '2026-09-18';

it.each(['room', 'calendar'] as const)(
  '%s에서 카테고리 없이 바로 투두를 추가한다',
  async (view) => {
    const save = jest.fn().mockResolvedValue(true);
    const date = view === 'room' ? TODAY : SELECTED;
    const ui = await render(
      <MyRoomScreen
        view={view}
        today={TODAY}
        selectedDate={SELECTED}
        routines={[]}
        categories={[]}
        calendarDays={{ [SELECTED]: [] }}
        onQuickAddRoutine={save}
      />,
    );
    await fireEvent.press(ui.getByLabelText(view === 'room' ? '오늘에 추가' : '선택한 날에 추가'));
    await fireEvent.press(ui.getAllByRole('tab', { name: '할 일' }).at(-1)!);
    await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '새 기록');
    await fireEvent.press(ui.getByLabelText('할 일 저장'));
    await waitFor(() => expect(save).toHaveBeenCalledWith('', '새 기록', date));
  },
);

it('일반 카테고리만 고를 수 있고 루틴 필터에서 저장한 투두도 바로 보이게 한다', async () => {
  const save = jest.fn().mockResolvedValue(true);
  const base: RoutineCategoryMeta = {
    id: '1',
    name: '생활',
    icon: 'sun',
    color: '#7FA87F',
    visibility: 'private',
  };
  const ui = await render(
    <MyRoomScreen
      view="calendar"
      today={TODAY}
      selectedDate={SELECTED}
      routines={[]}
      categories={[
        base,
        { ...base, id: '2', name: '집 미션', houseId: 5 },
        { ...base, id: '3', name: '차단된 카테고리' },
        { ...base, id: '4', name: '삭제된 카테고리', deleted: true },
      ]}
      quickAddDisabledCategoryIds={['3']}
      calendarDays={{ [SELECTED]: [] }}
      onQuickAddRoutine={save}
    />,
  );
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  await fireEvent.press(ui.getByLabelText('선택한 날에 추가'));
  await fireEvent.press(ui.getAllByRole('tab', { name: '할 일' }).at(-1)!);
  await fireEvent.press(ui.getByLabelText('추가 설정'));
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  expect(ui.queryByRole('radio', { name: '집 미션' })).toBeNull();
  expect(ui.queryByRole('radio', { name: '차단된 카테고리' })).toBeNull();
  expect(ui.queryByRole('radio', { name: '삭제된 카테고리' })).toBeNull();
  await fireEvent.press(ui.getByRole('radio', { name: '생활' }));
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '분류한 투두');
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('1', '분류한 투두', SELECTED));
  await waitFor(() =>
    expect(
      ui.getAllByRole('tab', { name: '할 일' }).at(-1)!.props.accessibilityState.selected,
    ).toBe(true),
  );
});

it('할 일 필터의 +는 할 일로 열리고 루틴 저장 후 첫 실행일과 루틴 필터로 이동한다', async () => {
  const create = jest.fn().mockResolvedValue(true);
  const select = jest.fn();
  const ui = await render(
    <MyRoomScreen
      view="calendar"
      today={TODAY}
      selectedDate={TODAY}
      routines={[]}
      categories={[]}
      onCreateRoutine={create}
      onSelectedDateChange={select}
    />,
  );
  await fireEvent.press(ui.getByRole('tab', { name: '할 일' }));
  await fireEvent.press(ui.getByLabelText('선택한 날에 추가'));
  expect(ui.getByLabelText('할 일 제목')).toBeTruthy();
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '금요일 독서');
  await fireEvent.press(ui.getAllByRole('tab', { name: '루틴' }).at(-1)!);
  await fireEvent.press(ui.getByLabelText('반복 선택'));
  await fireEvent.press(ui.getByLabelText('매주'));
  await fireEvent.press(ui.getByLabelText('금요일'));
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() => expect(select).toHaveBeenCalledWith('2026-09-11'));
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ title: '금요일 독서', days: [5], category: '' }),
  );
  await waitFor(() =>
    expect(ui.getByRole('tab', { name: '루틴' }).props.accessibilityState.selected).toBe(true),
  );
});

it('개인 카테고리의 +도 루틴으로 열며 카테고리만 미리 채운다', async () => {
  const create = jest.fn().mockResolvedValue(true);
  const ui = await render(
    <MyRoomScreen
      view="room"
      today={TODAY}
      routines={[]}
      categories={[
        { id: '20', name: '생활', icon: 'sun', color: '#7FA87F', visibility: 'private' },
      ]}
      onCreateRoutine={create}
    />,
  );
  await fireEvent.press(ui.getByLabelText('생활에 추가'));
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '산책');
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '산책', category: '20', startDate: TODAY }),
    ),
  );
});
