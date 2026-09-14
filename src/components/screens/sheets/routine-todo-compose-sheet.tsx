import { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Calendar } from '@/components/ui/calendar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  ComposeRepeatFields,
  type RepeatDraft,
  repeatLabelKey,
} from '@/components/screens/sheets/compose-repeat-fields';
import { ComposeTimeFields } from '@/components/screens/sheets/compose-time-fields';
import {
  type NewRoutine,
  type RoutineCategoryMeta,
  visibilityLabelKey,
  weekdayLabelKey,
} from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { formatTime, localDate, monthDayLabel } from '@/utils/datetime';
import { firstRoutineDate, routineComposeError } from '@/utils/routine-compose';
import { useT } from '@/i18n';

export type ComposeKind = 'routine' | 'todo';
export type ComposeSubmission =
  | { kind: 'routine'; routine: NewRoutine; date: string }
  | { kind: 'todo'; title: string; category: string; date: string; time?: string };
export type RoutineTodoComposeSheetProps = {
  visible: boolean;
  initialDate: string;
  initialKind?: ComposeKind;
  initialCategory?: string;
  today: string;
  categories: RoutineCategoryMeta[];
  onSubmit: (draft: ComposeSubmission) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};
type Panel = 'repeat' | 'date' | 'category' | 'time' | 'end' | null;
const initialRepeat = (date: string): RepeatDraft => ({
  repeat: 'daily',
  days: [],
  dayOfMonth: localDate(date).getDate(),
  month: localDate(date).getMonth() + 1,
});
const initialTime = () => ({ enabled: false, value: '07:00' });

