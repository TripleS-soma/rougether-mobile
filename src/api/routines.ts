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
