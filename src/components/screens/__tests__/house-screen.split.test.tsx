import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { HouseScreen } from '@/components/screens/house-screen';
import { Spacing } from '@/constants/theme';
import { APP_FRAME_MAX_WIDTH, type AppFrame } from '@/hooks/use-app-frame';
import { DEFAULT_HOUSE_COVER_KEY } from '@/resources/house-frame';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

// 2단 집 탭 — 왼쪽에 집 그림, 오른쪽에 집 정보(이름·레벨, 목표, 구성원, 채팅·피드·집 추가).
const PHONE: AppFrame = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false }; // prettier-ignore
const DESKTOP: AppFrame = { ...PHONE, width: 1200, height: 900, framed: true, split: true };
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
const HOUSE = { ...MISSION_HOUSE, displayMode: 'DIORAMA' as const, coverImageKey: DEFAULT_HOUSE_COVER_KEY }; // prettier-ignore

describe('HouseScreen 2단', () => {
  it('폰은 한 칸 — 오른쪽 칸이 없고 알약·레일이 그림 위에 뜬다', async () => {
    const ui = await render(<HouseScreen houses={[HOUSE]} onOpenChat={jest.fn()} />);
    expect(ui.queryByTestId('house-side-panel')).toBeNull();
    expect(ui.getByTestId('house-level-pill')).toBeTruthy();
    expect(ui.getByRole('button', { name: '집 채팅' })).toBeTruthy();
  });

  it('창을 다 쓰는 2단(펼친 폴더블)은 두 칸이 1:1 — 알약·레일은 오른쪽 칸으로 옮긴다', async () => {
    mockFrame = DUO_OPEN;
    const onOpenChat = jest.fn();
    const onOpenMissions = jest.fn();
    const ui = await render(
      <HouseScreen
        houses={[HOUSE]}
        userName="Kinsey"
        onOpenChat={onOpenChat}
        onOpenMissions={onOpenMissions}
      />,
    );
    expect(flat(ui.getByTestId('house-split').props.style).flexDirection).toBe('row');
    for (const id of ['house-screen', 'house-side-panel']) {
      const pane = flat(ui.getByTestId(id).props.style);
      expect(pane.flex).toBe(1);
      expect(pane.width).toBeUndefined();
    }
    // 그림 위에 떠 있던 것들은 없다 — 같은 진입점이 오른쪽 칸에 하나씩만 있다.
    expect(ui.queryByTestId('house-level-pill')).toBeNull();
    expect(ui.queryByTestId('house-members-pill')).toBeNull();
    const panel = within(ui.getByTestId('house-side-panel'));
    expect(panel.getByRole('header', { name: '실집' })).toBeTruthy();
    expect(panel.getByText('Kinsey (나)')).toBeTruthy();
    expect(panel.getByText('주간 루틴 지키기')).toBeTruthy();
    expect(ui.getAllByRole('button', { name: '집 채팅' })).toHaveLength(1);
    await fireEvent.press(panel.getByRole('button', { name: '집 채팅' }));
    await fireEvent.press(panel.getByRole('button', { name: '우리 집의 목표 전체 보기' }));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
    expect(onOpenMissions).toHaveBeenCalledTimes(1);
  });

  it('펼친 아이폰 Duo: 왼쪽 칸은 위 안전 영역을 비우지 않고, 오른쪽 칸은 모서리의 시스템 표시를 피한다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 82, right: 0, bottom: 34, left: 0 }}>
        <HouseScreen houses={[HOUSE]} />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(flat(ui.getByTestId('sky-section').props.style).paddingTop).toBe(Spacing.three);
    const content = flat(ui.getByTestId('house-side-panel').props.contentContainerStyle);
    expect(content.paddingTop).toBe(82 + Spacing.four);
  });

  it('2단의 집 그림은 칸 높이에 전체가 들어가게 폭을 맞춘다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(<HouseScreen houses={[HOUSE]} />);
    // 왼쪽 칸(475.5×669)을 재고, 머리(스위처) 끝과 알약 자리 끝을 알려 준다.
    await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 475.5, height: 669 } },
    });
    await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 80, width: 475.5, height: 0 } },
    });
    await fireEvent(ui.getByTestId('house-sky-spacer'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 80, width: 475.5, height: 0 } },
    });
    const style = flat(ui.getByTestId('house-frame-viewport').props.style);
    expect(style.maxWidth).toBeGreaterThan(0);
    expect(style.maxWidth).toBeLessThan(475.5);
    expect(style.alignSelf).toBe('center');
  });

  it('마우스 웹의 2단은 폰 폭 칸 + 정보 칸을 가운데에', async () => {
    mockFrame = DESKTOP;
    const ui = await render(<HouseScreen houses={[HOUSE]} />);
    expect(flat(ui.getByTestId('house-split').props.style).justifyContent).toBe('center');
    expect(flat(ui.getByTestId('house-screen').props.style).width).toBe(APP_FRAME_MAX_WIDTH);
    expect(ui.getByTestId('house-side-panel')).toBeTruthy();
  });
});
