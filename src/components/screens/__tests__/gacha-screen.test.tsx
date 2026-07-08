import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { ToastProvider } from '@/components/ui/toast';

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

    await fireEvent.press(getByText('1회 뽑기'));

    expect(onDraw).toHaveBeenCalledWith(1, 1);
    await waitFor(() => expect(getByText('허브 화분')).toBeTruthy());
  });

  it('draws ten at once with the 10연 button', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => []);
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    // 10-pull costs costAmount × 10 (2,500) — affordable with 5,600.
    expect(getByText('2,500')).toBeTruthy();
    await fireEvent.press(getByText('10연 뽑기'));
    expect(onDraw).toHaveBeenCalledWith(1, 10);
  });

  it('explains an unaffordable pull with a toast instead of drawing', async () => {
    const onDraw = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <GachaScreen gachas={[machine]} coinBalance={100} onDraw={onDraw} />
      </ToastProvider>,
    );

    // The blocked button stays tappable — the tap says why nothing happens.
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText('잔액이 부족해요')).toBeTruthy();
    expect(onDraw).not.toHaveBeenCalled();
  });
});
