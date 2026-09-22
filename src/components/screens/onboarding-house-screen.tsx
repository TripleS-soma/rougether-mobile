import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 서버 `PUT /onboarding/house`의 `choice` (#1407) — 좋아요 / 괜찮아요. */
export type OnboardingHouseChoice = 'AUTO_JOIN' | 'PERSONAL';

/**
 * 선택 결과 카드에 보여줄 것. `PERSONAL`은 알릴 게 없어 카드 없이 지나간다.
 * `JOINED`의 집 이름·인원은 상세 조회가 실패하면 비어 있을 수 있다.
 */
export type OnboardingHouseOutcome =
  { result: 'JOINED'; houseName?: string; memberCount?: number } | { result: 'NO_MATCH' };

export type OnboardingHouseScreenProps = {
  /** 있으면 결과 카드, 없으면 선택 화면. */
  outcome?: OnboardingHouseOutcome | null;
  /** 서버에 선택을 보내는 중 — 버튼 잠금 + 진행 표시. */
  saving?: boolean;
  onChoose?: (choice: OnboardingHouseChoice) => void;
  onContinue?: () => void;
};

/**
 * 온보딩 집 선택 (#1407, 서버 #389) — 첫 루틴 추천 뒤, 앱 진입 직전의 마지막 페이지.
 * "좋아요"는 자동 입주를 허용한 공개 집에 바로 합류하고, "괜찮아요"는 내 집에서 혼자 시작한다.
 * 순수 화면: 서버 호출은 `OnboardingHouseGate`가 한다.
 */
export function OnboardingHouseScreen({
  outcome,
  saving = false,
  onChoose,
  onContinue,
}: OnboardingHouseScreenProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const column = useResponsiveColumn();
  const screenStyle = useScreenStyle(['top', 'bottom']);

  if (outcome) {
    const joined = outcome.result === 'JOINED';
    const title = joined
      ? outcome.houseName
        ? tr('member.onboardingHouse.joinedTitle', { name: outcome.houseName })
        : tr('member.onboardingHouse.joinedTitleNoName')
      : tr('member.onboardingHouse.noMatchTitle');
    const body = joined
      ? outcome.memberCount != null
        ? tr('member.onboardingHouse.joinedBody', { count: outcome.memberCount })
        : tr('member.onboardingHouse.joinedBodyUnknown')
      : tr('member.onboardingHouse.noMatchBody');
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={[styles.resultBody, column]}>
          <View
            testID="onboarding-house-result"
            style={[styles.resultCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.resultEmoji, emph('normal')]}>{joined ? '🎉' : '🏠'}</Text>
            <Text style={[Typography.h2, styles.center, { color: t.text }]}>{title}</Text>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>{body}</Text>
          </View>
        </View>
        <View style={[styles.actions, column]}>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={[styles.primary, { backgroundColor: t.primary }]}>
            <Text style={[Typography.label, { color: t.onPrimary }]}>
              {tr('member.onboardingHouse.continue')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, screenStyle]}>
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <View style={styles.intro}>
          <Text style={[Typography.label, { color: t.primary }]}>
            {tr('member.onboardingHouse.eyebrow')}
          </Text>
          <Text style={[Typography.h1, { color: t.text }]}>
            {tr('member.onboardingHouse.title')}
          </Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            {tr('member.onboardingHouse.body')}
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator
            accessibilityLabel={tr('member.onboardingHouse.joiningA11y')}
            color={t.primary}
          />
        ) : null}
      </ScrollView>
      <View style={[styles.actions, column]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
          disabled={saving}
          onPress={() => onChoose?.('AUTO_JOIN')}
          style={[styles.choice, { backgroundColor: t.primary, opacity: saving ? 0.5 : 1 }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {tr('member.onboardingHouse.autoJoin')}
          </Text>
          <Text style={[Typography.supporting, emph('normal'), { color: t.onPrimary }]}>
            {tr('member.onboardingHouse.autoJoinHint')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => onChoose?.('PERSONAL')}
          style={[styles.choice, { backgroundColor: t.surfaceMuted, opacity: saving ? 0.5 : 1 }]}>
          <Text style={[Typography.label, { color: t.text }]}>
            {tr('member.onboardingHouse.personal')}
          </Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('member.onboardingHouse.personalHint')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1 },
  intro: { gap: Spacing.two, marginBottom: Spacing.three },
  resultBody: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  resultCard: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Radius.xl,
    borderWidth: Spacing.half,
  },
  resultEmoji: { fontSize: Spacing.six },
  center: { textAlign: 'center' },
  actions: { padding: Spacing.four, gap: Spacing.three },
  choice: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.xl,
  },
  primary: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.xl,
  },
});
