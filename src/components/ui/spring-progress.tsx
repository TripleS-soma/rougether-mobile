import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { useT } from '@/i18n';

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
  /** 스크린리더 이름 — 없으면 '진행률'. progressbar는 이름이 필수다(axe aria-progressbar-name). */
  accessibilityLabel?: string;
};

/**
 * 스프링 진행 바 (#440·#503, #696에서 ui로 승격) — 차오를 때는 바운스,
 * 줄어들 때(완료 해제)는 오버슈트 없이 목표에서 멈추고, 100% 도달 순간
 * 흰 플래시가 스친다. 나의 방 루틴/달력·친구 방·집 탐색 미션 미리보기 공용.
 *
 * 네이티브 드라이버 (성능 장부 M6) — 예전엔 width를 JS 드라이버로 움직여 체크할 때마다
 * 약 1초간 매 프레임 JS에서 레이아웃을 다시 계산했다. 지금은 트랙 폭만큼 긴 채움을
 * 왼쪽으로 밀어 두고 translateX로 끌어낸다 — 트랙의 overflow가 넘친 부분을 자르므로
 * 오른쪽 끝의 둥근 모양은 그대로다(scaleX는 모서리가 눌려 쓰지 않았다).
 */
export function SpringProgressBar({
  progress,
  color,
  trackColor,
  height = 10,
  style,
  accessibilityLabel,
}: SpringProgressBarProps) {
  const tr = useT();
  const w = useAnimatedValue(progress);
  const flash = useAnimatedValue(0);
  const prev = useRef(progress);
  // 트랙 폭을 알기 전 첫 프레임엔 채움을 숨긴다 — 폭 0이면 translate가 0이라 꽉 찬 바가 번쩍인다.
  const [trackWidth, setTrackWidth] = useState(0);
  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  useEffect(() => {
    Animated.spring(w, {
      toValue: progress,
      friction: 8,
      tension: 50,
      // 줄어들 때는 바운스 없이 목표에서 멈춘다 (#503) — 100%→0%(루틴 1개
      // 해제)에서 오버슈트가 0 아래로 뚫려 바가 깜빡였다.
      overshootClamping: progress < prev.current,
      useNativeDriver: true,
    }).start();
    if (progress >= 1 && prev.current < 1) {
      flash.setValue(0.85);
      Animated.timing(flash, { toValue: 0, duration: 650, useNativeDriver: true }).start();
    }
    prev.current = progress;
  }, [progress, w, flash]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      aria-label={accessibilityLabel ?? tr('app.ui.progress')}
      // aria-value*: RN Web은 accessibilityValue 객체를 DOM으로 옮기지 않는다. 네이티브도 같은 값으로 합친다.
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onLayout={onTrackLayout}
      style={[styles.track, { backgroundColor: trackColor, height }, style]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            opacity: trackWidth > 0 ? 1 : 0,
            transform: [
              {
                // clamp: 스프링 오버슈트가 범위 밖(음수/100% 초과)으로 새지 않게 (#503).
                translateX: w.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-trackWidth, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
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
    width: '100%',
    height: '100%',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
