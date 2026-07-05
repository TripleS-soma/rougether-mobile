import { fireEvent, render } from '@testing-library/react-native';

import { GroupHouseScreen } from '@/components/screens/group-house-screen';

describe('GroupHouseScreen', () => {
  it('renders the current house, members, and group goals', async () => {
    const { getByText } = await render(<GroupHouseScreen coinBalance={5600} />);
    expect(getByText('👑 소마파이팅')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
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

  it('shows the guided empty state when there are no houses', async () => {
    const onOpenSearch = jest.fn();
    const { getByText, getByLabelText } = await render(
      <GroupHouseScreen houses={[]} onOpenSearch={onOpenSearch} />,
    );
    expect(getByText('아직 함께하는 집이 없어요')).toBeTruthy();
    await fireEvent.press(getByLabelText('집 탐색'));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('kicks via the API callback when the house carries server ids', async () => {
    const onKickMember = jest.fn();
    const houses = [
      {
        houseId: 7,
        title: '실집',
        inviteCode: 'ABC-123',
        floors: [
          {
            level: '1층',
            rooms: [
              { name: '친구', color: '#F5E1D8', membershipId: 42 },
              { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
            ],
          },
        ],
      },
    ];
    const { getByLabelText, getAllByText } = await render(
      <GroupHouseScreen houses={houses} onKickMember={onKickMember} />,
    );

    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getAllByText('강퇴')[0]);
    const kicks = getAllByText('강퇴');
    await fireEvent.press(kicks[kicks.length - 1]);

    expect(onKickMember).toHaveBeenCalledWith(7, 42);
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
