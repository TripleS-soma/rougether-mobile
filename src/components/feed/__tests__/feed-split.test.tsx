import { render } from '@testing-library/react-native';
import { useContext } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { FeedSplit } from '@/components/feed/feed-split';
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
function TopInset({ id }: { id: string }) {
  const insets = useContext(SafeAreaInsetsContext);
  return <Text testID={id}>{String(insets?.top ?? 'none')}</Text>;
}
const INSETS = { top: 82, right: 0, bottom: 34, left: 0 };
const tree = (detail: React.ReactNode) => (
  <SafeAreaInsetsContext.Provider value={INSETS}>
    <FeedSplit detail={detail}>
      <TopInset id="list-top" />
    </FeedSplit>
  </SafeAreaInsetsContext.Provider>
);

describe('FeedSplit — 2단 피드 탭', () => {
  it('폰은 목록만 — 상세 칸을 그리지 않는다', async () => {
    const ui = await render(tree(<Text>상세</Text>));
    expect(ui.queryByTestId('feed-split-detail')).toBeNull();
    expect(ui.queryByText('상세')).toBeNull();
    expect(ui.getByTestId('list-top').props.children).toBe('82');
  });

  it('창을 다 쓰는 2단은 [목록 | 상세] 1:1 — 목록 칸은 위 안전 영역을 통째로 비우지 않는다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(tree(<TopInset id="detail-top" />));
    expect(flat(ui.getByTestId('feed-split').props.style).flexDirection).toBe('row');
    for (const id of ['feed-split-list', 'feed-split-detail']) {
      const pane = flat(ui.getByTestId(id).props.style);
      expect(pane.flex).toBe(1);
      expect(pane.width).toBeUndefined();
    }
    // 펼친 아이폰 Duo: 시스템 표시는 오른쪽 위 모서리뿐 — 왼쪽 칸은 작은 여백(16)만, 오른쪽 칸은
    // 인셋 그대로. 0이 아닌 이유: 제목 알약이 화면 끝에 붙으면 iOS 27 글래스가 글자를 찌그러뜨린다.
    expect(ui.getByTestId('list-top').props.children).toBe('16');
    // 오른쪽 칸은 인셋보다 16 더 내린다 — 와이파이 그림이 인셋(82)보다 낮은 98pt까지 내려온다.
    expect(ui.getByTestId('detail-top').props.children).toBe('98');
  });

  it('고른 글이 없으면 상세 칸에 안내를 둔다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(tree(null));
    expect(ui.getByText('글을 고르면 여기에서 볼 수 있어요')).toBeTruthy();
  });

  it('마우스 웹의 2단은 폰 폭 목록 칸 + 상세 칸을 가운데에 — 위 인셋은 그대로', async () => {
    mockFrame = DESKTOP;
    const ui = await render(tree(<Text>상세</Text>));
    expect(flat(ui.getByTestId('feed-split').props.style).justifyContent).toBe('center');
    expect(flat(ui.getByTestId('feed-split-list').props.style).width).toBe(APP_FRAME_MAX_WIDTH);
    expect(ui.getByTestId('list-top').props.children).toBe('82');
  });
});
