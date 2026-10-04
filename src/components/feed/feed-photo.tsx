import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FeedImage, FeedImageLoader } from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { useTokens } from '@/hooks/use-tokens';

/** 카드·상세 사진 비율의 상하한 — 아주 긴 세로·가로 사진이 목록을 삼키지 않게(인스타그램과 같은 4:5 ~ 1.91:1). */
const MIN_ASPECT = 4 / 5;
const MAX_ASPECT = 1.91;

/** 서버가 준 치수로 표시 비율을 정한다 — 치수가 없으면 정사각형. */
export function feedImageAspect(image: Pick<FeedImage, 'width' | 'height'>): number {
  if (!image.width || !image.height) return 1;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, image.width / image.height));
}

export type FeedPhotoProps = {
  image: FeedImage;
  /** 인증 이미지 로더(셸이 `fetchFeedImage`) — 없거나 실패하면 자리표시만 남는다. */
  loader?: FeedImageLoader;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 피드 사진 한 장 (#1409). 사진은 Authorization이 필요해 주소를 바로 못 쓰므로 로더가 준
 * 주소(웹 blob URL · 네이티브 data URI)를 그린다. 원본 비율 그대로(contain) 보여 주고, 남는
 * 자리는 옅은 면으로 채운다. 디스크 캐시는 쓰지 않는다(서버 `no-store`).
 */
export function FeedPhoto({ image, loader, accessibilityLabel, style }: FeedPhotoProps) {
  const t = useTokens();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUri(null);
    if (!loader) return;
    void loader(image.imageId).then((next) => {
      if (alive) setUri(next);
    });
    return () => {
      alive = false;
    };
  }, [image.imageId, loader]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.frame, { backgroundColor: t.surfaceMuted }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory"
          transition={120}
        />
      ) : (
        <Icon name="image" size={28} color={t.textDisabled} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
