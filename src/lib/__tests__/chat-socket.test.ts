import { refreshSession } from '@/api/auth';
import { CHAT_RECONNECT_BASE_MS, chatSocketUrl, connectChatSocket } from '@/lib/chat-socket';

jest.mock('@/api/auth', () => ({
  getAccessToken: () => 'token-1',
  refreshSession: jest.fn(async () => true),
}));

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
}
const realWebSocket = global.WebSocket;

beforeEach(() => {
  jest.useFakeTimers();
  FakeSocket.instances = [];
  (global as { WebSocket: unknown }).WebSocket = FakeSocket;
});
afterEach(() => {
  jest.useRealTimers();
});
afterAll(() => {
  global.WebSocket = realWebSocket;
});

describe('chat-socket (#1408)', () => {
  it('API 주소에서 wss 주소를 만든다 — 토큰은 URL에 없다', () => {
    expect(chatSocketUrl('https://api.example.com/api/v1')).toBe(
      'wss://api.example.com/api/v1/chat/ws',
    );
  });

  it('READY·ROOM_UPDATED의 방 상태를 넘긴다', () => {
    const onRoom = jest.fn();
    const socket = connectChatSocket(5, { onRoom });
    const ws = FakeSocket.instances[0];
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'SUBSCRIBE',
      roomId: 5,
      accessToken: 'token-1',
    });
    ws.onmessage?.({
      data: JSON.stringify({ type: 'READY', room: { roomId: 5, lastSequence: 3 } }),
    });
    ws.onmessage?.({ data: JSON.stringify({ type: 'ROOM_UPDATED', room: { roomId: 5, lastSequence: 4 } }) }); // prettier-ignore
    expect(onRoom.mock.calls).toEqual([
      [{ roomId: 5, lastSequence: 3 }, true],
      [{ roomId: 5, lastSequence: 4 }, false],
    ]);
    socket.close();
  });

  it('끊기면 백오프 뒤 다시 붙고, close() 뒤에는 붙지 않는다', () => {
    const socket = connectChatSocket(5, { onRoom: jest.fn() });
    FakeSocket.instances[0].onclose?.({ code: 1006 });
    jest.advanceTimersByTime(CHAT_RECONNECT_BASE_MS);
    expect(FakeSocket.instances).toHaveLength(2);
    socket.close();
    jest.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('1008은 세션을 한 번 갱신하고 다시 붙으며, 또 1008이면 멈춘다', async () => {
    const onDenied = jest.fn();
    connectChatSocket(5, { onRoom: jest.fn(), onDenied });
    FakeSocket.instances[0].onclose?.({ code: 1008 });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(0);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onclose?.({ code: 1008 });
    expect(onDenied).toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
