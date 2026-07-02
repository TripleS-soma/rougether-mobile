import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
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
 * In-app placeholder for a furniture item, drawn natively (colored box + Korean
 * name) instead of a remote placeholder image — the previous placehold.co image
 * couldn't render Korean text (showed "???"). Swap this for a real <Image> once
 * the furniture art/CDN exists.
 */
export function FurniturePlaceholder({ item, showName = true, style }: FurniturePlaceholderProps) {
  return (
    <View
      accessibilityLabel={item.name}
      style={[styles.tile, { backgroundColor: CATEGORY_BG[item.category] }, style]}>
      {showName ? (
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  name: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: '#5A4F45',
  },
});
