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
    // 집 탐색·새 집 만들기·친구 방은 집 그림 옆에 둘 내용이 아니라 칸에 열지 않는다.
    for (const screen of ['houseSearch', 'createHouse', 'friendRoom'] as const) {
      expect(splitPaneHost(screen, true)).toBeNull();
    }
  });

  it('한 칸(폰)에서는 어느 화면도 칸에 열지 않는다', () => {
    expect(splitPaneHost('settings', false)).toBeNull();
    expect(splitPaneHost('help', false)).toBeNull();
  });

  it('탭 화면과 칸에 열지 않는 서브화면은 2단에서도 null', () => {
    for (const screen of ['myPage', 'myRoom', 'decor', 'gacha', 'feedPost'] as const) {
      expect(splitPaneHost(screen, true)).toBeNull();
    }
  });
});
