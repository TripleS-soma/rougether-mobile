import { render } from '@testing-library/react-native';
import { useContext, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { SplitDetailOverlay } from '@/components/app/split-detail-overlay';
import { APP_FRAME_MAX_WIDTH, type AppFrame } from '@/hooks/use-app-frame';

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
function Tab({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <Text>탭 화면</Text>;
}

describe('SplitDetailOverlay — 2단의 오른쪽 칸에 서브화면 덮기', () => {
  it('2단에서 detail이 있으면 오른쪽 칸에만 덮고, 왼쪽 칸은 터치를 밑으로 흘린다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(
      <SplitDetailOverlay detail={<Text>설정 화면</Text>}>
        <Text>탭 화면</Text>
      </SplitDetailOverlay>,
    );
    expect(ui.getByText('탭 화면')).toBeTruthy();
    expect(ui.getByText('설정 화면')).toBeTruthy();
    const overlay = ui.getByTestId('split-detail-overlay');
    expect(overlay.props.pointerEvents).toBe('box-none');
    expect(flat(overlay.props.style).flexDirection).toBe('row');
    const [left, right] = overlay.children as { props: Record<string, unknown> }[];
    expect(left.props.pointerEvents).toBe('none');
    expect(flat(left.props.style).flex).toBe(1);
    expect(flat(right.props.style).flex).toBe(1);
    // 밑의 메뉴가 비치지 않게 화면색으로 덮는다.
    expect(flat(right.props.style).backgroundColor).toBeTruthy();
  });

  it('마우스 웹은 탭 화면의 2단과 같은 블록 — 폰 폭 칸을 비우고 그 옆에 덮는다', async () => {
    mockFrame = DESKTOP;
    const ui = await render(
      <SplitDetailOverlay detail={<Text>설정 화면</Text>}>
        <Text>탭 화면</Text>
      </SplitDetailOverlay>,
    );
    const overlay = ui.getByTestId('split-detail-overlay');
    expect(flat(overlay.props.style).justifyContent).toBe('center');
    const [left] = overlay.children as { props: Record<string, unknown> }[];
    expect(flat(left.props.style).width).toBe(APP_FRAME_MAX_WIDTH);
  });

  it('한 칸(폰)이거나 detail이 없으면 덮개가 없다', async () => {
    const ui = await render(
      <SplitDetailOverlay detail={<Text>설정 화면</Text>}>
        <Text>탭 화면</Text>
      </SplitDetailOverlay>,
    );
    expect(ui.queryByTestId('split-detail-overlay')).toBeNull();
    expect(ui.queryByText('설정 화면')).toBeNull();
    mockFrame = DUO_OPEN;
    await ui.rerender(
      <SplitDetailOverlay detail={null}>
        <Text>탭 화면</Text>
      </SplitDetailOverlay>,
    );
    expect(ui.queryByTestId('split-detail-overlay')).toBeNull();
  });

  it('덮개가 뜨고 걷혀도 탭 화면은 리마운트되지 않는다', async () => {
    mockFrame = DUO_OPEN;
    const onMount = jest.fn();
    const tree = (detail: React.ReactNode) => (
      <SplitDetailOverlay detail={detail}>
        <Tab onMount={onMount} />
      </SplitDetailOverlay>
    );
    const ui = await render(tree(null));
    await ui.rerender(tree(<Text>설정 화면</Text>));
    await ui.rerender(tree(null));
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  // 펼친 아이폰 Duo(위 안전 영역 82): 오른쪽 위 모서리의 와이파이 그림은 98pt까지 내려온다.
  it('창을 다 쓰는 2단에서 칸 안의 화면은 위 인셋을 16 더 본다 — 머리 버튼이 시스템 표시와 안 겹치게', async () => {
    mockFrame = DUO_OPEN;
    function Top() {
      const insets = useContext(SafeAreaInsetsContext);
      return <Text testID="top">{String(insets?.top)}</Text>;
    }
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 82, right: 0, bottom: 34, left: 0 }}>
        <SplitDetailOverlay detail={<Top />}>
          <Text>탭 화면</Text>
        </SplitDetailOverlay>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(ui.getByTestId('top').props.children).toBe('98');
  });

  it('위 인셋이 없는 기기(태블릿·데스크톱)는 그대로다', async () => {
    mockFrame = DUO_OPEN;
    function Top() {
      const insets = useContext(SafeAreaInsetsContext);
      return <Text testID="top">{String(insets?.top)}</Text>;
    }
    const ui = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <SplitDetailOverlay detail={<Top />}>
          <Text>탭 화면</Text>
        </SplitDetailOverlay>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(ui.getByTestId('top').props.children).toBe('0');
  });
});
