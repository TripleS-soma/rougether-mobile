import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  ChatImageResponse,
  ChatMessageType,
  ChatReaction,
  ChatReactionType,
} from '@/api/chat-types';
import type { MenuAnchor } from '@/components/chat/chat-menu-placement';
import { ChatPhotoGrid } from '@/components/chat/chat-photo-grid';
import { ChatReactionChips } from '@/components/chat/chat-reaction-chips';
import { LinkifiedText } from '@/components/ui/linkified-text';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';

/**
 * 뷰의 화면(창) 좌표 — 새 아키텍처와 웹은 `getBoundingClientRect`를 동기로 준다. 없는
 * 환경(테스트 렌더러)에서는 undefined라 메뉴가 화면 가운데에 뜬다.
 */
function windowRectOf(view: View | null): MenuAnchor | undefined {
  const measure = (view as { getBoundingClientRect?: () => MenuAnchor } | null)
    ?.getBoundingClientRect;
  if (typeof measure !== 'function') return undefined;
  const rect = measure.call(view);
  return rect && rect.width > 0 && rect.height > 0
    ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    : undefined;
}

export type ChatMessageRowProps = {
  /** 목록 키 — 길게 눌렀을 때 어느 메시지인지 화면에 알린다. */
  rowKey: string;
  messageId?: number;
  messageType?: ChatMessageType;
  images?: ChatImageResponse[];
  localImages?: ChatPhotoDraft[];
  /** 사진과 함께 보낸 글. */
  caption?: string;
  reactions?: ChatReaction[];
  myUserId?: number;
  mine: boolean;
  /** 이 메시지가 그날의 첫 메시지면 위에 그릴 날짜 구분선 문구. */
  dayLabel?: string;
  showName: boolean;
  content: string;
  senderNickname?: string;
  /** 말풍선 옆 시각("오후 8:30") — 보내는 중이면 없다. */
  time?: string;
  /** 사진 크게 보기에 띄울 보낸 날짜·시각. */
  photoSentLabel?: string;
  unreadCount: number;
  status: 'sent' | 'pending' | 'failed';
  clientMessageId?: string;
  onRetrySend?: (clientMessageId: string) => void;
  /**
   * 길게 누르기 — 화면이 공감·복사·신고 메뉴를 연다. 보낸 메시지에서만 부른다. `anchor`는
   * 말풍선(사진 포함)의 화면 자리로, 메뉴를 그 옆에 붙이는 데 쓴다. 못 재면 비운다.
   */
  onOpenMenu?: (rowKey: string, anchor?: MenuAnchor) => void;
  onReact?: (messageId: number, type: ChatReactionType | null) => void;
  onSharePhoto?: (uri: string) => void;
};

/**
 * 채팅 한 줄 — 글 말풍선 또는 사진 묶음(+함께 보낸 글)과 그 아래 공감 칩.
 * 길게 누르면 메뉴가 열린다(공감·복사·신고) — 말풍선 옆에 늘 떠 있던 "신고"를 거기로 옮겼다.
 */
