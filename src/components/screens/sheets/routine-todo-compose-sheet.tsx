import { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Calendar } from '@/components/ui/calendar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  ComposeRepeatFields,
  REPEAT_OPTIONS,
  type RepeatDraft,
} from '@/components/screens/sheets/compose-repeat-fields';
import { ComposeTimeFields } from '@/components/screens/sheets/compose-time-fields';
import {
  type NewRoutine,
  type RoutineCategoryMeta,
  VISIBILITY_LABELS,
  WEEKDAY_LABELS,
} from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { formatTime, localDate, monthDayLabel } from '@/utils/datetime';
import { firstRoutineDate, routineComposeError } from '@/utils/routine-compose';

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
  const label = kind === 'routine' ? '루틴' : '할 일';
  const time = times[kind];
  const canSubmit = !!title.trim() && !saving && !discard && (!categoryId || !!category);
  const close = () => {
    if (savingRef.current) return;
    Keyboard.dismiss();
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
      if (result === false) setError('저장하지 못했어요. 다시 시도해 주세요.');
      else {
        Keyboard.dismiss();
        onClose();
      }
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const dateLabel = (value: string) =>
    value === today
      ? '오늘'
      : `${value.slice(0, 4) !== today.slice(0, 4) ? `${localDate(value).getFullYear()}년 ` : ''}${monthDayLabel(localDate(value))}`;
  const repeatLabel = `${REPEAT_OPTIONS.find((r) => r.id === repeat.repeat)!.label}${
    repeat.repeat === 'weekly' || repeat.repeat === 'biweekly'
      ? ` ${repeat.days.map((d) => WEEKDAY_LABELS[d]).join(' · ')}`
      : repeat.repeat === 'monthly'
        ? ` ${repeat.dayOfMonth}일`
        : repeat.repeat === 'yearly'
          ? ` ${repeat.month}월 ${repeat.dayOfMonth}일`
          : ''
  }`;
  const row = (name: string, value: string, target: Panel, accessibilityLabel = `${name} 선택`) => (
    <Pressable
      onPress={() => toggle(target)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: panel === target }}
      style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={[Typography.body, { color: t.text }]}>{name}</Text>
      <Text numberOfLines={1} style={[Typography.body, styles.value, { color: t.textMuted }]}>
        {value}
      </Text>
      <Icon name="forward" size={14} color={t.textMuted} />
    </Pressable>
  );
  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      avoidKeyboard
      dragEnabled={!saving && !discard}
      dragScope="header"
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={styles.header} testID="compose-fixed-header">
        <Pressable
          onPress={close}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={styles.action}>
          <Text style={[Typography.label, { color: t.textMuted }]}>취소</Text>
        </Pressable>
        <GlassSurface interactive={false} fallbackColor={t.surfaceMuted} style={styles.segment}>
          <View style={styles.segmentRow} accessibilityRole="tablist">
            {(['routine', 'todo'] as const).map((next) => (
              <Pressable
                key={next}
                disabled={saving || discard}
                accessibilityRole="tab"
                accessibilityLabel={next === 'routine' ? '루틴' : '할 일'}
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
                  {next === 'routine' ? '루틴' : '할 일'}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassSurface>
        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={`${label} 저장`}
          accessibilityState={{ disabled: !canSubmit, busy: saving }}
          style={styles.action}>
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
      <View style={{ flexShrink: 1, minHeight: 0 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: Math.max(insets?.bottom ?? 0, Spacing.four) },
          ]}>
          {discard ? (
            <View style={styles.discard}>
              <Text style={[Typography.h3, { color: t.text }]}>입력한 내용을 버릴까요?</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="계속 작성"
                onPress={() => setDiscard(false)}
                style={styles.row}>
                <Text style={[Typography.label, { color: t.primaryText }]}>계속 작성</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="내용 버리기"
                onPress={onClose}
                style={styles.row}>
                <Text style={[Typography.label, { color: t.danger }]}>내용 버리기</Text>
              </Pressable>
            </View>
          ) : (
            <View pointerEvents={saving ? 'none' : 'auto'}>
              <TextInput
                autoFocus
                accessibilityLabel={`${label} 제목`}
                placeholder={kind === 'routine' ? '루틴 이름' : '할 일'}
                placeholderTextColor={t.textMuted}
                value={title}
                onChangeText={setTitle}
                editable={!saving}
                maxLength={160}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                style={[Typography.h3, styles.input, { color: t.text }]}
              />
              {kind === 'routine' ? (
                <>
                  {row('반복', repeatLabel, 'repeat')}
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
                </>
              ) : null}
              {row(
                kind === 'routine' ? '시작일' : '날짜',
                dateLabel(date),
                'date',
                `${label} 날짜 선택`,
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
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setDetails(!details);
                  setPanel(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="추가 설정"
                accessibilityState={{ expanded: details }}
                style={styles.row}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {category?.name ?? '추가 설정'}
                </Text>
                <Text style={[Typography.supporting, styles.value, { color: t.textMuted }]}>
                  {details ? '접기' : '카테고리 · 시간'}
                </Text>
                <Icon name="forward" size={14} color={t.textMuted} />
              </Pressable>
              {details ? (
                <>
                  {row(
                    '카테고리',
                    category?.name ?? '미분류',
                    'category',
                    `카테고리 선택, ${category?.name ?? '미분류'}`,
                  )}
                  {panel === 'category' ? (
                    <View style={styles.panel}>
                      {[{ id: '', name: '미분류' }, ...availableCategories].map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="radio"
                          accessibilityLabel={item.name}
                          accessibilityState={{ checked: categoryId === item.id }}
                          onPress={() => {
                            setCategoryId(item.id);
                            setPanel(null);
                          }}
                          style={styles.row}>
                          <Text style={[Typography.body, { color: t.text }]}>{item.name}</Text>
                          {'visibility' in item ? (
                            <Text
                              style={[Typography.supporting, styles.value, { color: t.textMuted }]}>
                              {VISIBILITY_LABELS[item.visibility]}
                            </Text>
                          ) : (
                            <View style={styles.value} />
                          )}
                          {categoryId === item.id ? (
                            <Icon name="check" size={18} color={t.primaryText} />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.row}>
                    <Text style={[Typography.body, styles.value, { color: t.text }]}>
                      {kind === 'routine' ? '알림 시간' : '시간'}
                    </Text>
                    <ToggleSwitch
                      value={time.enabled}
                      accessibilityLabel={`${label} 시간 설정`}
                      onToggle={() => {
                        Keyboard.dismiss();
                        setTimes({ ...times, [kind]: { ...time, enabled: !time.enabled } });
                        setPanel(time.enabled ? null : 'time');
                      }}
                    />
                  </View>
                  {time.enabled ? (
                    <>
                      {row('시간', formatTime(time.value), 'time', `${label} 시간 선택`)}
                      {panel === 'time' ? (
                        <ComposeTimeFields
                          value={time.value}
                          onChange={(value) => setTimes({ ...times, [kind]: { ...time, value } })}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {kind === 'routine' ? (
                    <>
                      {row('종료일', endDate ? dateLabel(endDate) : '없음', 'end')}
                      {panel === 'end' ? (
                        <View style={styles.panel}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="종료일 없음"
                            onPress={() => {
                              setEndDate(undefined);
                              setPanel(null);
                            }}
                            style={styles.row}>
                            <Text style={[Typography.label, { color: t.primaryText }]}>없음</Text>
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
                  사용할 수 없는 카테고리예요. 다시 선택해 주세요.
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
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
  body: { paddingHorizontal: Spacing.four },
  input: { paddingVertical: Spacing.five, minHeight: 72 },
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
