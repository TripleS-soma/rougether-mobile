import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/screens/onboarding/onboarding-buttons';
import { onboardingStyles as styles } from '@/components/screens/onboarding/onboarding-styles';
import { Icon } from '@/components/ui/icon';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 온보딩 목표 설문 — 첫 실행의 첫 단계(#1282). 선택 상태는 부모가 갖는다(리팩토링 장부 25번).
 */
export function GoalStep({
  screenStyle,
  goalOptions,
  selectedGoals,
  onToggle,
  onNext,
  onPrevious,
}: {
  screenStyle: StyleProp<ViewStyle>;
  goalOptions: { id: string; label: string }[];
  selectedGoals: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  /** 다시 보기에서만 — 소개로 돌아간다. */
  onPrevious?: () => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const canStart = selectedGoals.length > 0;
  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={styles.intro}>
        <Text style={[Typography.h1, { color: t.text }]}>{tr('member.onboarding.goalTitle')}</Text>
        <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
          {tr('member.onboarding.goalBody')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {goalOptions.map((g) => {
          const selected = selectedGoals.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => onToggle(g.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[
                styles.goalCard,
                { backgroundColor: t.surface, borderColor: selected ? t.primary : 'transparent' },
              ]}>
              <Text style={[Typography.label, { color: t.text }]}>{g.label}</Text>
              {selected ? (
                <View style={styles.goalCheck}>
                  <Check tint={t.primary} on={t.onPrimary} small />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <PrimaryButton
          label={tr('member.common.start')}
          disabled={!canStart}
          blockedMessage={tr('member.onboarding.goalRequired')}
          onPress={() => canStart && onNext()}
        />
        {onPrevious ? (
          <TextButton label={tr('member.common.previous')} onPress={onPrevious} />
        ) : null}
      </View>
    </View>
  );
}

function Check({ tint, on, small }: { tint: string; on: string; small?: boolean }) {
  const size = small ? 22 : 28;
  return (
    <View
      style={[
        styles.checkCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
      ]}>
      <Icon name="check" size={small ? 14 : 16} color={on} />
    </View>
  );
}
