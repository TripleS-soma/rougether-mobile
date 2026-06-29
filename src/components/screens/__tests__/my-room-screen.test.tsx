import { fireEvent, render } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('MyRoomScreen', () => {
  it('renders the room title, streak, and routine progress', async () => {
    const { getByText } = await render(
      <MyRoomScreen userName="준서" streakDays={7} routines={SAMPLE_ROUTINES} />,
    );
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('🔥 7일')).toBeTruthy();
    // 3 of 5 sample routines completed.
    expect(getByText('3 / 5')).toBeTruthy();
  });

  it('toggles a routine and opens the add flow', async () => {
    const onToggleRoutine = jest.fn();
    const onAddRoutine = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onToggleRoutine={onToggleRoutine}
        onAddRoutine={onAddRoutine}
      />,
    );

    fireEvent.press(getByLabelText('영어 공부'));
    expect(onToggleRoutine).toHaveBeenCalledWith('4');

    fireEvent.press(getByLabelText('루틴 추가'));
    expect(onAddRoutine).toHaveBeenCalled();
  });
});
