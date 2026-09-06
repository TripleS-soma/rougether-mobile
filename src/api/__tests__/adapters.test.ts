import {
  ownedPlacement,
  toBugReportEntry,
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
  toTodoUpdate,
  toWallet,
  todayCompletions,
  toHouse,
  toSearchHouse,
  toPresence,
  toHouseMission,
  toHouseCover,
  toHousePreviewDetail,
  characterIdFromCode,
  toGachaMachine,
  fromFriendRoomSlots,
  fromRoomSlots,
  toFriendCategories,
  toFriendRoutines,
  toCharacterFrames,
  toCharacterFramesMap,
  toOwnedCharacter,
  toUserItemMap,
  toGuestbookEntry,
} from '@/api/adapters';
import type { ItemResponse, MissionSummary, RoutineResponse, TodayResponse } from '@/api/types';
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
        startDate: '2026-07-07', alarmEnabled: false, time: '',
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
        startDate: '2026-07-01', alarmEnabled: false, time: '',
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
        startDate: '2026-07-01', alarmEnabled: false, time: '',
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

  it('maps todo dueTime to the shared time slot and back (#325)', () => {
    // dueTime 있는 투두 → time/alarmEnabled, 없으면 알람 없음.
    const timed = toAppTodo({ id: 9, title: '장보기', dueDate: '2026-07-03', dueTime: '18:00:00' });
    expect(timed).toMatchObject({ time: '18:00', alarmEnabled: true });
    expect(toAppTodo({ id: 9, title: '장보기' })).toMatchObject({ alarmEnabled: false });
    // 업데이트: 시간이 켜져 있을 때만 dueTime 전송(HH:mm:ss) — 해제는 서버 미지원.
    expect(toTodoUpdate(timed, { alarmEnabled: true, time: '09:05' }).dueTime).toBe('09:05:00');
    expect(toTodoUpdate(toAppTodo({ id: 9, title: '장보기' })).dueTime).toBeUndefined();
  });

  it('keeps routine/todo app ids distinct when server ids collide', () => {
    // Routine and todo ids are separate server sequences — both can be 5.
    const r = toAppRoutine({ id: 5, title: '루틴' });
    const td = toAppTodo({ id: 5, title: '투두' });
    expect(r.id).not.toBe(td.id);
    expect(toServerItemId(r.id)).toBe(5);
    expect(toServerItemId(td.id)).toBe(5);
  });

  it('reads wallets into coin/diamond', () => {
    expect(
      toWallet([
        { currencyType: 'COIN', balance: 120 },
        { currencyType: 'DIAMOND', balance: 7 },
      ]),
    ).toEqual({ coin: 120, diamond: 7 });
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
      name: '옛것',
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

    const cat = { id: 'x', name: '취미', icon: 'palette', color: '#123456' } as const;
    expect(toCategoryCreate({ ...cat, visibility: 'public' }).visibility).toBe('PUBLIC');
    expect(toCategoryCreate({ ...cat, visibility: 'neighbor' }).visibility).toBe('HOUSE');
    expect(toCategoryCreate({ ...cat, visibility: 'partial' }).visibility).toBe('FRIENDS');
    expect(toCategoryCreate({ ...cat, visibility: 'private' }).visibility).toBe('PRIVATE');
  });

  it('round-trips the mission/house link ids (#578)', () => {
    // Routine ↔ houseMissionId: 서버 id가 앱 linkedMissionId로 오간다.
    const linked = toAppRoutine({ id: 12, title: '아침 스트레칭', houseMissionId: 6 });
    expect(linked.linkedMissionId).toBe(6);
    expect(toAppRoutine({ id: 12, title: '미연동', houseMissionId: null }).linkedMissionId).toBeUndefined(); // prettier-ignore
    expect(
      toRoutineCreate({
        title: '아침 스트레칭', category: '1', days: [], startDate: '2026-07-01',
        alarmEnabled: false, time: '', linkedMissionId: 6,
      }).houseMissionId, // prettier-ignore
    ).toBe(6);
    // 이름을 바꿔도 링크 id는 그대로 실려 연동이 유지된다.
    expect(toRoutineUpdate(linked, { title: '이름 바꿈' })).toMatchObject({ houseMissionId: 6 });
    // 미연동 루틴 수정은 houseMissionId를 싣지 않는다 — 링크를 건드리지 않음
    // (해제는 전용 DELETE 엔드포인트).
    expect(toRoutineUpdate({ ...linked, linkedMissionId: undefined }).houseMissionId).toBeUndefined(); // prettier-ignore

    // Category ↔ houseId.
    expect(toAppCategory({ id: 20, name: 'TripleS', houseId: 2 }).houseId).toBe(2);
    expect(toAppCategory({ id: 20, name: '일반', houseId: null }).houseId).toBeUndefined();
    const cat = { id: '20', name: 'TripleS', icon: 'house', color: '#123456', visibility: 'neighbor', houseId: 2 } as const; // prettier-ignore
    expect(toCategoryCreate(cat).houseId).toBe(2);
    expect(toCategoryCreate({ ...cat, houseId: undefined }).houseId).toBeUndefined();
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

  it('기존 사진 인증 루틴은 수정해도 authType PHOTO를 유지한다 (#695)', () => {
    // UI는 제거됐지만(PR #712) PUT이 전체 교체라, 다른 필드만 고친 수정이
    // 서버의 PHOTO를 CHECK로 조용히 바꾸면 안 된다 — photoVerify 왕복이 근거.
    const routine = {
      id: 'r8',
      title: '운동 인증',
      category: '5',
      days: [],
      startDate: '2026-07-02',
      alarmEnabled: false,
      time: '',
      kind: 'routine' as const,
      photoVerify: true,
    };
    expect(toRoutineUpdate(routine, { title: '이름 변경' }).authType).toBe('PHOTO');
    // photoVerify 없는 일반 루틴은 그대로 CHECK.
    expect(toRoutineUpdate({ ...routine, photoVerify: undefined }, {}).authType).toBe('CHECK');
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
    const house = toHouse(detail, members, 6, '준서');
    const rooms = house.floors.flatMap((f) => f.rooms);
    expect(rooms.find((r) => r.isMine)?.name).toBe('준서');
    expect(rooms.find((r) => !r.isMine)?.name).toBe('이웃');

    // Without a profile nickname it falls back to 멤버 N.
    const anon = toHouse(detail, members, 6);
    expect(anon.floors.flatMap((f) => f.rooms).find((r) => r.isMine)?.name).toBe('멤버 6');
  });

  it('prefers the live profile nickname over the stale members-API one (#924)', () => {
    // 프로필에서 이름을 바꿔도 집을 다시 부르기 전까지 멤버 API는 옛 이름을
    // 들고 있다. 좌석 타일은 뷰에서 라이브 이름으로 덮지만(#479), 멤버 목록
    // (house-members-screen)은 room.name을 그대로 그려서 내 행만 옛 이름으로
    // 남았다. 같은 값의 출처는 프로필이므로 그쪽이 이긴다.
    const detail = { houseId: 1, name: '검증 하우스' };
    const members = [
      {
        membershipId: 1,
        userId: 6,
        nickname: '옛이름',
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
    const rooms = toHouse(detail, members, 6, '새이름').floors.flatMap((f) => f.rooms);
    expect(rooms.find((r) => r.isMine)?.name).toBe('새이름');
    // 남의 이름까지 덮으면 안 된다.
    expect(rooms.find((r) => !r.isMine)?.name).toBe('이웃');
  });

  it('derives tile presence from lastAccessedAt (#383)', () => {
    const now = Date.parse('2026-07-22T12:00:00Z');
    // 40분 창 안 → 접속 중, 라벨 없음.
    expect(toPresence('2026-07-22T11:30:00Z', now)).toEqual({ online: true });
    // 창 밖 → 상대 시각 라벨.
    expect(toPresence('2026-07-22T11:10:00Z', now)).toEqual({ lastSeenLabel: '50분 전' });
    expect(toPresence('2026-07-22T09:00:00Z', now)).toEqual({ lastSeenLabel: '3시간 전' });
    expect(toPresence('2026-07-20T12:00:00Z', now)).toEqual({ lastSeenLabel: '2일 전' });
    expect(toPresence('2025-07-22T12:00:00Z', now)).toEqual({ lastSeenLabel: '오래 전' });
    // 존 표기가 빠진 UTC(서버 계약)도 로컬로 오독하지 않는다.
    expect(toPresence('2026-07-22T11:30:00', now)).toEqual({ online: true });
    // 이력 없음/깨진 값 → 아무것도 표시하지 않음.
    expect(toPresence(undefined, now)).toEqual({});
    expect(toPresence('not-a-date', now)).toEqual({});

    const detail = { houseId: 1, name: '집' };
    const members = [
      {
        membershipId: 1,
        userId: 6,
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
        nickname: '나',
        lastAccessedAt: '2026-07-22T11:50:00Z',
      },
      {
        membershipId: 2,
        userId: 4,
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
        nickname: '이웃',
        lastAccessedAt: '2026-07-22T06:00:00Z',
      },
    ];
    const rooms = toHouse(detail, members, 6, undefined, undefined, now).floors.flatMap(
      (f) => f.rooms,
    );
    expect(rooms.find((r) => r.isMine)?.online).toBe(true);
    const neighbor = rooms.find((r) => !r.isMine);
    expect(neighbor?.online).toBeUndefined();
    expect(neighbor?.lastSeenLabel).toBe('6시간 전');
  });

  it('carries growth points through for the level-progress pill', () => {
    expect(toHouse({ houseId: 1, name: '집', growthPoints: 130 }, [], 6).growthPoints).toBe(130);
    expect(toHouse({ houseId: 1, name: '집', growthPoints: 0 }, [], 6).growthPoints).toBe(0);
    expect(toHouse({ houseId: 2, name: '집' }, [], 6).growthPoints).toBeUndefined();
  });

  it('pads the grid to the house capacity with vacant seats, my room bottom-left', () => {
    const detail = { houseId: 1, name: '정원 하우스', maxMembers: 4 };
    const members = [
      {
        membershipId: 1,
        userId: 9,
        nickname: '방장',
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      },
      {
        membershipId: 2,
        userId: 6,
        nickname: '나야',
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
      },
      {
        membershipId: 3,
        userId: 4,
        nickname: '떠남',
        role: 'MEMBER' as const,
        status: 'LEFT' as const,
      },
    ];
    const house = toHouse(detail, members, 6);
    // Top floor renders first; the yet-unfilled seats pad the upper floor.
    expect(house.floors.map((f) => f.level)).toEqual(['2층', '1층']);
    expect(house.floors[0].rooms.map((r) => r.vacant)).toEqual([true, true]);
    // 1층 fills from the left: my room first, then the others in join order.
    expect(house.floors[1].rooms.map((r) => r.name)).toEqual(['나야', '방장']);
    expect(house.floors[1].rooms[0].isMine).toBe(true);
  });

  it('mixes a member and a vacant seat on the same row when the headcount is odd', () => {
    const members = [
      {
        membershipId: 1,
        userId: 6,
        nickname: '나야',
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      },
      {
        membershipId: 2,
        userId: 9,
        nickname: '이웃1',
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
      },
      {
        membershipId: 3,
        userId: 10,
        nickname: '이웃2',
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
      },
    ];
    const house = toHouse({ houseId: 1, name: '섞임집', maxMembers: 6 }, members, 6);
    // 정원 6 / 멤버 3 → 마지막 멤버는 가운데 행에서 빈방과 나란히 앉는다.
    expect(house.floors.map((f) => f.rooms.map((r) => (r.vacant ? '빈방' : r.name)))).toEqual([
      ['빈방', '빈방'],
      ['이웃2', '빈방'],
      ['나야', '이웃1'],
    ]);
  });

  it('keeps a lone top-floor seat when the capacity is odd', () => {
    const members = [
      {
        membershipId: 1,
        userId: 6,
        nickname: '나야',
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      },
    ];
    const house = toHouse({ houseId: 1, name: '홀수집', maxMembers: 3 }, members, 6);
    expect(house.floors.map((f) => f.rooms.length)).toEqual([1, 2]);
    expect(house.floors[1].rooms.map((r) => r.name)).toEqual(['나야', '빈방']);
  });

  it('carries the house cover key through to the edit-form prefill', () => {
    const detail = {
      houseId: 1,
      name: '검증 하우스',
      coverImageKey: 'house/cloud-balloon/frame.png',
    };
    expect(toHouse(detail, [], 6).coverImageKey).toBe('house/cloud-balloon/frame.png');
    expect(toHouse({ houseId: 2, name: '무커버' }, [], 6).coverImageKey).toBeUndefined();
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

  it('converts preview memberRooms into window room models with the catalogue (#386)', () => {
    const cat = {
      furniture: [
        { id: '2', name: '침대', slot: 'bottomLeft' as const, category: '가구' as const, price: 0, assetKey: 'items/a/bed.png' }, // prettier-ignore
      ],
      wallpapers: [{ id: '9', name: '벽지', price: 0, assetKey: 'items/a/wp.png', color: '#FFF' }],
      floors: [],
      backgrounds: [],
      ownedIds: [],
    };
    const wire = {
      houseId: 3,
      name: '미리보기집',
      currentMemberCount: 2,
      memberRooms: [
        {
          membershipId: 1,
          room: {
            layoutFormat: 'SLOT_V1' as const,
            character: { code: 'cat' },
            slots: [
              { slotType: 'bottomLeft', assetKey: 'items/a/bed.png' },
              { slotType: 'wallpaper', assetKey: 'items/a/wp.png' },
            ],
          },
        },
        // 방 미생성 구성원 → 기본 빈 방.
        { membershipId: 2, room: null },
      ],
    };
    const detail = toHousePreviewDetail(wire, cat);
    expect(detail.rooms).toHaveLength(2);
    // 아직 SLOT_V1인 방 — **가구는 비고 표면(벽지)은 살아 있다** (#925).
    // 예전엔 슬롯의 침대를 placedFurnitureIds로 되살려 앵커 좌표에 그렸다.
    expect(detail.rooms![0]).toMatchObject({
      wallpaperId: '9',
      placements: [],
      characterId: 'cat',
    });
    expect(detail.rooms![1]).toEqual({ placements: [] });

    // FREE_V1 방의 가구는 그대로 실린다 — 폴백만 없앤 것이지 렌더를 끊은 게 아니다.
    const freeWire = {
      ...wire,
      memberRooms: [
        {
          membershipId: 1,
          room: {
            layoutFormat: 'FREE_V1' as const,
            character: { code: 'cat' },
            slots: [{ slotType: 'wallpaper', assetKey: 'items/a/wp.png' }],
            placements: [
              { assetKey: 'items/a/bed.png', positionX: 0.4, positionY: 0.6, zIndex: 1 },
            ],
          },
        },
      ],
    };
    const freeDetail = toHousePreviewDetail(freeWire, cat);
    expect(freeDetail.rooms![0].placements).toHaveLength(1);
    expect(freeDetail.rooms![0].placements![0]).toMatchObject({ furnitureId: '2' });

    // 카탈로그가 없으면(상점 미로드) rooms를 만들지 않아 목업으로 폴백한다.
    expect(toHousePreviewDetail(wire).rooms).toBeUndefined();
  });

  it('입주 신청은 PENDING만 노출한다 — 처리된 이력 혼합 응답 (#526)', () => {
    const house = toHouse(
      { houseId: 7, name: '집', myRole: 'OWNER' },
      [],
      undefined,
      undefined,
      [],
      0,
      [
        { requestId: 1, nickname: '대기', status: 'PENDING' },
        { requestId: 2, nickname: '수락됨', status: 'ACCEPTED' },
        { requestId: 3, nickname: '거절됨', status: 'REJECTED' },
        { requestId: 4, nickname: '상태없음' },
      ],
    );
    expect(house.joinRequests?.map((r) => r.requestId)).toEqual([1, 4]);
  });

  it('maps a bug report to the history row (#496)', () => {
    expect(
      toBugReportEntry({
        bugReportId: 7,
        title: '로그인이 안 돼요',
        status: 'IN_PROGRESS',
        screenshotKeys: ['bug/a.png'],
        createdAt: '2026-07-20T09:00:00Z',
      }),
    ).toEqual({
      id: 7,
      title: '로그인이 안 돼요',
      status: 'IN_PROGRESS',
      date: '7월 20일',
      // 첨부 키를 그대로 흘려야 화면이 스크린샷을 받아올 수 있다 (#736).
      screenshotKeys: ['bug/a.png'],
    });
    // 서버가 첨부 키를 안 주면 빈 배열 — 화면이 length로 분기한다.
    expect(toBugReportEntry({ bugReportId: 9 }).screenshotKeys).toEqual([]);
    // 미지정 상태는 접수됨으로.
    expect(toBugReportEntry({ bugReportId: 8 }).status).toBe('RECEIVED');
  });

  it('멤버 day의 categoryId·카테고리 메타를 그룹핑 모델로 매핑한다 (#528, 서버 #237)', () => {
    const day = {
      date: '2026-07-30',
      routines: [
        { id: 1, originRoutineId: 1, title: '아침 기상', categoryId: 3, completed: false },
      ],
      todos: [{ id: 9, title: '장보기', status: 'PENDING' as const, categoryId: 3 }],
      categories: [{ id: 3, name: '건강', colorHex: '#FF8800', iconKey: 'dumbbell' }],
    };
    const routines = toFriendRoutines(day);
    expect(routines[0].category).toBe('3');
    expect(routines[1].category).toBe('3');
    expect(toFriendCategories(day)).toEqual([
      {
        id: '3',
        name: '건강',
        icon: 'dumbbell',
        color: '#FF8800',
        visibility: 'neighbor',
      },
    ]);
    // 비공개라 메타가 안 내려온 categoryId는 그대로 남아 미분류로 흘러간다.
    expect(
      toFriendRoutines({ routines: [{ id: 2, title: '비밀 루틴', categoryId: 99 }] })[0].category,
    ).toBe('99');
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

  /**
   * `25/100`만 보여주면 그 숫자가 비율인지 횟수인지 카드에서 알 수 없다 —
   * 만들 때는 "1~100%"라고 물어놓고 목록에선 단위가 사라졌었다 (#887).
   */
  it('미션 유형에 맞는 단위를 싣는다 (#887)', () => {
    expect(
      toHouseMission({ missionId: 1, title: '영양제 먹기', missionType: 'DAILY_MEMBER_RATE' }).unit,
    ).toBe('%');
    expect(
      toHouseMission({ missionId: 2, title: '루게더 개발', missionType: 'WEEKLY_MEMBER_COUNT' })
        .unit,
    ).toBe('회');
    // 서버가 모르는 유형을 보내와도 카드가 깨지지 않게 — 단위만 비운다.
    // 생성 타입에는 없지만 서버가 나중에 새 유형을 붙일 수 있다 — 런타임 폴백.
    expect(
      toHouseMission({
        missionId: 3,
        title: '???',
        missionType: 'UNKNOWN_TYPE' as MissionSummary['missionType'],
      }).unit,
    ).toBe('');
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

  it('미리보기 응답의 단체미션을 진행 모델로 매핑한다 (#532, 통합 어댑터)', () => {
    expect(
      toHousePreviewDetail({
        houseId: 7,
        name: '미리보기 집',
        description: '함께 루틴을 지켜요',
        currentMemberCount: 2,
        maxMembers: 4,
        level: 3,
        missions: [
          {
            missionId: 9,
            title: '주간 미션',
            missionType: 'WEEKLY_MEMBER_COUNT',
            currentValue: 4,
            targetValue: 10,
            status: 'ACTIVE',
          },
          {
            // 완료 미션은 진행값이 리셋돼 내려온다 — 미리보기에서 제외 (#233).
            missionId: 10,
            title: '끝난 미션',
            missionType: 'DAILY_MEMBER_RATE',
            currentValue: 0,
            targetValue: 3,
            status: 'COMPLETED',
          },
        ],
      }),
    ).toMatchObject({
      id: 7,
      name: '미리보기 집',
      members: 2,
      capacity: 4,
      level: 3,
      missions: [expect.objectContaining({ id: 9, current: 4, target: 10 })],
    });
  });

  it('maps a room character code to the app character id', () => {
    expect(characterIdFromCode('cat')).toBe('cat');
    expect(characterIdFromCode('unknown-code')).toBeUndefined();
    expect(characterIdFromCode(undefined)).toBeUndefined();
  });

  it('maps an owned character with its CDN art and pose frames', () => {
    expect(
      toOwnedCharacter({
        userCharacterId: 5,
        characterId: 6,
        code: 'panda',
        name: '판다',
        baseAssetKey: 'characters/panda_sitting.png',
        poses: [
          { id: 2, assetKey: 'characters/panda/poses/wiggle.webp', sortOrder: 20 },
          { id: 1, assetKey: 'characters/panda/poses/idle.webp', sortOrder: 10 },
        ],
        selected: true,
      }),
    ).toEqual({
      serverId: 6,
      id: 'panda',
      name: '판다',
      assetKey: 'characters/panda_sitting.png',
      frames: ['characters/panda/poses/idle.webp', 'characters/panda/poses/wiggle.webp'],
      selected: true,
    });
  });

  it('poses[] wins over the legacy animation set, and non-CDN keys drop (#735)', () => {
    const legacy = {
      idle: 'characters/cat/animations/idle.webp',
      poseCycle: 'characters/cat/animations/pose-cycle.webp',
      wave: 'characters/cat/animations/wave.gif',
    };

    // 등록된 포즈가 있으면 그 순서가 유일한 진실 — 레거시 3칸은 무시된다.
    expect(
      toCharacterFrames(
        [
          { id: 3, assetKey: 'characters/cat/poses/wink.webp', sortOrder: 30 },
          { id: 1, assetKey: 'characters/cat/poses/head.webp', sortOrder: 10 },
          // CDN 키가 아니면 그리지 못하므로 조용히 버린다.
          { id: 4, assetKey: 'legacy/cat.webp', sortOrder: 40 },
          { id: 2, assetKey: 'characters/cat/poses/ear.webp', sortOrder: 20 },
        ],
        legacy,
      ),
    ).toEqual([
      'characters/cat/poses/head.webp',
      'characters/cat/poses/ear.webp',
      'characters/cat/poses/wink.webp',
    ]);

    // 포즈 미등록 캐릭터는 레거시 idle → poseCycle → wave 순서로 폴백.
    expect(toCharacterFrames(undefined, legacy)).toEqual([
      'characters/cat/animations/idle.webp',
      'characters/cat/animations/pose-cycle.webp',
      'characters/cat/animations/wave.gif',
    ]);
    expect(toCharacterFrames([], undefined)).toEqual([]);
  });

  it('builds the master frames map, skipping characters with no art (#735)', () => {
    expect(
      toCharacterFramesMap([
        { id: 1, code: 'cat', poses: [{ id: 1, assetKey: 'characters/cat/poses/idle.webp' }] },
        { id: 2, code: 'otter', animations: { wave: 'characters/otter/animations/wave.webp' } },
        // 프레임이 하나도 없으면 맵에서 빠진다 — 번들 정적 포즈로 폴백.
        { id: 3, code: 'panda' },
        // 앱이 모르는 코드는 캐릭터 id로 접힐 수 없다.
        { id: 4, code: 'dragon', poses: [{ id: 9, assetKey: 'characters/dragon/idle.webp' }] },
      ]),
    ).toEqual({
      cat: ['characters/cat/poses/idle.webp'],
      otter: ['characters/otter/animations/wave.webp'],
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
      frames: [],
      selected: false,
    });
  });

  it('toSearchHouse는 목표 전부를 tags에 담는다 — 검색용 (#1110)', () => {
    const house = toSearchHouse({
      houseId: 7,
      name: '새벽 클럽',
      goals: [{ code: 'WAKE', name: '기상' }, { code: 'READ', name: '독서' }, { code: 'X' }],
    });
    expect(house.tag).toBe('기상');
    expect(house.tags).toEqual(['기상', '독서']);
  });

  it('toSearchHouse falls back to id 0 when the summary lacks houseId (#544)', () => {
    // houseId number 전환 후의 결측 폴백 안전망 — 서버 스키마가 전부 옵셔널이라
    // 결측 시에도 리스트 렌더가 깨지지 않아야 한다.
    const house = toSearchHouse({ name: '이름뿐인 집' });
    expect(house.id).toBe(0);
    expect(house.name).toBe('이름뿐인 집');
  });

  /** 동거 봇 (서버 #309·#310) — 화면이 배지를 그릴 수 있게 그대로 흘려보낸다. */
  describe('동거 봇 필드 (#947)', () => {
    it('toHouse가 MemberSummary.bot을 좌석에 흘린다', () => {
      const house = toHouse(
        { houseId: 1, name: '나의 집', maxMembers: 4 },
        [
          { membershipId: 10, userId: 100, nickname: '나', role: 'OWNER', status: 'ACTIVE' },
          { membershipId: 11, userId: 101, nickname: '루티', status: 'ACTIVE', bot: true },
        ],
        100,
      );
      const cells = house.floors.flatMap((f) => f.rooms);
      expect(cells.find((c) => c.name === '루티')?.bot).toBe(true);
      // 사람 좌석에는 붙지 않는다 — 배지가 잘못 뜨면 안 된다.
      expect(cells.find((c) => c.name === '나')?.bot).toBeUndefined();
    });

    it('toGuestbookEntry가 authorBot을 넘긴다', () => {
      expect(
        toGuestbookEntry({
          guestbookId: 1,
          authorNickname: '루티',
          content: '안녕',
          authorBot: true,
        }).authorBot,
      ).toBe(true);
      // 사람 글은 값이 없거나 false — 배지가 붙으면 안 된다.
      expect(
        toGuestbookEntry({ guestbookId: 2, authorNickname: '친구', content: '하이' }).authorBot,
      ).toBeUndefined();
    });
  });
});

/**
 * 동거 봇의 접속 표시 (#1013). 서버 스케줄러가 `lastAccessedAt`을 갱신하므로
 * 그대로 통과시키면 좌석 타일에 "접속 중"·"1시간 전"이 떠서 **봇이 사람보다
 * 활발해 보인다.** 사람의 접속과 뜻이 다른 값이라 같은 모양이면 거짓말이다.
 */
describe('봇에는 접속 표시를 붙이지 않는다 (#1013)', () => {
  const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  // 캐스팅 없이 구조적 타입 검사를 그대로 받는다 (#1014 리뷰) — 스키마가
  // 바뀌면 런타임이 아니라 컴파일에서 걸려야 한다.
  const seatOf = (bot: boolean) =>
    toHouse(
      { houseId: 1, name: '테스트 집', maxMembers: 2 },
      [
        {
          membershipId: 1,
          userId: 10,
          nickname: bot ? '루나' : '진형',
          role: 'MEMBER' as const,
          status: 'ACTIVE' as const,
          bot,
          lastAccessedAt: at(1000),
        },
      ],
      99,
    ).floors[0].rooms[0];

  it('봇은 online·lastSeenLabel이 모두 없다', () => {
    const seat = seatOf(true);
    expect(seat.bot).toBe(true);
    expect(seat.online).toBeUndefined();
    expect(seat.lastSeenLabel).toBeUndefined();
  });

  it('사람은 그대로 접속 표시를 받는다', () => {
    expect(seatOf(false).online).toBe(true);
  });
});
