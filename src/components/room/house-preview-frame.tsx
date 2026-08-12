import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import {
  type MemberRoomPreview,
  memberRoomScene,
  Room,
  type RoomCatalogProps,
} from '@/components/room/room';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';

/** 커버(프레임 PNG) 원본 비율 — 집 화면과 동일. */
export const FRAME_ASPECT = 567 / 508;

/**
 * 커버를 고르지 않은 집(서버 값 null)의 기본 프레임 — 어느 집이든 "커버 위에
 * 방이 보이는" 같은 형태를 유지한다 (집 화면·탐색 미리보기 공용).
 */
export const DEFAULT_HOUSE_COVER_KEY = 'house/cloud-balloon/house-unified-cloud-balloon-frame.png';

/**
 * The CDN cover key actually rendered for a house — the server value when it's
 * real CDN art, else the shared default frame. Single source for the group-house
 * screen, this preview, and the app-shell prefetch (#463) so all three warm and
 * render the same image.
 */
export function houseCoverKey(coverImageKey?: string | null): string {
  return coverImageKey && isCdnKey(coverImageKey) ? coverImageKey : DEFAULT_HOUSE_COVER_KEY;
}

/**
 * 프레임 PNG의 투명 창문 위치(좌상·우상·좌하·우하) — 집 화면과 동일.
 * 실측 구멍보다 사방 1~1.5% 크게(블리드) 잡는다: 방은 프레임 뒤에 그려져
 * 넘친 부분은 아트에 가려지고, 구멍이 rect보다 살짝 큰 커버에서 방 위로
 * 뒤 배경(하늘)이 띠처럼 새어 보이던 문제를 8종 커버 공통으로 막는다.
 * 대칭 블리드라 rect 중심은 그대로 — 더블탭 줌 좌표(#307) 불변.
 */
export const WINDOW_RECTS = [
  { left: '11.7%', top: '23.9%', width: '37%', height: '33%' },
  { left: '50.3%', top: '23.9%', width: '37%', height: '33%' },
  { left: '11.7%', top: '57.6%', width: '37%', height: '33%' },
  { left: '50.3%', top: '57.6%', width: '37%', height: '33%' },
] as const;

/** RoomCatalogProps: 실제 방의 assetKey 아이템 해석용 카탈로그 (없으면 로컬 기본). */
export type HousePreviewFrameProps = RoomCatalogProps & {
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
}: HousePreviewFrameProps) {
  const t = useTokens();
  // 커버가 없으면 기본 프레임으로 — 모든 집이 같은 형태. (창틀 직접 그리기는
  // 에셋 자체가 깨진 비정상 키일 때만 남는 안전망.)
  const coverKey = houseCoverKey(coverImageKey);
  const hasFrame = isCdnKey(coverKey);
  return (
    <View
      style={[styles.frame, !hasFrame && { backgroundColor: t.surfaceMuted }]}
      testID="house-preview-frame">
      {WINDOW_RECTS.map((rect, i) => {
        const seats = rooms ? rooms.length : memberCount;
        const occupied = i < Math.min(seats, WINDOW_RECTS.length);
        const room = rooms?.[i];
        return (
          <View
            key={`window-${i}`}
            style={[
              styles.window,
              rect,
              // 프레임 PNG가 없으면 창틀을 직접 그려 창문처럼 보이게 한다.
              !hasFrame && [styles.windowBare, { borderColor: t.border }],
            ]}>
            {occupied ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="preview-room">
                <Room
                  {...memberRoomScene(room, { furniture, wallpapers, floors, backgrounds })}
                  fill
                />
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
            source={assetSource(coverKey)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={120}
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
    aspectRatio: FRAME_ASPECT,
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
