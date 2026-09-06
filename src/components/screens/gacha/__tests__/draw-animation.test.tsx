import { act, fireEvent, render } from '@testing-library/react-native';

import {
  AUTO_REVEAL_MS,
  FlipCard,
  REVEAL_STAGGER_MS,
  RevealCard,
} from '@/components/screens/gacha/draw-animation';
import { GiftOpeningStage } from '@/components/screens/gacha/storybook-draw';
import { hapticImpact, hapticSelection } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({ hapticImpact: jest.fn(), hapticSelection: jest.fn() }));

const reward = { name: '달빛 침대', rarity: '전설', converted: false };

describe('Gacha reward animation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('a tap reveals once; the auto timer cannot replay the haptic or callback', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard item={reward} index={0} onReveal={onReveal} />);
    expect(screen.queryByText('달빛 침대')).toBeNull();
    await fireEvent.press(screen.getByLabelText('1번째 카드 뒤집기'));
    expect(screen.getByText('달빛 침대')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledWith(0);
    expect(hapticImpact).toHaveBeenCalledTimes(1);
  });

  it('auto-reveals later cards in sequence', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard item={reward} index={2} onReveal={onReveal} />);
    await act(() => jest.advanceTimersByTime(AUTO_REVEAL_MS + 2 * REVEAL_STAGGER_MS - 1));
    expect(screen.getByLabelText('3번째 카드 뒤집기')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1));
    expect(screen.getByLabelText('달빛 침대')).toBeTruthy();
    expect(onReveal).toHaveBeenCalledWith(2);
  });

  it('revealAll opens immediately without a pile-up of card haptics', async () => {
    const onReveal = jest.fn();
    const screen = await render(<FlipCard item={reward} index={5} onReveal={onReveal} />);
    await screen.rerender(<FlipCard item={reward} index={5} revealAll onReveal={onReveal} />);
    expect(screen.getByText('달빛 침대')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(hapticImpact).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

  it('reduced motion reveals without timers or card haptics', async () => {
    const onReveal = jest.fn();
    const screen = await render(
      <FlipCard item={reward} index={5} reducedMotion onReveal={onReveal} />,
    );
    expect(screen.getByText('달빛 침대')).toBeTruthy();
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(hapticImpact).not.toHaveBeenCalled();
  });

  it('unmount cancels scheduled reveals and charge beats', async () => {
    const onReveal = jest.fn();
    const screen = await render(
      <>
        <GiftOpeningStage phase="opening" />
        <FlipCard item={reward} index={0} onReveal={onReveal} />
      </>,
    );
    await screen.unmount();
    await act(() => jest.advanceTimersByTime(5000));
    expect(onReveal).not.toHaveBeenCalled();
    expect(hapticSelection).not.toHaveBeenCalled();
  });

  it('shows the actual refund currency and does not invent a character rarity', async () => {
    const screen = await render(
      <RevealCard
        index={0}
        reducedMotion
        item={{ name: '고양이', converted: true, refundCurrencyType: 'COIN', refundAmount: 100 }}
      />,
    );
    expect(screen.getByText('중복 · 코인 +100')).toBeTruthy();
    expect(screen.queryByText('일반')).toBeNull();
    expect(screen.queryByText('새 선물!')).toBeNull();
  });
});
