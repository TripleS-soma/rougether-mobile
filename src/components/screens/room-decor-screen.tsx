import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  dragClampBounds,
  SCALE_MAX,
  SCALE_MIN,
} from '@/components/room/draggable-furniture';
import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Room, type RoomRegion } from '@/components/room/room';
import { ROOM_RENDER_CONTRACT, roomPercent } from '@/components/room/room-render-contract';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Overlay, Radius, Spacing } from '@/constants/theme';
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
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * What the picker panel is currently choosing for: the full catalog ('all',
 * 기본 상태 — 항상 열려 있다 #487), or one of the surface layers. Tapping the
 * room's wall opens the wallpaper picker (with a 배경 segment); tapping the
 * floor band opens the floor picker. null 상태는 없다 — 서브픽커를 닫으면
 * 'all'로 복귀한다.
 */
type PickerTarget = 'wallpaper' | 'floor' | 'background' | 'all';

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
  /**
   * Buy a not-yet-owned catalog item with dia. Resolve true on success —
   * 일괄 구매(프리뷰 확인 모달)가 실패 시 저장을 중단한다 (#501).
   */
  onBuy?: (itemId: string) => Promise<boolean> | void;
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
  const Typography = useTypography();
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

  // --- 프리뷰 (#501): 미보유인데 배치/적용돼 있는 아이템. 별도 상태 없이
  // owned와의 차집합으로 유도한다 — 구매 성공으로 ownedIds가 갱신되면 그
  // 자리에서 자동으로 정식 배치가 된다.
  type SurfaceKind = 'wallpaper' | 'floor' | 'background';
  const SURFACE_LABEL: Record<SurfaceKind, string> = {
    wallpaper: '벽지',
    floor: '바닥',
    background: '배경',
  };
  const surfacePreviews = useMemo(() => {
    const out: { kind: SurfaceKind; id: string; name: string; price: number }[] = [];
    // 진입 시점 값(서버 저장/시드)은 미보유여도 프리뷰가 아니다 — 사용자가
    // 고르지 않은 표면의 구매를 강요하지 않는다 (신규 계정 기본 벽지 등).
    const push = (
      kind: SurfaceKind,
      id: string | null,
      initial: string | null,
      arr: Wallpaper[],
    ) => {
      if (!id || id === initial || owned.has(id)) return;
      const it = arr.find((w) => w.id === id);
      if (it) out.push({ kind, id: it.id, name: it.name, price: it.price });
    };
    push('wallpaper', wallpaperId, initialWallpaperId, wallpapers);
    push('floor', floorId, initialFloorId, floors);
    push('background', backgroundId, initialBackgroundId, backgrounds);
    return out;
  }, [
    owned,
    wallpaperId,
    floorId,
    backgroundId,
    wallpapers,
    floors,
    backgrounds,
    initialWallpaperId,
    initialFloorId,
    initialBackgroundId,
  ]);
  const furniturePreviews = useMemo(
    () =>
      items
        .filter((pl) => !owned.has(pl.furnitureId))
        .map((pl) => furniture.find((f) => f.id === pl.furnitureId))
        .filter((f): f is FurnitureItem => !!f)
        .map((f) => ({ id: f.id, name: f.name, price: f.price })),
    [items, owned, furniture],
  );
  /** 적용 시점에 구매가 필요한 프리뷰 전체 (가구 + 표면류). */
  const pendingPreviews = useMemo(
    () => [
      ...furniturePreviews,
      ...surfacePreviews.map(({ id, name, price }) => ({ id, name, price })),
    ],
    [furniturePreviews, surfacePreviews],
  );
  const previewTotal = pendingPreviews.reduce((sum, i) => sum + i.price, 0);
  // 적용하기 시 미구매 프리뷰 일괄 확인 모달 (#501).
  const [confirmPreviews, setConfirmPreviews] = useState(false);
  const [bulkBuying, setBulkBuying] = useState(false);
  // 진입 즉시 가구 패널이 열려 있다 (#487) — 전체보기 버튼/가이드 카드 없이
  // 'all'이 기본 상태. 서브픽커(벽지/바닥)를 닫으면 'all'로 복귀한다.
  const [picker, setPicker] = useState<PickerTarget>('all');
  // 첫 자유 배치 저장은 SLOT_V1→FREE_V1 비가역 전환 — 한 번 확인받는다 (#327).
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const migrateOkRef = useRef(freeLayout);
  const pendingBackRef = useRef(true);
  // 409 리비전 충돌(다른 기기 선저장) — 재로드 안내 모달.
  const [conflictOpen, setConflictOpen] = useState(false);

  type ApplyValues = {
    items: PlacedFurniture[];
    wallpaperId: string;
    floorId: string | null;
    backgroundId: string | null;
  };
  const currentValues = (): ApplyValues => ({ items, wallpaperId, floorId, backgroundId });
  // 제외하고 저장 등에서 넘어온 값 — 마이그레이션 확인을 건너뛴 뒤에도 유지.
  const pendingApplyRef = useRef<ApplyValues | null>(null);
  const doApply = async (thenBack: boolean, v: ApplyValues = currentValues()) => {
    const result = await onApply?.(v.items, v.wallpaperId, v.floorId, v.backgroundId);
    if (result === 'conflict') return setConflictOpen(true);
    if (result === 'fail') return; // 실패 토스트는 훅이 띄운다.
    initialSnapRef.current = snap(v.items, v.wallpaperId, v.floorId, v.backgroundId);
    if (thenBack) onBack?.();
  };
  /** 프리뷰 정리가 끝난 값으로 저장을 이어간다 — 마이그레이션 게이트 포함. */
  const proceedApply = (thenBack: boolean, v: ApplyValues) => {
    if (!migrateOkRef.current) {
      pendingBackRef.current = thenBack;
      pendingApplyRef.current = v;
      setConfirmMigrate(true);
      return;
    }
    void doApply(thenBack, v);
  };
  const apply = (thenBack = true) => {
    // 미구매 프리뷰가 남아 있으면 일괄 확인부터 (#501) — 서버는 미보유를
    // 저장할 수 없다(placement에 userItemId 필수).
    if (pendingPreviews.length > 0) {
      pendingBackRef.current = thenBack;
      setConfirmPreviews(true);
      return;
    }
    proceedApply(thenBack, currentValues());
  };
  /** 프리뷰를 뺀 저장값 — 표면류는 진입 시점 값으로 복원한다. */
  const strippedValues = (): ApplyValues => ({
    items: items.filter((pl) => owned.has(pl.furnitureId)),
    wallpaperId: owned.has(wallpaperId) ? wallpaperId : initialWallpaperId,
    floorId: floorId && owned.has(floorId) ? floorId : initialFloorId,
    backgroundId: backgroundId && owned.has(backgroundId) ? backgroundId : initialBackgroundId,
  });
  const saveWithoutPreviews = () => {
    const v = strippedValues();
    // 화면 상태도 저장값과 맞춘다 — 프리뷰가 방에 남아 보이면 안 된다.
    setItems(v.items);
    setWallpaperId(v.wallpaperId);
    setFloorId(v.floorId);
    setBackgroundId(v.backgroundId);
    setConfirmPreviews(false);
    proceedApply(pendingBackRef.current, v);
  };
  const buyAllAndSave = async () => {
    if (!onBuy) return;
    setBulkBuying(true);
    try {
      for (const pv of pendingPreviews) {
        const ok = await onBuy(pv.id);
        if (ok === false) {
          // 실패(잔액 부족 등) 토스트는 구매 훅이 띄운다 — 모달을 닫고
          // 프리뷰는 그대로 두어 사용자가 정리하게 한다.
          setConfirmPreviews(false);
          return;
        }
      }
      setConfirmPreviews(false);
      proceedApply(pendingBackRef.current, currentValues());
    } finally {
      setBulkBuying(false);
    }
  };
  const handleBack = () => {
    if (dirty) setConfirmLeave(true);
    else onBack?.();
  };
  // Android hardware back: close the picker first, then run the same
  // unsaved-changes guard; without a reason we fall through to the shell.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // 서브픽커만 닫는다 — 'all'은 기본 상태라 다음 가드(dirty)로 넘어간다 (#487).
      if (picker !== 'all') {
        setPicker('all');
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
  /** 구매 진입점 공통 (#501) — 잔액 부족은 모달 대신 토스트로 끝낸다. */
  const requestBuy = (item: { id: string; name: string; price: number }) => {
    if (diaBalance < item.price) {
      toast('다이아가 부족해요', 'error');
      return;
    }
    setPendingBuy(item);
  };

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
  // 프리뷰 가구는 "선택된 상태에서 한 번 더 탭"이 구매다 (#501).
  const handleFurnitureSelect = (id: string) => {
    if (selectedId === id && !owned.has(id)) {
      const item = furniture.find((f) => f.id === id);
      if (item) requestBuy({ id: item.id, name: item.name, price: item.price });
      return;
    }
    setSelectedId(id);
  };

  /** 아이템별 FREE 기본 위치에 새 가구를 놓는다 — 같은 가구는 방에 1개만. */
  const addItem = (item: FurnitureItem) => {
    if (items.some((p) => p.furnitureId === item.id)) {
      toast('이미 배치된 가구예요', 'error');
      return;
    }
    const maxZ = items.reduce((m, p) => Math.max(m, p.z), 0);
    const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, item.defaultScale ?? 1));
    const center = ROOM_RENDER_CONTRACT.furniture.newPlacementCenter;
    const hasItemDefault =
      typeof item.defaultPositionX === 'number' && typeof item.defaultPositionY === 'number';
    const preferredX = hasItemDefault ? item.defaultPositionX! : center.x;
    const preferredY = hasItemDefault ? item.defaultPositionY! : center.y;
    const bounds = dragClampBounds(scale);
    const clamp = (value: number) => Math.min(bounds.max, Math.max(bounds.min, value));
    const x = clamp(preferredX);
    const y = clamp(preferredY);
    setItems((prev) => [...prev, { furnitureId: item.id, x, y, z: maxZ + 1, scale }]);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.furnitureId !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };
  /** 드래그 종료 — 방 안으로 클램프해 좌표 커밋 + 최상위 승격. */
  const commitDrag = (id: string, x: number, y: number) => {
    setItems((prev) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.z), 0);
      const target = prev.find((p) => p.furnitureId === id);
      const bounds = dragClampBounds(target?.scale ?? 1);
      const clamp = (v: number) => Math.min(bounds.max, Math.max(bounds.min, v));
      return prev.map((p) =>
        p.furnitureId === id ? { ...p, x: clamp(x), y: clamp(y), z: maxZ + 1 } : p,
      );
    });
  };
  /** 핀치/핸들 종료 — 스케일 클램프 후 커밋 (#333). */
  const commitScale = (id: string, scale: number) => {
    const clamped = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) * 100) / 100;
    const bounds = dragClampBounds(clamped);
    const clamp = (v: number) => Math.min(bounds.max, Math.max(bounds.min, v));
    setItems((prev) =>
      prev.map((p) =>
        p.furnitureId === id ? { ...p, x: clamp(p.x), y: clamp(p.y), scale: clamped } : p,
      ),
    );
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
  // 전체보기 탭 — 표면류(surfaceSlotType: 벽지/바닥/배경)에 더해, positioned
  // 아이템은 categoryCode(가구/소품)로 한 번 더 나눈다 (#488). 한 번에 한
  // 그리드만 — 통짜 세로 나열은 스크롤이 너무 길다.
  const [allTab, setAllTab] = useState<
    'furniture' | 'decor' | 'wallpaper' | 'floor' | 'background'
  >('furniture');
  // 소품 = 서버 categoryCode 'decor'(장식)와 'floor'(러그); 가구 = 나머지
  // (서버 'furniture', 데모 '한옥' 세트 포함).
  const isDecorItem = (i: FurnitureItem) => i.category === '장식' || i.category === '러그';
  const furnitureTabItems = useMemo(() => furniture.filter((i) => !isDecorItem(i)), [furniture]);
  const decorTabItems = useMemo(() => furniture.filter(isDecorItem), [furniture]);
  const isSurfacePicker = picker === 'wallpaper' || picker === 'floor' || picker === 'background';
  const byOwnedFirst = useCallback(
    <T extends { id: string }>(arr: T[]) =>
      (ownedOnly ? arr.filter((i) => owned.has(i.id)) : [...arr]).sort(
        (a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)),
      ),
    [ownedOnly, owned],
  );
  const sortedWallpapers = useMemo(() => byOwnedFirst(wallpapers), [byOwnedFirst, wallpapers]);
  const sortedFloors = useMemo(() => byOwnedFirst(floors), [byOwnedFirst, floors]);
  const sortedBackgrounds = useMemo(() => byOwnedFirst(backgrounds), [byOwnedFirst, backgrounds]);
  const sortedFurnitureTabItems = useMemo(
    () => byOwnedFirst(furnitureTabItems),
    [byOwnedFirst, furnitureTabItems],
  );
  const sortedDecorTabItems = useMemo(
    () => byOwnedFirst(decorTabItems),
    [byOwnedFirst, decorTabItems],
  );

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      {/* 헤더 대신 화면 고정 플로팅 (#510) — 패널이 그만큼 올라와 가구가 더
          보인다. 뒤로가기는 상시 접근, 재화는 프리뷰 구매(#501) 잔액 확인용. */}
      <ScrollView contentContainerStyle={[styles.body, headerInset]}>
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
                        onSelect={handleFurnitureSelect}
                        onDragEnd={commitDrag}
                        onScaleEnd={commitScale}
                        preview={!owned.has(p.furnitureId)}
                        previewPrice={item.price}
                      />
                    );
                  })
              : null}
            {/* 표면류 프리뷰 가격 칩 (#501) — 탭하면 구매 확인. */}
            {surfacePreviews.length > 0 ? (
              <View style={styles.previewChips} pointerEvents="box-none">
                {surfacePreviews.map((sp) => (
                  <Pressable
                    key={sp.kind}
                    onPress={() => requestBuy({ id: sp.id, name: sp.name, price: sp.price })}
                    accessibilityRole="button"
                    accessibilityLabel={`${SURFACE_LABEL[sp.kind]} 프리뷰 구매`}
                    style={[
                      styles.previewChip,
                      { backgroundColor: t.surface, borderColor: t.border },
                    ]}>
                    <Icon name="dia" size={10} color={t.primary} />
                    <Text style={[Typography.supporting, { color: t.text }]}>
                      {SURFACE_LABEL[sp.kind]} {sp.price}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
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

        {!loading && !loadError ? (
          <View style={[styles.panel, { backgroundColor: t.surface }]}>
            <View style={styles.panelHead}>
              {picker === 'all' ? (
                // 전체보기: 서버 분류별 탭 — 가구가 기본, 소품(categoryCode
                // decor·러그)은 분리, 표면류는 있을 때만 (#488).
                <View style={styles.segment}>
                  {(
                    [
                      ['furniture', '가구'] as const,
                      ['decor', '소품'] as const,
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
              {/* 'all'은 기본 상태라 닫을 곳이 없다 — 서브픽커에서만 전체로 복귀 (#487). */}
              {picker !== 'all' ? (
                <Pressable
                  onPress={() => setPicker('all')}
                  accessibilityRole="button"
                  accessibilityLabel="선택 닫기"
                  hitSlop={8}
                  style={[styles.closeBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="close" size={14} color={t.text} />
                </Pressable>
              ) : null}
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
                items={sortedWallpapers}
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
                items={sortedFloors}
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
                items={sortedBackgrounds}
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
            {picker === 'all' && (allTab === 'furniture' || allTab === 'decor') ? (
              <FurnitureGrid
                items={allTab === 'furniture' ? sortedFurnitureTabItems : sortedDecorTabItems}
                placed={placed}
                // 배치 안 된 가구는 방 가운데로 추가, 배치된 가구는 다시 빼기.
                onPlace={(item) => (placed.includes(item.id) ? removeItem(item.id) : addItem(item))}
                owned={owned}
                t={t}
              />
            ) : null}
            {picker === 'all' && allTab === 'wallpaper' ? (
              <SwatchGrid
                items={sortedWallpapers}
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
                items={sortedFloors}
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
                items={sortedBackgrounds}
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

      {/* 화면 고정 플로팅 뒤로가기·재화 (#510) — 스크롤과 무관하게 유지. */}
      <View style={[styles.floatBar, headerInset]} pointerEvents="box-none">
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[
            styles.iconBtn,
            styles.floatBtn,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <View
          style={[
            styles.floatBtn,
            styles.floatWallet,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}>
          <WalletPills coin={coinBalance} dia={diaBalance} />
        </View>
      </View>

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

      {/* 적용 시 미구매 프리뷰 일괄 확인 (#501) — 서버는 미보유 저장 불가. */}
      <Modal
        transparent
        visible={confirmPreviews}
        animationType="fade"
        onRequestClose={() => setConfirmPreviews(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmPreviews(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>
              구매하지 않은 프리뷰가 {pendingPreviews.length}개 있어요
            </Text>
            <View style={styles.previewList}>
              {pendingPreviews.map((pv) => (
                <View key={pv.id} style={styles.previewRow}>
                  <Text style={[Typography.body, styles.flex, { color: t.text }]} numberOfLines={1}>
                    {pv.name}
                  </Text>
                  <View style={styles.priceRow}>
                    <Icon name="dia" size={11} color={t.primary} />
                    <Text style={[Typography.body, { color: t.text }]}>{pv.price}</Text>
                  </View>
                </View>
              ))}
              <View
                style={[styles.previewRow, styles.previewTotalRow, { borderTopColor: t.border }]}>
                <Text style={[Typography.body, styles.flex, { color: t.textMuted }]}>
                  합계 (보유 {diaBalance})
                </Text>
                <View style={styles.priceRow}>
                  <Icon name="dia" size={11} color={t.primary} />
                  <Text style={[Typography.body, { color: t.text }]}>{previewTotal}</Text>
                </View>
              </View>
            </View>
            <View style={styles.leaveBtns}>
              <Pressable
                onPress={() => void buyAllAndSave()}
                disabled={bulkBuying || !onBuy || diaBalance < previewTotal}
                accessibilityRole="button"
                accessibilityLabel="모두 구매하고 저장"
                accessibilityState={{ disabled: bulkBuying || !onBuy || diaBalance < previewTotal }}
                style={[
                  styles.leaveBtn,
                  {
                    backgroundColor:
                      bulkBuying || !onBuy || diaBalance < previewTotal ? t.disabledBg : t.primary,
                  },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    {
                      color:
                        bulkBuying || !onBuy || diaBalance < previewTotal
                          ? t.textMuted
                          : t.onPrimary,
                    },
                  ]}>
                  {bulkBuying
                    ? '구매 중…'
                    : diaBalance < previewTotal
                      ? '다이아가 부족해요'
                      : '모두 구매하고 저장'}
                </Text>
              </Pressable>
              <Pressable
                onPress={saveWithoutPreviews}
                disabled={bulkBuying}
                accessibilityRole="button"
                accessibilityLabel="제외하고 저장"
                style={[styles.leaveBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>프리뷰 제외하고 저장</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmPreviews(false)}
                accessibilityRole="button"
                accessibilityLabel="프리뷰 계속 보기"
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
                  void doApply(pendingBackRef.current, pendingApplyRef.current ?? undefined);
                  pendingApplyRef.current = null;
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
  const emph = useFontEmphasis();
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
      <Text style={[styles.tileName, emph('medium'), { color: t.textMuted }]}>비우기</Text>
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
        // 프리뷰(#501)도 선택 링을 받는다 — 적용 중인 표면이 곧 프리뷰다.
        const active = item.id === selectedId;
        const affordable = diaBalance >= item.price;
        return (
          <Pressable
            key={item.id}
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

/**
 * Furniture picker grid for one slot: tap places (replacing the slot).
 * 미보유도 프리뷰로 배치되므로(#501) 구매 관련 prop이 없다 — 구매는 방의
 * 프리뷰 재탭/툴바에서.
 */
function FurnitureGrid({
  items,
  placed,
  onPlace,
  onClear,
  owned,
  t,
}: {
  items: FurnitureItem[];
  placed: string[];
  onPlace: (item: FurnitureItem) => void;
  onClear?: () => void;
  owned: Set<string>;
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
    <View style={styles.grid}>
      <ClearTile onClear={onClear} t={t} />
      {items.map((item) => {
        const isOwned = owned.has(item.id);
        // 프리뷰(#501)도 배치 상태 링을 받는다.
        const active = placed.includes(item.id);
        return (
          <Pressable
            key={item.id}
            // 미보유도 일단 배치(프리뷰) — 구매는 방의 프리뷰를 다시 탭 (#501).
            onPress={() => onPlace(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={isOwned ? item.name : `${item.name} 미리 배치`}
            style={[
              styles.tile,
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
            {/* 이름은 표시하지 않는다 (#487) — 접근성 라벨은 유지. */}
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
  floatBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  floatBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    // 그리드 위에 떠도 가독되게 살짝 띄운 카드 느낌.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floatWallet: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  flex: {
    flex: 1,
  },
  previewChips: {
    position: 'absolute',
    // 플로팅 뒤로가기(#510) 아래로 — 캔버스 상단은 버튼 차지.
    top: Spacing.two + 48,
    left: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    zIndex: 10000,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewList: {
    alignSelf: 'stretch',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  previewTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
    marginTop: Spacing.half,
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
    aspectRatio: ROOM_RENDER_CONTRACT.room.aspectRatio,
  },
  // 캐릭터는 항상 가구 앞 (#327) — 드래그 중 아이템(z 9999)보다도 위.
  characterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  // 선택 툴바 (#333) — 캔버스 상단 중앙, 모든 레이어 위.
  toolbar: {
    position: 'absolute',
    // 플로팅 재화 필(#510)과 겹치지 않게 버튼 줄 아래에서 시작.
    top: Spacing.two + 48,
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
    left: roomPercent(
      ROOM_RENDER_CONTRACT.character.centerX - ROOM_RENDER_CONTRACT.character.width / 2,
    ),
    bottom: roomPercent(ROOM_RENDER_CONTRACT.character.bottom),
    width: roomPercent(ROOM_RENDER_CONTRACT.character.width),
    height: roomPercent(ROOM_RENDER_CONTRACT.character.height),
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
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
    backgroundColor: Overlay.dim,
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
