import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatReactionType } from '@/api/chat-types';
import { type MenuAnchor, MENU_GAP, placeMenu } from '@/components/chat/chat-menu-placement';
import { CHAT_REACTIONS } from '@/components/chat/chat-reactions';
import { Icon, type IconName } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 메뉴 폭과 줄 높이 — 카카오톡 길게 누르기 메뉴의 치수. 자리 계산에 쓰려고 고정한다. */
const MENU_WIDTH = 260;
const REACTION_BAR_HEIGHT = 48;
const REACTION_HIT = 36;
const GLYPH_SIZE = 26;
const ACTION_HEIGHT = 44;
const ACTION_ICON = 20;

export type ChatMessageMenuProps = {
  visible: boolean;
  /** 길게 누른 말풍선의 화면 자리 — 메뉴를 그 옆에 붙인다. 모르면 화면 가운데. */
  anchor?: MenuAnchor;
  /** 내 메시지인지 — 메뉴를 말풍선의 오른쪽 끝에 맞출지 왼쪽 끝에 맞출지. */
  mine?: boolean;
  /** 내가 이미 남긴 공감 — 그 칸을 강조하고, 다시 누르면 취소한다. */
  myReaction?: ChatReactionType;
  /** 공감 고르기 — 이미 고른 유형을 다시 누르면 null(취소)로 부른다. 없으면 공감 줄을 숨긴다. */
  onReact?: (type: ChatReactionType | null) => void;
  /** 글 복사 — 복사할 글이 없는 메시지(사진만, 이모티콘)는 주지 않는다. */
  onCopy?: () => void;
  /** 글을 다른 앱으로 공유 — 글이 없는 메시지와 공유 시트가 없는 환경은 주지 않는다. */
  onShare?: () => void;
  /** 신고 — 내 메시지에는 주지 않는다. */
  onReport?: () => void;
  onClose: () => void;
};

type Action = { key: string; icon: IconName; label: string; onPress: () => void; danger?: boolean };

/**
 * 말풍선을 길게 눌러 여는 메뉴 (카카오톡식) — 누른 말풍선 바로 옆에 뜬다. 위에 공감 여섯 개가
 * 든 둥근 줄, 그 아래 이름은 왼쪽·아이콘은 오른쪽인 목록(복사·공유·신고). 종전에는 남의
 * 말풍선마다 "신고" 글자가 늘 떠 있어 대화가 지저분했다(2026-11-13 제보). 고르면 바로 닫힌다.
 */
export function ChatMessageMenu({
  visible,
  anchor,
  mine = false,
  myReaction,
  onReact,
  onCopy,
  onShare,
  onReport,
  onClose,
}: ChatMessageMenuProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const actions: Action[] = [
    ...(onCopy
      ? [{ key: 'copy', icon: 'copy' as const, label: tr('house.chat.copy'), onPress: onCopy }]
      : []),
    ...(onShare
      ? [{ key: 'share', icon: 'share' as const, label: tr('house.chat.share'), onPress: onShare }]
      : []),
    ...(onReport
      ? [
          {
            key: 'report',
            icon: 'flag' as const,
            label: tr('house.chat.reportMessage'),
            onPress: onReport,
            danger: true,
          },
        ]
      : []),
  ];
  // 높이를 미리 알아야 말풍선 아래에 둘지 위에 둘지 정할 수 있다 — 줄 높이를 고정해 계산한다.
  const height =
    (onReact ? REACTION_BAR_HEIGHT : 0) +
    (onReact && actions.length ? MENU_GAP : 0) +
    actions.length * ACTION_HEIGHT +
    Math.max(0, actions.length - 1) * StyleSheet.hairlineWidth;
  const position = placeMenu(anchor, { width: MENU_WIDTH, height }, window, insets, mine);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: Overlay.subtle }]}>
        {/* 바깥을 누르면 닫힌다 — 메뉴를 감싸지 않고 뒤에 깔아, 버튼 안에 버튼이 들어가지 않게 한다. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('house.chat.menuClose')}
        />
        <View style={[styles.menu, position]} testID="chat-message-menu">
          {onReact ? (
            <View
              style={[styles.reactions, { backgroundColor: t.surface }]}
              accessibilityRole="menu"
              accessibilityLabel={tr('house.chat.reactionsA11y')}>
              {CHAT_REACTIONS.map(({ type, glyph, labelKey }) => {
                const selected = myReaction === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      onClose();
                      onReact(selected ? null : type);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={tr('house.chat.reactA11y', { label: tr(labelKey) })}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.reaction,
                      selected && { backgroundColor: t.surfaceMuted },
                      pressed && pressedStyle('dim', t),
                    ]}>
                    <Text style={[styles.glyph, emph('normal')]}>{glyph}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {actions.length ? (
            <View style={[styles.actions, { backgroundColor: t.surface }]}>
              {actions.map((action, index) => {
                const color = action.danger ? t.dangerText : t.text;
                return (
                  <View key={action.key}>
                    {index > 0 ? (
                      <View style={[styles.rule, { backgroundColor: t.border }]} />
                    ) : null}
                    <Pressable
                      onPress={() => {
                        onClose();
                        action.onPress();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      style={({ pressed }) => [styles.action, pressed && pressedStyle('dim', t)]}>
                      <Text style={[Typography.body, emph('normal'), { color }]}>
                        {action.label}
                      </Text>
                      <Icon name={action.icon} size={ACTION_ICON} color={color} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  menu: { position: 'absolute', width: MENU_WIDTH, gap: MENU_GAP },
  reactions: {
    height: REACTION_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  reaction: {
    width: REACTION_HIT,
    height: REACTION_HIT,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: GLYPH_SIZE },
  actions: { borderRadius: Radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  action: {
    height: ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  rule: { height: StyleSheet.hairlineWidth },
});
