/** Master data endpoints (goals, characters). */
import { apiGetList } from './client';
import type { CharacterItem, GoalItem } from './types';

/** GET /goals — goal master list (온보딩/집 목표 선택지). */
export function fetchGoals() {
  return apiGetList<GoalItem>('/goals');
}

/** GET /characters — character master list. */
export function fetchCharacters() {
  return apiGetList<CharacterItem>('/characters');
}
