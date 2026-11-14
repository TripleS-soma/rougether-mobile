import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSessionUserId, onSessionCleared } from '@/api/auth';
import {
  clearChatReaction,
  ensureHouseChatRoom,
  fetchChatMessages,
  markChatRead,
  sendChatMessage,
  setChatReaction,
} from '@/api/chat';
import { cancelChatImage, uploadChatImage } from '@/api/chat-images';
import { ErrorCode } from '@/api/error-codes';
import { ApiError } from '@/api/http';
import {
  chatImagesOf,
  type ChatMessageResponse,
  type ChatReactionType,
  type ChatReactionUpdate,
  type ChatSendRequest,
} from '@/api/chat-types';
import { withMyReaction } from '@/components/chat/chat-reactions';
import { cropForUpload } from '@/lib/chat-crop';
import { CHAT_PHOTO_MAX, type ChatPhotoDraft, isSendableChatPhoto } from '@/lib/pick-chat-photo';
import type { ChatReader, ChatRoomResponse } from '@/api/types';
import type { ChatMessageView } from '@/components/screens/house-chat-screen';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { connectChatSocket } from '@/lib/chat-socket';
import { queryKeys } from '@/lib/query-keys';

/** 읽음 전송을 모으는 창 — 스크롤 중 보이는 순서가 오를 때마다 PUT하지 않는다. */
export const CHAT_READ_DEBOUNCE_MS = 500;
/** 누락 복구 한 번에 받는 양 (서버 상한 100). */
const RECOVERY_PAGE_SIZE = 100;
/** 복구 루프 안전핀 — hasNext를 따라가도 이만큼이면 다음 알림에 맡긴다. */
const RECOVERY_MAX_PAGES = 20;

/** 전송 실패 중 화면이 안내할 것 — 나머지(네트워크 등)는 말풍선의 '다시 보내기'로. */
export type HouseChatError =
  | 'banned'
  | 'forbidden'
  | 'invalid'
  | 'photoInvalid'
  | 'photoLimit'
  | 'photoUnavailable'
  | 'reactionFailed';

type Outgoing = {
  clientMessageId: string;
  /** 글 메시지의 본문, 사진 메시지에서는 함께 보내는 글(없으면 빈 문자열). */
  content: string;
  /** 한 메시지로 묶어 보낼 사진 — 고른 순서대로. */
  files?: ChatPhotoDraft[];
  /** 올리기를 마친 사진 ID — `files`와 같은 자리. 아직 못 올린 칸은 비어 있다. */
  imageIds?: (number | undefined)[];
  createdAt: string;
  status: 'pending' | 'failed';
};

/**
 * 멱등 전송 키 — 같은 방·발신자 안에서만 유일하면 된다(서버 UNIQUE(room,sender,clientMessageId)).
 * Hermes에 `crypto.randomUUID`가 없을 수 있어 v4 모양으로 폴백한다.
 */
export function newClientMessageId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 내 안 읽은 메시지 수 = 방 마지막 순서 − 내 읽음 위치 (레일 배지). */
export function unreadFromRoom(room: ChatRoomResponse | undefined, myUserId?: number): number {
  if (!room || myUserId == null) return 0;
  const me = room.readers?.find((r) => r.userId === myUserId);
  if (!me) return 0;
  return Math.max(0, (room.lastSequence ?? 0) - (me.lastReadSequence ?? 0));
}

/**
 * 읽음 위치 병합 — 집계 대상은 새 목록(입주·탈퇴 반영)을 따르되, 순서가 뒤집혀 도착한
 * 알림이 위치를 낮추지 않게 사람별 최댓값을 쓴다 (스펙 "읽음 상태").
 */
export function mergeReaders(prev: ChatReader[], next: ChatReader[]): ChatReader[] {
  const prevBy = new Map(prev.map((r) => [r.userId, r.lastReadSequence ?? 0]));
  return next.map((r) => ({
    ...r,
    lastReadSequence: Math.max(r.lastReadSequence ?? 0, prevBy.get(r.userId) ?? 0),
  }));
}

