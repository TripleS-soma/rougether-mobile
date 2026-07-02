/**
 * Resource (image) layer. Furniture/character art lives on a resource/CDN
 * server and is referenced by key (spec convention: `*_key` + CDN base). Until
 * the real server exists, every key resolves to a dummy placeholder image.
 *
 * NOTE: furniture is currently drawn in-app via FurniturePlaceholder (not this
 * dummy image) — the placeholder host can't render Korean text, so labels showed
 * as "???". Keep this for when RESOURCE_BASE points at the real CDN.
 */
export const RESOURCE_BASE = 'https://placehold.co';

/** Resolve an asset key to an <Image> source. Dummy placeholder for now. */
export function assetSource(key?: string | null) {
  const text = encodeURIComponent(key ?? 'asset');
  return { uri: `${RESOURCE_BASE}/120x120/EADFD8/4A403A.png?text=${text}` };
}
