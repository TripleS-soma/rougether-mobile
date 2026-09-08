import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as auth from '@/api/auth';
import { useHouses } from '@/hooks/use-houses';
import { jsonRes as res } from '@/test-utils/fetch';

// 토스트 캡처 — 탈퇴 신청자 승인 가드(#240) 문구 단언용.
const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockToast }),
}));

const realFetch = global.fetch;
beforeEach(() => mockToast.mockClear());
afterEach(() => {
  global.fetch = realFetch;
});

describe('useHouses — 응원 보내기 (#329)', () => {
  it('sends a cheer and hits the daily-duplicate branch without throwing', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/members/16/cheer') && init?.method === 'POST') {
        calls.push(String(init?.body));
        return res({ cheerId: 1, houseId: 6, targetMembershipId: 16, type: 'support' });
      }
      if (url.includes('/members/17/cheer') && init?.method === 'POST')
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({ code: 'HOUSE_CHEER_DUPLICATED', message: '오늘은 이미' }),
        };
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.cheerMember(6, 16, 'support');
      // 같은 타입 하루 1회 초과(409) — 던지지 않고 토스트로 처리된다.
      await result.current.cheerMember(6, 17, 'best');
    });
    expect(calls).toEqual([JSON.stringify({ type: 'support' })]);
  });
});

describe('useHouses — 입주 신청 처리', () => {
  it('calls the owner accept and reject endpoints', async () => {
    global.fetch = jest.fn(async () => res({ items: [] })) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.acceptJoinRequest(7, 21);
      await result.current.rejectJoinRequest(7, 22);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/join-requests/21/accept'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/join-requests/22/reject'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// 집 생성 goalIds 상한 (서버 제약 max 3) — 온보딩 목표를 4개 이상 고른
// 계정도 생성이 막히면 안 된다.
describe('useHouses — 집 생성 goalIds 클램프', () => {
  it('온보딩 목표가 4개여도 앞 3개만 실어 보낸다', async () => {
    let sentBody: { goalIds?: number[] } | null = null;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/onboarding'))
        return res({ goals: [{ goalId: 1 }, { goalId: 8 }, { goalId: 9 }, { goalId: 10 }] });
      if (url.endsWith('/houses') && init?.method === 'POST') {
        sentBody = JSON.parse(String(init.body));
        return res({ houseId: 99 });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = false;
    await act(async () => {
      ok = await result.current.create({ name: '새 집', maxMembers: 4 });
    });
    expect(ok).toBe(true);
    expect(sentBody!.goalIds).toEqual([1, 8, 9]);
  });
});

// 탈퇴한 신청자 승인 (서버 #240) — 서버가 신청을 거절 처리하고 409를 준다.
describe('useHouses — 탈퇴 신청자 승인 가드 (#240)', () => {
  it('APPLICANT_WITHDRAWN 409는 에러 대신 정리 안내 토스트를 띄운다', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/join-requests/9/accept') && init?.method === 'POST')
        return {
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ code: 'HOUSE_JOIN_REQUEST_APPLICANT_WITHDRAWN' }),
        };
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.acceptJoinRequest(6, 9);
    });
    expect(mockToast).toHaveBeenCalledWith('탈퇴한 회원의 신청이라 자동으로 정리했어요');
  });
});

// 집 안 이벤트는 전체 리로드 대신 해당 집만 재동기화한다 (#534).
describe('useHouses — 단일 집 갱신 (#534)', () => {
  it('수락은 신청을 즉시(낙관) 지우고, 그 집 번들만 다시 받는다', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/me/houses')) return res({ items: [{ houseId: 6 }] });
      if (url.includes('/houses/6/join-requests') && init?.method === 'POST') return res({});
      if (url.includes('/houses/6/join-requests/9/accept')) return res({});
      if (url.includes('/houses/6/join-requests'))
        return res({ items: [{ requestId: 9, nickname: '대기자', status: 'PENDING' }] });
      if (url.includes('/houses/6/members')) return res({ items: [] });
      if (url.includes('/houses/6/missions')) return res({ items: [] });
      if (url.includes('/houses/6')) return res({ houseId: 6, name: '집', myRole: 'OWNER' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.houses.length).toBe(1));
    expect(result.current.houses[0].joinRequests?.length).toBe(1);

    calls.length = 0;
    await act(async () => {
      await result.current.acceptJoinRequest(6, 9);
    });
    // 낙관 제거 후 백그라운드 재동기화가 그 집 번들만 요청 — 전체 목록
    // (/me/houses)·프로필(/me)은 다시 긁지 않는다.
    await waitFor(() =>
      expect(calls.some((c) => c.includes('/join-requests/9/accept'))).toBe(true),
    );
    expect(calls.some((c) => c.endsWith('/me/houses'))).toBe(false);
  });
});

// 로드 실패는 빈 상태('집 없음' 가입 유도)로 위장하지 않는다 (#549).
describe('useHouses — 로드 실패 → error + 재시도 (#549)', () => {
  const fail = { ok: false, status: 500, text: async () => '{}' };

  it('내 집 목록 로드 실패 시 error, 재시도 성공 시 해제된다', async () => {
    let broken = true;
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/me/houses')) {
        if (broken) return fail;
        return res({ items: [{ houseId: 1, name: '내집' }] });
      }
      if (url.includes('/houses/1/members')) return res({ items: [] });
      if (url.includes('/houses/1/missions')) return res({ items: [] });
      if (url.includes('/houses/1')) return res({ houseId: 1, name: '내집', myRole: 'OWNER' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.houses).toEqual([]);

    broken = false;
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.error).toBe(false);
    expect(result.current.houses.map((h) => h.name)).toEqual(['내집']);
  });
});

