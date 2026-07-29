import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { type CharacterAnimationSet, CharacterAvatar } from '@/components/character-avatar';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { ROOM_RENDER_CONTRACT, roomPercent } from '@/components/room/room-render-contract';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type FurnitureSlot,
  type PlacedFurniture,
  SLOT_LABELS,
  SLOT_ORDER,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';

/** 자유 배치 아이템의 기본 폭 — 방 폭 대비 비율 (슬롯 기본 28%와 동일). */
export const FREE_ITEM_WIDTH = ROOM_RENDER_CONTRACT.furniture.baseWidth;

/** Region a decor-mode tap can target: a furniture slot or a surface band. */
export type RoomRegion = FurnitureSlot | 'wall' | 'floor';

/**
 * Where each furniture slot sits inside the (square) room. Symmetric layout:
 * the bottom row (bed / rug / chair) vertically mirrors the top row
 * (shelf / window / storage), and plant / table mirror each other left↔right at
 * mid-height. Default furniture is 28% wide, so left: '36%' centers an item;
 * the bottom corners stay 24% so they don't crowd the character.
 */
const SLOT_STYLE = Object.fromEntries(
  SLOT_ORDER.map((slot) => {
    const rect = ROOM_RENDER_CONTRACT.furniture.slots[slot];
    return [
      slot,
      {
        top: roomPercent(rect.top),
        left: roomPercent(rect.left),
        width: roomPercent(rect.width),
      },
    ];
  }),
) as Record<FurnitureSlot, ViewStyle>;

export type RoomProps = {
  wallpaperId?: string;
  /** Selected floor/background surface item ids (optional room layers). */
  floorId?: string | null;
  backgroundId?: string | null;
  placedFurnitureIds?: string[];
  /** `null` renders an unoccupied room — no character (빈방 타일, #281). */
  characterId?: CharacterId | null;
  /** Server CDN animation keys for the occupant; local sprite fallback when absent. */
  characterAnimations?: CharacterAnimationSet;
  /** Item + wallpaper catalogue to resolve ids against (defaults to the local set). */
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /**
   * 자유 배치(FREE_V1, #327) — 주어지면 슬롯 배치 대신 정규화 좌표(중심점)로
   * 렌더한다. z 오름차순으로 쌓이고, 터치는 받지 않는다(편집은 꾸미기 화면의
   * 오버레이가 담당). 빈 배열 = 가구 없는 방.
   */
  placements?: PlacedFurniture[] | null;
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
  /**
   * 부모 크기를 그대로 채운다 — 정사각형(aspectRatio 1) 강제 해제. 프레임
   * 창문처럼 정사각형이 아닌 칸에 쓴다. 네이티브 Yoga는 width/height보다
   * aspectRatio를 우선해 정사각형이 칸을 벗어난다.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * character. Furniture uses in-app placeholders (FurniturePlaceholder) until
 * real art exists. The character is a static pose frame; when
 * `interactiveCharacter` is set, tapping it cycles the pose (나의 방), otherwise
 * static. Shared by the room cluster screens (my room, decor, friend room).
 *
 * memo 경계 (#539): 방 캔버스는 가장 무거운 서브트리라 부모 리렌더에서
 * 끊는다 — 함수/객체 prop은 호출부에서 참조 안정이 전제다.
 */
export const Room = memo(function Room({
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
  placements = null,
  interactiveCharacter = false,
  editable = false,
  onRegionPress,
  activeRegion = null,
  fill = false,
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
    <View
      style={[
        fill ? styles.roomFill : styles.room,
        { backgroundColor: wallpaper?.color ?? '#F3E9D6' },
        style,
      ]}>
      {background ? (
        isCdnKey(background.assetKey) ? (
          <Image
            source={assetSource(background.assetKey)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
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
          cachePolicy="memory-disk"
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
            cachePolicy="memory-disk"
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
      {/* 자유 배치 경로 (#327) — z 오름차순, 중심점 앵커(폭 28%의 절반 보정). */}
      {placements
        ? [...placements]
            .sort((a, b) => a.z - b.z)
            .map((p) => {
              const item = furniture.find((f) => f.id === p.furnitureId);
              if (!item) return null;
              const transforms = [
                ...(p.scale != null && p.scale !== 1 ? [{ scale: p.scale }] : []),
                ...(p.rotationDeg ? [{ rotate: `${p.rotationDeg}deg` }] : []),
                ...(p.flipped ? [{ scaleX: -1 }] : []),
              ];
              return (
                <View
                  key={p.furnitureId}
                  pointerEvents="none"
                  style={[
                    styles.furniture,
                    {
                      left: `${(p.x - FREE_ITEM_WIDTH / 2) * 100}%`,
                      top: `${(p.y - FREE_ITEM_WIDTH / 2) * 100}%`,
                    },
                    transforms.length > 0 && { transform: transforms },
                  ]}>
                  <FurniturePlaceholder item={item} />
                </View>
              );
            })
        : null}
      {placements
        ? null
        : placed.map((item) =>
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
      {/* Empty slots invite a tap with a dashed + marker (슬롯 모드 전용). */}
      {editable && placements == null
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
      {characterId === null ? null : interactiveCharacter ? (
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
});

const styles = StyleSheet.create({
  roomFill: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  room: {
    width: '100%',
    aspectRatio: ROOM_RENDER_CONTRACT.room.aspectRatio,
    borderRadius: ROOM_RENDER_CONTRACT.room.borderRadiusPx,
    overflow: 'hidden',
  },
  // Wall band: CDN wallpaper art is ~1205x585 (width:height ≈ 2:1), so it
  // covers the top half of the square room above the floor band.
  wall: {
    position: 'absolute',
    top: roomPercent(ROOM_RENDER_CONTRACT.surfaces.wallpaper.top),
    left: roomPercent(ROOM_RENDER_CONTRACT.surfaces.wallpaper.left),
    width: roomPercent(ROOM_RENDER_CONTRACT.surfaces.wallpaper.width),
    height: roomPercent(ROOM_RENDER_CONTRACT.surfaces.wallpaper.height),
  },
  // Floor band meets the wall band exactly at the midline — no bare strip.
  floor: {
    position: 'absolute',
    top: roomPercent(ROOM_RENDER_CONTRACT.surfaces.floor.top),
    left: roomPercent(ROOM_RENDER_CONTRACT.surfaces.floor.left),
    width: roomPercent(ROOM_RENDER_CONTRACT.surfaces.floor.width),
    height: roomPercent(ROOM_RENDER_CONTRACT.surfaces.floor.height),
  },
  // Slot styles may override the width (bottom corners stay 24%).
  furniture: {
    position: 'absolute',
    width: roomPercent(ROOM_RENDER_CONTRACT.furniture.baseWidth),
    aspectRatio: ROOM_RENDER_CONTRACT.furniture.aspectRatio,
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
    left: roomPercent(
      ROOM_RENDER_CONTRACT.character.centerX - ROOM_RENDER_CONTRACT.character.width / 2,
    ),
    bottom: roomPercent(ROOM_RENDER_CONTRACT.character.bottom),
    width: roomPercent(ROOM_RENDER_CONTRACT.character.width),
    height: roomPercent(ROOM_RENDER_CONTRACT.character.height),
  },
  characterFill: {
    width: '100%',
    height: '100%',
  },
});
