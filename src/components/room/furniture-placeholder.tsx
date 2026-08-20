import { Image } from 'expo-image';
import { memo } from 'react';

import { useFontEmphasis, useTokens } from '@/hooks/use-tokens';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { assetSource, isCdnKey } from '@/resources/asset';
import { type FurnitureCategory, type FurnitureItem } from '@/resources/furniture';

/** Pastel background per catalog category, so slots read as distinct tiles. */
const CATEGORY_BG: Record<FurnitureCategory, string> = {
  가구: '#EADFD0',
  장식: '#DCE7DA',
  러그: '#E8DCE4',
  한옥: '#EEE2CC',
};

export type FurniturePlaceholderProps = {
  item: FurnitureItem;
  /** Show the Korean name inside the tile (off when a caption sits below it). */
  showName?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 원본 해상도 디코딩 — 카메라 줌 대상(집 창문)용. */
  sharp?: boolean;
};

/**
 * Furniture tile: renders the real CDN art when the item's assetKey points at
 * the asset bucket (API items), otherwise falls back to the in-app placeholder
 * (colored box + Korean name) for legacy local-catalog items without art.
 *
 * memo 경계: 앱에서 가장 많이 반복되는 리프다 — 방 하나에 가구 N장, 집 화면은
 * 그 방이 8~12칸. `item`은 카탈로그의 안정 참조라 부모(Room)가 다시 그려도
 * 여기서 멈춘다.
 */
export const FurniturePlaceholder = memo(function FurniturePlaceholder({
  item,
  showName = true,
  style,
  sharp = false,
}: FurniturePlaceholderProps) {
  const emph = useFontEmphasis();
  const t = useTokens();
  if (isCdnKey(item.assetKey)) {
    return (
      <View accessibilityLabel={item.name} style={[styles.tile, style]}>
        <Image
          source={assetSource(item.assetKey)}
          style={styles.art}
          contentFit="contain"
          transition={120}
          // 앱에서 가장 많이 반복되는 이미지 (#771) — 방 캔버스·집 좌석 8~12칸·
          // 꾸미기 카탈로그 전 셀이 같은 아트를 다시 그린다. 기본값 'disk'는
          // 메모리 캐시가 없어 스크롤마다 디코딩을 반복한다.
          cachePolicy="memory-disk"
          // 리스트 셀 재활용 시 이전 아트가 잠깐 남는 것 방지.
          recyclingKey={item.id}
          // 확대 대상(집 창문 등)은 원본 해상도로 디코딩 (#307 후속) — 기본
          // 다운스케일 디코딩은 레이아웃 크기에 맞춰져 카메라 줌에서 흐려진다.
          allowDownscaling={!sharp}
        />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={item.name}
      style={[styles.tile, { backgroundColor: CATEGORY_BG[item.category] }, style]}>
      {/* Pastel tile background is fixed regardless of theme — onTint ink. */}
      {showName ? (
        <Text style={[styles.name, emph('semibold'), { color: t.onTint }]} numberOfLines={2}>
          {item.name}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: ROOM_RENDER_CONTRACT.furniture.borderRadiusPx,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ROOM_RENDER_CONTRACT.furniture.imagePaddingPx,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
});
