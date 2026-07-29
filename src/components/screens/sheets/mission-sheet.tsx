import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type MissionSheetProps = {
  visible: boolean;
  /** 방금 완료한 미션 번호 (1-base). */
  completedStep: number;
  totalSteps: number;
  /** 다음 미션 라벨 — null이면 마지막 미션 완료(축하 변형). */
  nextLabel?: string | null;
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
  onGo,
  onClose,
}: MissionSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const last = nextLabel == null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.handle, { backgroundColor: t.border }]} />
      <Text style={[Typography.h2, { color: t.text }]}>
        {last ? '🎉 모든 미션 완료!' : `✅ 미션 ${completedStep} 완료!`}
      </Text>
      {last ? (
        <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
          {totalSteps}개 미션을 모두 마쳤어요. 이제 루틴을 쌓고 방을 꾸미며 루게더를 마음껏
          즐겨보세요!
        </Text>
      ) : (
        <Text style={[Typography.body, styles.body, { color: t.textMuted }]}>
          다음 미션: {nextLabel}
        </Text>
      )}
      <View style={styles.btns}>
        {last ? null : (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="나중에 하기"
            style={[styles.btn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: t.text }]}>나중에</Text>
          </Pressable>
        )}
        <Pressable
          onPress={last ? onClose : onGo}
          accessibilityRole="button"
          accessibilityLabel={last ? '미션 마치기' : '다음 미션 하러 가기'}
          style={[styles.btn, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {last ? '좋아요!' : '하러 가기'}
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
    lineHeight: 22,
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