/** 발신자를 뺀, 이 메시지까지 아직 못 읽은 구성원 수. */
export function unreadForMessage(message: ChatMessageResponse, readers: ChatReader[]): number {
  const seq = message.sequence ?? 0;
  return readers.filter((r) => r.userId !== message.senderUserId && (r.lastReadSequence ?? 0) < seq)
    .length;
}

/** 집 채팅방 상태 (POST /houses/{id}/chat-room, 멱등) — 레일 배지와 채팅 화면이 공유한다. */
export function useHouseChatRoom(houseId: number | undefined, enabled = true) {
  const userId = getSessionUserId();
  return useQuery({
    queryKey: queryKeys.chatRoom(userId, houseId),
    queryFn: () => ensureHouseChatRoom(houseId as number),
    enabled: houseId != null && enabled,
  });
}

/** 레일 배지용 내 안 읽은 수. 방 캐시는 채팅 화면의 소켓·읽음 응답이 갱신한다. */
export function useHouseChatUnread(houseId: number | undefined, enabled = true): number {
  const { data } = useHouseChatRoom(houseId, enabled);
  return unreadFromRoom(data, getSessionUserId());
}

function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * 집 채팅 데이터 (#1408) — 스펙 rougether-spec domains/chat/api.md "클라이언트 연결 순서".
 *
 * - 방: `useHouseChatRoom`(react-query). 전송·읽음: `useMutation`의 `mutateAsync`만.
 * - 메시지: 순서(sequence)로 정렬한 **로컬 목록**. 소켓 알림·전송 응답·과거 페이지가 섞여
 *   들어오므로 쿼리 캐시가 아니라 순서 맵 하나로 합친다(중복은 순서로 제거).
 * - 수신 커서는 **연속으로 받은 마지막 순서**다. 알림의 `lastSequence`로 바로 뛰면 중간을
 *   놓친다 — 알림은 "그 위치까지 `after`로 받아 와라"는 신호로만 쓰고, 복구는 한 번에 하나.
 * - 소켓은 앱이 백그라운드로 가거나 화면이 사라지면 닫고, 돌아오면 다시 붙어 READY로 복구한다.
 * - 읽음은 화면이 **실제로 보인** 최대 순서를 알려오면 모아서(500ms) 보내고, 낮추지 않는다.
 */
export function useHouseChat({
  houseId,
  onError,
}: {
  houseId: number | undefined;
  onError?: (kind: HouseChatError) => void;
}) {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const roomQuery = useHouseChatRoom(houseId);
  const roomId = roomQuery.data?.roomId;
  const roomKey = useMemo(() => queryKeys.chatRoom(userId, houseId), [userId, houseId]);

  const [confirmed, setConfirmed] = useState<ChatMessageResponse[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [readers, setReaders] = useState<ChatReader[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const appActive = useAppActive();

  // 스트림 상태 — 콜백들이 참조를 흔들지 않고 최신 값을 읽도록 ref에.
  const bySeq = useRef(new Map<number, ChatMessageResponse>());
  const cursor = useRef(0);
  const loaded = useRef(false);
  const wanted = useRef(0);
  const recovering = useRef(false);
  const generation = useRef(0);
  const streamRoom = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onSessionCleared(() => {
      generation.current += 1;
      setOutbox([]);
      setConfirmed([]);
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      unsubscribe();
    };
  }, []);
  const olderInFlight = useRef(false);
  const hasOlderRef = useRef(false);
  const readSent = useRef(0);
  const readPending = useRef(0);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outboxRef = useLatestRef(outbox);
  const deliveryInFlight = useRef(new Set<string>());
  const roomIdRef = useLatestRef(roomId);
  const userIdRef = useLatestRef(userId);
  const onErrorRef = useLatestRef(onError);
  const roomKeyRef = useLatestRef(roomKey);

  const { mutateAsync: sendAsync } = useMutation({
    mutationFn: (vars: { roomId: number; body: ChatSendRequest }) =>
      sendChatMessage(vars.roomId, vars.body),
  });
  const { mutateAsync: readAsync } = useMutation({
    mutationFn: (vars: { roomId: number; sequence: number }) =>
      markChatRead(vars.roomId, vars.sequence),
  });
  const { mutateAsync: reactAsync } = useMutation({
    mutationFn: (vars: { roomId: number; messageId: number; type: ChatReactionType | null }) =>
      vars.type
        ? setChatReaction(vars.roomId, vars.messageId, vars.type)
        : clearChatReaction(vars.roomId, vars.messageId),
  });
  const sendRef = useLatestRef(sendAsync);
  const readRef = useLatestRef(readAsync);
  const reactRef = useLatestRef(reactAsync);

  const merge = useCallback(
    (items: ChatMessageResponse[]) => {
      let changed = false;
      const mineArrived = new Set<string>();
      for (const m of items) {
        if (m.sequence == null) continue;
        bySeq.current.set(m.sequence, m);
        changed = true;
        if (m.senderUserId === userIdRef.current && m.clientMessageId)
          mineArrived.add(m.clientMessageId);
      }
      while (bySeq.current.has(cursor.current + 1)) cursor.current += 1;
      if (!changed) return;
      setConfirmed(
        [...bySeq.current.values()].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
      );
      // 복구가 POST 응답보다 먼저 내 메시지를 가져온 경우 — 보내는 중 말풍선을 거둔다.
      if (mineArrived.size)
        setOutbox((prev) => prev.filter((o) => !mineArrived.has(o.clientMessageId)));
    },
    [userIdRef],
  );

  /** 한 메시지의 공감 전체를 갈아 끼운다 — 아직 받지 않은 메시지면 무시(기록을 받을 때 딸려 온다). */
  const applyReactions = useCallback((update: ChatReactionUpdate) => {
    for (const [sequence, message] of bySeq.current) {
      if (message.messageId !== update.messageId) continue;
      bySeq.current.set(sequence, { ...message, reactions: update.reactions });
      setConfirmed(
        [...bySeq.current.values()].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
      );
      return;
    }
  }, []);

  /** 방 상태 반영 — 읽음 위치·레일 배지 캐시·복구 목표. */
  const applyRoom = useCallback(
    (room: ChatRoomResponse) => {
      if (room.readers) {
        const next = room.readers;
        setReaders((prev) => mergeReaders(prev, next));
        const me = next.find((r) => r.userId === userIdRef.current);
        if (me?.lastReadSequence != null)
          readSent.current = Math.max(readSent.current, me.lastReadSequence);
      }
      if (room.lastSequence != null) wanted.current = Math.max(wanted.current, room.lastSequence);
      queryClient.setQueryData<ChatRoomResponse>(roomKeyRef.current, (old) => ({
        ...old,
        ...room,
      }));
    },
    [queryClient, roomKeyRef, userIdRef],
  );

  /** `after=연속 커서`로 목표 순서까지 받아 온다 — 동시에 하나만, 알림 여러 개는 합쳐진다. */
  const recover = useCallback(async () => {
    const id = roomIdRef.current;
    if (id == null || !loaded.current || recovering.current) return;
    if (wanted.current <= cursor.current) return;
    recovering.current = true;
    const gen = generation.current;
    try {
      for (let page = 0; page < RECOVERY_MAX_PAGES && wanted.current > cursor.current; page++) {
        const from = cursor.current;
        const res = await fetchChatMessages(id, { after: from, size: RECOVERY_PAGE_SIZE });
        if (gen !== generation.current) return;
        merge(res.items ?? []);
        if (res.room) applyRoom(res.room);
        if (cursor.current === from) {
          // 더 받을 게 없다 — 목표가 실제보다 앞서 있었다(409 뒤 재조회 등). 목표를 접는다.
          wanted.current = cursor.current;
          break;
        }
      }
    } catch {
      // 다음 알림(약 5초 주기)이 다시 시도한다.
    } finally {
      // 루프 도중 들어온 알림은 위 조건(wanted > cursor)으로 같은 루프가 이어 받는다.
      if (gen === generation.current) recovering.current = false;
    }
  }, [roomIdRef, merge, applyRoom]);

  // 첫 목록 — 최신 50개(DESC로 온다). 방이 바뀌면 스트림 상태를 전부 초기화한다.
  useEffect(() => {
    if (roomId == null) return;
    if (streamRoom.current !== roomId) {
      streamRoom.current = roomId;
      generation.current += 1;
      bySeq.current = new Map();
      setConfirmed([]);
      setOutbox([]);
      setReaders([]);
      cursor.current = 0;
      loaded.current = false;
      wanted.current = 0;
      recovering.current = false;
      readSent.current = 0;
      readPending.current = 0;
    }
    const gen = generation.current;
    setInitialLoading(true);
    let cancelled = false;
    fetchChatMessages(roomId)
      .then((res) => {
        if (cancelled || gen !== generation.current) return;
        const items = [...(res.items ?? [])].reverse();
        // 최신 페이지는 연속 구간이다 — 커서는 그 끝에서 시작한다.
        cursor.current = items.reduce((max, m) => Math.max(max, m.sequence ?? 0), cursor.current);
        merge(items);
        setConfirmed(
          [...bySeq.current.values()].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
        );
        hasOlderRef.current = !!res.hasNext;
        setHasOlder(!!res.hasNext);
        loaded.current = true;
        if (res.room) applyRoom(res.room);
        setLoadError(false);
        setInitialLoading(false);
        void recover();
      })
      .catch(() => {
        if (cancelled || gen !== generation.current) return;
        setLoadError(true);
        setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, reloadKey, merge, applyRoom, recover]);

  /** 최신 쪽 한 페이지를 다시 받아 덮어쓴다 — 이미 가진 메시지의 공감·삭제 상태를 맞춘다. */
  const refreshLatest = useCallback(async () => {
    const id = roomIdRef.current;
    if (id == null) return;
    const gen = generation.current;
    try {
      const res = await fetchChatMessages(id);
      if (gen !== generation.current) return;
      // 방 상태는 방금 READY로 받은 것이 더 새롭다 — 여기서는 메시지만 덮어쓴다.
      merge(res.items ?? []);
    } catch {
      // 다음 재연결이나 화면 재진입 때 다시 맞춰진다.
    }
  }, [roomIdRef, merge]);

  // 실시간 — 포그라운드이고 방이 있을 때만 붙는다.
  useEffect(() => {
    if (roomId == null || !appActive) return;
    const socket = connectChatSocket(roomId, {
      onRoom: (room, ready) => {
        applyRoom(room);
        void recover();
        // 다시 붙었을 때 — 끊긴 동안 바뀐 공감은 `after` 복구(새 메시지만)로는 오지 않는다.
        // 최신 쪽 한 페이지를 다시 받아 공감을 맞춘다. 첫 연결은 첫 목록이 같은 일을 한다.
        if (ready && loaded.current) void refreshLatest();
      },
      // 본문 직접 수신 (서버 #429) — 순서 맵에 넣으면 연속 구간만큼 커서가 오르고, 뒤따르는
      // ROOM_UPDATED의 lastSequence가 이미 커서 이하라 HTTP 복구가 생략된다. 틈이 있으면
      // (앞 구간이 아직 없으면) 커서는 멈춰 있고 복구가 그 틈을 채운다.
      onMessage: (message) => merge([message]),
      onReactions: applyReactions,
    });
    return () => socket.close();
  }, [roomId, appActive, applyRoom, recover, merge, applyReactions, refreshLatest]);

  const flushRead = useCallback(async () => {
    readTimer.current = null;
    const id = roomIdRef.current;
    const target = readPending.current;
    if (id == null || target <= readSent.current) return;
    const before = readSent.current;
    readSent.current = target;
    try {
      const room = await readRef.current({ roomId: id, sequence: target });
      if (room) applyRoom(room);
    } catch {
      // 다음 보고가 다시 보내도록 되돌린다(그사이 방 상태가 올려 둔 값은 유지).
      if (readSent.current === target) readSent.current = before;
      readPending.current = readSent.current;
    }
  }, [roomIdRef, readRef, applyRoom]);

  /** 화면이 실제로 표시한 최대 순서 — 모아서 보내고, 보낸 값보다 낮으면 무시한다. */
  const reportVisible = useCallback(
    (sequence: number) => {
      if (sequence <= Math.max(readSent.current, readPending.current)) return;
      readPending.current = sequence;
      if (readTimer.current) return;
      readTimer.current = setTimeout(() => void flushRead(), CHAT_READ_DEBOUNCE_MS);
    },
    [flushRead],
  );

  // 화면을 떠날 때 모아 둔 읽음은 바로 보낸다 — 금방 나가도 배지가 남지 않게.
  useEffect(
    () => () => {
      if (readTimer.current) {
        clearTimeout(readTimer.current);
        void flushRead();
      }
    },
    [flushRead],
  );

  const deliver = useCallback(
    async (item: Outgoing) => {
      const { clientMessageId, content } = item;
      const id = roomIdRef.current;
      if (id == null || deliveryInFlight.current.has(clientMessageId)) return;
      const gen = generation.current;
      const ownerId = userIdRef.current;
      const current = () =>
        mounted.current &&
        getSessionUserId() === ownerId &&
        gen === generation.current &&
        roomIdRef.current === id &&
        userIdRef.current === ownerId;
      deliveryInFlight.current.add(clientMessageId);
      const drop = () =>
        setOutbox((prev) => prev.filter((o) => o.clientMessageId !== clientMessageId));
      // 올려 둔 사진을 메시지로 못 쓰게 됐을 때 — 미전송 한도(30장)를 잡아먹지 않게 바로 취소한다.
      const discard = (ids: (number | undefined)[] = []) => {
        for (const imageId of ids)
          if (imageId != null) void cancelChatImage(imageId).catch(() => {});
      };
      let imageIds = item.imageIds ?? item.files?.map(() => undefined);
      try {
        const files = item.files ?? [];
        for (let i = 0; i < files.length; i += 1) {
          if (imageIds?.[i] != null) continue;
          const uploaded = await uploadChatImage(id, files[i], cropForUpload(files[i].crop));
          imageIds = (imageIds ?? []).map((value, at) => (at === i ? uploaded.imageId : value));
          if (!current()) {
            if (getSessionUserId() === ownerId) discard(imageIds);
            return;
          }
          // POST 응답 유실 뒤에는 업로드를 반복하지 않고 같은 사진과 UUID를 다시 보낸다.
          const done = imageIds;
          setOutbox((prev) =>
            prev.map((o) => (o.clientMessageId === clientMessageId ? { ...o, imageIds: done } : o)),
          );
        }
        if (!current()) return;
        const sentIds = (imageIds ?? []).filter((value): value is number => value != null);
        const body: ChatSendRequest = sentIds.length
          ? { clientMessageId, imageIds: sentIds, ...(content ? { content } : {}) }
          : { clientMessageId, content };
        const msg = await sendRef.current({ roomId: id, body });
        if (!current()) return;
        drop();
        merge([msg]);
        track('house_chat_send');
        if (msg.sequence != null) wanted.current = Math.max(wanted.current, msg.sequence);
        void recover();
      } catch (err) {
        if (!current()) return;
        if (err instanceof ApiError && err.code === 'CHAT_IMAGE_UNAVAILABLE') {
          drop();
          discard(imageIds);
          onErrorRef.current?.('photoUnavailable');
          return;
        }
        if (err instanceof ApiError && err.status === 429 && item.files?.length) {
          onErrorRef.current?.('photoLimit');
        }
        if (err instanceof ApiError && (err.code === 'CHAT_IMAGE_INVALID' || err.status === 413)) {
          drop();
          discard(imageIds);
          onErrorRef.current?.('photoInvalid');
          return;
        }
        if (err instanceof ApiError && err.code === ErrorCode.CHAT_MESSAGE_CONFLICT) {
          // 같은 키로 다른 본문 — 서버에 있는 쪽이 정본이다. 말풍선을 거두고 다시 받는다.
          drop();
          wanted.current = Number.MAX_SAFE_INTEGER;
          void recover();
          return;
        }
        if (err instanceof ApiError && err.code === ErrorCode.CHAT_CONTENT_BANNED) {
          drop();
          discard(imageIds);
          onErrorRef.current?.('banned');
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          drop();
          discard(imageIds);
          onErrorRef.current?.('forbidden');
          return;
        }
        if (err instanceof ApiError && err.status === 400) {
          drop();
          discard(imageIds);
          onErrorRef.current?.('invalid');
          return;
        }
        // 네트워크·5xx — 응답이 유실됐을 수 있다. 같은 키로 다시 보내면 서버가 같은 메시지를 준다.
        setOutbox((prev) =>
          prev.map((o) => (o.clientMessageId === clientMessageId ? { ...o, status: 'failed' } : o)),
        );
      } finally {
        deliveryInFlight.current.delete(clientMessageId);
      }
    },
    [roomIdRef, userIdRef, sendRef, merge, recover, onErrorRef],
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || roomIdRef.current == null) return;
      const clientMessageId = newClientMessageId();
      const item: Outgoing = {
        clientMessageId,
        content: text,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      setOutbox((prev) => [...prev, item]);
      void deliver(item);
    },
    [roomIdRef, deliver],
  );

  /** 사진 여러 장(최대 10장)과 함께 쓴 글을 **메시지 하나**로 보낸다. */
  const sendPhotos = useCallback(
    (files: ChatPhotoDraft[], caption = '') => {
      if (roomIdRef.current == null || files.length === 0) return;
      if (files.length > CHAT_PHOTO_MAX || !files.every(isSendableChatPhoto)) {
        onErrorRef.current?.('photoInvalid');
        return;
      }
      const item: Outgoing = {
        clientMessageId: newClientMessageId(),
        content: caption.trim(),
        files,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      setOutbox((prev) => [...prev, item]);
      void deliver(item);
    },
    [roomIdRef, onErrorRef, deliver],
  );

  /**
   * 내 공감을 `type`으로 정한다(없애려면 null). 먼저 화면에 반영하고, 실패하면 되돌린다.
   * 같은 메시지를 연달아 눌러도 마지막에 받은 서버 응답이 정본이다.
   */
  const react = useCallback(
    async (messageId: number, type: ChatReactionType | null) => {
      const id = roomIdRef.current;
      const me = userIdRef.current;
      if (id == null || me == null) return;
      const target = [...bySeq.current.values()].find((m) => m.messageId === messageId);
      if (!target) return;
      const before = target.reactions ?? [];
      const gen = generation.current;
      applyReactions({ messageId, reactions: withMyReaction(before, me, type) });
      try {
        const updated = await reactRef.current({ roomId: id, messageId, type });
        if (gen === generation.current && updated?.reactions) applyReactions(updated);
      } catch {
        if (gen !== generation.current) return;
        applyReactions({ messageId, reactions: before });
        onErrorRef.current?.('reactionFailed');
      }
    },
    [roomIdRef, userIdRef, reactRef, onErrorRef, applyReactions],
  );

  const retrySend = useCallback(
    (clientMessageId: string) => {
      const item = outboxRef.current.find((o) => o.clientMessageId === clientMessageId);
      if (!item || item.status !== 'failed') return;
      setOutbox((prev) =>
        prev.map((o) => (o.clientMessageId === clientMessageId ? { ...o, status: 'pending' } : o)),
      );
      void deliver(item);
    },
    [outboxRef, deliver],
  );

  const loadOlder = useCallback(async () => {
    const id = roomIdRef.current;
    if (id == null || olderInFlight.current || !hasOlderRef.current) return;
    const oldest = Math.min(...bySeq.current.keys());
    if (!Number.isFinite(oldest) || oldest <= 1) {
      hasOlderRef.current = false;
      setHasOlder(false);
      return;
    }
    olderInFlight.current = true;
    setLoadingOlder(true);
    const gen = generation.current;
    try {
      const res = await fetchChatMessages(id, { before: oldest });
      if (gen !== generation.current) return;
      merge(res.items ?? []);
      hasOlderRef.current = !!res.hasNext;
      setHasOlder(!!res.hasNext);
    } catch {
      // 다시 끝에 닿으면 재시도된다.
    } finally {
      olderInFlight.current = false;
      setLoadingOlder(false);
    }
  }, [roomIdRef, merge]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setInitialLoading(true);
    if (roomQuery.isError) void roomQuery.refetch();
    else setReloadKey((k) => k + 1);
  }, [roomQuery]);
  const retryLoadRef = useLatestRef(retryLoad);
  const stableRetryLoad = useCallback(() => retryLoadRef.current(), [retryLoadRef]);

  // 방 자체를 못 여는 403 — 비구성원·강퇴.
  const roomForbidden = roomQuery.error instanceof ApiError && roomQuery.error.status === 403;
  useEffect(() => {
    if (roomForbidden) onErrorRef.current?.('forbidden');
  }, [roomForbidden, onErrorRef]);

  const messages = useMemo<ChatMessageView[]>(() => {
    const sent: ChatMessageView[] = confirmed.map((m) => ({
      key: `s${m.sequence}`,
      messageId: m.messageId,
      images: chatImagesOf(m),
      messageType: m.messageType,
      caption: m.caption ?? undefined,
      reactions: m.reactions ?? undefined,
      sequence: m.sequence,
      clientMessageId: m.clientMessageId,
      senderUserId: m.senderUserId,
      senderNickname: m.senderNickname,
      content: m.content ?? '',
      createdAt: m.createdAt,
      // 소켓 READY 전에는 서버가 붙여 준 값을 쓴다.
      unreadCount: readers.length ? unreadForMessage(m, readers) : (m.unreadCount ?? 0),
      status: 'sent',
    }));
    const outgoing: ChatMessageView[] = outbox.map((o) => ({
      key: `c${o.clientMessageId}`,
      clientMessageId: o.clientMessageId,
      senderUserId: userId,
      messageType: o.files?.length ? 'IMAGE' : 'TEXT',
      content: o.files?.length ? '' : o.content,
      caption: o.files?.length && o.content ? o.content : undefined,
      localImages: o.files,
      createdAt: o.createdAt,
      unreadCount: 0,
      status: o.status,
    }));
    return [...sent, ...outgoing];
  }, [confirmed, outbox, readers, userId]);

  const loading = roomQuery.isPending || (roomId != null && initialLoading && !loadError);
  const error = roomQuery.isError || loadError;

  return useMemo(
    () => ({
      /** 방 id — 음소거(서버 #435)·보고 있는 방의 포그라운드 푸시 숨김에 쓴다. */
      roomId,
      messages,
      myUserId: userId,
      loading: loading && !error,
      error,
      hasOlder,
      loadingOlder,
      send,
      sendPhotos,
      react,
      retrySend,
      loadOlder,
      reportVisible,
      retryLoad: stableRetryLoad,
    }),
    [
      roomId,
      messages,
      userId,
      loading,
      error,
      hasOlder,
      loadingOlder,
      send,
      sendPhotos,
      react,
      retrySend,
      loadOlder,
      reportVisible,
      stableRetryLoad,
    ],
  );
}
