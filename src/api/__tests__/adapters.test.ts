import {
  ownedPlacement,
  toAppCategory,
  toAppRoutine,
  toAppTodo,
  toCategoryCreate,
  toRoutineCreate,
  toShopCatalogue,
  toTodoCreate,
  toWallet,
  todayCompletions,
  toGroupHouse,
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
      id: '12',
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
      id: '9',
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
          name: '건강',
          routines: [
            { id: 1, title: 'a', completed: true },
            { id: 2, title: 'b', completed: false },
          ],
          todos: [{ id: 3, title: 'c', status: 'COMPLETED' }],
        },
      ],
    };
    const map = todayCompletions(today, '2026-07-02');
    expect(map['1']).toEqual(['2026-07-02']);
    expect(map['2']).toBeUndefined();
    expect(map['3']).toEqual(['2026-07-02']);
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
      // surface floor item without a slot → excluded from positioned furniture.
      { id: 4, name: '바닥', placementType: 'surface_slot', categoryCode: 'floor', owned: false },
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
    expect(cat.ownedIds.sort()).toEqual(['1', '3']);

    const placed = ownedPlacement(cat);
    expect(placed.placedFurnitureIds).toEqual(['1']); // only owned furniture
    expect(placed.wallpaperId).toBe('3'); // owned wallpaper
  });

  it('maps category visibility both ways', () => {
    expect(
      toAppCategory({ id: 4, name: '취미', colorHex: '#123456', visibility: 'HOUSE' }),
    ).toMatchObject({ id: '4', label: '취미', color: '#123456', visibility: 'public' });
    expect(
      toCategoryCreate({
        id: 'x',
        label: '취미',
        emoji: '🎨',
        color: '#123456',
        visibility: 'public',
      }),
    ).toMatchObject({ name: '취미', colorHex: '#123456', iconKey: '🎨', visibility: 'HOUSE' });
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
});
