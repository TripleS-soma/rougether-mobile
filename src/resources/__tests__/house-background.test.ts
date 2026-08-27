import { HOUSE_BACKGROUND_KEY_BY_THEME, houseBackgroundKey } from '@/resources/house-background';

describe('houseBackgroundKey', () => {
  it.each([
    [
      'house/cloud-balloon/house-unified-cloud-balloon-frame.png',
      HOUSE_BACKGROUND_KEY_BY_THEME['cloud-balloon'],
    ],
    [
      'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
      HOUSE_BACKGROUND_KEY_BY_THEME['coral-aquarium'],
    ],
    [
      'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
      HOUSE_BACKGROUND_KEY_BY_THEME['mushroom-forest'],
    ],
    [
      'house/night-observatory/house-unified-night-observatory-frame-v3.png',
      HOUSE_BACKGROUND_KEY_BY_THEME['night-observatory'],
    ],
  ])('maps %s to its theme background', (coverKey, expected) => {
    expect(houseBackgroundKey(coverKey)).toBe(expected);
  });

  it('keeps versioned frame filenames on the same theme background', () => {
    expect(houseBackgroundKey('house/mushroom-forest/frame-v27.png')).toBe(
      HOUSE_BACKGROUND_KEY_BY_THEME['mushroom-forest'],
    );
  });

  it('returns null for an absent or unknown theme so the sky fallback remains visible', () => {
    expect(houseBackgroundKey()).toBeNull();
    expect(houseBackgroundKey('house/unknown/frame.png')).toBeNull();
    expect(houseBackgroundKey('furniture/bed')).toBeNull();
  });
});
