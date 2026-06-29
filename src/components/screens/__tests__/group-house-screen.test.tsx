import { fireEvent, render } from '@testing-library/react-native';

import { GroupHouseScreen } from '@/components/screens/group-house-screen';

describe('GroupHouseScreen', () => {
  it('renders the current house, members, and group goals', async () => {
    const { getByText } = await render(<GroupHouseScreen leafBalance={5600} />);
    expect(getByText('👑 소마파이팅')).toBeTruthy();
    expect(getByText('🍃 5,600')).toBeTruthy();
    expect(getByText('🎯 우리 그룹의 루틴')).toBeTruthy();
    expect(getByText('최준서')).toBeTruthy();
  });

  it('visits a friend room and my room on tap', async () => {
    const onVisitFriend = jest.fn();
    const onVisitMyRoom = jest.fn();
    const { getByText } = await render(
      <GroupHouseScreen onVisitFriend={onVisitFriend} onVisitMyRoom={onVisitMyRoom} />,
    );
    await fireEvent.press(getByText('최준서'));
    expect(onVisitFriend).toHaveBeenCalledWith('최준서');
    await fireEvent.press(getByText('나의 방 (나)'));
    expect(onVisitMyRoom).toHaveBeenCalled();
  });

  it('opens member management and kicks a member after confirming', async () => {
    const { getByText, getByLabelText, getAllByText, queryByText } = await render(
      <GroupHouseScreen />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(getByText('구성원 관리')).toBeTruthy();

    // First member's "강퇴" button opens the confirm modal.
    await fireEvent.press(getAllByText('강퇴')[0]);
    expect(getByText('정말 강퇴할까요?')).toBeTruthy();

    // The modal's "강퇴" (confirm) is the last occurrence in the tree.
    const kicks = getAllByText('강퇴');
    await fireEvent.press(kicks[kicks.length - 1]);
    expect(queryByText('정말 강퇴할까요?')).toBeNull();
    expect(getByText('강퇴된 멤버')).toBeTruthy();
  });
});
