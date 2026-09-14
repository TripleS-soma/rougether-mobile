import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WHEEL_ITEM_HEIGHT, WHEEL_VISIBLE_ROWS, WheelPicker } from '@/components/ui/wheel-picker';
import { parse, to24 } from '@/components/screens/sheets/time-picker-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
const PERIOD_VALUES = ['AM', 'PM'] as const;
export function ComposeTimeFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTokens();
  const tr = useT();
  // 휠 항목 라벨은 언어를 따른다 (#893).
  const periods = useMemo(
    () => PERIOD_VALUES.map((v) => ({ value: v, label: tr(`routineTodo.timePicker.${v}`) })),
    [tr],
  );
  const hours = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
        accessibilityLabel: tr('routineTodo.timePicker.hourA11y', { hour: i + 1 }),
      })),
    [tr],
  );
  const minutes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i * 5,
        label: String(i * 5).padStart(2, '0'),
        accessibilityLabel: tr('routineTodo.timePicker.minuteA11y', { minute: i * 5 }),
      })),
    [tr],
  );
  const { ampm, hour12, minute } = parse(value);
  return (
    <View>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: t.surfaceMuted }]} />
      <View style={styles.row}>
        <WheelPicker
          items={periods}
          value={ampm}
          onChange={(next) => onChange(to24(next, hour12, minute))}
          accessibilityLabel={tr('routineTodo.timePicker.ampmA11y')}
        />
        <WheelPicker
          items={hours}
          value={hour12}
          onChange={(next) => onChange(to24(ampm, next, minute))}
          accessibilityLabel={tr('routineTodo.timePicker.hour')}
        />
        <WheelPicker
          items={minutes}
          value={minute}
          onChange={(next) => onChange(to24(ampm, hour12, next))}
          accessibilityLabel={tr('routineTodo.timePicker.minute')}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  band: {
    position: 'absolute',
    top: (WHEEL_ITEM_HEIGHT * (WHEEL_VISIBLE_ROWS - 1)) / 2,
    height: WHEEL_ITEM_HEIGHT,
    left: 0,
    right: 0,
    borderRadius: Radius.md,
  },
});
