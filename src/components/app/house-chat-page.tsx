import { useCallback, useEffect } from 'react';

import { HouseChatScreen } from '@/components/screens/house-chat-screen';
import { useToast } from '@/components/ui/toast';
import { type HouseChatError, useHouseChat } from '@/hooks/use-house-chat';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';

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

  useEffect(() => {
    track('house_chat_view');
  }, []);

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
      onBack={onBack}
    />
  );
}
