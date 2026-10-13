/**
 * AI 조정 추천 (#1006, 서버 #329·#333·#336) — 주간 실패 패턴에서 나온 반복
 * 스케줄 조정 제안. 목록·수락·무시 3개가 전부이고 요청 본문은 없다.
 *
 * 문구(`message`)는 서버가 한국어 템플릿으로 완성해 내려주므로 앱은 조립하지
 * 않고 그대로 노출한다.
 */
import { apiGetList, apiPost } from './client';
import type { RecommendationItem, RoutineResponse } from './types';

/**
 * 스웨거 `RecommendationItem` — 목록 항목에는 id가 항상 있어 필수로 좁힌다.
 * 스키마 이름은 types.ts가 내보내므로 앱 별칭은 이름을 달리한다 (#1412).
 */
export type Recommendation = Omit<RecommendationItem, 'recommendationId'> & {
  recommendationId: number;
};

/**
 * GET /recommendations — 활성 추천 목록(최신 생성순, 최대 3건).
 *
 * **유효한 것만 내려온다** — 만료·루틴 삭제·사용자가 먼저 스케줄을 고친 건은
 * 서버가 걸러준다. 빈 배열은 "보여줄 제안 없음"이다.
 */
export function fetchRecommendations() {
  return apiGetList<Recommendation>('/recommendations');
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
