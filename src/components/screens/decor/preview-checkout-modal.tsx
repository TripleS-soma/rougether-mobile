import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmStyles as styles } from '@/components/screens/decor/confirm-modal-styles';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type PreviewCheckoutModalProps = {
  visible: boolean;
  /** 적용 시점에 구매가 필요한 프리뷰 전체 (가구 + 표면류). */
  previews: { id: string; name: string; price: number }[];
  /** `previews` 가격 합계. */
  total: number;
  diamondBalance: number;
  /** 일괄 구매 진행 중 — 버튼 잠금 + '구매 중...' 라벨. */
  buying: boolean;
  /** 구매 경로(onBuy)가 배선돼 있는지 — 없으면 '모두 구매하고 저장'이 비활성. */
  canBuy: boolean;
  onBuyAllAndSave: () => void;
  onSaveWithoutPreviews: () => void;
  /** 프리뷰 계속 보기 — 백드롭·하드웨어 뒤로가기도 여기로. */
  onDismiss: () => void;
};

/**
 * 적용하기 시 미구매 프리뷰 일괄 확인 모달 (#501, room-decor-screen에서 분리).
 * 서버는 미보유 배치를 저장할 수 없으므로 모두 사거나 빼고 저장해야 한다.
 * 합계·잔액 비교는 화면이 아니라 여기서 라벨·비활성으로 표현한다.
 */
export function PreviewCheckoutModal({
  visible,
  previews,
  total,
  diamondBalance,
  buying,
  canBuy,
  onBuyAllAndSave,
  onSaveWithoutPreviews,
  onDismiss,
}: PreviewCheckoutModalProps) {
  const t = useTokens();
  const Typography = useTypography();
  const buyAllDisabled = buying || !canBuy || diamondBalance < total;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.confirmBackdrop} onPress={onDismiss}>
        <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>
            구매하지 않은 프리뷰가 {previews.length}개 있어요
          </Text>
          <View style={local.previewList}>
            {previews.map((pv) => (
              <View key={pv.id} style={local.previewRow}>
                <Text style={[Typography.body, local.flex, { color: t.text }]} numberOfLines={1}>
                  {pv.name}
                </Text>
                <View style={local.priceRow}>
                  <Icon name="diamond" size={11} color={t.primary} />
                  <Text style={[Typography.body, { color: t.text }]}>{pv.price}</Text>
                </View>
              </View>
            ))}
            <View style={[local.previewRow, local.previewTotalRow, { borderTopColor: t.border }]}>
              <Text style={[Typography.body, local.flex, { color: t.textMuted }]}>
                합계 (보유 {diamondBalance})
              </Text>
              <View style={local.priceRow}>
                <Icon name="diamond" size={11} color={t.primary} />
                <Text style={[Typography.body, { color: t.text }]}>{total}</Text>
              </View>
            </View>
          </View>
          <View style={styles.leaveBtns}>
            <Pressable
              onPress={onBuyAllAndSave}
              disabled={buyAllDisabled}
              accessibilityRole="button"
              accessibilityLabel="모두 구매하고 저장"
              accessibilityState={{ disabled: buyAllDisabled }}
              style={[
                styles.leaveBtn,
                { backgroundColor: buyAllDisabled ? t.disabledBg : t.primary },
              ]}>
              <Text
                style={[Typography.label, { color: buyAllDisabled ? t.textMuted : t.onPrimary }]}>
                {buying
                  ? '구매 중...'
                  : diamondBalance < total
                    ? '다이아가 부족해요'
                    : '모두 구매하고 저장'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onSaveWithoutPreviews}
              disabled={buying}
              accessibilityRole="button"
              accessibilityLabel="제외하고 저장"
              style={[styles.leaveBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.text }]}>프리뷰 제외하고 저장</Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="프리뷰 계속 보기"
              style={styles.leaveStay}>
              <Text style={[Typography.label, { color: t.textMuted }]}>계속 꾸미기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const local = StyleSheet.create({
  flex: {
    flex: 1,
  },
  previewList: {
    alignSelf: 'stretch',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  previewTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
    marginTop: Spacing.half,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
});
