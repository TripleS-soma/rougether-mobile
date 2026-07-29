import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { House } from '@/components/screens/house-screen';
import { flatRooms } from '@/utils/room-layout';
import { useRoomLayouts } from '@/hooks/use-room-layouts';

const HOUSE: House = {
  houseId: 7,
  name: '집',
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

const names = (h: House) => flatRooms(h).map((r) => (r.vacant ? '빈방' : r.name));

describe('useRoomLayouts', () => {
  beforeEach(() => AsyncStorage.clear());

  it('applies a saved layout once loaded', async () => {
    await AsyncStorage.setItem('rougether.roomLayout.v1.anon.7', JSON.stringify([1, 2, 3, null]));
    const { result } = await renderHook(() => useRoomLayouts([HOUSE]));
    await waitFor(() =>
      expect(names(result.current.houses[0])).toEqual(['나', '이웃1', '이웃2', '빈방']),
    );
  });

  it('swaps seats and persists the new layout', async () => {
    const { result } = await renderHook(() => useRoomLayouts([HOUSE]));
    await waitFor(() => expect(result.current.houses[0]).toBeTruthy());

    await act(() => result.current.swapSeats(7, 0, 1));
    await waitFor(() =>
      expect(names(result.current.houses[0])).toEqual(['빈방', '이웃2', '나', '이웃1']),
    );
    expect(JSON.parse((await AsyncStorage.getItem('rougether.roomLayout.v1.anon.7'))!)).toEqual([
      null,
      3,
      1,
      2,
    ]);
  });

  it('leaves demo houses without server ids untouched', async () => {
    const demo: House = { name: '데모', floors: HOUSE.floors };
    const { result } = await renderHook(() => useRoomLayouts([demo]));
    expect(result.current.houses[0]).toBe(demo);
  });
});
