import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Room } from '@/components/room/room';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

const ALL = '전체';
const WALLPAPER = '벽지';

export type RoomDecorScreenProps = {
  /** Furniture ids placed when the screen opens. */
  initialPlacedIds?: string[];
  initialWallpaperId?: string;
  /** Ids the user owns; owned items are placeable, the rest are buyable with dia. */
  ownedIds?: string[];
  /** Item + wallpaper catalogue (defaults to the local set). */
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  /** True while the catalogue is loading from the API. */
  loading?: boolean;
  /** True when the catalogue failed to load (shows an error + 다시 시도). */
  loadError?: boolean;
  /** Re-run the failed catalogue load. */
  onRetry?: () => void;
  /** Coin + dia balances shown in the header. */
  coinBalance?: number;
  /** Dia balance, for buying not-yet-owned items in the catalog. */
  diaBalance?: number;
  characterId?: CharacterId;
  onBack?: () => void;
  /** Buy a not-yet-owned catalog item with dia. */
  onBuy?: (itemId: string) => void;
  /** Commit the current selection. */
  onApply?: (placedIds: string[], wallpaperId: string) => void;
};

/**
 * Room decoration screen, ported from the prototype `RoomDecorScreen`: live
 * <Room /> preview, category tabs, wallpaper + furniture catalogs, and an apply
 * bar. The catalog doubles as the shop — owned items are placed (one item per
 * slot; a new item replaces its slot), not-yet-owned items are bought with 다이아
 * and then become placeable. Selection state is local; `onApply` commits it.
 * Spec domain: rougether-spec domains/room + shop.
 */
