/** Current user + wallet endpoints. */
import { apiGet, apiGetList, apiPut } from './client';
import type { MeResponse, WalletResponse } from './types';

/** GET /me — the authenticated user's profile. */
export function fetchMe() {
  return apiGet<MeResponse>('/me');
}

/** GET /me/wallets — the user's currency balances (coin / diamond). */
export function fetchWallets() {
  return apiGetList<WalletResponse>('/me/wallets');
}

/**
 * PUT /me — update the profile (nickname). Not in the server spec yet — wired
 * ahead so it lights up the moment the backend ships it (#104).
 */
export function updateMe(body: { nickname: string }) {
  return apiPut<MeResponse>('/me', body);
}
