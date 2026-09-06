import { act, fireEvent, render } from '@testing-library/react-native';
import { StrictMode } from 'react';
import type { TestInstance } from 'test-renderer';

import type { DrawResult } from '@/api/types';
import {
  AUTO_REVEAL_MS,
  FlipCard,
  REVEAL_STAGGER_MS,
  RevealCard,
} from '@/components/screens/gacha/draw-animation';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';
import { hapticImpact, hapticSelection } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticSelection: jest.fn() }));

const reward: DrawResult = {
  name: '달빛 침대',
  rarity: '전설',
  converted: false,
  assetKey: 'items/forest/furniture/moon-bed.webp',
};
const entries = buildRevealPlan(Array.from({ length: 6 }, () => reward)).items;

// Capture the actual Pressable callback to test collisions before a React commit.
function pressHandler(element: TestInstance): () => void {
  let fiber: TestInstance['unstable_fiber'] | null = element.unstable_fiber;
  while (fiber) {
    const handler = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler;
    fiber = fiber.return;
  }
  throw new Error('Expected a press handler on the selected card');
}

describe('Gacha reward animation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides the reward from accessibility until a tap reveals it once', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard entry={entries[0]} onReveal={onReveal} />);
    expect(screen.queryByText('달빛 침대')).toBeNull();
    expect(screen.queryByLabelText('달빛 침대')).toBeNull();
    expect(screen.queryByTestId('gacha-flip-front-0')).toBeNull();
    expect(screen.getByTestId('gacha-flip-back-0')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '1번째 카드 뒤집기' }));

    expect(screen.getByText('달빛 침대')).toBeTruthy();
    expect(screen.getByRole('button', { name: '달빛 침대' })).toBeTruthy();
    expect(screen.queryByTestId('gacha-flip-back-0')).toBeNull();
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith(0);
    expect(hapticImpact).toHaveBeenCalledTimes(1);
  });

  it('guards two presses from the same render before React commits state', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard entry={entries[0]} onReveal={onReveal} />);
    const press = pressHandler(screen.getByRole('button', { name: '1번째 카드 뒤집기' }));

    await act(() => {
      press();
      press();
    });
    await screen.rerender(<FlipCard entry={entries[0]} revealAll onReveal={onReveal} />);
    await act(() => jest.advanceTimersByTime(5000));

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(hapticImpact).toHaveBeenCalledTimes(1);
  });

  it('auto-reveals later cards in sequence with the existing pacing', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard entry={entries[2]} onReveal={onReveal} />);
    expect(AUTO_REVEAL_MS).toBe(800);
    expect(REVEAL_STAGGER_MS).toBe(180);
    await act(() => jest.advanceTimersByTime(AUTO_REVEAL_MS + 2 * REVEAL_STAGGER_MS - 1));
    expect(screen.getByRole('button', { name: '3번째 카드 뒤집기' })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: '달빛 침대' })).toBeTruthy();
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith(2);
    expect(hapticImpact).not.toHaveBeenCalled();
  });

  it('uses the latest callback without restarting the scheduled reveal', async () => {
    const original = jest.fn();
    const latest = jest.fn();
    const screen = await render(<FlipCard entry={entries[0]} onReveal={original} />);
    await act(() => jest.advanceTimersByTime(AUTO_REVEAL_MS - 1));
    await screen.rerender(<FlipCard entry={entries[0]} onReveal={latest} />);
    await act(() => jest.advanceTimersByTime(1));
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith(0);
  });

  it('revealAll opens six cards without a pile-up of card haptics', async () => {
    const onReveal = jest.fn();
    const cards = (revealAll: boolean) => (
      <>
        {entries.map((entry) => (
          <FlipCard key={entry.index} entry={entry} revealAll={revealAll} onReveal={onReveal} />
        ))}
      </>
    );
    const screen = await render(cards(false));
    await screen.rerender(cards(true));
    expect(screen.getAllByText('달빛 침대')).toHaveLength(6);
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal.mock.calls).toEqual([[0], [1], [2], [3], [4], [5]]);
    expect(hapticImpact).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

  it('reduced motion reveals once even when revealAll and StrictMode are enabled', async () => {
    const onReveal = jest.fn();
    const screen = await render(
      <StrictMode>
        <FlipCard entry={entries[5]} reducedMotion revealAll onReveal={onReveal} />
      </StrictMode>,
    );
    expect(screen.getByText('달빛 침대')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith(5);
    expect(hapticImpact).not.toHaveBeenCalled();
  });

  it('switching reduced motion on reveals immediately without replay on later toggles', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard entry={entries[5]} onReveal={onReveal} />);
    await act(() => jest.advanceTimersByTime(100));
    await screen.rerender(<FlipCard entry={entries[5]} reducedMotion onReveal={onReveal} />);
    expect(screen.getByText('달빛 침대')).toBeTruthy();
    await screen.rerender(<FlipCard entry={entries[5]} onReveal={onReveal} />);
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(hapticImpact).not.toHaveBeenCalled();
  });

  it('unmount cancels the scheduled reveal and ignores a stale press handler', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard entry={entries[0]} onReveal={onReveal} />);
    const press = pressHandler(screen.getByRole('button', { name: '1번째 카드 뒤집기' }));
    await screen.unmount();
    await act(() => {
      press();
      jest.advanceTimersByTime(5000);
    });
    expect(onReveal).not.toHaveBeenCalled();
    expect(hapticImpact).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

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
