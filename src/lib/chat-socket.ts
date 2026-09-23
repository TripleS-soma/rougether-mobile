/**
 * 집 채팅 실시간 연결 (#1408) — 스펙 rougether-spec domains/chat/api.md "WebSocket".
 *
 * 한 연결은 한 방만 구독한다. 연결 직후(10초 안) 첫 텍스트 프레임으로
 * `{"type":"SUBSCRIBE","roomId","accessToken"}`을 보내고, 서버는 `READY` 뒤로 방 상태가
 * 바뀔 때마다(그리고 약 5초마다) `ROOM_UPDATED`로 **방 상태만** 보낸다 — 본문은 HTTP 목록으로
 * 가져온다. 소켓으로 보내는 건 SUBSCRIBE뿐이다(전송·읽음은 HTTP).
 *
 * - **토큰을 URL에 넣지 않는다** — 프록시·접근 로그에 남는다.
 * - 끊기면 지수 백오프로 다시 붙는다(READY를 받으면 초기화). 호출부가 `close()`한 경우만 멈춘다.
 * - 1008(인가 실패·구독 시간 초과)은 토큰 만료일 수 있어 **한 번만** `refreshSession()` 뒤
 *   재연결한다. 갱신 후에도 1008이면(비구성원·강퇴) 더 붙지 않는다 — 계속 붙으면
 *   서버에 거부만 쌓인다.
 */
import { API_BASE } from '@/api/config';
import { getAccessToken, refreshSession } from '@/api/auth';
import type { ChatRoomResponse } from '@/api/types';

/** `https://host/api/v1` → `wss://host/api/v1/chat/ws` (개발 http는 ws). */
export function chatSocketUrl(apiBase: string = API_BASE): string {
  return `${apiBase.replace(/^http/, 'ws')}/chat/ws`;
}

/** 첫 재연결 대기와 상한 — 배포 중 끊김을 두드리지 않을 만큼, 복귀는 체감될 만큼. */
export const CHAT_RECONNECT_BASE_MS = 1000;
export const CHAT_RECONNECT_MAX_MS = 30_000;

/** 서버 종료 코드 (스펙 "WebSocket") — 인가 실패·잘못된 구독·인증 시간 초과. */
const CLOSE_POLICY_VIOLATION = 1008;

type ServerFrame = { type?: string; room?: ChatRoomResponse };

export type ChatSocketHandlers = {
  /** READY·ROOM_UPDATED의 방 상태 — ready는 (재)연결 직후 첫 상태인지. */
  onRoom: (room: ChatRoomResponse, ready: boolean) => void;
  /** 갱신 후에도 인가가 거부돼 재연결을 멈췄다(비구성원·강퇴·로그아웃). */
  onDenied?: () => void;
};

export type ChatSocket = { close: () => void };

export function connectChatSocket(roomId: number, handlers: ChatSocketHandlers): ChatSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let refreshTried = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delay: number) => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      open();
    }, delay);
  };

  const reconnectWithBackoff = () => {
    const delay = Math.min(CHAT_RECONNECT_BASE_MS * 2 ** attempt, CHAT_RECONNECT_MAX_MS);
    attempt += 1;
    schedule(delay);
  };

  function open() {
    if (closed) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(chatSocketUrl());
    } catch {
      reconnectWithBackoff();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        // 로그아웃 상태 — 구독할 수 없다.
        closed = true;
        socket.close();
        handlers.onDenied?.();
        return;
      }
      socket.send(JSON.stringify({ type: 'SUBSCRIBE', roomId, accessToken }));
    };
    socket.onmessage = (event: { data?: unknown }) => {
      if (closed || typeof event.data !== 'string') return;
      let frame: ServerFrame;
      try {
        frame = JSON.parse(event.data) as ServerFrame;
      } catch {
        return;
      }
      if (!frame.room) return;
      if (frame.type === 'READY') {
        attempt = 0;
        refreshTried = false;
        handlers.onRoom(frame.room, true);
      } else if (frame.type === 'ROOM_UPDATED') {
        handlers.onRoom(frame.room, false);
      }
    };
    // onerror 뒤에는 항상 onclose가 온다 — 재연결은 거기서 한 번만.
    socket.onerror = () => {};
    socket.onclose = (event: { code?: number }) => {
      if (ws === socket) ws = null;
      if (closed) return;
      if (event.code === CLOSE_POLICY_VIOLATION) {
        if (refreshTried) {
          closed = true;
          handlers.onDenied?.();
          return;
        }
        refreshTried = true;
        void refreshSession()
          .catch(() => false)
          .then((ok) => {
            if (closed) return;
            // 갱신 실패가 네트워크 탓일 수도 있다 — 백오프로 다시 붙되, 또 1008이면 멈춘다.
            if (ok) schedule(0);
            else reconnectWithBackoff();
          });
        return;
      }
      reconnectWithBackoff();
    };
  }

  open();

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      const socket = ws;
      ws = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          // 이미 닫힘.
        }
      }
    },
  };
}
