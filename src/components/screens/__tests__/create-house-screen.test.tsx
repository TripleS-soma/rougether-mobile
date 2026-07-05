import { fireEvent, render } from '@testing-library/react-native';

import { CreateHouseScreen } from '@/components/screens/create-house-screen';

describe('CreateHouseScreen', () => {
  it('renders the title and the server-issued invite-code notice', async () => {
    const { getByText } = await render(<CreateHouseScreen />);
    expect(getByText('새 집 만들기')).toBeTruthy();
    // The invite code is issued by the API on creation — no local generator.
    expect(getByText(/초대코드가 자동으로 발급돼요/)).toBeTruthy();
  });

  it('creates a house with name/description/capacity', async () => {
    const onCreate = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <CreateHouseScreen onCreate={onCreate} />,
    );

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), '우리집');
    await fireEvent.press(getByText('집 만들기'));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '우리집', maxMembers: expect.any(Number) }),
    );
  });

  it('does not create with a too-short name', async () => {
    const onCreate = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <CreateHouseScreen onCreate={onCreate} />,
    );

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), 'a');
    await fireEvent.press(getByText('집 만들기'));

    expect(onCreate).not.toHaveBeenCalled();
  });
});
