import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CATEGORY_COLORS,
  type CategoryVisibility,
  type RoutineCategoryMeta,
  VISIBILITY_ICONS,
  VISIBILITY_LABELS,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

const ICON_CHOICES: PictogramName[] = [
  'calendar',
  'book',
  'palette',
  'dumbbell',
  'sparkle',
  'sun',
  'moon',
  'water',
  'run',
  'heart',
  'coffee',
  'music',
  'cooking',
  'meditation',
  'briefcase',
  'sprout',
];

// Icons come from the shared VISIBILITY_ICONS so the 나의 방 headers (#285)
// and this picker always show the same mark per scope.
const VISIBILITY_OPTIONS: { id: CategoryVisibility; desc: string }[] = [
  { id: 'public', desc: '누구나 볼 수 있어요' },
  { id: 'neighbor', desc: '이웃에게만 보여요' },
  { id: 'partial', desc: '선택한 사람에게만' },
  { id: 'private', desc: '나만 볼 수 있어요' },
];

export type CategoryManagerSheetProps = {
  visible: boolean;
  categories: RoutineCategoryMeta[];
  onCreate: (category: RoutineCategoryMeta) => void;
  /** Save edits to an existing category (name/icon/color/visibility). */
  onUpdate?: (id: string, category: RoutineCategoryMeta) => void;
  onDelete: (id: string) => void;
  /** Persist a new category order (ids top→bottom; long-press a row to move). */
  onReorder?: (orderedIds: string[]) => void;
  /**
   * Categories that still have routines/todos — the server refuses to delete
   * them, so 삭제 shows a warning modal instead of the delete confirm.
   */
  inUseCategoryIds?: string[];
  onClose: () => void;
};

/**
 * "카테고리 관리" bottom sheet, ported from the prototype `CategoryManagerModal`:
 * create a category (name + icon + color + visibility) and delete existing ones (with a
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
  inUseCategoryIds = [],
  onClose,
}: CategoryManagerSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 새 카테고리의 기본 색 — 기존 자동 배정(생성 순서 순환)과 같은 색에서 시작.
  const autoColor = () => CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<PictogramName>(ICON_CHOICES[0]);
  const [color, setColor] = useState(autoColor());
  const [visibility, setVisibility] = useState<CategoryVisibility>('public');
  const [pendingDelete, setPendingDelete] = useState<RoutineCategoryMeta | null>(null);
  // Delete tapped on a category that still has routines — warning only.
  const [blockedDelete, setBlockedDelete] = useState<RoutineCategoryMeta | null>(null);
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
    setIcon(ICON_CHOICES[0]);
    setColor(autoColor());
    setVisibility('public');
  };

  const startEdit = (c: RoutineCategoryMeta) => {
    setEditing(c);
    setName(c.label);
    setIcon(c.icon);
    setColor(c.color);
    setVisibility(c.visibility);
  };

  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      onUpdate?.(editing.id, { ...editing, label: name.trim(), icon, color, visibility });
    } else {
      onCreate({
        id: `cat-${Date.now()}`,
        label: name.trim(),
        icon,
        color,
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
              <Pictogram name={icon} size={20} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="예) 자기계발"
                placeholderTextColor={t.textMuted}
                style={[styles.flex, styles.nameInput, { color: t.text }]}
              />
            </View>

            <Text style={[Typography.supporting, { color: t.textMuted }]}>아이콘</Text>
            <View style={styles.emojiGrid}>
              {ICON_CHOICES.map((e) => {
                const active = icon === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setIcon(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`아이콘 ${e}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.emojiCell,
                      { backgroundColor: active ? t.primarySoft : t.surfaceMuted },
                      active && { borderColor: t.primary, borderWidth: 2 },
                    ]}>
                    <Pictogram name={e} size={18} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[Typography.supporting, { color: t.textMuted }]}>색상</Text>
            <View style={styles.colorRow}>
              {CATEGORY_COLORS.map((c) => {
                const active = color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`색상 ${c}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.colorCell,
                      { backgroundColor: c },
                      active && [styles.colorCellActive, { borderColor: t.text }],
                    ]}>
                    {active ? <Icon name="check" size={14} color={StaticWhite} /> : null}
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
                    <Pictogram
                      name={VISIBILITY_ICONS[v.id]}
                      size={18}
                      color={active ? t.onPrimary : undefined}
                    />
                    <Text
                      style={[
                        Typography.supporting,
                        styles.segLabel,
                        emph('semibold'),
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
                    <Pictogram name={c.icon} size={16} />
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
                          { backgroundColor: idx === 0 ? t.surfaceMuted : t.primarySoft },
                        ]}>
                        <Text
                          style={[
                            styles.moveGlyph,
                            emph('bold'),
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
                              idx === categories.length - 1 ? t.surfaceMuted : t.primarySoft,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.moveGlyph,
                            emph('bold'),
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
                        onPress={() =>
                          inUseCategoryIds.includes(c.id)
                            ? setBlockedDelete(c)
                            : setPendingDelete(c)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} 삭제`}
                        style={[styles.del, { backgroundColor: t.dangerSoft }]}>
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

      {blockedDelete ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setBlockedDelete(null)} />
          <View style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>삭제할 수 없어요</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              &lsquo;{blockedDelete.label}&rsquo; 카테고리에 아직 루틴이 있어요.{'\n'}안의 루틴을
              삭제하거나 다른 카테고리로 옮긴 뒤 삭제할 수 있어요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setBlockedDelete(null)}
                accessibilityRole="button"
                accessibilityLabel="삭제 불가 확인"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>확인</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {pendingDelete ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setPendingDelete(null)} />
          <View style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>카테고리 삭제</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              &lsquo;{pendingDelete.label}&rsquo; 카테고리를 삭제할까요?{'\n'}삭제해도 지난 기록은
              달력에서 원래 카테고리로 보여요.
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
    backgroundColor: Overlay.dim,
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
  nameInput: { fontSize: 16, paddingVertical: Spacing.three },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 고정폭 셀의 wrap 그리드 — 가운데 정렬로 좌우 여백을 같게 (#388).
    justifyContent: 'center',
    gap: Spacing.two,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  colorCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCellActive: {
    borderWidth: 2.5,
  },
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
  moveGlyph: { fontSize: 14 },
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
