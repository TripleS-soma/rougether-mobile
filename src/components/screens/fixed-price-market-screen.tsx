import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MarketListing } from '@/api/market-shop';
import type { ReportReason } from '@/api/types';
import { MarketAssetImage } from '@/components/screens/market/market-asset-image';
import { parseOrderPrice } from '@/components/screens/market/economics';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { ReportSheet } from '@/components/ui/report-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type FixedPriceMarketScreenProps = {
  listings: MarketListing[];
  loading?: boolean;
  error?: boolean;
  hasNext?: boolean;
  loadingMore?: boolean;
  mine?: boolean;
  coinBalance?: number;
  diamondBalance?: number;
  onToggleMine?: () => void;
  onRefresh?: () => Promise<unknown>;
  onLoadMore?: () => void;
  onOpen?: (id: number) => void;
  onBack?: () => void;
};

export function FixedPriceMarketScreen(p: FixedPriceMarketScreenProps) {
  const t = useTokens(),
    font = useTypography(),
    tr = useT();
  const column = useResponsiveColumn(),
    inset = useHeaderContentInset(),
    screen = useScreenStyle([]);
  return (
    <View style={[styles.screen, screen]}>
      <ScreenHeader
        title={tr('market.screen.title')}
        onBack={p.onBack}
        right={<WalletPills coin={p.coinBalance ?? 0} diamond={p.diamondBalance ?? 0} compact />}
      />
      <PawRefreshScroll
        onRefresh={p.onRefresh}
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        <Button
          label={tr(p.mine ? 'market.screen.browse' : 'market.screen.manage')}
          variant="secondary"
          onPress={p.onToggleMine}
        />
        <Text style={[font.body, { color: t.textMuted }]}>{tr('market.shop.intro')}</Text>
        {p.loading ? <ActivityIndicator /> : null}
        {p.error ? (
          <Button label={tr('market.shop.retry')} onPress={() => void p.onRefresh?.()} />
        ) : null}
        {!p.loading && !p.error && !p.listings.length ? (
          <Text style={[font.body, { color: t.textMuted }]}>{tr('market.list.empty')}</Text>
        ) : null}
        {p.listings.map((item) => (
          <View key={item.assetId} style={[styles.card, { backgroundColor: t.surface }]}>
            <MarketAssetImage assetKey={item.assetKey} name={item.name} size={Spacing.six * 4} />
            <Text style={[font.h3, { color: t.text }]}>{item.name}</Text>
            <Text style={[font.supporting, { color: t.textMuted }]}>
              {tr('market.creator', { name: item.creatorNickname ?? tr('market.creatorUnknown') })}
            </Text>
            <Text style={[font.label, { color: t.text }]}>
              {item.price == null
                ? tr('market.shop.notListed')
                : tr('market.coins', { n: item.price })}
            </Text>
            <Button
              label={tr(
                item.isCreator
                  ? 'market.shop.manage'
                  : item.owned
                    ? 'market.shop.owned'
                    : 'market.shop.view',
              )}
              variant="secondary"
              onPress={() => p.onOpen?.(item.assetId)}
            />
          </View>
        ))}
        {p.hasNext ? (
          <Button label={tr('market.list.more')} onPress={p.onLoadMore} disabled={p.loadingMore} />
        ) : null}
      </PawRefreshScroll>
    </View>
  );
}

export type FixedPriceListingScreenProps = {
  listing: MarketListing | null;
  loading?: boolean;
  error?: boolean;
  actionError?: string | null;
  coinBalance: number;
  onRefresh?: () => Promise<unknown>;
  onBuy?: (price: number) => Promise<boolean>;
  onUpdate?: (price: number, selling: boolean) => Promise<boolean>;
  onReport?: (id: number, reason: ReportReason, detail?: string) => Promise<boolean>;
  onBack?: () => void;
};

