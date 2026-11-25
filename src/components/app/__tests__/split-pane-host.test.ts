import { splitPaneHost, TAB_FOR_SCREEN } from '@/components/app/navigation';

// 2단에서 탭 화면의 오른쪽 칸에 여는 서브화면 — 내 정보의 설정 묶음과 메뉴 항목.
describe('splitPaneHost', () => {
  it('2단이면 설정 묶음·메뉴 항목을 내 정보 탭의 오른쪽 칸에 연다', () => {
    for (const screen of [
      'settings',
      'theme',
      'font',
      'language',
      'profileEdit',
      'help',
    ] as const) {
      expect(splitPaneHost(screen, true)).toBe('myPage');
      // 한 칸에서는 종전대로 서브화면 — 탭이 없다.
      expect(TAB_FOR_SCREEN[screen]).toBeNull();
    }
  });

  it('2단이면 집의 구성원 관리·미션·채팅·집 피드를 집 탭의 오른쪽 칸에 연다', () => {
    for (const screen of [
      'houseMembers',
      'houseMissions',
      'houseChat',
      'houseFeed',
      'houseFeedPost',
      'houseFeedCompose',
    ] as const) {
      expect(splitPaneHost(screen, true)).toBe('house');
      expect(splitPaneHost(screen, false)).toBeNull();
    }
    expect(splitPaneHost('friendRoom', true)).toBe('house');
    // 집 탐색·새 집 만들기도 내 집 그림 옆에 연다 — 집이 없으면(집 탭이 빈 상태) 화면 전체에.
    for (const screen of ['houseSearch', 'createHouse'] as const) {
      expect(splitPaneHost(screen, true)).toBe('house');
      // 집이 없으면 집 탭은 빈 상태 — 방 탭에서 열고 방으로 돌아가므로 방 그림 옆에 연다.
      expect(splitPaneHost(screen, true, undefined, true)).toBe('myRoom');
    }
    // 그 밖의 집 화면은 집이 없으면 칸에 열지 않는다.
    expect(splitPaneHost('houseMembers', true, undefined, true)).toBeNull();
    // 집이 없어도 다른 탭이 품는 화면은 그대로 칸에 연다.
    expect(splitPaneHost('settings', true, undefined, true)).toBe('myPage');
  });

  it('한 칸(폰)에서는 어느 화면도 칸에 열지 않는다', () => {
    expect(splitPaneHost('settings', false)).toBeNull();
    expect(splitPaneHost('help', false)).toBeNull();
  });

  it('탭 화면과 칸에 열지 않는 서브화면은 2단에서도 null', () => {
    // 방 꾸미기는 스스로 두 칸이고, 달력 주간 보기는 2단에서 열리지 않는다.
    for (const screen of ['myPage', 'myRoom', 'decor', 'calendarWeek'] as const) {
      expect(splitPaneHost(screen, true)).toBeNull();
    }
  });

  it('방의 하위 화면은 방 탭, 글쓰기는 피드 탭, 나머지 메뉴는 내 정보 탭의 칸에 연다', () => {
    for (const screen of [
      'routineManage',
      'categoryManage',
      'notificationList',
      'minigames',
      'gacha',
      'furnitureStudio',
    ] as const) {
      // prettier-ignore
      expect(splitPaneHost(screen, true)).toBe('myRoom');
    }
    for (const screen of ['market', 'marketAsset', 'marketOrders', 'minigameRunner'] as const) {
      expect(splitPaneHost(screen, true)).toBe('myRoom');
    }
    expect(splitPaneHost('feedCompose', true)).toBe('feed');
    expect(splitPaneHost('suggestions', true)).toBe('myPage');
  });

  // 루틴 추가·주간회고는 연 곳으로 돌아간다 — 그 연 곳의 탭이 칸을 내준다.
  it('루틴 추가·주간회고는 연 곳의 탭 옆에 연다', () => {
    expect(splitPaneHost('addRoutine', true, 'myRoom')).toBe('myRoom');
    expect(splitPaneHost('addRoutine', true, 'calendar')).toBe('calendar');
    // 루틴 관리(방의 칸에 열린 화면)에서 열었으면 같은 방 탭의 칸에.
    expect(splitPaneHost('addRoutine', true, 'routineManage')).toBe('myRoom');
    expect(splitPaneHost('weeklyReport', true, 'myPage')).toBe('myPage');
    expect(splitPaneHost('weeklyReport', true, 'myRoom')).toBe('myRoom');
    // 연 곳을 모르면 종전대로 화면 전체.
    expect(splitPaneHost('addRoutine', true)).toBeNull();
    expect(splitPaneHost('addRoutine', false, 'myRoom')).toBeNull();
  });
});
