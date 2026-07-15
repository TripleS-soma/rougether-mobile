import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { CharacterAvatar, type CharacterAnimationSet } from '@/components/character-avatar';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import { useTokens } from '@/hooks/use-tokens';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type FurnitureSlot,
  SLOT_LABELS,
  SLOT_ORDER,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';

/** Region a decor-mode tap can target: a furniture slot or a surface band. */
export type RoomRegion = FurnitureSlot | 'wall' | 'floor';

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
  /** Server CDN animation keys for the occupant; local sprite fallback when absent. */
  characterAnimations?: CharacterAnimationSet;
  /** Item + wallpaper catalogue to resolve ids against (defaults to the local set). */
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /** When true, tapping the character cycles through its poses (나의 방). */
  interactiveCharacter?: boolean;
  /**
   * Decor-edit mode (#243): slots and surface bands become tappable and empty
   * slots show a dashed + marker, so the room itself is the catalog's entry
   * point instead of positional filter chips.
   */
  editable?: boolean;
  onRegionPress?: (region: RoomRegion) => void;
  /** Region whose picker is open — ring-highlighted. */
  activeRegion?: RoomRegion | null;
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
  characterAnimations,
  furniture = FURNITURE_ITEMS,
  wallpapers = WALLPAPERS,
  floors = [],
  backgrounds = [],
  interactiveCharacter = false,
  editable = false,
  onRegionPress,
  activeRegion = null,
  style,
}: RoomProps) {
  const t = useTokens();
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
      {/* Surface touch bands sit under the furniture so item taps win. */}
      {editable ? (
        <>
          <Pressable
            onPress={() => onRegionPress?.('wall')}
            accessibilityRole="button"
            accessibilityLabel="벽 꾸미기"
            style={[
              styles.wall,
              activeRegion === 'wall' && { borderWidth: 2.5, borderColor: t.primary },
            ]}
          />
          <Pressable
            onPress={() => onRegionPress?.('floor')}
            accessibilityRole="button"
            accessibilityLabel="바닥 꾸미기"
            style={[
              styles.floor,
              activeRegion === 'floor' && { borderWidth: 2.5, borderColor: t.primary },
            ]}
          />
        </>
      ) : null}
      {placed.map((item) =>
        editable ? (
          <Pressable
            key={item.id}
            onPress={() => onRegionPress?.(item.slot)}
            accessibilityRole="button"
            accessibilityLabel={`${SLOT_LABELS[item.slot]} 자리 — ${item.name}`}
            style={[
              styles.furniture,
              SLOT_STYLE[item.slot],
              activeRegion === item.slot && [styles.activeSlot, { borderColor: t.primary }],
            ]}>
            <FurniturePlaceholder item={item} />
          </Pressable>
        ) : (
          <View key={item.id} style={[styles.furniture, SLOT_STYLE[item.slot]]}>
            <FurniturePlaceholder item={item} />
          </View>
        ),
      )}
      {/* Empty slots invite a tap with a dashed + marker. */}
      {editable
        ? SLOT_ORDER.filter((slot) => !placed.some((i) => i.slot === slot)).map((slot) => (
            <Pressable
              key={slot}
              onPress={() => onRegionPress?.(slot)}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_LABELS[slot]} 자리 비어 있음`}
              style={[
                styles.furniture,
                SLOT_STYLE[slot],
                styles.emptySlot,
                activeRegion === slot && { borderColor: t.primary, borderStyle: 'solid' },
              ]}>
              <View style={styles.emptyPlus}>
                <View style={[styles.plusH, { backgroundColor: 'rgba(80,66,55,0.55)' }]} />
                <View style={[styles.plusV, { backgroundColor: 'rgba(80,66,55,0.55)' }]} />
              </View>
            </Pressable>
          ))
        : null}
      {interactiveCharacter ? (
        <Pressable
          // The avatar wraps the pose over however many frames it has (4 local
          // sprites vs. the server's CDN animation set) — just keep counting.
          onPress={() => setPose((p) => p + 1)}
          accessibilityRole="button"
          accessibilityLabel={`${character.name}, 눌러서 포즈 바꾸기`}
          style={styles.character}>
          <CharacterAvatar
            characterId={characterId}
            animations={characterAnimations}
            pose={pose}
            style={styles.characterFill}
          />
        </Pressable>
      ) : (
        <CharacterAvatar
          characterId={characterId}
          animations={characterAnimations}
          style={styles.character}
        />
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
  activeSlot: {
    borderWidth: 2.5,
    borderRadius: Radius.md,
  },
  emptySlot: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(80,66,55,0.35)',
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlus: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  plusV: {
    position: 'absolute',
    width: 3,
    height: 18,
    borderRadius: 2,
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
