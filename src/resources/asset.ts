/**
 * Resource (image) layer. Item/character art lives on the asset CDN (S3) and is
 * referenced by key (e.g. `items/forest-sage/furniture/forest-sage-bed.png`).
 * Keys from the API resolve to real images; legacy local catalog keys
 * (`furniture/bed` 등) have no CDN art — check with isCdnKey() before rendering
 * an <Image> and fall back to the in-app placeholder.
 */
export const RESOURCE_BASE = 'https://rougether-assets.s3.ap-northeast-2.amazonaws.com';

/** True when the key points at real CDN art (API asset keys). */
export function isCdnKey(key?: string | null): key is string {
  return !!key && /^(items|characters|house)\//.test(key);
}

/** Resolve an asset key to an <Image> source on the CDN. */
export function assetSource(key?: string | null) {
  return { uri: `${RESOURCE_BASE}/${(key ?? '').replace(/^\//, '')}` };
}
