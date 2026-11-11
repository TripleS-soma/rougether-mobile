import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { usePageActive } from '@/hooks/use-page-active';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useAnimatedValue, useConstant } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';

/** 한 번 들이쉬고 내쉬는 데 걸리는 시간(ms) — 쉬는 동물의 느린 호흡. */
export const BREATH_MS = 1800;
/** 들이쉴 때 세로로 부푸는 정도 — 눈에 띄지 않을 만큼만. */
export const BREATH_SCALE = 0.022;
/** 탭(포즈 변경) 때 눌렸다 튀는 정도. */
const SQUASH = 0.07;
/** 탭 반응이 눌리는 시간(ms). */
const SQUASH_IN_MS = 90;
/** 숨쉬기를 끌 때 제자리로 돌아가는 시간(ms). */
const SETTLE_MS = 200;
/**
 * 눌린 뒤 돌아오는 스프링 — 종전 Reanimated `withSpring({ damping: 9, stiffness: 240 })`의
 * 실제 물리값 그대로다(Reanimated 4의 기본 질량이 4).
 */
const SQUASH_SPRING = { damping: 9, stiffness: 240, mass: 4 } as const;

/**
 * 캐릭터 대기 동작 (2026-11-09) — 서버의 움직이는 webp는 몸 전체가 계속 출렁여 "떠다니는"
 * 느낌이었다(사용자 제보). 사람이 만든 캐릭터 애니메이션은 대부분 **가만히 있다가 작게** 움직인다.
 * 그래서 정지 그림 위에 두 가지만 얹는다.
 *
 * - **숨쉬기**: 발밑을 축으로 세로 2% 남짓 부풀었다 줄어든다. 발이 바닥에서 뜨지 않는다.
 * - **탭 반응**: `pulseKey`가 바뀌면(포즈 변경) 한 번 눌렸다가 스프링으로 돌아온다.
 *
 * 시스템 "동작 줄이기"가 켜져 있으면 둘 다 하지 않는다.
 *
 * **RN `Animated` + 네이티브 드라이버로 돌린다 — Reanimated를 쓰지 않는다** (2026-11-11 제보).
 * 숨쉬기는 방에 있는 내내 도는 무한 반복이다. Reanimated의 `useAnimatedStyle`은 New Architecture에서
 * transform 한 줄을 바꿀 때도 **매 프레임 ShadowTree를 커밋하고 그 자리에서 마운트를 비운다**
 * (120Hz 단말이면 초당 120번). 셸의 화면 슬라이드(`use-screen-transition`)는 RN `Animated`
 * 네이티브 드라이버라 "React 커밋의 마운트 → 애니메이션 명령 실행"이 한 프레임 안에 순서대로
 * 일어나야 하는데, 그 사이에 끼어든 마운트가 명령 묶음을 쪼개 실행시켜 전환 도중 화면이 시작
 * 위치로 튀었다 돌아왔다(갤럭시 S25 울트라 녹화: 300ms 슬라이드에 고유 프레임 6~14장).
 * 네이티브 드라이버는 뷰 속성만 직접 바꾸고 커밋을 만들지 않는다 — 접속 점(`OnlineDot`)·스피커
 * (`SpeakerSprite`)의 상주 반복과 같은 방식이다. 상주 화면의 무한 반복은 이 방식으로만 만든다.
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
  // 숨은 탭·서브화면 밑에서 쉬는 탭에서는 멈춘다 (성능 장부 M7) — 페이저 밖에서는 항상 true.
  const pageActive = usePageActive();
  const animate = active && !reduced && pageActive;
  const breath = useAnimatedValue(0);
  const squash = useAnimatedValue(0);

  useEffect(() => {
    if (!animate) {
      const settle = Animated.timing(breath, {
        toValue: 0,
        duration: SETTLE_MS,
        useNativeDriver: NATIVE_DRIVER,
      });
      settle.start();
      return () => settle.stop();
    }
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          easing,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS,
          easing,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, breath]);

  // 직전 pulseKey와 실제로 다를 때만 튄다 — animate만 바뀌는 경우(캐러셀 카드가 활성이 됨,
  // 동작 줄이기 해제)에 effect가 다시 돌아도 포즈는 그대로라 튀면 안 된다(#1703 리뷰).
  const lastPulse = useRef(pulseKey);
  useEffect(() => {
    if (lastPulse.current === pulseKey) return;
    lastPulse.current = pulseKey;
    if (!animate) return;
    // 언마운트 때 멈추지 않는다 — 다음 탭이 같은 값을 새로 움직이면 앞선 것은 저절로 끊긴다.
    Animated.sequence([
      Animated.timing(squash, {
        toValue: 1,
        duration: SQUASH_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.spring(squash, { toValue: 0, ...SQUASH_SPRING, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [pulseKey, animate, squash]);

  // 파생 노드는 한 번만 만든다 — 렌더마다 새로 만들면 Animated가 뷰와의 연결을 매번 다시 맺는다.
  // 스프링은 0 아래로 지나치므로(되튐) squash는 구간 보간이 아니라 곱으로 싣는다.
  const motion = useConstant(() => ({
    transform: [
      {
        scaleX: Animated.add(
          breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - BREATH_SCALE * 0.4] }),
          Animated.multiply(squash, SQUASH * 0.6),
        ),
      },
      {
        scaleY: Animated.add(
          breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + BREATH_SCALE] }),
          Animated.multiply(squash, -SQUASH),
        ),
      },
    ],
  }));

  return (
    <Animated.View testID="character-idle" style={[style, { transformOrigin: 'bottom' }, motion]}>
      {children}
    </Animated.View>
  );
}
