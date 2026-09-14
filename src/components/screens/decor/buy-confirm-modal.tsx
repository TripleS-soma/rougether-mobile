import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, { ZoomIn } from 'react-native-reanimated';

import { confirmStyles as styles } from '@/components/screens/decor/confirm-modal-styles';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type BuyPhase = 'idle' | 'buying' | 'done';

export type BuyConfirmModalProps = {
  /** 구매 확인 대상 — null이면 모달이 닫혀 있다. */
  item: { name: string; price: number } | null;
  /** 구매 버튼 마이크로 전환 (#453) — buying/done 중에는 닫기·취소가 막힌다. */
  phase: BuyPhase;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 단건 구매 확인 모달 (room-decor-screen에서 분리). 다이아 지출은 되돌릴 수
 * 없어서 onBuy 전에 반드시 묻는다. 결제 진행·체크 연출 중에는 백드롭·취소·
 * 하드웨어 뒤로가기 모두 닫기를 막는다 (#453).
 */
export function BuyConfirmModal({ item, phase, onCancel, onConfirm }: BuyConfirmModalProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <Modal
      transparent
      visible={item !== null}
      animationType="fade"
      // 결제 진행·체크 연출 중에는 닫기를 막는다 (#453) — 지출이 날아가는
      // 중이라 취소가 성립하지 않는다.
      onRequestClose={() => phase === 'idle' && onCancel()}>
      <Pressable style={styles.confirmBackdrop} onPress={() => phase === 'idle' && onCancel()}>
        <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{tr('roomShop.decor.buy.title')}</Text>
          <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
            {tr('roomShop.decor.buy.body', { name: item?.name, price: item?.price })}
          </Text>
          <View style={local.confirmBtns}>
            <Pressable
              onPress={onCancel}
              disabled={phase !== 'idle'}
              accessibilityRole="button"
              accessibilityLabel={tr('roomShop.decor.buy.cancelA11y')}
              style={[
                local.confirmBtn,
                { backgroundColor: t.surfaceMuted, opacity: phase === 'idle' ? 1 : 0.4 },
              ]}>
              <Text style={[Typography.label, { color: t.text }]}>{tr('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={phase !== 'idle'}
              accessibilityRole="button"
              accessibilityLabel={tr('roomShop.decor.buy.confirmA11y')}
              accessibilityState={{ disabled: phase !== 'idle' }}
              style={[
                local.confirmBtn,
                { backgroundColor: t.primary },
                phase === 'buying' && local.confirmBtnPressed,
              ]}>
              {phase === 'done' ? (
                // 성공 확인 후에만 체크 팝 (#453) — 눌림에서 튀어오르는 변신.
                <Animated.View entering={ZoomIn.springify().damping(11)} testID="buy-done-check">
                  <Icon name="check" size={18} color={t.onPrimary} />
                </Animated.View>
              ) : (
                <Text style={[Typography.label, { color: t.onPrimary }]}>
                  {tr('roomShop.decor.buy.confirm')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const local = StyleSheet.create({
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  // 결제 진행 중 꾹 눌린 상태 (#453) — 체크 팝 직전의 '눌림'.
  confirmBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
});
