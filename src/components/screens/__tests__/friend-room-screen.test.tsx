import { fireEvent, render } from '@testing-library/react-native';

import { FriendRoomScreen } from '@/components/screens/friend-room-screen';

describe('FriendRoomScreen', () => {
  it('renders the friend name, routine progress, and cheer buttons', async () => {
    const { getByText } = await render(<FriendRoomScreen friendName="민지" />);
    expect(getByText('민지의 방')).toBeTruthy();
    expect(getByText('민지의 루틴')).toBeTruthy();
    // 4 of 5 default routines completed.
    expect(getByText('4 / 5')).toBeTruthy();
    expect(getByText('👍 잘하고 있어!')).toBeTruthy();
  });

  it('fires onCheer with the chosen reaction', async () => {
    const onCheer = jest.fn();
    const { getByText } = await render(<FriendRoomScreen onCheer={onCheer} />);
    await fireEvent.press(getByText('💛 응원하기'));
    expect(onCheer).toHaveBeenCalledWith('support');
  });
});
