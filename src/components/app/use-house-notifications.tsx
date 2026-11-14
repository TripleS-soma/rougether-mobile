import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import {
  type HouseFeedPushField,
  HouseNotificationSheet,
} from '@/components/screens/house/house-notification-sheet';
import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useChatMute } from '@/hooks/use-chat-mute';
import { useHouseChatRoom } from '@/hooks/use-house-chat';
import { useHouseFeedNotification } from '@/hooks/use-house-feed-notification';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const BELL_SIZE = 40;

/**
 * 헤더의 종 버튼 — "이 집 알림" 시트를 연다. 집 채팅 화면의 종과 같은 모양이고, 이 집 알림이 전부
 * 꺼져 있으면 꺼진 종으로 그린다.
 */
export function HouseNotificationBell({ muted, onPress }: { muted: boolean; onPress: () => void }) {
  const t = useTokens();
  const tr = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('house.notification.openA11y')}
      hitSlop={Spacing.two}
      testID="house-notification-bell"
      style={({ pressed }) => [
        styles.bell,
        { backgroundColor: t.surface },
        pressed && pressedStyle('card', t),
      ]}>
      <Icon name={muted ? 'bell-off' : 'bell'} size={20} color={muted ? t.textMuted : t.text} />
    </Pressable>
  );
}

/**
 * "이 집 알림" 배선 (집 피드) — 집 채팅 화면과 집 피드 목록이 같은 시트를 연다. 채팅 음소거는
 * 방(roomId)별, 새 글 푸시는 집(houseId)별 API라 여기서 둘을 한 시트로 모은다.
 *
 * - 채팅: 방 상태를 받기 전엔 줄을 잠근다(켜짐으로 잘못 보이지 않게, 종전 종 버튼과 같은 규칙).
 * - 새 글: 설정 API가 아직 없는 서버(404)·실패면 `unavailable` — 시트가 두 줄을 잠그고 안내한다.
 *
 * `enabled`가 false면 아무것도 요청하지 않는다. 방 상태는 집 탭이 이미 받아 둔 캐시를 같이 쓴다.
 */
export function useHouseNotifications({
  houseId,
  enabled = true,
}: {
  houseId: number | undefined;
  enabled?: boolean;
}) {
  const tr = useT();
  const { show: toast } = useToast();
  const [visible, setVisible] = useState(false);

  const room = useHouseChatRoom(houseId, enabled);
  const muteFailed = useCallback(() => toast(tr('house.chat.muteFailed'), 'error'), [toast, tr]);
  const mute = useChatMute({ roomId: enabled ? room.data?.roomId : null, onError: muteFailed });

  const saveFailed = useCallback(
    () => toast(tr('house.notification.saveFailed'), 'error'),
    [toast, tr],
  );
  const feed = useHouseFeedNotification({ houseId, enabled, onError: saveFailed });

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const toggleFeed = feed.toggle;
  const handleToggleFeed = useCallback(
    (field: HouseFeedPushField) => void toggleFeed(field),
    [toggleFeed],
  );

  // 종 모양: 아는 설정이 전부 꺼졌을 때만 '꺼짐'. 새 글 설정을 모르면 채팅만 본다.
  const feedOff = feed.loaded ? !feed.freePostPush && !feed.verificationPostPush : true;
  const allMuted = mute.loaded && mute.muted && feedOff;

  const sheet = (
    <HouseNotificationSheet
      visible={visible}
      onClose={close}
      chat={mute.loaded ? { on: !mute.muted, onToggle: () => void mute.toggle() } : { on: false }}
      feed={{
        state: feed.loaded ? 'ready' : feed.unavailable ? 'unavailable' : 'loading',
        freePostPush: feed.freePostPush,
        verificationPostPush: feed.verificationPostPush,
        onToggle: handleToggleFeed,
      }}
    />
  );

  return { open, close, allMuted, sheet };
}

const styles = StyleSheet.create({
  bell: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
