import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { DarkThemes, Themes } from '@/constants/theme';
import { BrandThemeProvider, useBrandTheme, useTokens } from '@/hooks/use-tokens';

// The provider persists {themeId, mode} — clear it so tests stay independent.
beforeEach(() => AsyncStorage.clear());

function Probe() {
  const t = useTokens();
  const { themeId, setThemeId, mode, setMode } = useBrandTheme();
  return (
    <>
      <Text>id:{themeId}</Text>
      <Text>mode:{mode}</Text>
      <Text>primary:{t.primary}</Text>
      <Pressable accessibilityLabel="forest" onPress={() => setThemeId('forest')}>
        <Text>switch</Text>
      </Pressable>
      <Pressable accessibilityLabel="dark" onPress={() => setMode('dark')}>
        <Text>darken</Text>
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

  it('resolves dark tokens when the mode is forced dark', async () => {
    const { getByText, getByLabelText } = await render(
      <BrandThemeProvider>
        <Probe />
      </BrandThemeProvider>,
    );

    // System mode in the test env resolves light.
    expect(getByText('mode:system')).toBeTruthy();
    expect(getByText(`primary:${Themes.cozy.primary}`)).toBeTruthy();

    await fireEvent.press(getByLabelText('dark'));
    expect(getByText('mode:dark')).toBeTruthy();
    expect(getByText(`primary:${DarkThemes.cozy.primary}`)).toBeTruthy();

    // The brand theme keeps applying within dark mode.
    await fireEvent.press(getByLabelText('forest'));
    expect(getByText(`primary:${DarkThemes.forest.primary}`)).toBeTruthy();
  });
});
