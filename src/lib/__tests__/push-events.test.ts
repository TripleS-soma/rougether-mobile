/**
 * 수신 파싱은 셸 테스트가 이 모듈을 통째로 목으로 갈아끼워 안 덮인다 (#902 리뷰).
 * 여기서 얇게 직접 본다 — 어떤 페이로드를 배너로 올릴지 정하는 자리다.
 */
import * as Notifications from 'expo-notifications';

import {
  initPushDisplay,
  onNotificationReceived,
  onNotificationTap,
  pushDataOf,
  pushTapFrom,
  setForegroundPushFilter,
} from '@/lib/push-events';

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

describe('onNotificationTap', () => {
  it('passes a cold-start cat reminder once and ignores a late callback after cleanup', async () => {
    const response = {
      notification: {
        request: { identifier: 'cat-42', content: { data: { type: 'APP_INACTIVITY_REMINDER' } } },
      },
    };
    const getLast = jest
      .spyOn(Notifications, 'getLastNotificationResponseAsync')
      .mockResolvedValue(response as never);
    let listener: ((r: typeof response) => void) | undefined;
    const subscribe = jest
      .spyOn(Notifications, 'addNotificationResponseReceivedListener')
      .mockImplementation((cb) => {
        listener = cb as unknown as typeof listener;
        return { remove: jest.fn() } as never;
      });
    const received = jest.fn();
    const stop = onNotificationTap(received);
    await Promise.resolve();
    listener?.(response);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith({ type: 'APP_INACTIVITY_REMINDER', refId: undefined });
    stop();
    listener?.({
      notification: { request: { ...response.notification.request, identifier: 'late' } },
    });
    expect(received).toHaveBeenCalledTimes(1);
    getLast.mockRestore();
    subscribe.mockRestore();
  });

  it('피드 댓글 FCM data의 postId(문자열)를 refId로 넘긴다 (#1409)', async () => {
    const getLast = jest
      .spyOn(Notifications, 'getLastNotificationResponseAsync')
      .mockResolvedValue(null as never);
    let listener: ((r: unknown) => void) | undefined;
    const subscribe = jest
      .spyOn(Notifications, 'addNotificationResponseReceivedListener')
      .mockImplementation((cb) => {
        listener = cb as unknown as typeof listener;
        return { remove: jest.fn() } as never;
      });
    const received = jest.fn();
    const stop = onNotificationTap(received);
    listener?.({
      notification: {
        request: {
          identifier: 'feed-1',
          content: { data: { type: 'FEED_COMMENT', notificationId: '100', postId: '42' } },
        },
      },
    });
    expect(received).toHaveBeenLastCalledWith({ type: 'FEED_COMMENT', refId: 42 });
    // 숫자로 못 바꾸는 값은 버린다.
    listener?.({
      notification: {
        request: { identifier: 'feed-2', content: { data: { type: 'FEED_COMMENT', postId: 'x' } } },
      },
    });
    expect(received).toHaveBeenLastCalledWith({ type: 'FEED_COMMENT', refId: undefined });
    stop();
    getLast.mockRestore();
    subscribe.mockRestore();
  });
});

describe('채팅 푸시 (서버 #435)', () => {
  afterEach(() => setForegroundPushFilter(null));

  it('data의 houseId·roomId·refId를 숫자로 읽는다(값은 문자열로 온다)', () => {
    expect(pushTapFrom({ type: 'CHAT_MESSAGE', roomId: '7', houseId: '3' })).toMatchObject({
      type: 'CHAT_MESSAGE',
      roomId: 7,
      houseId: 3,
    });
    expect(pushTapFrom({ type: 'MARKET_SELL_FILLED', refId: '55' })).toMatchObject({ refId: 55 });
    expect(pushTapFrom({ roomId: 'x', houseId: '-1' })).toMatchObject({
      roomId: undefined,
      houseId: undefined,
    });
  });

  it('보고 있는 방의 새 메시지는 인앱 배너로 올리지 않고, 다른 방은 올린다', () => {
    setForegroundPushFilter((tap) => tap.type === 'CHAT_MESSAGE' && tap.roomId === 7);
    expect(
      emit({ title: '집', body: '나: 안녕', data: { type: 'CHAT_MESSAGE', roomId: '7' } }),
    ).toEqual([]);
    expect(
      emit({ title: '집', body: '나: 안녕', data: { type: 'CHAT_MESSAGE', roomId: '8' } }),
    ).toHaveLength(1);
  });

  it('보고 있는 방의 새 메시지는 소리·알림 목록도 남기지 않는다', async () => {
    let handler: ((n: unknown) => Promise<Record<string, boolean>>) | undefined;
    const spy = jest.spyOn(Notifications, 'setNotificationHandler').mockImplementation((h) => {
      handler = h?.handleNotification as unknown as typeof handler;
    });
    initPushDisplay();
    setForegroundPushFilter((tap) => tap.type === 'CHAT_MESSAGE' && tap.roomId === 7);
    const show = (roomId: string) =>
      handler?.({ request: { content: { data: { type: 'CHAT_MESSAGE', roomId } } } });
    expect(await show('7')).toMatchObject({ shouldPlaySound: false, shouldShowList: false });
    expect(await show('8')).toMatchObject({ shouldPlaySound: true, shouldShowList: true });
    spy.mockRestore();
  });
});

