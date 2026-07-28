/** Current user + wallet endpoints. */
import { apiGet, apiGetList, apiPut } from './client';
import type {
  CharacterSelectResponse,
  MeResponse,
  MemberUpdateRequest,
  MyCharacterItem,
  MyItemSummary,
  WalletResponse,
} from './types';

// Single-flight /me — concurrent boot callers share one in-flight request.
let meInFlight: Promise<MeResponse> | null = null;

/** GET /me — the authenticated user's profile. */
export function fetchMe() {
  if (!meInFlight) {
    meInFlight = apiGet<MeResponse>('/me').finally(() => {
      meInFlight = null;
    });
  }
  return meInFlight;
}

/** GET /me/wallets — the user's currency balances (coin / diamond). */
export function fetchWallets() {
  return apiGetList<WalletResponse>('/me/wallets');
}

/** GET /me/items — owned-item inventory (userItemId ↔ itemId, for room placement). */
export function fetchMyItems() {
  return apiGetList<MyItemSummary>('/me/items');
}

/** PUT /me — update the profile (nickname, ≤30 chars, no blanks). */
export function updateMe(body: MemberUpdateRequest) {
  return apiPut<MeResponse>('/me', body);
}

/**
 * GET /me/characters — owned characters (master sortOrder). Exactly one item
 * has selected=true: the character shown in the room. Retired (inactive)
 * characters are excluded even when owned.
 */
export function fetchMyCharacters() {
  return apiGetList<MyCharacterItem>('/me/characters');
}

/** PUT /me/characters/select — switch the worn character (owned only; 409 CHARACTER_NOT_OWNED). */
export function selectCharacter(characterId: number) {
  return apiPut<CharacterSelectResponse>('/me/characters/select', { characterId });
}
