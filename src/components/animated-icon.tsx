import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as SplashScreen from 'expo-splash-screen';

import { SplashBackground, SplashBackgroundDark } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-tokens';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
/** 네이티브 스플래시 최소 노출 (#569) — 아트가 깜빡하고 사라지지 않게. */
const MIN_SPLASH_MS = 1200;
/** JS 부팅 시각 — 이미 오래 걸린 콜드 스타트에선 추가 대기를 줄인다. */
const BOOT_TS = Date.now();

export function AnimatedSplashOverlay() {
  // holding: 네이티브 스플래시가 아직 떠 있음(최소 노출 대기) → fading: 단색
  // 오버레이가 페이드로 앱을 드러냄 → done: 오버레이 제거.
  const [phase, setPhase] = useState<'holding' | 'fading' | 'done'>('holding');
  // 네이티브 스플래시와 같은 색으로 이어야 한다 — 다크는 밤 씬 남색 (#570 리뷰).
  const scheme = useResolvedScheme();
  const bg = { backgroundColor: scheme === 'dark' ? SplashBackgroundDark : SplashBackground };

  useEffect(() => {
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - BOOT_TS));
    const timer = setTimeout(() => {
      // hideAsync 실패(이미 숨음 등)에도 전환은 계속돼야 한다.
      void SplashScreen.hideAsync().catch(() => {});
      setPhase('fading');
    }, wait);
    return () => clearTimeout(timer);
  }, []);

  // 안전망 (#579): 페이드 완료 콜백이 유실돼도 오버레이가 화면을 영원히
  // 덮지 않게, fading 진입 후 애니메이션 길이 + 여유가 지나면 강제 제거.
  useEffect(() => {
    if (phase !== 'fading') return;
    const failsafe = setTimeout(() => setPhase('done'), DURATION + 400);
    return () => clearTimeout(failsafe);
  }, [phase]);

  if (phase === 'done') return null;

  if (phase === 'holding') {
    // 네이티브 스플래시 뒤에서 같은 색으로 대기 — 숨는 순간 이음새가 없다.
    // key가 달라야 fading 전환 때 재마운트되어 entering 애니메이션이 실행된다
    // (같은 위치의 같은 타입이면 업데이트로 처리돼 entering이 스킵 — #579).
    return <Animated.View key="holding" style={[styles.backgroundSolidColor, bg]} />;
  }

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      key="fading"
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setPhase, 'done');
        }
      })}
      style={[styles.backgroundSolidColor, bg]}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
});
