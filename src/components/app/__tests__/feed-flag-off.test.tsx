import { render } from '@testing-library/react-native';

import { NAV_ORDER, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { BottomNav } from '@/components/ui/bottom-nav';
import { isNavTab, START_TAB_OPTIONS } from '@/lib/start-tab';

// FEED_ENABLED가 꺼져 있으면 피드는 사용자에게 전혀 보이지 않는다 (#1409 — 신고·차단 전까지
// App Store 1.2). 켠 상태는 feed-navigation.test.tsx.
jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: false,
}));

describe('FEED_ENABLED=false (#1409)', () => {
  it('하단 탭 순서·시작 화면 선택지에 피드가 없다 (4탭)', () => {
    expect(NAV_ORDER).toEqual(['myRoom', 'calendar', 'house', 'myPage']);
    expect(START_TAB_OPTIONS.map((o) => o.id)).toEqual(NAV_ORDER);
    expect(isNavTab('feed')).toBe(false);
    // 화면 매핑은 남아 있지만 도달할 경로가 없다.
    expect(TAB_FOR_SCREEN.feed).toBe('feed');
  });

  it('하단 탭과 알림 설정에 피드 문구가 없다', async () => {
    const nav = await render(<BottomNav active="myRoom" onChange={() => {}} />);
    expect(nav.queryByText('피드')).toBeNull();
    const settings = await render(<NotificationSettingsScreen />);
    expect(settings.queryByText('피드 댓글')).toBeNull();
  });
});
