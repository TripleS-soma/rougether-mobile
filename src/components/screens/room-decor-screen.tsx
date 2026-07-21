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

import { type CharacterAnimationSet, CharacterAvatar } from '@/components/character-avatar';
import {
  DraggableFurniture,
  DRAG_CLAMP_MAX,
  DRAG_CLAMP_MIN,
  SCALE_MAX,
  SCALE_MIN,
} from '@/components/room/draggable-furniture';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Room, type RoomRegion } from '@/components/room/room';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { assetSource, isCdnKey } from '@/resources/asset';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type FurnitureItem,
  type PlacedFurniture,
  slotIdsToPlacements,
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
type PickerTarget = 'wallpaper' | 'floor' | 'background' | 'all' | null;

export type RoomDecorScreenProps = {
  /** 자유 배치 초기 상태 (#327); 없으면 데모 프리필. */
  initialItems?: PlacedFurniture[];
  /** 방이 이미 FREE_V1로 전환됐는지 — 첫 저장 전환 확인 모달 판단. */
  freeLayout?: boolean;
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
  /** Worn character's CDN animation keys (forwarded to the <Room /> preview). */
  characterAnimations?: CharacterAnimationSet;
  onBack?: () => void;
  /** Buy a not-yet-owned catalog item with dia. */
  onBuy?: (itemId: string) => void;
  /**
   * Commit the current layout (null floor/background = surface cleared).
   * 'conflict' = 다른 기기 선저장(409) — 화면이 재로드 모달을 띄운다.
   */
  onApply?: (
    items: PlacedFurniture[],
    wallpaperId: string,
    floorId: string | null,
    backgroundId: string | null,
  ) => Promise<'ok' | 'conflict' | 'fail'> | void;
  /** 리비전 충돌 모달의 '새로 불러오기' — 서버 상태로 재로드 후 화면을 나간다. */
  onConflictReload?: () => void;
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
  initialItems,
  freeLayout = false,
  onConflictReload,
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
  characterAnimations,
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

  // 자유 배치 상태 (#327). 데모(스토리) 프리필은 기존 한옥 세트를 슬롯 앵커로.
  const demoItems = () =>
    slotIdsToPlacements(['hanok-bed', 'hanok-shelf', 'hanok-window', 'hanok-rug'], furniture);
  const [items, setItems] = useState<PlacedFurniture[]>(() => initialItems ?? demoItems());
  const placed = useMemo(() => items.map((p) => p.furnitureId), [items]);
  const [wallpaperId, setWallpaperId] = useState(initialWallpaperId);
  const [floorId, setFloorId] = useState<string | null>(initialFloorId);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialBackgroundId);
  // Snapshot of the layout at mount — leaving with a different layout
  // (미적용 변경) asks whether to save first. 좌표까지 비교한다.
  const snap = (its: PlacedFurniture[], wp: string, fl: string | null, bg: string | null): string =>
    JSON.stringify({ its, wp, fl, bg });
  const initialSnapRef = useRef<string | null>(null);
  if (initialSnapRef.current === null) {
    initialSnapRef.current = snap(items, wallpaperId, floorId, backgroundId);
  }
  const dirty = snap(items, wallpaperId, floorId, backgroundId) !== initialSnapRef.current;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  // 첫 자유 배치 저장은 SLOT_V1→FREE_V1 비가역 전환 — 한 번 확인받는다 (#327).
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const migrateOkRef = useRef(freeLayout);
  const pendingBackRef = useRef(true);
  // 409 리비전 충돌(다른 기기 선저장) — 재로드 안내 모달.
  const [conflictOpen, setConflictOpen] = useState(false);

  const doApply = async (thenBack: boolean) => {
    const result = await onApply?.(items, wallpaperId, floorId, backgroundId);
    if (result === 'conflict') return setConflictOpen(true);
    if (result === 'fail') return; // 실패 토스트는 훅이 띄운다.
    initialSnapRef.current = snap(items, wallpaperId, floorId, backgroundId);
    if (thenBack) onBack?.();
  };
  const apply = (thenBack = true) => {
    if (!migrateOkRef.current) {
      pendingBackRef.current = thenBack;
      setConfirmMigrate(true);
      return;
    }
    void doApply(thenBack);
  };
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

  // 자유 배치 모드에선 방의 벽/바닥 밴드만 픽커 진입점이다 (가구는 트레이·전체보기).
  const onRegionPress = (region: RoomRegion) => {
    if (region !== 'wall' && region !== 'floor') return;
    setPicker(region === 'wall' || floors.length === 0 ? 'wallpaper' : 'floor');
  };
  const activeRegion: RoomRegion | null =
    picker === 'all' ? null : picker === 'wallpaper' || picker === 'background' ? 'wall' : picker;

  // 방 렌더 영역 크기(px) — 정규화 좌표의 기준 (#327).
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  // 선택된 가구 — 링 + 툴바(회전/반전/앞뒤/빼기) + 크기 핸들 대상 (#333).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** 가운데에 새 가구를 놓는다 — 같은 가구는 방에 1개만. */
  const addItem = (id: string) => {
    if (items.some((p) => p.furnitureId === id)) {
      toast('이미 배치된 가구예요', 'error');
      return;
    }
    const maxZ = items.reduce((m, p) => Math.max(m, p.z), 0);
    setItems((prev) => [...prev, { furnitureId: id, x: 0.5, y: 0.55, z: maxZ + 1 }]);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.furnitureId !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };
  /** 드래그 종료 — 방 안으로 클램프해 좌표 커밋 + 최상위 승격. */
  const commitDrag = (id: string, x: number, y: number) => {
    const clamp = (v: number) => Math.min(DRAG_CLAMP_MAX, Math.max(DRAG_CLAMP_MIN, v));
    setItems((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.z), 0);
      return prev.map((p) =>
        p.furnitureId === id ? { ...p, x: clamp(x), y: clamp(y), z: maxZ + 1 } : p,
      );
    });
  };
  /** 핀치/핸들 종료 — 스케일 클램프 후 커밋 (#333). */
  const commitScale = (id: string, scale: number) => {
    const clamped = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) * 100) / 100;
    setItems((prev) => prev.map((p) => (p.furnitureId === id ? { ...p, scale: clamped } : p)));
  };
  /** 선택된 가구만 바꾼다 — 툴바 액션 공용 (#333). */
  const mutateSelected = (fn: (p: PlacedFurniture) => PlacedFurniture) =>
    setItems((prev) => prev.map((p) => (p.furnitureId === selectedId ? fn(p) : p)));
  const rotateSelected = (dir: 1 | -1) =>
    mutateSelected((p) => ({
      ...p,
      rotationDeg: ((((p.rotationDeg ?? 0) + dir * 15) % 360) + 360) % 360,
    }));
  const flipSelected = () => mutateSelected((p) => ({ ...p, flipped: !p.flipped }));
  // z 이웃과 한 칸 스왑은 겹치지 않은 아이템과 순서만 바뀌어 "안 눌리는" 것처럼
  // 보인다 — 항상 눈에 보이는 맨 앞/맨 뒤 점프로 한다 (#333).
  const bringToFront = () =>
    setItems((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.z), 0);
      return prev.map((p) => (p.furnitureId === selectedId ? { ...p, z: maxZ + 1 } : p));
    });
  const sendToBack = () =>
    setItems((prev) =>
      prev.map((p) => (p.furnitureId === selectedId ? { ...p, z: 1 } : { ...p, z: p.z + 1 })),
    );

  // What the open picker offers, owned first so placing needs no digging.
  // 보유중 filter hides the shop side of every picker (slot/surface/전체보기).
  const [ownedOnly, setOwnedOnly] = useState(false);
  // 전체보기 탭 — 서버 분류(surfaceSlotType: 가구/벽지/바닥/배경)별로 나눠
  // 한 번에 한 그리드만 보여준다 (통짜 세로 나열은 스크롤이 너무 길다).
  const [allTab, setAllTab] = useState<'furniture' | 'wallpaper' | 'floor' | 'background'>(
    'furniture',
  );
  const isSurfacePicker = picker === 'wallpaper' || picker === 'floor' || picker === 'background';
  const byOwnedFirst = <T extends { id: string }>(arr: T[]) =>
    (ownedOnly ? arr.filter((i) => owned.has(i.id)) : [...arr]).sort(
      (a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)),
    );

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
          {/* 캔버스 = 방과 정확히 같은 박스 — 오버레이 좌표·정규화의 기준.
              (preview의 padding 박스 기준으로 재면 저장 좌표가 어긋난다.) */}
          <View
            testID="decor-canvas"
            style={styles.canvas}
            onLayout={(e) =>
              setRoomSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.width })
            }>
            {/* 가구는 Room이 아니라 드래그 오버레이가 그린다 — 방은 표면만. */}
            <Room
              characterId={null}
              wallpaperId={wallpaperId}
              floorId={floorId}
              backgroundId={backgroundId}
              placements={[]}
              furniture={furniture}
              wallpapers={wallpapers}
              floors={floors}
              backgrounds={backgrounds}
              editable
              onRegionPress={onRegionPress}
              activeRegion={activeRegion}
            />
            {/* 선택 중에만 존재하는 투명 레이어 — 빈 캔버스 탭 = 선택 해제.
                아이템(z≥1)보다 아래라 가구 탭·드래그는 그대로 통과한다. */}
            {selectedId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="선택 해제"
                style={StyleSheet.absoluteFill}
                onPress={() => setSelectedId(null)}
              />
            ) : null}
            {roomSize.w > 0
              ? [...items]
                  .sort((a, b) => a.z - b.z)
                  .map((p) => {
                    const item = furniture.find((f) => f.id === p.furnitureId);
                    if (!item) return null;
                    return (
                      <DraggableFurniture
                        key={p.furnitureId}
                        item={item}
                        placement={p}
                        roomSize={roomSize}
                        selected={p.furnitureId === selectedId}
                        onSelect={setSelectedId}
                        onDragEnd={commitDrag}
                        onScaleEnd={commitScale}
                      />
                    );
                  })
              : null}
            {/* 캐릭터는 항상 가구 앞 — 오버레이(드래그 중 z 9999)보다 위 전용 레이어. */}
            <View pointerEvents="none" style={styles.characterLayer}>
              <CharacterAvatar
                characterId={characterId}
                animations={characterAnimations}
                style={styles.characterFigure}
              />
            </View>
            {/* 선택 툴바 (#333) — 캔버스 위 고정, 캐릭터 레이어보다도 위. */}
            {selectedId ? (
              <View style={[styles.toolbar, { backgroundColor: t.surface, borderColor: t.border }]}>
                {(
                  [
                    ['rotate-ccw', '왼쪽 회전', () => rotateSelected(-1)],
                    ['rotate-cw', '오른쪽 회전', () => rotateSelected(1)],
                    ['flip', '좌우 반전', flipSelected],
                    ['layer-up', '맨 앞으로', bringToFront],
                    ['layer-down', '맨 뒤로', sendToBack],
                    ['trash', '빼기', () => removeItem(selectedId)],
                  ] as const
                ).map(([icon, label, onPress]) => (
                  <Pressable
                    key={icon}
                    onPress={onPress}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    hitSlop={4}
                    style={[styles.toolBtn, { backgroundColor: t.surfaceMuted }]}>
                    <Icon name={icon} size={18} color={icon === 'trash' ? t.danger : t.text} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
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
            <Text style={[Typography.label, { color: t.text }]}>가구를 끌어서 꾸며보세요</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              가구를 끌어 원하는 곳으로 옮기고, 가구를 탭하면 회전·크기 조절·빼기를 할 수 있어요.
              벽·바닥을 누르면 벽지와 바닥을 바꿀 수 있어요.
            </Text>
            <Pressable
              onPress={() => setPicker('all')}
              accessibilityRole="button"
              accessibilityLabel="전체보기"
              style={[styles.allBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.primaryText }]}>전체보기</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !loadError && picker !== null ? (
          <View style={[styles.panel, { backgroundColor: t.surface }]}>
            <View style={styles.panelHead}>
              {picker === 'all' ? (
                // 전체보기: 서버 분류별 탭 — 가구·소품이 기본, 표면류는 있을 때만.
                <View style={styles.segment}>
                  {(
                    [
                      ['furniture', '가구·소품'] as const,
                      ['wallpaper', '벽지'] as const,
                      ...(floors.length > 0 ? [['floor', '바닥'] as const] : []),
                      ...(backgrounds.length > 0 ? [['background', '배경'] as const] : []),
                    ] as const
                  ).map(([key, label]) => {
                    const active = allTab === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setAllTab(key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${label} 탭`}
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

            <View style={styles.filterRow}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>보유중만 보기</Text>
              <ToggleSwitch
                value={ownedOnly}
                onToggle={() => setOwnedOnly((v) => !v)}
                accessibilityLabel="보유중만 보기"
              />
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
            {picker === 'all' && allTab === 'furniture' ? (
              <FurnitureGrid
                items={byOwnedFirst(furniture)}
                placed={placed}
                // 배치 안 된 가구는 방 가운데로 추가, 배치된 가구는 다시 빼기.
                onPlace={(item) =>
                  placed.includes(item.id) ? removeItem(item.id) : addItem(item.id)
                }
                owned={owned}
                diaBalance={diaBalance}
                onBuyRequest={setPendingBuy}
                onBlockedBuy={() => toast('다이아가 부족해요', 'error')}
                t={t}
              />
            ) : null}
            {picker === 'all' && allTab === 'wallpaper' ? (
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
            {picker === 'all' && allTab === 'floor' ? (
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
            {picker === 'all' && allTab === 'background' ? (
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
                  apply(true);
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

      {/* 첫 자유 배치 저장 — SLOT_V1→FREE_V1 비가역 전환 확인 (#327). */}
      <Modal
        transparent
        visible={confirmMigrate}
        animationType="fade"
        onRequestClose={() => setConfirmMigrate(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmMigrate(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>새 꾸미기 방식으로 전환할까요?</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              자유 배치로 저장하면 가구를 어디든 옮길 수 있어요.{'\n'}전환한 뒤에는 이전 방식으로
              되돌릴 수 없어요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConfirmMigrate(false)}
                accessibilityRole="button"
                accessibilityLabel="전환 취소"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  migrateOkRef.current = true;
                  setConfirmMigrate(false);
                  void doApply(pendingBackRef.current);
                }}
                accessibilityRole="button"
                accessibilityLabel="전환하고 저장"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>전환하고 저장</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 다른 기기가 먼저 저장한 경우(409) — 서버 상태로 다시 시작해야 한다. */}
      <Modal
        transparent
        visible={conflictOpen}
        animationType="fade"
        onRequestClose={() => setConflictOpen(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConflictOpen(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>다른 기기에서 먼저 저장했어요</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              방 배치가 다른 곳에서 바뀌어 지금 편집을 저장할 수 없어요.{'\n'}새로 불러오면 지금
              편집한 내용은 사라져요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConflictOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="충돌 모달 닫기"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>계속 보기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConflictOpen(false);
                  onConflictReload?.();
                  onBack?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="새로 불러오기"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>새로 불러오기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.applyBar, { backgroundColor: t.screen, borderTopColor: t.border }]}>
        <Pressable
          onPress={() => apply(true)}
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
  // 오버레이·정규화 좌표의 기준 박스 — Room(정사각)과 정확히 일치.
  canvas: {
    width: '100%',
    aspectRatio: 1,
  },
  // 캐릭터는 항상 가구 앞 (#327) — 드래그 중 아이템(z 9999)보다도 위.
  characterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  // 선택 툴바 (#333) — 캔버스 상단 중앙, 모든 레이어 위.
  toolbar: {
    position: 'absolute',
    top: Spacing.two,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: Spacing.one,
    zIndex: 10001,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Room의 캐릭터 배치와 동일한 자리 (absolute center-bottom, 42%).
  characterFigure: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '16%',
    width: '42%',
    height: '42%',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
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
