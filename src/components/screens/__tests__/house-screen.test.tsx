import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { cameraClaimsMove, HouseScreen, type House } from '@/components/screens/house-screen';
import { ToastProvider } from '@/components/ui/toast';

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
    const { getByText, getByLabelText, queryByText } = await render(<HouseScreen />);
    expect(getByText('소마파이팅')).toBeTruthy();
    // The level pill shows the house's real growth level (demo: 3).
    expect(getByText('Lv.3')).toBeTruthy();
    // The header carries no coin balance (집 화면은 재화 소비 화면이 아니다).
    expect(queryByText('5,600')).toBeNull();
    // The demo owner's tile carries the 방장 crown.
    expect(getByText('최준서')).toBeTruthy();
    // 공동 미션은 플로팅 버튼 → 시트로 (#287).
    expect(queryByText('우리 집의 목표')).toBeNull();
    await fireEvent.press(getByLabelText('공동 미션'));
    expect(getByText('우리 집의 목표')).toBeTruthy();
    expect(getByText('이번 주 다같이 루틴 지키기')).toBeTruthy();
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

  // 집 캐러셀 스와이프 (#297 → #563에서 RNGH 전환) — 하늘 영역 가로 플링으로
  // 이전/다음 집. 탭 페이저와의 중재(동률 자식 우선)를 위해 PanResponder에서
  // RNGH pan으로 옮겼다 — 동작 계약은 그대로다.
  it('하늘 영역 가로 플링으로 이전/다음 집 (#297/#563)', async () => {
    const onHouseIndexChange = jest.fn();
    await render(<HouseScreen houseIndex={0} onHouseIndexChange={onHouseIndexChange} />);
    const fling = (translationX: number) =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('house-carousel-fling'), [
          { state: State.BEGAN },
          { state: State.ACTIVE },
          { state: State.END, translationX, translationY: 0 },
        ]),
      );

    // 좌플링 → 다음 집.
    await fling(-60);
    expect(onHouseIndexChange).toHaveBeenLastCalledWith(1);
    // 우플링 → 이전 집(랩어라운드 규칙은 화면 내부 소관 — 콜백만 단언).
    await fling(60);
    expect(onHouseIndexChange).toHaveBeenCalledTimes(2);
    // 임계 미달 릴리즈는 무시.
    onHouseIndexChange.mockClear();
    await fling(-30);
    expect(onHouseIndexChange).not.toHaveBeenCalled();
  });

  it('adds a mission to my routines through the confirm modal, and claims', async () => {
    const onAddMissionRoutine = jest.fn();
    const onClaimMission = jest.fn();
    const { getByLabelText, getByText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={onAddMissionRoutine}
        onClaimMission={onClaimMission}
      />,
    );
    // 기여 버튼 대신 + → 확인 모달 → 네 = 집 카테고리 아래 루틴 생성 요청.
    await fireEvent.press(getByLabelText('공동 미션'));
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

  it('deletes a mission through the confirm modal (owner, #305)', async () => {
    const onDeleteMission = jest.fn();
    const { getByLabelText, getByText, queryByLabelText, queryByText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onDeleteMission={onDeleteMission} />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    // COMPLETED missions are not deletable on the server (409) — no button.
    expect(queryByLabelText('지난 미션 삭제')).toBeNull();
    // 취소 closes without calling.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 삭제'));
    expect(getByText('미션 삭제')).toBeTruthy();
    await fireEvent.press(getByLabelText('미션 삭제 취소'));
    expect(queryByText('미션 삭제')).toBeNull();
    expect(onDeleteMission).not.toHaveBeenCalled();
    // 삭제 confirms.
    await fireEvent.press(getByLabelText('주간 루틴 지키기 삭제'));
    await fireEvent.press(getByLabelText('미션 삭제 확인'));
    expect(onDeleteMission).toHaveBeenCalledWith(7, 11);
  });

  it('hides mission delete from plain members', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <HouseScreen houses={[{ ...MISSION_HOUSE, myRole: 'MEMBER' }]} onDeleteMission={jest.fn()} />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    expect(queryByLabelText('주간 루틴 지키기 삭제')).toBeNull();
  });

  it('shows 기여됨/루틴 연동됨 labels instead of + when applicable', async () => {
    const { queryByLabelText, getByText, getByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ missionId: 11 }]}
        contributedMissionIds={[12]}
      />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    // Linked mission: no + button, 연동 라벨.
    expect(queryByLabelText('주간 루틴 지키기 내 루틴에 추가')).toBeNull();
    expect(getByText('루틴 연동됨')).toBeTruthy();
    // Contributed-today mission (no claim handler → falls through to 기여함).
    expect(getByText('기여함')).toBeTruthy();
  });

  it('derives 기여함 from a linked routine completed today (재시작에도 유지)', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
      />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    // 세션 추적(contributedMissionIds) 없이도 오늘 완료 = 기여함.
    expect(getByText('기여함')).toBeTruthy();
    expect(queryByText('루틴 연동됨')).toBeNull();
  });

  it('creates a mission through the modal', async () => {
    const onCreateMission = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
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
        <HouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    await fireEvent.press(getByLabelText('미션 만들기'));
    await fireEvent.press(getByLabelText('미션 만들기 확인'));

    expect(getByText('미션 이름을 입력해주세요')).toBeTruthy();
    expect(onCreateMission).not.toHaveBeenCalled();
  });

  it('shows the empty-mission hint when the house has no missions', async () => {
    const { getByText, getByLabelText } = await render(
      <HouseScreen houses={[{ ...MISSION_HOUSE, missions: [] }]} />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
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
      <HouseScreen houses={[MISSION_HOUSE]} roomPreviews={roomPreviews} />,
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
      <HouseScreen houses={[MISSION_HOUSE]} onCreateMission={onCreateMission} />,
    );

    // Toggle off (default): no period fields at all.
    await fireEvent.press(getByLabelText('공동 미션'));
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
    const { getByText, getByLabelText, queryByText } = await render(
      <HouseScreen houses={[house]} />,
    );
    await fireEvent.press(getByLabelText('공동 미션'));
    expect(getByText('~07.23')).toBeTruthy();
    // Finished missions show their status, not a stale end date.
    expect(queryByText('~07.01')).toBeNull();
  });

  it('renders the house frame with level progress and summary stats (#287)', async () => {
    const house = {
      ...MISSION_HOUSE,
      level: 1,
      growthPoints: 130,
      coverImageKey: 'house/cloud-balloon/frame.png',
    };
    const { getByTestId, getByText, getByLabelText } = await render(
      <HouseScreen
        houses={[house]}
        userName="나"
        onAddMissionRoutine={jest.fn()}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
      />,
    );
    // 커버 프레임이 집 본체 — 창문 안에 좌석, 모서리에 레벨 진행도 pill.
    expect(getByTestId('house-frame')).toBeTruthy();
    expect(getByText('Lv.1 · 30/100')).toBeTruthy();
    expect(getByText('70')).toBeTruthy();
    // 진행 중 미션 2(ACTIVE 11·12), 오늘 나의 기여 1/2 (11이 연동 완료).
    expect(getByText('2')).toBeTruthy();
    expect(getByText('1/2')).toBeTruthy();
    // 방 타일은 창문 안에서도 그대로 (정원 4 → 좌석 2 + 빈방 2).
    expect(getByText('나 (나)')).toBeTruthy();
    // + 버튼은 시트 안에서 텍스트로 목적을 말한다.
    await fireEvent.press(getByLabelText('공동 미션'));
    expect(getByText('＋ 내 루틴에')).toBeTruthy();
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
