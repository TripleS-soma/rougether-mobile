import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 스토어 리뷰 요청 조건 (#1107) — 좋은 순간에만, 그것도 앱을 좀 써 본 사람에게만,
 * 한 번 요청하면 오래 쉰다. 시스템 시트(iOS SKStoreReviewController · Android In-App
 * Review)라 실제로 뜨는지는 OS가 정한다.
 *
 * **"잘 쓰고 계신가요?" 같은 사전 질문을 붙이지 말 것** — 만족한 사람만 스토어로 보내는
 * 리뷰 게이팅은 Google Play In-App Review 정책(카드 전에 질문 금지)과 Apple 5.6.1(시스템
 * API만, 자체 리뷰 팝업 금지) 위반이다(#1678). 좋은 순간을 고르는 것까지가 앱의 몫.
 */
export const STORE_REVIEW_KEY = 'rougether.store-review';
/** 설치(첫 실행) 뒤 이만큼 지나야 요청한다. 3일 → 2일(#1678, 28일간 요청 5명). */
export const MIN_DAYS_SINCE_FIRST_OPEN = 2;
/** 루틴 완료 누적이 이만큼 되어야 요청한다. 10회 → 5회(#1678). */
export const MIN_COMPLETIONS = 5;
/** 한 번 요청한 뒤 다시 요청하기까지. */
export const COOLDOWN_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 리뷰를 요청하는 좋은 순간 (#1678) — GA `review_prompt_requested.from`.
 * - all_done: 오늘 루틴을 전부 끝낸 순간(#1107)
 * - streak: 연속 달성이 STREAK_MILESTONES 중 하나에 닿은 순간
 * - mission_claim: 집 미션 보상을 받은 순간
 * - room_save: 방 꾸미기를 저장한 순간
 */
export type ReviewTrigger = 'all_done' | 'streak' | 'mission_claim' | 'room_save';
/** 연속 달성 마일스톤(일). */
export const STREAK_MILESTONES: readonly number[] = [7, 30, 100];

export type StoreReviewState = {
  /** 첫 실행 시각(ms) — 이 상태를 처음 만든 순간. */
  firstOpenAt: number;
  /** 루틴·할 일 완료 누적. */
  completions: number;
  /** 마지막 요청 시각(ms). 없으면 아직. */
  lastRequestedAt: number | null;
};

export function initialStoreReviewState(now: number): StoreReviewState {
  return { firstOpenAt: now, completions: 0, lastRequestedAt: null };
}

/** 순수 판정 — 훅·테스트가 같은 규칙을 본다. */
export function shouldRequestReview(state: StoreReviewState, now: number): boolean {
  if (now - state.firstOpenAt < MIN_DAYS_SINCE_FIRST_OPEN * DAY_MS) return false;
  if (state.completions < MIN_COMPLETIONS) return false;
  if (state.lastRequestedAt != null && now - state.lastRequestedAt < COOLDOWN_DAYS * DAY_MS)
    return false;
  return true;
}

export async function readStoreReviewState(now: number): Promise<StoreReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORE_REVIEW_KEY);
    if (!raw) return initialStoreReviewState(now);
    const parsed = JSON.parse(raw) as Partial<StoreReviewState>;
    return {
      firstOpenAt: typeof parsed.firstOpenAt === 'number' ? parsed.firstOpenAt : now,
      completions: typeof parsed.completions === 'number' ? parsed.completions : 0,
      lastRequestedAt: typeof parsed.lastRequestedAt === 'number' ? parsed.lastRequestedAt : null,
    };
  } catch {
    return initialStoreReviewState(now);
  }
}

export async function writeStoreReviewState(state: StoreReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_REVIEW_KEY, JSON.stringify(state));
  } catch {
    // 보관 실패는 조건 판정이 조금 보수적으로 흐를 뿐 — 조용히.
  }
}
