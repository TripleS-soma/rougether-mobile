import { apiGet, apiPost } from './client';

export type LoginGift = {
  participationId: number;
  code: string;
  title: string;
  eligibleAt: string;
  grantedAt: string | null;
  acknowledgedAt: string | null;
  coinAmount: number;
  reward: { itemId: number; name: string; assetKey: string; userItemId: number | null };
};

export type LoginGiftList = { gifts: LoginGift[] };

/** Reading and acknowledging a receipt never grants or re-grants a reward. */
export const fetchLoginGifts = () => apiGet<LoginGiftList>('/events/login-gifts');
export const acknowledgeLoginGift = (participationId: number) =>
  apiPost<void>(`/events/login-gifts/${participationId}/acknowledgement`);
