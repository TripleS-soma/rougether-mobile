import { notifyAppIconEvent } from '@/lib/app-icon-events';
/** Routine + routine-log (per-date completion) endpoints. */
import { apiDelete, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type {
  RoutineCreateRequest,
  RoutineLogResponse,
  RoutineResponse,
  RoutineUpdateRequest,
  StreakSummaryResponse,
} from './types';

export type RoutineFilter = {
  categoryId?: number;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
};

/** GET /routines — the user's routines, optionally filtered. */
export function fetchRoutines(filter: RoutineFilter = {}) {
  return apiGetList<RoutineResponse>(`/routines${buildQuery(filter)}`);
}

/** POST /routines. */
export function createRoutine(body: RoutineCreateRequest) {
  return apiPost<RoutineResponse>('/routines', body);
}

/** PUT /routines/{id}. */
export function updateRoutine(id: number, body: RoutineUpdateRequest) {
  return apiPut<RoutineResponse>(`/routines/${id}`, body);
}

/** DELETE /routines/{id}. */
export function deleteRoutine(id: number) {
  return apiDelete<void>(`/routines/${id}`);
}

/** POST /routines/{id}/logs — mark the routine completed on a date ("YYYY-MM-DD"). */
export function completeRoutine(id: number, routineDate: string) {
  return apiPost<RoutineLogResponse>(`/routines/${id}/logs`, { routineDate }).then((result) => {
    notifyAppIconEvent('completion');
    return result;
  });
}

/**
 * DELETE /routines/{id}/logs?date=… — undo completion for a date.
 *
 * **스트릭을 돌려준다** (#895) — 오늘 완료를 취소해 그날 완료한 루틴이 하나도
 * 남지 않으면 서버가 currentCount를 1 줄인다. 예전엔 `void`로 버려서 헤더의
 * 🔥 일수가 새로고침 전까지 옛 값을 들고 있었다.
 */
export function uncompleteRoutine(id: number, date: string) {
  return apiDelete<StreakSummaryResponse>(`/routines/${id}/logs${buildQuery({ date })}`).then(
    (result) => {
      notifyAppIconEvent('completion');
      return result;
    },
  );
}
