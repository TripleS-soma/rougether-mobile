import { fireEvent, render } from '@testing-library/react-native';

import { BearCheck } from '@/components/ui/bear-check';

describe('BearCheck (#344)', () => {
  it('keeps the checkbox accessibility contract and toggles on press', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <BearCheck
        checked={false}
        color="#E8A87C"
        onPress={onPress}
        accessibilityLabel="아침 스트레칭"
      />,
    );
    const box = getByLabelText('아침 스트레칭');
    expect(box.props.accessibilityState).toEqual({ checked: false });
    await fireEvent.press(box);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the white tick only when checked', async () => {
    const unchecked = await render(<BearCheck checked={false} />);
    expect(unchecked.queryByTestId('bear-check-tick')).toBeNull();

    const checked = await render(<BearCheck checked color="#7FA8D4" />);
    expect(checked.getByTestId('bear-check-tick')).toBeTruthy();
  });

  it('renders as display-only without onPress (no checkbox role)', async () => {
    const { queryByRole } = await render(<BearCheck checked />);
    expect(queryByRole('checkbox')).toBeNull();
  });
});
