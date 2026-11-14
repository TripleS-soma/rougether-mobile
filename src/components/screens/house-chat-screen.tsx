import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  ChatImageResponse,
  ChatMessageType,
  ChatReaction,
  ChatReactionType,
} from '@/api/chat-types';
import { ChatComposer } from '@/components/chat/chat-composer';
import type { MenuAnchor } from '@/components/chat/chat-menu-placement';
import { ChatMessageMenu } from '@/components/chat/chat-message-menu';
import { ChatMessageRow } from '@/components/chat/chat-message-row';
import { myReactionOf } from '@/components/chat/chat-reactions';
import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { ScreenHeader } from '@/components/ui/screen-header';
import { weekdayLongLabelKey } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useAndroidKeyboardHeight } from '@/hooks/use-android-keyboard-height';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { i18n, useT } from '@/i18n';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';
import { formatTime, localDate, monthDayLabel, toIsoDate } from '@/utils/datetime';
import { hapticSelection } from '@/utils/haptics';

/** 서버 본문 상한 (spec chat/api.md) — 2,000 UTF-16 code unit = JS `length`. */
export const CHAT_MAX_LENGTH = 2000;

/** 화면이 그리는 메시지 한 줄 — 서버 메시지와 아직 확정 전인 내 메시지를 함께 담는다. */
export type ChatMessageView = {
  /** 목록 키 — 서버 메시지는 순서, 보내는 중인 건 clientMessageId. */
  key: string;
  messageId?: number;
  messageType?: ChatMessageType;
  /** 서버에 있는 사진 — 보낸 순서대로. */
  images?: ChatImageResponse[];
  /** 아직 올리는 중인 내 사진(자르기 영역 포함). */
  localImages?: ChatPhotoDraft[];
  /** 사진과 함께 보낸 글. */
  caption?: string;
  reactions?: ChatReaction[];
  /** 서버가 매긴 방별 순서 — 보내는 중·실패한 메시지에는 없다. */
  sequence?: number;
  clientMessageId?: string;
  senderUserId?: number;
  /** 탈퇴한 발신자는 비어 온다 — 화면이 '알 수 없음'으로 채운다. */
  senderNickname?: string;
  content: string;
  createdAt?: string;
  /** 발신자를 뺀 안 읽은 구성원 수. */
  unreadCount: number;
  status: 'sent' | 'pending' | 'failed';
};

export type HouseChatScreenProps = {
  /** 과거 → 최신 순. */
  messages: ChatMessageView[];
  /** 내 userId — 내 말풍선(오른쪽) 판정. */
  myUserId?: number;
  /** 제목 — 집 이름. */
  houseName?: string;
  /** 첫 목록을 불러오는 중. */
  loading?: boolean;
  /** 첫 목록·방을 불러오지 못함. */
  loadError?: boolean;
  onRetryLoad?: () => void;
  /** 더 오래된 메시지가 남았는지. */
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  /**
   * 다듬은(trim) 본문으로 호출된다. 담아 둔 사진(`photos`)이 있으면 글이 비어도 부른다 — 그때
   * 글은 사진과 한 메시지로 나간다. 글도 사진도 없으면 부르지 않는다.
   */
  onSend?: (text: string) => void;
  /** 보내려고 담아 둔 사진 — 입력줄 위 미리보기 줄에 보인다. */
  photos?: ChatPhotoDraft[];
  onPickPhoto?: () => void;
  pickingPhoto?: boolean;
  onRemovePhoto?: (index: number) => void;
  /** 담아 둔 사진 자르기 열기. */
  onEditPhoto?: (index: number) => void;
  /** 길게 눌러 여는 메뉴의 [신고] — 남의 메시지에만 붙는다. */
  onReport?: (messageId: number) => void;
  /** 메뉴와 공감 칩에서 내 공감을 정한다(취소는 null). 없으면 공감을 그리지 않는다. */
  onReact?: (messageId: number, type: ChatReactionType | null) => void;
  /** 메뉴의 [복사] — 글이 있는 메시지에만 붙는다. */
  onCopy?: (text: string) => void;
  /** 메뉴의 [공유] — 글이 있는 메시지에만 붙는다. 공유 시트가 없는 환경에서는 주지 않는다. */
  onShare?: (text: string) => void;
  /**
   * 사진 크게 보기의 [피드에 올리기] — **내가 보낸 사진에만** 붙는다. 채팅 사진은 그 집
   * 구성원에게만 보이는 사진이라, 남이 올린 사진을 피드로 옮길 수 없게 한다.
   */
  onSharePhoto?: (uri: string) => void;
  /** 실패한 내 메시지 다시 보내기 — 같은 clientMessageId로. */
  onRetrySend?: (clientMessageId: string) => void;
  /** 실제로 화면에 보인 메시지 중 가장 큰 순서 — 읽음 처리에 쓴다. */
  onVisible?: (lastSequence: number) => void;
  /** 이 방 새 메시지 푸시를 끈 상태 (서버 #435). */
  muted?: boolean;
  /** 헤더 종 버튼 — 없으면 버튼을 그리지 않는다(음소거 상태를 아직 모름 등). */
  onToggleMute?: () => void;
  /**
   * 헤더 종 버튼으로 "이 집 알림" 시트를 연다 (집 피드) — 채팅·자유글·인증글 알림을 한곳에서
   * 끄고 켠다. 주면 종은 스위치가 아니라 시트를 여는 버튼이 되고 `onToggleMute`는 쓰지 않는다.
   * 이때 `muted`는 "이 집 알림이 전부 꺼짐"을 뜻한다(종 아이콘 모양).
   */
  onOpenNotifications?: () => void;
  onBack?: () => void;
};

