import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { MyPageScreen } from '@/components/screens/my-page-screen';
import { headerUnderlapInset } from '@/components/ui/screen-header-geometry';
import { Spacing } from '@/constants/theme';
import { APP_FRAME_MAX_WIDTH, type AppFrame } from '@/hooks/use-app-frame';

// 2단 내 정보 탭 — 왼쪽에 프로필·지표·바로가기, 오른쪽에 메뉴 목록과 설정.
const PHONE: AppFrame = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false }; // prettier-ignore
const DESKTOP: AppFrame = { ...PHONE, width: 1200, height: 900, framed: true, split: true, navRail: true }; // prettier-ignore
const DUO_OPEN: AppFrame = { ...DESKTOP, width: 951, height: 669, splitFill: true };
let mockFrame: AppFrame = PHONE;
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));
afterEach(() => {
  mockFrame = PHONE;
});

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;
const props = {
  nickname: 'Kinsey',
  onOpenSettings: jest.fn(),
  onOpenWalletHistory: jest.fn(),
  onOpenHelp: jest.fn(),
};
const INSETS = { top: 82, right: 0, bottom: 34, left: 0 };

describe('MyPageScreen 2단', () => {
  it('폰은 한 칸 — 메뉴가 프로필 아래에 이어지고 설정은 머리의 톱니', async () => {
    const ui = await render(<MyPageScreen {...props} />);
    expect(ui.queryByTestId('my-page-menu-pane')).toBeNull();
    expect(ui.getByTestId('my-page-settings')).toBeTruthy();
    expect(within(ui.getByTestId('my-page-scroll')).getByText('도움말')).toBeTruthy();
  });

  it('창을 다 쓰는 2단은 [프로필·지표·바로가기 | 메뉴·설정] 1:1', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(<MyPageScreen {...props} />);
    expect(flat(ui.getByTestId('my-page-split').props.style).flexDirection).toBe('row');
    for (const id of ['my-page-main-pane', 'my-page-menu-pane']) {
      const pane = flat(ui.getByTestId(id).props.style);
      expect(pane.flex).toBe(1);
      expect(pane.width).toBeUndefined();
    }
    const left = within(ui.getByTestId('my-page-main-pane'));
    const right = within(ui.getByTestId('my-page-menu-pane'));
    expect(left.getByText('Kinsey')).toBeTruthy();
    expect(left.getByText('재화 내역')).toBeTruthy();
    expect(left.queryByText('도움말')).toBeNull();
    expect(right.getByText('도움말')).toBeTruthy();
    // 설정은 머리의 톱니가 아니라 오른쪽 칸의 행 — 톱니 자리는 펼친 Duo의 시스템 표시와 겹친다.
    expect(ui.queryByTestId('my-page-settings')).toBeNull();
    await fireEvent.press(right.getByText('설정'));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('펼친 아이폰 Duo: 왼쪽 칸은 위 안전 영역을 작은 여백만, 오른쪽 칸은 인셋을 지킨다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <MyPageScreen {...props} />
      </SafeAreaInsetsContext.Provider>,
    );
    const left = flat(ui.getByTestId('my-page-scroll').props.contentContainerStyle);
    expect(left.paddingTop).toBe(headerUnderlapInset(Spacing.three));
    const right = flat(ui.getByTestId('my-page-menu-scroll').props.contentContainerStyle);
    expect(right.paddingTop).toBe(82 + Spacing.four);
  });

  it('마우스 웹의 2단은 폰 폭 칸 + 메뉴 칸을 가운데에', async () => {
    mockFrame = DESKTOP;
    const ui = await render(<MyPageScreen {...props} />);
    expect(flat(ui.getByTestId('my-page-split').props.style).justifyContent).toBe('center');
    expect(flat(ui.getByTestId('my-page-main-pane').props.style).width).toBe(APP_FRAME_MAX_WIDTH);
  });
});
