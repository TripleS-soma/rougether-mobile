import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Room } from '@/components/room/room';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

// Tab labels for the API's surface categoryCodes (wallpaper/floor/background).
const ALL = '전체';
const WALLPAPER = '벽지';
const FLOOR = '바닥';
const BACKGROUND = '배경';

export type RoomDecorScreenProps = {
  /** Furniture ids placed when the screen opens. */
  initialPlacedIds?: string[];
  initialWallpaperId?: string;
  initialFloorId?: string | null;
  initialBackgroundId?: string | null;
  /** Ids the user owns; owned items are placeable, the rest are buyable with dia. */
  ownedIds?: string[];
  /** Item + surface catalogue (defaults to the local set; floors/backgrounds are API-only). */
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
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
  /** Commit the current selection (null floor/background = surface cleared). */
  onApply?: (
    placedIds: string[],
    wallpaperId: string,
    floorId: string | null,
    backgroundId: string | null,
  ) => void;
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
  initialFloorId = null,
  initialBackgroundId = null,
  ownedIds,
  furniture = FURNITURE_ITEMS,
  wallpapers = WALLPAPERS,
  floors = [],
  backgrounds = [],
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
  // (The demo default owns the whole catalogue, surfaces included.)
  const owned = useMemo(
    () =>
      new Set(
        ownedIds ?? [...furniture, ...wallpapers, ...floors, ...backgrounds].map((i) => i.id),
      ),
    [ownedIds, furniture, wallpapers, floors, backgrounds],
  );
  // Filter tabs by the API categoryCode: surfaces (벽지/바닥/배경, shown only when
  // the catalogue has them) then the positioned-item categories (가구/장식 …).
  const categories = useMemo(
    () => [
      ALL,
      WALLPAPER,
      ...(floors.length > 0 ? [FLOOR] : []),
      ...(backgrounds.length > 0 ? [BACKGROUND] : []),
      ...Array.from(new Set(furniture.map((i) => i.category))),
    ],
    [floors, backgrounds, furniture],
  );

  const [placed, setPlaced] = useState<string[]>(
    () => initialPlacedIds ?? ['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'],
  );
  const [wallpaperId, setWallpaperId] = useState(initialWallpaperId);
  const [floorId, setFloorId] = useState<string | null>(initialFloorId);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialBackgroundId);
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

  const showWallpapers = activeCategory === ALL || activeCategory === WALLPAPER;
  const showFloors = floors.length > 0 && (activeCategory === ALL || activeCategory === FLOOR);
  const showBackgrounds =
    backgrounds.length > 0 && (activeCategory === ALL || activeCategory === BACKGROUND);
  const visibleItems =
    activeCategory === ALL
      ? furniture
      : [WALLPAPER, FLOOR, BACKGROUND].includes(activeCategory)
        ? []
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
            floorId={floorId}
            backgroundId={backgroundId}
            placedFurnitureIds={placed}
            furniture={furniture}
            wallpapers={wallpapers}
            floors={floors}
            backgrounds={backgrounds}
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
          <SurfaceSection
            title={WALLPAPER}
            items={wallpapers}
            selectedId={wallpaperId}
            onSelect={(id) => setWallpaperId(id)}
            owned={owned}
            diaBalance={diaBalance}
            onBuy={onBuy}
            t={t}
          />
        ) : null}

        {!loading && !loadError && showFloors ? (
          <SurfaceSection
            title={FLOOR}
            items={floors}
            selectedId={floorId}
            // Tapping the selected floor clears the surface (the room can have none).
            onSelect={(id) => setFloorId((prev) => (prev === id ? null : id))}
            owned={owned}
            diaBalance={diaBalance}
            onBuy={onBuy}
            t={t}
          />
        ) : null}

        {!loading && !loadError && showBackgrounds ? (
          <SurfaceSection
            title={BACKGROUND}
            items={backgrounds}
            selectedId={backgroundId}
            onSelect={(id) => setBackgroundId((prev) => (prev === id ? null : id))}
            owned={owned}
            diaBalance={diaBalance}
            onBuy={onBuy}
            t={t}
          />
        ) : null}

        {!loading && !loadError && visibleItems.length > 0 ? (
          <View style={styles.catalog}>
            {activeCategory === ALL ? (
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
            onApply?.(placed, wallpaperId, floorId, backgroundId);
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

/**
 * One surface catalog section (벽지/바닥/배경): single-select swatch/art tiles.
 * Owned items select; the rest buy with dia first (same rule as furniture) —
 * unowned surfaces can't be picked, so nothing silently drops on save.
 */
function SurfaceSection({
  title,
  items,
  selectedId,
  onSelect,
  owned,
  diaBalance,
  onBuy,
  t,
}: {
  title: string;
  items: Wallpaper[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  owned: Set<string>;
  diaBalance: number;
  onBuy?: (itemId: string) => void;
  t: ReturnType<typeof useTokens>;
}) {
  return (
    <View style={styles.catalog}>
      <Text style={[Typography.label, styles.catalogTitle, { color: t.textMuted }]}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          const active = isOwned && item.id === selectedId;
          const affordable = diaBalance >= item.price;
          return (
            <Pressable
              key={item.id}
              onPress={() => (isOwned ? onSelect(item.id) : affordable && onBuy?.(item.id))}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={isOwned ? item.name : `${item.name} 구매`}
              style={[
                styles.tile,
                {
                  backgroundColor: t.surface,
                  borderColor: active ? t.primary : 'transparent',
                  opacity: !isOwned && !affordable ? 0.5 : 1,
                },
              ]}>
              {isCdnKey(item.assetKey) ? (
                <Image
                  source={assetSource(item.assetKey)}
                  style={styles.swatch}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
              )}
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
