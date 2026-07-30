import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { GachaRewardPreview } from '@/api';
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
  icon: 'croissant' as const,
  accent: '#F7E6C8',
  kind: 'item',
};

const characterMachine: GachaMachine = {
  id: 12,
  name: '캐릭터 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 1000,
  drawCount: 1,
  icon: 'paw' as const,
  accent: '#D6E4D2',
  kind: 'character',
};

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen coinBalance={5600} />);
    expect(getByText('뽑기')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('splits the selector into item and character rows', async () => {
    const both = await render(
      <GachaScreen gachas={[machine, characterMachine]} coinBalance={5600} />,
    );
    expect(both.getByText('꾸미기 뽑기')).toBeTruthy();
    expect(both.getByText('캐릭터 뽑기')).toBeTruthy();

    // Without a character machine the character row disappears entirely.
    const onlyFurniture = await render(<GachaScreen gachas={[machine]} coinBalance={5600} />);
    expect(onlyFurniture.queryByText('캐릭터 뽑기')).toBeNull();
  });

  it('shows the selected machine rewards without probabilities', async () => {
    const sunglasses: GachaRewardPreview = {
      rewardType: 'ITEM',
      itemId: 100,
      name: '분홍 하트 선글라스',
      assetKey: 'items/character-accessories/eyewear/cat-pink-heart-sunglasses/thumbnail.png',
      rarity: '희귀',
      owned: true,
      categoryCode: 'character_accessory',
      placementType: 'character',
      characterSlotType: 'eyewear',
    };
    const cat: GachaRewardPreview = {
      rewardType: 'CHARACTER',
      characterId: 5,
      name: '고양이',
      assetKey: 'characters/cat/thumbnail.png',
      owned: false,
    };
    const screen = await render(
      <GachaScreen
        gachas={[machine, characterMachine]}
        rewardsByGachaId={{ 1: [sunglasses], 12: [cat] }}
        coinBalance={5600}
      />,
    );

    expect(screen.getByText('뽑을 수 있는 보상')).toBeTruthy();
    expect(screen.getByText('분홍 하트 선글라스')).toBeTruthy();
    expect(screen.getByText('눈 장식')).toBeTruthy();
    expect(screen.getByText('보유중')).toBeTruthy();
    expect(screen.queryByText(/확률/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('캐릭터 뽑기'));
    expect(screen.getByText('고양이')).toBeTruthy();
    expect(screen.queryByText('분홍 하트 선글라스')).toBeNull();
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

  it('draws six for the price of five with the 5+1 button', async () => {
    const onDraw = jest.fn(async (): Promise<DrawResult[]> => []);
    const { getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );

    // 5+1 costs costAmount × 5 (1,250) and requests six results.
    expect(getByText('1,250')).toBeTruthy();
    await fireEvent.press(getByText('5+1회 뽑기'));
    expect(onDraw).toHaveBeenCalledWith(1, 6);
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
