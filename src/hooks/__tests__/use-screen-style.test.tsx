import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';

import { navUnderlapInset } from '@/components/ui/bottom-nav-geometry';
import { Typography } from '@/constants/theme';
import { useBottomNavInset, useScreenStyle } from '@/hooks/use-screen-style';

let mockNavRail = false;
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => ({ width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false, navRail: mockNavRail }), // prettier-ignore
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

function Probe({ edges }: { edges?: ('top' | 'bottom')[] }) {
  const style = useScreenStyle(edges);
  return (
    <View testID="probe" style={style}>
      <Text>x</Text>
    </View>
  );
}

function InsetProbe() {
  const inset = useBottomNavInset();
  return <Text testID="inset">{String(inset)}</Text>;
}

const wrap = (node: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>
);

describe('useScreenStyle', () => {
  it('applies the top inset by default and the screen background', async () => {
    const { getByTestId } = await render(wrap(<Probe />));
    const style = getByTestId('probe').props.style;
    expect(style.paddingTop).toBe(47);
    expect(style.paddingBottom).toBe(0);
    expect(style.backgroundColor).toBeTruthy();
  });

  it('applies the bottom inset when requested', async () => {
    const { getByTestId } = await render(wrap(<Probe edges={['top', 'bottom']} />));
    const style = getByTestId('probe').props.style;
    expect(style.paddingTop).toBe(47);
    expect(style.paddingBottom).toBe(34);
  });
});

describe('useBottomNavInset (#1049)', () => {
  afterEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  });

  it('글래스가 불가해도 같은 인셋 — 알약은 전 플랫폼 오버레이다 (#1074)', async () => {
    const { getByTestId } = await render(wrap(<InsetProbe />));
    expect(getByTestId('inset').props.children).toBe(
      String(navUnderlapInset(METRICS.insets.bottom, Typography.supporting.lineHeight)),
    );
  });

  it('글래스 알약이 떠 있으면 바닥 여백 + 알약 높이 + 숨 — 바텀바와 같은 식을 쓴다', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    const { getByTestId } = await render(wrap(<InsetProbe />));
    const expected = navUnderlapInset(METRICS.insets.bottom, Typography.supporting.lineHeight); // supporting 줄높이 18
    expect(expected).toBeGreaterThan(METRICS.insets.bottom);
    expect(getByTestId('inset').props.children).toBe(String(expected));
  });

  it('왼쪽 세로 탭 줄이면 아래 탭 바가 없다 — 홈 인디케이터 자리만 비운다', async () => {
    mockNavRail = true;
    const { getByTestId } = await render(wrap(<InsetProbe />));
    expect(getByTestId('inset').props.children).toBe(String(METRICS.insets.bottom));
    mockNavRail = false;
  });
});
