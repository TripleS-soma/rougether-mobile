import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import type { StarterRoutine } from '@/constants/starter-routines';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

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
  const tr = useT();
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
          <Text style={[Typography.label, { color: t.primary }]}>
            {tr('member.starterRoutine.eyebrow')}
          </Text>
          <Text style={[Typography.h1, { color: t.text }]}>
            {tr('member.starterRoutine.title')}
          </Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            {recommendations[0]?.goalLabel === tr('member.starterRoutine.lightStart')
              ? tr('member.starterRoutine.bodyLight')
              : tr('member.starterRoutine.bodyMatched')}
            {'\n'}
            {tr('member.starterRoutine.bodyPickOne')}
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
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('member.starterRoutine.schedule')}
                </Text>
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
          {tr('member.starterRoutine.footnote')}
        </Text>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel={tr('member.starterRoutine.checkingA11y')}
            color={t.primary}
          />
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
              ? tr('member.starterRoutine.creating')
              : needsReload
                ? tr('member.starterRoutine.recheck')
                : tr('member.starterRoutine.startWithThis')}
          </Text>
        </Pressable>
        {/* 건너뛰기는 서버 오류로 추천을 못 받았을 때만 (#1324) — 루틴 없이 튜토리얼에
            들어가면 첫 미션(루틴 완료)을 할 수 없다. 정상 경로엔 출구가 없다. */}
        {error ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            accessibilityState={{ disabled: saving }}
            onPress={onSkip}
            style={styles.skip}>
            <Text style={[Typography.label, { color: t.textMuted }]}>
              {tr('member.starterRoutine.later')}
            </Text>
          </Pressable>
        ) : null}
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
