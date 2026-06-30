import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { Themes } from '@/constants/theme';
import { BrandThemeProvider, useBrandTheme, useTokens } from '@/hooks/use-tokens';

function Probe() {
  const t = useTokens();
  const { themeId, setThemeId } = useBrandTheme();
  return (
    <>
      <Text>id:{themeId}</Text>
      <Text>primary:{t.primary}</Text>
      <Pressable accessibilityLabel="forest" onPress={() => setThemeId('forest')}>
        <Text>switch</Text>
      </Pressable>
    </>
  );
}

describe('BrandThemeProvider + useTokens', () => {
  it('defaults to the cozy theme', async () => {
    const { getByText } = await render(
      <BrandThemeProvider>
        <Probe />
      </BrandThemeProvider>,
    );
    expect(getByText('id:cozy')).toBeTruthy();
    expect(getByText(`primary:${Themes.cozy.primary}`)).toBeTruthy();
  });

  it('re-tints the tokens when the theme is switched', async () => {
    const { getByText, getByLabelText } = await render(
      <BrandThemeProvider>
        <Probe />
      </BrandThemeProvider>,
    );

    await fireEvent.press(getByLabelText('forest'));

    expect(getByText('id:forest')).toBeTruthy();
    expect(getByText(`primary:${Themes.forest.primary}`)).toBeTruthy();
  });
});
