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

  it('renders the server guestbook and writes through the API callback', async () => {
    const onWriteGuestbook = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <FriendRoomScreen
        guestbook={[{ id: '1', author: '이웃준서', content: '방 예쁘다!', date: '7월 7일' }]}
        onWriteGuestbook={onWriteGuestbook}
      />,
    );
    expect(getByText('📖 방명록')).toBeTruthy();
    expect(getByText('이웃준서')).toBeTruthy();
    expect(getByText('방 예쁘다!')).toBeTruthy();
    // Server list replaces the demo entries.
    expect(queryByText('기상 인증 대단해요 👍')).toBeNull();

    await fireEvent.changeText(getByLabelText('방명록 입력'), '오늘도 화이팅!');
    await fireEvent.press(getByLabelText('방명록 남기기'));
    expect(onWriteGuestbook).toHaveBeenCalledWith('오늘도 화이팅!');
  });

  it('shows the empty hint and 더보기 pagination', async () => {
    const onLoadMoreGuestbook = jest.fn();
    const empty = await render(<FriendRoomScreen guestbook={[]} />);
    expect(empty.getByText('아직 방명록이 없어요. 첫 인사를 남겨보세요!')).toBeTruthy();

    const paged = await render(
      <FriendRoomScreen
        guestbook={[{ id: '1', author: 'a', content: 'b', date: 'c' }]}
        guestbookHasNext
        onLoadMoreGuestbook={onLoadMoreGuestbook}
      />,
    );
    await fireEvent.press(paged.getByLabelText('방명록 더보기'));
    expect(onLoadMoreGuestbook).toHaveBeenCalled();
  });

  it('keeps a local demo guestbook when unwired', async () => {
    const { getByText, getByLabelText } = await render(<FriendRoomScreen />);
    expect(getByText('기상 인증 대단해요 👍')).toBeTruthy();
    await fireEvent.changeText(getByLabelText('방명록 입력'), '데모 방명록');
    await fireEvent.press(getByLabelText('방명록 남기기'));
    expect(getByText('데모 방명록')).toBeTruthy();
  });
});
