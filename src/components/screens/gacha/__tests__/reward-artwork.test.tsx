import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { DrawResult } from '@/api/types';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';
import { RewardArtwork } from '@/components/screens/gacha/reward-artwork';
import type { IconProps } from '@/components/ui/icon';
import { assetSource } from '@/resources/asset';

jest.mock('@/components/ui/icon', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Icon: ({ name }: IconProps) => <Text>{`icon:${name}`}</Text>,
  };
});

const furniture: DrawResult = {
  name: '달빛 침대',
  rarity: '전설',
  converted: false,
  assetKey: 'items/forest/furniture/moon-bed.webp',
};

const entryFor = (result: DrawResult) => buildRevealPlan([result]).items[0];

describe('RewardArtwork', () => {
  it('contains the actual furniture source at explicit dimensions without an opaque matte or transition', async () => {
    const entry = entryFor(furniture);
    const screen = await render(
      <RewardArtwork entry={entry} size={200} width={176} height={244} />,
    );
    const art = screen.getByTestId('gacha-reward-art-0');

    // Expo normalizes the public source and transition props before the native view.
    expect(art.props.source).toEqual([assetSource(furniture.assetKey)]);
    expect(art.props.contentFit).toBe('contain');
    expect(art.props.transition).toEqual({ duration: 0 });
    expect(StyleSheet.flatten(art.props.style)).toEqual({ width: 176, height: 244 });
    expect(art.props.placeholder).toEqual([]);
    expect(art.props.backgroundColor).toBeFalsy();
    expect(screen.getByLabelText('달빛 침대')).toBeTruthy();
    expect(screen.queryByTestId('gacha-reward-fallback-0')).toBeNull();
  });

  it.each([undefined, 128])(
    'uses the requested size or the default square when dimensions are omitted (%s)',
    async (size) => {
      const screen = await render(<RewardArtwork entry={entryFor(furniture)} size={size} />);

      expect(screen.getByTestId('gacha-reward-art-0')).toHaveStyle({
        width: size ?? 200,
        height: size ?? 200,
      });
    },
  );

  it('waits for display and then calls the latest onReady callback', async () => {
    const entry = entryFor(furniture);
    const initialReady = jest.fn();
    const latestReady = jest.fn();
    const screen = await render(<RewardArtwork entry={entry} onReady={initialReady} />);

    expect(initialReady).not.toHaveBeenCalled();
    await screen.rerender(<RewardArtwork entry={entry} onReady={latestReady} />);
    expect(latestReady).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'display');

    expect(initialReady).not.toHaveBeenCalled();
    expect(latestReady).toHaveBeenCalledTimes(1);
  });

  it('replaces a failed image with a ready gift fallback at the same dimensions', async () => {
    const onReady = jest.fn();
    const screen = await render(
      <RewardArtwork entry={entryFor(furniture)} width={176} height={244} onReady={onReady} />,
    );

    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'error', {
      nativeEvent: { error: 'Decode failed' },
    });

    expect(screen.queryByTestId('gacha-reward-art-0')).toBeNull();
    expect(screen.getByTestId('gacha-reward-fallback-0')).toHaveStyle({ width: 176, height: 244 });
    expect(screen.getByLabelText('달빛 침대')).toBeTruthy();
    expect(screen.getByText('icon:gift')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('tries a new asset after the previous source failed and waits for its display', async () => {
    const onReady = jest.fn();
    const screen = await render(<RewardArtwork entry={entryFor(furniture)} onReady={onReady} />);
    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'error', {
      nativeEvent: { error: 'Decode failed' },
    });
    expect(onReady).toHaveBeenCalledTimes(1);

    const next = entryFor({
      ...furniture,
      name: '숲속 책장',
      assetKey: 'items/forest/furniture/bookshelf.webp',
    });
    await screen.rerender(<RewardArtwork entry={next} onReady={onReady} />);

    expect(screen.queryByTestId('gacha-reward-fallback-0')).toBeNull();
    expect(screen.getByLabelText('숲속 책장')).toBeTruthy();
    expect(screen.getByTestId('gacha-reward-art-0').props.source).toEqual([
      assetSource(next.assetKey),
    ]);
    expect(onReady).toHaveBeenCalledTimes(1);

    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'display');
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it('forceFallback avoids loading a valid source but allows it again when cleared', async () => {
    const entry = entryFor(furniture);
    const onReady = jest.fn();
    const screen = await render(<RewardArtwork entry={entry} forceFallback onReady={onReady} />);

    expect(screen.queryByTestId('gacha-reward-art-0')).toBeNull();
    expect(screen.getByText('icon:gift')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);

    await screen.rerender(<RewardArtwork entry={entry} onReady={onReady} />);
    expect(screen.queryByTestId('gacha-reward-fallback-0')).toBeNull();
    expect(screen.getByTestId('gacha-reward-art-0').props.source).toEqual([
      assetSource(entry.assetKey),
    ]);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('shows a ready gift fallback when there is no usable asset', async () => {
    const onReady = jest.fn();
    const entry = entryFor({ ...furniture, assetKey: 'furniture/bed' });
    const screen = await render(<RewardArtwork entry={entry} onReady={onReady} />);

    expect(screen.queryByTestId('gacha-reward-art-0')).toBeNull();
    expect(screen.getByLabelText('달빛 침대')).toBeTruthy();
    expect(screen.getByText('icon:gift')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('displays a character source and its accessible name without requiring furniture metadata', async () => {
    const entry = entryFor({
      name: '고양이',
      rewardType: 'CHARACTER',
      converted: false,
      assetKey: 'characters/cat/idle.webp',
    });
    const onReady = jest.fn();
    const screen = await render(<RewardArtwork entry={entry} onReady={onReady} />);

    expect(screen.getByLabelText('고양이')).toBeTruthy();
    expect(screen.getByTestId('gacha-reward-art-0').props.source).toEqual([
      assetSource(entry.assetKey),
    ]);
    expect(screen.queryByTestId('gacha-reward-fallback-0')).toBeNull();
    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'display');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['COIN', 'coin', 100],
    ['DIAMOND', 'diamond', 3],
  ] as const)(
    'uses the %s refund icon instead of the original item art',
    async (currency, icon, amount) => {
      const onReady = jest.fn();
      const entry = entryFor({
        ...furniture,
        converted: true,
        refundCurrencyType: currency,
        refundAmount: amount,
      });
      const screen = await render(<RewardArtwork entry={entry} onReady={onReady} />);

      expect(screen.queryByTestId('gacha-reward-art-0')).toBeNull();
      expect(screen.getByText(`icon:${icon}`)).toBeTruthy();
      expect(screen.queryByText('icon:gift')).toBeNull();
      expect(screen.getByLabelText('달빛 침대')).toBeTruthy();
      expect(onReady).toHaveBeenCalledTimes(1);
    },
  );
});
