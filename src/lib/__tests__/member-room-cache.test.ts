import {
  fetchMemberRoomShared,
  invalidateMemberRoom,
  MEMBER_ROOM_TTL_MS,
} from '@/lib/member-room-cache';
import { jsonRes as res } from '@/test-utils/fetch';

const realFetch = global.fetch;
let calls = 0;
beforeEach(() => {
  invalidateMemberRoom();
  calls = 0;
  global.fetch = jest.fn(async () => {
    calls += 1;
    return res({ slots: [], placements: [] });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('구성원 방 공유 캐시 (성능 장부 N5)', () => {
  it('신선한 동안 같은 방은 한 번만 받는다 — 미리보기 → 방문', async () => {
    await fetchMemberRoomShared(2, 7);
    await fetchMemberRoomShared(2, 7);
    expect(calls).toBe(1);
    await fetchMemberRoomShared(2, 8);
    expect(calls).toBe(2);
  });

  it('신선도가 지나면 다시 받는다', async () => {
    let t = 1_000;
    await fetchMemberRoomShared(2, 7, () => t);
    t += MEMBER_ROOM_TTL_MS;
    await fetchMemberRoomShared(2, 7, () => t);
    expect(calls).toBe(2);
  });

  it('거미줄 청소처럼 방이 바뀌면 그 방만 버린다', async () => {
    await fetchMemberRoomShared(2, 7);
    await fetchMemberRoomShared(2, 8);
    invalidateMemberRoom(2, 7);
    await fetchMemberRoomShared(2, 7);
    await fetchMemberRoomShared(2, 8);
    expect(calls).toBe(3);
  });

  it('실패한 요청은 남기지 않는다', async () => {
    global.fetch = jest.fn(async () => {
      calls += 1;
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(fetchMemberRoomShared(2, 7)).rejects.toThrow();
    await expect(fetchMemberRoomShared(2, 7)).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
