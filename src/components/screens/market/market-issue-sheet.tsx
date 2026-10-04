import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { MARKET_MAX_SUPPLY } from '@/constants/market';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const SUPPLY_CHOICES = Array.from({ length: MARKET_MAX_SUPPLY }, (_, i) => i + 1);

export type MarketIssueSheetProps = {
  visible: boolean;
  submitting?: boolean;
  onSubmit?: (totalSupply: number) => void;
  onClose: () => void;
};

/**
 * 거래소에 올리기 (#1427) — 발행 수량 1~10(내 보유분 1개 포함). 한 번 올리면 추가 발행도,
 * 가구 재검수도 안 된다는 걸 누르기 전에 알린다.
 */
export function MarketIssueSheet({
  visible,
  submitting = false,
  onSubmit,
  onClose,
}: MarketIssueSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [supply, setSupply] = useState(1);
  useEffect(() => {
    if (visible) setSupply(1);
  }, [visible]);

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? undefined : onClose}
      dragEnabled={!submitting}
      accessibilityLabel={tr('market.issue.title')}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <View style={styles.head}>
        <Text style={[Typography.h3, styles.flex, { color: t.text }]}>
          {tr('market.issue.title')}
        </Text>
        <Pressable
          onPress={onClose}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={tr('market.issue.closeA11y')}
          hitSlop={8}
          style={[styles.closeBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="close" size={14} color={t.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={[Typography.label, { color: t.text }]}>{tr('market.issue.supply')}</Text>
        <View style={styles.choices}>
          {SUPPLY_CHOICES.map((n) => {
            const active = n === supply;
            return (
              <Pressable
                key={n}
                onPress={() => setSupply(n)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={tr('market.order.quantityValue', { n })}
                accessibilityState={{ selected: active }}
                style={[styles.choice, { backgroundColor: active ? t.primary : t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: active ? t.onPrimary : t.text }]}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('market.issue.body')}
        </Text>
        <Button
          label={
            submitting ? tr('market.issue.submitting') : tr('market.issue.submit', { n: supply })
          }
          onPress={() => onSubmit?.(supply)}
          disabled={submitting}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  closeBtn: { padding: Spacing.two, borderRadius: Radius.pill },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: {
    width: Spacing.five + Spacing.two,
    height: Spacing.five + Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
