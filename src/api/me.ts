/** Current user + wallet endpoints. */
import { apiGet, apiGetList } from './client';
import type { MeResponse, WalletResponse } from './types';

/** GET /me — the authenticated user's profile. */
export function fetchMe() {
  return apiGet<MeResponse>('/me');
}

/** GET /me/wallets — the user's currency balances (coin / diamond). */
export function fetchWallets() {
  return apiGetList<WalletResponse>('/me/wallets');
}
