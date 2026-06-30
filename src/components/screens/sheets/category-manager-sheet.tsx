import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CATEGORY_COLORS,
  type CategoryVisibility,
  type RoutineCategoryMeta,
  VISIBILITY_LABELS,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

const EMOJI_CHOICES = [
  '🗓️',
  '📚',
  '🎨',
  '💪',
  '✨',
  '☀️',
  '🌙',
  '💧',
  '🏃',
  '💖',
  '☕',
  '🎵',
  '🍳',
  '🧘',
  '💼',
  '🌱',
];

const VISIBILITY_OPTIONS: { id: CategoryVisibility; icon: string; desc: string }[] = [
  { id: 'public', icon: '🌐', desc: '누구나 볼 수 있어요' },
  { id: 'neighbor', icon: '👥', desc: '이웃에게만 보여요' },
  { id: 'partial', icon: '🔒', desc: '선택한 사람에게만' },
];

export type CategoryManagerSheetProps = {
  visible: boolean;
  categories: RoutineCategoryMeta[];
  onCreate: (category: RoutineCategoryMeta) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/**
 * "카테고리 관리" bottom sheet, ported from the prototype `CategoryManagerModal`:
 * create a category (name + emoji + visibility) and delete existing ones. Pure
 * JS; rendered as an inline overlay (not a wrapper's children) so its controls
 * stay interactive in tests.
 */
export function CategoryManagerSheet({
  visible,
  categories,
  onCreate,
  onDelete,
  onClose,
}: CategoryManagerSheetProps) {
  const t = useTokens();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [visibility, setVisibility] = useState<CategoryVisibility>('public');

  if (!visible) return null;

  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onCreate({
      id: `cat-${Date.now()}`,
      label: name.trim(),
      emoji,
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      visibility,
    });
    setName('');
    setEmoji(EMOJI_CHOICES[0]);
    setVisibility('public');
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.screen }]}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[Typography.h3, { color: t.text }]}>카테고리 관리</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={[styles.close, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="close" size={16} color={t.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <Text style={[Typography.label, { color: t.text }]}>새 카테고리 만들기</Text>

            <View style={[styles.nameRow, { backgroundColor: t.surfaceMuted }]}>
              <Text style={styles.nameEmoji}>{emoji}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="예) 자기계발"
                placeholderTextColor={t.textMuted}
                style={[styles.flex, styles.nameInput, { color: t.text }]}
              />
            </View>

            <Text style={[Typography.supporting, { color: t.textMuted }]}>이모지</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_CHOICES.map((e) => {
                const active = emoji === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setEmoji(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`이모지 ${e}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.emojiCell,
                      { backgroundColor: active ? `${t.primary}22` : t.surfaceMuted },
                      active && { borderColor: t.primary, borderWidth: 2 },
                    ]}>
                    <Text style={styles.emojiGlyph}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[Typography.supporting, { color: t.textMuted }]}>공개 설정</Text>
            <View style={styles.segment}>
              {VISIBILITY_OPTIONS.map((v) => {
                const active = visibility === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setVisibility(v.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={VISIBILITY_LABELS[v.id]}
                    style={[
                      styles.segItem,
                      { backgroundColor: active ? t.primary : t.surfaceMuted },
                    ]}>
                    <Text style={styles.segIcon}>{v.icon}</Text>
                    <Text
                      style={[
                        Typography.supporting,
                        styles.segLabel,
                        { color: active ? t.onPrimary : t.textMuted },
                      ]}>
                      {VISIBILITY_LABELS[v.id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[Typography.supporting, styles.segDesc, { color: t.textMuted }]}>
              {VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.desc}
            </Text>

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="카테고리 추가"
              style={[styles.submit, { backgroundColor: canSubmit ? t.primary : t.textDisabled }]}>
              <Icon name="add" size={18} color={t.onPrimary} />
              <Text style={[Typography.label, { color: t.onPrimary }]}>카테고리 추가</Text>
            </Pressable>
          </View>

          <Text style={[Typography.label, styles.listTitle, { color: t.text }]}>
            내 카테고리 ({categories.length})
          </Text>
          <View style={styles.catList}>
            {categories.map((c) => (
              <View
                key={c.id}
                style={[styles.catRow, { backgroundColor: t.surface, borderLeftColor: c.color }]}>
                <View style={[styles.catDot, { backgroundColor: `${c.color}33` }]}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[Typography.body, { color: t.text }]}>{c.label}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {VISIBILITY_LABELS[c.visibility]}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onDelete(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} 삭제`}
                  style={[styles.del, { backgroundColor: `${t.danger}22` }]}>
                  <Icon name="trash" size={16} color={t.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '88%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 16 },
  body: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  nameEmoji: { fontSize: 20 },
  nameInput: { fontSize: 16, paddingVertical: Spacing.three },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiGlyph: { fontSize: 18 },
  segment: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  segIcon: { fontSize: 18 },
  segLabel: { fontWeight: '600' },
  segDesc: { textAlign: 'center' },
  submit: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  listTitle: { marginTop: Spacing.one },
  catList: { gap: Spacing.two },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    padding: Spacing.three,
  },
  catDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: { fontSize: 16 },
  del: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
