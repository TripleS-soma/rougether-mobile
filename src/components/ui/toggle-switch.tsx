import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '@/hooks/use-tokens';
import { hapticSelection } from '@/utils/haptics';

const OFF = '#D4C4B0';

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
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: value ? t.primary : OFF }]}>
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  thumbOn: {
    transform: [{ translateX: 18 }],
  },
});
