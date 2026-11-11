import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  fetchFeedAuthorHouses,
  joinFeedAuthorHouse,
  type FeedAuthorHouse,
} from '@/api/feed-houses';
import { ApiError } from '@/api/http';
import { useFeedAuthorHouses } from '@/hooks/use-feed-author-houses';
import { queryKeys } from '@/lib/query-keys';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/auth', () => ({ getSessionUserId: () => 7 }));
jest.mock('@/api/feed-houses', () => ({
  fetchFeedAuthorHouses: jest.fn(),
  joinFeedAuthorHouse: jest.fn(),
}));

const home: FeedAuthorHouse = {
  houseId: 20,
  name: '친구의 집',
  coverImageKey: null,
  level: 0,
  displayMode: 'DIORAMA',
  isPublic: false,
  requiresApproval: true,
  currentMemberCount: 1,
  maxMembers: 4,
  isMember: false,
  isFull: false,
  myMembershipStatus: null,
  myJoinRequestStatus: null,
  canJoin: true,
};

beforeEach(() => {
  jest.mocked(fetchFeedAuthorHouses).mockReset().mockResolvedValue([home]);
  jest.mocked(joinFeedAuthorHouse).mockReset();
});

const clients: ReturnType<typeof createTestQueryClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

async function setup(enabled = true) {
  const client = createTestQueryClient();
  clients.push(client);
  const onError = jest.fn();
  const hook = await renderHook(() => useFeedAuthorHouses(10, enabled, onError), {
    wrapper: queryWrapper(client),
  });
  return { ...hook, client, onError };
}

it('집 선택을 열기 전에는 서버에 요청하지 않는다', async () => {
  const { result } = await setup(false);
  expect(result.current.houses).toEqual([]);
  expect(fetchFeedAuthorHouses).not.toHaveBeenCalled();
});

it('비공개 집 신청 성공은 PENDING이며 입주 성공으로 처리하지 않는다', async () => {
  jest.mocked(joinFeedAuthorHouse).mockResolvedValue({
    houseId: 20,
    membershipId: null,
    status: null,
    pendingApproval: true,
    joinRequestId: 30,
  });
  const { result, client } = await setup();
  await waitFor(() => expect(result.current.houses).toHaveLength(1));
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.join(20);
  });
  expect(outcome).toBe('PENDING');
  expect(joinFeedAuthorHouse).toHaveBeenCalledWith(10, 20);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.myJoinRequests(7) });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.myHouses(7) });
});

it('바로 입주 설정의 실제 응답이 ACTIVE이면 JOINED를 반환한다', async () => {
  jest.mocked(joinFeedAuthorHouse).mockResolvedValue({
    houseId: 20,
    membershipId: 31,
    status: 'ACTIVE',
    pendingApproval: false,
    joinRequestId: null,
  });
  const { result } = await setup();
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.join(20);
  });
  expect(outcome).toBe('JOINED');
});

it('입주 응답을 잃고 다시 시도해 이미 구성원이면 집으로 이동할 수 있다', async () => {
  jest
    .mocked(joinFeedAuthorHouse)
    .mockRejectedValue(new ApiError(409, 'POST', '/join', '{"code":"HOUSE_ALREADY_MEMBER"}'));
  const { result, onError } = await setup();
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.join(20);
  });
  expect(outcome).toBe('JOINED');
  expect(onError).not.toHaveBeenCalled();
});

it('만석으로 거절되면 성공으로 처리하지 않고 목록을 다시 받는다', async () => {
  jest
    .mocked(joinFeedAuthorHouse)
    .mockRejectedValue(new ApiError(409, 'POST', '/join', '{"code":"HOUSE_FULL"}'));
  const { result, onError, client } = await setup();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.join(20);
  });
  expect(outcome).toBeNull();
  expect(onError).toHaveBeenCalledWith('집 정원이 가득 찼어요. 다른 집을 골라 주세요.');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.feed.authorHousesAll(7) });
});

it('연속 탭해도 참여 요청은 하나만 전송한다', async () => {
  let finish!: (value: Awaited<ReturnType<typeof joinFeedAuthorHouse>>) => void;
  jest.mocked(joinFeedAuthorHouse).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = await setup();
  let first!: Promise<unknown>;
  await act(async () => {
    first = result.current.join(20);
  });
  await act(async () => {
    expect(await result.current.join(20)).toBeNull();
  });
  expect(joinFeedAuthorHouse).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({
      houseId: 20,
      membershipId: null,
      status: null,
      pendingApproval: true,
      joinRequestId: 30,
    });
    await first;
  });
});
