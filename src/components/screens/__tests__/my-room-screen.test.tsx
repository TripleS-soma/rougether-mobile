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

  it('shows a kebab menu button per routine and a quick-add button per category', async () => {
    const { getByLabelText } = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    // Per-routine kebab (수정/삭제 menu trigger).
    expect(getByLabelText('물 2L 마시기 메뉴')).toBeTruthy();
    expect(getByLabelText('하루 회고 메뉴')).toBeTruthy();
    // Per-category quick-add todo button.
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();
  });

  // Camera test last: its photo path leaves a resolved promise that can disrupt
  // a following test's render in this harness.
  it('requires a camera photo to complete a 인증사진형 routine', async () => {
    const onToggleRoutine = jest.fn();
    const onRequestPhoto = jest.fn().mockResolvedValue('file://verify.jpg');
    const { getByText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onToggleRoutine={onToggleRoutine}
        onRequestPhoto={onRequestPhoto}
      />,
    );

    // '하루 회고' (id 5): no photoVerify → toggles immediately.
    fireEvent.press(getByText('하루 회고'));
    expect(onToggleRoutine).toHaveBeenCalledWith('5');

    // '영어 공부' (id 4): photoVerify → camera, then toggle.
    fireEvent.press(getByText('영어 공부'));
    await waitFor(() => expect(onToggleRoutine).toHaveBeenCalledWith('4'));
    expect(onRequestPhoto).toHaveBeenCalled();
  });
});
