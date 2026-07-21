import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** 빗줄기 개수 — 하늘 폭에 성기게 흩뿌리는 정도. */
const DROP_COUNT = 14;
/** 한 줄기가 하늘을 통과하는 시간(ms). */
const FALL_MS = 900;

function Drop({ index }: { index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      // 줄기마다 어긋난 시작 — 규칙적으로 보이지 않게 소수 배수 지그재그.
      (index * 137) % FALL_MS,
      withRepeat(withTiming(1, { duration: FALL_MS, easing: Easing.linear }), -1),
    );
  }, [index, progress]);

  // 가로 위치는 고정 분산, 세로는 위(-15%)에서 아래(115%)로 순환.
  const left = `${(index * 61) % 100}%` as const;
  const style = useAnimatedStyle(() => ({
    top: `${-15 + progress.value * 130}%`,
    opacity: progress.value < 0.05 || progress.value > 0.95 ? 0 : 0.5,
  }));
  return <Animated.View style={[styles.drop, { left }, style]} />;
}

/**
 * 비 오는 날 빗줄기 오버레이 (#360) — 하늘 영역 absolute-fill, 터치 무시.
 * 줄기들은 UI 스레드 루프로만 움직여 리렌더가 없다.
 */
export function RainOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="rain-overlay">
      {Array.from({ length: DROP_COUNT }, (_, i) => (
        <Drop key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '12deg' }],
  },
});
