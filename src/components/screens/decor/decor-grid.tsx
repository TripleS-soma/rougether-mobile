import { Image } from 'expo-image';
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import { type FurnitureItem, type Wallpaper } from '@/resources/furniture';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 꾸미기 카탈로그 그리드 (room-decor-screen에서 분리, #794 memo 경계 그대로).
 * `SwatchGrid`(벽지/바닥/배경 스와치)와 `FurnitureGrid`(가구/소품 타일)는
 * memo 리프라 부모가 내려주는 콜백·Set은 참조가 고정돼야 한다 — 인라인
 * 람다를 내리면 방을 한 번 건드릴 때마다 그리드 전체가 다시 그려진다
 * (`room-decor-catalog-perf.test.tsx`가 렌더 횟수로 못 박는다).
 */
export type Tokens = ReturnType<typeof useTokens>;
export type BuyProps = {
  owned: Set<string>;
  diamondBalance: number;
  /** Ask the parent to confirm buying this item (opens the 구매 modal). */
  onBuyRequest: (item: { id: string; name: string; price: number }) => void;
  /** Unaffordable tile tapped — the parent explains (다이아 부족 toast). */
  onBlockedBuy: () => void;
  t: Tokens;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * 그리드 폭에 맞춰 열 수를 정한다 (#725).
 *
 * 종전에는 타일이 `flexBasis: '22%'`라 **폭과 무관하게 항상 4열**이었다. 폰에서는
 * 맞지만 태블릿에서는 타일이 거대해지고 한 화면에 보이는 가구는 그대로였다.
 *
 * 폭을 재서 정하는 이유는 퍼센트로는 안 되기 때문이다 — 타일 사이 간격이 px(`GRID_GAP`)
 * 고정이라 폭이 달라지면 퍼센트 몫이 어긋난다. 측정 전 첫 프레임은 기존 22%가 그대로
 * 쓰이므로 폰에서는 보이는 변화가 없다.
 */
const MIN_TILE = 72;
const MAX_COLUMNS = 8;

/** 측정된 타일 폭. `null`이면 아직 레이아웃 전 — 타일이 기존 22%로 그려진다. */
const TileWidthContext = createContext<number | null>(null);

function DecorGrid({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState<number | null>(null);
  const tileWidth = useMemo(() => {
    if (width == null || width <= 0) return null;
    const fit = Math.floor((width + GRID_GAP) / (MIN_TILE + GRID_GAP));
    const columns = Math.min(MAX_COLUMNS, Math.max(4, fit));
    return (width - (columns - 1) * GRID_GAP) / columns;
  }, [width]);
  return (
    <TileWidthContext.Provider value={tileWidth}>
      <View
        style={styles.grid}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        testID="decor-grid">
        {children}
      </View>
    </TileWidthContext.Provider>
  );
}

/** 타일에 얹는 폭 — flexBasis를 덮어써야 한다(주축에서 width보다 우선한다). */
function useTileWidthStyle() {
  const width = useContext(TileWidthContext);
  return width == null ? null : { flexBasis: width };
}

/**
 * 방금 보유로 바뀐 타일의 팝 (#453) — false→true 전환에서만 눌렸다 튀어오른다.
 * 구매 확인 모달이 닫히며 카탈로그의 해당 카드가 "내 것이 됐다"고 답한다.
 */
function useOwnedPopStyle(isOwned: boolean) {
  // jest의 useSharedValue는 렌더마다 새 객체 — useRef로 앵커 (#539 계약).
  const scale = useRef(useSharedValue(1)).current;
  const prev = useRef(isOwned);
  useEffect(() => {
    if (isOwned && !prev.current) {
      scale.value = 0.8;
      scale.value = withSpring(1, { damping: 7, stiffness: 260 });
    }
    prev.current = isOwned;
  }, [isOwned, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** 비우기 tile shared by the grids — clears the slot/surface being picked. */
const ClearTile = memo(function ClearTile({ onClear, t }: { onClear?: () => void; t: Tokens }) {
  const emph = useFontEmphasis();
  const tileWidth = useTileWidthStyle();
  if (!onClear) return null;
  return (
    <Pressable
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel="비우기"
      style={[styles.tile, tileWidth, styles.clearTile, { borderColor: t.border }]}>
      <View style={[styles.thumbWrap, styles.clearThumb]}>
        <Icon name="close" size={18} color={t.textMuted} />
      </View>
      <Text style={[styles.tileName, emph('medium'), { color: t.textMuted }]}>비우기</Text>
    </Pressable>
  );
});

/** Surface picker grid (벽지/바닥/배경): single-select swatch/art tiles. */
export const SwatchGrid = memo(function SwatchGrid({
  items,
  selectedId,
  onSelect,
  onClear,
  owned,
  diamondBalance,
  onBuyRequest,
  onBlockedBuy,
  t,
}: BuyProps & {
  items: Wallpaper[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear?: () => void;
}) {
  return (
    <DecorGrid>
      <ClearTile onClear={onClear} t={t} />
      {items.map((item) => (
        <SwatchTile
          key={item.id}
          item={item}
          isOwned={owned.has(item.id)}
          // 프리뷰(#501)도 선택 링을 받는다 — 적용 중인 표면이 곧 프리뷰다.
          active={item.id === selectedId}
          affordable={diamondBalance >= item.price}
          onSelect={onSelect}
          onBuyRequest={onBuyRequest}
          onBlockedBuy={onBlockedBuy}
          t={t}
        />
      ))}
    </DecorGrid>
  );
});

/** 표면류 스와치 한 장 — 구매로 보유가 되는 순간 팝 (#453). */
const SwatchTile = memo(function SwatchTile({
  item,
  isOwned,
  active,
  affordable,
  onSelect,
  onBuyRequest,
  onBlockedBuy,
  t,
}: {
  item: Wallpaper;
  isOwned: boolean;
  active: boolean;
  affordable: boolean;
  onSelect: (id: string) => void;
  onBuyRequest: (item: { id: string; name: string; price: number }) => void;
  onBlockedBuy: () => void;
  t: Tokens;
}) {
  const emph = useFontEmphasis();
  const tileWidth = useTileWidthStyle();
  const popStyle = useOwnedPopStyle(isOwned);
  return (
    <AnimatedPressable
      onPress={() =>
        isOwned
          ? onSelect(item.id)
          : active
            ? // 프리뷰 적용 중 재탭 = 구매 (#501). 잔액 부족은 토스트.
              affordable
              ? onBuyRequest({ id: item.id, name: item.name, price: item.price })
              : onBlockedBuy()
            : onSelect(item.id)
      }
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        isOwned ? item.name : active ? `${item.name} 구매` : `${item.name} 미리 적용`
      }
      style={[
        styles.tile,
        tileWidth,
        popStyle,
        {
          backgroundColor: t.surfaceMuted,
          borderColor: active ? t.primary : 'transparent',
        },
      ]}>
      {isCdnKey(item.assetKey) ? (
        <Image
          source={assetSource(item.assetKey)}
          style={styles.swatch}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <View style={[styles.swatch, { backgroundColor: item.color }]} />
      )}
      {/* 이름은 표시하지 않는다 (#487) — 이미지가 곧 정보. 접근성 라벨은 유지. */}
      {isOwned ? (
        <Text style={[styles.tilePrice, emph('normal'), { color: t.textMuted }]}>보유</Text>
      ) : (
        <View style={styles.priceRow}>
          <Icon name="diamond" size={10} color={t.primary} />
          <Text style={[styles.tilePrice, emph('normal'), { color: t.textMuted }]}>
            {item.price}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
});

/**
 * Furniture picker grid for one slot: tap places (replacing the slot).
 * 미보유도 프리뷰로 배치되므로(#501) 구매 관련 prop이 없다 — 구매는 방의
 * 프리뷰 재탭/툴바에서.
 */
export const FurnitureGrid = memo(function FurnitureGrid({
  items,
  placed,
  onPlace,
  onClear,
  owned,
  highlighted,
  t,
}: {
  items: FurnitureItem[];
  placed: Set<string>;
  onPlace: (item: FurnitureItem) => void;
  onClear?: () => void;
  owned: Set<string>;
  /** 방금 뽑은 아이템 (#630) — NEW 배지. */
  highlighted?: Set<string>;
  t: Tokens;
}) {
  const Typography = useTypography();
  if (items.length === 0) {
    return (
      <Text style={[Typography.supporting, styles.emptyPicker, { color: t.textMuted }]}>
        이 자리에 놓을 수 있는 가구가 아직 없어요.
      </Text>
    );
  }
  return (
    <DecorGrid>
      <ClearTile onClear={onClear} t={t} />
      {items.map((item) => (
        <FurnitureTile
          key={item.id}
          item={item}
          isOwned={owned.has(item.id)}
          // 프리뷰(#501)도 배치 상태 링을 받는다.
          active={placed.has(item.id)}
          isNew={highlighted?.has(item.id)}
          onPlace={onPlace}
          t={t}
        />
      ))}
    </DecorGrid>
  );
});

/** 가구 타일 한 장 — 구매로 보유가 되는 순간 팝 (#453), 방금 뽑은 건 NEW (#630). */
const FurnitureTile = memo(function FurnitureTile({
  item,
  isOwned,
  active,
  isNew = false,
  onPlace,
  t,
}: {
  item: FurnitureItem;
  isOwned: boolean;
  active: boolean;
  isNew?: boolean;
  onPlace: (item: FurnitureItem) => void;
  t: Tokens;
}) {
  const emph = useFontEmphasis();
  const tileWidth = useTileWidthStyle();
  const popStyle = useOwnedPopStyle(isOwned);
  return (
    <AnimatedPressable
      // 미보유도 일단 배치(프리뷰) — 구매는 방의 프리뷰를 다시 탭 (#501).
      onPress={() => onPlace(item)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={isOwned ? item.name : `${item.name} 미리 배치`}
      style={[
        styles.tile,
        tileWidth,
        popStyle,
        {
          backgroundColor: t.surfaceMuted,
          borderColor: active ? t.primary : 'transparent',
        },
      ]}>
      {/* 미리보기는 접근성에서 숨긴다 — 타일 Pressable 라벨과 이중 안내 방지. */}
      <View
        style={styles.thumbWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <FurniturePlaceholder item={item} showName={false} />
      </View>
      {isNew ? (
        <View
          style={[styles.newBadge, { backgroundColor: t.warning }]}
          testID={`new-badge-${item.id}`}>
          <Text style={[styles.newBadgeText, emph('normal'), { color: t.onPrimary }]}>NEW</Text>
        </View>
      ) : null}
      {/* 이름은 표시하지 않는다 (#487) — 접근성 라벨은 유지. */}
      {isOwned ? (
        <Text style={[styles.tilePrice, emph('normal'), { color: t.textMuted }]}>보유</Text>
      ) : (
        <View style={styles.priceRow}>
          <Icon name="diamond" size={10} color={t.primary} />
          <Text style={[styles.tilePrice, emph('normal'), { color: t.textMuted }]}>
            {item.price}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
});

const GRID_GAP = Spacing.two;

const styles = StyleSheet.create({
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  emptyPicker: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  // 방금 뽑은 아이템 (#630) — 타일 좌상단 NEW 배지.
  newBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
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
  clearTile: {
    borderStyle: 'dashed',
  },
  clearThumb: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    lineHeight: 16,
    minHeight: 28,
  },
  tilePrice: {
    fontSize: 12,
  },
});
