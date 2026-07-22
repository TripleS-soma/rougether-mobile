import { Image } from 'expo-image';
import { useFontEmphasis } from '@/hooks/use-tokens';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { assetSource, isCdnKey } from '@/resources/asset';
import { type FurnitureCategory, type FurnitureItem } from '@/resources/furniture';

/** Pastel background per catalog category, so slots read as distinct tiles. */
const CATEGORY_BG: Record<FurnitureCategory, string> = {
  가구: '#EADFD0',
  장식: '#DCE7DA',
  러그: '#E8DCE4',
  한옥: '#EEE2CC',
};

export type FurniturePlaceholderProps = {
  item: FurnitureItem;
  /** Show the Korean name inside the tile (off when a caption sits below it). */
  showName?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Furniture tile: renders the real CDN art when the item's assetKey points at
 * the asset bucket (API items), otherwise falls back to the in-app placeholder
 * (colored box + Korean name) for legacy local-catalog items without art.
 */
export function FurniturePlaceholder({ item, showName = true, style }: FurniturePlaceholderProps) {
  const emph = useFontEmphasis();
  if (isCdnKey(item.assetKey)) {
    return (
      <View accessibilityLabel={item.name} style={[styles.tile, style]}>
        <Image
          source={assetSource(item.assetKey)}
          style={styles.art}
          contentFit="contain"
          transition={120}
        />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={item.name}
      style={[styles.tile, { backgroundColor: CATEGORY_BG[item.category] }, style]}>
      {showName ? (
        <Text style={[styles.name, emph('semibold')]} numberOfLines={2}>
          {item.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: ROOM_RENDER_CONTRACT.furniture.borderRadiusPx,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ROOM_RENDER_CONTRACT.furniture.imagePaddingPx,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    color: '#5A4F45',
  },
});
