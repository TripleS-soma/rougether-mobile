import {
  ownedPlacement,
  toAppCategory,
  toAppRoutine,
  toAppTodo,
  toCalendarItems,
  toCategoryCreate,
  toRoutineCreate,
  toRoutineUpdate,
  toServerItemId,
  toShopCatalogue,
  toTodoCreate,
  toWallet,
  todayCompletions,
  toGroupHouse,
  toHouseMission,
  toHouseCover,
  characterIdFromCode,
  toGachaMachine,
  fromFriendRoomSlots,
  fromRoomSlots,
  toFriendRoutines,
  toOwnedCharacter,
  toSlotSaves,
  toUserItemMap,
} from '@/api/adapters';
import type { ItemResponse, RoutineResponse, TodayResponse } from '@/api/types';
import type { NewRoutine } from '@/constants/routines';

describe('API adapters', () => {
  it('maps a weekly PHOTO routine to the app model', () => {
    const api: RoutineResponse = {
      id: 12,
      title: '운동',
      categoryId: 3,
      authType: 'PHOTO',
      status: 'ACTIVE',
      repeatType: 'WEEKLY',
      repeatDays: { daysOfWeek: ['MON', 'WED', 'SUN'] },
      scheduledTime: '07:30:00',
      startsOn: '2026-07-01',
    };
    const r = toAppRoutine(api);
    expect(r).toMatchObject({
      id: 'r12',
      title: '운동',
      category: '3',
      photoVerify: true,
      days: [1, 3, 0],
      time: '07:30',
      alarmEnabled: true,
      kind: 'routine',
    });
  });

  it('builds a create request: weekday numbers → codes, DAILY when no days', () => {
    const weekly: NewRoutine = {
      title: '독서',
      category: '5',
      days: [1, 5],
      startDate: '2026-07-02',
      alarmEnabled: true,
      time: '21:00',
      photoVerify: false,
    };
    expect(toRoutineCreate(weekly)).toMatchObject({
      title: '독서',
      categoryId: 5,
      authType: 'CHECK',
      repeatType: 'WEEKLY',
      repeatDays: { daysOfWeek: ['MON', 'FRI'] },
      scheduledTime: '21:00:00',
      startsOn: '2026-07-02',
    });

    const daily: NewRoutine = { ...weekly, days: [], alarmEnabled: false };
    const req = toRoutineCreate(daily);
    expect(req.repeatType).toBe('DAILY');
    expect(req.repeatDays).toBeUndefined();
    expect(req.scheduledTime).toBeUndefined();
  });

  it('round-trips 격주/매월/매년 repeats (#255)', () => {
    // BIWEEKLY: daysOfWeek travel like WEEKLY, kind is kept.
    const biweekly = toAppRoutine({
      id: 1,
      title: '분리수거',
      repeatType: 'BIWEEKLY',
      repeatDays: { daysOfWeek: ['TUE'] },
      startsOn: '2026-07-07',
    });
    expect(biweekly).toMatchObject({ repeat: 'biweekly', days: [2] });
    expect(
      toRoutineCreate({
        title: '분리수거', category: '1', repeat: 'biweekly', days: [2],
        startDate: '2026-07-07', alarmEnabled: false, time: '', photoVerify: false,
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'BIWEEKLY', repeatDays: { daysOfWeek: ['TUE'] } });

    // MONTHLY: dayOfMonth both ways.
    const monthly = toAppRoutine({
      id: 2,
      title: '월말 결산',
      repeatType: 'MONTHLY',
      repeatDays: { dayOfMonth: 31 },
    });
    expect(monthly).toMatchObject({ repeat: 'monthly', dayOfMonth: 31, days: undefined });
    expect(
      toRoutineCreate({
        title: '월말 결산', category: '1', repeat: 'monthly', days: [], dayOfMonth: 31,
        startDate: '2026-07-01', alarmEnabled: false, time: '', photoVerify: false,
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'MONTHLY', repeatDays: { dayOfMonth: 31 } });

    // YEARLY: the API's month/day fold into the app's month/dayOfMonth.
    const yearly = toAppRoutine({
      id: 3,
      title: '건강검진',
      repeatType: 'YEARLY',
      repeatDays: { month: 7, day: 12 },
    });
    expect(yearly).toMatchObject({ repeat: 'yearly', month: 7, dayOfMonth: 12 });
    expect(
      toRoutineCreate({
        title: '건강검진', category: '1', repeat: 'yearly', days: [], dayOfMonth: 12, month: 7,
        startDate: '2026-07-01', alarmEnabled: false, time: '', photoVerify: false,
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'YEARLY', repeatDays: { month: 7, day: 12 } });

    // Update keeps the cadence when an unrelated field changes.
    const req = toRoutineUpdate(monthly, { title: '결산' });
    expect(req).toMatchObject({ repeatType: 'MONTHLY', repeatDays: { dayOfMonth: 31 } });
  });

  it('maps todos and builds a todo create request', () => {
    expect(
      toAppTodo({
        id: 9,
        title: '장보기',
        categoryId: 2,
        dueDate: '2026-07-03',
        status: 'PENDING',
      }),
    ).toMatchObject({
      id: 't9',
      title: '장보기',
      category: '2',
      dueDate: '2026-07-03',
      kind: 'todo',
    });
    expect(toTodoCreate('2', '장보기', '2026-07-03')).toEqual({
      title: '장보기',
      categoryId: 2,
      dueDate: '2026-07-03',
    });
  });

  it('keeps routine/todo app ids distinct when server ids collide', () => {
    // Routine and todo ids are separate server sequences — both can be 5.
    const r = toAppRoutine({ id: 5, title: '루틴' });
    const td = toAppTodo({ id: 5, title: '투두' });
    expect(r.id).not.toBe(td.id);
    expect(toServerItemId(r.id)).toBe(5);
    expect(toServerItemId(td.id)).toBe(5);
  });

  it('reads wallets into coin/dia', () => {
    expect(
      toWallet([
        { currencyType: 'COIN', balance: 120 },
        { currencyType: 'DIAMOND', balance: 7 },
      ]),
    ).toEqual({ coin: 120, dia: 7 });
  });

  it('builds today completions from routine/todo status', () => {
    const today: TodayResponse = {
      date: '2026-07-02',
      categories: [
        {
          categoryId: 1,
          routines: [
            { id: 1, title: 'a', completed: true },
            { id: 2, title: 'b', completed: false },
          ],
          todos: [{ id: 3, title: 'c', status: 'COMPLETED' }],
        },
      ],
    };
    const map = todayCompletions(today, '2026-07-02');
    expect(map['r1']).toEqual(['2026-07-02']);
    expect(map['r2']).toBeUndefined();
    expect(map['t3']).toEqual(['2026-07-02']);
  });

  it('flattens a /calendar day into 달력 items with the record-time category', () => {
    const items = toCalendarItems({
      date: '2026-07-06',
      categories: [
        {
          categoryId: 7, // deleted server-side — still resolves by id
          routines: [{ id: 1, title: '아침 운동', scheduledTime: '07:00:00', completed: true }],
          todos: [{ id: 2, title: '장보기', status: 'PENDING' }],
        },
        { routines: [{ id: 3, title: '미분류 루틴', completed: false }], todos: [] },
      ],
    });
    expect(items).toEqual([
      { id: 'r1', kind: 'routine', title: '아침 운동', time: '07:00', completed: true, category: '7' }, // prettier-ignore
      { id: 't2', kind: 'todo', title: '장보기', completed: false, category: '7' },
      { id: 'r3', kind: 'routine', title: '미분류 루틴', time: undefined, completed: false, category: undefined }, // prettier-ignore
    ]);
  });

  it('keeps deleted categories flagged for historical lookup', () => {
    expect(toAppCategory({ id: 9, name: '옛것', deleted: true })).toMatchObject({
      id: '9',
      label: '옛것',
      deleted: true,
    });
    expect(toAppCategory({ id: 10, name: '현역' }).deleted).toBeUndefined();
  });

  it('splits the item catalogue and derives a room from owned items', () => {
    const items: ItemResponse[] = [
      {
        id: 1,
        name: 'Forest Sage Set - Arched Window',
        placementType: 'positioned',
        defaultSlot: 'topLeft',
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
      theme: '숲속 세이지',
    });
    expect(cat.wallpapers.map((w) => w.id)).toEqual(['3']);
    expect(cat.floors.map((f) => f.id)).toEqual(['4']);
    expect(cat.backgrounds.map((b) => b.id)).toEqual(['5']);
    expect(cat.ownedIds.sort()).toEqual(['1', '3', '4']);

    const placed = ownedPlacement(cat);
    expect(placed.placedFurnitureIds).toEqual(['1']); // only owned furniture
    expect(placed.wallpaperId).toBe('3'); // owned wallpaper
    expect(placed.floorId).toBe('4'); // owned floor
    expect(placed.backgroundId).toBeNull(); // background not owned
  });

  it('maps category visibility both ways (lossless 4-level round-trip)', () => {
    // 1:1 — 공개↔PUBLIC, 이웃 공개↔HOUSE, 일부 공개↔FRIENDS, 비공개↔PRIVATE.
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'PUBLIC' }).visibility).toBe('public');
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'HOUSE' }).visibility).toBe('neighbor');
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'FRIENDS' }).visibility).toBe(
      'partial',
    );
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'PRIVATE' }).visibility).toBe(
      'private',
    );

    const cat = { id: 'x', label: '취미', icon: 'palette', color: '#123456' } as const;
    expect(toCategoryCreate({ ...cat, visibility: 'public' }).visibility).toBe('PUBLIC');
    expect(toCategoryCreate({ ...cat, visibility: 'neighbor' }).visibility).toBe('HOUSE');
    expect(toCategoryCreate({ ...cat, visibility: 'partial' }).visibility).toBe('FRIENDS');
    expect(toCategoryCreate({ ...cat, visibility: 'private' }).visibility).toBe('PRIVATE');
  });

  it('clears alarm time and end date with explicit nulls on update', () => {
    const routine = {
      id: 'r7',
      title: '아침 운동',
      category: '5',
      days: [1, 5],
      startDate: '2026-07-02',
      endDate: '2026-12-31',
      alarmEnabled: true,
      time: '07:30',
      kind: 'routine' as const,
    };
    // Turning the alarm off / dropping the 종료일 must send null (the server
    // treats PUT as full replace — null unsets the column).
    const req = toRoutineUpdate(routine, { alarmEnabled: false, endDate: undefined, days: [] });
    expect(req.scheduledTime).toBeNull();
    expect(req.endsOn).toBeNull();
    expect(req.repeatDays).toBeNull();
    expect(req.repeatType).toBe('DAILY');
  });

  it('names my house room by profile nickname when the members API has none', () => {
    const detail = { houseId: 1, name: '검증 하우스' };
    const members = [
      {
        membershipId: 1,
        userId: 6,
        nickname: undefined,
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      },
      {
        membershipId: 2,
        userId: 4,
        nickname: '이웃',
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
      },
    ];
    const house = toGroupHouse(detail, members, 6, '준서');
    const rooms = house.floors.flatMap((f) => f.rooms);
    expect(rooms.find((r) => r.isMine)?.name).toBe('준서');
    expect(rooms.find((r) => !r.isMine)?.name).toBe('이웃');

    // Without a profile nickname it falls back to 멤버 N.
    const anon = toGroupHouse(detail, members, 6);
    expect(anon.floors.flatMap((f) => f.rooms).find((r) => r.isMine)?.name).toBe('멤버 6');
  });

  it('carries the house cover key through to the edit-form prefill', () => {
    const detail = {
      houseId: 1,
      name: '검증 하우스',
      coverImageKey: 'house/cloud-balloon/frame.png',
    };
    expect(toGroupHouse(detail, [], 6).coverImageKey).toBe('house/cloud-balloon/frame.png');
    expect(toGroupHouse({ houseId: 2, name: '무커버' }, [], 6).coverImageKey).toBeUndefined();
  });

  it('maps a cover catalog entry and drops keyless ones', () => {
    expect(
      toHouseCover({
        code: 'cloud_balloon',
        name: '구름 풍선 집',
        coverImageKey: 'house/cloud-balloon/frame.png',
      }),
    ).toEqual({
      code: 'cloud_balloon',
      name: '구름 풍선 집',
      coverImageKey: 'house/cloud-balloon/frame.png',
    });
    // Without a key there is nothing to render or submit.
    expect(toHouseCover({ code: 'broken', name: '키 없음' })).toBeNull();
  });

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
    expect(placement).toEqual({
      placedFurnitureIds: ['2'],
      wallpaperId: '9',
      floorId: '11',
      backgroundId: '12',
    });

    const saves = toSlotSaves(['2', '5'], '9', cat, inv, '11', '12');
    expect(saves).toContainEqual({ slotType: 'bottomLeft', userItemId: 21 });
    expect(saves).toContainEqual({ slotType: 'topLeft', userItemId: 22 });
    expect(saves).toContainEqual({ slotType: 'wallpaper', userItemId: 23 });
    expect(saves).toContainEqual({ slotType: 'floor', userItemId: 24 });
    expect(saves).toContainEqual({ slotType: 'background', userItemId: 25 });
    // Every other positioned slot is cleared explicitly.
    expect(saves).toContainEqual({ slotType: 'midLeft', userItemId: null });
    expect(saves).toHaveLength(11);

    // Cleared surfaces save explicit nulls.
    const cleared = toSlotSaves(['2'], '9', cat, inv, null, null);
    expect(cleared).toContainEqual({ slotType: 'floor', userItemId: null });
    expect(cleared).toContainEqual({ slotType: 'background', userItemId: null });

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
      placedFurnitureIds: ['2'],
      wallpaperId: '9',
      floorId: '11',
      backgroundId: null,
    });
  });

  it('maps a house member day to the friend routine list', () => {
    const routines = toFriendRoutines({
      date: '2026-07-08',
      routines: [
        {
          id: 30,
          originRoutineId: 3,
          title: '아침 기상',
          scheduledTime: '07:00:00',
          authType: 'PHOTO',
          completed: true,
        },
        { id: 41, originRoutineId: 4, title: '하루 회고', completed: false },
      ],
      todos: [{ id: 9, title: '장보기', status: 'COMPLETED' }],
    });

    expect(routines).toEqual([
      {
        id: '3', // stable lineage id, not the version id
        title: '아침 기상',
        kind: 'routine',
        completed: true,
        time: '07:00',
        alarmEnabled: true,
        photoVerify: true,
      },
      {
        id: '4',
        title: '하루 회고',
        kind: 'routine',
        completed: false,
        time: undefined,
        alarmEnabled: false,
        photoVerify: false,
      },
      { id: 'todo-9', title: '장보기', kind: 'todo', completed: true },
    ]);
  });

  it('groups gacha machines by theme: themed → furniture, unthemed → character', () => {
    expect(toGachaMachine({ gachaId: 1, name: '숲속 세이지 뽑기', themeId: 1 }).kind).toBe(
      'furniture',
    );
    expect(toGachaMachine({ gachaId: 12, name: '캐릭터 뽑기' }).kind).toBe('character');
  });

  it('maps a mission end time to a local end date for the card', () => {
    expect(
      toHouseMission({
        missionId: 1,
        title: '기간 미션',
        missionType: 'WEEKLY_MEMBER_COUNT',
        targetValue: 5,
        endsAt: '2026-07-23T23:59:59+09:00',
      }).endsOn,
    ).toBe('2026-07-23');
    expect(
      toHouseMission({ missionId: 2, title: '무기한', missionType: 'DAILY_MEMBER_RATE' }).endsOn,
    ).toBeUndefined();
  });

  it('maps a room character code to the app character id', () => {
    expect(characterIdFromCode('cat')).toBe('cat');
    expect(characterIdFromCode('unknown-code')).toBeUndefined();
    expect(characterIdFromCode(undefined)).toBeUndefined();
  });

  it('maps an owned character with its CDN art and animation keys', () => {
    expect(
      toOwnedCharacter({
        userCharacterId: 5,
        characterId: 6,
        code: 'panda',
        name: '판다',
        baseAssetKey: 'characters/panda_sitting.png',
        animations: {
          idle: 'characters/panda/animations/idle.webp',
          poseCycle: 'characters/panda/animations/pose-cycle.webp',
          wave: 'characters/panda/animations/wave.webp',
        },
        selected: true,
      }),
    ).toEqual({
      serverId: 6,
      id: 'panda',
      name: '판다',
      assetKey: 'characters/panda_sitting.png',
      animations: {
        idle: 'characters/panda/animations/idle.webp',
        poseCycle: 'characters/panda/animations/pose-cycle.webp',
        wave: 'characters/panda/animations/wave.webp',
      },
      selected: true,
    });
  });

  it('drops owned characters without an app-side code or a server id', () => {
    // Unknown code: no local sprite to fall back to → not renderable.
    expect(toOwnedCharacter({ characterId: 9, code: 'dragon', selected: false })).toBeNull();
    // Missing characterId: nothing to send to PUT /me/characters/select.
    expect(toOwnedCharacter({ code: 'cat', selected: false })).toBeNull();
  });

  it('falls back to the local character name when the server omits one', () => {
    expect(toOwnedCharacter({ characterId: 1, code: 'cat', selected: false })).toEqual({
      serverId: 1,
      id: 'cat',
      name: '고양이',
      assetKey: undefined,
      animations: undefined,
      selected: false,
    });
  });
});
