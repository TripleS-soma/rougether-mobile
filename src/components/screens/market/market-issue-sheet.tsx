import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { parseOrderPrice } from '@/components/screens/market/economics';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MarketIssueSheetProps = {
  visible: boolean;
  submitting?: boolean;
  onSubmit?: (price: number) => void;
  onClose: () => void;
};

/** 제작자는 원본을 보관하고 판매 가격만 정함. */
export function MarketIssueSheet({
  visible,
  submitting = false,
  onSubmit,
  onClose,
}: MarketIssueSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [priceText, setPriceText] = useState('');
  const price = parseOrderPrice(priceText);
  useEffect(() => {
    if (visible) setPriceText('');
  }, [visible]);

  return (
    <BottomSheet
      visible={visible}
      avoidKeyboard
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
        <Text style={[Typography.label, { color: t.text }]}>{tr('market.order.price')}</Text>
        <TextInput
          value={priceText}
          onChangeText={(value) => setPriceText(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={4}
          editable={!submitting}
          accessibilityLabel={tr('market.order.price')}
          placeholder={tr('market.order.pricePlaceholder')}
          placeholderTextColor={t.textMuted}
          style={[Typography.h3, { color: t.text, padding: Spacing.three }]}
        />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('market.issue.body')}
        </Text>
        <Button
          label={
            submitting
              ? tr('market.issue.submitting')
              : tr('market.issue.submit', { n: price ?? 0 })
          }
          onPress={() => {
            if (price != null) onSubmit?.(price);
          }}
          disabled={submitting || price == null}
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
    borderCurve: 'continuous',
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