describe('iOS FCM 푸시 (#1582)', () => {
  afterEach(() => setForegroundPushFilter(null));

  // iOS expo-notifications는 원격 푸시의 content.data를 userInfo["body"]에서만 읽는다 — FCM이
  // APNs userInfo 최상위에 둔 키는 비어 있고 트리거 payload에만 있다.
  const iosRequest = (identifier: string, payload: Record<string, unknown>) =>
    ({
      identifier,
      content: { title: '우리 집', body: '곰: 안녕', data: {} },
      trigger: {
        type: 'push',
        payload: { aps: { alert: { title: '우리 집', body: '곰: 안녕' } }, ...payload },
      },
    }) as never;

  it('data가 비면 푸시 트리거 payload를 읽는다', () => {
    expect(pushDataOf(iosRequest('a', { type: 'CHAT_MESSAGE', houseId: '3' }))).toMatchObject({
      type: 'CHAT_MESSAGE',
      houseId: '3',
    });
    // Android·로컬 알림처럼 data가 차 있으면 그대로다.
    expect(
      pushDataOf({ content: { data: { type: 'FEED_COMMENT' } }, trigger: null } as never),
    ).toEqual({ type: 'FEED_COMMENT' });
  });

  it('채팅 푸시를 누르면 집·방 id를 넘긴다', async () => {
    const getLast = jest
      .spyOn(Notifications, 'getLastNotificationResponseAsync')
      .mockResolvedValue(null as never);
    let listener: ((r: unknown) => void) | undefined;
    const subscribe = jest
      .spyOn(Notifications, 'addNotificationResponseReceivedListener')
      .mockImplementation((cb) => {
        listener = cb as unknown as typeof listener;
        return { remove: jest.fn() } as never;
      });
    const received = jest.fn();
    const stop = onNotificationTap(received);
    listener?.({
      notification: {
        request: iosRequest('chat-1', {
          type: 'CHAT_MESSAGE',
          houseId: '3',
          roomId: '7',
          'gcm.message_id': '1',
        }),
      },
    });
    expect(received).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'CHAT_MESSAGE', houseId: 3, roomId: 7 }),
    );
    stop();
    getLast.mockRestore();
    subscribe.mockRestore();
  });

  it('보고 있는 방의 푸시는 포그라운드에서 배너·소리 모두 거른다', async () => {
    let handler: ((n: unknown) => Promise<Record<string, boolean>>) | undefined;
    const spy = jest.spyOn(Notifications, 'setNotificationHandler').mockImplementation((h) => {
      handler = h?.handleNotification as unknown as typeof handler;
    });
    initPushDisplay();
    setForegroundPushFilter((tap) => tap.type === 'CHAT_MESSAGE' && tap.roomId === 7);
    const request = iosRequest('chat-2', { type: 'CHAT_MESSAGE', roomId: '7' });
    expect(await handler?.({ request })).toMatchObject({ shouldPlaySound: false });

    let listener: ((e: unknown) => void) | undefined;
    const sub = jest
      .spyOn(Notifications, 'addNotificationReceivedListener')
      .mockImplementation((cb: (e: never) => void) => {
        listener = cb as (e: unknown) => void;
        return { remove: () => {} } as never;
      });
    const got: unknown[] = [];
    const unsub = onNotificationReceived((n) => got.push(n));
    listener?.({ request });
    listener?.({ request: iosRequest('chat-3', { type: 'CHAT_MESSAGE', roomId: '8' }) });
    expect(got).toEqual([expect.objectContaining({ type: 'CHAT_MESSAGE', roomId: 8 })]);
    unsub();
    sub.mockRestore();
    spy.mockRestore();
  });
});
