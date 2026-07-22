import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type WalletPillsProps = {
  coin: number;
  dia: number;
};

/** Balances above four digits render capped ("9999+"); a tap reveals the truth. */
const CAP = 9999;

function Pill({
  icon,
  color,
  label,
  value,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const [revealed, setRevealed] = useState(false);
  const overCap = value > CAP;
  const shown = overCap && !revealed ? `${CAP}+` : value.toLocaleString();
  return (
    <Pressable
      onPress={() => setRevealed((v) => !v)}
      disabled={!overCap}
      accessibilityRole="button"
      // Screen readers always get the real balance — the cap is visual only.
      accessibilityLabel={`${label} ${value}`}
      style={[styles.pill, { backgroundColor: t.surfaceMuted }]}>
      <Icon name={icon} size={14} color={color} />
      <Text style={[Typography.label, { color: t.text }]}>{shown}</Text>
    </Pressable>
  );
}

/** Coin + dia balance chips, shown in currency-spending screens (가챠 / 꾸미기). */
export function WalletPills({ coin, dia }: WalletPillsProps) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <Pill icon="coin" color={t.warning} label="코인" value={coin} />
      <Pill icon="dia" color={t.primary} label="다이아" value={dia} />
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
});
