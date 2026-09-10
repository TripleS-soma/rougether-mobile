import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RepeatKind } from '@/constants/routines';
import { WEEKDAY_LABELS } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export const REPEAT_OPTIONS: { id: RepeatKind; label: string }[] = [
  { id: 'daily', label: '매일' },
  { id: 'weekly', label: '매주' },
  { id: 'biweekly', label: '격주' },
  { id: 'monthly', label: '매월' },
  { id: 'yearly', label: '매년' },
];
export type RepeatDraft = { repeat: RepeatKind; days: number[]; dayOfMonth: number; month: number };
export function ComposeRepeatFields({
  value,
  onChange,
}: {
  value: RepeatDraft;
  onChange: (value: RepeatDraft) => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const choice = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.choice, { backgroundColor: selected ? t.primarySoft : t.surfaceMuted }]}>
      <Text style={[Typography.label, { color: selected ? t.primaryText : t.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.panel}>
      <View style={styles.choices}>
        {REPEAT_OPTIONS.map(({ id, label }) =>
          choice(label, value.repeat === id, () => onChange({ ...value, repeat: id })),
        )}
      </View>
      {value.repeat === 'weekly' || value.repeat === 'biweekly' ? (
        <View style={styles.choices}>
          {WEEKDAY_LABELS.map((label, day) =>
            choice(`${label}요일`, value.days.includes(day), () =>
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
          시작일이 속한 주부터 2주마다 반복해요.
        </Text>
      ) : null}
      {value.repeat === 'yearly' ? (
        <View style={styles.choices}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) =>
            choice(`${month}월`, value.month === month, () => onChange({ ...value, month })),
          )}
        </View>
      ) : null}
      {value.repeat === 'monthly' || value.repeat === 'yearly' ? (
        <View style={styles.choices}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((dayOfMonth) =>
            choice(`${dayOfMonth}일`, value.dayOfMonth === dayOfMonth, () =>
              onChange({ ...value, dayOfMonth }),
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
