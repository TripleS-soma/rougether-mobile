import { useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useAnimatedValue } from '@/hooks/use-stable-value';

/** 접속 점 — 은은한 숨쉬기 펄스 (#450). house-screen.tsx에서 분리 (#693). */
export function OnlineDot({ color }: { color: string }) {
  const pulse = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      testID="online-dot"
      style={[
        styles.onlineDot,
        {
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
