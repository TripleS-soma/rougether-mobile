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

  it('renders the font picker with all five options (#382)', async () => {
    const { getByText, getByLabelText } = await render(<SettingsScreen />);
    expect(getByText('폰트')).toBeTruthy();
    for (const name of ['나눔스퀘어라운드', '프리텐다드', '주아 혼합', 'SUIT', '시스템 기본']) {
      expect(getByLabelText(`${name} 폰트`)).toBeTruthy();
    }
  });

  it('changes the app font and marks the active one selected', async () => {
    const onChangeFont = jest.fn();
    const { getByLabelText } = await render(
      <SettingsScreen fontId="nanum" onChangeFont={onChangeFont} />,
    );

    expect(getByLabelText('나눔스퀘어라운드 폰트').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('SUIT 폰트').props.accessibilityState.selected).toBe(false);

    await fireEvent.press(getByLabelText('프리텐다드 폰트'));
    expect(onChangeFont).toHaveBeenCalledWith('pretendard');

    await fireEvent.press(getByLabelText('시스템 기본 폰트'));
    expect(onChangeFont).toHaveBeenCalledWith('system');
  });

  it('약관·개인정보처리방침 링크 행을 연다 (#545)', async () => {
    const onOpenTerms = jest.fn();
    const onOpenPrivacy = jest.fn();
    const { getByText } = await render(
      <SettingsScreen onOpenTerms={onOpenTerms} onOpenPrivacy={onOpenPrivacy} />,
    );

    await fireEvent.press(getByText('이용약관'));
    expect(onOpenTerms).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByText('개인정보처리방침'));
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('replays onboarding', async () => {
    const onReplayOnboarding = jest.fn();
    const { getByText } = await render(<SettingsScreen onReplayOnboarding={onReplayOnboarding} />);

    await fireEvent.press(getByText('튜토리얼 다시 보기'));

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);
  });
});

// 회원탈퇴 (#547) — 낮은 존재감 링크 + 파괴 확인 다이얼로그 뒤에만 콜백.
describe('SettingsScreen 회원탈퇴', () => {
  it('링크 → 확인 다이얼로그 → 탈퇴하기에서만 onWithdraw', async () => {
    const onWithdraw = jest.fn();
    const { getByLabelText, getByText } = await render(<SettingsScreen onWithdraw={onWithdraw} />);

    await fireEvent.press(getByLabelText('회원탈퇴'));
    expect(onWithdraw).not.toHaveBeenCalled(); // 다이얼로그만 열림
    expect(getByText('정말 탈퇴할까요?')).toBeTruthy();

    await fireEvent.press(getByLabelText('회원탈퇴 확인'));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('취소하면 콜백 없이 닫힌다', async () => {
    const onWithdraw = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <SettingsScreen onWithdraw={onWithdraw} />,
    );
    await fireEvent.press(getByLabelText('회원탈퇴'));
    await fireEvent.press(getByText('취소'));
    expect(onWithdraw).not.toHaveBeenCalled();
    expect(queryByText('정말 탈퇴할까요?')).toBeNull();
  });
});
