import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { GlassSurface } from '@/components/ui/glass-surface';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('GlassSurface (#1050)', () => {
  afterEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  });

  it('글래스가 불가하면 fallbackColor를 칠한 일반 View', async () => {
    const { getByTestId, getByText } = await render(
      <GlassSurface testID="face" fallbackColor="#ABCDEF" style={{ borderRadius: 999 }}>
        <Text>x</Text>
      </GlassSurface>,
    );
    expect(getByText('x')).toBeTruthy();
    const style = flat(getByTestId('face').props.style);
    expect(style.backgroundColor).toBe('#ABCDEF');
    expect(style.borderRadius).toBe(999);
  });

  it('글래스가 가능하면 배경색 없이 GlassView로 — 밑 콘텐츠가 비쳐야 한다', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    const { getByTestId } = await render(
      <GlassSurface testID="face" fallbackColor="#ABCDEF" style={{ borderRadius: 999 }}>
        <Text>x</Text>
      </GlassSurface>,
    );
    const el = getByTestId('face');
    expect(flat(el.props.style).backgroundColor).toBeUndefined();
    expect(el.props.glassEffectStyle).toBe('regular');
    expect(el.props.isInteractive).toBe(true);
  });
});
