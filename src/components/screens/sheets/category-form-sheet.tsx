import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Pictogram, type PictogramName } from '@/components/ui/pictograms';
import {
  CATEGORY_COLORS,
  type CategoryVisibility,
  type RoutineCategoryMeta,
  VISIBILITY_ICONS,
  visibilityLabelKey,
} from '@/constants/routines';
import { Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

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
const VISIBILITY_OPTIONS: CategoryVisibility[] = ['public', 'neighbor', 'partial', 'private'];

export type CategoryFormSheetProps = {
  visible: boolean;
  /** 수정 대상 — 없으면 생성 모드. 열릴 때 폼이 이 값으로 프리필된다. */
  editing?: RoutineCategoryMeta | null;
  /** 생성 기본색 자동 배정(생성 순서 순환)용 현재 카테고리 수. */
  categoryCount?: number;
  onCreate?: (category: RoutineCategoryMeta) => void;
  onUpdate?: (id: string, category: RoutineCategoryMeta) => void;
  onClose: () => void;
};

/**
 * 카테고리 생성/수정 바텀시트 (#394) — 이름·아이콘·색상·공개 설정 폼만 담는다.
 * 목록 관리(순서·삭제)는 CategoryManageScreen 몫. 카테고리 관리 화면의 `+`와
 * 루틴 추가 화면의 빠른 생성이 같은 시트를 쓴다. Pure JS; rendered as an
 * inline overlay so its controls stay interactive in tests.
 */
export function CategoryFormSheet({
  visible,
  editing = null,
  categoryCount = 0,
  onCreate,
  onUpdate,
  onClose,
}: CategoryFormSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 새 카테고리의 기본 색 — 기존 자동 배정(생성 순서 순환)과 같은 색에서 시작.
  const autoColor = CATEGORY_COLORS[categoryCount % CATEGORY_COLORS.length];
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<PictogramName>(ICON_CHOICES[0]);
  const [color, setColor] = useState(autoColor);
  const [visibility, setVisibility] = useState<CategoryVisibility>('public');

  // 열릴 때마다 모드에 맞게 리셋 — 수정이면 프리필, 생성이면 빈 폼.
  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setIcon(editing?.icon ?? ICON_CHOICES[0]);
    setColor(editing?.color ?? autoColor);
    setVisibility(editing?.visibility ?? 'public');
  }, [visible, editing, autoColor]);

  const canSubmit = name.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    if (editing) {
      onUpdate?.(editing.id, { ...editing, name: name.trim(), icon, color, visibility });
    } else {
      onCreate?.({ id: `cat-${Date.now()}`, name: name.trim(), icon, color, visibility });
    }
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Text style={[Typography.h3, { color: t.text }]}>
          {editing
            ? tr('routineTodo.categoryForm.editTitle', { name: editing.name })
            : tr('routineTodo.categoryForm.newTitle')}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('routineTodo.categoryForm.close')}
          style={[styles.close, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="close" size={16} color={t.text} />
        </Pressable>
      </View>

      {/* 세로 스크롤 본문 — 시트 끌어내리기에서 제외 (#1132). 닫기는 손잡이·헤더에서. */}
      <SheetDragExclude>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.nameRow, { backgroundColor: t.surface }]}>
            <CategoryIcon name={icon} color={color} size={20} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tr('routineTodo.categoryForm.namePlaceholder')}
              placeholderTextColor={t.textMuted}
              style={[styles.flex, styles.nameInput, emph('normal'), { color: t.text }]}
            />
          </View>

          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('routineTodo.categoryForm.icon')}
          </Text>
          <View style={styles.emojiGrid}>
            {ICON_CHOICES.map((e) => {
              const active = icon === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => setIcon(e)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('routineTodo.categoryForm.iconA11y', { icon: e })}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.emojiCell,
                    { backgroundColor: active ? t.primarySoft : t.surfaceMuted },
                    active && { borderColor: t.primary, borderWidth: 2 },
                  ]}>
                  <CategoryIcon name={e} color={color} size={18} />
                </Pressable>
              );
            })}
          </View>

          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('routineTodo.categoryForm.color')}
          </Text>
          <View style={styles.colorRow}>
            {CATEGORY_COLORS.map((c) => {
              const active = color === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('routineTodo.categoryForm.colorA11y', { color: c })}
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

          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('routineTodo.categoryForm.visibility')}
          </Text>
          <View style={styles.segment}>
            {VISIBILITY_OPTIONS.map((v) => {
              const active = visibility === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tr(visibilityLabelKey(v))}
                  style={[
                    styles.segItem,
                    { backgroundColor: active ? t.primary : t.surfaceMuted },
                  ]}>
                  <Pictogram
                    name={VISIBILITY_ICONS[v]}
                    size={18}
                    color={active ? t.onPrimary : undefined}
                  />
                  <Text
                    style={[
                      Typography.supporting,
                      emph('semibold'),
                      { color: active ? t.onPrimary : t.textMuted },
                    ]}>
                    {tr(visibilityLabelKey(v))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[Typography.supporting, styles.segDesc, { color: t.textMuted }]}>
            {tr(`routineTodo.categoryForm.visibilityDesc.${visibility}`)}
          </Text>
        </ScrollView>
      </SheetDragExclude>

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={
            editing
              ? tr('routineTodo.categoryForm.saveA11y')
              : tr('routineTodo.categoryForm.create')
          }
          style={[styles.submit, { backgroundColor: canSubmit ? t.primary : t.textDisabled }]}>
          <Icon name={editing ? 'check' : 'add'} size={18} color={t.onPrimary} />
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {editing ? tr('routineTodo.categoryForm.save') : tr('routineTodo.categoryForm.create')}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
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
  nameInput: { fontSize: 18, paddingVertical: Spacing.three },
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
    borderRadius: Radius.lg,
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
  segDesc: { textAlign: 'center' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderTopWidth: 1,
  },
  submit: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
