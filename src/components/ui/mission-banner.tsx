import { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type MissionBannerProps = {
  /** 현재 미션 index (0-base) — 표기는 N/4. */
  stepIndex: number;
  totalSteps: number;
  /** 현재 미션 라벨 (예: '첫 루틴 등록하기'). */
  label: string;
  /** 배너 탭 — 미션 화면으로 이동. */
  onPress?: () => void;
  /** 건너뛰기 확정(확인 다이얼로그 통과) — 체인 전체 스킵. */
  onSkip?: () => void;
};

/**
 * 온보딩 미션 진행 배너 (#571) — 관련 화면 상단에 셸이 띄우는 오버레이.
 * 탭하면 현재 미션 화면으로 이동하고, 우측 건너뛰기는 확인 다이얼로그를
 * 거쳐 체인 전체를 스킵한다. 상태는 전부 prop — 다이얼로그 개폐만 로컬.
 */
export function MissionBanner({
  stepIndex,
  totalSteps,
  label,
  onPress,
  onSkip,
}: MissionBannerProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useContext(SafeAreaInsetsContext);
  const [confirming, setConfirming] = useState(false);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: (insets?.top ?? 0) + Spacing.two }]}
      testID="mission-banner">
      {/* 카드 = 형제 Pressable 2개 — 버튼 안 버튼 중첩은 웹에서 hydration
          경고를 내므로(button-in-button) 이동·건너뛰기를 나란히 둔다. */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`미션 ${stepIndex + 1} ${label}`}
          style={styles.goArea}>
          <Text style={styles.emoji}>🎯</Text>
          <View style={styles.texts}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              미션 {stepIndex + 1}/{totalSteps}
            </Text>
            <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setConfirming(true)}
          accessibilityRole="button"
          accessibilityLabel="미션 건너뛰기"
          hitSlop={8}>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={confirming}
        title="미션을 건너뛸까요?"
        body="남은 온보딩 미션 안내가 사라져요. 설정의 튜토리얼 다시 보기로 언제든 다시 시작할 수 있어요."
        confirmLabel="건너뛰기"
        confirmAccessibilityLabel="미션 건너뛰기 확인"
        onConfirm={() => {
          setConfirming(false);
          onSkip?.();
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    zIndex: 50,
    elevation: 50,
  },
  goArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    // 화면 위에 뜨는 카드 — 토스트와 같은 그림자 결.
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  emoji: {
    fontSize: 20,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
