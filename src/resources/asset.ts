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

/**
 * Resolved sources, cached by key so repeat calls hand back the *same* object.
 * 방 캔버스는 한 화면에 12칸(집 좌석)까지 뜨고 칸마다 배경·벽지·바닥 + 가구 N장을
 * 그린다. 매 렌더 새 `{uri}`를 만들면 <Image source>의 참조가 항상 바뀌어
 * React Native가 매 커밋 native로 prop을 다시 보내고, expo-image는 소스를 다시
 * 해석한다. 키 개수는 카탈로그 크기로 묶여 있어(수십~수백) 캐시가 곧 상한이다.
 */
const SOURCE_CACHE = new Map<string, { uri: string }>();

/** 캐시 상한 — 서버 카탈로그가 커져도 무한정 쌓이지 않게. 넘으면 통째로 비운다. */
const SOURCE_CACHE_MAX = 512;

/** Resolve an asset key to an <Image> source on the CDN. */
export function assetSource(key?: string | null) {
  const path = (key ?? '').replace(/^\//, '');
  const hit = SOURCE_CACHE.get(path);
  if (hit) return hit;
  if (SOURCE_CACHE.size >= SOURCE_CACHE_MAX) SOURCE_CACHE.clear();
  const source = { uri: `${RESOURCE_BASE}/${path}` };
  SOURCE_CACHE.set(path, source);
  return source;
}
