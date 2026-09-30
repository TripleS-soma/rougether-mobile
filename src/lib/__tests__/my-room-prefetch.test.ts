import {
  MY_ROOM_PREFETCH_MAX_AGE_MS,
  prefetchMyRoom,
  resetMyRoomPrefetch,
  takeMyRoomPrefetch,
} from '@/lib/my-room-prefetch';
import { jsonRes as res } from '@/test-utils/fetch';

const realFetch = global.fetch;
let calls = 0;
beforeEach(() => {
  resetMyRoomPrefetch();
  calls = 0;
  global.fetch = jest.fn(async (url: string) => {
    calls += 1;
    if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return res({ userId: 7 });
    return res({ items: [] });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('나의 방 선행 요청 (성능 장부 N1)', () => {
  it('같은 계정이 신선할 때 한 번만 넘겨준다', async () => {
    prefetchMyRoom(7);
    const first = takeMyRoomPrefetch(7);
    expect(first).not.toBeNull();
    await first;
    expect(takeMyRoomPrefetch(7)).toBeNull();
  });

  it('다른 계정·오래된 결과는 넘기지 않는다', () => {
    let t = 1_000;
    prefetchMyRoom(7, () => t);
    expect(takeMyRoomPrefetch(8, () => t)).toBeNull();

    prefetchMyRoom(7, () => t);
    t += MY_ROOM_PREFETCH_MAX_AGE_MS;
    expect(takeMyRoomPrefetch(7, () => t)).toBeNull();
  });

  it('신선한 동안 같은 계정의 중복 선행 요청은 하나로 합친다', async () => {
    prefetchMyRoom(7);
    const once = calls;
    prefetchMyRoom(7);
    expect(calls).toBe(once);
    await takeMyRoomPrefetch(7);
  });

  it('실패한 선행 요청은 넘기지 않는다', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    prefetchMyRoom(7);
    await new Promise((r) => setTimeout(r, 0));
    expect(takeMyRoomPrefetch(7)).toBeNull();
  });
});
