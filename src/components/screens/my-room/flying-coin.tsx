import { useEffect } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTokens } from '@/hooks/use-tokens';
import { useAnimatedValue } from '@/hooks/use-stable-value';

/** 완료 탭 지점에서 지갑까지 포물선으로 나는 코인 (#440). */
export function FlyingCoin({
  x,
  y,
  tx,
  ty,
  onDone,
}: {
  x: number;
  y: number;
  tx: number;
  ty: number;
  onDone: () => void;
}) {
  const t = useTokens();
  const p = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 550,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회 발사
  }, []);
  // 정점은 출발·도착 중 높은 쪽보다 70px 위 — 포물선 궤적.
  const apexY = Math.min(y, ty) - 70;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyCoin,
        {
          opacity: p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [x, tx] }) },
            {
              translateY: p.interpolate({ inputRange: [0, 0.45, 1], outputRange: [y, apexY, ty] }),
            },
            { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
          ],
        },
      ]}>
      <Icon name="coin" size={18} color={t.warning} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flyCoin: {
    position: 'absolute',
    left: -9,
    top: -9,
  },
});
