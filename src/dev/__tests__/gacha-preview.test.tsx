import { fireEvent, render } from '@testing-library/react-native';

import { GachaPreview, previewRewards } from '@/dev/gacha-preview';

it('previews the selected rarity without a real draw handler', async () => {
  const screen = await render(<GachaPreview machines={[]} />);
  await fireEvent.press(screen.getByLabelText('희귀 연출'));
  expect(screen.getByLabelText('희귀 연출').props.accessibilityState.selected).toBe(true);
  expect(previewRewards(1, '희귀', false)[0].rarity).toBe('희귀');
});

it('covers six rewards, duplicates, and character coin refunds in local fixtures', () => {
  expect(previewRewards(6, '전설', false)).toHaveLength(6);
  expect(previewRewards(6, '전설', true)[3]).toMatchObject({
    converted: true,
    refundCurrencyType: 'COIN',
    refundAmount: 100,
  });
});
