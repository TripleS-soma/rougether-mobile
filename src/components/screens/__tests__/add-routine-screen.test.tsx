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
      expect.objectContaining({ title: '독서 30분', emoji: '📖', category: '취미' }),
    );
  });

  it('does not submit without a title', async () => {
    const onAdd = jest.fn();
    const { getByText } = await render(<AddRoutineScreen onAdd={onAdd} />);

    await fireEvent.press(getByText('루틴 추가하기'));

    expect(onAdd).not.toHaveBeenCalled();
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
});
