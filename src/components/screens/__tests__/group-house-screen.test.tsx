import { fireEvent, render } from '@testing-library/react-native';

import { GroupHouseScreen, type House } from '@/components/screens/group-house-screen';

const MISSION_HOUSE: House = {
  houseId: 7,
  title: '실집',
  myRole: 'OWNER',
  description: '아침 루틴 집',
  maxMembers: 4,
  memberCount: 2,
  floors: [
    {
      level: '1층',
      rooms: [
        { name: '친구', color: '#F5E1D8', membershipId: 42 },
        { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
      ],
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
    // The crown pill shows the house's real growth level (demo: 3).
    expect(getByText('👑 Lv.3')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
    expect(getByText('🎯 우리 그룹의 미션')).toBeTruthy();
    expect(getByText('이번 주 다같이 루틴 지키기')).toBeTruthy();
    // The demo owner's tile carries the 방장 crown.
    expect(getByText('👑 최준서')).toBeTruthy();
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

  it('lets the owner edit the house settings', async () => {
    const onUpdateHouse = jest.fn();
    const { getByLabelText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onUpdateHouse={onUpdateHouse} />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getByLabelText('집 정보 수정'));
    await fireEvent.changeText(getByLabelText('집 이름'), '저녁 루틴 하우스');
    await fireEvent.changeText(getByLabelText('집 소개'), '저녁 루틴으로 바꿨어요');
    await fireEvent.press(getByLabelText('정원 6명'));
    await fireEvent.press(getByLabelText('집 정보 저장'));
    expect(onUpdateHouse).toHaveBeenCalledWith(7, {
      name: '저녁 루틴 하우스',
      description: '저녁 루틴으로 바꿨어요',
      maxMembers: 6,
    });
  });

  it('transfers ownership to a member after confirming', async () => {
    const onTransferOwnership = jest.fn();
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onTransferOwnership={onTransferOwnership} />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getByLabelText('친구 방장 위임'));
    expect(getByText('방장을 위임할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('위임 확인'));
    expect(onTransferOwnership).toHaveBeenCalledWith(7, 42);
  });

  it('hides the owner tools from plain members', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <GroupHouseScreen
        houses={[{ ...MISSION_HOUSE, myRole: 'MEMBER' }]}
        onUpdateHouse={jest.fn()}
        onTransferOwnership={jest.fn()}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(queryByLabelText('집 정보 수정')).toBeNull();
    expect(queryByLabelText('친구 방장 위임')).toBeNull();
  });

  it('reissues the invite code after confirming (owner)', async () => {
    const onReissueInviteCode = jest.fn();
    const { getByText, getByLabelText } = await render(
      <GroupHouseScreen
        houses={[{ ...MISSION_HOUSE, inviteCode: 'ABCD2345' }]}
        onReissueInviteCode={onReissueInviteCode}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getByLabelText('초대코드 재발급'));
    expect(getByText('초대코드를 재발급할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('재발급 확인'));
    expect(onReissueInviteCode).toHaveBeenCalledWith(7);
  });

  it('hides the reissue button from plain members', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <GroupHouseScreen
        houses={[{ ...MISSION_HOUSE, inviteCode: 'ABCD2345', myRole: 'MEMBER' }]}
        onReissueInviteCode={jest.fn()}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(queryByLabelText('초대코드 재발급')).toBeNull();
  });

  it('leaves the house after confirming (member)', async () => {
    const onLeaveHouse = jest.fn();
    const { getByText, getByLabelText } = await render(
      <GroupHouseScreen
        houses={[{ ...MISSION_HOUSE, myRole: 'MEMBER' }]}
        onLeaveHouse={onLeaveHouse}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getByLabelText('집 나가기'));
    expect(getByText('집에서 나갈까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('나가기 확인'));
    expect(onLeaveHouse).toHaveBeenCalledWith(7);
  });

  it('guides the owner to transfer ownership instead of leaving', async () => {
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onLeaveHouse={jest.fn()} />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(queryByLabelText('집 나가기')).toBeNull();
    expect(getByText('방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.')).toBeTruthy();
  });

  it('visits a friend room and my room on tap', async () => {
    const onVisitFriend = jest.fn();
    const onVisitMyRoom = jest.fn();
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen onVisitFriend={onVisitFriend} onVisitMyRoom={onVisitMyRoom} />,
    );
    // Tiles are addressed by accessibility label — the crown decorates the text.
    await fireEvent.press(getByLabelText('최준서'));
    expect(onVisitFriend).toHaveBeenCalledWith(expect.objectContaining({ name: '최준서' }));
    await fireEvent.press(getByText('나의 방 (나)'));
    expect(onVisitMyRoom).toHaveBeenCalled();
  });

  it('marks the owner in the member management list', async () => {
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen
        houses={[
          {
            ...MISSION_HOUSE,
            floors: [
              {
                level: '1층',
                rooms: [
                  { name: '친구', color: '#F5E1D8', membershipId: 42, isOwner: true },
                  { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 },
                ],
              },
            ],
          },
        ]}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(getByText('👑 방장')).toBeTruthy();
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
