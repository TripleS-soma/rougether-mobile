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
  /** Save edits to an existing category (name/emoji/visibility). */
  onUpdate?: (id: string, category: RoutineCategoryMeta) => void;
  onDelete: (id: string) => void;
  /** Persist a new category order (ids top→bottom; long-press a row to move). */
  onReorder?: (orderedIds: string[]) => void;
  onClose: () => void;
};

/**
 * "카테고리 관리" bottom sheet, ported from the prototype `CategoryManagerModal`:
 * create a category (name + emoji + visibility) and delete existing ones (with a
 * confirmation modal). Pure
 * JS; rendered as an inline overlay (not a wrapper's children) so its controls
 * stay interactive in tests.
 */
export function CategoryManagerSheet({
  visible,
  categories,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onClose,
}: CategoryManagerSheetProps) {
  const t = useTokens();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [visibility, setVisibility] = useState<CategoryVisibility>('public');
  const [pendingDelete, setPendingDelete] = useState<RoutineCategoryMeta | null>(null);
  // When set, the form edits this category instead of creating a new one.
  const [editing, setEditing] = useState<RoutineCategoryMeta | null>(null);
  // Long-pressed row in move mode: its edit/delete buttons become ▲▼.
  const [movingId, setMovingId] = useState<string | null>(null);

  if (!visible) return null;

  const moveCategory = (id: string, dir: -1 | 1) => {
    const from = categories.findIndex((c) => c.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorder?.(ids);
  };

  const canSubmit = name.trim().length > 0;

  const resetForm = () => {
    setEditing(null);
    setName('');
    setEmoji(EMOJI_CHOICES[0]);
    setVisibility('public');
  };

  const startEdit = (c: RoutineCategoryMeta) => {
    setEditing(c);
    setName(c.label);
    setEmoji(c.emoji);
    setVisibility(c.visibility);
  };

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      onUpdate?.(editing.id, { ...editing, label: name.trim(), emoji, visibility });
    } else {
      onCreate({
        id: `cat-${Date.now()}`,
        label: name.trim(),
        emoji,
        color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        visibility,
      });
    }
    resetForm();
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
            <Text style={[Typography.label, { color: t.text }]}>
              {editing ? `'${editing.label}' 수정하기` : '새 카테고리 만들기'}
            </Text>

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
              accessibilityLabel={editing ? '카테고리 저장' : '카테고리 추가'}
              style={[styles.submit, { backgroundColor: canSubmit ? t.primary : t.textDisabled }]}>
              <Icon name={editing ? 'check' : 'add'} size={18} color={t.onPrimary} />
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {editing ? '저장하기' : '카테고리 추가'}
              </Text>
            </Pressable>
            {editing ? (
              <Pressable
                onPress={resetForm}
                accessibilityRole="button"
                accessibilityLabel="수정 취소"
                style={styles.cancelEdit}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>수정 취소</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[Typography.label, styles.listTitle, { color: t.text }]}>
            내 카테고리 ({categories.length})
          </Text>
          {onReorder ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              카테고리를 꾹 누르면 순서를 바꿀 수 있어요.
            </Text>
          ) : null}
          <View style={styles.catList}>
            {categories.map((c, idx) => {
              const moving = movingId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onLongPress={onReorder ? () => setMovingId(moving ? null : c.id) : undefined}
                  accessibilityLabel={`${c.label} 카테고리`}
                  accessibilityHint={onReorder ? '꾹 누르면 순서 이동 모드가 켜져요' : undefined}
                  style={[
                    styles.catRow,
                    { backgroundColor: t.surface, borderLeftColor: c.color },
                    moving && { borderWidth: 2, borderColor: t.primary, borderLeftWidth: 4 },
                  ]}>
                  <View style={[styles.catDot, { backgroundColor: `${c.color}33` }]}>
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[Typography.body, { color: t.text }]}>{c.label}</Text>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {moving
                        ? '순서 이동 중 — 완료를 누르면 끝나요'
                        : VISIBILITY_LABELS[c.visibility]}
                    </Text>
                  </View>
                  {moving ? (
                    <>
                      <Pressable
                        onPress={() => moveCategory(c.id, -1)}
                        disabled={idx === 0}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} 위로 이동`}
                        style={[
                          styles.del,
                          { backgroundColor: idx === 0 ? t.surfaceMuted : `${t.primary}22` },
                        ]}>
                        <Text
                          style={[
                            styles.moveGlyph,
                            { color: idx === 0 ? t.textDisabled : t.primary },
                          ]}>
                          ▲
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => moveCategory(c.id, 1)}
                        disabled={idx === categories.length - 1}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} 아래로 이동`}
                        style={[
                          styles.del,
                          {
                            backgroundColor:
                              idx === categories.length - 1 ? t.surfaceMuted : `${t.primary}22`,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.moveGlyph,
                            { color: idx === categories.length - 1 ? t.textDisabled : t.primary },
                          ]}>
                          ▼
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setMovingId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="순서 이동 완료"
                        style={[styles.del, { backgroundColor: t.primary }]}>
                        <Icon name="check" size={16} color={t.onPrimary} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => startEdit(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} 수정`}
                        style={[styles.del, { backgroundColor: t.surfaceMuted }]}>
                        <Icon name="edit" size={16} color={t.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingDelete(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} 삭제`}
                        style={[styles.del, { backgroundColor: `${t.danger}22` }]}>
                        <Icon name="trash" size={16} color={t.danger} />
                      </Pressable>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {pendingDelete ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setPendingDelete(null)} />
          <View style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>카테고리 삭제</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              &lsquo;{pendingDelete.label}&rsquo; 카테고리를 삭제할까요?{'\n'}이 카테고리의
              루틴·투두는 &lsquo;기타&rsquo;로 이동해요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setPendingDelete(null)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onDelete(pendingDelete.id);
                  setPendingDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="삭제"
                style={[styles.confirmBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
  cancelEdit: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
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
  moveGlyph: { fontSize: 14, fontWeight: '700' },
  del: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    elevation: 200,
  },
  confirmCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmText: {
    lineHeight: 22,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
