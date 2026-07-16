import { fireEvent, render } from '@testing-library/react-native';

import { GroupHouseScreen, type House } from '@/components/screens/group-house-screen';
import { ToastProvider } from '@/components/ui/toast';

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
    { id: 11, title: '주간 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
    { id: 12, title: '기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun' as const, current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
    { id: 13, title: '지난 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED' }, // prettier-ignore
  ],
};

describe('GroupHouseScreen', () => {
  it('renders the current house, members, and group missions', async () => {
    const { getByText, queryByText } = await render(<GroupHouseScreen />);
    expect(getByText('소마파이팅')).toBeTruthy();
    // The level pill shows the house's real growth level (demo: 3).
    expect(getByText('Lv.3')).toBeTruthy();
    // The header carries no coin balance (집 화면은 재화 소비 화면이 아니다).
    expect(queryByText('5,600')).toBeNull();
    expect(getByText('우리 그룹의 미션')).toBeTruthy();
    expect(getByText('이번 주 다같이 루틴 지키기')).toBeTruthy();
    // The demo owner's tile carries the 방장 crown.
    expect(getByText('최준서')).toBeTruthy();
  });

  it('keeps the visited house via the controlled index (#241)', async () => {
    // The screen unmounts while visiting a friend's room — the shell holds the
    // index and hands it back so the same house is shown after 뒤로가기.
    const onHouseIndexChange = jest.fn();
    const first = await render(
      <GroupHouseScreen houseIndex={0} onHouseIndexChange={onHouseIndexChange} />,
    );
    expect(first.getByText('소마파이팅')).toBeTruthy();
    await fireEvent.press(first.getByLabelText('다음 집'));
    expect(onHouseIndexChange).toHaveBeenCalledWith(1);

    // Fresh mount with the kept index = the friend-room round trip.
    const second = await render(
      <GroupHouseScreen houseIndex={1} onHouseIndexChange={onHouseIndexChange} />,
    );
    expect(second.getByText('소마 2번째 집')).toBeTruthy();
  });

  it('adds a mission to my routines through the confirm modal, and claims', async () => {
    const onAddMissionRoutine = jest.fn();
    const onClaimMission = jest.fn();
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={onAddMissionRoutine}
        onClaimMission={onClaimMission}
      />,
    );
    // 기여 버튼 대신 + → 확인 모달 → 네 = 집 카테고리 아래 루틴 생성 요청.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 내 루틴에 추가'));
    expect(getByText('내 루틴에 추가하시겠습니까?')).toBeTruthy();
    await fireEvent.press(getByLabelText('루틴 추가 확인'));
    expect(onAddMissionRoutine).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ id: 11, title: '주간 루틴 지키기' }),
    );
    await fireEvent.press(getByLabelText('기상 인증 모으기 보상 받기'));
    expect(onClaimMission).toHaveBeenCalledWith(7, 12);
    expect(getByText('완료')).toBeTruthy();
  });

  it('shows 기여됨/루틴 연동됨 labels instead of + when applicable', async () => {
    const { queryByLabelText, getByText } = await render(
      <GroupHouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ title: '주간 루틴 지키기' }]}
        contributedMissionIds={[12]}
      />,
    );
    // Linked mission: no + button, 연동 라벨.
    expect(queryByLabelText('주간 루틴 지키기 내 루틴에 추가')).toBeNull();
    expect(getByText('루틴 연동됨')).toBeTruthy();
    // Contributed-today mission (no claim handler → falls through to 기여함).
    expect(getByText('기여함')).toBeTruthy();
  });

  it('derives 기여함 from a linked routine completed today (재시작에도 유지)', async () => {
    const { getByText, queryByText } = await render(
      <GroupHouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ title: '주간 루틴 지키기', completedToday: true }]}
      />,
    );
    // 세션 추적(contributedMissionIds) 없이도 오늘 완료 = 기여함.
    expect(getByText('기여함')).toBeTruthy();
    expect(queryByText('루틴 연동됨')).toBeNull();
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

  it('explains a missing mission title with a toast instead of creating', async () => {
    const onCreateMission = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <GroupHouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.press(getByLabelText('미션 만들기 확인'));

    expect(getByText('미션 이름을 입력해주세요')).toBeTruthy();
    expect(onCreateMission).not.toHaveBeenCalled();
  });

  it('shows the empty-mission hint when the house has no missions', async () => {
    const { getByText } = await render(
      <GroupHouseScreen houses={[{ ...MISSION_HOUSE, missions: [] }]} />,
    );
    expect(getByText('아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!')).toBeTruthy();
  });

  it('renders a live room preview on tiles that have one, plain tile otherwise', async () => {
    const roomPreviews = {
      42: {
        placedFurnitureIds: ['bed'],
        wallpaperId: 'cream',
        floorId: null,
        backgroundId: null,
        characterId: 'otter' as const,
      },
    };
    const { queryAllByTestId, getByLabelText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} roomPreviews={roomPreviews} />,
    );
    // Only 멤버 42 has a preview — 43 keeps the plain tint tile.
    expect(queryAllByTestId('room-preview')).toHaveLength(1);
    // The preview renders the member's actual furniture and character.
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('수달')).toBeTruthy();
  });

  it('sends the mission period only when the toggle is on (KST day bounds)', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />,
    );

    // Toggle off (default): no period fields at all.
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '기간 없는 미션');
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    expect(onCreateMission).toHaveBeenLastCalledWith(
      7,
      expect.not.objectContaining({ startsAt: expect.anything() }),
    );

    // Toggle on: defaults to 오늘 ~ +7일, sent as KST day bounds.
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.changeText(getByLabelText('미션 제목'), '기간 있는 미션');
    await fireEvent.press(getByLabelText('기간 설정'));
    await fireEvent.press(getByLabelText('미션 만들기 확인'));
    const input = onCreateMission.mock.calls.at(-1)[1];
    expect(input.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+09:00$/);
    expect(input.endsAt).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\+09:00$/);
    expect(input.endsAt > input.startsAt).toBe(true);
  });

  it('shows the end date on active missions with a period', async () => {
    const house = {
      ...MISSION_HOUSE,
      missions: [
        { id: 21, title: '기간 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 0, target: 5, status: 'ACTIVE' as const, endsOn: '2026-07-23' }, // prettier-ignore
        { id: 22, title: '끝난 기간 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar' as const, current: 5, target: 5, status: 'COMPLETED' as const, endsOn: '2026-07-01' }, // prettier-ignore
      ],
    };
    const { getByText, queryByText } = await render(<GroupHouseScreen houses={[house]} />);
    expect(getByText('~07.23')).toBeTruthy();
    // Finished missions show their status, not a stale end date.
    expect(queryByText('~07.01')).toBeNull();
  });

  it('renders the cover hero with level progress and summary stats (B안)', async () => {
    const house = {
      ...MISSION_HOUSE,
      level: 1,
      growthPoints: 130,
      coverImageKey: 'house/cloud-balloon/frame.png',
    };
    const { getByTestId, getByText } = await render(
      <GroupHouseScreen
        houses={[house]}
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ title: '주간 루틴 지키기', completedToday: true }]}
      />,
    );
    // 커버 이미지 히어로 + 레벨 진행도 (130pt → 30/100, 다음 레벨까지 70).
    expect(getByTestId('house-hero-cover')).toBeTruthy();
    expect(getByText('Lv.1 · 30/100')).toBeTruthy();
    expect(getByText('70')).toBeTruthy();
    // 진행 중 미션 2(ACTIVE 11·12), 오늘 나의 기여 1/2 (11이 연동 완료).
    expect(getByText('2')).toBeTruthy();
    expect(getByText('1/2')).toBeTruthy();
    // + 버튼은 텍스트로 목적을 말한다.
    expect(getByText('＋ 내 루틴에')).toBeTruthy();
  });

  it('falls back to a plain hero without a cover and hides nav for one house', async () => {
    const { queryByTestId, queryByLabelText, getByText } = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} />,
    );
    expect(queryByTestId('house-hero-cover')).toBeNull();
    expect(getByText('실집')).toBeTruthy();
    // 집이 하나면 히어로 좌우 전환 화살표가 없다.
    expect(queryByLabelText('이전 집')).toBeNull();
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

  it('prefills the current cover, sends the new pick, and hides the section without a catalog', async () => {
    const covers = [
      { code: 'cloud', name: '구름 풍선 집', coverImageKey: 'house/cloud-balloon/f.png' },
      { code: 'coral', name: '산호 수족관 집', coverImageKey: 'house/coral-aquarium/f.png' },
    ];
    const onUpdateHouse = jest.fn();
    const { getByLabelText, getByText } = await render(
      <GroupHouseScreen
        houses={[{ ...MISSION_HOUSE, coverImageKey: 'house/cloud-balloon/f.png' }]}
        covers={covers}
        onUpdateHouse={onUpdateHouse}
      />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    await fireEvent.press(getByLabelText('집 정보 수정'));
    expect(getByText('대표 이미지')).toBeTruthy();
    // The house's current cover arrives pre-selected.
    expect(getByLabelText('구름 풍선 집 커버').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(getByLabelText('산호 수족관 집 커버'));
    await fireEvent.press(getByLabelText('집 정보 저장'));
    expect(onUpdateHouse).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ coverImageKey: 'house/coral-aquarium/f.png' }),
    );

    // No catalog (load failed / server empty) → the section stays hidden.
    const bare = await render(
      <GroupHouseScreen houses={[MISSION_HOUSE]} onUpdateHouse={jest.fn()} />,
    );
    await fireEvent.press(bare.getByLabelText('구성원 목록'));
    await fireEvent.press(bare.getByLabelText('집 정보 수정'));
    expect(bare.queryByText('대표 이미지')).toBeNull();
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
        onKickMember={jest.fn()}
        onCreateMission={jest.fn()}
      />,
    );
    // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
    expect(queryByLabelText('미션 만들기')).toBeNull();
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(queryByLabelText('집 정보 수정')).toBeNull();
    expect(queryByLabelText('친구 방장 위임')).toBeNull();
    // Kick is owner-only too.
    expect(queryByLabelText('친구 강퇴')).toBeNull();
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
    expect(getByText('방장')).toBeTruthy();
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
        // Kick is owner-only — a server-backed house shows it just to the OWNER.
        myRole: 'OWNER' as const,
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

  it('hides the kick button on my own card and uses a back button header', async () => {
    const onKickMember = jest.fn();
    const houses = [
      {
        title: '실집',
        houseId: 7,
        myRole: 'OWNER' as const,
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
    const { getByLabelText, getByText, queryByLabelText } = await render(
      <GroupHouseScreen houses={houses} onKickMember={onKickMember} />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    // 내 카드엔 강퇴 버튼이 아예 없다 (disabled가 아니라 미노출).
    expect(getByLabelText('친구 강퇴')).toBeTruthy();
    expect(queryByLabelText('나 강퇴')).toBeNull();
    // 헤더는 X 대신 다른 화면과 같은 왼쪽 뒤로가기.
    expect(queryByLabelText('닫기')).toBeNull();
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(getByText('우리 그룹의 미션')).toBeTruthy();
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
