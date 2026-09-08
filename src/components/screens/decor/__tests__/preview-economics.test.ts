import {
  furniturePreviewsOf,
  mergePendingPreviews,
  previewTotalOf,
  stripPreviews,
  SURFACE_LABEL,
  surfacePreviewsOf,
} from '@/components/screens/decor/preview-economics';
import {
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
  type PlacedFurniture,
  type Wallpaper,
  WALLPAPERS,
} from '@/resources/furniture';

const bed = FURNITURE_ITEMS.find((f) => f.id === 'bed')!;
const shelf = FURNITURE_ITEMS.find((f) => f.id === 'shelf')!;
const paw = WALLPAPERS.find((w) => w.id === 'paw')!;
const flower = WALLPAPERS.find((w) => w.id === 'flower')!;

const floors: Wallpaper[] = [
  { id: 'wood', name: '원목 마루', price: 300, assetKey: 'floor/wood', color: '#D9B58A' },
];
const backgrounds: Wallpaper[] = [
  { id: 'night', name: '밤하늘', price: 700, assetKey: 'bg/night', color: '#1E2740' },
];
const catalogs = { wallpapers: WALLPAPERS, floors, backgrounds };

const initial = { wallpaperId: DEFAULT_WALLPAPER_ID, floorId: null, backgroundId: null };

const placed = (ids: string[]): PlacedFurniture[] =>
  ids.map((furnitureId, i) => ({ furnitureId, x: 0.3, y: 0.6, z: i + 1 }));

describe('surfacePreviewsOf', () => {
  it('lists unowned surfaces the user picked, in wallpaper → floor → background order', () => {
    const owned = new Set([DEFAULT_WALLPAPER_ID]);
    expect(
      surfacePreviewsOf(
        owned,
        { wallpaperId: paw.id, floorId: 'wood', backgroundId: 'night' },
        initial,
        catalogs,
      ),
    ).toEqual([
      { kind: 'wallpaper', id: paw.id, name: paw.name, price: paw.price },
      { kind: 'floor', id: 'wood', name: '원목 마루', price: 300 },
      { kind: 'background', id: 'night', name: '밤하늘', price: 700 },
    ]);
  });

  it('never previews the entry-time surface even when unowned (신규 계정 기본 벽지)', () => {
    const owned = new Set<string>();
    const entry = { wallpaperId: paw.id, floorId: 'wood', backgroundId: null };
    expect(surfacePreviewsOf(owned, entry, entry, catalogs)).toEqual([]);
  });

  it('skips owned picks, cleared surfaces, and ids missing from the catalog', () => {
    const owned = new Set([flower.id]);
    expect(
      surfacePreviewsOf(
        owned,
        { wallpaperId: flower.id, floorId: null, backgroundId: 'ghost' },
        initial,
        catalogs,
      ),
    ).toEqual([]);
  });

  it('labels every surface kind in Korean', () => {
    expect(SURFACE_LABEL).toEqual({ wallpaper: '벽지', floor: '바닥', background: '배경' });
  });
});

describe('furniturePreviewsOf', () => {
  it('returns unowned placed furniture in placement order, dropping unknown ids', () => {
    const owned = new Set([shelf.id]);
    expect(
      furniturePreviewsOf(placed([bed.id, shelf.id, 'not-in-catalog']), owned, FURNITURE_ITEMS),
    ).toEqual([{ id: bed.id, name: bed.name, price: bed.price }]);
  });

  it('is empty when everything placed is owned', () => {
    const owned = new Set([bed.id, shelf.id]);
    expect(furniturePreviewsOf(placed([bed.id, shelf.id]), owned, FURNITURE_ITEMS)).toEqual([]);
  });
});

describe('mergePendingPreviews / previewTotalOf', () => {
  it('puts furniture first, strips the surface kind, and sums prices', () => {
    const furniture = [{ id: bed.id, name: bed.name, price: bed.price }];
    const surfaces = [{ kind: 'wallpaper' as const, id: paw.id, name: paw.name, price: paw.price }];
    const merged = mergePendingPreviews(furniture, surfaces);
    expect(merged).toEqual([
      { id: bed.id, name: bed.name, price: bed.price },
      { id: paw.id, name: paw.name, price: paw.price },
    ]);
    expect(previewTotalOf(merged)).toBe(bed.price + paw.price);
    expect(previewTotalOf([])).toBe(0);
  });
});

describe('stripPreviews', () => {
  it('drops unowned furniture and restores unowned surfaces to the entry values', () => {
    const owned = new Set([shelf.id, DEFAULT_WALLPAPER_ID]);
    const items = placed([bed.id, shelf.id]);
    expect(
      stripPreviews(
        { items, wallpaperId: paw.id, floorId: 'wood', backgroundId: 'night' },
        owned,
        initial,
      ),
    ).toEqual({
      items: [items[1]],
      wallpaperId: DEFAULT_WALLPAPER_ID,
      floorId: null,
      backgroundId: null,
    });
  });

  it('keeps owned surfaces and restores a cleared (null) floor/background to the entry values', () => {
    const owned = new Set([bed.id, flower.id]);
    const items = placed([bed.id]);
    const entry = { wallpaperId: DEFAULT_WALLPAPER_ID, floorId: 'wood', backgroundId: 'night' };
    expect(
      stripPreviews(
        { items, wallpaperId: flower.id, floorId: null, backgroundId: null },
        owned,
        entry,
      ),
    ).toEqual({ items, wallpaperId: flower.id, floorId: 'wood', backgroundId: 'night' });
  });
});
