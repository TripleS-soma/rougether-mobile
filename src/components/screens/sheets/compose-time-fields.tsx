import { StyleSheet, View } from 'react-native';
import { WheelPicker } from '@/components/ui/wheel-picker';
import { parse, to24 } from '@/components/screens/sheets/time-picker-sheet';
import { Spacing } from '@/constants/theme';
const PERIODS = [
  { value: 'AM' as const, label: '오전' },
  { value: 'PM' as const, label: '오후' },
];
const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
  accessibilityLabel: `${i + 1}시`,
}));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  label: String(i * 5).padStart(2, '0'),
  accessibilityLabel: `${i * 5}분`,
}));
export function ComposeTimeFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { ampm, hour12, minute } = parse(value);
  return (
    <View style={styles.row}>
      <WheelPicker
        items={PERIODS}
        value={ampm}
        onChange={(next) => onChange(to24(next, hour12, minute))}
        accessibilityLabel="오전 오후"
      />
      <WheelPicker
        items={HOURS}
        value={hour12}
        onChange={(next) => onChange(to24(ampm, next, minute))}
        accessibilityLabel="시"
      />
      <WheelPicker
        items={MINUTES}
        value={minute}
        onChange={(next) => onChange(to24(ampm, hour12, next))}
        accessibilityLabel="분"
      />
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: Spacing.two } });
