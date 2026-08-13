import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { WHEEL_ITEM_HEIGHT, WheelPicker } from '@/components/ui/wheel-picker';

const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
  accessibilityLabel: `${i + 1}시`,
}));

function Harness({ onChange }: { onChange?: (v: number) => void }) {
  const [hour, setHour] = useState(7);
  return (
    <>
      <Text>{`값: ${hour}`}</Text>
      <WheelPicker
        items={HOURS}
        value={hour}
        onChange={(v) => {
          setHour(v);
          onChange?.(v);
        }}
        accessibilityLabel="시 선택"
        testID="wheel"
      />
    </>
  );
}

describe('WheelPicker', () => {
  it('renders every row and marks the current value selected', async () => {
    const { getByLabelText } = await render(<Harness />);
    expect(getByLabelText('1시')).toBeTruthy();
    expect(getByLabelText('7시').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('8시').props.accessibilityState.selected).toBe(false);
  });

  it('selects a value by tapping its row', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText } = await render(<Harness onChange={onChange} />);
    await fireEvent.press(getByLabelText('9시'));
    expect(onChange).toHaveBeenCalledWith(9);
    expect(getByText('값: 9')).toBeTruthy();
  });

  it('commits the snapped row when a swipe settles', async () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = await render(<Harness onChange={onChange} />);
    // 스와이프 종료: 3번째 행(index 2 = "3")에 스냅된 offset으로 momentum end.
    await fireEvent(getByTestId('wheel-scroll'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 2 * WHEEL_ITEM_HEIGHT } },
    });
    expect(onChange).toHaveBeenCalledWith(3);
    expect(getByText('값: 3')).toBeTruthy();
  });

  it('steps through values via accessibility increment/decrement', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(<Harness onChange={onChange} />);
    await fireEvent(getByLabelText('시 선택'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenCalledWith(8);
    await fireEvent(getByLabelText('시 선택'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });
});
