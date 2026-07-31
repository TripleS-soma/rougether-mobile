import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  /** Caption of the confirm (right) button. */
  confirmLabel: string;
  /** a11y label of the confirm button when it differs from the caption (예: '로그아웃 확인'). */
  confirmAccessibilityLabel?: string;
  /** Caption of the cancel (left) button; pass `null` for a confirm-only 안내형. */
  cancelLabel?: string | null;
  /** Confirm button takes the danger fill (삭제·로그아웃·나가기). */
  destructive?: boolean;
  onConfirm: () => void;
  /** Cancel button + backdrop tap + Android back. */
  onCancel: () => void;
};

/**
 * Shared backdrop + card confirm dialog (#557) for the simple [취소 | 확정]
 * cases. Complex dialogs (3+ buttons, forms) stay screen-local.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  confirmAccessibilityLabel,
  cancelLabel = '취소',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable swallows taps so the card doesn't dismiss itself. */}
        <Pressable style={[styles.card, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{title}</Text>
          <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>{body}</Text>
          <View style={styles.btns}>
            {cancelLabel !== null ? (
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmAccessibilityLabel ?? confirmLabel}
              style={[styles.btn, { backgroundColor: destructive ? t.danger : t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  body: {
    lineHeight: 24,
  },
  btns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
