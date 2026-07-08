import { fireEvent, render } from '@testing-library/react-native';

import { SignupScreen } from '@/components/screens/signup-screen';
import { ToastProvider } from '@/components/ui/toast';

describe('SignupScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<SignupScreen />);
    expect(getByText('회원가입')).toBeTruthy();
  });

  it('goes back to login', async () => {
    const onBack = jest.fn();
    const { getByText } = await render(<SignupScreen onBack={onBack} />);

    await fireEvent.press(getByText('로그인'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('reveals the verification-code field after requesting a code', async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = await render(
      <SignupScreen />,
    );
    expect(queryByPlaceholderText('6자리 인증번호')).toBeNull();

    await fireEvent.changeText(getByPlaceholderText('example@email.com'), 'a@b.com');
    await fireEvent.press(getByText('인증요청'));

    expect(getByPlaceholderText('6자리 인증번호')).toBeTruthy();
  });

  it('shows the not-ready notice and explains the dead submit with a toast', async () => {
    const { getByText } = await render(
      <ToastProvider>
        <SignupScreen />
      </ToastProvider>,
    );

    expect(getByText(/이메일 가입은 준비 중이에요/)).toBeTruthy();
    // Still never submits — the tap explains the server-pending state instead.
    await fireEvent.press(getByText('가입 준비 중'));
    expect(getByText('이메일 가입은 서버 준비 중이에요')).toBeTruthy();
  });
});
