import { Modal, Pressable, Text, View } from 'react-native';

import { confirmStyles as styles } from '@/components/screens/decor/confirm-modal-styles';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type UnsavedLeaveModalProps = {
  visible: boolean;
  /** 저장하고 나가기 — 적용 후 화면을 나간다. */
  onSaveAndLeave: () => void;
  /** 저장하지 않고 나가기 — 변경을 버리고 화면을 나간다. */
  onLeaveWithoutSaving: () => void;
  /** 계속 꾸미기 — 백드롭·하드웨어 뒤로가기도 여기로. */
  onStay: () => void;
};

/**
 * 미적용 변경을 둔 채 나갈 때의 3지선다 모달 (room-decor-screen에서 분리).
 * 화면의 `dirty` 판단은 그대로 화면에 있고, 이 컴포넌트는 보이기·콜백만 받는다.
 */
export function UnsavedLeaveModal({
  visible,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
}: UnsavedLeaveModalProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onStay}>
      <Pressable style={styles.confirmBackdrop} onPress={onStay}>
        <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{tr('roomShop.decor.leave.title')}</Text>
          <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
            {tr('roomShop.decor.leave.body')}
          </Text>
          <View style={styles.leaveBtns}>
            <Pressable
              onPress={onSaveAndLeave}
              accessibilityRole="button"
              accessibilityLabel={tr('roomShop.decor.leave.saveAndLeave')}
              style={[styles.leaveBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {tr('roomShop.decor.leave.saveAndLeave')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onLeaveWithoutSaving}
              accessibilityRole="button"
              accessibilityLabel={tr('roomShop.decor.leave.leaveWithoutSaving')}
              style={[styles.leaveBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('roomShop.decor.leave.leaveWithoutSaving')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onStay}
              accessibilityRole="button"
              accessibilityLabel={tr('roomShop.decor.leave.stay')}
              style={styles.leaveStay}>
              <Text style={[Typography.label, { color: t.textMuted }]}>
                {tr('roomShop.decor.leave.stay')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
