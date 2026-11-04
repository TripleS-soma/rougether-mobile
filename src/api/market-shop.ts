import { apiGet, apiGetPage, apiPost, apiPut } from '@/api/client';

export type MarketListing = {
  assetId: number;
  itemId: number;
  name: string;
  assetKey: string | null;
  creatorNickname: string | null;
  isCreator: boolean;
  price: number | null;
  selling: boolean;
  owned: boolean;
};
export type MarketReceipt = {
  purchaseId: number;
  assetId: number;
  userItemId: number;
  price: number;
};
export const fetchShopListings = (page: number, mine: boolean) =>
  apiGetPage<MarketListing>(`/market/shop?page=${page}&size=20&mine=${mine}`);
export const fetchShopListing = (id: number) => apiGet<MarketListing>(`/market/shop/${id}`);
export const sellShopListing = (userItemId: number, price: number) =>
  apiPost<MarketListing>('/market/shop', { userItemId, price });
export const updateShopListing = (id: number, price: number, selling: boolean) =>
  apiPut<MarketListing>(`/market/shop/${id}`, { price, selling });
export const purchaseShopListing = (id: number, expectedPrice: number, requestId: string) =>
  apiPost<MarketReceipt>(`/market/shop/${id}/purchase`, { expectedPrice, requestId });
