import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { pressedStyle } from '@/components/ui/press-feedback';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

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
  /** a11y label of the cancel button when it differs from the caption (예: '재발급 취소'). */
  cancelAccessibilityLabel?: string;
  /**
   * 본문과 버튼 사이의 추가 내용 — 확정과 함께 고르는 선택지 한 줄(예: 집을 나가며 "내 글도
   * 지우기" 체크박스). 버튼이 셋 이상이거나 입력 폼이면 화면 전용 다이얼로그를 쓴다.
   */
  children?: ReactNode;
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
  cancelLabel,
  cancelAccessibilityLabel,
  children,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tr = useT();
  const resolvedCancelLabel = cancelLabel ?? tr('common.cancel');
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      // 다이얼로그 이름(axe aria-dialog-name) — RN Web은 Modal의 나머지 props를 dialog 요소로 넘긴다.
      aria-label={title}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable swallows taps so the card doesn't dismiss itself. */}
        <Pressable style={[styles.card, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{title}</Text>
          <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>{body}</Text>
          {children}
          <View style={styles.btns}>
            {cancelLabel !== null ? (
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelAccessibilityLabel ?? resolvedCancelLabel}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: t.surfaceMuted },
                  pressed && pressedStyle('dim', t),
                ]}>
                <Text style={[Typography.label, { color: t.text }]}>{resolvedCancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmAccessibilityLabel ?? confirmLabel}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: destructive ? t.danger : t.primary },
                pressed && pressedStyle(destructive ? 'dim' : 'fill', t),
              ]}>
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
    borderCurve: 'continuous',
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
