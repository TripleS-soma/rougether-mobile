import type { DrawResult } from '@/api/types';
import { isCdnKey } from '@/resources/asset';

export type RevealTier = 'ungraded' | 'common' | 'rare' | 'legendary';

export type RevealMotionProfile = {
  tier: RevealTier;
  badgeLabel?: '일반' | '희귀' | '전설';
  minChargeMs: number;
  burstMs: number;
  cinematicMs: number;
  shakeDegrees: number;
  chargeScale: number;
  glowOpacity: number;
  rayCount: number;
  ringCount: number;
  particleCount: number;
  heroLift: number;
  heroScale: number;
  revealMs: number;
  haptic: 'soft' | 'success' | 'legendary';
};

export type RevealRenderKind = 'asset' | 'currency' | 'fallback';

export type RevealPlanItem = {
  result: DrawResult;
  index: number;
  tier: RevealTier;
  profile: RevealMotionProfile;
  renderKind: RevealRenderKind;
  assetKey?: string;
  displayName: string;
  badgeLabel?: '일반' | '희귀' | '전설';
  conversionLabel?: string;
};

export type RevealPlan = {
  items: RevealPlanItem[];
  bestTier: RevealTier;
  profile: RevealMotionProfile;
  reducedMotion: boolean;
};

const TIER_ORDER: Record<RevealTier, number> = {
  ungraded: 0,
  common: 1,
  rare: 2,
  legendary: 3,
};

/**
 * 가구나 에셋 종류가 아니라 등급만으로 결정하는 범용 모션 프로필.
 * 새 가구는 API에서 assetKey와 rarity만 내려오면 동일한 파이프라인을 그대로 탄다.
 */
const MOTION_PROFILES: Record<RevealTier, RevealMotionProfile> = {
  ungraded: {
    tier: 'ungraded',
    minChargeMs: 650,
    burstMs: 220,
    cinematicMs: 2400,
    shakeDegrees: 2,
    chargeScale: 1.03,
    glowOpacity: 0.22,
    rayCount: 2,
    ringCount: 0,
    particleCount: 2,
    heroLift: 18,
    heroScale: 1.01,
    revealMs: 220,
    haptic: 'soft',
  },
  common: {
    tier: 'common',
    badgeLabel: '일반',
    minChargeMs: 900,
    burstMs: 340,
    cinematicMs: 2400,
    shakeDegrees: 4,
    chargeScale: 1.07,
    glowOpacity: 0.4,
    rayCount: 4,
    ringCount: 1,
    particleCount: 6,
    heroLift: 34,
    heroScale: 1.04,
    revealMs: 340,
    haptic: 'soft',
  },
  rare: {
    tier: 'rare',
    badgeLabel: '희귀',
    minChargeMs: 1200,
    burstMs: 500,
    cinematicMs: 2700,
    shakeDegrees: 7,
    chargeScale: 1.13,
    glowOpacity: 0.68,
    rayCount: 8,
    ringCount: 2,
    particleCount: 12,
    heroLift: 62,
    heroScale: 1.08,
    revealMs: 520,
    haptic: 'success',
  },
  legendary: {
    tier: 'legendary',
    badgeLabel: '전설',
    minChargeMs: 1550,
    burstMs: 700,
    cinematicMs: 2900,
    shakeDegrees: 11,
    chargeScale: 1.2,
    glowOpacity: 0.95,
    rayCount: 12,
    ringCount: 3,
    particleCount: 20,
    heroLift: 96,
    heroScale: 1.14,
    revealMs: 740,
    haptic: 'legendary',
  },
};

const REDUCED_TIMING = {
  minChargeMs: 60,
  burstMs: 60,
  revealMs: 100,
  cinematicMs: 80,
} as const;

function toRevealTier(value: RevealTier | string | null | undefined): RevealTier {
  switch (value) {
    case 'common':
    case '일반':
      return 'common';
    case 'rare':
    case '희귀':
      return 'rare';
    case 'legendary':
    case '전설':
      return 'legendary';
    case 'ungraded':
    default:
      return 'ungraded';
  }
}

