import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Room, type RoomRegion } from '@/components/room/room';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type FurnitureSlot,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

/**
 * What the picker panel is currently choosing for: one furniture slot, or one
 * of the surface layers. Tapping the room's wall opens the wallpaper picker
 * (with a 배경 segment); tapping the floor band opens the floor picker.
 */
type PickerTarget = FurnitureSlot | 'wallpaper' | 'floor' | 'background' | 'all' | null;

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
 * Room decoration screen (#243 redesign): the live <Room /> preview IS the
 * catalog's entry point — empty slots show a dashed +, tapping any slot (or
 * the wall/floor band) opens a picker for that exact spot, and picks preview
 * instantly. No positional filter chips; position is expressed by touching the
 * room. The picker doubles as the shop — owned items place, the rest are
 * bought with 다이아 first. Selection is local until `onApply` commits it.
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
  const { show: toast } = useToast();
  const headerInset = useHeaderInsetStyle();

  // Owned items are placeable; everything else in the catalog is buyable.
  // (The demo default owns the whole catalogue, surfaces included.)
  const owned = useMemo(
    () =>
      new Set(
        ownedIds ?? [...furniture, ...wallpapers, ...floors, ...backgrounds].map((i) => i.id),
      ),
    [ownedIds, furniture, wallpapers, floors, backgrounds],
  );

  const [placed, setPlaced] = useState<string[]>(
    () => initialPlacedIds ?? ['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'],
  );
  const [wallpaperId, setWallpaperId] = useState(initialWallpaperId);
  const [floorId, setFloorId] = useState<string | null>(initialFloorId);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialBackgroundId);
  // Snapshot of the selection at mount — leaving with a different selection
  // (미적용 변경) asks whether to save first.
  const initialRef = useRef({
    placed: [...(initialPlacedIds ?? ['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'])],
    wallpaperId: initialWallpaperId,
    floorId: initialFloorId,
    backgroundId: initialBackgroundId,
  });
  const dirty =
    wallpaperId !== initialRef.current.wallpaperId ||
    floorId !== initialRef.current.floorId ||
    backgroundId !== initialRef.current.backgroundId ||
    placed.length !== initialRef.current.placed.length ||
    placed.some((id) => !initialRef.current.placed.includes(id));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);

  const apply = () => onApply?.(placed, wallpaperId, floorId, backgroundId);
  const handleBack = () => {
    if (dirty) setConfirmLeave(true);
    else onBack?.();
  };
  // Android hardware back: close the picker first, then run the same
  // unsaved-changes guard; without a reason we fall through to the shell.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (picker) {
        setPicker(null);
        return true;
      }
      if (confirmLeave) {
        setConfirmLeave(false);
        return true;
      }
      if (dirty) {
        setConfirmLeave(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [picker, confirmLeave, dirty]);
  // Purchase pending the 구매하시겠습니까? confirm — buying is irreversible dia spend.
  const [pendingBuy, setPendingBuy] = useState<{ id: string; name: string; price: number } | null>(
    null,
  );

  const onRegionPress = (region: RoomRegion) =>
    setPicker(
      region === 'wall'
        ? 'wallpaper'
        : region === 'floor' && floors.length === 0
          ? 'wallpaper' // no floor catalog yet — fall back to the surface picker
          : region,
    );
  const activeRegion: RoomRegion | null =
    picker === 'all' ? null : picker === 'wallpaper' || picker === 'background' ? 'wall' : picker;

  /** Place `id` into its slot, replacing whatever shares that slot. */
  const placeInSlot = (id: string, slot: FurnitureSlot) =>
    setPlaced((prev) => [...prev.filter((p) => furniture.find((i) => i.id === p)?.slot !== slot), id]); // prettier-ignore
  const clearSlot = (slot: FurnitureSlot) =>
    setPlaced((prev) => prev.filter((p) => furniture.find((i) => i.id === p)?.slot !== slot));

  // What the open picker offers, owned first so placing needs no digging.
  const isSurfacePicker = picker === 'wallpaper' || picker === 'floor' || picker === 'background';
  const byOwnedFirst = <T extends { id: string }>(arr: T[]) =>
    [...arr].sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={handleBack}
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
            editable
            onRegionPress={onRegionPress}
            activeRegion={activeRegion}
          />
        </View>

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

        {!loading && !loadError && picker === null ? (
          <View style={[styles.guideCard, { backgroundColor: t.surface }]}>
            <Text style={[Typography.label, { color: t.text }]}>방을 눌러 꾸며보세요</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              비어 있는 자리는 +로 표시돼요. 벽이나 바닥을 누르면 벽지·바닥을 바꿀 수 있어요.
            </Text>
            <Pressable
              onPress={() => setPicker('all')}
              accessibilityRole="button"
              accessibilityLabel="전체보기"
              style={[styles.allBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.primary }]}>전체보기</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !loadError && picker !== null ? (
          <View style={[styles.panel, { backgroundColor: t.surface }]}>
            <View style={styles.panelHead}>
              {picker === 'all' ? (
                <Text style={[Typography.label, styles.flex, { color: t.text }]}>전체 아이템</Text>
              ) : isSurfacePicker ? (
                // 벽 탭은 벽지/배경을 함께 다룬다 (배경은 벽 너머 풍경).
                <View style={styles.segment}>
                  {(
                    [
                      ['wallpaper', '벽지'],
                      ...(backgrounds.length > 0 ? [['background', '배경'] as const] : []),
                      ...(floors.length > 0 ? [['floor', '바닥'] as const] : []),
                    ] as const
                  ).map(([key, label]) => {
                    const active = picker === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setPicker(key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.segBtn,
                          { backgroundColor: active ? t.primary : t.surfaceMuted },
                        ]}>
                        <Text
                          style={[
                            Typography.supporting,
                            { color: active ? t.onPrimary : t.textMuted },
                          ]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={[Typography.label, styles.flex, { color: t.text }]}>
                  이 자리에 놓을 가구
                </Text>
              )}
              <Pressable
                onPress={() => setPicker(null)}
                accessibilityRole="button"
                accessibilityLabel="선택 닫기"
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: t.surfaceMuted }]}>
                <Icon name="close" size={14} color={t.text} />
              </Pressable>
            </View>

            {picker === 'wallpaper' ? (
              <SwatchGrid
                items={byOwnedFirst(wallpapers)}
                selectedId={wallpaperId}
                onSelect={(id) => setWallpaperId(id)}
                owned={owned}
                diaBalance={diaBalance}
                onBuyRequest={setPendingBuy}
                onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                t={t}
              />
            ) : null}
            {picker === 'floor' ? (
              <SwatchGrid
                items={byOwnedFirst(floors)}
                selectedId={floorId}
                onSelect={(id) => setFloorId((prev) => (prev === id ? null : id))}
                onClear={floorId ? () => setFloorId(null) : undefined}
                owned={owned}
                diaBalance={diaBalance}
                onBuyRequest={setPendingBuy}
                onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                t={t}
              />
            ) : null}
            {picker === 'background' ? (
              <SwatchGrid
                items={byOwnedFirst(backgrounds)}
                selectedId={backgroundId}
                onSelect={(id) => setBackgroundId((prev) => (prev === id ? null : id))}
                onClear={backgroundId ? () => setBackgroundId(null) : undefined}
                owned={owned}
                diaBalance={diaBalance}
                onBuyRequest={setPendingBuy}
                onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                t={t}
              />
            ) : null}
            {picker === 'all' ? (
              // 수정 전의 전체 카탈로그 뷰 — 표면 섹션 + 가구 전체. 가구 탭은
              // 예전처럼 자기 기본 슬롯에 배치/해제(토글)한다.
              <>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>벽지</Text>
                <SwatchGrid
                  items={byOwnedFirst(wallpapers)}
                  selectedId={wallpaperId}
                  onSelect={(id) => setWallpaperId(id)}
                  owned={owned}
                  diaBalance={diaBalance}
                  onBuyRequest={setPendingBuy}
                  onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                  t={t}
                />
                {floors.length > 0 ? (
                  <>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>바닥</Text>
                    <SwatchGrid
                      items={byOwnedFirst(floors)}
                      selectedId={floorId}
                      onSelect={(id) => setFloorId((prev) => (prev === id ? null : id))}
                      owned={owned}
                      diaBalance={diaBalance}
                      onBuyRequest={setPendingBuy}
                      onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                      t={t}
                    />
                  </>
                ) : null}
                {backgrounds.length > 0 ? (
                  <>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>배경</Text>
                    <SwatchGrid
                      items={byOwnedFirst(backgrounds)}
                      selectedId={backgroundId}
                      onSelect={(id) => setBackgroundId((prev) => (prev === id ? null : id))}
                      owned={owned}
                      diaBalance={diaBalance}
                      onBuyRequest={setPendingBuy}
                      onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                      t={t}
                    />
                  </>
                ) : null}
                <Text style={[Typography.supporting, { color: t.textMuted }]}>가구 · 소품</Text>
                <FurnitureGrid
                  items={byOwnedFirst(furniture)}
                  placed={placed}
                  onPlace={(item) =>
                    placed.includes(item.id)
                      ? setPlaced((prev) => prev.filter((p) => p !== item.id))
                      : placeInSlot(item.id, item.slot)
                  }
                  owned={owned}
                  diaBalance={diaBalance}
                  onBuyRequest={setPendingBuy}
                  onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                  t={t}
                />
              </>
            ) : null}
            {!isSurfacePicker && picker !== null && picker !== 'all' ? (
              <FurnitureGrid
                items={byOwnedFirst(furniture.filter((i) => i.slot === picker))}
                placed={placed}
                onPlace={(item) => placeInSlot(item.id, picker)}
                onClear={
                  placed.some((p) => furniture.find((i) => i.id === p)?.slot === picker)
                    ? () => clearSlot(picker)
                    : undefined
                }
                owned={owned}
                diaBalance={diaBalance}
                onBuyRequest={setPendingBuy}
                onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                t={t}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Buying spends dia irreversibly — confirm before calling onBuy. */}
      <Modal
        transparent
        visible={pendingBuy !== null}
        animationType="fade"
        onRequestClose={() => setPendingBuy(null)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setPendingBuy(null)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>구매하시겠습니까?</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              &lsquo;{pendingBuy?.name}&rsquo;을(를) 다이아 {pendingBuy?.price}개로 구매해요.
              {'\n'}구매한 아이템은 바로 배치할 수 있어요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setPendingBuy(null)}
                accessibilityRole="button"
                accessibilityLabel="구매 취소"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const p = pendingBuy;
                  setPendingBuy(null);
                  if (p) onBuy?.(p.id);
                }}
                accessibilityRole="button"
                accessibilityLabel="구매 확인"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>구매</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Leaving with unapplied changes — save, discard, or stay. */}
      <Modal
        transparent
        visible={confirmLeave}
        animationType="fade"
        onRequestClose={() => setConfirmLeave(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmLeave(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>변경사항을 저장할까요?</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              적용하지 않은 꾸미기 변경이 있어요.
            </Text>
            <View style={styles.leaveBtns}>
              <Pressable
                onPress={() => {
                  setConfirmLeave(false);
                  apply();
                  onBack?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="저장하고 나가기"
                style={[styles.leaveBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>저장하고 나가기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmLeave(false);
                  onBack?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="저장하지 않고 나가기"
                style={[styles.leaveBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>저장하지 않고 나가기</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmLeave(false)}
                accessibilityRole="button"
                accessibilityLabel="계속 꾸미기"
                style={styles.leaveStay}>
                <Text style={[Typography.label, { color: t.textMuted }]}>계속 꾸미기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.applyBar, { backgroundColor: t.screen, borderTopColor: t.border }]}>
        <Pressable
          onPress={() => {
            apply();
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

type Tokens = ReturnType<typeof useTokens>;
type BuyProps = {
  owned: Set<string>;
  diaBalance: number;
  /** Ask the parent to confirm buying this item (opens the 구매 modal). */
  onBuyRequest: (item: { id: string; name: string; price: number }) => void;
  /** Unaffordable tile tapped — the parent explains (다이아 부족 toast). */
  onBlockedBuy: () => void;
  t: Tokens;
};

/** 비우기 tile shared by the grids — clears the slot/surface being picked. */
function ClearTile({ onClear, t }: { onClear?: () => void; t: Tokens }) {
  if (!onClear) return null;
  return (
    <Pressable
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel="비우기"
      style={[styles.tile, styles.clearTile, { borderColor: t.border }]}>
      <View style={[styles.thumbWrap, styles.clearThumb]}>
        <Icon name="close" size={18} color={t.textMuted} />
      </View>
      <Text style={[styles.tileName, { color: t.textMuted }]}>비우기</Text>
    </Pressable>
  );
}

/** Surface picker grid (벽지/바닥/배경): single-select swatch/art tiles. */
function SwatchGrid({
  items,
  selectedId,
  onSelect,
  onClear,
  owned,
  diaBalance,
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
    <View style={styles.grid}>
      <ClearTile onClear={onClear} t={t} />
      {items.map((item) => {
        const isOwned = owned.has(item.id);
        const active = isOwned && item.id === selectedId;
        const affordable = diaBalance >= item.price;
        return (
          <Pressable
            key={item.id}
            onPress={() =>
              isOwned
                ? onSelect(item.id)
                : affordable
                  ? onBuyRequest({ id: item.id, name: item.name, price: item.price })
                  : onBlockedBuy()
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={isOwned ? item.name : `${item.name} 구매`}
            style={[
              styles.tile,
              {
                backgroundColor: t.surfaceMuted,
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
  );
}

/** Furniture picker grid for one slot: tap places (replacing the slot). */
function FurnitureGrid({
  items,
  placed,
  onPlace,
  onClear,
  owned,
  diaBalance,
  onBuyRequest,
  onBlockedBuy,
  t,
}: BuyProps & {
  items: FurnitureItem[];
  placed: string[];
  onPlace: (item: FurnitureItem) => void;
  onClear?: () => void;
}) {
  if (items.length === 0) {
    return (
      <Text style={[Typography.supporting, styles.emptyPicker, { color: t.textMuted }]}>
        이 자리에 놓을 수 있는 가구가 아직 없어요.
      </Text>
    );
  }
  return (
    <View style={styles.grid}>
      <ClearTile onClear={onClear} t={t} />
      {items.map((item) => {
        const isOwned = owned.has(item.id);
        const active = isOwned && placed.includes(item.id);
        const affordable = diaBalance >= item.price;
        return (
          <Pressable
            key={item.id}
            onPress={() =>
              isOwned
                ? onPlace(item)
                : affordable
                  ? onBuyRequest({ id: item.id, name: item.name, price: item.price })
                  : onBlockedBuy()
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={isOwned ? item.name : `${item.name} 구매`}
            style={[
              styles.tile,
              {
                backgroundColor: t.surfaceMuted,
                borderColor: active ? t.primary : 'transparent',
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
  allBtn: {
    marginTop: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  guideCard: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
  },
  panel: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  segBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPicker: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmText: {
    lineHeight: 22,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  leaveBtns: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  leaveBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  leaveStay: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
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
