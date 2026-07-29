import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type WalletPillsProps = {
  coin: number;
  diamond: number;
  /**
   * 좁은 폰 헤더용 (#425) — 코인 필 하나만 작은 활자·좁은 패딩으로 그린다.
   * 다이아는 뽑기 상점·꾸미기 진입 시 전체 필에서 보인다.
   */
  compact?: boolean;
};

/** Balances above four digits render capped ("9999+"); a tap reveals the truth. */
const CAP = 9999;

/** 잔액 변동을 550ms 카운트 롤링으로 보여준다 (#452). */
function useRollingNumber(value: number) {
  const [display, setDisplay] = useState(value);
  const anim = useRef(new Animated.Value(0)).current;
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    fromRef.current = value;
    anim.setValue(0);
    const id = anim.addListener(({ value: p }) =>
      setDisplay(Math.round(from + (value - from) * p)),
    );
    Animated.timing(anim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      anim.removeListener(id);
      setDisplay(value);
    });
    return () => anim.removeListener(id);
  }, [value, anim]);
  return display;
}

function Pill({
  icon,
  color,
  label,
  value,
  compact,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
  compact?: boolean;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const [revealed, setRevealed] = useState(false);
  const rolled = useRollingNumber(value);
  const overCap = rolled > CAP;
  const shown = overCap && !revealed ? `${CAP}+` : rolled.toLocaleString();
  return (
    <Pressable
      onPress={() => setRevealed((v) => !v)}
      disabled={!overCap}
      accessibilityRole="button"
      // Screen readers always get the real balance — the cap is visual only.
      accessibilityLabel={`${label} ${value}`}
      style={[styles.pill, compact && styles.pillCompact, { backgroundColor: t.surfaceMuted }]}>
      <Icon name={icon} size={compact ? 12 : 14} color={color} />
      <Text style={[compact ? Typography.supporting : Typography.label, { color: t.text }]}>
        {shown}
      </Text>
    </Pressable>
  );
}

/** Coin + diamond balance chips, shown in currency-spending screens (가챠 / 꾸미기). */
export function WalletPills({ coin, diamond, compact = false }: WalletPillsProps) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <Pill icon="coin" color={t.warning} label="코인" value={coin} compact={compact} />
      {compact ? null : <Pill icon="diamond" color={t.primary} label="다이아" value={diamond} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  pillCompact: {
    paddingHorizontal: Spacing.one + Spacing.half,
  },
});
