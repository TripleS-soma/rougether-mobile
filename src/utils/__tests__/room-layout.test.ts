import type { House } from '@/components/screens/group-house-screen';
import { applyRoomLayout, flatRooms, layoutFromHouse, swapSeats } from '@/utils/room-layout';

/** 정원 4 / 멤버 3 — display order: [빈방], [나(1), 이웃(2)] bottom row. */
const HOUSE: House = {
  houseId: 7,
  title: '집',
  floors: [
    {
      level: '2층',
      rooms: [
        { name: '이웃2', color: '#EEE', membershipId: 3 },
        { name: '빈방', color: 'transparent', vacant: true },
      ],
    },
    {
      level: '1층',
      rooms: [
        { name: '나', color: '#EEE', isMine: true, membershipId: 1 },
        { name: '이웃1', color: '#EEE', membershipId: 2 },
      ],
    },
  ],
};

describe('room layout', () => {
  it('reads the current layout and swaps seats immutably', () => {
    const layout = layoutFromHouse(HOUSE);
    expect(layout).toEqual([3, null, 1, 2]);
    expect(swapSeats(layout, 0, 3)).toEqual([2, null, 1, 3]);
    expect(layout).toEqual([3, null, 1, 2]); // untouched
  });

  it('re-seats rooms to a stored layout, keeping row shapes', () => {
    const arranged = applyRoomLayout(HOUSE, [1, 2, 3, null]);
    expect(flatRooms(arranged).map((r) => (r.vacant ? '빈방' : r.name))).toEqual([
      '나',
      '이웃1',
      '이웃2',
      '빈방',
    ]);
    expect(arranged.floors.map((f) => f.level)).toEqual(['2층', '1층']);
  });

  it('seats new joiners on the first free seat and drops stale ids to vacant', () => {
    // Saved before 이웃2(3) joined and while 옛멤버(9) was still around.
    const arranged = applyRoomLayout(HOUSE, [9, 2, 1, null]);
    expect(flatRooms(arranged).map((r) => (r.vacant ? '빈방' : r.name))).toEqual([
      '빈방', // stale 9 → vacant
      '이웃1',
      '나',
      '이웃2', // new joiner fills the first free seat
    ]);
  });

  it('re-sizes a layout saved under a different capacity', () => {
    // Saved when the house had 6 seats; now it has 4.
    const arranged = applyRoomLayout(HOUSE, [null, null, 3, 2, 1, null]);
    const names = flatRooms(arranged).map((r) => (r.vacant ? '빈방' : r.name));
    expect(names).toHaveLength(4);
    expect(names.filter((n) => n !== '빈방').sort()).toEqual(['나', '이웃1', '이웃2']);
  });

  it('returns demo houses (no server ids) unchanged', () => {
    const demo: House = { title: '데모', floors: HOUSE.floors };
    expect(applyRoomLayout(demo, [1, 2, 3, null])).toBe(demo);
    expect(applyRoomLayout(HOUSE, null)).toBe(HOUSE);
  });
});
