import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RepeatKind } from '@/constants/routines';
import { WEEKDAY_KEYS, weekdayLongLabelKey } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 반복 종류 순서 — 라벨은 `routineTodo.repeat.<id>` (#893). */
export const REPEAT_KINDS: RepeatKind[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
export const repeatLabelKey = (id: RepeatKind) => `routineTodo.repeat.${id}` as const;
export type RepeatDraft = { repeat: RepeatKind; days: number[]; dayOfMonth: number; month: number };
export function ComposeRepeatFields({
  value,
  onChange,
}: {
  value: RepeatDraft;
  onChange: (value: RepeatDraft) => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  // 키는 라벨이 아니라 안정 id — 번역 라벨은 언어에 따라 겹칠 수 있다(영어 요일 글자 S·T 등, #893).
  const choice = (key: string | number, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.choice, { backgroundColor: selected ? t.primarySoft : t.surfaceMuted }]}>
      <Text style={[Typography.label, { color: selected ? t.primaryText : t.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.panel}>
      <View style={styles.choices}>
        {REPEAT_KINDS.map((id) =>
          choice(id, tr(repeatLabelKey(id)), value.repeat === id, () =>
            onChange({ ...value, repeat: id }),
          ),
        )}
      </View>
      {value.repeat === 'weekly' || value.repeat === 'biweekly' ? (
        <View style={styles.choices}>
          {WEEKDAY_KEYS.map((_, day) =>
            choice(day, tr(weekdayLongLabelKey(day)), value.days.includes(day), () =>
              onChange({
                ...value,
                days: value.days.includes(day)
                  ? value.days.filter((d) => d !== day)
                  : [...value.days, day].sort(),
              }),
            ),
          )}
        </View>
      ) : null}
      {value.repeat === 'biweekly' ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('routineTodo.repeat.biweeklyHint')}
        </Text>
      ) : null}
      {value.repeat === 'yearly' ? (
        <View style={styles.choices}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) =>
            choice(
              month,
              tr('routineTodo.repeat.monthLabel', { month }),
              value.month === month,
              () => onChange({ ...value, month }),
            ),
          )}
        </View>
      ) : null}
      {value.repeat === 'monthly' || value.repeat === 'yearly' ? (
        <View style={styles.choices}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((dayOfMonth) =>
            choice(
              dayOfMonth,
              tr('routineTodo.repeat.dayOfMonthLabel', { day: dayOfMonth }),
              value.dayOfMonth === dayOfMonth,
              () => onChange({ ...value, dayOfMonth }),
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { gap: Spacing.three },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  choice: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
});
