import { useCallback, useEffect } from 'react';

import { HouseChatScreen } from '@/components/screens/house-chat-screen';
import { useToast } from '@/components/ui/toast';
import { useChatMute } from '@/hooks/use-chat-mute';
import { type HouseChatError, useHouseChat } from '@/hooks/use-house-chat';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { setForegroundPushFilter } from '@/lib/push-events';

/**
 * 집 채팅 셸 화면 (#1408) — 데이터 훅(소켓·전송·읽음)과 순수 화면을 잇는다. 채팅
 * 화면에 있는 동안만 마운트되므로, 언마운트가 곧 소켓 종료다.
 */
export function HouseChatPage({
  houseId,
  houseName,
  onBack,
}: {
  houseId: number;
  houseName?: string;
  onBack: () => void;
}) {
  const tr = useT();
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
  // 방별 음소거 (서버 #435) — 상태를 받기 전엔 버튼을 그리지 않는다(켜짐으로 잘못 보이지 않게).
  const muteFailed = useCallback(() => toast(tr('house.chat.muteFailed'), 'error'), [toast, tr]);
  const mute = useChatMute({ roomId: chat.roomId, onError: muteFailed });

  useEffect(() => {
    track('house_chat_view');
  }, []);

  // 이 방을 보는 동안 그 방 새 메시지 푸시는 배너·소리·알림 목록 모두 숨긴다(이미 화면에 있다).
  const roomId = chat.roomId;
  useEffect(() => {
    if (roomId == null) return;
    setForegroundPushFilter((tap) => tap.type === 'CHAT_MESSAGE' && tap.roomId === roomId);
    return () => setForegroundPushFilter(null);
  }, [roomId]);

  return (
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
      onSend={chat.send}
      onRetrySend={chat.retrySend}
      onVisible={chat.reportVisible}
      muted={mute.muted}
      onToggleMute={mute.loaded ? () => void mute.toggle() : undefined}
      onBack={onBack}
    />
  );
}
