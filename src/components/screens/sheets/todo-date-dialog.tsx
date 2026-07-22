import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Calendar } from '@/components/ui/calendar';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type TodoDateDialogProps = {
  visible: boolean;
  /** Currently picked due date ("YYYY-MM-DD"). */
  value: string;
  /** A pick commits immediately — the parent closes and refocuses the input. */
  onSelect: (date: string) => void;
  onClose: () => void;
};

/**
 * 퀵애드 할 일 날짜 dialog — the calendar picker behind the quick-add row's
 * date chip. Extracted from my-room-screen (pure move, no behavior change);
 * fully controlled, since the due date belongs to the parent's quick-add row.
 */
export function TodoDateDialog({ visible, value, onSelect, onClose }: TodoDateDialogProps) {
  const t = useTokens();
  const Typography = useTypography();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dialogBackdrop} onPress={onClose}>
        <Pressable style={[styles.dialogCard, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>할 일 날짜</Text>
          <Calendar value={value} onSelect={onSelect} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dialogBackdrop: {
    flex: 1,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
