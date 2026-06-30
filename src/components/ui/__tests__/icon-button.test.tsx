import { fireEvent, render } from '@testing-library/react-native';

import { IconButton } from '@/components/ui/icon-button';

describe('IconButton', () => {
  it('renders with its accessibility label and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <IconButton name="close" accessibilityLabel="닫기" onPress={onPress} />,
    );
    const btn = getByLabelText('닫기');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalled();
  });
});
