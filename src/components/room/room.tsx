import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { ROOM_RENDER_CONTRACT, roomPercent } from '@/components/room/room-render-contract';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { FixedOverlay, Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_COLOR,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  SLOT_LABELS,
  SLOT_ORDER,
  WALLPAPERS,
  type FurnitureItem,
  type FurnitureSlot,
  type PlacedFurniture,
  type Wallpaper,
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

/** 방에 낀 거미줄 (서버 #277). `cleanable`은 청소 단계(#830·#831)에서 쓴다. */
export type RoomCobweb = { assetKey?: string; cleanable?: boolean };

export type RoomProps = {
  wallpaperId?: string;
  /** Selected floor/background surface item ids (optional room layers). */
  floorId?: string | null;
  backgroundId?: string | null;
  placedFurnitureIds?: string[];
  /** `null` renders an unoccupied room — no character (빈방 타일, #281). */
  characterId?: CharacterId | null;
  /** 서버가 등록한 포즈 프레임(CDN 키, 등록 순서) — 없으면 번들 스프라이트 (#735). */
  characterFrames?: string[];
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
  /**
   * 장기 미접속 거미줄 (#829, 서버 #277) — 서버가 방 응답의 nullable
   * `cobweb`으로 준다. 왼쪽 위 모서리에 얹는다. `assetKey`가 CDN 키가
   * 아니거나 없으면 아무것도 그리지 않는다(구버전 서버·목 데이터 대비).
   * 청소(탭)는 다음 단계(#830·#831)라 지금은 표시만 한다.
   */
  cobweb?: RoomCobweb | null;
  /**
   * 거미줄 탭 (#830) — `cobweb.cleanable`이 true이고 이 콜백이 있을 때만
   * 눌린다. 코인 연출을 탭 지점에서 쏘려고 window 좌표를 함께 넘긴다.
   */
  onCleanCobweb?: (at: { x: number; y: number }) => void;
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

/** 카탈로그 4종 — 방을 그리는 화면들의 Props와 Room 전달에 공용 (#691). */
export type RoomCatalogProps = Pick<
  RoomProps,
  'furniture' | 'wallpapers' | 'floors' | 'backgrounds'
>;

/**
 * Room에 그대로 전달되는 씬 prop 번들 (#691) — 방을 그리는 화면은 이 타입을
 * Props에 합류(&)하고 `<Room {...scene} />` 스프레드로 전달한다. 화면마다
 * 11개 prop 선언·전달을 나열하던 복붙을 대체한다.
 */
export type RoomSceneProps = RoomCatalogProps &
  Pick<
    RoomProps,
    | 'characterId'
    | 'characterFrames'
    | 'wallpaperId'
    | 'floorId'
    | 'backgroundId'
    | 'placedFurnitureIds'
    | 'placements'
    | 'cobweb'
    | 'onCleanCobweb'
  >;

/**
 * A member's live room resolved for a tile/window preview (their placement +
 * worn character). Absent entry = not loaded / fetch failed → mock fallback.
 */
export type MemberRoomPreview = {
  placedFurnitureIds: string[];
  /** FREE_V1 방의 자유 배치 (#327) — null이면 슬롯 렌더. */
  placements?: PlacedFurniture[] | null;
  wallpaperId?: string;
  floorId?: string | null;
  backgroundId?: string | null;
  characterId?: CharacterId;
  /** 그 방에 낀 거미줄 (#829) — 없으면 깨끗한 방. */
  cobweb?: RoomCobweb | null;
};

/**
 * MemberRoomPreview(집 좌석 타일·탐색 창문)를 Room 씬 번들로 변환 (#691).
 * 기본값 규약을 한 곳에 고정한다: room이 없으면 캐릭터 없는 빈 방
 * (placements [] = 빈 자유배치), 있으면 placements null이 슬롯 렌더 폴백.
 */
export function memberRoomScene(
  room: MemberRoomPreview | undefined,
  catalogs: RoomCatalogProps,
): RoomSceneProps {
  return {
    ...catalogs,
    characterId: room?.characterId ?? null,
    placedFurnitureIds: room?.placedFurnitureIds ?? [],
    placements: room ? (room.placements ?? null) : [],
    wallpaperId: room?.wallpaperId,
    floorId: room?.floorId,
    backgroundId: room?.backgroundId,
    cobweb: room?.cobweb ?? null,
  };
}

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
  characterFrames,
  furniture = FURNITURE_ITEMS,
  wallpapers = WALLPAPERS,
  floors = [],
  backgrounds = [],
  placements = null,
  cobweb = null,
  onCleanCobweb,
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
        { backgroundColor: wallpaper?.color ?? DEFAULT_WALLPAPER_COLOR },
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
            // fill(집 창문·미리보기)은 카메라 줌 대상 — 원본 해상도 유지.
            allowDownscaling={!fill}
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
          allowDownscaling={!fill}
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
            allowDownscaling={!fill}
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
                  <FurniturePlaceholder item={item} sharp={fill} />
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
                <FurniturePlaceholder item={item} sharp={fill} />
              </Pressable>
            ) : (
              <View key={item.id} style={[styles.furniture, SLOT_STYLE[item.slot]]}>
                <FurniturePlaceholder item={item} sharp={fill} />
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
                <View style={[styles.plusH, { backgroundColor: FixedOverlay.gridLine }]} />
                <View style={[styles.plusV, { backgroundColor: FixedOverlay.gridLine }]} />
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
            frames={characterFrames}
            pose={pose}
            style={styles.characterFill}
            sharp={fill}
          />
        </Pressable>
      ) : (
        <CharacterAvatar
          characterId={characterId}
          frames={characterFrames}
          style={styles.character}
          sharp={fill}
        />
      )}
      {/* 장기 미접속 거미줄 (#829) — 캐릭터·가구 위, 왼쪽 위 모서리.
          청소 탭은 다음 단계(#830·#831)라 지금은 표시 전용이다. */}
      {isCdnKey(cobweb?.assetKey) ? (
        cobweb.cleanable && onCleanCobweb ? (
          <Pressable
            onPress={(e) => onCleanCobweb({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
            accessibilityRole="button"
            accessibilityLabel="거미줄 치우기"
            style={styles.cobweb}>
            <Image
              source={assetSource(cobweb.assetKey)}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
            />
          </Pressable>
        ) : (
          <Image
            source={assetSource(cobweb.assetKey)}
            style={styles.cobweb}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            accessibilityLabel="거미줄이 꼈어요"
          />
        )
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  /** 왼쪽 위 모서리 — 방 크기에 비례하도록 %로 둔다(타일·전체 화면 공용). */
  cobweb: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '26%',
    height: '26%',
  },
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
    borderColor: FixedOverlay.gridCell,
    borderRadius: Radius.md,
    backgroundColor: FixedOverlay.gridFill,
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
