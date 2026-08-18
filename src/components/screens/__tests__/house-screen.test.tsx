import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { cameraClaimsMove, HouseScreen, type House } from '@/components/screens/house-screen';

const MISSION_HOUSE: House = {
  houseId: 7,
  name: '실집',
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

describe('HouseScreen', () => {
  it('하늘색이 시간대에 따라 바뀐다 (#358)', async () => {
    const skyOf = async (hour: number) => {
      const ui = await render(<HouseScreen houses={[MISSION_HOUSE]} nowHour={hour} />);
      return StyleSheet.flatten(ui.getByTestId('sky-section').props.style).backgroundColor;
    };
    expect(await skyOf(10)).toBe('#C3E0F5'); // 낮 = 기존 sky
    expect(await skyOf(6)).toBe('#DCD6EC'); // 새벽
    expect(await skyOf(18)).toBe('#F6CDAB'); // 노을
    expect(await skyOf(22)).toBe('#3E4A6B'); // 밤
  });

  it('비가 오면 시간대와 무관하게 흐린 하늘 + 빗줄기 (#360)', async () => {
    const ui = await render(<HouseScreen houses={[MISSION_HOUSE]} nowHour={10} raining />);
    const style = StyleSheet.flatten(ui.getByTestId('sky-section').props.style);
    expect(style.backgroundColor).toBe('#A9B3C2');
    expect(ui.getByTestId('rain-overlay')).toBeTruthy();
  });

  it('헤더에 닉네임·스트릭 프로필 블록과 코인·다이아 지갑 필이 보인다 (#420)', async () => {
    const { getByText, queryByText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        userName="채영"
        streakDays={4}
        coinBalance={1200}
        diamondBalance={34}
      />,
    );
    expect(queryByText('함께 크는 집')).toBeNull();
    expect(getByText('채영')).toBeTruthy();
    expect(getByText('4일')).toBeTruthy();
    expect(getByText('1,200')).toBeTruthy();
    expect(getByText('34')).toBeTruthy();
  });

  it('스트릭 0일이면 스트릭 라벨을 숨긴다 (#420)', async () => {
    const { queryByText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} userName="채영" streakDays={0} />,
    );
    expect(queryByText(/0일/)).toBeNull();
  });

  it('헤더에 코인·다이아 필을 함께 보여준다 (프로필 아바타 제거로 확보한 자리)', async () => {
    const { getByText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        userName="채영"
        coinBalance={1200}
        diamondBalance={34}
      />,
    );
    // 아바타를 빼고 다이아를 상시 노출 — 좁은 폭 코인-only(#425)를 되돌림.
    expect(getByText('채영')).toBeTruthy();
    expect(getByText('1,200')).toBeTruthy();
    expect(getByText('34')).toBeTruthy();
  });

  it('shows a green dot for online members and a last-seen label offline (#383)', async () => {
    const presenceHouse: House = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '친구', color: '#F5E1D8', membershipId: 42, lastSeenLabel: '3시간 전' },
            { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43, online: true },
          ],
        },
      ],
    };
    const { getByText, getByTestId, getByLabelText } = await render(
      <HouseScreen houses={[presenceHouse]} userName="나" />,
    );
    // 접속 중인 내 타일: 초록 점 + 접근성 라벨, 상대 시각 없음.
    expect(getByTestId('online-dot')).toBeTruthy();
    expect(getByLabelText('나 (나), 접속 중')).toBeTruthy();
    // 오프라인 친구 타일: 마지막 접속 상대 시각.
    expect(getByText('3시간 전')).toBeTruthy();
    expect(getByLabelText('친구, 3시간 전 접속')).toBeTruthy();
  });

  it('내 타일 이름은 stale한 houses 값이 아니라 라이브 userName을 쓴다 (#479)', async () => {
    const staleHouse: House = {
      name: '테스트 집',
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '옛날닉', color: '#E8E0D0', isMine: true, membershipId: 43 },
            { name: '친구', color: '#F5E1D8', membershipId: 42 },
          ],
        },
      ],
    };
    const { getByText, queryByText } = await render(
      <HouseScreen houses={[staleHouse]} userName="새닉네임" />,
    );
    // 닉네임을 바꾸면(=userName) 집 타일도 즉시 새 이름으로 — 옛 이름은 사라진다.
    expect(getByText('새닉네임 (나)')).toBeTruthy();
    expect(queryByText('옛날닉 (나)')).toBeNull();
    // 친구 타일은 houses 값 그대로.
    expect(getByText('친구')).toBeTruthy();
  });

  it('renders the current house, members, and group missions', async () => {
    const { getByText, queryByText } = await render(<HouseScreen onOpenMissions={jest.fn()} />);
    expect(getByText('소마파이팅')).toBeTruthy();
    // The level pill shows the house's real growth level (demo: 3).
    expect(getByText('Lv.3')).toBeTruthy();
    // The header carries no coin balance (집 화면은 재화 소비 화면이 아니다).
    expect(queryByText('5,600')).toBeNull();
    // The demo owner's tile carries the 방장 crown.
    expect(getByText('최준서')).toBeTruthy();
    // 공동 미션은 요약 줄로 화면에 드러난다 (#875) — 예전엔 FAB 뒤에 숨어
    // 누르기 전엔 우리 집이 뭘 하는지 보이지 않았다.
    expect(getByText('우리 집의 목표')).toBeTruthy();
  });

  /**
   * 공동 미션 요약 줄 (#875) — 예전엔 우하단 FAB 뒤에 통째로 숨어서, 집에
   * 들어와도 우리 집이 뭘 하는지 **누르기 전엔** 보이지 않았다. FAB은 없앴다:
   * 요약 줄이 진입점이라 진입점을 둘로 두지 않는다(#856과 같은 결).
   */
  it('요약 줄이 진행 상황을 보여주고 탭하면 미션 화면을 연다 (#875)', async () => {
    const onOpenMissions = jest.fn();
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
        onOpenMissions={onOpenMissions}
      />,
    );
    expect(getByText('우리 집의 목표')).toBeTruthy();
    // ACTIVE 2개 중 11이 오늘 완료 → 1/2.
    expect(getByText('오늘 1/2')).toBeTruthy();
    // 12가 achieved라 받을 보상이 있다 — 라벨로도 알린다.
    await fireEvent.press(getByLabelText(/우리 집의 목표, 받을 보상 1개/));
    expect(onOpenMissions).toHaveBeenCalled();
    // FAB은 사라졌다 — 진입점은 하나다.
    expect(queryByLabelText('공동 미션')).toBeNull();
  });

  it('미션이 없으면 요약 줄이 진행 중 없음으로 말한다 (#875)', async () => {
    const { getByText } = await render(
      <HouseScreen houses={[{ ...MISSION_HOUSE, missions: [] }]} onOpenMissions={jest.fn()} />,
    );
    expect(getByText('진행 중 없음')).toBeTruthy();
  });

  it('onOpenMissions가 없으면 요약 줄을 그리지 않는다', async () => {
    const { queryByText } = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
    expect(queryByText('우리 집의 목표')).toBeNull();
  });

  it('keeps the visited house via the controlled index (#241)', async () => {
    // The screen unmounts while visiting a friend's room — the shell holds the
    // index and hands it back so the same house is shown after 뒤로가기.
    const onHouseIndexChange = jest.fn();
    const first = await render(
      <HouseScreen houseIndex={0} onHouseIndexChange={onHouseIndexChange} />,
    );
    expect(first.getByText('소마파이팅')).toBeTruthy();
    await fireEvent.press(first.getByLabelText('다음 집'));
    expect(onHouseIndexChange).toHaveBeenCalledWith(1);

    // Fresh mount with the kept index = the friend-room round trip.
    const second = await render(
      <HouseScreen houseIndex={1} onHouseIndexChange={onHouseIndexChange} />,
    );
    expect(second.getByText('소마 2번째 집')).toBeTruthy();
  });

  // 집 전환 가로 플링 폐지 (#761) — 셸 탭 페이저(#563)와 같은 축을 다퉈
  // 불예측했다. 가로 스와이프는 항상 탭 전환이고, 집 순회는 ‹ › 화살표뿐.
  it('가로 플링으로는 집이 넘어가지 않는다 — 화살표만 (#761)', async () => {
    const onHouseIndexChange = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE, { ...MISSION_HOUSE, houseId: 8, name: '둘째집' }]}
        houseIndex={0}
        onHouseIndexChange={onHouseIndexChange}
      />,
    );
    // 플링 핸들러 자체가 사라졌다 — 등록된 제스처가 없다.
    expect(() => getByGestureTestId('house-carousel-fling')).toThrow();
    // 순회는 화살표로만.
    await fireEvent.press(getByLabelText('다음 집'));
    expect(onHouseIndexChange).toHaveBeenLastCalledWith(1);
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
      <HouseScreen houses={[MISSION_HOUSE]} roomPreviews={roomPreviews} />,
    );
    // Only 멤버 42 has a preview — 43 keeps the plain tint tile.
    expect(queryAllByTestId('room-preview')).toHaveLength(1);
    // The preview renders the member's actual furniture and character.
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('수달')).toBeTruthy();
  });

  it('renders the house frame with level progress (#287)', async () => {
    const house = {
      ...MISSION_HOUSE,
      level: 1,
      growthPoints: 130,
      coverImageKey: 'house/cloud-balloon/frame.png',
    };
    const { getByTestId, getByText } = await render(
      <HouseScreen
        houses={[house]}
        userName="나"
        onAddMissionRoutine={jest.fn()}
        onOpenMissions={jest.fn()}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
      />,
    );
    // 커버 프레임이 집 본체 — 창문 안에 좌석, 모서리에 레벨 진행도 pill.
    expect(getByTestId('house-frame')).toBeTruthy();
    // '다음 레벨까지 70'은 스탯 필과 함께 제거 (#761) — Lv 필의 30/100이 같은 정보.
    expect(getByText('Lv.1 · 30/100')).toBeTruthy();
    // 요약 스탯은 미션 시트로 이동 (#761) — 아래 시트 열기에서 단언.
    // 방 타일은 창문 안에서도 그대로 (정원 4 → 좌석 2 + 빈방 2).
    expect(getByText('나 (나)')).toBeTruthy();
    // 미션 상세는 별도 화면으로 옮겼다 (#875) — 여기선 요약 줄만 단언한다.
    // ACTIVE 2개(11·12) 중 11이 연동 완료라 오늘 기여 1/2.
    expect(getByText('오늘 1/2')).toBeTruthy();
  });

  it('frame tiles: a single tap visits after the double-tap window (#307)', async () => {
    const onVisitFriend = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen
        houses={[{ ...MISSION_HOUSE, coverImageKey: 'house/cloud-balloon/frame.png' }]}
        onVisitFriend={onVisitFriend}
      />,
    );
    await fireEvent.press(getByLabelText('친구'));
    // 탭 즉시 방문 (#727) — 더블탭 줌 제거로 판정 대기(260ms)가 사라졌다.
    expect(onVisitFriend).toHaveBeenCalledWith(
      expect.objectContaining({ name: '친구', membershipId: 42 }),
    );
  });

  it('frame tiles: rapid taps just visit — double-tap zoom removed (#727)', async () => {
    const onVisitFriend = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <HouseScreen
        houses={[{ ...MISSION_HOUSE, coverImageKey: 'house/cloud-balloon/frame.png' }]}
        onVisitFriend={onVisitFriend}
      />,
    );
    await fireEvent.press(getByLabelText('친구'));
    await fireEvent.press(getByLabelText('친구'));
    // 연속 탭은 방문 2회 — 줌(리셋 칩)은 더 이상 뜨지 않는다(핀치 전용).
    expect(onVisitFriend).toHaveBeenCalledTimes(2);
    expect(queryByLabelText('확대 종료')).toBeNull();
  });

  it('falls back to a plain hero without a cover and hides nav for one house', async () => {
    const { queryByTestId, queryByLabelText, getByText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} />,
    );
    expect(queryByTestId('house-hero-cover')).toBeNull();
    expect(getByText('실집')).toBeTruthy();
    // 집이 하나면 히어로 좌우 전환 화살표가 없다.
    expect(queryByLabelText('이전 집')).toBeNull();
  });

  it('hides the owner tools from plain members', async () => {
    const { queryByLabelText } = await render(
      <HouseScreen
        houses={[{ ...MISSION_HOUSE, myRole: 'MEMBER' }]}
        onUpdateHouse={jest.fn()}
        onTransferOwnership={jest.fn()}
        onKickMember={jest.fn()}
        onCreateMission={jest.fn()}
      />,
    );
    // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
    expect(queryByLabelText('미션 만들기')).toBeNull();
  });

  it('visits a friend room and my room on tap', async () => {
    const onVisitFriend = jest.fn();
    const onVisitMyRoom = jest.fn();
    const { getByLabelText, getByText } = await render(
      <HouseScreen
        userName="나의 방"
        onVisitFriend={onVisitFriend}
        onVisitMyRoom={onVisitMyRoom}
      />,
    );
    // Tiles are addressed by accessibility label — the crown decorates the
    // text and presence (#383) appends ", N일 전 접속" so match the prefix.
    // 창문 좌석도 탭 즉시 방문 (#727).
    await fireEvent.press(getByLabelText(/^최준서/));
    expect(onVisitFriend).toHaveBeenCalledWith(expect.objectContaining({ name: '최준서' }));
    await fireEvent.press(getByText('나의 방 (나)'));
    expect(onVisitMyRoom).toHaveBeenCalled();
  });

  it('shows vacant capacity seats as quiet tiles, excluded from member management', async () => {
    const onVisitFriend = jest.fn();
    const house = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '2층',
          rooms: [
            { name: '빈방', color: 'transparent', vacant: true },
            { name: '빈방', color: 'transparent', vacant: true },
          ],
        },
        ...MISSION_HOUSE.floors,
      ],
    };
    const { getAllByLabelText, queryAllByText, queryAllByTestId } = await render(
      <HouseScreen houses={[house]} onVisitFriend={onVisitFriend} />,
    );
    // 정원 4 / 멤버 2 → 빈 좌석은 캐릭터 없는 빈 방으로, 텍스트 라벨 없이 (#281).
    expect(queryAllByTestId('vacant-room')).toHaveLength(2);
    expect(queryAllByText('빈방')).toHaveLength(0);
    // 접근성 라벨은 유지 — 탭은 불가.
    await fireEvent.press(getAllByLabelText('빈방')[0]);
    expect(onVisitFriend).not.toHaveBeenCalled();
    // (구성원 관리의 빈 좌석 제외는 manageableMembers 파생 — members 테스트에서 단언.)
  });

  it('odd capacity fills the windows and leaves the extra window as a quiet panel', async () => {
    const house = {
      ...MISSION_HOUSE,
      maxMembers: 3,
      floors: [
        { level: '2층', rooms: [{ name: '빈방', color: 'transparent', vacant: true }] },
        ...MISSION_HOUSE.floors,
      ],
    };
    const { getAllByTestId, queryByText } = await render(<HouseScreen houses={[house]} />);
    // 기본 프레임이 항상 켜지므로(커버 없음 → 기본 커버) 정원 3은 창문 3칸을
    // 쓰고, 정원 밖 남는 1칸은 조용한 벽 패널로 남는다.
    expect(getAllByTestId('window-filler')).toHaveLength(1);
    // 빈 좌석은 텍스트 라벨 없이 빈 방 비주얼만.
    expect(queryByText('빈방')).toBeNull();
  });

  it('locks scrolling while a tile is lifted for drag (#278)', async () => {
    const { getByLabelText, getByTestId } = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
    expect(getByTestId('house-scroll').props.scrollEnabled).toBe(true);
    // Long-press lifts the tile: the grid owns the touch, so the scroll locks.
    await fireEvent(getByLabelText('친구'), 'longPress');
    expect(getByTestId('house-scroll').props.scrollEnabled).toBe(false);
  });

  it('shows the guided empty state when there are no houses', async () => {
    const onOpenSearch = jest.fn();
    const { getByText, getByLabelText } = await render(
      <HouseScreen houses={[]} onOpenSearch={onOpenSearch} />,
    );
    expect(getByText('아직 함께하는 집이 없어요')).toBeTruthy();
    await fireEvent.press(getByLabelText('집 탐색'));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  // 로드 실패는 '집 없음' 가입 유도로 위장하지 않는다 (#549).
  it('로드 실패 시 빈 상태 대신 에러 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseScreen houses={[]} loadError onRetry={onRetry} />,
    );

    expect(getByText('집 정보를 불러오지 못했어요')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 승인 대기 집 카드 (#648) — 스위처 마지막 페이지의 잠금형 카드 + 신청 취소.
  it('대기 페이지로 넘어가면 잠금 카드가 보이고, 확인 후 신청을 취소한다 (#648)', async () => {
    const onCancel = jest.fn();
    const { getByLabelText, getByText, getByTestId } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        pendingHouses={[
          { requestId: 42, name: '대기 중인 집', requestedAt: '2026-08-01T09:00:00Z' },
        ]}
        onCancelJoinRequest={onCancel}
      />,
    );

    // 집 1 + 대기 1 = 2페이지 — 화살표가 생기고, 다음으로 가면 잠금 카드.
    await fireEvent.press(getByLabelText('다음 집'));
    expect(getByTestId('pending-house-page')).toBeTruthy();
    expect(getByText('대기 중인 집')).toBeTruthy();
    expect(getByText('방장 승인을 기다리고 있어요')).toBeTruthy();
    expect(getByText('2026.08.01 신청')).toBeTruthy();

    // 신청 취소 — 확인 다이얼로그를 통과해야만 콜백.
    await fireEvent.press(getByLabelText('입주 신청 취소'));
    expect(getByText('입주 신청을 취소할까요?')).toBeTruthy();
    await fireEvent.press(getByLabelText('신청 취소 확인'));
    expect(onCancel).toHaveBeenCalledWith(42);
  });

  it('집이 없어도 대기 신청이 있으면 빈 상태 대신 잠금 카드를 보여준다 (#648)', async () => {
    const { getByTestId, queryByText } = await render(
      <HouseScreen houses={[]} pendingHouses={[{ requestId: 7, name: '첫 집' }]} />,
    );
    expect(getByTestId('pending-house-page')).toBeTruthy();
    expect(queryByText('아직 함께하는 집이 없어요')).toBeNull();
  });

  // 확대 중 탭 방문 (#669) — 탭 지터(슬롭 이내)는 카메라가 가져가지 않아야
  // Pressable의 방 탭(방문)이 산다. 실제 팬(슬롭 초과)·핀치는 카메라 몫.
  it('cameraClaimsMove: 탭 지터는 통과, 실제 팬·핀치만 캡처한다 (#669)', () => {
    expect(cameraClaimsMove(1, true, false, 2, 2)).toBe(false); // 확대 중 탭 지터
    expect(cameraClaimsMove(1, true, false, 0, 20)).toBe(true); // 확대 중 실제 팬
    expect(cameraClaimsMove(1, false, false, 0, 20)).toBe(false); // 원배율 한 손가락
    expect(cameraClaimsMove(2, false, false, 0, 0)).toBe(true); // 핀치는 즉시
    expect(cameraClaimsMove(2, true, true, 0, 20)).toBe(false); // 자리 드래그 중 양보
  });

  // 확대 = 방 구경 모드 (#665) — 이름/접속 라벨은 카메라 배율에 묶인
  // 페이드 오파시티를 가진다(jest의 Animated는 현재값으로 평탄화되므로
  // 기본 배율 1에서 완전 표시임을 단언; 배율 추종은 보간 정의가 담당).
  it('자리 라벨에 카메라 페이드 오파시티가 걸려 있다 (#665)', async () => {
    const { getByTestId } = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
    const style = StyleSheet.flatten(getByTestId('seat-meta-0').props.style);
    expect(style.opacity).toBe(1);
  });

  it('구성원 목록 버튼은 셸 화면을 연다 — onOpenMembers 콜백 (#753)', async () => {
    const onOpenMembers = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onOpenMembers={onOpenMembers} />,
    );
    await fireEvent.press(getByLabelText('구성원 목록'));
    expect(onOpenMembers).toHaveBeenCalledTimes(1);
  });

  it('강퇴 낙관 반영 — isKickedMember가 참인 좌석은 빈 타일 (#753)', async () => {
    const onVisitFriend = jest.fn();
    const { getAllByTestId, getByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        onVisitFriend={onVisitFriend}
        isKickedMember={(name) => name === '친구'}
      />,
    );
    // MISSION_HOUSE floors엔 빈 좌석이 없어, 빈 방 비주얼 = 강퇴된 친구 좌석뿐.
    expect(getAllByTestId('vacant-room')).toHaveLength(1);
    await fireEvent.press(getByLabelText('친구'));
    expect(onVisitFriend).not.toHaveBeenCalled();
  });
});
