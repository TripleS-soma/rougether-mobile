/**
 * 집 채팅 (#1408) — 스펙 rougether-spec domains/chat/api.md.
 *
 * 상태 변경(전송·읽음)은 전부 HTTP로 하고, 실시간 수신은 `lib/chat-socket`의
 * WebSocket이 방 상태(`ROOM_UPDATED`)만 알려준다 — 본문은 여기 목록 API로 가져온다.
 */
import { apiGet, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type {
  ChatMessagePage,
  ChatMessageResponse,
  ChatRoomResponse,
  ChatSendRequest,
} from './types';

/** POST /houses/{houseId}/chat-room — 집 채팅방 생성 또는 기존 방 반환(멱등). */
export function ensureHouseChatRoom(houseId: number) {
  return apiPost<ChatRoomResponse>(`/houses/${houseId}/chat-room`);
}

/** GET /chat/rooms/{roomId} — 방 상태와 구성원별 읽음 위치. */
export function fetchChatRoom(roomId: number) {
  return apiGet<ChatRoomResponse>(`/chat/rooms/${roomId}`);
}

export type ChatMessagesQuery = {
  /** 이 순서보다 이전을 최신순(DESC)으로. `after`와 함께 쓸 수 없다. */
  before?: number;
  /** 이 순서보다 이후를 과거순(ASC)으로 — 재접속·누락 복구용. */
  after?: number;
  /** 기본 50, 1~100. */
  size?: number;
};

/**
 * GET /chat/rooms/{roomId}/messages. 파라미터 없음·`before`는 **최신순(DESC)**,
 * `after`는 **과거순(ASC)** 으로 온다 — 정렬은 호출부가 맞춘다.
 */
export function fetchChatMessages(roomId: number, query: ChatMessagesQuery = {}) {
  return apiGet<ChatMessagePage>(
    `/chat/rooms/${roomId}/messages${buildQuery({
      before: query.before,
      after: query.after,
      size: query.size,
    })}`,
  );
}

/**
 * POST /chat/rooms/{roomId}/messages — 같은 `clientMessageId`로 재전송하면 서버가 같은
 * 메시지를 돌려준다(멱등). 본문이 다르면 409 `CHAT_MESSAGE_CONFLICT`. 금칙어는 400
 * `CHAT_CONTENT_BANNED` — 호출부가 안내로 접으므로 예상 상태로 둔다.
 */
export function sendChatMessage(roomId: number, body: ChatSendRequest) {
  return apiPost<ChatMessageResponse>(`/chat/rooms/${roomId}/messages`, body, {
    expectedStatuses: [400, 409],
  });
}

/** PUT /chat/rooms/{roomId}/read — 읽음 위치를 앞으로(더 작은 값은 서버가 무시). */
export function markChatRead(roomId: number, lastReadSequence: number) {
  return apiPut<ChatRoomResponse>(`/chat/rooms/${roomId}/read`, { lastReadSequence });
}
