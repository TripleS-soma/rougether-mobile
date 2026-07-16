import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RoomLayout } from '@/utils/room-layout';

/**
 * Locally persisted room-tile arrangement per viewer+house (#278). The server
 * has no layout endpoint yet, so this is device-local: the same account on
 * another device sees the default arrangement. Keyed by the session user id so
 * accounts sharing a device don't leak layouts into each other.
 */
const keyFor = (houseId: number, userId?: number) =>
  `rougether.roomLayout.v1.${userId ?? 'anon'}.${houseId}`;

export async function loadRoomLayout(houseId: number, userId?: number): Promise<RoomLayout | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(houseId, userId));
    return raw ? (JSON.parse(raw) as RoomLayout) : null;
  } catch {
    return null;
  }
}

export async function saveRoomLayout(
  houseId: number,
  layout: RoomLayout,
  userId?: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(houseId, userId), JSON.stringify(layout));
  } catch {
    // Ignore persistence failures — the arrangement still applies this session.
  }
}