// 잘못된 코드(4xx)와 네트워크·서버 오류를 구분해 화면 문구가 갈린다 (#549).
describe('useHouses — 초대코드 오류 구분 (#549)', () => {
  it('previewByCode: 4xx는 null(잘못된 코드), 5xx는 network', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses/by-code/BAD')) {
        return { ok: false, status: 404, text: async () => '{}' };
      }
      if (url.includes('/houses/by-code/NET')) {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.previewByCode('BAD')).toBeNull();
      expect(await result.current.previewByCode('NET')).toBe('network');
    });
  });

  it('joinByCode: 4xx는 false(잘못된 코드), 5xx는 network', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/houses/join-by-code') && init?.method === 'POST') {
        const code = JSON.parse(String(init?.body ?? '{}')).inviteCode;
        return { ok: false, status: code === 'BAD' ? 404 : 500, text: async () => '{}' };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.joinByCode('BAD')).toBe(false);
      expect(await result.current.joinByCode('NET')).toBe('network');
    });
  });
});

describe('useHouses — 집 순서 변경 (#820)', () => {
  /**
   * 실서버 계약 (2026-08-16 확인): 성공은 **204 No Content**, 부분 목록·중복·
   * 남의 집은 전부 **400 HOUSE_ORDER_INVALID**. 스펙 초안의 409 STALE은
   * 구현되지 않았다.
   */
  const setUp = (order: { status: number; body?: unknown }) => {
    const calls: { url: string; body?: string }[] = [];
    let myHouses = [
      { houseId: 1, name: '가' },
      { houseId: 2, name: '나' },
    ];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (url.includes('/me/houses/order')) {
        if (order.status === 204) return { ok: true, status: 204, text: async () => '' };
        return {
          ok: false,
          status: order.status,
          text: async () => JSON.stringify(order.body),
        };
      }
      if (url.includes('/me/houses')) return res({ items: myHouses });
      if (url.includes('/me/join-requests')) return res({ items: [] });
      // 집 상세 — houseId가 여기서 채워져야 순서 전량 전송 가드를 통과한다.
      const detail = url.match(/\/houses\/(\d+)(?:\?|$)/);
      if (detail) return res({ houseId: Number(detail[1]), name: `집${detail[1]}` });
      if (url.includes('/houses/')) return res({ items: [] });
      if (url.endsWith('/me')) return res({ nickname: '나' });
      return res({ items: [] });
    }) as unknown as typeof fetch;
    return calls;
  };

  it('204를 성공으로 처리한다 — 본문이 없어도 터지지 않는다', async () => {
    const calls = setUp({ status: 204 });
    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.houses.length).toBe(2));

    await act(async () => {
      await result.current.reorderHouses([2, 1]);
    });

    const put = calls.find((c) => c.url.includes('/me/houses/order'));
    expect(put?.body).toBe(JSON.stringify({ houseIds: [2, 1] }));
    // 낙관적 반영 — 응답 본문이 없으므로 화면 순서는 우리가 쥔다.
    expect(result.current.houses.map((h) => h.houseId)).toEqual([2, 1]);
  });

  it('400 HOUSE_ORDER_INVALID면 되돌리지 않고 다시 불러온다', async () => {
    setUp({ status: 400, body: { code: 'HOUSE_ORDER_INVALID' } });
    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.houses.length).toBe(2));

    await act(async () => {
      await result.current.reorderHouses([2, 1]);
    });

    expect(mockToast).toHaveBeenCalledWith('집 목록이 바뀌었어요. 다시 불러올게요.');
  });

  it('그 밖의 실패는 이전 순서로 되돌린다', async () => {
    setUp({ status: 500, body: {} });
    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.houses.length).toBe(2));
    const before = result.current.houses.map((h) => h.houseId);

    await act(async () => {
      await result.current.reorderHouses([2, 1]);
    });

    expect(result.current.houses.map((h) => h.houseId)).toEqual(before);
    expect(mockToast).toHaveBeenCalledWith(
      '집 순서를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
      'error',
    );
  });
});

describe('useHouses — 프로필 닉네임 반영 (#924)', () => {
  it('내 좌석 이름만 재조회 없이 새 닉네임으로 덮는다', async () => {
    // isMine 판정이 세션 userId에 걸려 있다 — 테스트엔 세션이 없으므로 세운다.
    const whoAmI = jest.spyOn(auth, 'getSessionUserId').mockReturnValue(5);
    let houseCalls = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/houses')) return res({ items: [{ houseId: 1, name: '내집' }] });
      if (url.includes('/houses/1/members'))
        return res({
          items: [
            { membershipId: 1, userId: 5, nickname: '옛이름', role: 'OWNER', status: 'ACTIVE' },
            { membershipId: 2, userId: 9, nickname: '이웃', role: 'MEMBER', status: 'ACTIVE' },
          ],
        });
      if (url.includes('/houses/1/missions')) return res({ items: [] });
      if (url.includes('/houses/1')) {
        houseCalls += 1;
        return res({ houseId: 1, name: '내집', myRole: 'OWNER', maxMembers: 2 });
      }
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '옛이름' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const names = () => result.current.houses[0].floors.flatMap((f) => f.rooms).map((r) => r.name);
    expect(names()).toContain('옛이름');
    const callsBefore = houseCalls;

    await act(async () => {
      result.current.applyMyNickname('새이름');
    });

    // 내 좌석만 바뀌고, 이웃은 그대로다.
    expect(names()).toContain('새이름');
    expect(names()).not.toContain('옛이름');
    expect(names()).toContain('이웃');
    // 이름 하나 때문에 집을 다시 부르지 않는다 — 파생으로 끝낸다.
    expect(houseCalls).toBe(callsBefore);
    whoAmI.mockRestore();
  });
});