export function FixedPriceListingScreen(p: FixedPriceListingScreenProps) {
  const t = useTokens(),
    font = useTypography(),
    tr = useT();
  const column = useResponsiveColumn(),
    inset = useHeaderContentInset(),
    screen = useScreenStyle([]);
  const [priceText, setPriceText] = useState('');
  const [confirmPrice, setConfirmPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false),
    [report, setReport] = useState(false);
  const inFlight = useRef(false);
  useEffect(
    () => setPriceText(p.listing?.price?.toString() ?? ''),
    [p.listing?.assetId, p.listing?.price],
  );
  const price = parseOrderPrice(priceText),
    item = p.listing;
  const run = async (work: () => Promise<boolean | undefined> | undefined) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={[styles.screen, screen]}>
      <ScreenHeader title={tr('market.asset.title')} onBack={p.onBack} />
      <PawRefreshScroll
        onRefresh={p.onRefresh}
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        {p.loading ? <ActivityIndicator /> : null}
        {p.error ? (
          <Button label={tr('market.shop.retry')} onPress={() => void p.onRefresh?.()} />
        ) : null}
        {p.actionError ? (
          <Text accessibilityRole="alert" style={[font.body, { color: t.danger }]}>
            {p.actionError}
          </Text>
        ) : null}
        {item ? (
          <>
            <MarketAssetImage assetKey={item.assetKey} name={item.name} size={Spacing.six * 8} />
            <Text style={[font.h2, { color: t.text }]}>{item.name}</Text>
            <Text style={[font.body, { color: t.textMuted }]}>
              {tr('market.creator', { name: item.creatorNickname ?? tr('market.creatorUnknown') })}
            </Text>
            {item.isCreator ? (
              <>
                <Text style={[font.body, { color: t.textMuted }]}>
                  {tr('market.shop.originalKept')}
                </Text>
                <TextInput
                  value={priceText}
                  onChangeText={(v) => setPriceText(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!busy}
                  accessibilityLabel={tr('market.order.price')}
                  placeholder={tr('market.order.pricePlaceholder')}
                  placeholderTextColor={t.textMuted}
                  style={[font.h3, styles.input, { color: t.text, borderColor: t.border }]}
                />
                <Text style={[font.supporting, { color: t.textMuted }]}>
                  {tr('market.shop.fee')}
                </Text>
                <Button
                  label={tr('market.shop.savePrice')}
                  onPress={() => {
                    if (price != null) void run(() => p.onUpdate?.(price, true));
                  }}
                  disabled={busy || price == null}
                />
                {item.selling && item.price != null ? (
                  <Button
                    label={tr('market.shop.stop')}
                    variant="secondary"
                    onPress={() => void run(() => p.onUpdate?.(item.price!, false))}
                    disabled={busy}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Text style={[font.h3, { color: t.text }]}>
                  {item.price == null
                    ? tr('market.shop.notListed')
                    : tr('market.coins', { n: item.price })}
                </Text>
                <Text style={[font.body, { color: t.textMuted }]}>
                  {tr('market.shop.purchaseNote')}
                </Text>
                <Button
                  label={tr(
                    item.owned
                      ? 'market.shop.owned'
                      : !item.selling
                        ? 'market.shop.notListed'
                        : 'market.shop.buy',
                    { n: item.price ?? 0 },
                  )}
                  disabled={
                    busy ||
                    item.owned ||
                    !item.selling ||
                    item.price == null ||
                    p.coinBalance < item.price
                  }
                  onPress={() => setConfirmPrice(item.price)}
                />
                {item.price != null && p.coinBalance < item.price && !item.owned ? (
                  <Text style={[font.supporting, { color: t.danger }]}>
                    {tr('market.order.notEnough')}
                  </Text>
                ) : null}
              </>
            )}
            {p.onReport ? (
              <Button
                label={tr('market.asset.report')}
                variant="secondary"
                onPress={() => setReport(true)}
              />
            ) : null}
          </>
        ) : null}
      </PawRefreshScroll>
      <ConfirmDialog
        visible={confirmPrice != null}
        title={tr('market.shop.confirmTitle')}
        body={tr('market.shop.confirmBody', { n: confirmPrice ?? 0 })}
        confirmLabel={tr(busy ? 'market.shop.buying' : 'market.shop.confirmBuy')}
        cancelLabel={tr('market.shop.cancel')}
        onConfirm={() => {
          if (confirmPrice != null)
            void run(async () => {
              const ok = await p.onBuy?.(confirmPrice);
              setConfirmPrice(null);
              return ok;
            });
        }}
        onCancel={() => {
          if (!inFlight.current) setConfirmPrice(null);
        }}
      />
      {p.onReport && item ? (
        <ReportSheet
          visible={report}
          targetLabel={tr('member.moderation.target.asset')}
          submitting={busy}
          onClose={() => {
            if (!inFlight.current) setReport(false);
          }}
          onSubmit={(reason, detail) =>
            void run(async () => {
              const ok = await p.onReport?.(item.assetId, reason, detail);
              if (ok) setReport(false);
              return ok;
            })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  card: { padding: Spacing.four, borderRadius: Radius.lg, gap: Spacing.two },
  input: { padding: Spacing.three, borderWidth: 1, borderRadius: Radius.md },
});
