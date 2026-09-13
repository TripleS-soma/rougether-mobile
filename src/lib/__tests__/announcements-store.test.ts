import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadReadAnnouncements, saveReadAnnouncements } from '@/lib/announcements-store';

const KEY = 'rougether.announcements.v1';

beforeEach(() => AsyncStorage.clear());

describe('announcements store (#1320)', () => {
  it('keeps the read set per account', async () => {
    await saveReadAnnouncements(72, new Set(['a', 'b']));
    expect(JSON.parse((await AsyncStorage.getItem(`${KEY}.72`)) ?? '')).toEqual({
      read: ['a', 'b'],
    });
    expect([...(await loadReadAnnouncements(72))]).toEqual(['a', 'b']);
    // Another account (or the device-scoped legacy shape) never inherits it (#1298).
    expect((await loadReadAnnouncements(73)).size).toBe(0);
    expect((await loadReadAnnouncements(undefined)).size).toBe(0);
  });

  it('ignores garbage and non-string ids', async () => {
    await AsyncStorage.setItem(`${KEY}.1`, 'not json');
    expect((await loadReadAnnouncements(1)).size).toBe(0);
    await AsyncStorage.setItem(`${KEY}.1`, JSON.stringify({ read: ['ok', 3, null] }));
    expect([...(await loadReadAnnouncements(1))]).toEqual(['ok']);
    await AsyncStorage.setItem(`${KEY}.1`, JSON.stringify({ read: 'ok' }));
    expect((await loadReadAnnouncements(1)).size).toBe(0);
  });

  it('does not write without an account', async () => {
    await saveReadAnnouncements(undefined, new Set(['a']));
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
