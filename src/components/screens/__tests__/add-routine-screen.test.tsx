import { fireEvent, render } from '@testing-library/react-native';

import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('AddRoutineScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<AddRoutineScreen />);
    expect(getByText('루틴 추가')).toBeTruthy();
  });

  it('keeps the presets collapsed until the header is tapped', async () => {
    const { getByText, queryByText } = await render(<AddRoutineScreen />);

    // Closed by default — regulars aren't shown suggestions they don't need.
    expect(getByText('추천 루틴')).toBeTruthy();
    expect(queryByText('독서 30분')).toBeNull();

    await fireEvent.press(getByText('추천 루틴'));
    expect(getByText('독서 30분')).toBeTruthy();

    // Tapping the header again folds them away.
    await fireEvent.press(getByText('추천 루틴'));
    expect(queryByText('독서 30분')).toBeNull();
  });

  it('applies a preset and submits a new routine', async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(<AddRoutineScreen onAdd={onAdd} />);

    await fireEvent.press(getByText('추천 루틴')); // unfold the accordion
    await fireEvent.press(getByText('독서 30분'));
    await fireEvent.press(getByText('루틴 추가하기'));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: '독서 30분', category: '취미' }),
    );
  });

  it('does not submit without a title', async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(<AddRoutineScreen onAdd={onAdd} />);

    await fireEvent.press(getByText('루틴 추가하기'));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('does not submit without a category (uncategorized routines cannot exist)', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <AddRoutineScreen categories={[]} onAdd={onAdd} />,
    );

    expect(getByText(/카테고리가 없어요/)).toBeTruthy();
    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('explains the blocker and opens the category manager on tap (fresh account)', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <AddRoutineScreen categories={[]} onAdd={onAdd} />,
    );

    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));

    // The dead-button mystery is gone: the tap says why and opens the
    // quick-create sheet (#394 — 전체 관리는 카테고리 관리 화면으로 분리됨).
    expect(getByText('카테고리가 필요해요 — 먼저 하나 만들어주세요.')).toBeTruthy();
    expect(queryByText('새 카테고리')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('explains a missing title on tap', async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(<AddRoutineScreen onAdd={onAdd} />);
    await fireEvent.press(getByText('루틴 추가하기'));
    expect(getByText('루틴 이름을 입력해주세요.')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows the day picker only for 매주 and submits 매일 with no days', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <AddRoutineScreen onAdd={onAdd} />,
    );

    // Weekly by default — the day picker is visible.
    expect(queryByText('반복 요일')).toBeTruthy();

    await fireEvent.press(getByText('매일'));
    expect(queryByText('반복 요일')).toBeNull();

    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: '산책', days: [] }));
  });

  it('submits 격주 with its repeat days (#255)', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <AddRoutineScreen onAdd={onAdd} />,
    );

    await fireEvent.press(getByText('격주'));
    expect(queryByText('반복 요일')).toBeTruthy();

    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ repeat: 'biweekly', days: [1, 2, 3, 4, 5] }),
    );
  });

  it('submits 매월 with the picked day and 매년 with month+day (#255)', async () => {
    const onAdd = jest.fn();
    const ui = await render(<AddRoutineScreen onAdd={onAdd} />);

    await fireEvent.changeText(ui.getByPlaceholderText('예) 매일 30분 산책'), '결산');
    await fireEvent.press(ui.getByText('매월'));
    expect(ui.queryByText('반복 요일')).toBeNull();
    await fireEvent.press(ui.getByLabelText('15일'));
    await fireEvent.press(ui.getByText('루틴 추가하기'));
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ repeat: 'monthly', dayOfMonth: 15, month: undefined, days: [] }),
    );

    const yearly = await render(<AddRoutineScreen onAdd={onAdd} />);
    await fireEvent.changeText(yearly.getByPlaceholderText('예) 매일 30분 산책'), '기념일');
    await fireEvent.press(yearly.getByText('매년'));
    await fireEvent.press(yearly.getByLabelText('7월'));
    await fireEvent.press(yearly.getByLabelText('12일'));
    await fireEvent.press(yearly.getByText('루틴 추가하기'));
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ repeat: 'yearly', month: 7, dayOfMonth: 12 }),
    );
  });

  it('blocks saving 매주 with no day picked and toasts', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <ToastProvider>
        <AddRoutineScreen onAdd={onAdd} />
      </ToastProvider>,
    );

    // Weekly default preselects 월~금 — deselect them all.
    for (const d of ['월', '화', '수', '목', '금']) await fireEvent.press(getByText(d));
    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));

    expect(getByText('반복 요일을 하나 선택해주세요')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('asks for a day before the server-pending message on 격주 with no day', async () => {
    const onAdd = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = await render(
      <ToastProvider>
        <AddRoutineScreen onAdd={onAdd} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('격주'));
    for (const d of ['월', '화', '수', '목', '금']) await fireEvent.press(getByText(d));
    await fireEvent.changeText(getByPlaceholderText('예) 매일 30분 산책'), '산책');
    await fireEvent.press(getByText('루틴 추가하기'));

    // The missing day is the actionable problem — the cadence pending message
    // only shows once days are picked.
    expect(getByText('반복 요일을 하나 선택해주세요')).toBeTruthy();
    expect(queryByText('이 반복 주기는 서버 준비가 끝나면 저장할 수 있어요.')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows a day-of-month picker for 매월', async () => {
    const { getByText, queryByText, getByLabelText } = await render(<AddRoutineScreen />);
    await fireEvent.press(getByText('매월'));
    expect(queryByText('반복 요일')).toBeNull();
    expect(queryByText('반복 일자')).toBeTruthy();
    await fireEvent.press(getByLabelText('31일'));
    expect(getByLabelText('31일').props.accessibilityState.selected).toBe(true);
  });

  it('shows month + day pickers for 매년', async () => {
    const { getByText, queryByText, getByLabelText } = await render(<AddRoutineScreen />);
    await fireEvent.press(getByText('매년'));
    expect(queryByText('반복 월')).toBeTruthy();
    expect(queryByText('반복 일자')).toBeTruthy();
    await fireEvent.press(getByLabelText('12월'));
    expect(getByLabelText('12월').props.accessibilityState.selected).toBe(true);
  });

  it('prefills 매일 for a routine without repeat days', async () => {
    const routine = { id: 'r9', title: '스트레칭', category: '건강', kind: 'routine' as const };
    const { queryByText } = await render(<AddRoutineScreen editRoutine={routine} />);
    expect(queryByText('반복 요일')).toBeNull();
  });

  it('prefills the form and updates in edit mode', async () => {
    const onUpdate = jest.fn();
    const routine = SAMPLE_ROUTINES[3]; // '영어 공부' (id 4)
    const { getByText, getByDisplayValue } = await render(
      <AddRoutineScreen editRoutine={routine} onUpdate={onUpdate} />,
    );

    expect(getByText('루틴 수정')).toBeTruthy();
    expect(getByDisplayValue('영어 공부')).toBeTruthy(); // title prefilled

    await fireEvent.press(getByText('수정하기'));
    expect(onUpdate).toHaveBeenCalledWith('4', expect.objectContaining({ title: '영어 공부' }));
  });

  it('asks for confirmation before deleting in edit mode', async () => {
    const onDelete = jest.fn();
    const onBack = jest.fn();
    const routine = SAMPLE_ROUTINES[3]; // '영어 공부' (id 4)
    const { getByText, getByLabelText } = await render(
      <AddRoutineScreen editRoutine={routine} onDelete={onDelete} onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('루틴 삭제'));
    expect(getByText(/루틴을 삭제할까요/)).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('삭제'));
    expect(onDelete).toHaveBeenCalledWith('4');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the routine when the delete confirm is cancelled', async () => {
    const onDelete = jest.fn();
    const onBack = jest.fn();
    const routine = SAMPLE_ROUTINES[3];
    const { queryByText, getByLabelText } = await render(
      <AddRoutineScreen editRoutine={routine} onDelete={onDelete} onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('루틴 삭제'));
    await fireEvent.press(getByLabelText('취소'));

    expect(queryByText(/루틴을 삭제할까요/)).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
