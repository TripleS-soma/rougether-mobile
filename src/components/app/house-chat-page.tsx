import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { reportChatMessage } from '@/api/chat';
import type { ReportReason } from '@/api/types';
import { ReportSheet } from '@/components/ui/report-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import type { PickedLibraryImageWithSize } from '@/lib/pick-image';
import { pickChatPhoto } from '@/lib/pick-chat-photo';
import { HouseChatScreen } from '@/components/screens/house-chat-screen';
import { useToast } from '@/components/ui/toast';
import { useChatMute } from '@/hooks/use-chat-mute';
import { type HouseChatError, useHouseChat } from '@/hooks/use-house-chat';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { dismissChatPushes, setForegroundPushFilter } from '@/lib/push-events';

/**
 * 집 채팅 셸 화면 (#1408) — 데이터 훅(소켓·전송·읽음)과 순수 화면을 잇는다. 채팅
 * 화면에 있는 동안만 마운트되므로, 언마운트가 곧 소켓 종료다.
 */
export function HouseChatPage(props: { houseId: number; houseName?: string; onBack: () => void }) {
  return <HouseChatRoomPage key={props.houseId} {...props} />;
}

function HouseChatRoomPage({
  houseId,
  houseName,
  onBack,
}: {
  houseId: number;
  houseName?: string;
  onBack: () => void;
}) {
  const tr = useT();
  const t = useTokens();
  const Typography = useTypography();
  const [photo, setPhoto] = useState<PickedLibraryImageWithSize | null>(null);
  const photoRef = useRef<PickedLibraryImageWithSize | null>(null);
  const clearPhoto = () => {
    photoRef.current = null;
    setPhoto(null);
  };
  const sendPhoto = () => {
    const selected = photoRef.current;
    if (!selected || !mounted.current) return;
    clearPhoto();
    chat.sendPhoto(selected);
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
    pickingRef.current = true;
    setPicking(true);
    try {
      const picked = await pickChatPhoto();
      if (!mounted.current || !picked) return;
      if (
        !['image/jpeg', 'image/png'].includes(picked.type.toLowerCase()) ||
        (picked.fileSize ?? 0) > 10 * 1024 * 1024
      ) {
        toast(tr('house.chat.photoInvalid'), 'error');
        return;
      }
      photoRef.current = picked;
      setPhoto(picked);
    } catch {
      if (mounted.current) toast(tr('house.chat.photoPickFailed'), 'error');
    } finally {
      pickingRef.current = false;
      if (mounted.current) setPicking(false);
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
        onSend={chat.send}
        onPickPhoto={() => void pickPhoto()}
        pickingPhoto={picking}
        onReport={setReportId}
        onRetrySend={chat.retrySend}
        onVisible={chat.reportVisible}
        muted={mute.muted}
        onToggleMute={mute.loaded ? () => void mute.toggle() : undefined}
        onBack={onBack}
      />
      <Modal visible={photo != null} transparent animationType="fade" onRequestClose={clearPhoto}>
        <View style={[styles.previewBackdrop, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{tr('house.chat.previewPhoto')}</Text>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.preview}
              contentFit="contain"
              cachePolicy="none"
            />
          ) : null}
          <View style={styles.previewActions}>
            <Pressable onPress={clearPhoto} accessibilityRole="button" style={styles.action}>
              <Text style={[Typography.label, { color: t.textMuted }]}>
                {tr('house.chat.cancelPhoto')}
              </Text>
            </Pressable>
            <Pressable
              onPress={sendPhoto}
              accessibilityRole="button"
              accessibilityLabel={tr('house.chat.sendPhoto')}
              style={[styles.action, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {tr('house.chat.sendPhoto')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ReportSheet
        visible={reportId != null}
        targetLabel={tr('house.chat.messageLabel')}
        submitting={reporting}
        onClose={() => setReportId(null)}
        onSubmit={(reason, detail) => {
          if (reportId != null) report({ messageId: reportId, reason, detail });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  previewBackdrop: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six * 2,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.four,
  },
  preview: { flex: 1, width: '100%' },
  previewActions: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  action: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
});
