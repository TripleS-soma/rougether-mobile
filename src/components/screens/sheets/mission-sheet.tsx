import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MissionSheetProps = {
  visible: boolean;
  /** 방금 완료한 미션 번호 (1-base). */
  completedStep: number;
  totalSteps: number;
  /** 다음 미션 라벨 — null이면 마지막 미션 완료(축하 변형). */
  nextLabel?: string | null;
  /** 다음 미션을 어디서·어떻게 하는지 한 줄 (#571 후속). */
  nextHint?: string | null;
  /** '하러 가기' — 다음 미션 화면으로 이동. 부모가 시트도 닫는다. */
  onGo?: () => void;
  /** 백드롭 탭·나중에·확인 닫기. */
  onClose?: () => void;
};

/**
 * 미션 완료 전환 시트 (#571) — "미션 N 완료!"와 다음 미션으로 가는 손잡이.
 * 마지막 미션이면 축하 문구만 남기고 닫는다(배너는 이미 소멸).
 */
export function MissionSheet({
  visible,
  completedStep,
  totalSteps,
  nextLabel,
  nextHint,
  onGo,
  onClose,
}: MissionSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const last = nextLabel == null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.handle, { backgroundColor: t.border }]} />
      <Text style={[Typography.h2, { color: t.text }]}>
        {last
          ? tr('house.missionSheet.allDone')
          : tr('house.missionSheet.stepDone', { n: completedStep })}
      </Text>
      {last ? (
        <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
          {tr('house.missionSheet.allDoneBody', { n: totalSteps })}
        </Text>
      ) : (
        <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
          {tr('house.missionSheet.next', { label: nextLabel })}
          {/* 어디서·어떻게 한 줄 (#571 후속) — 방법을 몰라 막히는 이탈 방지. */}
          {nextHint ? `\n${nextHint}` : ''}
        </Text>
      )}
      <View style={styles.btns}>
        {last ? null : (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('house.missionSheet.laterA11y')}
            style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('house.missionSheet.later')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={last ? onClose : onGo}
          accessibilityRole="button"
          accessibilityLabel={
            last ? tr('house.missionSheet.finishA11y') : tr('house.missionSheet.goA11y')
          }
          style={[styles.btn, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {last ? tr('house.missionSheet.finish') : tr('house.missionSheet.go')}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.one,
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
