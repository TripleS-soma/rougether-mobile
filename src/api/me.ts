/** Current user + wallet endpoints. */
import { apiDelete, apiGet, apiGetList, apiPut } from './client';
import type {
  CharacterSelectResponse,
  MeResponse,
  MemberUpdateRequest,
  MyCharacterItem,
  MyItemSummary,
  WalletHistoryListResponse,
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

/**
 * GET /me/wallets/histories — 재화 증감 이력, 최신순 페이지 (#734).
 * 완료 취소 시 해당 적립 이력은 서버에서 삭제되어 목록에서 사라진다.
 */
export function fetchWalletHistories(page: number, size = 20) {
  return apiGet<WalletHistoryListResponse>(`/me/wallets/histories?page=${page}&size=${size}`);
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
 * DELETE /me — 회원탈퇴 (#547, 서버 #235). 서버가 한 트랜잭션에서 soft
 * delete + 토큰 전량 폐기 + 소셜 연동 삭제 + 개인정보 즉시 파기를 수행하고,
 * 커밋 후 카카오 unlink·애플 revoke를 best-effort로 호출한다. 204 응답.
 * 재로그인은 새 계정 신규 가입이 된다(기존 데이터 미복원).
 */
export function deleteMe() {
  return apiDelete<void>('/me');
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
