import { apiGet, apiPost } from '@/api/client';
import type { DrawResult, GachaDrawResponse } from '@/api/types';
export type StarterGachaState = {
  state: 'PENDING' | 'CLAIMED' | 'CLOSED';
  reward: DrawResult | null;
};
export const fetchStarterGacha = () => apiGet<StarterGachaState>('/onboarding/starter-gacha');
export const drawStarterGacha = () =>
  apiPost<GachaDrawResponse>('/onboarding/starter-gacha/draw', {});
export const completeOnboardingTutorial = () => apiPost<void>('/onboarding/tutorial/complete', {});
