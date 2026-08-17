import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type AttendanceDayCellProps = {
  day: number;
  coinAmount: number;
  /** 이 일차에 보상 가구가 걸려 있는지 (마지막 날). */
  furnitureReward: boolean;
  /** 현재 연속 출석이 이 일차에 도달했는지 — 도장 찍힌 상태. */
  claimed: boolean;
  /** 기본 코인보다 많이 주는 날 — 보너스 표시. */
  bonus: boolean;
  /**
   * 방금 이 칸에 출석했는지 (#851). true가 되는 순간 도장 연출을 재생한다.
   * 최종 모습은 `claimed`가 그리므로, 연출을 걸러도 화면은 맞는 상태다 —
   * 연타·재진입으로 연출이 끊겨도 칸이 어긋나지 않는다.
   */
  stampNow?: boolean;
};

/**
 * 출석부 한 칸 (#851) — 도장 찍힌 날은 채워진 원, 아직인 날은 빈 원.
 * 마지막 날은 선물 아이콘, 보너스 날은 코인 액수를 강조한다.
 */
export function AttendanceDayCell({
  day,
  coinAmount,
  furnitureReward,
  claimed,
  bonus,
  stampNow,
}: AttendanceDayCellProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 도장 진입값 — 0이면 아직 안 찍힌 자리에서 시작, 1이면 제자리.
  const stamp = useAnimatedValue(stampNow ? 0 : 1);

  useEffect(() => {
    if (!stampNow) return;
    stamp.setValue(0);
    Animated.timing(stamp, {
      toValue: 1,
      duration: 250,
      // 위에서 내리찍고 살짝 튕긴다 — back easing이 도장의 물리감을 준다.
      easing: Easing.out(Easing.back(2.2)),
      useNativeDriver: true,
    }).start();
  }, [stampNow, stamp]);

  const filled = claimed;
  return (
    <View style={styles.cell}>
      <Animated.View
        style={[
          styles.mark,
          {
            backgroundColor: filled ? t.primary : t.surfaceMuted,
            borderColor: bonus || furnitureReward ? t.warning : 'transparent',
            borderWidth: bonus || furnitureReward ? 2 : 0,
            transform: [
              // 1.35 → 1: 위에서 내려찍히는 크기 변화.
              { scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] }) },
              {
                rotate: stamp.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-14deg', '0deg'],
                }),
              },
            ],
            opacity: stamp.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
          },
        ]}>
        {furnitureReward ? (
          <Icon name="gift" size={16} color={filled ? StaticWhite : t.textMuted} />
        ) : filled ? (
          <Icon name="check" size={16} color={StaticWhite} />
        ) : (
          <Text style={[Typography.supporting, { color: t.textMuted }]}>{day}</Text>
        )}
      </Animated.View>
      <Text
        style={[
          Typography.supporting,
          styles.coin,
          bonus ? emph('semibold') : emph('normal'),
          { color: bonus ? t.warningText : t.textMuted },
        ]}>
        {coinAmount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', gap: Spacing.half, width: 44 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: { textAlign: 'center' },
});
