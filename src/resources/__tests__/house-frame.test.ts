import {
  DEFAULT_HOUSE_COVER_KEY,
  FRAME_ASPECT,
  STACKED_HOUSE_THEMES,
  resolveHouseFrame,
  houseWindowSeats,
} from '@/resources/house-frame';

describe('staged house frame contract', () => {
  it.each([2, 3, 4, 6, 10])('OFF preserves art and geometry for %i seats', (maxMembers) => {
    expect(
      resolveHouseFrame(DEFAULT_HOUSE_COVER_KEY, { maxMembers, enabled: false }),
    ).toMatchObject({
      kind: 'legacy',
      assetKey: DEFAULT_HOUSE_COVER_KEY,
      aspectRatio: FRAME_ASPECT,
    });
  });

  it.each([
    [2, 872],
    [4, 1224],
    [6, 1576],
  ])('renders %i square rooms without scaling furniture coordinates', (capacity, height) => {
    for (const theme of STACKED_HOUSE_THEMES) {
      const frame = resolveHouseFrame(theme.legacyKey, {
        maxMembers: capacity,
        enabled: true,
        previewTheme: theme.id,
      });
      expect(frame.assetKey).toContain(`/house-${theme.id}-${capacity}p-frame.webp`);
      expect(frame.aspectRatio).toBe(1024 / height);
      expect(frame.windowRects).toHaveLength(capacity);
      frame.windowRects.forEach((rect, index) => {
        expect((parseFloat(rect.left) * 1024) / 100).toBeCloseTo(index % 2 ? 536 : 165);
        expect((parseFloat(rect.top) * height) / 100).toBeCloseTo(
          358 + Math.floor(index / 2) * 352,
        );
        expect((parseFloat(rect.width) * 1024) / 100).toBeCloseTo(320);
        expect((parseFloat(rect.height) * height) / 100).toBeCloseTo(320);
      });
    }
  });

  it('only maps the three exact existing keys; unsupported covers and capacities stay legacy', () => {
    expect(STACKED_HOUSE_THEMES.filter((t) => t.legacyKey)).toHaveLength(3);
    for (const key of [
      'house/night-observatory/house-unified-night-observatory-frame-v3.png',
      'house/cloud-balloon/unknown.png',
    ]) {
      expect(resolveHouseFrame(key, { enabled: true }).assetKey).toBe(key);
    }
    for (const maxMembers of [0, 7, 10, NaN, Infinity, 2.5]) {
      expect(resolveHouseFrame(null, { maxMembers, enabled: true }).kind).toBe('legacy');
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
