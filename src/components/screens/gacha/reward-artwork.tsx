import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { RevealPlanItem } from '@/components/screens/gacha/reveal-motion';
import { Icon } from '@/components/ui/icon';
import { useLatestRef } from '@/hooks/use-stable-value';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';

export const DEFAULT_RARITY: Rarity = '일반';
export const rarityColor = (rarity?: string) =>
  RARITY_COLORS[(rarity as Rarity) ?? DEFAULT_RARITY] ?? RARITY_COLORS[DEFAULT_RARITY];

/** Preserve the source alpha: no card, matte, opaque placeholder, or image transition. */
export function RewardArtwork({
  entry,
  size = 200,
  width = size,
  height = size,
  onReady,
  forceFallback = false,
}: {
  entry: RevealPlanItem;
  size?: number;
  width?: number;
  height?: number;
  onReady?: () => void;
  forceFallback?: boolean;
}) {
  const t = useTokens();
  const [failedKey, setFailedKey] = useState<string>();
  const ready = useLatestRef(onReady);
  const hasAsset =
    !forceFallback &&
    entry.renderKind === 'asset' &&
    !!entry.assetKey &&
    failedKey !== entry.assetKey;

  useEffect(() => {
    if (!hasAsset) ready.current?.();
  }, [hasAsset, ready]);

  if (hasAsset) {
    return (
      <Image
        source={assetSource(entry.assetKey)}
        style={{ width, height }}
        contentFit="contain"
        transition={0}
        onDisplay={() => ready.current?.()}
        onError={() => setFailedKey(entry.assetKey)}
        accessibilityLabel={entry.displayName}
        testID={`gacha-reward-art-${entry.index}`}
      />
    );
  }

  const currency = entry.result.refundCurrencyType === 'COIN' ? 'coin' : 'diamond';
  return (
    <View
      style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={entry.displayName}
      testID={`gacha-reward-fallback-${entry.index}`}>
      <Icon
        name={entry.renderKind === 'currency' ? currency : 'gift'}
        size={Math.round(Math.min(width, height) * 0.55)}
        color={entry.renderKind === 'currency' ? t.warning : rarityColor(entry.result.rarity)}
      />
    </View>
  );
}
