/**
 * Resource (image) layer. Furniture/character art lives on a resource/CDN
 * server and is referenced by key (spec convention: `*_key` + CDN base). Until
 * the real server exists, every key resolves to a dummy placeholder image, so
 * screens can render image slots now and swap `RESOURCE_BASE` later.
 */
export const RESOURCE_BASE = 'https://placehold.co';

/**
 * Resolve an asset key to an <Image> source. Dummy placeholder for now: the
 * optional `label` (e.g. a furniture's Korean name) is drawn on the placeholder
 * so slots are identifiable before the real art exists; it falls back to the
 * key. Once RESOURCE_BASE points at the real CDN, `label` is simply ignored.
 */
export function assetSource(key?: string | null, label?: string | null) {
  const text = encodeURIComponent(label ?? key ?? 'asset');
  return { uri: `${RESOURCE_BASE}/120x120/EADFD8/4A403A.png?text=${text}` };
}
