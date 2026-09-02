import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';

import { navUnderlapInset } from '@/components/ui/bottom-nav-geometry';
import { useBottomNavInset, useScreenStyle } from '@/hooks/use-screen-style';

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

  it('글래스가 불가하면 0 — 불투명 바는 flex 형제라 콘텐츠를 안 가린다', async () => {
    const { getByTestId } = await render(wrap(<InsetProbe />));
    expect(getByTestId('inset').props.children).toBe('0');
  });

  it('글래스 알약이 떠 있으면 바닥 여백 + 알약 높이 + 숨 — 바텀바와 같은 식을 쓴다', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    const { getByTestId } = await render(wrap(<InsetProbe />));
    const expected = navUnderlapInset(METRICS.insets.bottom, 18); // supporting 줄높이 18
    expect(expected).toBeGreaterThan(METRICS.insets.bottom);
    expect(getByTestId('inset').props.children).toBe(String(expected));
  });
});
