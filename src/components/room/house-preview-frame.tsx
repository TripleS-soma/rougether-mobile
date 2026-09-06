import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  type MemberRoomPreview,
  memberRoomScene,
  Room,
  type RoomCatalogProps,
} from '@/components/room/room';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useHouseFrame } from '@/hooks/use-house-frame';
import { assetSource, isCdnKey } from '@/resources/asset';
import { type HouseFrameOptions, houseWindowSeats } from '@/resources/house-frame';

// Compatibility exports; all consumers resolve art and geometry in resources.
export {
  FRAME_ASPECT,
  DEFAULT_HOUSE_COVER_KEY,
  houseCoverKey,
  WINDOW_RECTS,
} from '@/resources/house-frame';

/** RoomCatalogProps: 실제 방의 assetKey 아이템 해석용 카탈로그 (없으면 로컬 기본). */
export type HousePreviewFrameProps = RoomCatalogProps &
  Omit<HouseFrameOptions, 'minimumSeats'> & {
    /** 커버(프레임 PNG) 키 — 없거나 CDN 키가 아니면 기본 프레임 PNG로 렌더. */
    coverImageKey?: string;
    /** 입주 인원 — rooms가 없을 때 이만큼의 창문에 기본 방 목업이 들어간다. */
    memberCount?: number;
    /** 구성원별 실제 방 (#386, 가입순) — 있으면 목업 대신 이걸 그린다. */
    rooms?: MemberRoomPreview[];
    /** 접근성 라벨용 집 이름. */
    name?: string;
  };

/**
 * 집 탐색 미리보기용 미니 하우스 (#328) — 집 화면과 같은 "프레임 PNG의
 * 투명 창문 뒤로 방이 보이는" 형태. 프리뷰 응답의 memberRooms(#386)가 있으면
 * 구성원들의 실제 방을 창문에 그리고, 없으면(카탈로그 미로드·데모) 입주
 * 인원수만큼 기본 방 목업으로 폴백한다. 커버가 없는 집도 기본 프레임으로
 * 같은 형태를 유지한다.
 */
export function HousePreviewFrame({
  coverImageKey,
  memberCount = 0,
  rooms,
  furniture,
  wallpapers,
  floors,
  backgrounds,
  name,
  maxMembers,
  enabled,
  previewTheme,
}: HousePreviewFrameProps) {
  const t = useTokens();
  // 커버가 없으면 기본 프레임으로 — 모든 집이 같은 형태. (창틀 직접 그리기는
  // 에셋 자체가 깨진 비정상 키일 때만 남는 안전망.)
  const seats = rooms ? rooms.length : memberCount;
  const { frame, onFrameError } = useHouseFrame(coverImageKey, {
    maxMembers,
    minimumSeats: seats,
    enabled,
    previewTheme,
  });
  const coverKey = frame.assetKey;
  const slotRooms = useMemo(() => {
    if (frame.kind === 'legacy') return frame.windowRects.map((_, i) => i);
    const count = Math.max(maxMembers ?? 4, seats);
    const rows = Array.from({ length: Math.ceil(count / 2) }, (_, row) =>
      Array.from({ length: Math.min(2, count - row * 2) }, (_, col) => row * 2 + col),
    ).reverse();
    return houseWindowSeats(rows, frame.windowRects.length);
  }, [frame, maxMembers, seats]);
  const hasFrame = isCdnKey(coverKey);
  // 창문 4칸의 씬을 한 번에 조합해 참조를 고정한다 — 렌더 안에서 매번
  // `memberRoomScene(...)`을 부르면 씬 객체가 늘 새것이라 <Room>의 memo가
  // 통째로 무력해진다(seat-tile이 같은 이유로 useMemo를 쓴다).
  const scenes = useMemo(
    () =>
      slotRooms.map((i) =>
        memberRoomScene(i == null ? undefined : rooms?.[i], {
          furniture,
          wallpapers,
          floors,
          backgrounds,
        }),
      ),
    [slotRooms, rooms, furniture, wallpapers, floors, backgrounds],
  );
  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: frame.aspectRatio },
        !hasFrame && { backgroundColor: t.surfaceMuted },
      ]}
      testID="house-preview-frame">
      {frame.windowRects.map((rect, i) => {
        const roomIndex = slotRooms[i];
        const occupied = roomIndex != null && roomIndex < seats;
        return (
          <View
            key={`window-${i}`}
            style={[
              styles.window,
              rect,
              frame.kind === 'stacked' && { borderRadius: 0 },
              // 프레임 PNG가 없으면 창틀을 직접 그려 창문처럼 보이게 한다.
              !hasFrame && [styles.windowBare, { borderColor: t.border }],
            ]}>
            {occupied ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="preview-room">
                <Room {...scenes[i]} fill />
              </View>
            ) : (
              <View
                style={[styles.vacant, { backgroundColor: t.surface }]}
                testID="preview-vacant"
              />
            )}
          </View>
        );
      })}
      {hasFrame ? (
        // Android는 Image 계열이 pointerEvents prop을 무시한다(#401) — View 래퍼로 투과.
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            key={coverKey}
            source={assetSource(coverKey)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={frame.kind === 'stacked' ? 0 : 120}
            onError={onFrameError}
            // 셸이 집 목록을 받자마자 memory-disk로 프리페치하는데(#463,
            // use-house-pages) 렌더가 기본 'disk'면 메모리 히트를 못 써
            // 프리페치 효과가 절반만 난다 (#771).
            cachePolicy="memory-disk"
            recyclingKey={coverKey}
            accessibilityLabel={name ? `${name} 집 미리보기` : '집 미리보기'}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
  },
  window: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: Radius.sm,
  },
  windowBare: {
    borderWidth: 2,
  },
  vacant: {
    flex: 1,
    opacity: 0.55,
  },
});
