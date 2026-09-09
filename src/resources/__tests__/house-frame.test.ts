import {
  DEFAULT_HOUSE_COVER_KEY,
  STACKED_HOUSE_THEMES,
  resolveHouseFrame,
  houseWindowSeats,
  STACKED_HOUSES_ENABLED,
} from '@/resources/house-frame';

describe('staged house frame contract', () => {
  it('keeps legacy holes and portrait rooms aligned during fallback', () => {
    const frame = resolveHouseFrame(null, { enabled: false });
    const height = 360 / frame.aspectRatio;
    for (const rect of frame.windowRects) {
      const roomWidth = (parseFloat(rect.width) * 360) / 100;
      const roomHeight = (parseFloat(rect.height) * height) / 100;
      expect(roomHeight / roomWidth).toBeCloseTo(1.2);
    }
  });

  it('enables the release by default without publishing new catalog keys', () => {
    expect(STACKED_HOUSES_ENABLED).toBe(true);
    const frame = resolveHouseFrame(DEFAULT_HOUSE_COVER_KEY, { maxMembers: 6 });
    expect(frame.kind).toBe('stacked');
    expect(frame.canonicalKey).toBe(DEFAULT_HOUSE_COVER_KEY);
  });
  it.each([2, 4, 6])(
    'selects published rounded art and keeps canonical keys for %i seats',
    (capacity) => {
      for (const [theme, canonical, release] of [
        ['cloud-balloon', DEFAULT_HOUSE_COVER_KEY, 'cloud-renewed-v1-20260909'],
        [
          'coral-lagoon',
          'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
          'rounded-v2-20260907',
        ],
        [
          'mushroom-forest',
          'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
          'mushroom-grass-v1-20260909',
        ],
        [
          'night-observatory',
          'house/night-observatory/house-unified-night-observatory-frame-v3.png',
          'night-renewed-v1-20260909',
        ],
      ]) {
        const frame = resolveHouseFrame(canonical, { maxMembers: capacity });
        expect(frame.assetKey).toBe(
          `house/${theme}/frames/${release}/house-${theme}-${capacity}p-frame.webp`,
        );
        expect(frame.canonicalKey).toBe(canonical);
      }
    },
  );
  it('keeps the seven dev-only skins on their existing published release', () => {
    const hiddenThemes = STACKED_HOUSE_THEMES.filter((theme) => !theme.legacyKey);
    expect(hiddenThemes).toHaveLength(7);
    for (const theme of hiddenThemes) {
      const frame = resolveHouseFrame(null, { previewTheme: theme.id, maxMembers: 6 });
      expect(frame.assetKey).toBe(
        `house/${theme.id}/frames/stacked-v1-20260905/house-${theme.id}-6p-frame.webp`,
      );
    }
  });
  it.each([2, 3, 4, 6, 10])('OFF preserves art and geometry for %i seats', (maxMembers) => {
    for (const key of [
      DEFAULT_HOUSE_COVER_KEY,
      'house/night-observatory/house-unified-night-observatory-frame-v3.png',
    ]) {
      expect(resolveHouseFrame(key, { maxMembers, enabled: false })).toMatchObject({
        kind: 'legacy',
        assetKey: key,
        aspectRatio: (5 / 6) * (33 / 37),
      });
    }
  });

  it.each([
    [2, 872],
    [4, 1224],
    [6, 1576],
  ])('renders %i portrait rooms without scaling furniture', (capacity, height) => {
    for (const theme of STACKED_HOUSE_THEMES) {
      const frame = resolveHouseFrame(theme.legacyKey, {
        maxMembers: capacity,
        enabled: true,
        previewTheme: theme.id,
      });
      expect(frame.assetKey).toContain(`/house-${theme.id}-${capacity}p-frame.webp`);
      expect(frame.aspectRatio).toBe((1024 / height) * (5 / 6));
      expect(frame.windowRects).toHaveLength(capacity);
      const displayHeight = 1024 / frame.aspectRatio;
      frame.windowRects.forEach((rect, index) => {
        expect((parseFloat(rect.height) * displayHeight) / 100).toBeCloseTo(384);
        expect((parseFloat(rect.left) * 1024) / 100).toBeCloseTo(index % 2 ? 536 : 165);
        expect((parseFloat(rect.top) * height) / 100).toBeCloseTo(
          358 + Math.floor(index / 2) * 352,
        );
        expect((parseFloat(rect.width) * 1024) / 100).toBeCloseTo(320);
        expect((parseFloat(rect.height) * height) / 100).toBeCloseTo(320);
      });
    }
  });

  it('only maps the four exact existing keys; unsupported covers and capacities stay legacy', () => {
    expect(STACKED_HOUSE_THEMES.filter((t) => t.legacyKey)).toHaveLength(4);
    for (const key of ['house/night-observatory/unknown.png', 'house/cloud-balloon/unknown.png']) {
      expect(resolveHouseFrame(key, { enabled: true }).assetKey).toBe(key);
    }
    for (const maxMembers of [0, 7, 10, NaN, Infinity, 2.5]) {
      for (const key of [
        DEFAULT_HOUSE_COVER_KEY,
        'house/night-observatory/house-unified-night-observatory-frame-v3.png',
      ]) {
        expect(resolveHouseFrame(key, { maxMembers, enabled: true })).toMatchObject({
          kind: 'legacy',
          assetKey: key,
          canonicalKey: key,
        });
      }
    }
  });

  it('uses capacity, not occupancy, and never drops extra members on stale data', () => {
    expect(
      resolveHouseFrame(null, { maxMembers: 6, minimumSeats: 1, enabled: true }).windowRects,
    ).toHaveLength(6);
    expect(
      resolveHouseFrame(null, { maxMembers: 2, minimumSeats: 6, enabled: true }).windowRects,
    ).toHaveLength(6);
    expect(resolveHouseFrame(null, { maxMembers: 4, minimumSeats: 7, enabled: true }).kind).toBe(
      'legacy',
    );
    expect(resolveHouseFrame(null, { maxMembers: 3, enabled: true }).windowRects).toHaveLength(4);
  });

  it('keeps adapter indices and bottom alignment for even, odd and overflow houses', () => {
    expect(houseWindowSeats([[0, 1]], 2)).toEqual([0, 1]);
    expect(houseWindowSeats([[0], [1, 2]], 4)).toEqual([0, null, 1, 2]);
    expect(
      houseWindowSeats(
        [
          [0, 1],
          [2, 3],
          [4, 5],
        ],
        6,
      ),
    ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(
      houseWindowSeats(
        [
          [0, 1],
          [2, 3],
          [4, 5],
        ],
        4,
      ),
    ).toEqual([2, 3, 4, 5]);
  });
});
