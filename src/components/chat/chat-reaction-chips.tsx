import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatReaction, ChatReactionType } from '@/api/chat-types';
import { chatReactionMeta } from '@/components/chat/chat-reactions';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const GLYPH_SIZE = 12;

/**
 * 말풍선 아래 공감 묶음 — 유형별 글리프와 사람 수. 내가 누른 유형은 강조하고, 칩을 누르면
 * 그 유형으로 공감하거나(내 것이면) 취소한다.
 */
export function ChatReactionChips({
  reactions,
  myUserId,
  onReact,
}: {
  reactions?: ChatReaction[];
  myUserId?: number;
  onReact?: (type: ChatReactionType | null) => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const shown = (reactions ?? []).filter((reaction) => reaction.userIds.length > 0);
  if (shown.length === 0) return null;
  return (
    <View style={styles.row}>
      {shown.map(({ type, userIds }) => {
        const meta = chatReactionMeta(type);
        if (!meta) return null;
        const mine = myUserId != null && userIds.includes(myUserId);
        return (
          <Pressable
            key={type}
            disabled={!onReact}
            onPress={() => onReact?.(mine ? null : type)}
            accessibilityRole="button"
            accessibilityLabel={tr('house.chat.reactionChipA11y', {
              label: tr(meta.labelKey),
              n: userIds.length,
            })}
            accessibilityState={{ selected: mine }}
            hitSlop={Spacing.one}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: t.surface, borderColor: mine ? t.primary : t.border },
              pressed && pressedStyle('dim', t),
            ]}>
            <Text style={[styles.glyph, emph('normal')]}>{meta.glyph}</Text>
            <Text
              style={[
                Typography.caption,
                emph(mine ? 'semibold' : 'normal'),
                { color: mine ? t.primaryText : t.textMuted },
              ]}>
              {userIds.length}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  glyph: { fontSize: GLYPH_SIZE },
});
