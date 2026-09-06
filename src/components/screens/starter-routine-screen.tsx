import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import type { StarterRoutine } from '@/constants/starter-routines';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type StarterRoutineScreenProps = {
  recommendations: StarterRoutine[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  needsReload?: boolean;
  onStart?: (routine: StarterRoutine) => void;
  onSkip?: () => void;
  onReload?: () => void;
};

/** A full page, without a form or tutorial overlay between choice and creation. */
export function StarterRoutineScreen({
  recommendations,
  loading = false,
  saving = false,
  error,
  needsReload = false,
  onStart,
  onSkip,
  onReload,
}: StarterRoutineScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const column = useResponsiveColumn();
  const screenStyle = useScreenStyle(['top', 'bottom']);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = recommendations.find((item) => item.id === selectedId);
  const busy = loading || saving;
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScrollView contentContainerStyle={[styles.body, column]}>
        <View style={styles.intro}>
          <Text style={[Typography.label, { color: t.primary }]}>나의 첫 루틴</Text>
          <Text style={[Typography.h1, { color: t.text }]}>작게 시작해볼까요?</Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            {recommendations[0]?.goalLabel === '가볍게 시작하기'
              ? '가볍게 시작할 루틴이에요.'
              : '관심사에 맞춰 골랐어요.'}
            {'\n'}
            하나만 골라 시작해보세요.
          </Text>
        </View>
        {recommendations.map((item) => {
          const checked = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={item.title}
              accessibilityState={{ checked, disabled: busy }}
              aria-checked={checked}
              disabled={busy}
              onPress={() => setSelectedId(item.id)}
              style={[
                styles.card,
                {
                  backgroundColor: t.surface,
                  borderColor: checked ? t.primary : t.border,
                },
              ]}>
              <View style={styles.cardCopy}>
                <Text style={[Typography.supporting, { color: t.primary }]}>{item.goalLabel}</Text>
                <Text style={[Typography.h3, { color: t.text }]}>{item.title}</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>매일 · 오늘부터</Text>
              </View>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: checked ? t.primary : t.border,
                    backgroundColor: checked ? t.primary : t.surface,
                  },
                ]}>
                {checked ? <Icon name="check" size={Spacing.four} color={t.onPrimary} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          완료하면 체크만 해주세요. 알림은 꺼져 있고, 반복과 시간은 나중에 바꿀 수 있어요.
        </Text>
        {loading ? (
          <ActivityIndicator accessibilityLabel="내 루틴 확인 중" color={t.primary} />
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={[Typography.body, { color: t.danger }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.actions, column]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || (!needsReload && !selected), busy: saving }}
          disabled={busy || (!needsReload && !selected)}
          onPress={() => (needsReload ? onReload?.() : selected && onStart?.(selected))}
          style={[
            styles.primary,
            { backgroundColor: t.primary, opacity: busy || (!needsReload && !selected) ? 0.5 : 1 },
          ]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {saving
              ? '루틴을 만들고 있어요'
              : needsReload
                ? '다시 확인하기'
                : '이 루틴으로 시작하기'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          accessibilityState={{ disabled: saving }}
          onPress={onSkip}
          style={styles.skip}>
          <Text style={[Typography.label, { color: t.textMuted }]}>나중에 할게요</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1 },
  intro: { gap: Spacing.two, marginBottom: Spacing.three },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: Spacing.half,
  },
  cardCopy: { flex: 1, gap: Spacing.two },
  check: {
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Radius.pill,
    borderWidth: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  primary: { padding: Spacing.three, alignItems: 'center', borderRadius: Radius.pill },
  skip: { padding: Spacing.three, alignItems: 'center' },
});
