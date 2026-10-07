import { fireEvent, render } from '@testing-library/react-native';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 좌석 타일·접속·방문', () => {
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
    // 오프라인 친구 타일: 마지막 접속 상대 시각이 이름과 **같은 줄**에 (#999).
    // 가운뎃점까지 한 Text에 담기므로 라벨만 따로 찾으면 잡히지 않는다.
    expect(getByText('· 3시간 전')).toBeTruthy();
    expect(getByLabelText('친구, 3시간 전 접속')).toBeTruthy();
  });

  /**
   * 동거 봇 (#1013) — 서버 스케줄러가 봇의 lastAccessedAt을 갱신해서, 그대로
   * 두면 좌석 타일에 "접속 중"이나 "1시간 전"이 떠 **봇이 사람보다 활발해
   * 보였다.** 접속 자리를 "봇"이 대신한다.
   */

  it('봇 좌석은 접속 대신 봇 라벨을 보여준다 (#1013)', async () => {
    const botHouse: House = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '루나', color: '#F5E1D8', membershipId: 91, bot: true },
            { name: '진형', color: '#E8E0D0', membershipId: 92, lastSeenLabel: '8일 전' },
          ],
        },
      ],
    };
    const { getByText, queryByTestId, getByLabelText } = await render(
      <HouseScreen houses={[botHouse]} userName="나" />,
    );
    expect(getByText('· 봇')).toBeTruthy();
    expect(getByLabelText('루나, 봇')).toBeTruthy();
    // 사람 쪽은 그대로.
    expect(getByText('· 8일 전')).toBeTruthy();
    // 봇에는 접속 점을 붙이지 않는다.
    expect(queryByTestId('online-dot')).toBeNull();
  });

  it('봇이면서 online이 들어와도 접속 점을 그리지 않는다 (#1013)', async () => {
    const botHouse: House = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '1층',
          rooms: [{ name: '루나', color: '#F5E1D8', membershipId: 91, bot: true, online: true }],
        },
      ],
    };
    const { queryByTestId, getByText } = await render(
      <HouseScreen houses={[botHouse]} userName="나" />,
    );
    expect(queryByTestId('online-dot')).toBeNull();
    expect(getByText('· 봇')).toBeTruthy();
  });

  it('마지막 접속 라벨이 이름과 한 줄에 온다 (#999)', async () => {
    const presenceHouse: House = {
      ...MISSION_HOUSE,
      floors: [
        {
          level: '1층',
          rooms: [{ name: '진형', color: '#F5E1D8', membershipId: 42, lastSeenLabel: '8일 전' }],
        },
      ],
    };
    const { getByText } = await render(<HouseScreen houses={[presenceHouse]} userName="나" />);
    // 이름과 시간이 같은 부모(roomNameRow) 아래에 나란히 있어야 한다 — 종전엔
    // 시간이 그 형제인 별도 줄로 떨어져 있었다.
    const name = getByText('진형');
    const lastSeen = getByText('· 8일 전');
    expect(lastSeen.parent).toBe(name.parent);
    // 이름만 말줄임 — 시간 라벨은 항상 통째로 보인다.
    expect(name.props.numberOfLines).toBe(1);
    expect(lastSeen.props.numberOfLines).toBeUndefined();
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

  it('renders a live room preview on tiles that have one, plain tile otherwise', async () => {
    const roomPreviews = {
      42: {
        placements: [{ furnitureId: 'bed', x: 0.3, y: 0.7, z: 1 }],
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
    const { getByTestId, getByText, getByLabelText } = await render(
      <HouseScreen
        houses={[house]}
        userName="나"
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
    expect(getByLabelText(/오늘 1\/2 기여/)).toBeTruthy();
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
