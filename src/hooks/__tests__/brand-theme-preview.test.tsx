import { render, within } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { DarkThemes, Themes } from '@/constants/theme';
import { BrandThemePreview, useBrandTheme, useTokens, useTypography } from '@/hooks/use-tokens';

function Probe() {
  const { mode } = useBrandTheme();
  const t = useTokens();
  const type = useTypography();
  return <Text>{`${mode}|${t.primary}|${type.body.fontFamily}`}</Text>;
}

it('overrides mode in a nested preview without changing the parent or sibling', async () => {
  const view = await render(
    <BrandThemePreview themeId="latte" fontId="suit" mode="light">
      <View testID="parent">
        <Probe />
      </View>
      <BrandThemePreview mode="dark">
        <View testID="dark">
          <Probe />
        </View>
      </BrandThemePreview>
      <BrandThemePreview>
        <View testID="inherited">
          <Probe />
        </View>
      </BrandThemePreview>
    </BrandThemePreview>,
  );
  expect(
    within(view.getByTestId('parent')).getByText(`light|${Themes.latte.primary}|SUIT-Regular`),
  ).toBeTruthy();
  expect(
    within(view.getByTestId('dark')).getByText(`dark|${DarkThemes.latte.primary}|SUIT-Regular`),
  ).toBeTruthy();
  expect(
    within(view.getByTestId('inherited')).getByText(`light|${Themes.latte.primary}|SUIT-Regular`),
  ).toBeTruthy();
});

it('updates the palette when preview controls change mode', async () => {
  const view = await render(
    <BrandThemePreview mode="light">
      <Probe />
    </BrandThemePreview>,
  );
  expect(view.getByText(`light|${Themes.cozy.primary}|NanumSquareRoundR`)).toBeTruthy();
  await view.rerender(
    <BrandThemePreview mode="dark">
      <Probe />
    </BrandThemePreview>,
  );
  expect(view.getByText(`dark|${DarkThemes.cozy.primary}|NanumSquareRoundR`)).toBeTruthy();
});
