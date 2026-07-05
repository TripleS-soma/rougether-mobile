/** Onboarding endpoints — server-side goal/character selection + completion. */
import { apiGet, apiPut } from './client';
import type {
  OnboardingCharacterResponse,
  OnboardingGoalsResponse,
  OnboardingResponse,
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
