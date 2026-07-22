import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';

/** One selectable house cover (server GET /houses/cover-images). */
export type HouseCover = {
  code: string;
  name: string;
  /** CDN art key (e.g. `house/cloud-balloon/…-frame.png`). */
  coverImageKey: string;
};

export type HouseCoverPickerProps = {
  /** Cover catalog, server order. Empty = still loading (renders nothing). */
  covers: HouseCover[];
  /** Currently selected cover key; undefined = none picked yet. */
  selectedKey?: string;
  onSelect: (coverImageKey: string) => void;
};

/**
 * Cover-image grid shared by 집 생성 and 집 정보 수정: two-per-row CDN
 * thumbnails with the name underneath; the selected cell gets a primary ring.
 */
export function HouseCoverPicker({ covers, selectedKey, onSelect }: HouseCoverPickerProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  if (covers.length === 0) return null;

  return (
    <View style={styles.grid}>
      {covers.map((c) => {
        const selected = c.coverImageKey === selectedKey;
        return (
          <Pressable
            key={c.code}
            onPress={() => onSelect(c.coverImageKey)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${c.name} 커버`}
            style={[
              styles.cell,
              {
                backgroundColor: t.surfaceMuted,
                borderColor: selected ? t.primary : 'transparent',
              },
            ]}>
            <Image
              source={assetSource(c.coverImageKey)}
              style={styles.art}
              contentFit="cover"
              transition={120}
              accessibilityLabel={c.name}
              testID="cover-art"
            />
            {/* Supporting base; the label carries the selection so it reads bolder. */}
            <Text
              style={[Typography.supporting, emph('semibold'), { color: t.text }]}
              numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    width: '47%',
    flexGrow: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    padding: Spacing.one,
    alignItems: 'center',
    gap: Spacing.half,
  },
  art: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: Radius.sm,
  },
});
