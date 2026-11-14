import { Image } from 'expo-image';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import type { ChatCrop } from '@/api/chat-types';
import { cropLayout, isFullCrop } from '@/lib/chat-crop';

/**
 * 아직 올리지 않은 사진을 **자른 모습으로** 보여 준다. 파일은 원본 그대로라(자르기는 서버가
 * 올릴 때 한다) 칸을 넘치는 부분을 가려서 같은 결과를 흉내 낸다. 자르기가 없으면 일반 채우기.
 */
export function CroppedImage({
  uri,
  aspect,
  crop,
  style,
}: {
  uri: string;
  /** 원본의 가로/세로 비율(보이는 방향 기준). */
  aspect: number;
  crop?: ChatCrop;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0 && (box?.width !== width || box?.height !== height))
      setBox({ width, height });
  };
  const plain = isFullCrop(crop);
  return (
    <View style={[styles.box, style]} onLayout={plain ? undefined : onLayout}>
      {plain ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="none"
        />
      ) : box ? (
        <Image
          source={{ uri }}
          style={[styles.placed, cropLayout(box, aspect, crop)]}
          contentFit="fill"
          cachePolicy="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  placed: { position: 'absolute' },
});
