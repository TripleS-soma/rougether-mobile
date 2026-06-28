import { fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from '@/components/screens/settings-screen';

describe('SettingsScreen', () => {
  it('renders the title and theme options', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('설정')).toBeTruthy();
    expect(getByText('포근')).toBeTruthy();
    expect(getByText('한옥')).toBeTruthy();
  });

  it('changes theme', async () => {
    const onChangeTheme = jest.fn();
    const { getByText } = await render(<SettingsScreen onChangeTheme={onChangeTheme} />);

    await fireEvent.press(getByText('숲'));

    expect(onChangeTheme).toHaveBeenCalledWith('forest');
  });

  it('logs out', async () => {
    const onLogout = jest.fn();
    const { getByText } = await render(<SettingsScreen onLogout={onLogout} />);

    await fireEvent.press(getByText('로그아웃'));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
