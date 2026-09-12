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

  it('keeps a glass action accessible and disables it during a pending operation', async () => {
    const onPress = jest.fn();
    const ui = await render(
      <Button glass label="시작" accessibilityLabel="고양이 계단 시작" onPress={onPress} />,
    );
    await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await ui.rerender(
      <Button
        glass
        disabled
        label="시작"
        accessibilityLabel="고양이 계단 시작"
        onPress={onPress}
      />,
    );
    await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
