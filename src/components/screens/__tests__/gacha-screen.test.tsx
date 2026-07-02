import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';

const machine: GachaMachine = {
  id: 1,
  name: '작은 베이커리 아침 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 250,
  drawCount: 1,
  icon: '🥐',
  accent: '#F7E6C8',
};

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen coinBalance={5600} />);
    expect(getByText('가챠')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('draws from the API and reveals the reward', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => [
      { name: '허브 화분', rarity: '희귀', converted: false },
    ]);
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    await fireEvent.press(getByText('뽑기'));

    expect(onDraw).toHaveBeenCalledWith(1);
    await waitFor(() => expect(getByText('허브 화분')).toBeTruthy());
  });

  it('does not draw when the balance is below the cost', async () => {
    const onDraw = jest.fn();
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={100} onDraw={onDraw} />,
    );

    // The pull button is disabled below cost, so the press is a no-op.
    await fireEvent.press(getByText('뽑기'));
    expect(onDraw).not.toHaveBeenCalled();
  });
});
