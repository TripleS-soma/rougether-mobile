import { act, renderHook } from '@testing-library/react-native';

import { splitForImport, useCalendarImport } from '@/hooks/use-calendar-import';

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
      {
        seriesId: 'e1',
        occurrenceId: 'e1:2026-08-20',
        title: '치과 예약',
        date: '2026-08-20',
        allDay: false,
      },
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
      {
        seriesId: 'e1',
        occurrenceId: 'e1:2026-08-20',
        title: '치과 예약',
        date: '2026-08-20',
        allDay: false,
      },
      {
        seriesId: 'e2',
        occurrenceId: 'e2:2026-08-21',
        title: '영양제 먹기',
        date: '2026-08-21',
        allDay: false,
      },
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
      {
        seriesId: 'e1',
        occurrenceId: 'e1:2026-08-20',
        title: '치과 예약',
        date: '2026-08-20',
        allDay: false,
      },
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
   * 회차 투두 경로 회귀 (#844 리뷰). 한 시리즈가 창 안에 여러 회차로 오면
   * `seriesId`는 모두 같다. 그걸 externalId로 쓰면 **첫 회차만 들어가고
   * 나머지는 409로 영구히 사라진다**(서버는 지운 조합도 재등록해주지 않는다).
   * 회차 키(`시리즈:날짜`)로 보내야 한다 — spec#81에 적은 규칙이다.
   *
   * #952 이후 이 경로에 남는 건 **서버가 못 담는 반복**(3주마다·격일 등)과
   * 일회성이다 — 아래 픽스처에 `repeat`이 없는 이유다. 담기는 반복은 루틴으로
   * 빠지므로 이 회귀가 여전히 지켜야 할 건 그 폴백이다.
   */
  it('같은 시리즈의 회차들을 서로 다른 externalId로 보낸다 (#844)', async () => {
    const sent: string[] = [];
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.externalId) sent.push(body.externalId);
      return res({ id: sent.length }, 201);
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    await act(async () => {
      await result.current.importSelected([
        { seriesId: 'weekly-1', occurrenceId: 'weekly-1:2026-08-20', title: '주간 회의', date: '2026-08-20', allDay: false, similar: [] }, // prettier-ignore
        { seriesId: 'weekly-1', occurrenceId: 'weekly-1:2026-08-27', title: '주간 회의', date: '2026-08-27', allDay: false, similar: [] }, // prettier-ignore
      ]);
    });
    expect(sent).toEqual(['weekly-1:2026-08-20', 'weekly-1:2026-08-27']);
    expect(new Set(sent).size).toBe(2);
  });

  it('반복 일정은 루틴 요청 하나로 나간다 (#952)', async () => {
    const bodies: Record<string, unknown>[] = [];
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      urls.push(url);
      bodies.push(JSON.parse(String(init?.body ?? '{}')));
      return res({ id: bodies.length }, 201);
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    let out;
    await act(async () => {
      out = await result.current.importSelected([
        { seriesId: 'w1', occurrenceId: 'w1:2026-08-24', title: '주간 회의', date: '2026-08-24', allDay: false, similar: [], repeat: 'weekly' }, // prettier-ignore
        { seriesId: 'w1', occurrenceId: 'w1:2026-08-31', title: '주간 회의', date: '2026-08-31', allDay: false, similar: [], repeat: 'weekly' }, // prettier-ignore
      ]);
    });

    // 회차 2개인데 요청은 하나 — 투두라면 2개였다.
    expect(urls.filter((u) => u.includes('/routines'))).toHaveLength(1);
    expect(urls.some((u) => u.includes('/todos'))).toBe(false);
    expect(bodies[0]).toMatchObject({
      title: '주간 회의',
      repeatType: 'WEEKLY',
      // 루틴은 시리즈당 한 행 — 회차 키가 아니라 시리즈 id.
      externalId: 'w1',
      startsOn: '2026-08-24',
      authType: 'CHECK',
    });
    expect(bodies[0].repeatDays).toEqual({ daysOfWeek: ['MON'] });
    expect(out).toMatchObject({ imported: 1, importedRoutines: 1 });
  });

  it('루틴 중복(409)도 실패가 아니라 건너뜀이다 (#952)', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ code: 'ROUTINE_EXTERNAL_DUPLICATE' }),
    })) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useCalendarImport());
    let out;
    await act(async () => {
      out = await result.current.importSelected([
        { seriesId: 'w1', occurrenceId: 'w1:2026-08-24', title: '주간 회의', date: '2026-08-24', allDay: false, similar: [], repeat: 'weekly' }, // prettier-ignore
      ]);
    });
    expect(out).toMatchObject({ imported: 0, skipped: 1, failed: 0 });
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
        {
          seriesId: 'a',
          occurrenceId: 'a:2026-08-20',
          title: 'A',
          date: '2026-08-20',
          allDay: false,
          similar: [],
        },
        {
          seriesId: 'b',
          occurrenceId: 'b:2026-08-20',
          title: 'B',
          date: '2026-08-20',
          allDay: false,
          similar: [],
        },
        {
          seriesId: 'c',
          occurrenceId: 'c:2026-08-20',
          title: 'C',
          date: '2026-08-20',
          allDay: false,
          similar: [],
        },
      ]);
    });
    expect(out).toEqual({ imported: 1, skipped: 1, failed: 1, importedRoutines: 0 });
  });

  /**
   * 반복은 루틴 1개, 나머지는 회차 투두 (#952). 매주 회의를 30일 창으로
   * 가져오면 지금까지는 투두가 4~5개 생겼다.
   */
  describe('반복 일정을 루틴으로 (#952)', () => {
    const ev = (o: Partial<Parameters<typeof splitForImport>[0][number]>) =>
      ({
        seriesId: 's1',
        occurrenceId: 's1:2026-08-24',
        title: '주간 회의',
        date: '2026-08-24',
        allDay: false,
        similar: [],
        ...o,
      }) as Parameters<typeof splitForImport>[0][number];

    it('같은 시리즈의 회차가 여러 개여도 루틴 하나로 묶는다', () => {
      const { routines, todos } = splitForImport([
        ev({ occurrenceId: 's1:2026-08-24', date: '2026-08-24', repeat: 'weekly' }),
        ev({ occurrenceId: 's1:2026-08-31', date: '2026-08-31', repeat: 'weekly' }),
        ev({ occurrenceId: 's1:2026-09-07', date: '2026-09-07', repeat: 'weekly' }),
      ]);
      expect(routines).toHaveLength(1);
      expect(todos).toHaveLength(0);
      // externalId로 쓸 시리즈 id · 창 안 첫 회차가 startsOn.
      expect(routines[0]).toMatchObject({ seriesId: 's1', startsOn: '2026-08-24' });
      // 2026-08-24는 월요일 → 1.
      expect(routines[0].days).toEqual([1]);
    });

    it('담을 수 없는 반복과 일회성은 회차 투두로 남는다', () => {
      const { routines, todos } = splitForImport([
        // repeat 없음 = 일회성이거나 서버가 못 담는 반복(3주마다·격일 등).
        ev({ seriesId: 'once', occurrenceId: 'once:2026-08-25', date: '2026-08-25' }),
        ev({ seriesId: 'odd', occurrenceId: 'odd:2026-08-26', date: '2026-08-26' }),
      ]);
      expect(routines).toHaveLength(0);
      expect(todos.map((t) => t.occurrenceId)).toEqual(['once:2026-08-25', 'odd:2026-08-26']);
    });

    it('월간·연간은 회차 날짜에서 일·월을 뽑는다', () => {
      const monthly = splitForImport([
        ev({ seriesId: 'm', occurrenceId: 'm:2026-09-15', date: '2026-09-15', repeat: 'monthly' }),
      ]).routines[0];
      expect(monthly).toMatchObject({ dayOfMonth: 15, month: undefined, days: [] });

      const yearly = splitForImport([
        ev({ seriesId: 'y', occurrenceId: 'y:2026-12-03', date: '2026-12-03', repeat: 'yearly' }),
      ]).routines[0];
      expect(yearly).toMatchObject({ dayOfMonth: 3, month: 12 });
    });

    it('여러 요일에 걸친 시리즈는 요일을 모아 보낸다', () => {
      // 화·목 반복 — 규칙이 아니라 실제 회차 날짜에서 뽑으므로 안드로이드에서도 같다.
      const { routines } = splitForImport([
        ev({ seriesId: 'w', occurrenceId: 'w:2026-08-25', date: '2026-08-25', repeat: 'weekly' }),
        ev({ seriesId: 'w', occurrenceId: 'w:2026-08-27', date: '2026-08-27', repeat: 'weekly' }),
      ]);
      expect(routines[0].days).toEqual([2, 4]);
    });
  });
});
