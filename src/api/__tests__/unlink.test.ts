import { updateRoutine } from '@/api/routines';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

const ok = { ok: true, status: 200, text: async () => '{}' };

/**
 * 연동 해제는 **전용 엔드포인트로만** 된다 (#907):
 *   DELETE /routines/{id}/house-mission-link
 *   DELETE /categories/{id}/house-link
 *
 * 수정(PUT)의 `houseMissionId` / `houseId`에 null을 보내면 서버는 "기존 유지"로
 * 읽는다. 타입이 `number | null`이라 컴파일은 통과하고 요청도 200으로 성공하므로,
 * 해제 의도로 이 경로를 쓰면 **아무 일도 안 일어나고 실패도 안 난다.**
 *
 * 이 테스트는 그 오해를 막는 기록이다 — 앱에 해제를 쓰는 화면이 생기면
 * 전용 엔드포인트 클라이언트를 그때 추가한다.
 */
describe('연동 해제 계약 (#907)', () => {
  it('수정(PUT)은 해제 경로가 아니다 — null을 보내도 그냥 루틴 수정이다', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await updateRoutine(12, { houseMissionId: null });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/routines/12');
    expect(url).not.toContain('house-mission-link');
    expect(init.method).toBe('PUT');
  });
});
