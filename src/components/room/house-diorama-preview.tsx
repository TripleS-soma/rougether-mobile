import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { HouseDioramaMember } from '@/components/room/house-diorama-member';
import type { MemberRoomPreview, RoomCatalogProps } from '@/components/room/room';
import { DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import {
  HOUSE_DIORAMA_ASPECT,
  dioramaSeatPages,
  dioramaWindowRects,
  type HouseDioramaTheme,
} from '@/resources/house-diorama';

type Props = RoomCatalogProps & {
  theme: HouseDioramaTheme;
  rooms?: MemberRoomPreview[];
  memberCount?: number;
  maxMembers?: number;
  name?: string;
};
export function HouseDioramaPreview({
  theme,
  rooms,
  furniture,
  memberCount = 0,
  maxMembers,
  name,
}: Props) {
  const tr = useT();
  const Typography = useTypography();
  const count = rooms?.length ?? memberCount;
  const seats = Math.max(count, maxMembers ?? 4);
  const rows = Array.from({ length: Math.ceil(seats / 2) }, (_, row) =>
    Array.from({ length: Math.min(2, seats - row * 2) }, (_, col) => row * 2 + col),
  ).reverse();
  const page = dioramaSeatPages(rows)[0];
  return (
    <View style={styles.frame} testID="house-preview-frame">
      <Image
        source={theme.source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessible={!!name}
        accessibilityLabel={name ? tr('house.previewFrame.a11y', { name }) : ''}
      />
      {dioramaWindowRects(theme).map((rect, i) => {
        const seat = page[i];
        if (seat == null || seat >= count) return null;
        const room = rooms?.[seat];
        return (
          <View key={i} style={[styles.slot, rect]} testID="preview-room">
            <HouseDioramaMember
              preview={room}
              furniture={furniture}
              characterId={room?.characterId ?? DEFAULT_CHARACTER_ID}
            />
          </View>
        );
      })}
      {count > 4 ? (
        <Text style={[Typography.supporting, styles.more]}>
          {tr('house.diorama.more', { count: count - 4 })}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: HOUSE_DIORAMA_ASPECT },
  slot: { position: 'absolute' },
  more: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    color: StaticWhite,
    backgroundColor: Overlay.strong,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
