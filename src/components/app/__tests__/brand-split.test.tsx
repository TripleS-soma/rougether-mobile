import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { BrandSplit } from '@/components/app/brand-split';
import { useBrandSplit, usePaneWidth } from '@/hooks/use-brand-split';
import type { AppFrame } from '@/hooks/use-app-frame';

// 로그인·회원가입·온보딩의 넓은 화면 배치 — 왼쪽 칸에 앱 소개, 오른쪽 칸에 화면.
const PHONE: AppFrame = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false }; // prettier-ignore
const DUO_OPEN: AppFrame = { ...PHONE, width: 951, height: 669, framed: true, split: true, splitFill: true }; // prettier-ignore
let mockFrame: AppFrame = PHONE;
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));
afterEach(() => {
  mockFrame = PHONE;
});

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;
function Probe() {
  const inSplit = useBrandSplit();
  const width = usePaneWidth();
  return <Text testID="probe">{`${inSplit}:${width}`}</Text>;
}

describe('BrandSplit', () => {
  it('폰은 화면만 — 소개 칸이 없고, 칸 폭은 프레임 폭 그대로', async () => {
    const ui = await render(
      <BrandSplit>
        <Probe />
      </BrandSplit>,
    );
    expect(ui.queryByTestId('brand-split-brand')).toBeNull();
    expect(ui.getByTestId('probe').props.children).toBe('false:390');
  });

  it('2단은 [앱 소개 | 화면] 1:1 — 화면에는 2단 안임과 칸 폭을 알려 준다', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(
      <BrandSplit>
        <Probe />
      </BrandSplit>,
    );
    expect(flat(ui.getByTestId('brand-split').props.style).flexDirection).toBe('row');
    for (const id of ['brand-split-brand', 'brand-split-content']) {
      expect(flat(ui.getByTestId(id).props.style).flex).toBe(1);
    }
    expect(ui.getByText('루게더')).toBeTruthy();
    expect(ui.getByText('매일의 루틴으로 나만의 방과 집을 함께 키워요.')).toBeTruthy();
    // 칸을 재기 전에는 프레임의 절반으로 어림하고, 잰 뒤에는 실제 폭.
    expect(ui.getByTestId('probe').props.children).toBe('true:475.5');
    await fireEvent(ui.getByTestId('brand-split-content'), 'layout', {
      nativeEvent: { layout: { x: 475, y: 0, width: 476, height: 669 } },
    });
    expect(ui.getByTestId('probe').props.children).toBe('true:476');
  });

  it('BrandSplit 밖에서는 2단 안이 아니고 칸 폭은 프레임 폭', async () => {
    mockFrame = DUO_OPEN;
    const ui = await render(<Probe />);
    expect(ui.getByTestId('probe').props.children).toBe('false:951');
  });
});