export const ChatMessageRow = memo(function ChatMessageRow({
  rowKey,
  messageId,
  messageType,
  images,
  localImages,
  caption,
  reactions,
  myUserId,
  mine,
  dayLabel,
  showName,
  content,
  senderNickname,
  time,
  photoSentLabel,
  unreadCount,
  status,
  clientMessageId,
  onRetrySend,
  onOpenMenu,
  onReact,
  onSharePhoto,
}: ChatMessageRowProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const sent = status === 'sent' && messageId != null;
  const bodyRef = useRef<View>(null);
  const openMenu =
    sent && onOpenMenu ? () => onOpenMenu(rowKey, windowRectOf(bodyRef.current)) : undefined;
  const senderName = senderNickname || tr('house.chat.unknownSender');
  const hasPhotos = !!images?.length || !!localImages?.length;
  // 사진이 없는 사진 메시지 — 탈퇴한 회원의 사진이거나 운영자가 지운 메시지.
  const imageMissing = messageType === 'IMAGE' && !hasPhotos;
  // 말풍선에 넣을 글: 사진 메시지는 함께 보낸 글만(대체 문구 "사진을 보냈어요"는 옛 앱용).
  // 이 앱은 아직 이모티콘을 그리지 않는다 — 이모티콘 메시지는 서버의 대체 문구로 보인다.
  const text = hasPhotos
    ? (caption ?? '')
    : imageMissing && !content
      ? tr('house.chat.photoUnavailable')
      : content;

  const meta =
    status === 'pending' ? (
      <Text style={[Typography.caption, { color: t.textMuted }]}>{tr('house.chat.sending')}</Text>
    ) : status === 'failed' ? (
      <Pressable
        onPress={() => clientMessageId && onRetrySend?.(clientMessageId)}
        accessibilityRole="button"
        accessibilityLabel={tr('house.chat.retryA11y')}
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && pressedStyle('dim', t)}>
        <Text style={[Typography.caption, emph('semibold'), { color: t.dangerText }]}>
          {tr('house.chat.failed')}
        </Text>
      </Pressable>
    ) : (
      <View style={[styles.meta, mine ? styles.metaMine : null]}>
        {unreadCount > 0 ? (
          <Text
            style={[Typography.caption, emph('semibold'), { color: t.primaryText }]}
            accessibilityLabel={tr('house.chat.unreadA11y', { n: unreadCount })}>
            {unreadCount}
          </Text>
        ) : null}
        {time ? <Text style={[Typography.caption, { color: t.textMuted }]}>{time}</Text> : null}
      </View>
    );

  const longPress = openMenu
    ? {
        onLongPress: openMenu,
        accessibilityHint: tr('house.chat.longPressHint'),
        accessibilityActions: [{ name: 'longpress' as const }],
        onAccessibilityAction: openMenu,
      }
    : null;

  const row = (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
      {showName ? (
        <Text
          style={[Typography.caption, emph('semibold'), { color: t.textMuted }]}
          numberOfLines={1}>
          {senderName}
        </Text>
      ) : null}
      <View style={[styles.line, mine ? styles.lineMine : null]}>
        <View
          ref={bodyRef}
          // 자식이 하나뿐일 때 네이티브가 이 뷰를 없애면 자리를 잴 수 없다.
          collapsable={false}
          style={[
            styles.body,
            mine ? styles.rowMine : styles.rowOther,
            status === 'pending' ? styles.pending : null,
          ]}>
          {hasPhotos ? (
            <ChatPhotoGrid
              images={images}
              localImages={localImages}
              senderName={senderName}
              sentLabel={photoSentLabel}
              onShareToFeed={mine ? onSharePhoto : undefined}
              onLongPress={openMenu}
            />
          ) : null}
          {text ? (
            <Pressable
              {...longPress}
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: t.primary }
                  : { backgroundColor: t.surface, borderColor: t.border },
                mine ? null : styles.bubbleOther,
              ]}>
              <LinkifiedText
                style={[Typography.body, emph('normal'), { color: mine ? t.onPrimary : t.text }]}
                // 내 말풍선(진한 바탕)은 글자색 그대로 밑줄만, 남의 말풍선은 강조색.
                linkColor={mine ? undefined : t.primaryText}>
                {text}
              </LinkifiedText>
            </Pressable>
          ) : null}
        </View>
        {meta}
      </View>
      {sent ? (
        <ChatReactionChips
          reactions={reactions}
          myUserId={myUserId}
          onReact={onReact && messageId != null ? (type) => onReact(messageId, type) : undefined}
        />
      ) : null}
    </View>
  );
  if (!dayLabel) return row;
  // 뒤집힌 목록도 셀 안의 순서는 그대로라 구분선이 말풍선 위에 온다.
  return (
    <View>
      <View style={styles.dayDivider} accessibilityRole="header">
        <View style={[styles.dayRule, { backgroundColor: t.border }]} />
        <Text style={[Typography.caption, emph('normal'), { color: t.textMuted }]}>{dayLabel}</Text>
        <View style={[styles.dayRule, { backgroundColor: t.border }]} />
      </View>
      {row}
    </View>
  );
});

const styles = StyleSheet.create({
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { marginVertical: Spacing.half, gap: Spacing.half, maxWidth: '100%' },
  rowMine: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one, maxWidth: '85%' },
  lineMine: { flexDirection: 'row-reverse' },
  meta: { alignItems: 'flex-start' },
  metaMine: { alignItems: 'flex-end' },
  // 사진·이모티콘·글 말풍선을 위에서 아래로 쌓는다.
  body: { gap: Spacing.one, flexShrink: 1 },
  bubble: {
    // 카카오톡 말풍선에 가까운 여백 — 글자에 비해 풍선이 부풀어 보이지 않게.
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two - Spacing.half,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    flexShrink: 1,
  },
  bubbleOther: { borderWidth: StyleSheet.hairlineWidth },
  pending: { opacity: 0.6 },
});
