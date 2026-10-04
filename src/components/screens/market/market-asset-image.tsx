import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { assetSource, isCdnKey } from '@/resources/asset';

/**
 * 거래소 가구 그림 (#1427). AI 가구의 assetKey는 방의 가구와 같은 CDN 키
 * (`items/photo-furniture/furniture/...`)라 `assetSource`로 그대로 그린다 — 방 캔버스·꾸미기
 * 격자와 같은 판정(`isCdnKey`)을 써서, CDN 키가 아니면 자리표시 아이콘으로 접는다.
 */
export function MarketAssetImage({
  assetKey,
  name,
  size,
  style,
}: {
  assetKey: string | null;
  name: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const tr = useT();
  return (
    <View
      style={[styles.frame, { width: size, height: size, backgroundColor: t.surfaceMuted }, style]}>
      {isCdnKey(assetKey) ? (
        <Image
          source={assetSource(assetKey)}
          style={styles.fill}
          contentFit="contain"
          accessibilityLabel={tr('market.imageA11y', { name })}
        />
      ) : (
        <Icon name="image" size={Math.round(size / 3)} color={t.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
});
