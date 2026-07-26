import { fireEvent, render } from '@testing-library/react-native';

import { LoginScreen } from '@/components/screens/login-screen';
import { ToastProvider } from '@/components/ui/toast';

describe('LoginScreen', () => {
  it('renders the brand title', async () => {
    const { getByText } = await render(<LoginScreen />);
    expect(getByText('루게더')).toBeTruthy();
  });

  it('submits with email + password filled', async () => {
    const onAuthSuccess = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <LoginScreen onAuthSuccess={onAuthSuccess} />,
    );

    await fireEvent.changeText(getByPlaceholderText('이메일'), 'a@b.com');
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'secret');
    await fireEvent.press(getByText('로그인'));

    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('signs into a specific account when the field holds a numeric userId', async () => {
    const onLogin = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(<LoginScreen onLogin={onLogin} />);

    await fireEvent.changeText(getByPlaceholderText('이메일'), '7');
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'x');
    await fireEvent.press(getByText('로그인'));

    expect(onLogin).toHaveBeenCalledWith(7);
  });

  it('creates a fresh account when the userId field is empty', async () => {
    const onLogin = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(<LoginScreen onLogin={onLogin} />);

    // Only the password is required; empty userId → new-user login.
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'x');
    await fireEvent.press(getByText('로그인'));

    expect(onLogin).toHaveBeenCalledWith(undefined);
  });

  it('explains an empty password with a toast instead of submitting', async () => {
    const onLogin = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <LoginScreen onLogin={onLogin} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('로그인'));

    expect(getByText('비밀번호를 입력해주세요')).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('offers 카카오·애플·구글 social login (spec lineup, no 네이버)', async () => {
    const { getByLabelText, queryByLabelText } = await render(<LoginScreen />);

    expect(getByLabelText('카카오로 시작')).toBeTruthy();
    expect(getByLabelText('애플로 시작')).toBeTruthy();
    expect(getByLabelText('구글로 시작')).toBeTruthy();
    expect(queryByLabelText('네이버로 시작')).toBeNull();
  });

  it('구글 버튼이 onGoogleLogin을 부르고 성공 시 onAuthSuccess (#489)', async () => {
    const onGoogleLogin = jest.fn(async () => 'ok' as const);
    const onAuthSuccess = jest.fn();
    const { getByLabelText } = await render(
      <LoginScreen onGoogleLogin={onGoogleLogin} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(getByLabelText('구글로 시작'));
    expect(onGoogleLogin).toHaveBeenCalledTimes(1);
    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('구글 로그인 취소는 조용히, 실패는 에러 문구 (#489)', async () => {
    const onAuthSuccess = jest.fn();
    const cancelled = await render(
      <LoginScreen onGoogleLogin={async () => 'cancelled'} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(cancelled.getByLabelText('구글로 시작'));
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(cancelled.queryByText(/구글 로그인에 실패했어요/)).toBeNull();

    const failed = await render(
      <LoginScreen onGoogleLogin={async () => 'failed'} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(failed.getByLabelText('구글로 시작'));
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(failed.getByText(/구글 로그인에 실패했어요/)).toBeTruthy();
  });

  it('does not show the dev-login hint', async () => {
    const { queryByText } = await render(<LoginScreen />);
    expect(queryByText(/개발 로그인/)).toBeNull();
  });

  it('navigates to signup', async () => {
    const onGoSignup = jest.fn();
    const { getByText } = await render(<LoginScreen onGoSignup={onGoSignup} />);

    await fireEvent.press(getByText('회원가입'));

    expect(onGoSignup).toHaveBeenCalledTimes(1);
  });
});
