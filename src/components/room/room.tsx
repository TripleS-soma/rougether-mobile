import {
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius } from '@/constants/theme';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureSlot,
  WALLPAPERS,
} from '@/resources/furniture';
import { assetSource } from '@/resources/asset';

/** Where each furniture slot sits inside the (square) room. */
const SLOT_STYLE: Record<FurnitureSlot, ImageStyle> = {
  window: { top: '6%', left: '38%' },
  shelf: { top: '8%', left: '5%' },
  storage: { top: '8%', right: '5%' },
  plant: { bottom: '30%', left: '6%' },
  table: { bottom: '34%', right: '8%' },
  bed: { bottom: '8%', left: '4%' },
  chair: { bottom: '8%', right: '4%' },
  rug: { bottom: '6%', left: '32%' },
};

export type RoomProps = {
  wallpaperId?: string;
  placedFurnitureIds?: string[];
  characterId?: CharacterId;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders a room: wallpaper background, placed furniture by slot, and the
 * character. Furniture/character art comes from the dummy resource layer
 * (assetSource); swap RESOURCE_BASE for the real CDN later. Shared by the room
 * cluster screens (my room, decor, friend room, group house).
 */
export function Room({
  wallpaperId = DEFAULT_WALLPAPER_ID,
  placedFurnitureIds = DEFAULT_PLACED_FURNITURE_IDS,
  characterId = DEFAULT_CHARACTER_ID,
  style,
}: RoomProps) {
  const wallpaper = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const placed = FURNITURE_ITEMS.filter((f) => placedFurnitureIds.includes(f.id));

  return (
    <View style={[styles.room, { backgroundColor: wallpaper.color }, style]}>
      {placed.map((item) => (
        <Image
          key={item.id}
          source={assetSource(item.assetKey)}
          accessibilityLabel={item.name}
          resizeMode="contain"
          style={[styles.furniture, SLOT_STYLE[item.slot]]}
        />
      ))}
      <Text style={styles.character}>{character.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  furniture: {
    position: 'absolute',
    width: '24%',
    aspectRatio: 1,
  },
  character: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '20%',
    fontSize: 48,
  },
});
