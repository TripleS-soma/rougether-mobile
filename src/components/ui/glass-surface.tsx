import { GlassView } from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';

import { useLiquidGlass } from '@/hooks/use-liquid-glass';
import { useResolvedScheme } from '@/hooks/use-tokens';

export type GlassSurfaceProps = Omit<ViewProps, 'style'> & {
  /** 글래스가 불가한 환경(iOS 25 이하·Android·웹·투명도 줄이기)에서 칠할 배경. */
  fallbackColor: string;
  /**
   * 누를 때 스스로 빛나고 눌리는 iOS 26 반응. 버튼 면이면 켜고(기본), 라벨
   * 알약처럼 눌리지 않는 면이면 끈다.
   */
  interactive?: boolean;
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
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const glass = useLiquidGlass();
  const scheme = useResolvedScheme();
  if (!glass) {
    return (
      <View {...rest} style={[style, { backgroundColor: fallbackColor }]}>
        {children}
      </View>
    );
  }
  return (
    <GlassView
      {...rest}
      glassEffectStyle="regular"
      isInteractive={interactive}
      colorScheme={scheme}
      style={style}>
      {children}
    </GlassView>
  );
}
