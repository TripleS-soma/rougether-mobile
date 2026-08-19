import { unlinkCategoryHouse } from '@/api/categories';
import { unlinkRoutineMission, updateRoutine } from '@/api/routines';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

const ok = { ok: true, status: 200, text: async () => '{}' };

/**
 * 연동 해제는 **전용 엔드포인트로만** 된다 (#907). 수정(PUT)의 `houseMissionId`
 * / `houseId`에 null을 보내면 서버는 "기존 유지"로 읽는다 — 타입이
 * `number | null`이라 컴파일은 통과하므로, 잘못 쓰면 조용히 아무 일도 안 난다.
 */
describe('연동 해제 API (#907)', () => {
  it('루틴 미션 연동을 전용 DELETE로 푼다', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await unlinkRoutineMission(12);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/routines/12/house-mission-link');
    expect(init.method).toBe('DELETE');
  });

  it('카테고리 집 연동을 전용 DELETE로 푼다', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await unlinkCategoryHouse(7);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/categories/7/house-link');
    expect(init.method).toBe('DELETE');
  });

  /**
   * 이 테스트는 "PUT null이 해제된다"는 오해를 막는 문서다 — 서버 계약상
   * null은 무시되므로, 해제 의도로 이 경로를 쓰면 안 된다.
   */
  it('수정(PUT)은 해제 경로가 아니다 — 다른 URL·다른 메서드', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await updateRoutine(12, { houseMissionId: null });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('house-mission-link');
    expect(init.method).toBe('PUT');
  });
});
