import { fireEvent, render } from '@testing-library/react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { HouseScreen } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 헤더·레일·집 전환·미션 요약', () => {
  it('긴 집 이름이 화살표를 밀어내지 않는다 — 뱃지가 말줄임으로 접힌다 (#994)', async () => {
    // 서버는 집 이름을 30자까지 받는다(스웨거). 안 자르면 뱃지가 부풀어
    // 좌우 전환 화살표가 화면 밖으로 밀려 집을 바꿀 수단이 사라진다.
    const long = '가'.repeat(30);
    const { getByText } = await render(<HouseScreen houses={[{ ...MISSION_HOUSE, name: long }]} />);
    expect(getByText(long).props.numberOfLines).toBe(1);
  });

  it('승인 대기 페이지에서도 긴 이름이 접힌다 (#994 리뷰)', async () => {
    // 이 경로는 emptyWrap(alignItems: center) 안이라 스위처가 콘텐츠 폭만
    // 갖는다 — 조상이 폭을 안 정해주면 flexShrink가 줄일 대상이 없어
    // 말줄임이 안 걸리고, 긴 이름이 화살표를 화면 밖으로 민다.
    const long = '나'.repeat(30);
    const { getByText } = await render(
      <HouseScreen houses={[]} pendingHouses={[{ requestId: 1, name: long }]} houseIndex={0} />,
    );
    expect(getByText(long).props.numberOfLines).toBe(1);
  });

  it('액션은 플로팅 레일에 있다 — 목표·집 탐색·구성원 (#986)', async () => {
    const onOpenMissions = jest.fn();
    const onOpenSearch = jest.fn();
    const onOpenMembers = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        onOpenMissions={onOpenMissions}
        onOpenSearch={onOpenSearch}
        onOpenMembers={onOpenMembers}
      />,
    );
    await fireEvent.press(getByLabelText('집 탐색'));
    expect(onOpenSearch).toHaveBeenCalled();
    await fireEvent.press(getByLabelText('집 관리'));
    expect(onOpenMembers).toHaveBeenCalled();
  });

  it('renders the current house, members, and group missions', async () => {
    const { getByText, queryByText, getByLabelText } = await render(
      <HouseScreen onOpenMissions={jest.fn()} />,
    );
    expect(getByText('소마파이팅')).toBeTruthy();
    // The level pill shows the house's real growth level (demo: 3).
    expect(getByText('Lv.3')).toBeTruthy();
    // The header carries no coin balance (집 화면은 재화 소비 화면이 아니다).
    expect(queryByText('5,600')).toBeNull();
    // The demo owner's tile carries the 방장 crown.
    expect(getByText('최준서')).toBeTruthy();
    // 공동 미션 진입점은 플로팅 레일의 '목표' 버튼이다 (#875 → #986).
    expect(getByLabelText(/^우리 집의 목표/)).toBeTruthy();
  });

  /**
   * 공동 미션 요약 줄 (#875) — 예전엔 우하단 FAB 뒤에 통째로 숨어서, 집에
   * 들어와도 우리 집이 뭘 하는지 **누르기 전엔** 보이지 않았다. FAB은 없앴다:
   * 요약 줄이 진입점이라 진입점을 둘로 두지 않는다(#856과 같은 결).
   */

  it('목표 버튼 라벨이 진행 상황을 담고 탭하면 미션 화면을 연다 (#875 → #986)', async () => {
    const onOpenMissions = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <HouseScreen
        houses={[MISSION_HOUSE]}
        linkedRoutines={[{ missionId: 11, completedToday: true }]}
        onOpenMissions={onOpenMissions}
      />,
    );
    // 줄이 레일 버튼이 되며 '오늘 1/2'가 눈에서는 사라졌다 (#986) — #875가
    // 드러내려던 진행 상황이 **라벨에는 그대로** 남아야 한다. 이 단언이 그
    // 약속을 지키는 그물이다.
    await fireEvent.press(getByLabelText('우리 집의 목표, 오늘 1/2 기여, 받을 보상 1개'));
    expect(onOpenMissions).toHaveBeenCalled();
    // FAB은 사라졌다 — 진입점은 하나다.
    expect(queryByLabelText('공동 미션')).toBeNull();
  });

  it('서버 목록의 contributedToday만으로도 요약 라벨의 오늘 기여를 센다 (#373-②)', async () => {
    const missions = (MISSION_HOUSE.missions ?? []).map((m) =>
      m.id === 11 ? { ...m, contributedToday: true } : m,
    );
    const { getByLabelText } = await render(
      <HouseScreen houses={[{ ...MISSION_HOUSE, missions }]} onOpenMissions={jest.fn()} />,
    );
    // 세션 추적·연동 루틴 없이 서버 값만으로 1/2.
    expect(getByLabelText(/우리 집의 목표, 오늘 1\/2 기여/)).toBeTruthy();
  });

  it('미션이 없으면 목표 버튼 라벨이 진행 중 없음으로 말한다 (#875 → #986)', async () => {
    const { getByLabelText } = await render(
      <HouseScreen houses={[{ ...MISSION_HOUSE, missions: [] }]} onOpenMissions={jest.fn()} />,
    );
    expect(getByLabelText('우리 집의 목표, 진행 중 없음')).toBeTruthy();
  });

  it('onOpenMissions가 없으면 목표 버튼을 그리지 않는다', async () => {
    // 레일 버튼이 되며 화면에 보이는 글자는 '목표'뿐이다 — `queryByText('우리 집의
    // 목표')`로 두면 배선 유무와 무관하게 늘 null이라 단언이 조용히 무의미해진다.
    const { queryByLabelText, queryByText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} />,
    );
    expect(queryByLabelText(/^우리 집의 목표/)).toBeNull();
    expect(queryByText('목표')).toBeNull();
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

  it('falls back to a plain hero without a cover and hides nav for one house', async () => {
    const { queryByTestId, queryByLabelText, getByText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} />,
    );
    expect(queryByTestId('house-hero-cover')).toBeNull();
    expect(getByText('실집')).toBeTruthy();
    // 집이 하나면 히어로 좌우 전환 화살표가 없다.
    expect(queryByLabelText('이전 집')).toBeNull();
  });

  // 'hides the owner tools from plain members'는 삭제했다 (#875) — 이 화면엔
  // 방장 전용 UI가 더 이상 없다. 집 정보 수정은 #753에서 구성원 화면으로,
  // 미션 만들기는 #875에서 미션 화면으로 갔고 권한 단언도 각 화면 테스트에 있다.

  it('집 관리 버튼은 셸 화면을 연다 — onOpenMembers 콜백 (#753)', async () => {
    const onOpenMembers = jest.fn();
    const { getByLabelText } = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onOpenMembers={onOpenMembers} />,
    );
    await fireEvent.press(getByLabelText('집 관리'));
    expect(onOpenMembers).toHaveBeenCalledTimes(1);
  });
});
