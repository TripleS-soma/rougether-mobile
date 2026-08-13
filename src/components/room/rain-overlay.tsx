import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { StaticWhite } from '@/constants/theme';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** 빗줄기 기울기(도) — 바람 맞은 비의 결. */
const TILT_DEG = 12;
/** 빗줄기 개수 — 하늘 폭에 성기게 흩뿌리는 정도. */
const DROP_COUNT = 14;
/** 낙하 시간 범위(ms) — 줄기마다 달라야 위상이 계속 어긋나 패턴이 안 생긴다 (#418). */
const FALL_MIN_MS = 650;
const FALL_VAR_MS = 500;

/** 줄기 하나의 고정 특성 — 마운트 시 한 번 뽑는다. */
type DropSeed = {
  left: number;
  duration: number;
  delay: number;
  length: number;
  opacity: number;
};

function makeSeed(): DropSeed {
  return {
    left: Math.random() * 100,
    duration: FALL_MIN_MS + Math.random() * FALL_VAR_MS,
    delay: Math.random() * (FALL_MIN_MS + FALL_VAR_MS),
    length: 14 + Math.random() * 8,
    opacity: 0.35 + Math.random() * 0.25,
  };
}

function Drop({ heightSV }: { heightSV: SharedValue<number> }) {
  // 격자식 index 산식은 열·위상이 상관돼 "줄 맞춰 행진"하는 패턴을 만든다
  // (#418) — 줄기마다 난수 특성을 뽑고, 주기까지 다르게 해 산포를 유지한다.
  const seed = useRef<DropSeed | null>(null);
  seed.current ??= makeSeed();
  const { left, duration, delay, length, opacity } = seed.current;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1),
    );
  }, [delay, duration, progress]);

  // 가로 위치는 고정, 세로는 위(-15%)에서 아래(115%)로 순환.
  // translateY로 옮긴 이유 (#771): `top: %`는 매 프레임 Yoga 레이아웃을
  // 강제한다. 줄기 14개가 무한 루프라 비 오는 내내 그 비용이 깔린다 —
  // transform은 컴포지트만으로 끝난다.
  const style = useAnimatedStyle(() => ({
    // 기울기도 여기서 함께 준다 — 애니메이션 transform이 정적 transform을
    // 통째로 대체하므로, 정적 스타일에 두면 12° 기울기가 사라진다.
    transform: [
      { translateY: (-0.15 + progress.value * 1.3) * heightSV.value },
      { rotate: `${TILT_DEG}deg` },
    ],
    opacity: progress.value < 0.05 || progress.value > 0.95 ? 0 : opacity,
  }));
  return <Animated.View style={[styles.drop, { left: `${left}%`, height: length }, style]} />;
}

/**
 * 비 오는 날 빗줄기 오버레이 (#360) — 하늘 영역 absolute-fill, 터치 무시.
 * 줄기들은 UI 스레드 루프로만 움직여 리렌더가 없다.
 */
export function RainOverlay() {
  // 낙하 거리를 px로 알아야 translateY를 쓸 수 있다 — 레이아웃 1회로 잰다.
  const heightSV = useSharedValue(0);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        heightSV.value = e.nativeEvent.layout.height;
      }}
      testID="rain-overlay">
      {Array.from({ length: DROP_COUNT }, (_, i) => (
        <Drop key={i} heightSV={heightSV} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    // translateY가 여기서부터 밀어 내린다 (#771) — 기준점을 명시해 둔다.
    top: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: StaticWhite,
  },
});
