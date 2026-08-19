import { act, renderHook } from '@testing-library/react-native';

import { useCalendarImport } from '@/hooks/use-calendar-import';

jest.mock('@/lib/device-calendar', () => ({
  IMPORT_WINDOW_DAYS: 30,
  requestCalendarAccess: jest.fn(),
  listDeviceCalendars: jest.fn(),
  readUpcomingEvents: jest.fn(),
}));

const dc = jest.requireMock('@/lib/device-calendar');

const res = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useCalendarImport', () => {
  it('권한을 거부하면 denied로 남고 캘린더 목록은 비어 있다', async () => {
    dc.requestCalendarAccess.mockResolvedValue(false);
    const { result } = await renderHook(() => useCalendarImport());
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.denied).toBe(true);
    expect(result.current.calendars).toEqual([]);
    expect(dc.listDeviceCalendars).not.toHaveBeenCalled();
  });

  /** 힌트는 거들 뿐 — 실패해도 후보는 그대로 보여야 임포트를 막지 않는다. */
  it('유사 힌트 조회가 실패해도 후보를 그대로 돌려준다', async () => {
    dc.readUpcomingEvents.mockResolvedValue([
      { id: 'e1', title: '치과 예약', date: '2026-08-20', allDay: false },
    ]);
    global.fetch = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    await act(async () => {
      await result.current.preview(['cal-1']);
    });
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.candidates?.[0].similar).toEqual([]);
  });

  it('유사 힌트를 후보에 순서대로 붙인다', async () => {
    dc.readUpcomingEvents.mockResolvedValue([
      { id: 'e1', title: '치과 예약', date: '2026-08-20', allDay: false },
      { id: 'e2', title: '영양제 먹기', date: '2026-08-21', allDay: false },
    ]);
    global.fetch = jest.fn(async () =>
      res({
        embeddingApplied: true,
        items: [
          { date: '2026-08-20', title: '치과 예약', hasSimilar: false, similar: [] },
          {
            date: '2026-08-21',
            title: '영양제 먹기',
            hasSimilar: true,
            similar: [
              {
                kind: 'ROUTINE',
                id: 21,
                title: '영양제 챙겨먹기',
                score: 0.86,
                matchType: 'EMBEDDING',
              },
            ],
          },
        ],
      }),
    ) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    await act(async () => {
      await result.current.preview(['cal-1']);
    });
    expect(result.current.candidates?.[0].similar).toEqual([]);
    expect(result.current.candidates?.[1].similar[0].title).toBe('영양제 챙겨먹기');
  });

  /** 임베딩이 죽어도 임포트는 계속돼야 한다 — 화면이 그 사실만 밝힌다. */
  it('embeddingApplied=false를 그대로 노출한다', async () => {
    dc.readUpcomingEvents.mockResolvedValue([
      { id: 'e1', title: '치과 예약', date: '2026-08-20', allDay: false },
    ]);
    global.fetch = jest.fn(async () =>
      res({
        embeddingApplied: false,
        items: [{ date: '2026-08-20', title: '치과 예약', hasSimilar: false, similar: [] }],
      }),
    ) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useCalendarImport());
    await act(async () => {
      await result.current.preview(['cal-1']);
    });
    expect(result.current.embeddingApplied).toBe(false);
    expect(result.current.candidates).toHaveLength(1);
  });

  /**
   * 409 TODO_EXTERNAL_DUPLICATE는 실패가 아니라 "이미 가져옴"이다 — 동기화는
   * 반복 실행되므로 이걸 실패로 세면 매번 오류로 보인다.
   */
  it('409는 실패가 아니라 건너뜀으로 센다', async () => {
    // 요청 본문으로 구분할 수 없으니 호출 순서대로 201 → 409 → 500을 준다.
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      if (call === 2) return res({ code: 'TODO_EXTERNAL_DUPLICATE' }, 409);
      if (call === 3) return res({ code: 'BOOM' }, 500);
      return res({ id: 1 }, 201);
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    let out;
    await act(async () => {
      out = await result.current.importSelected([
        { id: 'a', title: 'A', date: '2026-08-20', allDay: false, similar: [] },
        { id: 'b', title: 'B', date: '2026-08-20', allDay: false, similar: [] },
        { id: 'c', title: 'C', date: '2026-08-20', allDay: false, similar: [] },
      ]);
    });
    expect(out).toEqual({ imported: 1, skipped: 1, failed: 1 });
  });
});
