import { type ReactNode, useEffect, useRef } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

/** 한 번 들이쉬고 내쉬는 데 걸리는 시간(ms) — 쉬는 동물의 느린 호흡. */
export const BREATH_MS = 1800;
/** 들이쉴 때 세로로 부푸는 정도 — 눈에 띄지 않을 만큼만. */
export const BREATH_SCALE = 0.022;
/** 탭(포즈 변경) 때 눌렸다 튀는 정도. */
const SQUASH = 0.07;

/**
 * 캐릭터 대기 동작 (2026-11-09) — 서버의 움직이는 webp는 몸 전체가 계속 출렁여 "떠다니는"
 * 느낌이었다(사용자 제보). 사람이 만든 캐릭터 애니메이션은 대부분 **가만히 있다가 작게** 움직인다.
 * 그래서 정지 그림 위에 두 가지만 얹는다.
 *
 * - **숨쉬기**: 발밑을 축으로 세로 2% 남짓 부풀었다 줄어든다. 발이 바닥에서 뜨지 않는다.
 * - **탭 반응**: `pulseKey`가 바뀌면(포즈 변경) 한 번 눌렸다가 스프링으로 돌아온다.
 *
 * 시스템 "동작 줄이기"가 켜져 있으면 둘 다 하지 않는다. UI 스레드(Reanimated)에서 돌아 JS가
 * 바빠도 끊기지 않는다.
 */
export function CharacterIdle({
  active = true,
  pulseKey,
  style,
  children,
}: {
  /** false면 정지 — 화면 밖·여러 명이 함께 보이는 곳에서는 끈다. */
  active?: boolean;
  /** 바뀔 때마다 한 번 눌렸다 튄다. 첫 값에서는 튀지 않는다. */
  pulseKey?: number | string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const animate = active && !reduced;
  // jest의 useSharedValue는 렌더마다 새 객체 — useRef로 앵커(calendar의 fold와 같은 계약).
  const breath = useRef(useSharedValue(0)).current;
  const squash = useRef(useSharedValue(0)).current;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 200 });
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [animate, breath]);

  // 직전 pulseKey와 실제로 다를 때만 튄다 — animate만 바뀌는 경우(캐러셀 카드가 활성이 됨,
  // 동작 줄이기 해제)에 effect가 다시 돌아도 포즈는 그대로라 튀면 안 된다(#1703 리뷰).
  const lastPulse = useRef(pulseKey);
  useEffect(() => {
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    if (!animate) return;
    squash.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 9, stiffness: 240 }),
    );
  }, [pulseKey, animate, squash]);

  const motion = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 1 - breath.value * BREATH_SCALE * 0.4 + squash.value * SQUASH * 0.6 },
      { scaleY: 1 + breath.value * BREATH_SCALE - squash.value * SQUASH },
    ],
  }));

  return (
    <Reanimated.View testID="character-idle" style={[style, { transformOrigin: 'bottom' }, motion]}>
      {children}
    </Reanimated.View>
  );
}
