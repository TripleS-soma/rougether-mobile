import type { Floor, House, RoomCell } from '@/components/screens/group-house-screen';

/**
 * A house's seat arrangement in display order (top-left seat first):
 * membershipId for an occupied seat, null for a vacant one. Persisted locally
 * per viewer+house (no server endpoint yet — see #278).
 */
export type RoomLayout = (number | null)[];

const VACANT_CELL: RoomCell = { name: '빈방', color: 'transparent', vacant: true };

/** Row lengths of the house grid, top row first (holds the odd half-row). */
const rowShapes = (house: House) => house.floors.map((f) => f.rooms.length);

/** The grid's cells flattened in display order (top-left first). */
export const flatRooms = (house: House): RoomCell[] => house.floors.flatMap((f) => f.rooms);

/** The layout a house currently shows — what a swap starts from. */
export const layoutFromHouse = (house: House): RoomLayout =>
  flatRooms(house).map((r) => r.membershipId ?? null);

/** Swap two seats of a layout (returns a new array; no-op when equal). */
export function swapSeats(layout: RoomLayout, a: number, b: number): RoomLayout {
  const next = [...layout];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * Re-seat the house's rooms to a stored layout. Robust to roster drift since
 * the layout was saved: members missing from the layout (new joiners) fill the
 * first free seats in their default order, stale membershipIds become vacant
 * seats, and a capacity change re-sizes to the house's current seat count.
 * Houses without server ids (demo) return unchanged.
 */
export function applyRoomLayout(house: House, layout: RoomLayout | null): House {
  if (!layout || house.houseId == null) return house;
  const cells = flatRooms(house);
  const byMembership = new Map(
    cells.filter((c) => c.membershipId != null).map((c) => [c.membershipId!, c]),
  );
  if (byMembership.size === 0) return house;

  // Place stored seats first (sized to the current capacity), then fill the
  // remaining free seats with unplaced members, then vacants.
  const seats: (RoomCell | null)[] = Array.from(
    { length: cells.length },
    (_, i) => (i < layout.length && layout[i] != null && byMembership.get(layout[i]!)) || null,
  );
  // Who actually got a seat — a capacity shrink can cut stored seats off, and
  // those members must re-enter as unplaced instead of silently dropping.
  const seated = new Set(seats.filter((c) => c != null).map((c) => c!.membershipId));
  const unplaced = cells.filter((c) => c.membershipId != null && !seated.has(c.membershipId));
  // Fill bottom-up (display order is top-first): the house fills from the
  // ground floor, so a new joiner takes the lowest free seat.
  for (const cell of unplaced.reverse()) {
    const free = seats.lastIndexOf(null);
    if (free === -1) return house; // capacity below headcount — trust the server data
    seats[free] = cell;
  }

  const arranged = seats.map((s) => s ?? VACANT_CELL);
  const floors: Floor[] = [];
  let offset = 0;
  for (const [i, size] of rowShapes(house).entries()) {
    floors.push({ level: house.floors[i].level, rooms: arranged.slice(offset, offset + size) });
    offset += size;
  }
  return { ...house, floors };
}
