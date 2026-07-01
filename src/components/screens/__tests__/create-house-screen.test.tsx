import { fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import { CreateHouseScreen } from '@/components/screens/create-house-screen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));

describe('CreateHouseScreen', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<CreateHouseScreen />);
    expect(getByText('새 집 만들기')).toBeTruthy();
  });

  it('creates a house with a valid name', async () => {
    const onCreate = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <CreateHouseScreen onCreate={onCreate} />,
    );

    await fireEvent.changeText(getByPlaceholderText('우리 집 이름을 정해주세요'), '우리집');
    await fireEvent.press(getByText('집 만들기'));

    expect(onCreate).toHaveBeenCalledWith('우리집');
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

  it('copies the invite code to the clipboard', async () => {
    const { getByText } = await render(<CreateHouseScreen />);

    await fireEvent.press(getByText('복사'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.any(String));
  });
});
