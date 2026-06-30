import { fireEvent, render } from '@testing-library/react-native';

import { PasswordChangeScreen } from '@/components/screens/password-change-screen';

describe('PasswordChangeScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<PasswordChangeScreen />);
    expect(getByText('비밀번호 변경')).toBeTruthy();
  });

  it('submits when current + matching valid new password are entered', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <PasswordChangeScreen onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'oldpass1');
    await fireEvent.changeText(getByPlaceholderText('8자 이상 입력해주세요'), 'newpass1');
    await fireEvent.changeText(getByPlaceholderText('새 비밀번호를 다시 입력해주세요'), 'newpass1');
    await fireEvent.press(getByText('변경하기'));

    expect(onSubmit).toHaveBeenCalledWith('oldpass1', 'newpass1');
  });

  it('does not submit when the confirmation does not match', async () => {
    const onSubmit = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <PasswordChangeScreen onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(getByPlaceholderText('현재 비밀번호'), 'oldpass1');
    await fireEvent.changeText(getByPlaceholderText('8자 이상 입력해주세요'), 'newpass1');
    await fireEvent.changeText(
      getByPlaceholderText('새 비밀번호를 다시 입력해주세요'),
      'different',
    );
    await fireEvent.press(getByText('변경하기'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getByText('비밀번호가 일치하지 않아요.')).toBeTruthy();
  });
});
