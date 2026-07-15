import { RESOURCE_BASE, assetSource, isCdnKey } from '@/resources/asset';

describe('assetSource', () => {
  it('resolves an API asset key to a CDN URL', () => {
    const { uri } = assetSource('items/forest-sage/furniture/forest-sage-bed.png');
    expect(uri).toBe(`${RESOURCE_BASE}/items/forest-sage/furniture/forest-sage-bed.png`);
  });

  it('strips a leading slash from the key', () => {
    const { uri } = assetSource('/characters/bear.png');
    expect(uri).toBe(`${RESOURCE_BASE}/characters/bear.png`);
  });
});

describe('isCdnKey', () => {
  it('accepts API item/character/house keys', () => {
    expect(isCdnKey('items/forest-sage/furniture/forest-sage-bed.png')).toBe(true);
    expect(isCdnKey('characters/bear_sitting_figma_ready_v2.png')).toBe(true);
    // House cover catalog keys (GET /houses/cover-images, #261).
    expect(isCdnKey('house/cloud-balloon/house-unified-cloud-balloon-frame.png')).toBe(true);
  });

  it('rejects legacy local catalog keys and empty values', () => {
    expect(isCdnKey('furniture/bed')).toBe(false);
    expect(isCdnKey('')).toBe(false);
    expect(isCdnKey(undefined)).toBe(false);
  });
});
