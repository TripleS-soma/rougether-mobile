/**
 * 수신 파싱은 셸 테스트가 이 모듈을 통째로 목으로 갈아끼워 안 덮인다 (#902 리뷰).
 * 여기서 얇게 직접 본다 — 어떤 페이로드를 배너로 올릴지 정하는 자리다.
 */
import * as Notifications from 'expo-notifications';

import { onNotificationReceived } from '@/lib/push-events';

type Received = { type?: string; title: string; body: string };

/** 등록된 리스너를 붙잡아 알림 하나를 흘려보낸다. */
function emit(content: Record<string, unknown>): Received[] {
  const got: Received[] = [];
  let listener: ((e: unknown) => void) | undefined;
  const spy = jest
    .spyOn(Notifications, 'addNotificationReceivedListener')
    .mockImplementation((cb: (e: never) => void) => {
      listener = cb as (e: unknown) => void;
      return { remove: () => {} } as never;
    });
  const unsub = onNotificationReceived((n) => got.push(n));
  listener?.({ request: { content } });
  unsub();
  spy.mockRestore();
  return got;
}

describe('onNotificationReceived (#902)', () => {
  it('제목·본문을 그대로 올리고 data.type을 함께 넘긴다', () => {
    expect(
      emit({ title: '응원이 도착했어요', body: '화이팅!', data: { type: 'FRIEND_CHEER' } }),
    ).toEqual([{ type: 'FRIEND_CHEER', title: '응원이 도착했어요', body: '화이팅!' }]);
  });

  it('data가 없거나 type이 문자열이 아니면 type 없이 넘긴다 — 배너는 떠야 한다', () => {
    expect(emit({ title: '제목', body: '본문' })[0]).toEqual({
      type: undefined,
      title: '제목',
      body: '본문',
    });
    expect(emit({ title: '제목', body: '본문', data: { type: 7 } })[0].type).toBeUndefined();
  });

  it('제목·본문이 둘 다 비면 올리지 않는다 — 그릴 게 없는 data-only 메시지', () => {
    expect(emit({ data: { type: 'FRIEND_CHEER' } })).toEqual([]);
    expect(emit({ title: null, body: null })).toEqual([]);
  });

  it('한쪽만 있으면 나머지는 빈 문자열로 채워 올린다', () => {
    expect(emit({ title: '제목만 있는 알림' })[0]).toMatchObject({
      title: '제목만 있는 알림',
      body: '',
    });
  });
});
