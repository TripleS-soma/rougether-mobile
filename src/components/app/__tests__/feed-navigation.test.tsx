import { fireEvent, render } from '@testing-library/react-native';

import { backTargetFor, NAV_ORDER, navOrder, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { BottomNav } from '@/components/ui/bottom-nav';
import { isNavTab, START_TAB_OPTIONS } from '@/lib/start-tab';

// 피드 탭 (#1409) — 이 파일은 FEED_ENABLED를 켠 상태를 본다. 꺼진 상태는 feed-flag-off.test.tsx.
jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: true,
}));

describe('피드 탭 플래그 (#1409)', () => {
  it('navOrder — 켜면 5탭(집 다음 피드), 끄면 4탭', () => {
    expect(navOrder(true)).toEqual(['myRoom', 'calendar', 'house', 'feed', 'myPage']);
    expect(navOrder(false)).toEqual(['myRoom', 'calendar', 'house', 'myPage']);
  });

  it('켜짐 — NAV_ORDER·시작 화면 선택지에 피드, 상세·작성은 하단 탭 없는 서브화면', () => {
    expect(NAV_ORDER).toEqual(['myRoom', 'calendar', 'house', 'feed', 'myPage']);
    expect(START_TAB_OPTIONS.map((o) => o.id)).toEqual(NAV_ORDER);
    expect(isNavTab('feed')).toBe(true);
    expect(TAB_FOR_SCREEN.feed).toBe('feed');
    expect(TAB_FOR_SCREEN.feedPost).toBeNull();
    expect(TAB_FOR_SCREEN.feedCompose).toBeNull();
    expect(backTargetFor('feedPost', 'myRoom', false)).toBe('feed');
    expect(backTargetFor('feedCompose', 'myRoom', false)).toBe('feed');
  });

  it('켜짐 — 하단 탭에 피드가 보이고 누르면 feed', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<BottomNav active="myRoom" onChange={onChange} />);
    await fireEvent.press(getByText('피드'));
    expect(onChange).toHaveBeenCalledWith('feed');
  });
});
