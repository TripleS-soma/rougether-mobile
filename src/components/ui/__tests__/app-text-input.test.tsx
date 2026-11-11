import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';

import { AppTextInput } from '@/components/ui/app-text-input';

describe('AppTextInput', () => {
  it('replaces only the incomplete face, preserving layout, color and weight', async () => {
    const { getByTestId } = await render(
      <AppTextInput
        testID="input"
        style={[{ fontSize: 18, color: 'red' }, { fontFamily: 'NanumSquareRoundB' }]}
      />,
    );
    expect(StyleSheet.flatten(getByTestId('input').props.style)).toEqual({
      fontSize: 18,
      color: 'red',
      fontFamily: 'Pretendard-SemiBold',
    });
  });

  it.each([undefined, 'Pretendard-Regular'])(
    'preserves a complete/system face: %s',
    async (fontFamily) => {
      const style = { fontSize: 16, fontFamily };
      const { getByTestId } = await render(<AppTextInput testID="input" style={style} />);
      expect(StyleSheet.flatten(getByTestId('input').props.style)).toEqual(style);
    },
  );

  it('keeps the native controlled value, events, limits, multiline and ref methods', async () => {
    const ref = createRef<TextInput>();
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    const { getByTestId, rerender } = await render(
      <AppTextInput
        ref={ref}
        testID="input"
        value="루겓"
        onChangeText={onChangeText}
        onBlur={onBlur}
        maxLength={12}
        multiline
      />,
    );
    expect(getByTestId('input').props.value).toBe('루겓');
    expect(getByTestId('input').props.maxLength).toBe(12);
    expect(getByTestId('input').props.multiline).toBe(true);
    expect(typeof ref.current?.focus).toBe('function');
    expect(typeof ref.current?.clear).toBe('function');
    await fireEvent.changeText(getByTestId('input'), '루게');
    expect(onChangeText).toHaveBeenCalledWith('루게');
    await fireEvent(getByTestId('input'), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    await rerender(<AppTextInput ref={ref} testID="input" value="" />);
    expect(getByTestId('input').props.value).toBe('');
  });
});
