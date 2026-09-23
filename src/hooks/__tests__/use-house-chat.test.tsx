import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ensureHouseChatRoom, fetchChatMessages, markChatRead, sendChatMessage } from '@/api/chat';
import { ApiError } from '@/api/http';
import type { ChatMessageResponse, ChatRoomResponse } from '@/api/types';
import { useHouseChat } from '@/hooks/use-house-chat';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/auth', () => ({
  getSessionUserId: () => 1,
  getAccessToken: () => 'token-1',
  refreshSession: jest.fn(async () => true),
}));
jest.mock('@/api/chat', () => ({
  ensureHouseChatRoom: jest.fn(),
  fetchChatMessages: jest.fn(),
  sendChatMessage: jest.fn(),
  markChatRead: jest.fn(),
}));

const mockEnsure = ensureHouseChatRoom as jest.Mock;
const mockFetch = fetchChatMessages as jest.Mock;
const mockSend = sendChatMessage as jest.Mock;
const mockRead = markChatRead as jest.Mock;

/** 서버 프레임을 흘려 넣을 수 있는 가짜 WebSocket. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  server(frame: { type: string; room: ChatRoomResponse }) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}
const realWebSocket = global.WebSocket;

const ROOM_ID = 5;
const msg = (sequence: number, senderUserId = 2): ChatMessageResponse => ({
  messageId: 100 + sequence,
  roomId: ROOM_ID,
  sequence,
  clientMessageId: `c-${sequence}`,
  senderUserId,
  senderNickname: senderUserId === 1 ? '나' : '이웃',
  content: `메시지 ${sequence}`,
  createdAt: '2026-09-21T13:00:00Z',
  unreadCount: 0,
});
const room = (lastSequence: number, readers = [{ userId: 1, lastReadSequence: 0 }, { userId: 2, lastReadSequence: lastSequence }]): ChatRoomResponse => ({ roomId: ROOM_ID, roomType: 'HOUSE', houseId: 9, lastSequence, readers }); // prettier-ignore

beforeEach(() => {
  FakeSocket.instances = [];
  (global as { WebSocket: unknown }).WebSocket = FakeSocket;
  mockEnsure.mockReset().mockResolvedValue(room(3));
  mockFetch.mockReset().mockImplementation(async (_id: number, q: { after?: number } = {}) => {
    if (q.after == null) return { items: [msg(3), msg(2), msg(1)], hasNext: false, room: room(3) };
    return { items: [], hasNext: false, room: room(3) };
  });
  mockSend.mockReset();
  mockRead.mockReset().mockImplementation(async (_id: number, seq: number) => room(3, [{ userId: 1, lastReadSequence: seq }, { userId: 2, lastReadSequence: 3 }])); // prettier-ignore
});
afterAll(() => {
  global.WebSocket = realWebSocket;
});

async function setup() {
  const onError = jest.fn();
  // 전송·읽음 뮤테이션의 GC 타이머(기본 5분)가 jest 종료를 붙잡지 않게.
  const client = createTestQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, staleTime: 0, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  });
  const hook = await renderHook(() => useHouseChat({ houseId: 9, onError }), {
    wrapper: queryWrapper(client),
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  const socket = FakeSocket.instances[0];
  return { ...hook, onError, socket };
}

describe('useHouseChat (#1408)', () => {
  it('최신 페이지(DESC)를 과거→최신으로 정렬하고, 구독은 토큰을 URL이 아닌 첫 프레임으로 보낸다', async () => {
    const { result, socket } = await setup();
    expect(result.current.messages.map((m) => m.sequence)).toEqual([1, 2, 3]);
    expect(socket.url).toMatch(/\/api\/v1\/chat\/ws$/);
    expect(socket.url).not.toContain('token');
    await act(async () => socket.onopen?.());
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'SUBSCRIBE',
      roomId: ROOM_ID,
      accessToken: 'token-1',
    });
  });

  it('ROOM_UPDATED가 연속 커서보다 앞서면 after로 한 번만 받아 온다', async () => {
    const { result, socket } = await setup();
    mockFetch.mockClear();
    let resolveAfter: (v: unknown) => void = () => {};
    mockFetch.mockImplementation(
      (_id: number, q: { after?: number }) =>
        new Promise((resolve) => {
          resolveAfter = resolve;
          expect(q).toEqual({ after: 3, size: 100 });
        }),
    );
    await act(async () => {
      socket.server({ type: 'ROOM_UPDATED', room: room(5) });
      socket.server({ type: 'ROOM_UPDATED', room: room(5) });
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => resolveAfter({ items: [msg(4), msg(5)], hasNext: false, room: room(5) }));
    await waitFor(() =>
      expect(result.current.messages.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5]),
    );
  });

  it('보내면 즉시 보내는 중으로 붙고, 응답이 오면 서버 메시지로 바뀐다', async () => {
    const { result } = await setup();
    let resolveSend: (v: ChatMessageResponse) => void = () => {};
    mockSend.mockImplementation(() => new Promise((resolve) => (resolveSend = resolve)));
    await act(async () => result.current.send('안녕'));
    const pending = result.current.messages.at(-1)!;
    expect(pending).toMatchObject({ content: '안녕', status: 'pending', senderUserId: 1 });
    const clientMessageId = mockSend.mock.calls[0][1].clientMessageId;
    await act(async () => resolveSend({ ...msg(4, 1), clientMessageId, content: '안녕' }));
    await waitFor(() => expect(result.current.messages.at(-1)).toMatchObject({ sequence: 4, status: 'sent' })); // prettier-ignore
    expect(result.current.messages.filter((m) => m.content === '안녕')).toHaveLength(1);
  });

  it('네트워크 실패는 실패로 남기고, 다시 보내기는 같은 clientMessageId를 쓴다', async () => {
    const { result } = await setup();
    mockSend.mockRejectedValueOnce(new TypeError('Network request failed'));
    await act(async () => result.current.send('다시'));
    await waitFor(() => expect(result.current.messages.at(-1)?.status).toBe('failed'));
    const firstId = mockSend.mock.calls[0][1].clientMessageId;
    mockSend.mockResolvedValueOnce({ ...msg(4, 1), clientMessageId: firstId, content: '다시' });
    await act(async () => result.current.retrySend(firstId));
    expect(mockSend.mock.calls[1][1]).toEqual({ clientMessageId: firstId, content: '다시' });
    await waitFor(() => expect(result.current.messages.at(-1)?.status).toBe('sent'));
  });

  it('금칙어(400 CHAT_CONTENT_BANNED)는 말풍선을 거두고 안내한다', async () => {
    const { result, onError } = await setup();
    mockSend.mockRejectedValueOnce(
      new ApiError(400, 'POST', '/chat/rooms/5/messages', '{"code":"CHAT_CONTENT_BANNED"}'),
    );
    await act(async () => result.current.send('나쁜말'));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('banned'));
    expect(result.current.messages.some((m) => m.content === '나쁜말')).toBe(false);
  });

  it('읽음은 모아서 가장 큰 순서로 한 번 보내고, 더 낮은 값은 보내지 않는다', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.reportVisible(2);
      result.current.reportVisible(3);
    });
    expect(mockRead).not.toHaveBeenCalled();
    await waitFor(() => expect(mockRead).toHaveBeenCalledWith(ROOM_ID, 3), { timeout: 2000 });
    expect(mockRead).toHaveBeenCalledTimes(1);
    await act(async () => result.current.reportVisible(2));
    await new Promise((r) => setTimeout(r, 700));
    expect(mockRead).toHaveBeenCalledTimes(1);
  });

  it('안 읽은 수는 발신자를 뺀 읽음 위치로 다시 계산한다', async () => {
    const { result, socket } = await setup();
    await act(async () =>
      socket.server({
        type: 'READY',
        room: room(3, [
          { userId: 1, lastReadSequence: 3 },
          { userId: 2, lastReadSequence: 1 },
          { userId: 3, lastReadSequence: 0 },
        ]),
      }),
    );
    // 3번(발신자 2): 1번 사용자는 읽음, 3번 사용자는 안 읽음 → 1.
    await waitFor(() => expect(result.current.messages[2].unreadCount).toBe(1));
  });
});
