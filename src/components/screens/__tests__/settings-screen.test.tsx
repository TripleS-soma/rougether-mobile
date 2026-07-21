import { fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from '@/components/screens/settings-screen';

describe('SettingsScreen', () => {
  it('renders the title and the dark-mode picker (no brand theme picker)', async () => {
    const { getByText, queryByText } = await render(<SettingsScreen />);
    expect(getByText('설정')).toBeTruthy();
    expect(getByText('다크 모드')).toBeTruthy();
    // The 포근/숲/한옥 화면 스타일 picker was removed — cozy is the only theme.
    expect(queryByText('화면 스타일')).toBeNull();
    expect(queryByText('숲')).toBeNull();
  });

  it('changes the dark mode preference', async () => {
    const onChangeThemeMode = jest.fn();
    const { getByText, getByLabelText } = await render(
      <SettingsScreen onChangeThemeMode={onChangeThemeMode} />,
    );

    expect(getByText('다크 모드')).toBeTruthy();
    await fireEvent.press(getByLabelText('다크'));
    expect(onChangeThemeMode).toHaveBeenCalledWith('dark');

    await fireEvent.press(getByLabelText('시스템'));
    expect(onChangeThemeMode).toHaveBeenCalledWith('system');
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

    await fireEvent.press(getByText('튜토리얼 다시 보기'));

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);
  });
});
