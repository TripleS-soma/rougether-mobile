import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

  it('toggles routines, requiring a camera photo only for 인증사진형 ones', async () => {
    const onToggleRoutine = jest.fn();
    const onAddRoutine = jest.fn();
    // First photo request is cancelled (null), the second returns a photo.
    const onRequestPhoto = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue('file://verify.jpg');
    const { getByText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onToggleRoutine={onToggleRoutine}
        onAddRoutine={onAddRoutine}
        onRequestPhoto={onRequestPhoto}
      />,
    );

    // '하루 회고' (id 5): no photoVerify → toggles immediately, no camera.
    fireEvent.press(getByText('하루 회고'));
    expect(onToggleRoutine).toHaveBeenCalledWith('5');
    expect(onRequestPhoto).not.toHaveBeenCalled();

    // '영어 공부' (id 4): photoVerify → camera. Cancelled first → no toggle.
    fireEvent.press(getByText('영어 공부'));
    await waitFor(() => expect(onRequestPhoto).toHaveBeenCalledTimes(1));
    expect(onToggleRoutine).not.toHaveBeenCalledWith('4');

    // Try again, photo taken → toggles.
    fireEvent.press(getByText('영어 공부'));
    await waitFor(() => expect(onToggleRoutine).toHaveBeenCalledWith('4'));

    fireEvent.press(getByText('＋'));
    expect(onAddRoutine).toHaveBeenCalled();
  });
});
