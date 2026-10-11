import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import * as material from '@/hooks/use-liquid-glass';
import { GlassSurface } from '@/components/ui/glass-surface';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('GlassSurface (#1050)', () => {
  afterEach(() => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  });

  it('글래스가 불가하면 fallbackColor를 90% 알파로 칠한 반투명 View + 그림자 (#1074)', async () => {
    const { getByTestId, getByText } = await render(
      <GlassSurface testID="face" fallbackColor="#ABCDEF" style={{ borderRadius: 999 }}>
        <Text>x</Text>
      </GlassSurface>,
    );
    expect(getByText('x')).toBeTruthy();
    const style = flat(getByTestId('face').props.style);
    expect(style.backgroundColor).toBe('#ABCDEFE6');
    expect(style.borderRadius).toBe(999);
    // iOS 그림자(shadow*)로 떠 있음 — elevation은 안드로이드 전용 속성이라 쓰지 않는다.
    expect(style.shadowOpacity).toBe(0.12);
    expect(style.elevation).toBeUndefined();
  });

  it('안드로이드는 반투명 폴백에 그림자를 주지 않는다 — elevation이 면을 통과해 회색 테두리로 비쳤다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { getByTestId } = await render(
      <GlassSurface testID="face" fallbackColor="#ABCDEF">
        <Text>x</Text>
      </GlassSurface>,
    );
    const style = flat(getByTestId('face').props.style);
    expect(style.elevation).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
    // 반투명 면 자체는 그대로(90% 알파).
    expect(style.backgroundColor).toBe('#ABCDEFE6');
    jest.restoreAllMocks();
  });

  it('lift={false}면 폴백에서 그림자(elevation)를 그리지 않는다 — 카드 목록의 회색 테두리 (#1328)', async () => {
    const { getByTestId } = await render(
      <GlassSurface testID="face" fallbackColor="#ABCDEF" glassEffectStyle="clear" lift={false}>
        <Text>x</Text>
      </GlassSurface>,
    );
    const style = flat(getByTestId('face').props.style);
    expect(style.elevation).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
    // 반투명 폴백 자체는 유지된다(clear = 50% 알파).
    expect(style.backgroundColor).toBe('#ABCDEF80');
  });

  it('틴트(강조 버튼)는 폴백에서 단색 그대로', async () => {
    const { getByTestId } = await render(
      <GlassSurface testID="face" fallbackColor="#112233" tintColor="#112233">
        <Text>x</Text>
      </GlassSurface>,
    );
    expect(flat(getByTestId('face').props.style).backgroundColor).toBe('#112233');
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

it('clear 패널은 옅은 폴백을 쓰고 투명도 줄이기에서는 완전히 불투명해진다', async () => {
  const hook = jest.spyOn(material, 'useGlassMaterial');
  try {
    hook.mockReturnValue('translucent');
    const ui = await render(
      <GlassSurface
        testID="panel"
        fallbackColor="#ABCDEF"
        glassEffectStyle="clear"
        interactive={false}
      />,
    );
    expect(flat(ui.getByTestId('panel').props.style).backgroundColor).toBe('#ABCDEF80');
    hook.mockReturnValue('opaque');
    await ui.rerender(
      <GlassSurface
        testID="panel"
        fallbackColor="#ABCDEF"
        glassEffectStyle="clear"
        interactive={false}
      />,
    );
    expect(flat(ui.getByTestId('panel').props.style).backgroundColor).toBe('#ABCDEF');
    hook.mockReturnValue('glass');
    await ui.rerender(
      <GlassSurface
        testID="panel"
        fallbackColor="#ABCDEF"
        glassEffectStyle="clear"
        interactive={false}
      />,
    );
    expect(ui.getByTestId('panel').props.glassEffectStyle).toBe('clear');
    expect(ui.getByTestId('panel').props.isInteractive).toBe(false);
  } finally {
    hook.mockRestore();
  }
});
