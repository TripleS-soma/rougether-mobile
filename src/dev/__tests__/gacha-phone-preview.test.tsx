import { fireEvent, render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { GachaPhonePreview } from '@/dev/gacha-phone-preview';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('@/components/screens/gacha-screen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { GachaScreen: () => React.createElement(Text, null, 'phone-gacha-screen') };
});

it('keeps fullscreen demos closed in the full gallery until requested', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  const screen = await render(<GachaPhonePreview fullscreen />);
  expect(screen.queryByText('phone-gacha-screen')).toBeNull();
  await fireEvent.press(screen.getByText('휴대폰 화면 미리보기'));
  expect(screen.getByText('phone-gacha-screen')).toBeTruthy();
});

it('opens a directly selected phone preview immediately', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ entry: 'GachaPhonePreview' });
  const screen = await render(<GachaPhonePreview fullscreen />);
  expect(screen.getByText('phone-gacha-screen')).toBeTruthy();
});
