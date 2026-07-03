import { fireEvent, render } from '@testing-library/react-native';

import { PasswordChangeScreen } from '@/components/screens/password-change-screen';

describe('PasswordChangeScreen', () => {
  it('renders the title and the not-ready notice with a disabled submit', async () => {
    const { getByText } = await render(<PasswordChangeScreen />);
    expect(getByText('비밀번호 변경')).toBeTruthy();
    // No password API yet — the screen says so and submit never fires.
    expect(getByText(/비밀번호 변경은 준비 중이에요/)).toBeTruthy();
    await fireEvent.press(getByText('변경 준비 중'));
  });

  it('still validates a mismatching confirmation locally', async () => {
    const { getByText, getByPlaceholderText } = await render(<PasswordChangeScreen />);

    await fireEvent.changeText(getByPlaceholderText('8자 이상 입력해주세요'), 'newpass1');
    await fireEvent.changeText(
      getByPlaceholderText('새 비밀번호를 다시 입력해주세요'),
      'different',
    );

    expect(getByText('비밀번호가 일치하지 않아요.')).toBeTruthy();
  });
});
