import type { CoachStep } from '@/components/ui/coach-mark';

/**
 * 기능 첫 진입 튜토리얼 정의 — 온보딩 미션 코치마크(use-tutorial-coach)와 달리 잠그지 않고
 * 다음·건너뛰기로 넘긴다. 대상 id는 각 화면의 `CoachTarget`과 같아야 한다.
 */
export const MARKET_TOUR_ID = 'market';

/** 거래소: 첫 가구 카드 → 내 판매 관리. 목록이 비면 1단계는 가운데 말풍선만. */
export const MARKET_TOUR_TARGETS = ['market-card', 'market-manage'] as const;

const MARKET_TOUR_COPY = ['card', 'manage'] as const;

export function marketTourCoachSteps(tr: (key: string) => string): CoachStep[] {
  return MARKET_TOUR_TARGETS.map((target, i) => ({
    target,
    title: tr(`market.tour.${MARKET_TOUR_COPY[i]}.title`),
    body: tr(`market.tour.${MARKET_TOUR_COPY[i]}.body`),
  }));
}
