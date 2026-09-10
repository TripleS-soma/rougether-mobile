import { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Calendar } from '@/components/ui/calendar';
import { CategoryIcon } from '@/components/ui/category-icon';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { type RoutineCategoryMeta, VISIBILITY_LABELS } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { localDate, monthDayLabel } from '@/utils/datetime';

export type TodoComposeSheetProps = {
  visible: boolean;
  initialDate: string;
  today: string;
  /** Active personal categories only; linked house categories cannot receive quick todos. */
  categories: RoutineCategoryMeta[];
  onSubmit: (
    category: string,
    title: string,
    date: string,
  ) => boolean | void | Promise<boolean | void>;
  onAddRoutine?: (date: string) => void;
  onClose: () => void;
};

/** Capture a title first. Date/category pickers stay in this sheet so drafts survive. */
export function TodoComposeSheet({
  visible,
  initialDate,
  today,
  categories,
  onSubmit,
  onAddRoutine,
  onClose,
}: TodoComposeSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const insets = useContext(SafeAreaInsetsContext);
  const input = useRef<TextInput>(null);
  const savingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [categoryId, setCategoryId] = useState('');
  const [panel, setPanel] = useState<'date' | 'category' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDate(initialDate);
    setCategoryId('');
    setPanel(null);
    setError(false);
  }, [visible, initialDate]);

  const category = categories.find((item) => item.id === categoryId);
  const canSubmit = !!title.trim() && !saving && (!categoryId || !!category);
  const close = () => {
    if (savingRef.current) return;
    Keyboard.dismiss();
    onClose();
  };
  const submit = async () => {
    if (!canSubmit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      const result = await onSubmit(categoryId, title.trim(), date);
      if (result === false) setError(true);
      else {
        Keyboard.dismiss();
        onClose();
      }
    } catch {
      setError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const togglePanel = (next: 'date' | 'category') => {
    Keyboard.dismiss();
    setPanel((current) => (current === next ? null : next));
  };

  return (
    <BottomSheet
      visible={visible}
      avoidKeyboard
      dragEnabled={!saving}
      dragScope="header"
      onClose={close}
      cardStyle={styles.sheet}>
      <GlassSurface
        fallbackColor={t.screen}
        tintColor={t.screen}
        interactive={false}
        style={styles.glass}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            disabled={saving}
            accessibilityRole="button"
            hitSlop={Spacing.two}>
            <Text style={[Typography.label, { color: t.textMuted }]}>취소</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={[Typography.label, emph('bold'), { color: t.text }]}>
            새 할 일
          </Text>
          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="할 일 저장"
            accessibilityState={{ disabled: !canSubmit, busy: saving }}
            hitSlop={Spacing.two}>
            <Text
              style={[
                Typography.label,
                emph('bold'),
                { color: canSubmit ? t.primaryText : t.textDisabled },
              ]}>
              {saving ? '저장 중' : '추가'}
            </Text>
          </Pressable>
        </View>
        <SheetDragExclude>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.body,
              { paddingBottom: Math.max(insets?.bottom ?? 0, Spacing.four) },
            ]}>
            <TextInput
              ref={input}
              autoFocus
              accessibilityLabel="할 일 제목"
              placeholder="할 일"
              placeholderTextColor={t.textMuted}
              value={title}
              onChangeText={setTitle}
              editable={!saving}
              maxLength={160}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={[Typography.h3, styles.input, { color: t.text }]}
            />
            <View style={styles.options}>
              <Pressable
                onPress={() => togglePanel('date')}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="할 일 날짜 선택"
                accessibilityState={{ expanded: panel === 'date' }}
                style={[styles.chip, { backgroundColor: t.surfaceMuted }]}>
                <Icon name="calendar" size={16} color={t.textMuted} />
                <Text style={[Typography.supporting, { color: t.text }]}>
                  {date === today ? '오늘' : monthDayLabel(localDate(date))}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => togglePanel('category')}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`카테고리 선택, ${category?.name ?? '미분류'}`}
                accessibilityState={{ expanded: panel === 'category' }}
                style={[styles.chip, { backgroundColor: t.surfaceMuted }]}>
                {category ? (
                  <CategoryIcon name={category.icon} color={category.color} size={16} />
                ) : (
                  <Icon name="add" size={16} color={t.textMuted} />
                )}
                <Text
                  numberOfLines={1}
                  style={[Typography.supporting, styles.categoryName, { color: t.textMuted }]}>
                  {category?.name ?? '카테고리'}
                </Text>
              </Pressable>
            </View>
            {panel === 'date' ? (
              <Calendar
                value={date}
                onSelect={(next) => {
                  setDate(next);
                  setPanel(null);
                  input.current?.focus();
                }}
              />
            ) : null}
            {panel === 'category' ? (
              <View style={styles.categoryList}>
                {[{ id: '', name: '미분류' }, ...categories.filter((item) => !!item.id)].map(
                  (item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="radio"
                      accessibilityLabel={item.name}
                      accessibilityState={{ checked: categoryId === item.id }}
                      onPress={() => {
                        setCategoryId(item.id);
                        setPanel(null);
                        input.current?.focus();
                      }}
                      style={[
                        styles.category,
                        {
                          backgroundColor: categoryId === item.id ? t.primarySoft : t.surfaceMuted,
                        },
                      ]}>
                      <Text style={[Typography.label, styles.categoryName, { color: t.text }]}>
                        {item.name}
                      </Text>
                      {'visibility' in item ? (
                        <Text style={[Typography.supporting, { color: t.textMuted }]}>
                          {VISIBILITY_LABELS[item.visibility]}
                        </Text>
                      ) : null}
                      {categoryId === item.id ? (
                        <Icon name="check" size={18} color={t.primaryText} />
                      ) : null}
                    </Pressable>
                  ),
                )}
              </View>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.danger }]}>
                저장하지 못했어요. 다시 시도해 주세요.
              </Text>
            ) : null}
            {onAddRoutine && !title.trim() && panel === null ? (
              <Pressable
                onPress={() => {
                  if (savingRef.current) return;
                  Keyboard.dismiss();
                  onClose();
                  onAddRoutine(date);
                }}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가"
                style={styles.routineLink}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>루틴 추가</Text>
                <Icon name="forward" size={14} color={t.textMuted} />
              </Pressable>
            ) : null}
          </ScrollView>
        </SheetDragExclude>
      </GlassSurface>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  glass: {
    flexShrink: 1,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.four },
  input: { paddingVertical: Spacing.four },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '100%',
  },
  categoryName: { flexShrink: 1 },
  categoryList: { gap: Spacing.one },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  routineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
});
