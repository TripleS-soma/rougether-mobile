/**
 * Shop catalogue + purchase + room placement, backed by the API. Loads the
 * catalogue (`GET /items`), the inventory (`GET /me/items`, itemId↔userItemId)
 * and the saved room layout (`GET /rooms/me`) on mount; 배치하기 persists via
 * `PUT /rooms/me/slots`. With no saved layout yet, the room seeds from owned
 * items client-side until the first save.
 */
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ApiError,
  fetchItems,
  fetchMyItems,
  fetchMyRoom,
  purchaseItem,
  updateRoomLayout,
} from '@/api';
import {
  fromRoomPlacements,
  fromRoomSlots,
  ownedPlacement,
  type ShopCatalogue,
  toLayoutPlacements,
  toShopCatalogue,
  toUserItemMap,
} from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import { type Wallet } from '@/constants/currency';
import { track } from '@/lib/analytics';
import {
  DEFAULT_WALLPAPER_ID,
  type PlacedFurniture,
  slotIdsToPlacements,
} from '@/resources/furniture';

const EMPTY: ShopCatalogue = {
  furniture: [],
  wallpapers: [],
  floors: [],
  backgrounds: [],
  ownedIds: [],
};

export type RoomPlacement = {
  /** 자유 배치 항목(#327) — placedFurnitureIds는 여기서 파생된 호환 뷰. */
  items: PlacedFurniture[];
  placedFurnitureIds: string[];
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
  /** 낙관적 잠금 리비전 — 저장 시 baseRevision으로 그대로 보낸다. */
  layoutRevision: number;
  /** 이미 FREE_V1로 전환된 방인지 — 첫 저장 확인 모달 판단. */
  freeLayout: boolean;
};

export function useShop(setWallet: Dispatch<SetStateAction<Wallet>>) {
  const [catalogue, setCatalogue] = useState<ShopCatalogue>(EMPTY);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [placement, setPlacement] = useState<RoomPlacement>({
    items: [],
    placedFurnitureIds: [],
    wallpaperId: DEFAULT_WALLPAPER_ID,
    floorId: null,
    backgroundId: null,
    layoutRevision: 0,
    freeLayout: false,
  });
  const { show: toast } = useToast();
  // itemId(string) → userItemId, needed to save placements.
  const userItemMapRef = useRef<Map<string, number>>(new Map());
  const catalogueRef = useRef<ShopCatalogue>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [items, myItems, room] = await Promise.all([
        fetchItems(),
        fetchMyItems().catch(() => []),
        fetchMyRoom().catch(() => null),
      ]);
      const cat = toShopCatalogue(items);
      userItemMapRef.current = toUserItemMap(myItems);
      catalogueRef.current = cat;
      setCatalogue(cat);
      setOwnedIds(cat.ownedIds);
      // Prefer the layout saved on the server; fall back to seeding from owned
      // items until the first save.
      const saved = room?.slots?.length
        ? fromRoomSlots(room.slots, cat, userItemMapRef.current)
        : null;
      const fallback = ownedPlacement(cat);
      const freeLayout = room?.layoutFormat === 'FREE_V1';
      // FREE_V1 방은 서버 placements 그대로, 슬롯 방은 앵커 좌표로 프리필해
      // 같은 모습에서 이어서 편집한다 (#327).
      const placedItems = freeLayout
        ? fromRoomPlacements(room?.placements ?? [], cat, userItemMapRef.current)
        : slotIdsToPlacements(
            saved?.placedFurnitureIds ?? fallback.placedFurnitureIds,
            cat.furniture,
          );
      setPlacement({
        items: placedItems,
        placedFurnitureIds: placedItems.map((p) => p.furnitureId),
        wallpaperId: saved?.wallpaperId ?? fallback.wallpaperId,
        floorId: saved ? saved.floorId : fallback.floorId,
        backgroundId: saved ? saved.backgroundId : fallback.backgroundId,
        layoutRevision: room?.layoutRevision ?? 0,
        freeLayout,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Buy an item with dia. Returns true on success (false on insufficient funds). */
  const purchase = async (itemId: string): Promise<boolean> => {
    try {
      const res = await purchaseItem(Number(itemId));
      const w = res.wallet;
      if (w?.currencyType && w.balance != null) {
        // Purchase returns only the spent currency — merge, don't replace.
        setWallet((prev) => ({
          ...prev,
          [w.currencyType === 'COIN' ? 'coin' : 'dia']: w.balance as number,
        }));
      }
      setOwnedIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
      track('shop_purchase', { itemId });
      // Track the new userItemId so the item can be placed + saved right away.
      if (res.itemId != null && res.userItemId != null)
        userItemMapRef.current.set(String(res.itemId), res.userItemId);
      toast('구매 완료!', 'success');
      return true;
    } catch (err) {
      const broke =
        err instanceof ApiError &&
        err.status === 409 &&
        err.bodyText?.includes('SHOP_INSUFFICIENT_BALANCE');
      toast(broke ? '다이아가 부족해요' : '구매에 실패했어요', 'error');
      return false;
    }
  };

  /**
   * Re-sync the inventory after items were acquired outside the shop (가챠
   * draws) — otherwise fresh rewards keep showing as buyable in 방 꾸미기 and
   * can't be placed (their userItemId is unknown to placement saves).
   */
  const refreshOwned = useCallback(async () => {
    try {
      const myItems = await fetchMyItems();
      const map = toUserItemMap(myItems);
      userItemMapRef.current = map;
      setOwnedIds((prev) => Array.from(new Set([...prev, ...map.keys()])));
    } catch {
      // Non-fatal: the next full catalogue load catches up.
    }
  }, []);

  /**
   * 자유 배치 저장 (PUT /rooms/me/layout, #327). 'conflict'는 다른 기기가 먼저
   * 저장한 경우(409 REVISION_CONFLICT) — 화면이 재로드 모달을 띄운다.
   */
  const saveLayout = async (
    items: PlacedFurniture[],
    wallpaperId: string,
    floorId: string | null = null,
    backgroundId: string | null = null,
  ): Promise<'ok' | 'conflict' | 'fail'> => {
    const map = userItemMapRef.current;
    const surfaceUid = (id: string | null) => (id ? (map.get(id) ?? null) : null);
    try {
      const res = await updateRoomLayout({
        baseRevision: placement.layoutRevision,
        surfaceSlots: [
          { slotType: 'wallpaper', userItemId: surfaceUid(wallpaperId) },
          { slotType: 'floor', userItemId: surfaceUid(floorId) },
          { slotType: 'background', userItemId: surfaceUid(backgroundId) },
        ],
        placements: toLayoutPlacements(items, map),
      });
      setPlacement({
        items,
        placedFurnitureIds: items.map((p) => p.furnitureId),
        wallpaperId,
        floorId,
        backgroundId,
        layoutRevision: res.layoutRevision ?? placement.layoutRevision + 1,
        freeLayout: true,
      });
      toast('방 배치를 저장했어요', 'success');
      return 'ok';
    } catch (err) {
      if (err instanceof ApiError && err.bodyText?.includes('ROOM_LAYOUT_REVISION_CONFLICT')) {
        return 'conflict';
      }
      toast('방 배치 저장에 실패했어요', 'error');
      return 'fail';
    }
  };

  return {
    catalogue,
    ownedIds,
    placement,
    loading,
    error,
    retry: load,
    purchase,
    refreshOwned,
    saveLayout,
  };
}
