import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MarketOrder } from '@/api/market';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { MARKET_MAX_SUPPLY } from '@/constants/market';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MarketAmendSheetProps = {
  /** 고칠 주문 — null이면 닫혀 있다. */
  order: MarketOrder | null;
  submitting?: boolean;
  onSubmit?: (quantity: number) => void;
  onClose?: () => void;
};

/**
 * 판매 수량 바꾸기 (서버 #437) — 대기 중인 **발행 재고 판매 주문**의 전체 수량(팔린 수량 포함)을
 * 고친다. 이미 팔린 수량 이하로는 못 줄이고(서버 MARKET_AMEND_BELOW_FILLED), 상한은 발행 상한
 * (MARKET_MAX_SUPPLY). 남은 발행 재고 부족은 서버가 알려 준다.
 */
export function MarketAmendSheet({
  order,
  submitting = false,
  onSubmit,
  onClose,
}: MarketAmendSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [quantity, setQuantity] = useState(order?.quantity ?? 1);
  // 다른 주문을 열면 그 주문의 현재 수량에서 시작한다.
  useEffect(() => {
    if (order) setQuantity(order.quantity);
  }, [order]);

  const min = Math.max(1, (order?.filledQuantity ?? 0) + 1);
  const max = MARKET_MAX_SUPPLY;
  const changed = order != null && quantity !== order.quantity;
  const title = tr('market.orders.amendTitle');

  return (
    <BottomSheet
      visible={order != null}
      onClose={submitting ? undefined : onClose}
      dragEnabled={!submitting}
      accessibilityLabel={title}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <View style={styles.head}>
        <Text style={[Typography.h3, styles.flex, { color: t.text }]}>{title}</Text>
        <Pressable
          onPress={onClose}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={tr('market.order.closeA11y')}
          hitSlop={8}
          style={[styles.closeBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="close" size={14} color={t.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={[Typography.label, { color: t.text }]}>
          {order?.name}
        </Text>
        <View style={styles.row}>
          <Text style={[Typography.label, styles.flex, { color: t.text }]}>
            {tr('market.order.quantity')}
          </Text>
          <Pressable
            onPress={() => setQuantity((q) => Math.max(min, q - 1))}
            disabled={quantity <= min || submitting}
            accessibilityRole="button"
            accessibilityLabel={tr('market.orders.decrease')}
            accessibilityState={{ disabled: quantity <= min || submitting }}
            style={[styles.stepBtn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: quantity <= min ? t.textDisabled : t.text }]}>
              -
            </Text>
          </Pressable>
          <Text
            accessibilityLabel={tr('market.orders.quantityA11y', { n: quantity })}
            style={[Typography.label, styles.qty, { color: t.text }]}>
            {tr('market.order.quantityValue', { n: quantity })}
          </Text>
          <Pressable
            onPress={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max || submitting}
            accessibilityRole="button"
            accessibilityLabel={tr('market.orders.increase')}
            accessibilityState={{ disabled: quantity >= max || submitting }}
            style={[styles.stepBtn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: quantity >= max ? t.textDisabled : t.text }]}>
              +
            </Text>
          </Pressable>
        </View>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('market.orders.amendHint', { sold: order?.filledQuantity ?? 0 })}
        </Text>
        <Button
          label={tr('market.orders.amendSave')}
          onPress={() => {
            if (changed && !submitting) onSubmit?.(quantity);
          }}
          disabled={!changed || submitting}
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
  body: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: {
    width: Spacing.five + Spacing.two,
    height: Spacing.five + Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: Spacing.five + Spacing.two, textAlign: 'center' },
});
