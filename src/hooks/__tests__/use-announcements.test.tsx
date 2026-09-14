import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getAnnouncements } from '@/constants/announcements';
import { useAnnouncements } from '@/hooks/use-announcements';

const ANNOUNCEMENTS = getAnnouncements();

const KEY = 'rougether.announcements.v1';

beforeEach(() => AsyncStorage.clear());

describe('useAnnouncements (#1320)', () => {
  it('counts unread against the account read set', async () => {
    await AsyncStorage.setItem(`${KEY}.7`, JSON.stringify({ read: [ANNOUNCEMENTS[0].id] }));
    const { result } = await renderHook(() => useAnnouncements(7));
    await waitFor(() => expect(result.current.unreadCount).toBe(ANNOUNCEMENTS.length - 1));
    expect(result.current.items[0].read).toBe(true);
    expect(result.current.items[1].read).toBe(false);
  });

  it('marks one and all read and persists per account', async () => {
    const { result } = await renderHook(() => useAnnouncements(7));
    await waitFor(() => expect(result.current.unreadCount).toBe(ANNOUNCEMENTS.length));

    await act(() => result.current.markRead(ANNOUNCEMENTS[1].id));
    expect(result.current.items[1].read).toBe(true);
    expect(result.current.unreadCount).toBe(ANNOUNCEMENTS.length - 1);
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(`${KEY}.7`)) ?? '')).toEqual({
        read: [ANNOUNCEMENTS[1].id],
      }),
    );

    await act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
    expect(await AsyncStorage.getItem(`${KEY}.8`)).toBeNull();
  });

  it('reloads when the account changes', async () => {
    await AsyncStorage.setItem(
      `${KEY}.7`,
      JSON.stringify({ read: ANNOUNCEMENTS.map((a) => a.id) }),
    );
    const { result, rerender } = await renderHook(
      ({ userId }: { userId: number | undefined }) => useAnnouncements(userId),
      { initialProps: { userId: 7 } },
    );
    await waitFor(() => expect(result.current.items.every((a) => a.read)).toBe(true));
    expect(result.current.unreadCount).toBe(0);

    rerender({ userId: 8 });
    await waitFor(() => expect(result.current.unreadCount).toBe(ANNOUNCEMENTS.length));
  });
});
