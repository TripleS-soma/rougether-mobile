/**
 * Generated local sprites: no CDN request is needed to open a reward.
 * 1024px WebP(q86) — 원본 PNG 3.6MB를 220KB로. 무대 최대 360pt×3 = 1080px라 충분하고
 * 투명 채널은 유지된다(cwebp -resize 1024 0).
 */
export const GACHA_ART = {
  parts: require('@/assets/images/gacha/cozy-gift-parts-v1.webp'),
  backdrop: require('@/assets/images/gacha/forest-stage-v1.webp'),
} as const;

/** Normalized atlas coordinates: an empty strip separates lid and base. */
export const GIFT_ATLAS = {
  split: 0.44,
  closedLidOffset: 0.3,
  openLidOffset: -0.08,
  centerOffset: -0.14,
} as const;

export const GIFT_CHARGE_MS = 900;
export const GIFT_AUTO_OPEN_MS = 1600;
export const GIFT_OPEN_MS = 1100;
