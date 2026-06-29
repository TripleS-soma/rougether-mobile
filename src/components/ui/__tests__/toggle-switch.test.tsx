import { fireEvent, render } from '@testing-library/react-native';

import { ToggleSwitch } from '@/components/ui/toggle-switch';

describe('ToggleSwitch', () => {
  it('fires onToggle when pressed and reflects its checked state', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(
      <ToggleSwitch value={false} onToggle={onToggle} accessibilityLabel="알림" />,
    );
    const sw = getByLabelText('알림');
    expect(sw.props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(sw);
    expect(onToggle).toHaveBeenCalled();
  });
});
