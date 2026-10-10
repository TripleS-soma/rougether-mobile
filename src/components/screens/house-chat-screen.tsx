import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { weekdayLongLabelKey } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useAndroidKeyboardHeight } from '@/hooks/use-android-keyboard-height';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { i18n, useT } from '@/i18n';
import { formatTime, localDate, monthDayLabel, toIsoDate } from '@/utils/datetime';

/** 서버 본문 상한 (spec chat/api.md) — 2,000 UTF-16 code unit = JS `length`. */
export const CHAT_MAX_LENGTH = 2000;

/** 화면이 그리는 메시지 한 줄 — 서버 메시지와 아직 확정 전인 내 메시지를 함께 담는다. */
export type ChatMessageView = {
  /** 목록 키 — 서버 메시지는 순서, 보내는 중인 건 clientMessageId. */
  key: string;
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
  /** 다듬은(trim) 본문으로 호출된다. 빈 본문은 부르지 않는다. */
  onSend?: (text: string) => void;
  /** 실패한 내 메시지 다시 보내기 — 같은 clientMessageId로. */
  onRetrySend?: (clientMessageId: string) => void;
  /** 실제로 화면에 보인 메시지 중 가장 큰 순서 — 읽음 처리에 쓴다. */
  onVisible?: (lastSequence: number) => void;
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
 * 집 채팅 (#1408) — 집 구성원끼리의 텍스트 채팅. 내 말풍선은 오른쪽(`primary`), 다른
 * 구성원은 왼쪽(`surface`)에 닉네임과 함께. 내 말풍선 옆 숫자는 아직 안 읽은 구성원 수.
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
  onRetrySend,
  onVisible,
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
  const [draft, setDraft] = useState('');

  // 뒤집힌 목록은 최신이 0번 — 원본(과거→최신)을 뒤집어 넘긴다.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !!onSend;
  const send = () => {
    if (!canSend) return;
    onSend?.(trimmed);
    setDraft('');
  };

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
      return (
        <ChatRow
          mine={mine}
          dayLabel={newDay ? chatDayLabel(day) : undefined}
          showName={showName}
          content={item.content}
          senderNickname={item.senderNickname}
          createdAt={item.createdAt}
          unreadCount={item.unreadCount}
          status={item.status}
          clientMessageId={item.clientMessageId}
          onRetrySend={onRetrySend}
        />
      );
    },
    [data, myUserId, onRetrySend],
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
        <Pressable onPress={onRetryLoad} accessibilityRole="button" style={styles.retry}>
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
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: t.surface,
              borderTopColor: t.border,
              // 안드로이드 keyboardDidShow 높이는 ime − 시스템 바다(ReactRootView). 엣지투엣지에선
              // 키보드가 내비바 자리까지 덮으니 하단 인셋을 그대로 두고 그 위에 더한다 — 빼면
              // 내비바 높이만큼 입력칸이 키보드 밑에 깔린다(2026-10-04 갤럭시 제보).
              paddingBottom: insets.bottom + androidKeyboard + Spacing.two,
            },
          ]}>
          <View style={[styles.inputInner, column]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={tr('house.chat.placeholder')}
              placeholderTextColor={t.textMuted}
              accessibilityLabel={tr('house.chat.inputA11y')}
              multiline
              maxLength={CHAT_MAX_LENGTH}
              style={[
                styles.input,
                Typography.body,
                emph('normal'),
                { color: t.text, backgroundColor: t.surfaceMuted },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={tr('house.chat.send')}
              accessibilityState={{ disabled: !canSend }}
              style={[styles.sendBtn, { backgroundColor: canSend ? t.primary : t.surfaceMuted }]}>
              <Icon name="send" size={20} color={canSend ? t.onPrimary : t.textMuted} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <ScreenHeader title={houseName ?? tr('house.chat.title')} onBack={onBack} />
    </View>
  );
}

/** 입력칸이 여러 줄로 늘어나도 목록을 다 먹지 않는 높이 — 본문 약 5줄. */
const INPUT_MAX_HEIGHT = 132;
const SEND_SIZE = 44;

type ChatRowProps = {
  mine: boolean;
  /** 이 메시지가 그날의 첫 메시지면 위에 그릴 날짜 구분선 문구. */
  dayLabel?: string;
  showName: boolean;
  content: string;
  senderNickname?: string;
  createdAt?: string;
  unreadCount: number;
  status: ChatMessageView['status'];
  clientMessageId?: string;
  onRetrySend?: (clientMessageId: string) => void;
};

const ChatRow = memo(function ChatRow({
  mine,
  dayLabel,
  showName,
  content,
  senderNickname,
  createdAt,
  unreadCount,
  status,
  clientMessageId,
  onRetrySend,
}: ChatRowProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const time = timeLabel(createdAt);
  const meta =
    status === 'pending' ? (
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('house.chat.sending')}
      </Text>
    ) : status === 'failed' ? (
      <Pressable
        onPress={() => clientMessageId && onRetrySend?.(clientMessageId)}
        accessibilityRole="button"
        accessibilityLabel={tr('house.chat.retryA11y')}
        hitSlop={Spacing.two}>
        <Text style={[Typography.supporting, emph('semibold'), { color: t.dangerText }]}>
          {tr('house.chat.failed')}
        </Text>
      </Pressable>
    ) : (
      <View style={[styles.meta, mine ? styles.metaMine : null]}>
        {unreadCount > 0 ? (
          <Text
            style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}
            accessibilityLabel={tr('house.chat.unreadA11y', { n: unreadCount })}>
            {unreadCount}
          </Text>
        ) : null}
        {time ? <Text style={[Typography.supporting, { color: t.textMuted }]}>{time}</Text> : null}
      </View>
    );
  const row = (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
      {showName ? (
        <Text
          style={[Typography.supporting, emph('semibold'), { color: t.textMuted }]}
          numberOfLines={1}>
          {senderNickname || tr('house.chat.unknownSender')}
        </Text>
      ) : null}
      <View style={[styles.line, mine ? styles.lineMine : null]}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: t.primary }
              : { backgroundColor: t.surface, borderColor: t.border },
            mine ? null : styles.bubbleOther,
            status === 'pending' ? styles.pending : null,
          ]}>
          <Text
            style={[Typography.body, emph('normal'), { color: mine ? t.onPrimary : t.text }]}
            selectable>
            {content}
          </Text>
        </View>
        {meta}
      </View>
    </View>
  );
  if (!dayLabel) return row;
  // 뒤집힌 목록도 셀 안의 순서는 그대로라 구분선이 말풍선 위에 온다.
  return (
    <View>
      <View style={styles.dayDivider} accessibilityRole="header">
        <View style={[styles.dayRule, { backgroundColor: t.border }]} />
        <Text style={[Typography.supporting, emph('normal'), { color: t.textMuted }]}>
          {dayLabel}
        </Text>
        <View style={[styles.dayRule, { backgroundColor: t.border }]} />
      </View>
      {row}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two },
  listContent: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  older: { paddingVertical: Spacing.two },
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
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    flexShrink: 1,
  },
  bubbleOther: { borderWidth: StyleSheet.hairlineWidth },
  pending: { opacity: 0.6 },
  inputRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: SEND_SIZE,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sendBtn: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
