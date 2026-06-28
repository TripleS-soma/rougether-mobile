import { fireEvent, render } from '@testing-library/react-native';

import { LoginScreen } from '@/components/screens/login-screen';

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

  it('navigates to signup', async () => {
    const onGoSignup = jest.fn();
    const { getByText } = await render(<LoginScreen onGoSignup={onGoSignup} />);

    await fireEvent.press(getByText('회원가입'));

    expect(onGoSignup).toHaveBeenCalledTimes(1);
  });
});
