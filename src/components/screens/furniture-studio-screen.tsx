import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  FurnitureCreditBalance,
  FurnitureJob,
  FurniturePhoto,
} from '@/api/furniture-generation';
import { isFurnitureJobActive } from '@/api/furniture-generation';
import { MarketIssueSheet } from '@/components/screens/market/market-issue-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { useT } from '@/i18n';

export type FurnitureStudioScreenProps = {
  balance: FurnitureCreditBalance | null;
  jobs: FurnitureJob[];
  photo: FurniturePhoto | null;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  onChoosePhoto?: () => void;
  onSubmit?: () => void;
  onRetry?: () => void;
  onAttendance?: () => void;
  onGoToRoom?: () => void;
  onBack?: () => void;
  /**
   * 거래소에 올리기 (#1427) — 넘겼을 때만 완성된 가구에 버튼이 생긴다(셸은 MARKET_ENABLED일 때만
   * 넘긴다). 성공하면 true — 시트를 닫는다(상세로의 이동은 호출부 몫).
   */
  onIssue?: (userItemId: number, totalSupply: number) => Promise<boolean> | boolean | void;
};

export function FurnitureStudioScreen({
  balance,
  jobs,
  photo,
  loading,
  submitting,
  error,
  onChoosePhoto,
  onSubmit,
  onRetry,
  onAttendance,
  onGoToRoom,
  onBack,
  onIssue,
}: FurnitureStudioScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);
  const active = jobs.find(isFurnitureJobActive);
  const ready = !loading && !submitting && !active && (balance?.available ?? 0) > 0;
  // 거래소 발행 시트 — 고른 가구의 userItemId.
  const [issuing, setIssuing] = useState<number | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);
  const submitIssue = async (totalSupply: number) => {
    if (issuing == null || issueBusy) return;
    setIssueBusy(true);
    try {
      const ok = await Promise.resolve(onIssue?.(issuing, totalSupply));
      if (ok !== false) setIssuing(null);
    } finally {
      setIssueBusy(false);
    }
  };
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('roomShop.studio.title')} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        <View style={[styles.hero, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="sparkles" size={36} color={t.primaryText} />
          <Text style={[Typography.h2, { color: t.text }]}>{tr('roomShop.studio.heroTitle')}</Text>
          <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
            {tr('roomShop.studio.heroBody')}
          </Text>
          <View style={[styles.balance, { backgroundColor: t.surface }]}>
            <Icon name="ticket" size={18} color={t.primaryText} />
            <Text style={[Typography.label, { color: t.text }]}>
              {balance
                ? tr('roomShop.studio.credits', { n: balance.available })
                : tr('roomShop.studio.creditsChecking')}
              {balance && balance.reserved > 0
                ? tr('roomShop.studio.creditsReserved', { n: balance.reserved })
                : ''}
            </Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel={tr('roomShop.studio.creditsLoadingA11y')}
            color={t.primaryText}
          />
        ) : null}
        {error ? (
          <View accessibilityRole="alert" style={styles.section}>
            <Text style={[Typography.body, { color: t.danger }]}>{error}</Text>
            <Button
              label={tr('roomShop.studio.recheck')}
              variant="secondary"
              onPress={onRetry}
              disabled={submitting}
            />
          </View>
        ) : null}
        {active ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <ActivityIndicator color={t.primaryText} />
            <Text style={[Typography.h3, { color: t.text }]}>
              {tr('roomShop.studio.makingTitle')}
            </Text>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              {tr('roomShop.studio.makingBody')}
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
                contentFit="contain"
                accessibilityLabel={tr('roomShop.studio.photoA11y')}
              />
            ) : null}
            <Button
              label={tr(photo ? 'roomShop.studio.changePhoto' : 'roomShop.studio.choosePhoto')}
              leftIcon="camera"
              variant="secondary"
              onPress={onChoosePhoto}
              disabled={!ready}
            />
            {photo ? (
              <Button
                label={tr(submitting ? 'roomShop.studio.sending' : 'roomShop.studio.submit')}
                leftIcon="sparkles"
                onPress={onSubmit}
                disabled={!ready}
              />
            ) : null}
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('roomShop.studio.photoHint')}
            </Text>
          </View>
        )}
        {onAttendance ? (
          <View style={[styles.card, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.h3, { color: t.text }]}>
              {tr('roomShop.studio.attendanceTitle')}
            </Text>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              {tr('roomShop.studio.attendanceBody')}
            </Text>
            <Button
              label={tr('roomShop.studio.attendanceCta')}
              variant="secondary"
              onPress={onAttendance}
            />
          </View>
        ) : null}
        {jobs.length ? (
          <Text style={[Typography.h3, { color: t.text }]}>
            {tr('roomShop.studio.myFurniture')}
          </Text>
        ) : null}
        {jobs
          .filter((job) => !isFurnitureJobActive(job))
          .map((job) => (
            <View key={job.id} style={[styles.card, { backgroundColor: t.surface }]}>
              {job.assetKey ? (
                <Image
                  source={assetSource(job.assetKey)}
                  style={styles.result}
                  contentFit="contain"
                  accessibilityLabel={tr('roomShop.studio.resultA11y')}
                />
              ) : null}
              <Text style={[Typography.label, { color: t.text }]}>
                {tr(
                  job.status === 'SUCCEEDED'
                    ? 'roomShop.studio.succeeded'
                    : 'roomShop.studio.failed',
                )}
              </Text>
              {job.status === 'SUCCEEDED' || job.userItemId ? (
                <>
                  <Button
                    label={tr('roomShop.studio.placeInRoom')}
                    onPress={onGoToRoom}
                    variant="secondary"
                  />
                  {onIssue && job.userItemId != null ? (
                    <Button
                      label={tr('market.issue.cta')}
                      leftIcon="shop"
                      onPress={() => setIssuing(job.userItemId)}
                      variant="secondary"
                    />
                  ) : null}
                </>
              ) : (
                <Text style={[Typography.body, { color: t.textMuted }]}>
                  {tr('roomShop.studio.retryHint')}
                </Text>
              )}
            </View>
          ))}
      </ScrollView>
      {onIssue ? (
        <MarketIssueSheet
          visible={issuing != null}
          submitting={issueBusy}
          onSubmit={(n) => void submitIssue(n)}
          onClose={() => setIssuing(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  hero: {
    padding: Spacing.four,
    borderRadius: Radius.xl,
    gap: Spacing.three,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.pill,
  },
  section: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two },
  photo: { width: '100%', aspectRatio: 1, borderRadius: Radius.lg },
  result: { width: '100%', height: 160 },
});
