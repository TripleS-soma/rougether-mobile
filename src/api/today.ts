/** Today dashboard endpoint — routines + todos grouped by category with streak. */
import { apiGet } from './client';
import type { TodayResponse } from './types';

/** GET /today. */
export function fetchToday() {
  return apiGet<TodayResponse>('/today');
}
