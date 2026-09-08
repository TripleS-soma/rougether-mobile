import { render } from '@testing-library/react-native';

import { RevealCard } from '@/components/screens/gacha/draw-animation';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';

jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticSelection: jest.fn() }));

// FlipCard(#431)는 시네마틱 연출(#1124)로 대체돼 삭제됐다 — 남은 건 RevealCard의 환급 라벨.
describe('RevealCard', () => {
  it.each([
    ['COIN', 100, '중복 · 코인 +100'],
    ['DIAMOND', 3, '중복 · 다이아 +3'],
  ] as const)(
    'shows actual %s refunds and does not invent character rarity',
    async (currency, amount, label) => {
      const entry = buildRevealPlan([
        {
          name: '고양이',
          rewardType: 'CHARACTER',
          converted: true,
          refundCurrencyType: currency,
          refundAmount: amount,
        },
      ]).items[0];
      const screen = await render(<RevealCard entry={entry} reducedMotion />);
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryByText('일반')).toBeNull();
      expect(screen.queryByText('새 선물!')).toBeNull();
    },
  );
});
