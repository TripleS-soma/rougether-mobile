import {
  toFriendCategories,
  toFriendRoutines,
  toGuestbookEntry,
  toHouse,
  toHouseCover,
  toHouseMission,
  toHousePreviewDetail,
  toPresence,
  toSearchHouse,
} from '@/api/adapters/house';
import type { MissionSummary } from '@/api/types';

describe('API adapters — house', () => {
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
