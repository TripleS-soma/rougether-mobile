import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders the label and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="저장" onPress={onPress} />);
    fireEvent.press(getByText('저장'));
    expect(onPress).toHaveBeenCalled();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="저장" onPress={onPress} disabled />);
    fireEvent.press(getByText('저장'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
