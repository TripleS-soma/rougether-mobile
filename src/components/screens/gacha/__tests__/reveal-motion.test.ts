import type { DrawResult } from '@/api/types';
import {
  buildRevealPlan,
  getBestRevealTier,
  getRevealMotionProfile,
  type RevealMotionProfile,
} from '@/components/screens/gacha/reveal-motion';

describe('reveal motion planner', () => {
  it('maps supported rarities and leaves null or unknown rarity ungraded', () => {
    expect(getRevealMotionProfile('일반')).toMatchObject({ tier: 'common', badgeLabel: '일반' });
    expect(getRevealMotionProfile('희귀')).toMatchObject({ tier: 'rare', badgeLabel: '희귀' });
    expect(getRevealMotionProfile('전설')).toMatchObject({ tier: 'legendary', badgeLabel: '전설' });
    expect(getRevealMotionProfile(null).tier).toBe('ungraded');
    expect(getRevealMotionProfile(null).badgeLabel).toBeUndefined();
    expect(getRevealMotionProfile('mythic').tier).toBe('ungraded');
    expect(getRevealMotionProfile('mythic').badgeLabel).toBeUndefined();
  });

  it('increases every motion-strength dimension monotonically by tier', () => {
    const tiers = ['ungraded', 'common', 'rare', 'legendary'] as const;
    const numericStrengths = [
      'minChargeMs',
      'burstMs',
      'shakeDegrees',
      'chargeScale',
      'glowOpacity',
      'rayCount',
      'ringCount',
      'particleCount',
      'heroLift',
      'heroScale',
      'revealMs',
    ] as const satisfies readonly (keyof RevealMotionProfile)[];

    for (const field of numericStrengths) {
      const values = tiers.map((tier) => getRevealMotionProfile(tier)[field] as number);
      expect(values[1]).toBeGreaterThan(values[0]);
      expect(values[2]).toBeGreaterThan(values[1]);
      expect(values[3]).toBeGreaterThan(values[2]);
    }
    expect(tiers.map((tier) => getRevealMotionProfile(tier).haptic)).toEqual([
      'soft',
      'soft',
      'success',
      'legendary',
    ]);
  });

  it('plans 100 arbitrary furniture asset keys without per-furniture rules', () => {
    const results: DrawResult[] = Array.from({ length: 100 }, (_, index) => ({
      itemId: 10_000 + index,
      name: `임의 가구 ${index}`,
      assetKey: `items/theme-${index}/furniture/arbitrary-${index}.webp`,
      rarity: index % 3 === 0 ? '전설' : index % 2 === 0 ? '희귀' : '일반',
    }));

    const plan = buildRevealPlan(results);

    expect(plan.items).toHaveLength(100);
    expect(plan.items.every((item) => item.renderKind === 'asset')).toBe(true);
    expect(plan.items.map((item) => item.assetKey)).toEqual(
      results.map((result) => result.assetKey),
    );
    expect(plan.bestTier).toBe('legendary');
  });

  it('uses currency rendering for duplicate conversion and derives its currency label', () => {
    const plan = buildRevealPlan([
      {
        rewardType: 'ITEM',
        name: '  푸른   의자  ',
        assetKey: 'items/forest/furniture/chair.webp',
        rarity: '희귀',
        converted: true,
        refundCurrencyType: 'COIN',
        refundAmount: 100,
      },
      {
        rewardType: 'CURRENCY',
        converted: false,
        refundCurrencyType: 'DIAMOND',
        refundAmount: 3,
      },
    ]);

    expect(plan.items[0]).toMatchObject({
      renderKind: 'currency',
      assetKey: undefined,
      displayName: '푸른 의자',
      conversionLabel: '중복 · 코인 +100',
    });
    expect(plan.items[1]).toMatchObject({
      renderKind: 'currency',
      displayName: '다이아 환급',
      conversionLabel: '다이아 +3',
    });
  });

  it('falls back safely for invalid art and malformed display data', () => {
    const plan = buildRevealPlan([
      { rewardType: 'ITEM', assetKey: 'furniture/local-chair', name: ' \u0000\n ' },
      { rewardType: 'CHARACTER', assetKey: '/characters/bear.webp' },
      { rewardType: 'ITEM', assetKey: 'items/valid/furniture/desk.webp', name: undefined },
    ]);

    expect(plan.items.map(({ renderKind, displayName }) => ({ renderKind, displayName }))).toEqual([
      { renderKind: 'fallback', displayName: '아이템 보상' },
      { renderKind: 'fallback', displayName: '캐릭터 보상' },
      { renderKind: 'asset', displayName: '아이템 보상' },
    ]);
  });

  it('finds the highest tier and handles empty, null, and unknown results', () => {
    expect(getBestRevealTier([{ rarity: '일반' }, { rarity: '전설' }, { rarity: '희귀' }])).toBe(
      'legendary',
    );
    expect(getBestRevealTier([{ rarity: 'mythic' }, { rarity: undefined }])).toBe('ungraded');
    expect(getBestRevealTier([])).toBe('ungraded');
    expect(getBestRevealTier(null)).toBe('ungraded');
  });

  it('keeps result information but removes motion in reduced-motion mode', () => {
    const plan = buildRevealPlan(
      [
        {
          name: '전설 침대',
          assetKey: 'items/cozy/furniture/legendary-bed.webp',
          rarity: '전설',
        },
      ],
      true,
    );
    const profile = plan.profile;

    expect(plan).toMatchObject({ bestTier: 'legendary', reducedMotion: true });
    expect(plan.items[0]).toMatchObject({
      renderKind: 'asset',
      displayName: '전설 침대',
      badgeLabel: '전설',
    });
    expect(profile).toMatchObject({
      shakeDegrees: 0,
      chargeScale: 1,
      rayCount: 0,
      ringCount: 0,
      particleCount: 0,
      heroLift: 0,
      heroScale: 1,
    });
    expect(profile.minChargeMs + profile.burstMs + profile.revealMs).toBeLessThanOrEqual(250);
    expect(plan.items[0].profile).toEqual(profile);
  });
});
