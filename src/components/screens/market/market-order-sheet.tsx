import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MarketAsset } from '@/api/market';
import type { MarketSide, MarketSource } from '@/api/types';
import {
  defaultOrderPrice,
  expectedProceeds,
  isRoyaltyFree,
  parseOrderPrice,
} from '@/components/screens/market/economics';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { MARKET_MAX_SUPPLY, MARKET_PRICE_MAX } from '@/constants/market';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MarketOrderDraft = { side: MarketSide; source?: MarketSource };

export type MarketOrderSheetProps = {
  visible: boolean;
  draft: MarketOrderDraft | null;
  asset: Pick<
    MarketAsset,
    'bestAskPrice' | 'lastTradePrice' | 'isCreator' | 'creatorNickname' | 'unissuedQuantity'
  >;
  coinBalance?: number;
  submitting?: boolean;
  onSubmit?: (order: { price: number; quantity: number }) => void;
  onClose: () => void;
};

/**
 * 주문 시트 (#1427) — 지정가 자유 입력(1~1,000 정수). 구매는 보유 코인·주문 금액과
 * "더 높게 걸면 차액 환불" 안내, 판매는 예상 수령액(로열티·수수료 각각 내림)과 판매 중
 * 인벤토리·방에서 빠진다는 경고. 수량은 발행 재고 판매만 1~min(10, 남은 재고).
 */
export function MarketOrderSheet({
  visible,
  draft,
  asset,
  coinBalance = 0,
  submitting = false,
  onSubmit,
  onClose,
}: MarketOrderSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const side = draft?.side ?? 'BUY';
  const issuance = side === 'SELL' && draft?.source === 'ISSUANCE';
  const maxQuantity = issuance
    ? Math.max(1, Math.min(MARKET_MAX_SUPPLY, asset.unissuedQuantity))
    : 1;

  const [priceText, setPriceText] = useState('');
  const [quantity, setQuantity] = useState(1);
  // 열릴 때마다 초깃값 — 구매는 최저 판매가, 판매는 최근 체결가(없으면 빈칸).
  useEffect(() => {
    if (!visible || !draft) return;
    const initial = defaultOrderPrice(draft.side, asset);
    setPriceText(initial != null ? String(initial) : '');
    setQuantity(1);
    // asset은 열린 동안 바뀌어도 사용자가 친 값을 덮지 않는다 — 열림·방향만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draft]);

  const price = parseOrderPrice(priceText);
  const invalid = priceText.length > 0 && price == null;
  const total = (price ?? 0) * quantity;
  const notEnough = side === 'BUY' && price != null && total > coinBalance;
  const royaltyFree = isRoyaltyFree(asset);
  const proceeds = price != null ? expectedProceeds({ price, quantity, royaltyFree }) : null;
  const canSubmit = price != null && !notEnough && !submitting;

  const title = tr(
    side === 'BUY'
      ? 'market.order.buyTitle'
      : issuance
        ? 'market.order.issuanceTitle'
        : 'market.order.sellTitle',
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? undefined : onClose}
      dragEnabled={!submitting}
      avoidKeyboard
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
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('market.order.price')}
        </Text>
        <TextInput
          value={priceText}
          onChangeText={(v) => setPriceText(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={String(MARKET_PRICE_MAX).length}
          placeholder={tr('market.order.pricePlaceholder')}
          placeholderTextColor={t.textDisabled}
          accessibilityLabel={tr('market.order.price')}
          editable={!submitting}
          style={[
            Typography.h3,
            styles.input,
            {
              color: t.text,
              backgroundColor: t.surface,
              borderColor: invalid ? t.danger : t.border,
            },
          ]}
        />
        {invalid ? (
          <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.danger }]}>
            {tr('market.order.priceInvalid')}
          </Text>
        ) : null}

        {issuance ? (
          <View style={styles.row}>
            <Text style={[Typography.label, styles.flex, { color: t.text }]}>
              {tr('market.order.quantity')}
            </Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || submitting}
              accessibilityRole="button"
              accessibilityLabel={tr('market.order.decreaseA11y')}
              accessibilityState={{ disabled: quantity <= 1 || submitting }}
              style={[styles.stepBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: quantity <= 1 ? t.textDisabled : t.text }]}>
                −
              </Text>
            </Pressable>
            <Text style={[Typography.label, styles.qty, { color: t.text }]}>
              {tr('market.order.quantityValue', { n: quantity })}
            </Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity || submitting}
              accessibilityRole="button"
              accessibilityLabel={tr('market.order.increaseA11y')}
              accessibilityState={{ disabled: quantity >= maxQuantity || submitting }}
              style={[styles.stepBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text
                style={[
                  Typography.label,
                  { color: quantity >= maxQuantity ? t.textDisabled : t.text },
                ]}>
                +
              </Text>
            </Pressable>
          </View>
        ) : null}

        {side === 'BUY' ? (
          <View style={[styles.box, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('market.order.balance', { n: coinBalance })}
            </Text>
            {price != null ? (
              <Text style={[Typography.supporting, { color: notEnough ? t.danger : t.textMuted }]}>
                {notEnough ? tr('market.order.notEnough') : tr('market.order.total', { n: total })}
              </Text>
            ) : null}
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('market.order.buyNote')}
            </Text>
          </View>
        ) : (
          <View style={[styles.box, { backgroundColor: t.surfaceMuted }]}>
            <View style={styles.row}>
              <Text style={[Typography.label, styles.flex, { color: t.text }]}>
                {tr('market.order.proceeds')}
              </Text>
              <Text style={[Typography.label, { color: t.primaryText }]}>
                {proceeds != null ? tr('market.coins', { n: proceeds }) : '-'}
              </Text>
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr(royaltyFree ? 'market.order.proceedsNoteNoRoyalty' : 'market.order.proceedsNote')}
            </Text>
            {!issuance ? (
              <Text style={[Typography.supporting, { color: t.warningText }]}>
                {tr('market.order.sellWarning')}
              </Text>
            ) : null}
          </View>
        )}

        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('market.order.expiryNote')}
        </Text>

        <Button
          label={
            submitting
              ? tr('market.order.submitting')
              : tr(side === 'BUY' ? 'market.order.submitBuy' : 'market.order.submitSell')
          }
          onPress={() => {
            if (price != null && canSubmit) onSubmit?.({ price, quantity });
          }}
          disabled={!canSubmit}
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
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: {
    width: Spacing.five + Spacing.two,
    height: Spacing.five + Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: Spacing.five + Spacing.two, textAlign: 'center' },
  box: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.one },
});
