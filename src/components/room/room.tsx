import { useState } from 'react';
import {
  Image,
  type ImageStyle,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { CharacterAvatar, POSE_COUNT } from '@/components/character-avatar';
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

/**
 * Where each furniture slot sits inside the (square) room. Symmetric layout:
 * the bottom row (bed / rug / chair) vertically mirrors the top row
 * (shelf / window / storage), and plant / table mirror each other left↔right at
 * mid-height. Furniture is 24% wide, so left: '38%' centers an item.
 */
const SLOT_STYLE: Record<FurnitureSlot, ImageStyle> = {
  // Top row
  topLeft: { top: '8%', left: '5%' },
  topCenter: { top: '8%', left: '38%' },
  topRight: { top: '8%', right: '5%' },
  // Bottom row (vertical mirror of the top row)
  bottomLeft: { bottom: '8%', left: '5%' },
  bottomCenter: { bottom: '8%', left: '38%' },
  bottomRight: { bottom: '8%', right: '5%' },
  // Mid-height sides (horizontal mirror of each other)
  midLeft: { top: '38%', left: '6%' },
  midRight: { top: '38%', right: '6%' },
};

export type RoomProps = {
  wallpaperId?: string;
  placedFurnitureIds?: string[];
  characterId?: CharacterId;
  /** When true, tapping the character cycles through its poses (나의 방). */
  interactiveCharacter?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders a room: wallpaper background, placed furniture by slot, and the
 * character (a static pose frame). When `interactiveCharacter` is set, tapping
 * the character cycles its pose — used by 나의 방; elsewhere it's static.
 * Furniture art comes from the dummy resource layer (assetSource); swap
 * RESOURCE_BASE for the real CDN later. Shared by the room cluster screens.
 */
export function Room({
  wallpaperId = DEFAULT_WALLPAPER_ID,
  placedFurnitureIds = DEFAULT_PLACED_FURNITURE_IDS,
  characterId = DEFAULT_CHARACTER_ID,
  interactiveCharacter = false,
  style,
}: RoomProps) {
  const wallpaper = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const placed = FURNITURE_ITEMS.filter((f) => placedFurnitureIds.includes(f.id));
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const [pose, setPose] = useState(0);

  return (
    <View style={[styles.room, { backgroundColor: wallpaper.color }, style]}>
      {placed.map((item) => (
        <Image
          key={item.id}
          source={assetSource(item.assetKey, item.name)}
          accessibilityLabel={item.name}
          resizeMode="contain"
          style={[styles.furniture, SLOT_STYLE[item.slot]]}
        />
      ))}
      {interactiveCharacter ? (
        <Pressable
          onPress={() => setPose((p) => (p + 1) % POSE_COUNT)}
          accessibilityRole="button"
          accessibilityLabel={`${character.name}, 눌러서 포즈 바꾸기`}
          style={styles.character}>
          <CharacterAvatar characterId={characterId} pose={pose} style={styles.characterFill} />
        </Pressable>
      ) : (
        <CharacterAvatar characterId={characterId} style={styles.character} />
      )}
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
    bottom: '16%',
    width: '42%',
    height: '42%',
  },
  characterFill: {
    width: '100%',
    height: '100%',
  },
});
