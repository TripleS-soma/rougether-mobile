import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Room } from '@/components/room/room';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { assetSource } from '@/resources/asset';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
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
  /** Ids the user owns; only these appear in the catalog (defaults to all). */
  ownedIds?: string[];
  characterId?: CharacterId;
  onBack?: () => void;
  /** Commit the current selection. */
  onApply?: (placedIds: string[], wallpaperId: string) => void;
};

/**
 * Room decoration screen, ported from the prototype `RoomDecorScreen`: live
 * <Room /> preview, category tabs, wallpaper + furniture catalogs, and an apply
 * bar. Selecting a furniture item replaces whatever occupies the same slot (one
 * item per slot). Selection state is local; `onApply` commits it. Spec domain:
 * rougether-spec domains/room.
 */
export function RoomDecorScreen({
  initialPlacedIds,
  initialWallpaperId = DEFAULT_WALLPAPER_ID,
  ownedIds,
  characterId = DEFAULT_CHARACTER_ID,
  onBack,
  onApply,
}: RoomDecorScreenProps) {
  const t = useTokens();

  const ownedItems = useMemo(
    () => (ownedIds ? FURNITURE_ITEMS.filter((i) => ownedIds.includes(i.id)) : FURNITURE_ITEMS),
    [ownedIds],
  );
  const categories = useMemo(
    () => [ALL, WALLPAPER, ...Array.from(new Set(ownedItems.map((i) => i.category)))],
    [ownedItems],
  );

  const [placed, setPlaced] = useState<string[]>(
    () => initialPlacedIds ?? ['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'],
  );
  const [wallpaperId, setWallpaperId] = useState(initialWallpaperId);
  const [activeCategory, setActiveCategory] = useState(ALL);

  const slotOf = (id: string) => FURNITURE_ITEMS.find((i) => i.id === id)?.slot;

  const toggle = (id: string) => {
    setPlaced((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      const slot = slotOf(id);
      // One item per slot: drop whatever shares this slot, then add.
      return [...prev.filter((p) => slotOf(p) !== slot), id];
    });
  };

  const showWallpapers = activeCategory === ALL || activeCategory === WALLPAPER;
  const visibleItems =
    activeCategory === ALL
      ? ownedItems
      : activeCategory === WALLPAPER
        ? []
        : ownedItems.filter((i) => i.category === activeCategory);

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
        <Text style={[Typography.h2, { color: t.text }]}>나의 방 꾸미기</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.preview}>
          <Room characterId={characterId} wallpaperId={wallpaperId} placedFurnitureIds={placed} />
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

        {showWallpapers ? (
          <View style={styles.catalog}>
            <Text style={[Typography.label, styles.catalogTitle, { color: t.textMuted }]}>
              벽지
            </Text>
            <View style={styles.grid}>
              {WALLPAPERS.map((wp) => {
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

        {visibleItems.length > 0 ? (
          <View style={styles.catalog}>
            {showWallpapers ? (
              <Text style={[Typography.label, styles.catalogTitle, { color: t.textMuted }]}>
                가구 · 소품
              </Text>
            ) : null}
            <View style={styles.grid}>
              {visibleItems.map((item: FurnitureItem) => {
                const active = placed.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggle(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.name}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: t.surface,
                        borderColor: active ? t.primary : 'transparent',
                      },
                    ]}>
                    <View style={[styles.thumbWrap, { backgroundColor: t.surfaceMuted }]}>
                      <Image
                        source={assetSource(item.assetKey, item.name)}
                        resizeMode="contain"
                        style={styles.thumb}
                      />
                    </View>
                    <Text style={[styles.tileName, { color: t.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.tilePrice, { color: t.textMuted }]}>✨ {item.price}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  thumb: {
    width: '100%',
    height: '100%',
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