const EMPTY: ChatMessageView[] = [];

/** "2026-09-21T13:00:00Z" → 단말 시각 "오후 10:00" (표시 전용). */
function timeLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatTime(`${d.getHours()}:${d.getMinutes()}`);
}

/**
 * 메시지가 오간 날 "YYYY-MM-DD" — 시각 라벨과 같은 **단말 시계** 기준이라 자정 직전·직후
 * 메시지가 라벨과 다른 날로 묶이지 않는다. 없거나(보내는 중) 깨졌으면 null.
 */
function chatDayKey(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toIsoDate(d);
}

/** 날짜 구분선 문구 — "10월 9일 목요일", 올해가 아니면 "2025년 12월 31일 수요일". */
export function chatDayLabel(dayIso: string, now: Date = new Date()): string {
  const d = localDate(dayIso);
  const date = monthDayLabel(d);
  const weekday = i18n.t(weekdayLongLabelKey(d.getDay()));
  return d.getFullYear() === now.getFullYear()
    ? i18n.t('house.chat.day', { date, weekday })
    : i18n.t('house.chat.dayWithYear', { year: d.getFullYear(), date, weekday });
}

/**
 * 집 채팅 (#1408) — 집 구성원끼리의 채팅. 내 말풍선은 오른쪽(`primary`), 다른
 * 구성원은 왼쪽(`surface`)에 닉네임과 함께. 내 말풍선 옆 숫자는 아직 안 읽은 구성원 수.
 * 글과 사진 묶음(+함께 보낸 글)을 보내고, 말풍선을 길게 눌러 공감·복사·신고를 한다.
 *
 * 순수 화면: 메시지·전송·읽음은 전부 prop. 목록은 뒤집힌(inverted) FlatList라 최신이
 * 아래에 붙고, 위로 끝까지 올리면 `onLoadOlder`. 읽음은 **실제로 보인** 메시지의 최대
 * 순서를 `onVisible`로 알린다(스펙: 조회만으로는 읽음 처리하지 않는다).
 *
 * 날짜: 말풍선에는 시각만 붙고, 날이 바뀌는 첫 메시지 위에 날짜 구분선을 둔다(로드된 가장
 * 오래된 메시지 위에도 — 그 위가 어느 날인지 늘 알 수 있게).
 *
 * 키보드: iOS는 KAV padding, 안드로이드는 엣지투엣지라 창이 안 줄어들어 키보드 높이를
 * 직접 아래 여백으로 준다 (#1326, use-android-keyboard-height).
 */
