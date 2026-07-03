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

  it('logs out only after confirming', async () => {
    const onLogout = jest.fn();
    const { getByText, getByLabelText } = await render(<SettingsScreen onLogout={onLogout} />);

    // The row opens a confirm dialog; logout fires only on 확인.
    await fireEvent.press(getByText('로그아웃'));
    expect(onLogout).not.toHaveBeenCalled();
    expect(getByText('로그아웃할까요?')).toBeTruthy();

    await fireEvent.press(getByLabelText('로그아웃 확인'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('does not log out when the confirm is cancelled', async () => {
    const onLogout = jest.fn();
    const { getByText, getByLabelText } = await render(<SettingsScreen onLogout={onLogout} />);

    await fireEvent.press(getByText('로그아웃'));
    await fireEvent.press(getByLabelText('취소'));

    expect(onLogout).not.toHaveBeenCalled();
  });

  it('replays onboarding', async () => {
    const onReplayOnboarding = jest.fn();
    const { getByText } = await render(<SettingsScreen onReplayOnboarding={onReplayOnboarding} />);

    await fireEvent.press(getByText('온보딩 다시 보기'));

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);
  });
});
