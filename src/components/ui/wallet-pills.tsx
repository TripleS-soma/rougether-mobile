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
  /**
   * 재화 내역 열기 (#734) — 배선되면 필 탭이 내역 시트를 연다. 내역엔 정확한
   * 잔액이 그대로 보이므로 기존 9999+ 캡 공개 탭은 이 경로로 흡수된다.
   */
  onOpenHistory?: () => void;
};

/** Balances above four digits render capped ("9999+"); a tap reveals the truth. */
const CAP = 9999;

/**
 * JS의 -0을 0으로 (#714) — `Math.round(-0.2)`도, JSON "-0" 파싱값도 -0이고
 * `(-0).toLocaleString()`은 "-0"으로 찍힌다. 잔액이 음수에서 0으로 돌아오는
 * 롤링·prop 유입 어느 경로든 표시 전에 여기서 눌러 편다.
 */
const noNegativeZero = (n: number) => (n === 0 ? 0 : n);

/**
 * 잔액 변동을 550ms 카운트 롤링으로 보여준다 (#452). 리스너는 매 프레임
 * 불리지만 setState는 표시값이 실제로 바뀔 때 + ~80ms 간격으로만 — 리렌더
 * 수를 프레임 수(~33회)에서 스텝 수(≤7회)로 줄인다 (#690).
 */
function useRollingNumber(value: number) {
  const [display, setDisplay] = useState(value);
  const anim = useRef(new Animated.Value(0)).current;
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    fromRef.current = value;
    anim.setValue(0);
    let shown = from;
    let shownAt = 0;
    const id = anim.addListener(({ value: p }) => {
      const now = Date.now();
      if (now - shownAt < 80) return;
      const next = noNegativeZero(Math.round(from + (value - from) * p));
      if (next === shown) return;
      shown = next;
      shownAt = now;
      setDisplay(next);
    });
    Animated.timing(anim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // 550ms 내 재변동으로 중단되면 새 이펙트가 이어받는다 — 이전 목표값을
      // 강제 표시하지 않는다 (#696). 리스너는 이펙트 클린업이 해제한다.
      if (!finished) return;
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
  onOpenHistory,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
  compact?: boolean;
  onOpenHistory?: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const [revealed, setRevealed] = useState(false);
  // prop 자체가 -0으로 오면 롤링이 아예 안 돌아(-0 === 0) 영구 표기된다 (#714).
  const safeValue = noNegativeZero(value);
  const rolled = useRollingNumber(safeValue);
  const overCap = rolled > CAP;
  const shown = overCap && !revealed ? `${CAP}+` : rolled.toLocaleString();
  return (
    <Pressable
      onPress={onOpenHistory ?? (() => setRevealed((v) => !v))}
      disabled={!onOpenHistory && !overCap}
      accessibilityRole="button"
      // Screen readers always get the real balance — the cap is visual only.
      accessibilityLabel={`${label} ${safeValue}`}
      style={[styles.pill, compact && styles.pillCompact, { backgroundColor: t.surfaceMuted }]}>
      <Icon name={icon} size={compact ? 12 : 14} color={color} />
      <Text style={[compact ? Typography.supporting : Typography.label, { color: t.text }]}>
        {shown}
      </Text>
    </Pressable>
  );
}

/** Coin + diamond balance chips, shown in currency-spending screens (가챠 / 꾸미기). */
export function WalletPills({ coin, diamond, compact = false, onOpenHistory }: WalletPillsProps) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <Pill
        icon="coin"
        color={t.warning}
        label="코인"
        value={coin}
        compact={compact}
        onOpenHistory={onOpenHistory}
      />
      {compact ? null : (
        <Pill
          icon="diamond"
          color={t.primary}
          label="다이아"
          value={diamond}
          onOpenHistory={onOpenHistory}
        />
      )}
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
