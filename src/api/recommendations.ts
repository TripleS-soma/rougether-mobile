/**
 * AI 조정 추천 (#1006, 서버 #329·#333·#336) — 주간 실패 패턴에서 나온 반복
 * 스케줄 조정 제안. 목록·수락·무시 3개가 전부이고 요청 본문은 없다.
 *
 * 문구(`message`)는 서버가 한국어 템플릿으로 완성해 내려주므로 앱은 조립하지
 * 않고 그대로 노출한다.
 */
import { apiGetList, apiPost } from './client';
import type { RoutineResponse } from './types';

/** 제안 스케줄 — 수락하면 이 값이 루틴 반복에 그대로 적용된다. */
export type RecommendationProposal = {
  /** MVP 조정 추천은 항상 WEEKLY. */
  repeatType?: string;
  /** 루틴 등록의 `repeatDays.daysOfWeek`와 같은 요일 토큰(MON~SUN). */
  daysOfWeek?: string[];
};

/**
 * 스웨거 `RecommendationItem` — 다음 `gen:api-types` 때 types.ts로 흡수한다
 * (`rooms.ts`의 `RoomWithLayout` 선례).
 */
export type RecommendationItem = {
  recommendationId: number;
  /** MVP는 ADJUST_DAYS 1종 (ADJUST_TIME은 후속 예약). */
  type?: string;
  /** 사용자에게 그대로 보여줄 제안 문구. */
  message?: string;
  /** 대상 루틴의 현재 버전 id. */
  routineId?: number;
  /** 계보 id — 수락으로 버전이 분기해도 유지된다. */
  originRoutineId?: number;
  routineTitle?: string;
  proposal?: RecommendationProposal;
  createdAt?: string;
  /** 생성 + 7일. 지나면 서버가 목록에서 빼고 수락도 거부한다. */
  expiresAt?: string;
};

/**
 * GET /recommendations — 활성 추천 목록(최신 생성순, 최대 3건).
 *
 * **유효한 것만 내려온다** — 만료·루틴 삭제·사용자가 먼저 스케줄을 고친 건은
 * 서버가 걸러준다. 빈 배열은 "보여줄 제안 없음"이다.
 */
export function fetchRecommendations() {
  return apiGetList<RecommendationItem>('/recommendations');
}

/**
 * POST /recommendations/{id}/accept — 제안 스케줄을 루틴에 실제로 적용한다.
 *
 * 응답은 루틴 수정(`PUT /routines/{id}`)과 같은 형태이고, **스케줄 변경이라
 * 버전이 분기해 `id`가 바뀐다**(`originRoutineId`는 유지). 호출측은 응답을
 * 부분 반영하지 말고 루틴 데이터를 다시 받아야 옛 id 잔재가 남지 않는다.
 *
 * 실패는 404 `RECOMMENDATION_NOT_FOUND` 또는 409 4종(ALREADY_HANDLED·EXPIRED·
 * ROUTINE_DELETED·STALE)인데, 전부 "보고 있던 카드가 더는 유효하지 않다"는 같은
 * 뜻이라 `ErrorCode`에 코드를 늘리지 않는다 — 호출측이 재조회 하나로 수렴한다.
 */
export function acceptRecommendation(recommendationId: number) {
  return apiPost<RoutineResponse>(`/recommendations/${recommendationId}/accept`);
}

/** POST /recommendations/{id}/dismiss — 204. 루틴은 그대로, 카드만 사라진다. */
export function dismissRecommendation(recommendationId: number) {
  return apiPost<void>(`/recommendations/${recommendationId}/dismiss`);
}
