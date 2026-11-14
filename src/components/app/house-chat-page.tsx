import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { AppState, Platform, Share } from 'react-native';
import { reportChatMessage } from '@/api/chat';
import type { ChatCrop, ChatReactionType } from '@/api/chat-types';
import type { ReportReason } from '@/api/types';
import { ChatPhotoCrop } from '@/components/chat/chat-photo-crop';
import { ReportSheet } from '@/components/ui/report-sheet';
import {
  CHAT_PHOTO_MAX,
  type ChatPhotoDraft,
  isSendableChatPhoto,
  pickChatPhotos,
} from '@/lib/pick-chat-photo';
import { useHouseNotifications } from '@/components/app/use-house-notifications';
import { HouseChatScreen } from '@/components/screens/house-chat-screen';
import { useToast } from '@/components/ui/toast';
import { FEED_ENABLED } from '@/constants/feed';
import { useChatMute } from '@/hooks/use-chat-mute';
import { type HouseChatError, useHouseChat } from '@/hooks/use-house-chat';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { dismissChatPushes, setForegroundPushFilter } from '@/lib/push-events';

/**
 * 집 채팅 셸 화면 (#1408) — 데이터 훅(소켓·전송·읽음)과 순수 화면을 잇는다. 채팅
 * 화면에 있는 동안만 마운트되므로, 언마운트가 곧 소켓 종료다.
 */
export function HouseChatPage(props: {
  houseId: number;
  houseName?: string;
  onBack: () => void;
  /** 내 사진을 피드 글로 — 셸이 작성 화면을 연다. */
  onSharePhoto?: (uri: string) => void;
}) {
  return <HouseChatRoomPage key={props.houseId} {...props} />;
}