/** A single draft; changing the kind never navigates or discards shared fields. */
export function RoutineTodoComposeSheet({
  visible,
  initialDate,
  initialKind = 'routine',
  initialCategory = '',
  today,
  categories,
  onSubmit,
  onClose,
}: RoutineTodoComposeSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const insets = useContext(SafeAreaInsetsContext);
  const savingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ComposeKind>(initialKind);
  const [date, setDate] = useState(initialDate);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [repeat, setRepeat] = useState(() => initialRepeat(initialDate));
  const [times, setTimes] = useState({ routine: initialTime(), todo: initialTime() });
  const [endDate, setEndDate] = useState<string>();
  const [panel, setPanel] = useState<Panel>(null);
  const [details, setDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setKind(initialKind);
    setDate(initialDate);
    setCategoryId(initialCategory);
    setRepeat(initialRepeat(initialDate));
    setTimes({ routine: initialTime(), todo: initialTime() });
    setEndDate(undefined);
    setPanel(null);
    setDetails(false);
    setError('');
    setDiscard(false);
  }, [visible, initialDate, initialKind, initialCategory]);
  const availableCategories = categories.filter((c) => c.id && !c.deleted && c.houseId == null);
  const category = availableCategories.find((c) => c.id === categoryId);
  const label = tr(`routineTodo.kind.${kind}`);
  const time = times[kind];
  const canSubmit = !!title.trim() && !saving && !discard && (!categoryId || !!category);
  const close = () => {
    if (savingRef.current) return;
    Keyboard.dismiss();
    if (panel === 'category') {
      setPanel(null);
      return;
    }
    if (discard) {
      setDiscard(false);
      return;
    }
    if (title.trim()) setDiscard(true);
    else onClose();
  };
  const toggle = (next: Panel) => {
    Keyboard.dismiss();
    setPanel((current) => (current === next ? null : next));
  };
  const submit = async () => {
    if (!canSubmit || savingRef.current) return;
    const routine: NewRoutine = {
      title: title.trim(),
      category: categoryId,
      ...repeat,
      startDate: date,
      endDate,
      alarmEnabled: times.routine.enabled,
      time: times.routine.value,
    };
    const validation = kind === 'routine' ? routineComposeError(routine, today) : null;
    if (validation) {
      Keyboard.dismiss();
      setError(validation);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const draft: ComposeSubmission =
        kind === 'routine'
          ? { kind, routine, date: firstRoutineDate(routine)! }
          : {
              kind,
              title: title.trim(),
              category: categoryId,
              date,
              time: times.todo.enabled ? times.todo.value : undefined,
            };
      const result = await onSubmit(draft);
      if (result === false) setError(tr('routineTodo.compose.saveFailed'));
      else {
        Keyboard.dismiss();
        onClose();
      }
    } catch {
      setError(tr('routineTodo.compose.saveFailed'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const dateLabel = (value: string) =>
    value === today
      ? tr('routineTodo.today')
      : value.slice(0, 4) !== today.slice(0, 4)
        ? tr('routineTodo.compose.dateWithYear', {
            year: localDate(value).getFullYear(),
            date: monthDayLabel(localDate(value)),
          })
        : monthDayLabel(localDate(value));
  const repeatLabel = `${tr(repeatLabelKey(repeat.repeat))}${
    repeat.repeat === 'weekly' || repeat.repeat === 'biweekly'
      ? ` ${repeat.days.map((d) => tr(weekdayLabelKey(d))).join(' · ')}`
      : repeat.repeat === 'monthly'
        ? ` ${tr('routineTodo.repeat.dayOfMonthLabel', { day: repeat.dayOfMonth })}`
        : repeat.repeat === 'yearly'
          ? ` ${tr('routineTodo.repeat.monthDayLabel', { month: repeat.month, day: repeat.dayOfMonth })}`
          : ''
  }`;
  const row = (
    name: string,
    value: string,
    target: Panel,
    accessibilityLabel = tr('routineTodo.compose.selectA11y', { name }),
  ) => (
    <Pressable
      onPress={() => toggle(target)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: panel === target }}
      style={styles.row}>
      <Text style={[Typography.body, { color: t.text }]}>{name}</Text>
      <Text
        numberOfLines={1}
        style={[Typography.body, emph('medium'), styles.value, { color: t.text }]}>
        {value}
      </Text>
      <Icon name="forward" size={14} color={t.textMuted} />
    </Pressable>
  );
  const divider = <View style={[styles.divider, { backgroundColor: t.border }]} />;
  const groupStyle = [styles.group, { backgroundColor: t.surface, borderColor: t.border }];
  const selectingCategory = panel === 'category';
  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      avoidKeyboard
      dragEnabled={!saving && !discard}
      dragScope="header"
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={styles.header} testID="compose-fixed-header">
        {selectingCategory ? (
          <>
            <Pressable
              onPress={() => setPanel(null)}
              accessibilityRole="button"
              accessibilityLabel={tr('routineTodo.compose.backToForm')}
              style={styles.back}>
              <Icon name="back" size={18} color={t.text} />
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('routineTodo.compose.back')}
              </Text>
            </Pressable>
            <Text
              accessibilityRole="header"
              style={[Typography.h3, styles.pageTitle, { color: t.text }]}>
              {tr('routineTodo.compose.category')}
            </Text>
            <View style={styles.backSpace} />
          </>
        ) : (
          <>
            <Pressable
              onPress={close}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={tr('common.cancel')}
              style={styles.action}>
              <Text style={[Typography.label, { color: t.text }]}>{tr('common.cancel')}</Text>
            </Pressable>
            <GlassSurface interactive={false} fallbackColor={t.surfaceMuted} style={styles.segment}>
              <View style={styles.segmentRow} accessibilityRole="tablist">
                {(['routine', 'todo'] as const).map((next) => (
                  <Pressable
                    key={next}
                    disabled={saving || discard}
                    accessibilityRole="tab"
                    accessibilityLabel={tr(`routineTodo.kind.${next}`)}
                    accessibilityState={{ selected: kind === next, disabled: saving || discard }}
                    onPress={() => {
                      setKind(next);
                      setPanel(null);
                      setError('');
                    }}
                    style={[styles.kind, kind === next && { backgroundColor: t.surface }]}>
                    <Text
                      style={[
                        Typography.label,
                        emph(kind === next ? 'bold' : 'normal'),
                        { color: t.text },
                      ]}>
                      {tr(`routineTodo.kind.${next}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </GlassSurface>
            <Pressable
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel={tr('routineTodo.compose.saveA11y', { kind: label })}
              accessibilityState={{ disabled: !canSubmit, busy: saving }}
              style={styles.action}>
              <Text
                style={[
                  Typography.label,
                  emph('bold'),
                  { color: canSubmit ? t.primaryText : t.textDisabled },
                ]}>
                {saving ? tr('routineTodo.compose.saving') : tr('routineTodo.compose.add')}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <SheetDragExclude>
        {selectingCategory ? (
          <ScrollView
            contentContainerStyle={[
              styles.body,
              { paddingBottom: Math.max(insets?.bottom ?? 0, Spacing.four) },
            ]}>
            <View style={groupStyle}>
              {[
                { id: '', name: tr('routineTodo.category.uncategorized') },
                ...availableCategories,
              ].map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? divider : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={item.name}
                    accessibilityState={{ checked: categoryId === item.id }}
                    onPress={() => {
                      setCategoryId(item.id);
                      setPanel(null);
                    }}
                    style={styles.row}>
                    <View style={styles.categoryLabel}>
                      <Text style={[Typography.body, emph('medium'), { color: t.text }]}>
                        {item.name}
                      </Text>
                      {'visibility' in item ? (
                        <Text style={[Typography.supporting, { color: t.textMuted }]}>
                          {tr(visibilityLabelKey(item.visibility))}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.check}>
                      {categoryId === item.id ? (
                        <Icon name="check" size={20} color={t.primaryText} />
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
        <ScrollView
          style={selectingCategory && styles.hidden}
          accessibilityElementsHidden={selectingCategory}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: Math.max(insets?.bottom ?? 0, Spacing.four) },
          ]}>
          {discard ? (
            <View style={styles.discard}>
              <Text style={[Typography.h3, { color: t.text }]}>
                {tr('routineTodo.compose.discardTitle')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('routineTodo.compose.keepEditing')}
                onPress={() => setDiscard(false)}
                style={styles.row}>
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {tr('routineTodo.compose.keepEditing')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('routineTodo.compose.discard')}
                onPress={onClose}
                style={styles.row}>
                <Text style={[Typography.label, { color: t.danger }]}>
                  {tr('routineTodo.compose.discard')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View pointerEvents={saving ? 'none' : 'auto'} style={styles.form}>
              <View style={groupStyle}>
                <TextInput
                  autoFocus
                  accessibilityLabel={tr('routineTodo.compose.titleA11y', { kind: label })}
                  placeholder={
                    kind === 'routine'
                      ? tr('routineTodo.compose.routinePlaceholder')
                      : tr('routineTodo.kind.todo')
                  }
                  placeholderTextColor={t.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  editable={!saving}
                  maxLength={160}
                  returnKeyType="done"
                  onSubmitEditing={() => void submit()}
                  style={[Typography.h3, styles.input, { color: t.text }]}
                />
              </View>
              <View style={groupStyle}>
                {kind === 'routine' ? (
                  <>
                    {row(tr('routineTodo.compose.repeat'), repeatLabel, 'repeat')}
                    {panel === 'repeat' ? (
                      <View style={styles.panel}>
                        <ComposeRepeatFields
                          value={repeat}
                          onChange={(next) => {
                            setRepeat(next);
                            setError('');
                          }}
                        />
                      </View>
                    ) : null}
                    {divider}
                  </>
                ) : null}
                {row(
                  kind === 'routine'
                    ? tr('routineTodo.compose.startDate')
                    : tr('routineTodo.compose.date'),
                  dateLabel(date),
                  'date',
                  tr('routineTodo.compose.pickDateA11y', { kind: label }),
                )}
                {panel === 'date' ? (
                  <View style={styles.panel}>
                    <Calendar
                      value={date}
                      min={kind === 'routine' ? today : undefined}
                      onSelect={(next) => {
                        setDate(next);
                        setPanel(null);
                        setError('');
                      }}
                    />
                  </View>
                ) : null}
              </View>
              <View style={groupStyle}>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setDetails(!details);
                    setPanel(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tr('routineTodo.compose.details')}
                  accessibilityState={{ expanded: details }}
                  style={styles.row}>
                  <Text style={[Typography.label, { color: t.text }]}>
                    {tr('routineTodo.compose.details')}
                  </Text>
                  <Text style={[Typography.supporting, styles.value, { color: t.textMuted }]}>
                    {details
                      ? tr('routineTodo.compose.collapse')
                      : (category?.name ?? tr('routineTodo.compose.detailsHint'))}
                  </Text>
                  <Icon name="forward" size={14} color={t.textMuted} />
                </Pressable>
                {details ? (
                  <>
                    {divider}
                    {row(
                      tr('routineTodo.compose.category'),
                      category?.name ?? tr('routineTodo.category.uncategorized'),
                      'category',
                      tr('routineTodo.compose.categoryA11y', {
                        name: category?.name ?? tr('routineTodo.category.uncategorized'),
                      }),
                    )}
                    {divider}
                    <View style={styles.row}>
                      <Text style={[Typography.body, styles.label, { color: t.text }]}>
                        {kind === 'routine'
                          ? tr('routineTodo.compose.alarmTime')
                          : tr('routineTodo.compose.time')}
                      </Text>
                      <ToggleSwitch
                        value={time.enabled}
                        accessibilityLabel={tr('routineTodo.compose.timeToggleA11y', {
                          kind: label,
                        })}
                        onToggle={() => {
                          Keyboard.dismiss();
                          setTimes({ ...times, [kind]: { ...time, enabled: !time.enabled } });
                          setPanel(time.enabled ? null : 'time');
                        }}
                      />
                    </View>
                    {time.enabled ? (
                      <>
                        {divider}
                        {row(
                          tr('routineTodo.compose.time'),
                          formatTime(time.value),
                          'time',
                          tr('routineTodo.compose.pickTimeA11y', { kind: label }),
                        )}
                        {panel === 'time' ? (
                          <View style={styles.panel}>
                            <ComposeTimeFields
                              value={time.value}
                              onChange={(value) =>
                                setTimes({ ...times, [kind]: { ...time, value } })
                              }
                            />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    {kind === 'routine' ? (
                      <>
                        {divider}
                        {row(
                          tr('routineTodo.compose.endDate'),
                          endDate ? dateLabel(endDate) : tr('routineTodo.compose.none'),
                          'end',
                        )}
                        {panel === 'end' ? (
                          <View style={styles.panel}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={tr('routineTodo.compose.noEndDateA11y')}
                              onPress={() => {
                                setEndDate(undefined);
                                setPanel(null);
                              }}
                              style={styles.row}>
                              <Text style={[Typography.label, { color: t.primaryText }]}>
                                {tr('routineTodo.compose.none')}
                              </Text>
                            </Pressable>
                            <Calendar
                              value={endDate ?? date}
                              min={date < today ? today : date}
                              onSelect={(next) => {
                                setEndDate(next);
                                setPanel(null);
                                setError('');
                              }}
                            />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={[Typography.supporting, styles.error, { color: t.danger }]}>
                  {error}
                </Text>
              ) : null}
              {categoryId && !category ? (
                <Text
                  accessibilityRole="alert"
                  style={[Typography.supporting, styles.error, { color: t.danger }]}>
                  {tr('routineTodo.compose.categoryUnavailable')}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SheetDragExclude>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  action: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  segment: { flex: 1, borderRadius: Radius.pill, overflow: 'hidden' },
  segmentRow: { flexDirection: 'row', padding: Spacing.one },
  kind: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  form: { gap: Spacing.four },
  hidden: { display: 'none' },
  group: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth },
  input: { paddingVertical: Spacing.four, minHeight: Spacing.six },
  label: { flex: 1 },
  categoryLabel: { flex: 1, gap: Spacing.one },
  check: { width: Spacing.four, alignItems: 'center' },
  back: {
    width: Spacing.six,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: Spacing.one,
  },
  backSpace: { width: Spacing.six },
  pageTitle: { flex: 1, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: Spacing.three,
  },
  value: { flex: 1, textAlign: 'right' },
  panel: { paddingVertical: Spacing.three },
  error: { paddingVertical: Spacing.three },
  discard: { paddingVertical: Spacing.four },
});
