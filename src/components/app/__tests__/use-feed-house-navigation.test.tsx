import { act, renderHook } from '@testing-library/react-native';

import type { Screen } from '@/components/app/navigation';
import { useFeedHouseNavigation } from '@/components/app/use-feed-house-navigation';
import { queryKeys } from '@/lib/query-keys';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/auth', () => ({ getSessionUserId: () => 7 }));

it('새 집이 렌더되기 전에도 쿼리 캐시에서 인덱스를 고른 뒤 집 화면으로 이동한다', async () => {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.myHouses(7), [{ houseId: 1 }, { houseId: 20 }]);
  const actions: unknown[] = [];
  const refreshHouses = jest.fn();
  const { result } = await renderHook(
    () =>
      useFeedHouseNavigation({
        houses: [{ houseId: 1 }],
        screen: 'feedPost',
        refreshHouses,
        setHouseIndex: (i) => actions.push(i),
        setScreen: (s) => actions.push(s),
        onMissing: jest.fn(),
      }),
    { wrapper: queryWrapper(client) },
  );
  await act(async () => result.current(20));
  expect(actions).toEqual([1, 'house']);
  expect(refreshHouses).not.toHaveBeenCalled();
  client.clear();
});

it('집이 없으면 재조회하고 실제로 찾은 집으로만 이동한다', async () => {
  const client = createTestQueryClient();
  const setScreen = jest.fn(),
    setHouseIndex = jest.fn(),
    onMissing = jest.fn();
  const { result } = await renderHook(
    () =>
      useFeedHouseNavigation({
        houses: [],
        screen: 'feedPost',
        refreshHouses: async () => {
          client.setQueryData(queryKeys.myHouses(7), [{ houseId: 20 }]);
        },
        setHouseIndex,
        setScreen,
        onMissing,
      }),
    { wrapper: queryWrapper(client) },
  );
  await act(async () => result.current(20));
  expect(setHouseIndex).toHaveBeenCalledWith(0);
  expect(setScreen).toHaveBeenCalledWith('house');
  expect(onMissing).not.toHaveBeenCalled();
  client.clear();
});

it('재조회 중 화면을 떠나면 나중에 집이 생겨도 화면을 전환하지 않는다', async () => {
  const client = createTestQueryClient();
  let finish!: () => void;
  const setScreen = jest.fn();
  const { result, rerender } = await renderHook(
    ({ screen }: { screen: Screen }) =>
      useFeedHouseNavigation({
        houses: [],
        screen,
        refreshHouses: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        setHouseIndex: jest.fn(),
        setScreen,
        onMissing: jest.fn(),
      }),
    { initialProps: { screen: 'feedPost' as Screen }, wrapper: queryWrapper(client) },
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current(20);
  });
  await rerender({ screen: 'calendar' });
  await act(async () => {
    client.setQueryData(queryKeys.myHouses(7), [{ houseId: 20 }]);
    finish();
    await pending;
  });
  expect(setScreen).not.toHaveBeenCalled();
  client.clear();
});

it('재조회 후에도 집이 없으면 안내하고 늦은 자동 이동을 남기지 않는다', async () => {
  const client = createTestQueryClient();
  const setScreen = jest.fn(),
    onMissing = jest.fn();
  const { result } = await renderHook(
    () =>
      useFeedHouseNavigation({
        houses: [],
        screen: 'feedPost',
        refreshHouses: async () => {},
        setHouseIndex: jest.fn(),
        setScreen,
        onMissing,
      }),
    { wrapper: queryWrapper(client) },
  );
  await act(async () => result.current(20));
  expect(onMissing).toHaveBeenCalledTimes(1);
  await act(async () => {
    client.setQueryData(queryKeys.myHouses(7), [{ houseId: 20 }]);
  });
  expect(setScreen).not.toHaveBeenCalled();
  client.clear();
});
