import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as SplashScreen from 'expo-splash-screen';

import { SplashBackground, SplashBackgroundDark } from '@/constants/theme';
import { isAppReady, onAppReady } from '@/lib/app-ready';
import { useResolvedScheme } from '@/hooks/use-tokens';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
/** 네이티브 스플래시 최소 노출 (#569) — 아트가 깜빡하고 사라지지 않게. */
const MIN_SPLASH_MS = 1200;
/** JS 부팅 시각 — 이미 오래 걸린 콜드 스타트에선 추가 대기를 줄인다. */
const BOOT_TS = Date.now();
/**
 * 준비를 기다리는 상한 (#847) — 넘으면 준비 여부와 무관하게 걷는다. 저장소
 * 오류 등으로 준비 신호가 영영 안 와도 스플래시에 갇히지 않게. #579 안전망과
 * 같은 생각이다.
 */
const MAX_SPLASH_MS = 4000;

export function AnimatedSplashOverlay() {
  // holding: 네이티브 스플래시가 아직 떠 있음(최소 노출 대기) → fading: 단색
  // 오버레이가 페이드로 앱을 드러냄 → done: 오버레이 제거.
  const [phase, setPhase] = useState<'holding' | 'fading' | 'done'>('holding');
  // 네이티브 스플래시와 같은 색으로 이어야 한다 — 다크는 밤 씬 남색 (#570 리뷰).
  const scheme = useResolvedScheme();
  const bg = { backgroundColor: scheme === 'dark' ? SplashBackgroundDark : SplashBackground };

  useEffect(() => {
    let cancelled = false;
    let minTimer: ReturnType<typeof setTimeout> | undefined;
    let capTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const lift = () => {
      if (cancelled) return;
      cancelled = true;
      // hideAsync 실패(이미 숨음 등)에도 전환은 계속돼야 한다.
      void SplashScreen.hideAsync().catch(() => {});
      setPhase('fading');
    };

    // 최소 노출과 "그릴 준비"를 **둘 다** 만족해야 걷는다 (#847). 예전엔
    // 최소 노출만 봤는데, AppRoot의 두 관문(세션 복원 → 온보딩 플래그)이
    // 직렬 AsyncStorage 읽기라 느린 기기에서 1200ms를 넘으면 오버레이가
    // 먼저 걷혀 빈 화면(AppRoot의 return null)이 드러났다.
    const liftWhenBothDone = () => {
      if (!isAppReady()) return;
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - BOOT_TS));
      minTimer = setTimeout(lift, wait);
    };

    unsubscribe = onAppReady(liftWhenBothDone);
    liftWhenBothDone(); // 구독 전에 이미 준비됐을 수 있다.

    // 준비가 영영 안 와도(저장소 오류 등) 스플래시에 갇히지 않는다 — 상한을
    // 넘으면 걷고, AppRoot가 그 자리에 로딩 표시를 그린다.
    capTimer = setTimeout(lift, MAX_SPLASH_MS);

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (minTimer) clearTimeout(minTimer);
      if (capTimer) clearTimeout(capTimer);
    };
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