export function RoomDecorScreen({
  initialPlacedIds,
  initialWallpaperId = DEFAULT_WALLPAPER_ID,
  ownedIds,
  furniture = FURNITURE_ITEMS,
  wallpapers = WALLPAPERS,
  loading = false,
  loadError = false,
  onRetry,
  coinBalance = 0,
  diaBalance = 0,
  characterId = DEFAULT_CHARACTER_ID,
  onBack,
  onBuy,
  onApply,
}: RoomDecorScreenProps) {
  const t = useTokens();

  // Owned items are placeable; everything else in the catalog is buyable.
  const owned = useMemo(
    () => new Set(ownedIds ?? furniture.map((i) => i.id)),
    [ownedIds, furniture],
  );
  // Filter tabs: themes (item sets) when the whole catalogue carries them —
  // the natural shopping unit for the API's 150+ items. The local fallback set
  // is only partially themed, so it keeps the item-type category tabs.
  const themes = useMemo(() => {
    if (furniture.length === 0 || !furniture.every((i) => i.theme)) return [];
    const set = new Set<string>();
    furniture.forEach((i) => i.theme && set.add(i.theme));
    wallpapers.forEach((w) => w.theme && set.add(w.theme));
    return Array.from(set);
  }, [furniture, wallpapers]);
  const categories = useMemo(
    () => [
      ALL,
      WALLPAPER,
      ...(themes.length > 0 ? themes : Array.from(new Set(furniture.map((i) => i.category)))),
    ],
    [themes, furniture],
  );

  const [placed, setPlaced] = useState<string[]>(
    () => initialPlacedIds ?? ['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'],
  );
  const [wallpaperId, setWallpaperId] = useState(initialWallpaperId);
  const [activeCategory, setActiveCategory] = useState(ALL);

  const slotOf = (id: string) => furniture.find((i) => i.id === id)?.slot;

  const toggle = (id: string) => {
    setPlaced((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      const slot = slotOf(id);
      // One item per slot: drop whatever shares this slot, then add.
      return [...prev.filter((p) => slotOf(p) !== slot), id];
    });
  };

  const isThemeTab = themes.includes(activeCategory);
  const visibleWallpapers = isThemeTab
    ? wallpapers.filter((w) => w.theme === activeCategory)
    : wallpapers;
  const showWallpapers =
    activeCategory === ALL ||
    activeCategory === WALLPAPER ||
    (isThemeTab && visibleWallpapers.length > 0);
  const visibleItems =
    activeCategory === ALL
      ? furniture
      : activeCategory === WALLPAPER
        ? []
        : isThemeTab
          ? furniture.filter((i) => i.theme === activeCategory)
          : furniture.filter((i) => i.category === activeCategory);

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[Typography.h2, styles.flex, { color: t.text }]}>나의 방 꾸미기</Text>
        <WalletPills coin={coinBalance} dia={diaBalance} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.preview}>
          <Room
            characterId={characterId}
            wallpaperId={wallpaperId}
            placedFurnitureIds={placed}
            furniture={furniture}
            wallpapers={wallpapers}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}>
          {categories.map((cat) => {
            const active = cat === activeCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tab, { backgroundColor: active ? t.primary : t.surface }]}>
                <Text style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={t.primary} />
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              카탈로그 불러오는 중…
            </Text>
          </View>
        ) : null}

        {!loading && loadError ? (
          <View style={styles.loadingBlock}>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              카탈로그를 불러오지 못했어요.
            </Text>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={[styles.retryBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !loadError && showWallpapers ? (
          <View style={styles.catalog}>
            <Text style={[Typography.label, styles.catalogTitle, { color: t.textMuted }]}>
              벽지
            </Text>
            <View style={styles.grid}>
              {visibleWallpapers.map((wp) => {
                const active = wp.id === wallpaperId;
                return (
                  <Pressable
                    key={wp.id}
                    onPress={() => setWallpaperId(wp.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={wp.name}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: t.surface,
                        borderColor: active ? t.primary : 'transparent',
                      },
                    ]}>
                    <View style={[styles.swatch, { backgroundColor: wp.color }]} />
                    <Text style={[styles.tileName, { color: t.text }]} numberOfLines={2}>
                      {wp.name}
                    </Text>
                    <Text style={[styles.tilePrice, { color: t.textMuted }]}>✨ {wp.price}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {!loading && !loadError && visibleItems.length > 0 ? (
          <View style={styles.catalog}>
            {showWallpapers ? (
              <Text style={[Typography.label, styles.catalogTitle, { color: t.textMuted }]}>
                가구 · 소품
              </Text>
            ) : null}
            <View style={styles.grid}>
              {visibleItems.map((item: FurnitureItem) => {
                const isOwned = owned.has(item.id);
                const placedNow = placed.includes(item.id);
                const affordable = diaBalance >= item.price;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => (isOwned ? toggle(item.id) : affordable && onBuy?.(item.id))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isOwned && placedNow }}
                    accessibilityLabel={isOwned ? item.name : `${item.name} 구매`}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: t.surface,
                        borderColor: isOwned && placedNow ? t.primary : 'transparent',
                        opacity: !isOwned && !affordable ? 0.5 : 1,
                      },
                    ]}>
                    <View style={styles.thumbWrap}>
                      <FurniturePlaceholder item={item} showName={false} />
                    </View>
                    <Text style={[styles.tileName, { color: t.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {isOwned ? (
                      <Text style={[styles.tilePrice, { color: t.textMuted }]}>보유</Text>
                    ) : (
                      <View style={styles.priceRow}>
                        <Icon name="dia" size={10} color={t.primary} />
                        <Text style={[styles.tilePrice, { color: t.textMuted }]}>{item.price}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.applyBar, { backgroundColor: t.screen, borderTopColor: t.border }]}>
        <Pressable
          onPress={() => {
            onApply?.(placed, wallpaperId);
            onBack?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="적용하기"
          style={[styles.applyBtn, { backgroundColor: t.primary }]}>
          <Icon name="check" size={16} color={t.onPrimary} />
          <Text style={[Typography.label, { color: t.onPrimary }]}>적용하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const GRID_GAP = Spacing.two;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingBottom: Spacing.six,
  },
  preview: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  tabs: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  catalog: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  catalogTitle: {
    marginBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Spacing.three,
  },
  tile: {
    // Four tiles per row, leaving room for the three inter-tile gaps.
    flexBasis: '22%',
    flexGrow: 0,
    borderRadius: Radius.md,
    borderWidth: 2,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  swatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.sm,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  tileName: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    minHeight: 28,
  },
  tilePrice: {
    fontSize: 10,
  },
  applyBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderTopWidth: 1,
  },
  applyBtn: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
