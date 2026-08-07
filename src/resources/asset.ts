/**
 * Resource (image) layer. Item/character art lives in private S3 and is served by
 * CloudFront. The API stores only object keys such as
 * `items/forest-sage/furniture/forest-sage-bed.png`.
 * Override the shared dev CDN per build with `EXPO_PUBLIC_ASSET_URL`.
 * Keys from the API resolve to real images; legacy local catalog keys
 * (`furniture/bed` 등) have no CDN art — check with isCdnKey() before rendering
 * an <Image> and fall back to the in-app placeholder.
 */
const FALLBACK_RESOURCE_BASE = 'https://d1eazfl0tw7r0v.cloudfront.net';

/** Overridable per environment (`EXPO_PUBLIC_ASSET_URL`, inlined at bundle time). */
export const RESOURCE_BASE = (process.env.EXPO_PUBLIC_ASSET_URL ?? FALLBACK_RESOURCE_BASE).replace(
  /\/+$/,
  '',
);

/** True when the key points at real CDN art (API asset keys). */
export function isCdnKey(key?: string | null): key is string {
  return !!key && /^(items|characters|house)\//.test(key);
}

/** Resolve an asset key to an <Image> source on the CDN. */
export function assetSource(key?: string | null) {
  return { uri: `${RESOURCE_BASE}/${(key ?? '').replace(/^\//, '')}` };
}
