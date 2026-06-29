import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';

import { useScreenStyle } from '@/hooks/use-screen-style';

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
