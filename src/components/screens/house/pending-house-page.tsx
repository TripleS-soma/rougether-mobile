import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { HouseOrderDots } from '@/components/room/house-order-dots';
import { HouseSwitcher } from '@/components/screens/house/house-switcher';
import type { PendingJoinHouse } from '@/components/screens/house/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 승인 대기 페이지 (#648) — 잠금형 카드. house-screen.tsx의 대체 return 분기를
 * 그대로 떼어낸 것(리팩토링 4묶음). 메인 프레임 트리와 독립 렌더라 카메라·좌석
 * 로직과 얽히지 않고, 스위처 산술(totalPages)만 화면에서 받는다.
 */
export type PendingHousePageProps = {
  pendingHouse: PendingJoinHouse;
  /** 화면 컨테이너 스타일 — 화면이 `useScreenStyle([])`로 읽은 것. */
  screenStyle: ViewStyle;
  /** 집 + 대기 카드 페이지 수 — 2 이상이면 ‹ › 화살표를 그린다. */
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /** 인디케이터 정렬 대상 — houseId가 있는 내 집만 (대기 카드는 빠진다). */
  orderableHouses: { houseId: number; name: string }[];
  pendingCount: number;
  houseIndex: number;
  onReorderHouses?: (houseIds: number[]) => void;
  /**
   * 입주 신청 철회 — 확인 다이얼로그 뒤에만 불린다. 없으면 취소 버튼을 안
   * 그린다. 마지막 대기 카드였을 때의 페이지 복귀는 화면이 이 콜백 안에서 한다.
   */
  onCancelJoinRequest?: (requestId: number) => void;
};

export function PendingHousePage({
  pendingHouse,
  screenStyle,
  totalPages,
  onPrev,
  onNext,
  orderableHouses,
  pendingCount,
  houseIndex,
  onReorderHouses,
  onCancelJoinRequest,
}: PendingHousePageProps) {
  const t = useTokens();
  const Typography = useTypography();
  const [pendingToCancel, setPendingToCancel] = useState<PendingJoinHouse | null>(null);

  return (
    <View style={[styles.screen, screenStyle]} testID="pending-house-page">
      <View style={styles.emptyWrap}>
        <HouseSwitcher
          icon={<Icon name="lock" size={14} color={t.textMuted} />}
          title={pendingHouse.name}
          showArrows={totalPages > 1}
          onPrev={onPrev}
          onNext={onNext}
        />
        <View style={[styles.pendingCard, { backgroundColor: t.surface }]}>
          <Icon name="lock" size={40} color={t.textDisabled} />
          <Text style={[Typography.h3, styles.pendingTitle, { color: t.text }]}>
            방장 승인을 기다리고 있어요
          </Text>
          <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
            승인되면 이 자리에 집이 열려요. 조금만 기다려 주세요!
          </Text>
          {pendingHouse.requestedAt ? (
            <Text style={[Typography.supporting, { color: t.textDisabled }]}>
              {pendingHouse.requestedAt.slice(0, 10).replace(/-/g, '.')} 신청
            </Text>
          ) : null}
          {onCancelJoinRequest ? (
            <ScalePressable
              onPress={() => setPendingToCancel(pendingHouse)}
              accessibilityRole="button"
              accessibilityLabel="입주 신청 취소"
              style={[styles.pendingCancelBtn, { borderColor: t.border }]}>
              <Text style={[Typography.label, { color: t.textMuted }]}>신청 취소</Text>
            </ScalePressable>
          ) : null}
        </View>
        {/* 대기 카드 페이지(#648)는 내 집이 아니라 정렬 대상에서 빠진다. */}
        <HouseOrderDots
          houses={orderableHouses}
          pendingCount={pendingCount}
          index={houseIndex}
          onReorder={onReorderHouses}
        />
      </View>

      <ConfirmDialog
        visible={pendingToCancel != null}
        title="입주 신청을 취소할까요?"
        body={
          pendingToCancel
            ? `'${pendingToCancel.name}' 집에 보낸 신청이 철회돼요. 초대코드가 있으면 다시 신청할 수 있어요.`
            : ''
        }
        confirmLabel="신청 취소"
        confirmAccessibilityLabel="신청 취소 확인"
        cancelLabel="유지"
        destructive
        onConfirm={() => {
          if (pendingToCancel) onCancelJoinRequest?.(pendingToCancel.requestId);
          setPendingToCancel(null);
        }}
        onCancel={() => setPendingToCancel(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  pendingCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  pendingTitle: {
    textAlign: 'center',
  },
  pendingCancelBtn: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
  },
});
