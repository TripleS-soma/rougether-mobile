import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { CharacterAvatar, POSE_COUNT } from '@/components/character-avatar';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type FurnitureSlot,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';

/**
 * Where each furniture slot sits inside the (square) room. Symmetric layout:
 * the bottom row (bed / rug / chair) vertically mirrors the top row
 * (shelf / window / storage), and plant / table mirror each other left↔right at
 * mid-height. Default furniture is 28% wide, so left: '36%' centers an item;
 * the bottom corners stay 24% so they don't crowd the character.
 */
const SLOT_STYLE: Record<FurnitureSlot, ViewStyle> = {
  // Top row
  topLeft: { top: '8%', left: '5%' },
  topCenter: { top: '8%', left: '36%' },
  topRight: { top: '8%', right: '5%' },
  // Bottom row (vertical mirror of the top row)
  bottomLeft: { bottom: '8%', left: '5%', width: '24%' },
  bottomCenter: { bottom: '8%', left: '36%' },
  bottomRight: { bottom: '8%', right: '5%', width: '24%' },
  // Mid-height sides (horizontal mirror of each other)
  midLeft: { top: '38%', left: '6%' },
  midRight: { top: '38%', right: '6%' },
};

export type RoomProps = {
  wallpaperId?: string;
  /** Selected floor/background surface item ids (optional room layers). */
  floorId?: string | null;
  backgroundId?: string | null;
  placedFurnitureIds?: string[];
  characterId?: CharacterId;
  /** Item + wallpaper catalogue to resolve ids against (defaults to the local set). */
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /** When true, tapping the character cycles through its poses (나의 방). */
  interactiveCharacter?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * character. Furniture uses in-app placeholders (FurniturePlaceholder) until
 * real art exists. The character is a static pose frame; when
 * `interactiveCharacter` is set, tapping it cycles the pose (나의 방), otherwise
 * static. Shared by the room cluster screens (my room, decor, friend room).
 */
export function Room({
  wallpaperId = DEFAULT_WALLPAPER_ID,
  floorId,
  backgroundId,
  placedFurnitureIds = DEFAULT_PLACED_FURNITURE_IDS,
  characterId = DEFAULT_CHARACTER_ID,
  furniture = FURNITURE_ITEMS,
  wallpapers = WALLPAPERS,
  floors = [],
  backgrounds = [],
  interactiveCharacter = false,
  style,
}: RoomProps) {
  const wallpaper = wallpapers.find((w) => w.id === wallpaperId) ?? wallpapers[0];
  const floor = floorId ? floors.find((f) => f.id === floorId) : undefined;
  const background = backgroundId ? backgrounds.find((b) => b.id === backgroundId) : undefined;
  const placed = furniture.filter((f) => placedFurnitureIds.includes(f.id));
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const [pose, setPose] = useState(0);

  return (
    <View style={[styles.room, { backgroundColor: wallpaper?.color ?? '#F3E9D6' }, style]}>
      {background ? (
        isCdnKey(background.assetKey) ? (
          <Image
            source={assetSource(background.assetKey)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            accessibilityLabel={background.name}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: background.color }]} />
        )
      ) : null}
      {/* Wallpaper art renders as the wall band on top of the background —
          the room backgroundColor alone is invisible once a background covers
          it, which made applied wallpapers look like a no-op. (CDN wallpaper
          art is wall-band shaped, ~1205x585.) */}
      {wallpaper && isCdnKey(wallpaper.assetKey) ? (
        <Image
          source={assetSource(wallpaper.assetKey)}
          style={styles.wall}
          contentFit="cover"
          transition={120}
          accessibilityLabel={wallpaper.name}
        />
      ) : background && wallpaper ? (
        <View style={[styles.wall, { backgroundColor: wallpaper.color }]} />
      ) : null}
      {floor ? (
        isCdnKey(floor.assetKey) ? (
          <Image
            source={assetSource(floor.assetKey)}
            style={styles.floor}
            contentFit="cover"
            transition={120}
            accessibilityLabel={floor.name}
          />
        ) : (
          <View style={[styles.floor, { backgroundColor: floor.color }]} />
        )
      ) : null}
      {placed.map((item) => (
        <View key={item.id} style={[styles.furniture, SLOT_STYLE[item.slot]]}>
          <FurniturePlaceholder item={item} />
        </View>
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
  // Wall band: CDN wallpaper art is ~1205x585 (width:height ≈ 2:1), so it
  // covers the top half of the square room above the floor band.
  wall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  // Floor band meets the wall band exactly at the midline — no bare strip.
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  // Slot styles may override the width (bottom corners stay 24%).
  furniture: {
    position: 'absolute',
    width: '28%',
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