function HouseChatRoomPage({
  houseId,
  houseName,
  onBack,
  onSharePhoto,
}: {
  houseId: number;
  houseName?: string;
  onBack: () => void;
  onSharePhoto?: (uri: string) => void;
}) {
  const tr = useT();
  // 보내려고 담아 둔 사진 — 입력줄 위에 쌓였다가 보내기 한 번에 메시지 하나로 나간다.
  const [photos, setPhotos] = useState<ChatPhotoDraft[]>([]);
  // 연속 탭이 같은 사진을 두 번 보내지 않게, 보낼 때는 state가 아니라 ref를 읽고 바로 비운다.
  const photosRef = useRef<ChatPhotoDraft[]>([]);
  const updatePhotos = (next: ChatPhotoDraft[]) => {
    photosRef.current = next;
    setPhotos(next);
  };
  // 자르기 화면에 올린 사진의 자리 — null이면 닫힘.
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const sendMessage = (text: string) => {
    if (!mounted.current) return;
    const selected = photosRef.current;
    if (selected.length === 0) {
      chat.send(text);
      return;
    }
    updatePhotos([]);
    chat.sendPhotos(selected, text);
  };
  const removePhoto = (index: number) =>
    updatePhotos(photosRef.current.filter((_, at) => at !== index));
  const applyCrop = (crop: ChatCrop | undefined) => {
    const index = cropIndex;
    setCropIndex(null);
    if (index == null) return;
    updatePhotos(photosRef.current.map((photo, at) => (at === index ? { ...photo, crop } : photo)));
  };
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { show: toast } = useToast();
  const handleError = useCallback(
    (kind: HouseChatError) => {
      toast(tr(`house.chat.${kind}`), 'error');
      // 비구성원·강퇴 — 여기 머물 이유가 없다.
      if (kind === 'forbidden') onBack();
    },
    [toast, tr, onBack],
  );
  const chat = useHouseChat({ houseId, onError: handleError });
  const pickPhoto = async () => {
    if (pickingRef.current) return;
    const room = CHAT_PHOTO_MAX - photosRef.current.length;
    if (room <= 0) {
      toast(tr('house.chat.photoMax', { max: CHAT_PHOTO_MAX }), 'error');
      return;
    }
    pickingRef.current = true;
    setPicking(true);
    try {
      const picked = await pickChatPhotos(room);
      if (!mounted.current || picked.length === 0) return;
      // 서버가 받지 않는 형식·크기는 여기서 걸러 안내한다 — 나머지는 그대로 담는다.
      const sendable = picked.filter(isSendableChatPhoto);
      if (sendable.length < picked.length)
        toast(
          sendable.length === 0
            ? tr('house.chat.photoInvalid')
            : tr('house.chat.photoSomeInvalid', { n: picked.length - sendable.length }),
          'error',
        );
      if (sendable.length === 0) return;
      // 고르는 사이 담긴 사진이 바뀌었을 수 있다 — 한도는 지금 기준으로 다시 자른다.
      const current = photosRef.current;
      updatePhotos([...current, ...sendable].slice(0, CHAT_PHOTO_MAX));
    } catch {
      if (mounted.current) toast(tr('house.chat.photoPickFailed'), 'error');
    } finally {
      pickingRef.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  // 행(memo)에 내려가는 콜백이라 참조를 고정한다 — 새 메시지마다 목록 전체가 다시 그려지지 않게.
  const chatReact = chat.react;
  const react = useCallback(
    (messageId: number, type: ChatReactionType | null) => void chatReact(messageId, type),
    [chatReact],
  );
  const copyText = async (text: string) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      if (mounted.current) toast(tr('house.chat.copied'));
    } catch {
      if (mounted.current) toast(tr('house.chat.copyFailed'), 'error');
    }
  };
  const shareText = async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch {
      // 사용자가 닫았거나 시트를 못 열었다 — 다시 누르면 된다.
    }
  };
  const { mutate: report, isPending: reporting } = useMutation({
    mutationFn: ({
      messageId,
      reason,
      detail,
    }: {
      messageId: number;
      reason: ReportReason;
      detail?: string;
    }) => {
      if (chat.roomId == null) throw new Error('chat room unavailable');
      return reportChatMessage(chat.roomId, messageId, reason, detail);
    },
    onSuccess: () => {
      setReportId(null);
      toast(tr('house.chat.reportSent'));
    },
    onError: () => toast(tr('house.chat.reportFailed'), 'error'),
  });
  // 방별 음소거 (서버 #435) — 상태를 받기 전엔 버튼을 그리지 않는다(켜짐으로 잘못 보이지 않게).
  const muteFailed = useCallback(() => toast(tr('house.chat.muteFailed'), 'error'), [toast, tr]);
  const mute = useChatMute({ roomId: chat.roomId, onError: muteFailed });
  // 집 피드가 켜진 설치본은 종이 "이 집 알림" 시트(채팅·자유글·인증글)를 연다. 꺼진 설치본은
  // 새 글 알림이 없으니 종전대로 종이 채팅 알림을 바로 끄고 켠다.
  const notifications = useHouseNotifications({ houseId, enabled: FEED_ENABLED });

  useEffect(() => {
    track('house_chat_view');
  }, []);

  // 이 집 채팅을 열면 트레이에 쌓인 이 집 채팅 알림을 한 번에 지운다 (#1746) — 알림 하나를 눌러
  // 들어와도 OS는 누른 것만 지운다. 채팅을 연 채로 앱을 떠났다 돌아왔을 때도 같다.
  useEffect(() => {
    void dismissChatPushes(houseId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void dismissChatPushes(houseId);
    });
    return () => sub.remove();
  }, [houseId]);

  // 이 방을 보는 동안 그 방 새 메시지 푸시는 배너·소리·알림 목록 모두 숨긴다(이미 화면에 있다).
  const roomId = chat.roomId;
  useEffect(() => {
    if (roomId == null) return;
    setForegroundPushFilter((tap) => tap.type === 'CHAT_MESSAGE' && tap.roomId === roomId);
    return () => setForegroundPushFilter(null);
  }, [roomId]);

  return (
    <>
      <HouseChatScreen
        messages={chat.messages}
        myUserId={chat.myUserId}
        houseName={houseName}
        loading={chat.loading}
        loadError={chat.error}
        onRetryLoad={chat.retryLoad}
        hasOlder={chat.hasOlder}
        loadingOlder={chat.loadingOlder}
        onLoadOlder={chat.loadOlder}
        onSend={sendMessage}
        photos={photos}
        onPickPhoto={() => void pickPhoto()}
        pickingPhoto={picking}
        onRemovePhoto={removePhoto}
        onEditPhoto={setCropIndex}
        onReport={setReportId}
        onReact={react}
        onCopy={(text) => void copyText(text)}
        // 웹에는 시스템 공유 시트가 없다.
        onShare={Platform.OS === 'web' ? undefined : (text) => void shareText(text)}
        onSharePhoto={onSharePhoto}
        onRetrySend={chat.retrySend}
        onVisible={chat.reportVisible}
        muted={FEED_ENABLED ? notifications.allMuted : mute.muted}
        onToggleMute={!FEED_ENABLED && mute.loaded ? () => void mute.toggle() : undefined}
        onOpenNotifications={FEED_ENABLED ? notifications.open : undefined}
        onBack={onBack}
      />
      <ChatPhotoCrop
        photo={cropIndex != null ? (photos[cropIndex] ?? null) : null}
        onDone={applyCrop}
        onCancel={() => setCropIndex(null)}
      />
      <ReportSheet
        visible={reportId != null}
        targetLabel={tr('house.chat.messageLabel')}
        submitting={reporting}
        onClose={() => setReportId(null)}
        onSubmit={(reason, detail) => {
          if (reportId != null) report({ messageId: reportId, reason, detail });
        }}
      />
      {FEED_ENABLED ? notifications.sheet : null}
    </>
  );
}
