import { fireEvent, render } from '@testing-library/react-native';

import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('AddRoutineScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<AddRoutineScreen />);
    expect(getByText('루틴 추가')).toBeTruthy();
  });

  it('applies a preset and submits a new routine', async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(<AddRoutineScreen onAdd={onAdd} />);

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

    // The dead-button mystery is gone: the tap says why and opens the manager.
    expect(getByText('카테고리가 필요해요 — 먼저 하나 만들어주세요.')).toBeTruthy();
    expect(queryByText('새 카테고리 만들기')).toBeTruthy();
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

  it('keeps unsupported cadences (격주/매월/매년) disabled', async () => {
    const { getByText, queryByText } = await render(<AddRoutineScreen />);
    await fireEvent.press(getByText('격주'));
    // Still weekly — the disabled option did not take over.
    expect(queryByText('반복 요일')).toBeTruthy();
    expect(getByText('격주·매월·매년은 서버 준비 중이에요.')).toBeTruthy();
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
