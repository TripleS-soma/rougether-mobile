import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { GachaMachine } from '@/api/adapters';
import { Pictogram } from '@/components/ui/pictograms';
import { assetSource, isCdnKey } from '@/resources/asset';

/**
 * 선물상자 아트 (서버 #276) — 칩 줄·선택 카드·뽑는 중 오버레이가 **같은 상자**를
 * 보여주도록 한 곳에서 그린다. 예전엔 뽑기 버튼을 누르는 순간 상자가 픽토그램으로
 * 바뀌어, 방금 고른 그 상자를 여는 것처럼 읽히지 않았다.
 *
 * accent 배경은 호출부가 깐다. 14개가 같은 상자 한 장을 공유하던 시절엔 배경색이
 * 유일한 구분 단서였는데, 2026-08-18 확인 결과 서버가 12종을 따로 준다 — 배경이
 * 없어도 구분은 되지만 칩 줄의 리듬을 만드는 요소라 유지.
 */
export function GiftBoxArt({
  machine,
  size,
  testIDPrefix = 'gift-box',
}: {
  machine: GachaMachine;
  size: number;
  /** 같은 상자가 여러 곳에 동시에 뜨므로(칩 + 선택 카드 + 오버레이) 구분용. */
  testIDPrefix?: string;
}) {
  if (!isCdnKey(machine.giftBoxKey)) return <Pictogram name={machine.icon} size={size} />;
  return (
    // 아트가 도착할 때까지 픽토그램이 자리를 지킨다 (#877). 서버 아트가
    // 1254×1254 PNG(장당 ~2MB)라 44px 칩에 뜨기까지 눈에 띄게 걸리는데,
    // 예전엔 그동안 **칸이 비어 있었다.** 바이트를 줄이는 건 서버 몫이고
    // (CDN이 리사이즈·webp 협상을 안 한다), 여기서는 빈 자리를 없앤다.
    <View style={{ width: size, height: size }}>
      <View testID={`${testIDPrefix}-fallback-${machine.id}`} style={StyleSheet.absoluteFill}>
        <Pictogram name={machine.icon} size={size} />
      </View>
      <Image
        testID={`${testIDPrefix}-${machine.id}`}
        source={assetSource(machine.giftBoxKey)}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={120}
        // 칩 줄이 가로 스크롤이라 셀이 재활용된다 — furniture-placeholder(#771)와 같은 이유.
        cachePolicy="memory-disk"
      />
    </View>
  );
}
