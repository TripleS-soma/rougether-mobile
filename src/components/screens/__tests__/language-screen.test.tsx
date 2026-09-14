import { fireEvent, render } from '@testing-library/react-native';

import { LanguageScreen } from '@/components/screens/language-screen';

describe('LanguageScreen (#893)', () => {
  it('각 언어를 자기 이름으로 보여주고, 다른 언어를 고르면 즉시 알린다', async () => {
    const onSelect = jest.fn();
    const ui = await render(<LanguageScreen language="ko" onSelectLanguage={onSelect} />);
    expect(ui.getByText('언어')).toBeTruthy();
    expect(ui.getByLabelText('한국어 언어').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(ui.getByLabelText('English 언어'));
    expect(onSelect).toHaveBeenCalledWith('en');
    // 이미 고른 언어를 또 누르면 아무 일도 없다.
    await fireEvent.press(ui.getByLabelText('한국어 언어'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
