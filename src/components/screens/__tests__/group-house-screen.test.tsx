import { fireEvent, render } from '@testing-library/react-native';

import { GroupHouseScreen, type House } from '@/components/screens/group-house-screen';

const MISSION_HOUSE: House = {
  houseId: 7,
  title: '실집',
  myRole: 'OWNER',
  floors: [
    {
      level: '1층',
      rooms: [{ name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 }],
    },
  ],
  missions: [
    { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', emoji: '📅', current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
    { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', emoji: '☀️', current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
    { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', emoji: '📅', current: 5, target: 5, status: 'COMPLETED' }, // prettier-ignore
  ],
};

describe('GroupHouseScreen', () => {
  it('renders the current house, members, and group missions', async () => {
    const { getByText } = await render(<GroupHouseScreen coinBalance={5600} />);
    expect(getByText('👑 소마파이팅')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
    expect(getByText('🎯 우리 그룹의 미션')).toBeTruthy();
    expect(getByText('이번 주 다같이 루틴 지키기')).toBeTruthy();
    expect(getByText('최준서')).toBeTruthy();
  });

  it('contributes and claims via the API callbacks', async () => {
    const onContributeMission = jest.fn();
    const onClaimMission = jest.fn();
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen
        houses={[MISSION_HOUSE]}
        onContributeMission={onContributeMission}
        onClaimMission={onClaimMission}
      />,
    );
    await fireEvent.press(getByLabelText('주간 루틴 지키기 기여하기'));
    expect(onContributeMission).toHaveBeenCalledWith(7, 11);
    await fireEvent.press(getByLabelText('기상 인증 모으기 보상 받기'));
    expect(onClaimMission).toHaveBeenCalledWith(7, 12);
    expect(getByText('완료 🎉')).toBeTruthy();
  });

  it('creates a mission through the modal', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '새 미션');
    await fireEvent.changeText(getByLabelText('목표 수치'), '15');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).toHaveBeenCalledWith(7, {
      title: '새 미션',
      missionType: 'WEEKLY_MEMBER_COUNT',
      targetValue: 15,
    });
  });

  it('shows the empty-mission hint when the house has no missions', async () => {
    const { getByText } = await render(
      <GroupHouseScreen houses={[{ ...MISSION_HOUSE, missions: [] }]} />,
    );
    expect(getByText('아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!')).toBeTruthy();
  });

  it('visits a friend room and my room on tap', async () => {
    const onVisitFriend = jest.fn();
    const onVisitMyRoom = jest.fn();
    const { getByText } = await render(
      <GroupHouseScreen onVisitFriend={onVisitFriend} onVisitMyRoom={onVisitMyRoom} />,
    );
    await fireEvent.press(getByText('최준서'));
    expect(onVisitFriend).toHaveBeenCalledWith(expect.objectContaining({ name: '최준서' }));
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
