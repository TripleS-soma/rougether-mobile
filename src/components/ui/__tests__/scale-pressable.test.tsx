import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScalePressable } from '@/components/ui/scale-pressable';

describe('ScalePressable', () => {
  it('Pressable 계약을 그대로 통과시킨다 — onPress·접근성 (#442)', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <ScalePressable accessibilityRole="button" accessibilityLabel="눌러보기" onPress={onPress}>
        <Text>버튼</Text>
      </ScalePressable>,
    );
    await fireEvent.press(getByLabelText('눌러보기'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled면 onPress가 오지 않는다', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="막힘"
        disabled
        onPress={onPress}>
        <Text>버튼</Text>
      </ScalePressable>,
    );
    await fireEvent.press(getByLabelText('막힘'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