export function HouseChatScreen({
  messages = EMPTY,
  myUserId,
  houseName,
  loading = false,
  loadError = false,
  onRetryLoad,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
  onSend,
  photos,
  onPickPhoto,
  pickingPhoto = false,
  onRemovePhoto,
  onEditPhoto,
  onReport,
  onReact,
  onCopy,
  onShare,
  onSharePhoto,
  onRetrySend,
  onVisible,
  muted = false,
  onToggleMute,
  onOpenNotifications,
  onBack,
}: HouseChatScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const tr = useT();
  // 웹 데스크톱 중앙 컬럼 (#725) — 목록 내용과 입력줄만 좁히고 배경 띠는 전체 폭.
  const column = useResponsiveColumn();
  const insets = useSafeAreaInsets();
  const headerInset = useHeaderContentInset();
  const androidKeyboard = useAndroidKeyboardHeight(Platform.OS === 'android');
  // 길게 눌러 메뉴를 연 메시지의 목록 키와 그 말풍선의 화면 자리.
  const [menu, setMenu] = useState<{ key: string; anchor?: MenuAnchor } | null>(null);
  const menuKey = menu?.key ?? null;
  const openMenu = useCallback((key: string, anchor?: MenuAnchor) => {
    hapticSelection();
    setMenu({ key, anchor });
  }, []);

  // 뒤집힌 목록은 최신이 0번 — 원본(과거→최신)을 뒤집어 넘긴다.
  const data = useMemo(() => [...messages].reverse(), [messages]);
  const menuMessage = menuKey ? messages.find((m) => m.key === menuKey) : undefined;
  const menuMine = myUserId != null && menuMessage?.senderUserId === myUserId;
  // 복사·공유할 글 — 사진 메시지는 함께 보낸 글만, 이모티콘 메시지(대체 문구뿐)는 없다.
  const menuText = !menuMessage
    ? ''
    : menuMessage.images?.length
      ? (menuMessage.caption ?? '')
      : menuMessage.messageType === 'EMOTICON'
        ? ''
        : menuMessage.content;

  // onViewableItemsChanged는 FlatList가 첫 값만 쓴다 — 최신 콜백은 ref로.
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  const handleViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    let max = 0;
    for (const token of viewableItems) {
      const seq = (token.item as ChatMessageView | undefined)?.sequence;
      if (token.isViewable && seq != null && seq > max) max = seq;
    }
    if (max > 0) onVisibleRef.current?.(max);
  }).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // 메뉴에 넣을 것이 하나라도 있을 때만 길게 누르기를 켠다.
  const hasMenu = !!(onReact || onCopy || onShare || onReport);

  // 행은 memo — 새 메시지·읽음 변화마다 목록 전체를 다시 그리지 않게(성능 장부 M8). 뷰 모델은
  // 갱신마다 새 객체라 원시값만 넘겨 얕은 비교가 먹게 한다.
  const renderItem: ListRenderItem<ChatMessageView> = useCallback(
    ({ item, index }) => {
      const mine = myUserId != null && item.senderUserId === myUserId;
      // 뒤집힌 목록에서 index+1이 바로 위(이전) 메시지 — 같은 사람이 이어 말하면 이름 생략.
      const prev = data[index + 1];
      // 보내는 중(시각 없음)은 날짜 경계를 만들지 않는다 — 앞 메시지와 같은 날로 본다.
      const day = chatDayKey(item.createdAt);
      const newDay = day != null && (prev == null || day !== chatDayKey(prev.createdAt));
      const showName = !mine && (newDay || prev?.senderUserId !== item.senderUserId);
      const time = timeLabel(item.createdAt) ?? undefined;
      return (
        <ChatMessageRow
          rowKey={item.key}
          mine={mine}
          myUserId={myUserId}
          dayLabel={newDay ? chatDayLabel(day) : undefined}
          showName={showName}
          content={item.content}
          messageId={item.messageId}
          messageType={item.messageType}
          images={item.images}
          localImages={item.localImages}
          caption={item.caption}
          reactions={item.reactions}
          senderNickname={item.senderNickname}
          time={time}
          // 사진 크게 보기에 띄울 보낸 시각 — "11월 11일 수요일 오후 8:30".
          photoSentLabel={day && time ? `${chatDayLabel(day)} ${time}` : undefined}
          unreadCount={item.unreadCount}
          status={item.status}
          clientMessageId={item.clientMessageId}
          onRetrySend={onRetrySend}
          onOpenMenu={hasMenu ? openMenu : undefined}
          onReact={onReact}
          onSharePhoto={onSharePhoto}
        />
      );
    },
    [data, myUserId, onRetrySend, hasMenu, openMenu, onReact, onSharePhoto],
  );

  const body = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={t.primary} />
    </View>
  ) : loadError ? (
    <View style={styles.center}>
      <Text style={[Typography.body, emph('normal'), { color: t.textMuted }]}>
        {tr('house.chat.loadFailed')}
      </Text>
      {onRetryLoad ? (
        <Pressable
          onPress={onRetryLoad}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retry, pressed && pressedStyle('dim', t)]}>
          <Text style={[Typography.label, { color: t.primaryText }]}>{tr('house.chat.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <FlatList
      testID="house-chat-list"
      inverted
      data={data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      onViewableItemsChanged={handleViewable}
      viewabilityConfig={viewability}
      onEndReached={hasOlder && !loadingOlder ? onLoadOlder : undefined}
      onEndReachedThreshold={0.3}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // 뒤집힌 목록의 Footer가 화면 위쪽 — 떠 있는 헤더 밑을 비운다.
      ListFooterComponent={
        <View style={{ paddingTop: headerInset }}>
          {loadingOlder ? <ActivityIndicator color={t.primary} style={styles.older} /> : null}
        </View>
      }
      ListEmptyComponent={
        // VirtualizedList가 빈 상태에도 뒤집힘 보정(inversionStyle)을 얹는다.
        <View style={styles.empty}>
          <Text style={[Typography.body, emph('normal'), { color: t.textMuted }]}>
            {tr('house.chat.empty')}
          </Text>
        </View>
      }
      contentContainerStyle={[styles.listContent, column]}
    />
  );

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        <ChatComposer
          maxLength={CHAT_MAX_LENGTH}
          disabled={loading || loadError}
          onSend={onSend}
          photos={photos}
          onPickPhoto={onPickPhoto}
          pickingPhoto={pickingPhoto}
          onRemovePhoto={onRemovePhoto}
          onEditPhoto={onEditPhoto}
          columnStyle={column}
          // 안드로이드 keyboardDidShow 높이는 ime − 시스템 바다(ReactRootView). 엣지투엣지에선
          // 키보드가 내비바 자리까지 덮으니 하단 인셋을 그대로 두고 그 위에 더한다 — 빼면
          // 내비바 높이만큼 입력칸이 키보드 밑에 깔린다(2026-10-04 갤럭시 제보).
          bottomInset={insets.bottom + androidKeyboard + Spacing.two}
        />
      </KeyboardAvoidingView>
      <ScreenHeader
        title={houseName ?? tr('house.chat.title')}
        onBack={onBack}
        right={
          onOpenNotifications ? (
            <Pressable
              onPress={onOpenNotifications}
              accessibilityRole="button"
              accessibilityLabel={tr('house.notification.openA11y')}
              hitSlop={Spacing.two}
              testID="house-chat-notifications"
              style={({ pressed }) => [
                styles.muteBtn,
                { backgroundColor: t.surface },
                pressed && pressedStyle('card', t),
              ]}>
              <Icon
                name={muted ? 'bell-off' : 'bell'}
                size={20}
                color={muted ? t.textMuted : t.text}
              />
            </Pressable>
          ) : onToggleMute ? (
            <Pressable
              onPress={onToggleMute}
              accessibilityRole="switch"
              accessibilityLabel={tr('house.chat.muteA11y')}
              accessibilityState={{ checked: !muted }}
              aria-checked={!muted}
              hitSlop={Spacing.two}
              style={({ pressed }) => [
                styles.muteBtn,
                { backgroundColor: t.surface },
                pressed && pressedStyle('card', t),
              ]}>
              <Icon
                name={muted ? 'bell-off' : 'bell'}
                size={20}
                color={muted ? t.textMuted : t.text}
              />
            </Pressable>
          ) : null
        }
      />
      <ChatMessageMenu
        visible={menuMessage != null}
        anchor={menu?.anchor}
        mine={menuMine}
        myReaction={myReactionOf(menuMessage?.reactions, myUserId)}
        onReact={
          onReact && menuMessage?.messageId != null
            ? (type) => onReact(menuMessage.messageId as number, type)
            : undefined
        }
        onCopy={onCopy && menuText ? () => onCopy(menuText) : undefined}
        onShare={onShare && menuText ? () => onShare(menuText) : undefined}
        onReport={
          onReport && !menuMine && menuMessage?.messageId != null
            ? () => onReport(menuMessage.messageId as number)
            : undefined
        }
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two },
  muteBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  older: { paddingVertical: Spacing.two },
});
