/** Routine + routine-log (per-date completion) endpoints. */
import { apiDelete, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type {
  RoutineCreateRequest,
  RoutineLogResponse,
  RoutineResponse,
  RoutineUpdateRequest,
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
  return apiPost<RoutineLogResponse>(`/routines/${id}/logs`, { routineDate });
}

/** DELETE /routines/{id}/logs?date=… — undo completion for a date. */
export function uncompleteRoutine(id: number, date: string) {
  return apiDelete<void>(`/routines/${id}/logs${buildQuery({ date })}`);
}

/**
 * DELETE /routines/{id}/house-mission-link — 단체미션 연동 해제 (#907).
 * **루틴 자체는 남는다.** 이미 연동이 없어도 성공(멱등)하고, 과거에 자동
 * 반영된 미션 기여는 회수되지 않는다.
 *
 * `updateRoutine`의 `houseMissionId: null`로는 안 된다 — 그건 "기존 유지"다.
 */
export function unlinkRoutineMission(id: number) {
  return apiDelete<void>(`/routines/${id}/house-mission-link`);
}
