import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type WalletPillsProps = {
  coin: number;
  dia: number;
};

/** Coin + dia balance chips, shown in currency-spending screens (가챠 / 꾸미기). */
export function WalletPills({ coin, dia }: WalletPillsProps) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <View
        style={[styles.pill, { backgroundColor: t.surfaceMuted }]}
        accessibilityLabel={`코인 ${coin}`}>
        <Icon name="coin" size={14} color={t.warning} />
        <Text style={[Typography.label, { color: t.text }]}>{coin.toLocaleString()}</Text>
      </View>
      <View
        style={[styles.pill, { backgroundColor: t.surfaceMuted }]}
        accessibilityLabel={`다이아 ${dia}`}>
        <Icon name="dia" size={14} color={t.primary} />
        <Text style={[Typography.label, { color: t.text }]}>{dia.toLocaleString()}</Text>
      </View>
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
