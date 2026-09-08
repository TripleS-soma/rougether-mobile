/**
 * 집 탐색 조각(use-house-search.ts) — 페이지네이션·필터·입주 신청·미리보기.
 * 소비자가 보는 표면은 useHouses의 합성 객체라 그 훅으로 렌더해 단언한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHouses } from '@/hooks/use-houses';
import { jsonRes as res } from '@/test-utils/fetch';

// 토스트 캡처 — 더 불러오기 실패(#975)·만석(#948) 문구 단언용.
const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockToast }),
}));

const realFetch = global.fetch;
beforeEach(() => mockToast.mockClear());
afterEach(() => {
  global.fetch = realFetch;
});

describe('useHouses — 집 탐색 페이지네이션 (#975)', () => {
  /** page별 응답을 주는 fetch. 30개짜리 1페이지 + 5개짜리 2페이지 = 총 35. */
  const pagedFetch = (opts: { total?: number } = {}) => {
    const urls: string[] = [];
    const page0 = Array.from({ length: 30 }, (_, i) => ({ houseId: i + 1, name: `집${i + 1}` }));
    const page1 = Array.from({ length: 5 }, (_, i) => ({ houseId: i + 31, name: `집${i + 31}` }));
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) {
        urls.push(url);
        const isNext = url.includes('page=1');
        return res({
          items: isNext ? page1 : page0,
          page: isNext ? 1 : 0,
          size: 30,
          ...(opts.total != null ? { totalElements: opts.total } : {}),
        });
      }
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;
    return urls;
  };

  it('첫 페이지가 꽉 차고 남은 게 있으면 다음 페이지를 이어 붙인다', async () => {
    const urls = pagedFetch({ total: 35 });
    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));

    expect(result.current.searchHouses).toHaveLength(30);
    expect(result.current.searchHasNext).toBe(true);

    await act(async () => {
      await result.current.loadMoreSearch();
    });

    expect(result.current.searchHouses).toHaveLength(35);
    // 이어 붙인 것이지 갈아치운 게 아니다.
    expect(result.current.searchHouses[0].name).toBe('집1');
    expect(result.current.searchHouses[34].name).toBe('집35');
    // 다 받았으면 더 요청하지 않는다.
    expect(result.current.searchHasNext).toBe(false);
    expect(urls.some((u) => u.includes('page=1'))).toBe(true);
  });

  it('아이콘·배경이 페이지 경계에서 다시 시작하지 않는다', async () => {
    // toSearchHouse의 index가 아이콘을 돌린다 — 0부터 다시 세면 경계에서 반복된다.
    pagedFetch({ total: 35 });
    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await act(async () => {
      await result.current.loadMoreSearch();
    });
    const first = result.current.searchHouses[0];
    const boundary = result.current.searchHouses[30];
    expect(boundary.icon).not.toBe(first.icon);
  });

  it('같은 집이 두 번 와도 중복으로 쌓지 않는다', async () => {
    // 생성·삭제로 페이지가 밀리면 겹쳐 올 수 있다 — 중복 키가 되면 안 된다.
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) {
        const dup = [{ houseId: 1, name: '겹친집' }];
        const page0 = Array.from({ length: 30 }, (_, i) => ({
          houseId: i + 1,
          name: `집${i + 1}`,
        }));
        return res({ items: url.includes('page=1') ? dup : page0, size: 30, totalElements: 31 });
      }
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await act(async () => {
      await result.current.loadMoreSearch();
    });
    const ids = result.current.searchHouses.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('다음 페이지가 실패하면 조용히 멈추지 않고 알린다', async () => {
    // 스피너만 사라지면 "왜 안 나오지?"가 된다. hasNext는 유지돼 재시도된다.
    let call = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) {
        call += 1;
        if (url.includes('page=1')) throw new Error('network');
        return res({
          items: Array.from({ length: 30 }, (_, i) => ({ houseId: i + 1, name: `집${i + 1}` })),
          size: 30,
          totalElements: 35,
        });
      }
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await act(async () => {
      await result.current.loadMoreSearch();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('더 불러오지 못했어요'),
      'error',
    );
    // 목록은 그대로, 다음 스크롤에 다시 시도할 수 있다.
    expect(result.current.searchHouses).toHaveLength(30);
    expect(result.current.searchHasNext).toBe(true);
    expect(result.current.searchLoadingMore).toBe(false);
    expect(call).toBeGreaterThan(1);
  });

  it('한 페이지 안에 같은 집이 두 번 와도 중복으로 쌓지 않는다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) {
        const page0 = Array.from({ length: 30 }, (_, i) => ({
          houseId: i + 1,
          name: `집${i + 1}`,
        }));
        // 한 응답 안에서 같은 id가 두 번.
        const page1 = [
          { houseId: 99, name: '겹침' },
          { houseId: 99, name: '겹침' },
        ];
        return res({ items: url.includes('page=1') ? page1 : page0, size: 30, totalElements: 32 });
      }
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await act(async () => {
      await result.current.loadMoreSearch();
    });
    const ids = result.current.searchHouses.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.current.searchHouses).toHaveLength(31);
  });

  it('첫 페이지가 안 찼으면 더 받을 게 없다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) return res({ items: [{ houseId: 1, name: '집1' }], size: 30, totalElements: 1 }); // prettier-ignore
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    expect(result.current.searchHasNext).toBe(false);
  });
});

