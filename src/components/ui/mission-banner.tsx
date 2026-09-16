import { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GlassSurface } from '@/components/ui/glass-surface';
import { MissionFlagPictogram } from '@/components/ui/pictograms';
import { Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

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
  /**
   * 건너뛰기 노출 (#1023) — 설정 → '튜토리얼 다시 보기'로 시작된 체인에서만
   * 켠다. 첫 실행에는 출구를 두지 않는다는 결정이라 **기본값은 꺼짐**이다.
   */
  canSkip?: boolean;
};

/**
 * 온보딩 미션 진행 배너 (#571) — 관련 화면 상단에 셸이 띄우는 오버레이.
 * 탭하면 현재 미션 화면으로 이동하고, 우측 건너뛰기는 확인 다이얼로그를
 * 거쳐 체인 전체를 스킵한다. 건너뛰기는 다시 보기 경로에서만 켜진다(#1023).
 * 상태는 전부 prop — 다이얼로그 개폐만 로컬.
 */
export function MissionBanner({
  stepIndex,
  totalSteps,
  label,
  onPress,
  onSkip,
  canSkip = false,
}: MissionBannerProps) {
  const t = useTokens();
  const tr = useT();
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
      {/* 카드는 글래스 면 (#1050 후속) — 방·집 위에 뜨는 배너라 밑이 비친다. */}
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.card}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={tr('house.missionBanner.a11y', { n: stepIndex + 1, label })}
          style={styles.goArea}>
          <MissionFlagPictogram size={26} />
          <View style={styles.texts}>
            {/* 탭 어포던스 (#571 후속) — 배너가 실행 화면으로 데려다주는
                다리인데 눌러도 된다는 표시가 없었다. 기존 줄에 병합해
                배너 높이는 그대로. */}
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('house.missionBanner.progress', { n: stepIndex + 1, total: totalSteps })}
            </Text>
            <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </Pressable>
        {canSkip ? (
          <Pressable
            onPress={() => setConfirming(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('house.missionBanner.skipA11y')}
            hitSlop={8}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('house.missionBanner.skip')}
            </Text>
          </Pressable>
        ) : null}
      </GlassSurface>

      <ConfirmDialog
        visible={confirming}
        title={tr('house.missionBanner.skipConfirm.title')}
        body={tr('house.missionBanner.skipConfirm.body')}
        confirmLabel={tr('house.missionBanner.skipConfirm.label')}
        confirmAccessibilityLabel={tr('house.missionBanner.skipConfirm.a11y')}
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
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    // 화면 위에 뜨는 카드 — 토스트와 같은 그림자 결.
    elevation: 4,
    shadowColor: ShadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
});
