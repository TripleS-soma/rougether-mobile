import { GlassView } from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';

import { ShadowColor } from '@/constants/theme';

import { useGlassMaterial } from '@/hooks/use-liquid-glass';
import { useResolvedScheme } from '@/hooks/use-tokens';

export type GlassSurfaceProps = Omit<ViewProps, 'style'> & {
  /** 글래스가 불가한 환경(iOS 25 이하·Android·웹·투명도 줄이기)에서 칠할 배경. */
  fallbackColor: string;
  /**
   * 누를 때 스스로 빛나고 눌리는 iOS 26 반응. 버튼 면이면 켜고(기본), 라벨
   * 알약처럼 눌리지 않는 면이면 끈다.
   */
  interactive?: boolean;
  /**
   * 강조 버튼용 틴트 (#1069) — iOS 26의 prominent glass. 글래스가 가능하면 이 색을
   * 유리에 입히고, 아니면 `fallbackColor`가 그대로 배경이 된다(호출 쪽이 같은 색을
   * 넘기면 폴백은 종전 단색 버튼).
   */
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * 콘텐츠 위에 떠 있는 작은 면(원형 버튼·라벨 알약)의 리퀴드 글래스 판 (#1050).
 *
 * 글래스가 가능하면 `GlassView`(regular, 앱 resolved scheme), 아니면 같은
 * 스타일의 `View`에 `fallbackColor`를 칠한다. 크기·모양(`borderRadius`)은
 * 호출 쪽 style이 정한다 — 바텀바 알약(#1049)과 같은 라이브러리·같은 조건.
 *
 * 주의: 이 뷰나 부모의 opacity를 0으로 두면 글래스가 아예 안 그려지고 복귀도
 * 불안정하다(라이브러리 공식 주의). 숨길 땐 조건부 렌더로.
 */
export function GlassSurface({
  fallbackColor,
  interactive = true,
  tintColor,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const material = useGlassMaterial();
  const scheme = useResolvedScheme();
  if (material !== 'glass') {
    // 반투명 폴백 (#1074): Android·iOS 25도 같은 오버레이 레이아웃을 쓰므로 면이
    // 밑 콘텐츠를 살짝 비추고 그림자로 떠 있음을 말한다. 틴트(강조 버튼)는 단색
    // 그대로, 투명도 줄이기(opaque)는 알파 없이.
    const translucent = material === 'translucent' && !tintColor;
    const bg =
      tintColor ?? (translucent ? withAlpha(fallbackColor, TRANSLUCENT_ALPHA) : fallbackColor);
    return (
      <View {...rest} style={[style, translucent && styles.lift, { backgroundColor: bg }]}>
        {children}
      </View>
    );
  }
  return (
    <GlassView
      {...rest}
      glassEffectStyle="regular"
      isInteractive={interactive}
      tintColor={tintColor}
      colorScheme={scheme}
      style={style}>
      {children}
    </GlassView>
  );
}

/** 반투명 폴백의 알파 — 0.9면 밑 콘텐츠가 은은히 비치면서 글자 대비는 유지된다. */
const TRANSLUCENT_ALPHA = 0.9;

/** `#RRGGBB` 토큰에 알파를 붙인다. 그 외 형식(rgba 등)은 그대로 둔다. */
function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return (
    color +
    Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  );
}

const styles = StyleSheet.create({
  lift: {
    elevation: 3,
    shadowColor: ShadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
