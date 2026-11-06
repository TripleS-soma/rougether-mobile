import { apiGet, apiPost } from '@/api/client';
import type { DrawResult, GachaDrawResponse } from '@/api/types';
export type StarterGachaState = {
  state: 'PENDING' | 'CLAIMED' | 'CLOSED';
  reward: DrawResult | null;
};
/**
 * 서버에 온보딩 뽑기·튜토리얼 완료 API가 있는가 (#1660). 2026-11-06 운영 스웨거·서버 저장소
 * 어디에도 없다 — 그동안 신규 사용자마다 404 두 건을 쳐서 GA `api_error`의 대부분(85명·77명)이
 * 이 "예상된 404"였다. 서버가 내보내면 true로 바꾼다. false면 요청 없이 일반 뽑기로 간다.
 */
export const STARTER_GACHA_SERVER_READY = false;

export const fetchStarterGacha = () => apiGet<StarterGachaState>('/onboarding/starter-gacha');
export const drawStarterGacha = () =>
  apiPost<GachaDrawResponse>('/onboarding/starter-gacha/draw', {});
export const completeOnboardingTutorial = () => apiPost<void>('/onboarding/tutorial/complete', {});
