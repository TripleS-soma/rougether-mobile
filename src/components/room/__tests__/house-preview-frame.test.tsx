import { DEFAULT_HOUSE_COVER_KEY, houseCoverKey } from '@/components/room/house-preview-frame';

describe('houseCoverKey', () => {
  it('passes through a real CDN cover key', () => {
    const key = 'house/sunset/house-unified-sunset-frame.png';
    expect(houseCoverKey(key)).toBe(key);
  });

  it('falls back to the default frame for a missing cover', () => {
    expect(houseCoverKey(undefined)).toBe(DEFAULT_HOUSE_COVER_KEY);
    expect(houseCoverKey(null)).toBe(DEFAULT_HOUSE_COVER_KEY);
    expect(houseCoverKey('')).toBe(DEFAULT_HOUSE_COVER_KEY);
  });

  it('falls back for a legacy non-CDN key', () => {
    // Legacy local catalog keys (no CDN art) must not resolve to a broken <Image>.
    expect(houseCoverKey('furniture/bed')).toBe(DEFAULT_HOUSE_COVER_KEY);
  });
});