/** 등급 하나를 실제 렌더러가 사용할 모션 숫자로 바꾼다. */
export function getRevealMotionProfile(
  tier: RevealTier | string | null | undefined,
  reducedMotion = false,
): RevealMotionProfile {
  const normalizedTier = toRevealTier(tier);
  const profile = MOTION_PROFILES[normalizedTier];
  if (!reducedMotion) return profile;

  // 결과 정보는 유지하되, 위치·크기·반복 움직임은 없애고 짧은 전환만 남긴다.
  return {
    ...profile,
    ...REDUCED_TIMING,
    shakeDegrees: 0,
    chargeScale: 1,
    rayCount: 0,
    ringCount: 0,
    particleCount: 0,
    heroLift: 0,
    heroScale: 1,
  };
}

/** 복수 결과의 공용 버스트에 쓸 최고 등급을 고른다. */
export function getBestRevealTier(results: readonly DrawResult[] | null | undefined): RevealTier {
  let best: RevealTier = 'ungraded';
  for (const result of results ?? []) {
    const tier = toRevealTier(result.rarity);
    if (TIER_ORDER[tier] > TIER_ORDER[best]) best = tier;
  }
  return best;
}

function isCurrencyResult(result: DrawResult) {
  return result.converted === true || result.rewardType?.trim().toUpperCase() === 'CURRENCY';
}

function getCurrencyLabel(currencyType: unknown) {
  switch (currencyType) {
    case 'COIN':
      return '코인';
    case 'DIAMOND':
      return '다이아';
    default:
      return '재화';
  }
}

function getRefundAmount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function getDisplayName(result: DrawResult, renderKind: RevealRenderKind) {
  const suppliedName =
    typeof result.name === 'string'
      ? result.name
          .replace(/[\u0000-\u001f\u007f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';
  if (suppliedName) return suppliedName.slice(0, 80);
  if (renderKind === 'currency') return `${getCurrencyLabel(result.refundCurrencyType)} 환급`;
  if (result.rewardType?.trim().toUpperCase() === 'CHARACTER') return '캐릭터 보상';
  return '아이템 보상';
}

function getConversionLabel(result: DrawResult, renderKind: RevealRenderKind) {
  if (renderKind !== 'currency') return undefined;
  const prefix = result.converted ? '중복 · ' : '';
  return `${prefix}${getCurrencyLabel(result.refundCurrencyType)} +${getRefundAmount(result.refundAmount)}`;
}

/**
 * API 결과를 가구별 분기 없이 바로 렌더링할 수 있는 순수 공개 계획으로 변환한다.
 * 환급은 원래 아트가 있어도 재화를 우선하고, 유효한 CDN key만 asset 슬롯에 보낸다.
 */
export function buildRevealPlan(
  results: readonly DrawResult[] | null | undefined,
  reducedMotion = false,
): RevealPlan {
  const source = results ?? [];
  const bestTier = getBestRevealTier(source);
  const items = source.map((result, index): RevealPlanItem => {
    const tier = toRevealTier(result.rarity);
    const profile = getRevealMotionProfile(tier, reducedMotion);
    const renderKind: RevealRenderKind = isCurrencyResult(result)
      ? 'currency'
      : isCdnKey(result.assetKey)
        ? 'asset'
        : 'fallback';

    return {
      result,
      index,
      tier,
      profile,
      renderKind,
      assetKey: renderKind === 'asset' ? result.assetKey : undefined,
      displayName: getDisplayName(result, renderKind),
      badgeLabel: profile.badgeLabel,
      conversionLabel: getConversionLabel(result, renderKind),
    };
  });

  return {
    items,
    bestTier,
    profile: getRevealMotionProfile(bestTier, reducedMotion),
    reducedMotion,
  };
}
