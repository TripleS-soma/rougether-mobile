import { roomEntries } from '@/dev/registry/room';
import { houseEntries } from '@/dev/registry/house';
import { designEntries } from '@/dev/registry/design';
import { shopGachaEntries } from '@/dev/registry/shop-gacha';
import { routineTodoEntries } from '@/dev/registry/routine-todo';
import { memberEntries } from '@/dev/registry/member';
import { notificationEntries } from '@/dev/registry/notification';
import type { GalleryEntry } from '@/dev/registry/types';

export type { GalleryEntry } from '@/dev/registry/types';

/**
 * The dev gallery (`/dev` route) renders every entry here so you can eyeball a
 * component in isolation on device / simulator / web without wiring it into a
 * real screen first. Add an entry whenever you build a new component — to the
 * domain file that owns it (`room.tsx`, `house.tsx`, …, same axis as the
 * `domain:*` issue labels). The gallery renders in this array order, so entries
 * appear grouped by domain.
 */
export const galleryEntries: GalleryEntry[] = [
  ...roomEntries,
  ...houseEntries,
  ...designEntries,
  ...shopGachaEntries,
  ...routineTodoEntries,
  ...memberEntries,
  ...notificationEntries,
];
