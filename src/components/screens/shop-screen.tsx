import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { ACCESSORY_ITEMS } from '@/resources/accessories';
import { FURNITURE_ITEMS } from '@/resources/furniture';

type Tab = 'deco' | 'accessory';

export type ShopScreenProps = {
  /** Dia balance (character accessories are gacha-only; deco items cost dia). */
  diaBalance?: number;
  /** Owned furniture ids (room-decoration tab). */
  ownedItemIds?: string[];
  /** Owned accessory ids (gacha-obtained). */
  ownedAccessoryIds?: string[];
  /** Buy a deco item with dia. */
  onBuy?: (itemId: string) => void;
  onBack?: () => void;
};

/**
 * Shop, ported to the spec's model: two tabs — 방 꾸미기 (surface items bought
 * with 다이아) and 캐릭터 악세서리 (gacha-only, display/owned status). Buying a deco
 * item deducts dia and adds it to the inventory (the decor screen then places
 * it). Pure/prop-driven; the app shell owns the wallet + inventory.
 */
export function ShopScreen({
  diaBalance = 0,
  ownedItemIds = [],
  ownedAccessoryIds = [],
  onBuy,
  onBack,
}: ShopScreenProps) {
  const t = useTokens();
  const [tab, setTab] = useState<Tab>('deco');

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader
        title="상점"
        onBack={onBack}
        right={
          <View style={[styles.diaPill, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="dia" size={14} color={t.primary} />
            <Text style={[Typography.label, { color: t.text }]}>{diaBalance.toLocaleString()}</Text>
          </View>
        }
      />

      <View style={styles.tabs}>
        {(
          [
            ['deco', '방 꾸미기'],
            ['accessory', '캐릭터 악세서리'],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, { backgroundColor: active ? t.primary : t.surface }]}>
              <Text style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'deco' ? (
          <View style={styles.grid}>
            {FURNITURE_ITEMS.map((item) => {
              const owned = ownedItemIds.includes(item.id);
              const affordable = diaBalance >= item.price;
              return (
                <View key={item.id} style={[styles.tile, { backgroundColor: t.surface }]}>
                  <View style={styles.thumbWrap}>
                    <FurniturePlaceholder item={item} showName={false} />
                  </View>
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.priceRow}>
                    <Icon name="dia" size={12} color={t.primary} />
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {item.price}
                    </Text>
                  </View>
                  {owned ? (
                    <View style={[styles.buy, { backgroundColor: t.surfaceMuted }]}>
                      <Text style={[Typography.label, { color: t.textMuted }]}>보유중</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => affordable && onBuy?.(item.id)}
                      disabled={!affordable}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} 구매`}
                      style={[
                        styles.buy,
                        { backgroundColor: affordable ? t.primary : t.surfaceMuted },
                      ]}>
                      <Text
                        style={[
                          Typography.label,
                          { color: affordable ? t.onPrimary : t.textMuted },
                        ]}>
                        {affordable ? '구매' : '다이아 부족'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <>
            <Text style={[Typography.supporting, styles.note, { color: t.textMuted }]}>
              캐릭터 악세서리는 뽑기로만 얻을 수 있어요.
            </Text>
            <View style={styles.grid}>
              {ACCESSORY_ITEMS.map((acc) => {
                const owned = ownedAccessoryIds.includes(acc.id);
                return (
                  <View
                    key={acc.id}
                    accessibilityLabel={acc.name}
                    style={[styles.tile, { backgroundColor: t.surface }]}>
                    <View style={[styles.thumbWrap, { backgroundColor: t.surfaceMuted }]}>
                      <Text style={styles.accEmoji}>{acc.emoji}</Text>
                    </View>
                    <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>{acc.slot}</Text>
                    <View style={[styles.buy, { backgroundColor: t.surfaceMuted }]}>
                      <Text style={[Typography.label, { color: owned ? t.primary : t.textMuted }]}>
                        {owned ? '보유중' : '가챠 전용'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  diaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  body: {
    padding: Spacing.three,
  },
  note: {
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accEmoji: {
    fontSize: 44,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  buy: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
});
