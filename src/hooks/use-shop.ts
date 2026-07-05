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
  updateRoomSlots,
} from '@/api';
import {
  fromRoomSlots,
  ownedPlacement,
  type ShopCatalogue,
  toShopCatalogue,
  toSlotSaves,
  toUserItemMap,
} from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import { type Wallet } from '@/constants/currency';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

const EMPTY: ShopCatalogue = {
  furniture: [],
  wallpapers: [],
  floors: [],
  backgrounds: [],
  ownedIds: [],
};

export type RoomPlacement = {
  placedFurnitureIds: string[];
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
};

export function useShop(setWallet: Dispatch<SetStateAction<Wallet>>) {
  const [catalogue, setCatalogue] = useState<ShopCatalogue>(EMPTY);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [placement, setPlacement] = useState<RoomPlacement>({
    placedFurnitureIds: [],
    wallpaperId: DEFAULT_WALLPAPER_ID,
    floorId: null,
    backgroundId: null,
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
      setPlacement(
        saved
          ? {
              placedFurnitureIds: saved.placedFurnitureIds,
              wallpaperId: saved.wallpaperId ?? fallback.wallpaperId,
              floorId: saved.floorId,
              backgroundId: saved.backgroundId,
            }
          : fallback,
      );
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

  /** Persist the room layout (PUT /rooms/me/slots). Returns false on failure. */
  const savePlacement = async (
    placedIds: string[],
    wallpaperId: string,
    floorId: string | null = null,
    backgroundId: string | null = null,
  ): Promise<boolean> => {
    setPlacement({ placedFurnitureIds: placedIds, wallpaperId, floorId, backgroundId });
    try {
      await updateRoomSlots(
        toSlotSaves(
          placedIds,
          wallpaperId,
          catalogueRef.current,
          userItemMapRef.current,
          floorId,
          backgroundId,
        ),
      );
      toast('방 배치를 저장했어요', 'success');
      return true;
    } catch {
      toast('방 배치 저장에 실패했어요', 'error');
      return false;
    }
  };

  return { catalogue, ownedIds, placement, loading, error, retry: load, purchase, savePlacement };
}
