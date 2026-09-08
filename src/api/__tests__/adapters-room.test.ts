import {
  characterIdFromCode,
  fromFriendRoomSlots,
  fromRoomSlots,
  toUserItemMap,
} from '@/api/adapters/room';

describe('API adapters — room placement', () => {
  it('round-trips room placement: slots → app placement → slot saves', () => {
    const cat = {
      furniture: [
        {
          id: '2',
          name: '침대',
          slot: 'bottomLeft' as const,
          category: '가구' as const,
          price: 0,
          assetKey: 'items/a/bed.png',
        },
        {
          id: '5',
          name: '선반',
          slot: 'topLeft' as const,
          category: '가구' as const,
          price: 0,
          assetKey: 'items/a/shelf.png',
        },
      ],
      wallpapers: [{ id: '9', name: '벽지', price: 0, assetKey: 'items/a/wp.png', color: '#FFF' }],
      floors: [{ id: '11', name: '바닥재', price: 0, assetKey: 'items/a/fl.png', color: '#EEE' }],
      backgrounds: [
        { id: '12', name: '배경', price: 0, assetKey: 'items/a/bg.png', color: '#DDD' },
      ],
      ownedIds: ['2', '5', '9', '11', '12'],
    };
    const inv = toUserItemMap([
      { userItemId: 21, itemId: 2 },
      { userItemId: 22, itemId: 5 },
      { userItemId: 23, itemId: 9 },
      { userItemId: 24, itemId: 11 },
      { userItemId: 25, itemId: 12 },
    ]);

    const placement = fromRoomSlots(
      [
        { slotType: 'bottomLeft', userItemId: 21 },
        { slotType: 'wallpaper', userItemId: 23 },
        { slotType: 'floor', userItemId: 24 },
        { slotType: 'background', userItemId: 25 },
        { slotType: 'topRight', userItemId: 999 }, // unknown userItemId → skipped
      ],
      cat,
      inv,
    );
    // 표면만 읽는다 — positioned 슬롯(bottomLeft 등)은 무시된다 (#925).
    expect(placement).toEqual({
      wallpaperId: '9',
      floorId: '11',
      backgroundId: '12',
    });

    // A friend's slots carry their (unknown) userItemIds — resolution goes by
    // assetKey instead; keys missing from the catalogue are skipped.
    const friend = fromFriendRoomSlots(
      [
        { slotType: 'bottomLeft', userItemId: 777, assetKey: 'items/a/bed.png' },
        { slotType: 'wallpaper', userItemId: 778, assetKey: 'items/a/wp.png' },
        { slotType: 'floor', userItemId: 779, assetKey: 'items/a/fl.png' },
        { slotType: 'topRight', userItemId: 780, assetKey: 'items/other/unknown.png' },
        { slotType: 'topLeft', userItemId: 781 }, // no assetKey → skipped
      ],
      cat,
    );
    expect(friend).toEqual({
      wallpaperId: '9',
      floorId: '11',
      backgroundId: null,
    });
  });

  it('maps a room character code to the app character id', () => {
    expect(characterIdFromCode('cat')).toBe('cat');
    expect(characterIdFromCode('unknown-code')).toBeUndefined();
    expect(characterIdFromCode(undefined)).toBeUndefined();
  });
});
