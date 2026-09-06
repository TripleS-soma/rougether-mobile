import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HouseCoverArt } from '@/components/room/house-cover-art';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { FRAME_ASPECT, type HouseFrameOptions } from '@/resources/house-frame';

/** One selectable house cover (server GET /houses/cover-images). */
export type HouseCover = {
  code: string;
  name: string;
  /** CDN art key (e.g. `house/cloud-balloon/…-frame.png`). */
  coverImageKey: string;
};

export type HouseCoverPickerProps = Pick<HouseFrameOptions, 'maxMembers' | 'enabled'> & {
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
export function HouseCoverPicker({
  covers,
  selectedKey,
  onSelect,
  maxMembers,
  enabled,
}: HouseCoverPickerProps) {
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
            {/* 프레임 전체가 보이게 contain — cover는 위(지붕)·아래(받침)를
                잘라 프레임이 잘린 것처럼 보였다 (#723). 셀 비율도 프레임
                원본(FRAME_ASPECT)에 맞춰 레터박스를 최소화. */}
            <HouseCoverArt
              coverImageKey={c.coverImageKey}
              maxMembers={maxMembers}
              enabled={enabled}
              style={styles.art}
              name={c.name}
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
    aspectRatio: FRAME_ASPECT,
    borderRadius: Radius.sm,
  },
});
