import { fireEvent, render } from '@testing-library/react-native';

import { StackedHouseDemo } from '@/dev/stacked-house-demo';

describe('StackedHouseDemo', () => {
  it('switches capacity, theme and legacy mode without changing a real house', async () => {
    const ui = await render(<StackedHouseDemo />);
    expect(ui.getAllByTestId('preview-room')).toHaveLength(6);
    await fireEvent.press(ui.getByLabelText('2인'));
    expect(ui.getAllByTestId('preview-room')).toHaveLength(2);
    await fireEvent.press(ui.getByLabelText('다음 테마'));
    expect(ui.getByLabelText('산호 조개 집 집 미리보기').props.recyclingKey).toContain(
      'coral-lagoon-2p',
    );
    await fireEvent.press(ui.getByLabelText('기존/세로 전환'));
    expect(ui.getByLabelText('산호 조개 집 집 미리보기').props.recyclingKey).toBe(
      'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
    );
  });
});
