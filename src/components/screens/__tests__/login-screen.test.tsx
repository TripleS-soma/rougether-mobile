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

  it('navigates to signup', async () => {
    const onGoSignup = jest.fn();
    const { getByText } = await render(<LoginScreen onGoSignup={onGoSignup} />);

    await fireEvent.press(getByText('회원가입'));

    expect(onGoSignup).toHaveBeenCalledTimes(1);
  });
});
