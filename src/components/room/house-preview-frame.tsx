import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Room } from '@/components/room/room';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';

/** 커버(프레임 PNG) 원본 비율 — 그룹하우스 화면과 동일. */
export const FRAME_ASPECT = 567 / 508;

/**
 * 커버를 고르지 않은 집(서버 값 null)의 기본 프레임 — 어느 집이든 "커버 위에
 * 방이 보이는" 같은 형태를 유지한다 (집 화면·탐색 미리보기 공용).
 */
export const DEFAULT_HOUSE_COVER_KEY = 'house/cloud-balloon/house-unified-cloud-balloon-frame.png';

/** 프레임 PNG의 투명 창문 위치(좌상·우상·좌하·우하) — 그룹하우스 화면과 동일. */
export const WINDOW_RECTS = [
  { left: '12.7%', top: '25.4%', width: '35%', height: '30%' },
  { left: '51.3%', top: '25.4%', width: '35%', height: '30%' },
  { left: '12.7%', top: '59.1%', width: '35%', height: '30%' },
  { left: '51.3%', top: '59.1%', width: '35%', height: '30%' },
] as const;

export type HousePreviewFrameProps = {
  /** 커버(프레임 PNG) 키 — 없거나 CDN 키가 아니면 기본 프레임 PNG로 렌더. */
  coverImageKey?: string;
  /** 입주 인원 — 이만큼의 창문에 기본 방 목업이 들어간다 (최대 창문 수). */
  memberCount?: number;
  /** 접근성 라벨용 집 이름. */
  name?: string;
};

/**
 * 집 탐색 미리보기용 미니 하우스 (#328) — 그룹하우스 화면과 같은 "프레임 PNG의
 * 투명 창문 뒤로 방이 보이는" 형태. 비구성원은 멤버 방 데이터를 받을 수 없어
 * (멤버 API 403) 입주 인원수만큼 기본 방 목업을 창문에 채운다. 서버가 프리뷰
 * 응답에 방 레이아웃을 실어주면 실제 방으로 교체한다. 커버가 없는 집도 기본
 * 프레임으로 같은 형태를 유지한다.
 */
export function HousePreviewFrame({
  coverImageKey,
  memberCount = 0,
  name,
}: HousePreviewFrameProps) {
  const t = useTokens();
  // 커버가 없으면 기본 프레임으로 — 모든 집이 같은 형태. (창틀 직접 그리기는
  // 에셋 자체가 깨진 비정상 키일 때만 남는 안전망.)
  const coverKey =
    coverImageKey && isCdnKey(coverImageKey) ? coverImageKey : DEFAULT_HOUSE_COVER_KEY;
  const hasFrame = isCdnKey(coverKey);
  return (
    <View
      style={[styles.frame, !hasFrame && { backgroundColor: t.surfaceMuted }]}
      testID="house-preview-frame">
      {WINDOW_RECTS.map((rect, i) => {
        const occupied = i < Math.min(memberCount, WINDOW_RECTS.length);
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
                <Room characterId={null} placedFurnitureIds={[]} placements={[]} />
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
        <Image
          source={assetSource(coverKey)}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          pointerEvents="none"
          accessibilityLabel={name ? `${name} 집 미리보기` : '집 미리보기'}
        />
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
