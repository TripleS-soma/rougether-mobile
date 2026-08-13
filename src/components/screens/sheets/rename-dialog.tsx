import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Routine } from '@/constants/routines';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type RenameDialogProps = {
  /** 이름을 바꿀 루틴/투두 — null이면 다이얼로그가 닫힌다. */
  item: Routine | null;
  onClose: () => void;
  /** Rename a routine (name only; full edit lives in 루틴 관리). */
  onRename?: (id: string, title: string) => void;
};

/**
 * 이름 수정 dialog (kebab → 수정하기). Extracted from my-room-screen (pure
 * move, no behavior change); the draft text lives here, seeded from the
 * item's title each time the dialog opens.
 */
export function RenameDialog({ item, onClose, onRename }: RenameDialogProps) {
  const t = useTokens();
  const Typography = useTypography();
  const [text, setText] = useState('');
  useEffect(() => {
    if (item) setText(item.title);
  }, [item]);

  return (
    <Modal transparent visible={item !== null} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dialogBackdrop} onPress={onClose}>
        <Pressable style={[styles.dialogCard, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>이름 수정</Text>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="루틴 이름"
            placeholderTextColor={t.textMuted}
            style={[styles.dialogInput, { color: t.text, backgroundColor: t.surfaceMuted }]}
          />
          <View style={styles.dialogBtns}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="취소"
              style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.text }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const title = text.trim();
                if (item && title) onRename?.(item.id, title);
                onClose();
              }}
              disabled={!text.trim()}
              accessibilityRole="button"
              accessibilityLabel="저장"
              style={[
                styles.dialogBtn,
                { backgroundColor: text.trim() ? t.primary : t.surfaceMuted },
              ]}>
              <Text style={[Typography.label, { color: text.trim() ? t.onPrimary : t.textMuted }]}>
                저장
              </Text>
            </Pressable>
          </View>
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
  dialogInput: {
    fontSize: 18,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dialogBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
