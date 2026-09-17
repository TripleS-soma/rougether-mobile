import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { hapticSelection } from '@/utils/haptics';

export type ToggleSwitchProps = {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
};

/** Themed on/off switch used by form rows and bottom sheets. */
export function ToggleSwitch({ value, onToggle, accessibilityLabel }: ToggleSwitchProps) {
  const t = useTokens();
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onToggle();
      }}
      accessibilityRole="switch"
      // aria-checked: RN Web은 accessibilityState를 DOM으로 옮기지 않는다(bear-check와 같은 이유).
      aria-checked={value}
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: value ? t.primary : t.disabledBg }]}>
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: Radius.pill,
    padding: Spacing.half,
    justifyContent: 'center',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: StaticWhite,
  },
  thumbOn: {
    transform: [{ translateX: 18 }],
  },
});
