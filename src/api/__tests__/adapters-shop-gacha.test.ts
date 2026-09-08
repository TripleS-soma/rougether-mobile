import {
  ownedPlacement,
  toGachaMachine,
  toShopCatalogue,
  toWallet,
} from '@/api/adapters/shop-gacha';
import type { ItemResponse } from '@/api/types';

describe('API adapters — shop / gacha', () => {
  it('reads wallets into coin/diamond', () => {
    expect(
      toWallet([
        { currencyType: 'COIN', balance: 120 },
        { currencyType: 'DIAMOND', balance: 7 },
      ]),
    ).toEqual({ coin: 120, diamond: 7 });
  });

  it('splits the item catalogue and derives a room from owned items', () => {
    const items: ItemResponse[] = [
      {
        id: 1,
        name: 'Forest Sage Set - Arched Window',
        placementType: 'positioned',
        defaultSlot: 'topLeft',
        defaultScale: 1.24,
        defaultPositionX: 0.35,
        defaultPositionY: 0.65,
        categoryCode: 'decor',
        priceAmount: 100,
        assetKey: 'items/window.png',
        theme: { id: 1, code: 'forest_sage', name: '숲속 세이지' },
        owned: true,
      },
      {
        id: 2,
        name: '침대',
        placementType: 'positioned',
        defaultSlot: 'bottomLeft',
        defaultPositionX: null,
        defaultPositionY: null,
        categoryCode: 'furniture',
        priceAmount: 100,
        owned: false,
      },
      {
        id: 3,
        name: '벽지',
        placementType: 'surface_slot',
        categoryCode: 'wallpaper',
        priceAmount: 50,
        owned: true,
      },
      // surface items (floor/background) land in their own catalogue lists.
      { id: 4, name: '바닥재', placementType: 'surface_slot', categoryCode: 'floor', owned: true },
      {
        id: 5,
        name: '배경',
        placementType: 'surface_slot',
        categoryCode: 'background',
        owned: false,
      },
    ];
    const cat = toShopCatalogue(items);
    expect(cat.furniture.map((f) => f.id)).toEqual(['1', '2']);
    // "…Set - " prefix is stripped for tiles; the theme rides along for filtering.
    expect(cat.furniture[0]).toMatchObject({
      name: 'Arched Window',
      slot: 'topLeft',
      category: '장식',
      price: 100,
      defaultScale: 1.24,
      defaultPositionX: 0.35,
      defaultPositionY: 0.65,
      theme: '숲속 세이지',
    });
    expect(cat.furniture[1]).toMatchObject({
      defaultPositionX: undefined,
      defaultPositionY: undefined,
    });
    expect(cat.wallpapers.map((w) => w.id)).toEqual(['3']);
    expect(cat.floors.map((f) => f.id)).toEqual(['4']);
    expect(cat.backgrounds.map((b) => b.id)).toEqual(['5']);
    expect(cat.ownedIds.sort()).toEqual(['1', '3', '4']);

    // 표면만 고른다 — 가구 자동 배치는 없다 (#925).
    const placed = ownedPlacement(cat);
    expect(placed.wallpaperId).toBe('3'); // owned wallpaper
    expect(placed.floorId).toBe('4'); // owned floor
    expect(placed.backgroundId).toBeNull(); // background not owned
  });

  it('uses explicit character identity instead of a missing theme to group gacha', () => {
    expect(toGachaMachine({ gachaId: 1, name: '숲속 세이지 뽑기', themeId: 1 }).kind).toBe(
      'furniture',
    );
    expect(toGachaMachine({ gachaId: 12, code: 'character_gacha' }).kind).toBe('character');
    expect(toGachaMachine({ gachaId: 13, themeId: null }).kind).toBe('furniture');
  });

  it.each(['WALLPAPER', 'FLOOR', 'FURNITURE'] as const)(
    '%s keeps furniture compatibility with a null theme and stable category visuals',
    (category) => {
      const wire = { gachaId: 81, category, themeId: null, costAmount: 100 };
      const first = toGachaMachine(wire, 0);
      const reordered = toGachaMachine(wire, 17);
      expect(first).toEqual(reordered);
      expect(first).toMatchObject({ id: 81, category, kind: 'furniture', costAmount: 100 });
    },
  );

  it('recognizes only canonical category codes when the additive field is absent', () => {
    expect(toGachaMachine({ code: 'floor_gacha', themeId: null }).category).toBe('FLOOR');
    expect(toGachaMachine({ code: 'forest_sage' }).category).toBeUndefined();
  });

  it('선물상자 아트 키를 그대로 싣는다 — 없으면 undefined (서버 #276)', () => {
    // 가공하지 않는다: 화면이 isCdnKey로 판정해 픽토그램 폴백을 고른다.
    expect(
      toGachaMachine({ gachaId: 1, name: '숲속 세이지 뽑기', giftBoxAssetKey: 'items/box.png' })
        .giftBoxKey,
    ).toBe('items/box.png');
    expect(toGachaMachine({ gachaId: 1, name: '숲속 세이지 뽑기' }).giftBoxKey).toBeUndefined();
  });
});
