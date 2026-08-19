import { fireEvent, render } from '@testing-library/react-native';

import { ThemeScreen } from '@/components/screens/theme-screen';

describe('ThemeScreen', () => {
  it('renders the title and all five theme options', async () => {
    const { getByText } = await render(<ThemeScreen themeId="cozy" />);
    expect(getByText('테마 색상')).toBeTruthy();
    for (const name of ['포근', '라떼', '시트러스 그로브', '파스텔 캔디', '인디고 타이드']) {
      expect(getByText(name)).toBeTruthy();
    }
  });

  it('reports the picked theme id', async () => {
    const onChangeThemeId = jest.fn();
    const { getByLabelText } = await render(
      <ThemeScreen themeId="cozy" onChangeThemeId={onChangeThemeId} />,
    );

    await fireEvent.press(getByLabelText('인디고 타이드 테마'));

    expect(onChangeThemeId).toHaveBeenCalledWith('indigo');
  });

  it('marks the active theme as selected', async () => {
    const { getByLabelText } = await render(<ThemeScreen themeId="latte" />);
    expect(getByLabelText('라떼 테마').props.accessibilityState).toMatchObject({ selected: true });
    expect(getByLabelText('포근 테마').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('goes back when the header back button is pressed', async () => {
    const onBack = jest.fn();
    const { getByLabelText } = await render(<ThemeScreen themeId="cozy" onBack={onBack} />);
    await fireEvent.press(getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalled();
  });

  it('미리보기 카드에 내 닉네임·캐릭터를 넘긴다 (#899)', async () => {
    const { getByText, getByLabelText } = await render(
      <ThemeScreen userName="루티" characterId="otter" />,
    );
    expect(getByText('루티의 방')).toBeTruthy();
    expect(getByLabelText('수달')).toBeTruthy();
  });
});
