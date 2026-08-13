import { type Ref } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import { useAnimatedValue } from '@/hooks/use-stable-value';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ScalePressableProps = Omit<PressableProps, 'style'> & {
  /** 눌림 스케일 (기본 0.96). */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
  /** 팝오버 앵커 등 위치 측정용 (React 19 — ref는 일반 prop). */
  ref?: Ref<View>;
};

/**
 * 누르는 동안 살짝 눌리는(스케일 스프링) 공용 Pressable (#442) — 시각
 * 피드백이 없던 버튼들의 기본 손맛. 스케일은 transform이라 레이아웃에
 * 영향이 없고, Pressable API를 그대로 통과시키므로 기존 Pressable을
 * 이름만 바꿔 대체할 수 있다 (함수형 style만 정적 스타일로 바꿀 것).
 */
export function ScalePressable({ pressScale = 0.96, style, ...rest }: ScalePressableProps) {
  const scale = useAnimatedValue(1);
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e) => {
        to(pressScale);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    />
  );
}
