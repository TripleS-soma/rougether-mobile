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
    await fireEvent.press(
      ui.getByLabelText(view === 'room' ? '오늘 할 일 추가' : '이 날에 할 일 추가'),
    );
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
  await fireEvent.press(ui.getByLabelText('이 날에 할 일 추가'));
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  expect(ui.queryByRole('radio', { name: '집 미션' })).toBeNull();
  expect(ui.queryByRole('radio', { name: '차단된 카테고리' })).toBeNull();
  expect(ui.queryByRole('radio', { name: '삭제된 카테고리' })).toBeNull();
  await fireEvent.press(ui.getByRole('radio', { name: '생활' }));
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '분류한 투두');
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('1', '분류한 투두', SELECTED));
  await waitFor(() =>
    expect(ui.getByRole('tab', { name: '할 일' }).props.accessibilityState.selected).toBe(true),
  );
});
