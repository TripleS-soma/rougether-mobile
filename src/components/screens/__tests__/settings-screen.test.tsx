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

  it('계정 섹션에 비밀번호 변경 행이 없다 (#787)', async () => {
    // 서버 인증이 소셜·dev 로그인뿐이라 비밀번호 계정이 없다 — 막다른 화면으로
    // 가는 행이 다시 새어 나오면 여기서 잡는다.
    const { getByText, queryByText } = await render(<SettingsScreen />);
    expect(getByText('프로필 편집')).toBeTruthy();
    expect(queryByText('비밀번호 변경')).toBeNull();
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

  it('announces the checked dark-mode option to assistive technology', async () => {
    const ui = await render(<SettingsScreen themeMode="dark" />);
    expect(ui.getByRole('radio', { name: '다크', checked: true })).toBeTruthy();
    expect(ui.getByRole('radio', { name: '시스템', checked: false })).toBeTruthy();
    expect(ui.getByRole('radio', { name: '라이트', checked: false })).toBeTruthy();
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

  it('폰트는 인라인 칩이 아니라 현재값을 단 행이다 (#750)', async () => {
    const { getByLabelText, queryByLabelText } = await render(<SettingsScreen fontId="suit" />);
    // 인라인 라디오 칩(#382)은 사라지고 별도 화면으로 갔다.
    expect(queryByLabelText('SUIT 폰트')).toBeNull();
    expect(getByLabelText('폰트')).toBeTruthy();
    // 들어가지 않고도 현재 폰트를 알 수 있다.
    expect(getByLabelText('폰트')).toHaveTextContent(/SUIT/);
  });

  it('테마 색상도 폰트처럼 현재값을 단다 (#972)', async () => {
    // 종전엔 "화면 전체가 이미 그 색"이라며 이름을 생략했는데, 색은 보여도
    // 그게 어떤 테마인지는 알 수 없었다.
    const { getByLabelText } = await render(<SettingsScreen themeId="indigo" />);
    expect(getByLabelText('테마 색상')).toHaveTextContent(/인디고 타이드/);
  });

  it('테마 색상·폰트 행이 각자의 화면을 연다 (#459, #750)', async () => {
    const onOpenTheme = jest.fn();
    const onOpenFont = jest.fn();
    const { getByLabelText } = await render(
      <SettingsScreen onOpenTheme={onOpenTheme} onOpenFont={onOpenFont} />,
    );

    await fireEvent.press(getByLabelText('테마 색상'));
    expect(onOpenTheme).toHaveBeenCalledTimes(1);
    expect(onOpenFont).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('폰트'));
    expect(onOpenFont).toHaveBeenCalledTimes(1);
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

  it('주간회고 다시 보기 항목이 onOpenWeeklyReport를 부른다 (#1056)', async () => {
    const onOpenWeeklyReport = jest.fn();
    const { getByText } = await render(<SettingsScreen onOpenWeeklyReport={onOpenWeeklyReport} />);
    await fireEvent.press(getByText('주간회고 다시 보기'));
    expect(onOpenWeeklyReport).toHaveBeenCalledTimes(1);
  });
});