describe('useHouses — 집 탐색 filter (#578)', () => {
  it('requests the browse list with excludeJoined and keeps the server result as-is', async () => {
    const searchUrls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/houses')) return res({ items: [{ houseId: 1, name: '내집' }] });
      if (url.includes('/houses/1/members')) return res({ items: [] });
      if (url.includes('/houses/1/missions')) return res({ items: [] });
      if (url.includes('/houses/1')) return res({ houseId: 1, name: '내집', myRole: 'OWNER' });
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      if (url.includes('/houses?')) {
        searchUrls.push(url);
        // 서버가 excludeJoined로 내 집을 이미 걸렀다 — 클라 로컬 필터 없음.
        return res({
          items: [
            { houseId: 2, name: '남의집', currentMemberCount: 2, maxMembers: 4, myJoinRequestStatus: 'PENDING' }, // prettier-ignore
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 탐색 요청에 excludeJoined=true가 실린다.
    expect(searchUrls.every((u) => u.includes('excludeJoined=true'))).toBe(true);
    expect(searchUrls.length).toBeGreaterThan(0);
    // 목록은 서버 결과 그대로 + 신청 상태 등 파생 유지.
    expect(result.current.searchHouses.map((h) => h.name)).toEqual(['남의집']);
    expect(result.current.searchHouses[0].joinRequestStatus).toBe('PENDING');
    expect(result.current.houses.map((h) => h.name)).toEqual(['내집']);
  });
});

describe('useHouses — 입주 신청 처리', () => {
  it('reports an already-pending browse request without joining the house', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/houses/2/join-requests') && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({
              code: 'HOUSE_JOIN_REQUEST_ALREADY_PENDING',
              message: '이미 신청 중',
            }),
        };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.joinHouse(2);
    });

    expect(succeeded).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/2/join-requests'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /**
   * 앱이 정원 수로 미리 막지 않게 되면서(#948) "진짜 만석"을 아는 건 서버뿐이다 —
   * 그 답이 사용자에게 그대로 전해져야 한다.
   */
  it('서버가 HOUSE_FULL을 주면 만석이라고 정확히 말한다 (#948)', async () => {
    mockToast.mockClear();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/join-requests') && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ code: 'HOUSE_FULL', message: '정원 초과' }),
        };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.joinHouse(2);
    });

    expect(mockToast).toHaveBeenCalledWith('정원이 가득 찼어요', 'error');
  });

  it('그 밖의 실패는 만석이라고 단정하지 않는다 (#948)', async () => {
    // 종전 문구가 "만석일 수 있어요"라 네트워크 오류까지 만석으로 읽혔다.
    mockToast.mockClear();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/join-requests') && init?.method === 'POST') {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.joinHouse(2);
    });

    expect(mockToast).toHaveBeenCalledWith(
      '입주 신청에 실패했어요. 잠시 후 다시 시도해주세요.',
      'error',
    );
  });
});

// 로드 실패는 빈 상태('집 없음' 가입 유도)로 위장하지 않는다 (#549).
describe('useHouses — 로드 실패 → error + 재시도 (#549)', () => {
  const fail = { ok: false, status: 500, text: async () => '{}' };

  it('탐색 목록 로드 실패 시 searchError, 재시도 성공 시 해제된다', async () => {
    let broken = true;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses?')) {
        if (broken) return fail;
        return res({ items: [{ houseId: 2, name: '남의집', currentMemberCount: 1, maxMembers: 4 }] }); // prettier-ignore
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    expect(result.current.searchError).toBe(true);

    broken = false;
    await act(async () => {
      await result.current.retrySearch();
    });
    expect(result.current.searchError).toBe(false);
    expect(result.current.searchHouses.map((h) => h.name)).toEqual(['남의집']);
  });
});

describe('useHouses — 탐색 미리보기', () => {
  it('loads public house detail and maps its missions', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses/7/preview')) {
        return res({
          houseId: 7,
          name: '미리보기 집',
          currentMemberCount: 2,
          maxMembers: 4,
          level: 1,
          missions: [
            {
              missionId: 91,
              title: '다같이 10번',
              missionType: 'WEEKLY_MEMBER_COUNT',
              currentValue: 3,
              targetValue: 10,
              status: 'ACTIVE',
            },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let preview = null;
    await act(async () => {
      preview = await result.current.previewHouse(7);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/preview'),
      expect.any(Object),
    );
    expect(preview).toMatchObject({
      id: 7,
      name: '미리보기 집',
      missions: [{ id: 91, current: 3, target: 10 }],
    });
  });
});
