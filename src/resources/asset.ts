/**
 * Resource (image) layer. Item/character art lives in private S3 and is served by
 * CloudFront. The API stores only object keys such as
 * `items/forest-sage/furniture/forest-sage-bed.png`.
 * Override the shared CDN per build with `EXPO_PUBLIC_ASSET_URL`.
 * Keys from the API resolve to real images; legacy local catalog keys
 * (`furniture/bed` 등) have no CDN art — check with isCdnKey() before rendering
 * an <Image> and fall back to the in-app placeholder.
 */
import sharedEndpoints from '@/config/shared-endpoints.json';

// 폴백은 공용 환경 주소의 단일 출처에서 (#738 계약, api/config.ts와 같은 결).
// 여기 값을 따로 박아 두면 CDN을 옮길 때 API·타입 생성만 따라가고 에셋은
// 옛 주소를 봐서 "이미지만 전부 안 뜨는" 형태로 드러난다.
const FALLBACK_RESOURCE_BASE = sharedEndpoints.assetBase;

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
