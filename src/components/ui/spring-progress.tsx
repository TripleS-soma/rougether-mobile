import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, StaticWhite } from '@/constants/theme';

export type SpringProgressBarProps = {
  /** 진행률 0~1 — 범위 밖 값은 clamp되어 그려진다. */
  progress: number;
  /** 채움 색. */
  color: string;
  /** 트랙 색. */
  trackColor: string;
  /** 트랙 높이 (기본 10; 집 탐색 미션 미리보기는 6). */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * 스프링 진행 바 (#440·#503, #696에서 ui로 승격) — 차오를 때는 바운스,
 * 줄어들 때(완료 해제)는 오버슈트 없이 목표에서 멈추고, 100% 도달 순간
 * 흰 플래시가 스친다. 나의 방 루틴/달력·친구 방·집 탐색 미션 미리보기 공용.
 * width(레이아웃) 애니메이션이라 네이티브 드라이버는 쓸 수 없다.
 */
export function SpringProgressBar({
  progress,
  color,
  trackColor,
  height = 10,
  style,
}: SpringProgressBarProps) {
  const w = useRef(new Animated.Value(progress)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prev = useRef(progress);
  useEffect(() => {
    Animated.spring(w, {
      toValue: progress,
      friction: 8,
      tension: 50,
      // 줄어들 때는 바운스 없이 목표에서 멈춘다 (#503) — 100%→0%(루틴 1개
      // 해제)에서 오버슈트가 0 아래로 뚫려 바가 깜빡였다.
      overshootClamping: progress < prev.current,
      useNativeDriver: false,
    }).start();
    if (progress >= 1 && prev.current < 1) {
      flash.setValue(0.85);
      Animated.timing(flash, { toValue: 0, duration: 650, useNativeDriver: false }).start();
    }
    prev.current = progress;
  }, [progress, w, flash]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { backgroundColor: trackColor, height }, style]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            // clamp: 스프링 오버슈트가 범위 밖(음수/100% 초과) width로 새지 않게 (#503).
            width: w.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: StaticWhite, opacity: flash }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
