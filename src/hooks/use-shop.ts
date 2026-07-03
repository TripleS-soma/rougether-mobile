/**
 * Shop catalogue + purchase, backed by the API (`GET /items`,
 * `POST /items/{id}/purchase`). Loads the item catalogue on mount and derives a
 * starting room from the owned items. Purchasing spends dia server-side and
 * returns the updated wallet.
 *
 * Note: server-side room *placement* (`PUT /rooms/me/slots`) needs a `userItemId`
 * that's only returned at purchase time — with no inventory endpoint, owned
 * items can't be re-placed — so arrangement stays client-side for now.
 */
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import { fetchItems, purchaseItem } from '@/api';
import { ownedPlacement, type ShopCatalogue, toShopCatalogue } from '@/api/adapters';
import { type Wallet } from '@/constants/currency';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

const EMPTY: ShopCatalogue = { furniture: [], wallpapers: [], ownedIds: [] };

export function useShop(setWallet: Dispatch<SetStateAction<Wallet>>) {
  const [catalogue, setCatalogue] = useState<ShopCatalogue>(EMPTY);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [placement, setPlacement] = useState<{
    placedFurnitureIds: string[];
    wallpaperId: string;
  }>({ placedFurnitureIds: [], wallpaperId: DEFAULT_WALLPAPER_ID });

  useEffect(() => {
    let active = true;
    fetchItems()
      .then((items) => {
        if (!active) return;
        const cat = toShopCatalogue(items);
        setCatalogue(cat);
        setOwnedIds(cat.ownedIds);
        setPlacement(ownedPlacement(cat));
      })
      .catch(() => {
        // Non-fatal; the shop shows an empty catalogue.
      });
    return () => {
      active = false;
    };
  }, []);

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
      return true;
    } catch {
      return false;
    }
  };

  return { catalogue, ownedIds, placement, purchase };
}
