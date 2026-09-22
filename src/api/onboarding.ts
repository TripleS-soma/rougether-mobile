/** Onboarding endpoints — server-side goal/character selection + completion. */
import { apiGet, apiPut } from './client';
import type {
  OnboardingCharacterResponse,
  OnboardingGoalsResponse,
  OnboardingResponse,
  OnboardingHouseChoice,
  OnboardingHouseResponse,
} from './types';

/** GET /onboarding — selections + completed flag. */
export function fetchOnboarding() {
  return apiGet<OnboardingResponse>('/onboarding');
}

/** PUT /onboarding/goals — requires ≥1 valid master goal id. */
export function saveOnboardingGoals(goalIds: number[], primaryGoalId?: number) {
  return apiPut<OnboardingGoalsResponse>('/onboarding/goals', {
    goalIds,
    primaryGoalId: primaryGoalId ?? goalIds[0],
  });
}

/** PUT /onboarding/character — the user must own the character (starter set ok). */
export function saveOnboardingCharacter(characterId: number) {
  return apiPut<OnboardingCharacterResponse>('/onboarding/character', { characterId });
}

/** GET /onboarding/house — 집 선택 결과 (#1407). 미선택이면 `completed=false`. */
export function fetchOnboardingHouse() {
  return apiGet<OnboardingHouseResponse>('/onboarding/house');
}

/**
 * PUT /onboarding/house — 집 선택 1회 (#1407, 서버 #389). 같은 선택 재요청은 최초 결과,
 * 다른 선택은 409 `ONBOARDING_HOUSE_ALREADY_SELECTED`.
 */
export function saveOnboardingHouse(choice: OnboardingHouseChoice) {
  return apiPut<OnboardingHouseResponse>('/onboarding/house', { choice });
}
