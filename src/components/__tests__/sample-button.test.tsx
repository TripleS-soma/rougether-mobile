import { fireEvent, render } from '@testing-library/react-native';

import { SampleButton } from '@/components/sample-button';

// In React Native Testing Library v14, `render` and `fireEvent` are async
// (they await `act` internally), so tests await them.
describe('SampleButton', () => {
  it('renders its label', async () => {
    const { getByText } = await render(<SampleButton label="Tap me" />);
    expect(getByText('Tap me')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<SampleButton label="Tap me" onPress={onPress} />);

    await fireEvent.press(getByText('Tap me'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<SampleButton label="Tap me" onPress={onPress} disabled />);

    await fireEvent.press(getByText('Tap me'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
