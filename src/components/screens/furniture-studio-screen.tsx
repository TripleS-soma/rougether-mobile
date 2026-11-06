import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  FurnitureCreditBalance,
  FurnitureJob,
  FurniturePhoto,
} from '@/api/furniture-generation';
import { FURNITURE_GENERATION_COIN_COST, isFurnitureJobActive } from '@/api/furniture-generation';
import { MarketIssueSheet } from '@/components/screens/market/market-issue-sheet';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { useT } from '@/i18n';

export type FurnitureStudioScreenProps = {
  balance: FurnitureCreditBalance | null;
  coinBalance?: number | null;
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
  onIssue?: (userItemId: number, price: number) => Promise<boolean> | boolean | void;
};

type StudioTab = 'make' | 'mine';
type JobFilter = 'all' | 'done' | 'failed';

/** 가구함에 가구가 남았는가 — 완성, 또는 재검수에 실패했어도 이전 완성본이 있는 경우. */
const hasFurniture = (job: FurnitureJob) => job.status === 'SUCCEEDED' || job.userItemId != null;

/** 상태 문구 키 — 목록 타일의 접근성 라벨과 시트 본문이 같은 말을 한다. */
const jobStatusKey = (job: FurnitureJob) =>
  job.status === 'SUCCEEDED'
    ? 'roomShop.studio.succeeded'
    : job.userItemId != null
      ? 'roomShop.studio.reviewFailed'
      : 'roomShop.studio.failed';

/** 2열 그리드용 — 홀수 개면 마지막 줄의 빈 칸을 남겨 타일 폭이 늘어나지 않게. */
function pairs<T>(list: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return rows;
}

export function FurnitureStudioScreen({
  balance,
  coinBalance = null,
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
  const usesCredit = (balance?.available ?? 0) > 0;
  const canAfford = usesCredit || (coinBalance ?? 0) >= FURNITURE_GENERATION_COIN_COST;
  const ready = !loading && !submitting && !active && balance != null && canAfford;
  // 거래소 발행 시트 — 고른 가구의 userItemId.
  const [issuing, setIssuing] = useState<number | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);
  /**
   * 만들기 / 내 가구 탭 (#1666) — 예전엔 한 스크롤에 만들기와 히스토리가 이어져, 하나 만들 때마다
   * 화면 한 칸짜리 카드가 쌓였다. 탭마다 스크롤이 따로고, 히스토리는 2열 그림 타일 + 상세 시트.
   */
  const [tab, setTab] = useState<StudioTab>('make');
  const [filter, setFilter] = useState<JobFilter>('all');
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const history = jobs.filter((job) => !isFurnitureJobActive(job));
  const failedCount = history.filter((job) => !hasFurniture(job)).length;
  const doneCount = history.length - failedCount;
  const shown =
    filter === 'all'
      ? history
      : history.filter((job) => (filter === 'done' ? hasFurniture(job) : !hasFurniture(job)));
  const openJob = history.find((job) => job.id === openJobId) ?? null;
  // 만들던 게 끝나면 결과가 있는 탭으로 — 기다린 사람이 결과를 찾으러 탭을 누르지 않게.
  const activeId = active?.id ?? null;
  const prevActiveId = useRef(activeId);
  useEffect(() => {
    if (prevActiveId.current && !activeId) {
      setFilter('all');
      setTab('mine');
    }
    prevActiveId.current = activeId;
  }, [activeId]);
  // 시트를 닫고 다음 동작으로 — 시트(모달) 위에 다른 시트·화면을 겹치지 않는다.
  const fromSheet = (run: () => void) => {
    setOpenJobId(null);
    run();
  };
  const submitIssue = async (price: number) => {
    if (issuing == null || issueBusy) return;
    setIssueBusy(true);
    try {
      const ok = await Promise.resolve(onIssue?.(issuing, price));
      if (ok !== false) setIssuing(null);
    } finally {
      setIssueBusy(false);
    }
  };
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('roomShop.studio.title')} onBack={onBack} />
      <View style={[styles.tabsWrap, column, { paddingTop: inset || Spacing.three }]}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={tr('roomShop.studio.tabsA11y')}
          style={[styles.tabs, { backgroundColor: t.surfaceMuted }]}>
          {(['make', 'mine'] as const).map((key) => {
            const selected = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  styles.tab,
                  selected && { backgroundColor: t.surface },
                  pressed && pressedStyle('dim', t),
                ]}>
                <Text style={[Typography.label, { color: selected ? t.text : t.textMuted }]}>
                  {key === 'make'
                    ? tr('roomShop.studio.tabMake')
                    : tr('roomShop.studio.tabMine', { n: history.length })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {tab === 'make' ? (
        <ScrollView contentContainerStyle={[styles.body, column]} testID="studio-make">
          <View style={[styles.hero, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="sparkles" size={36} color={t.primaryText} />
            <Text style={[Typography.h2, { color: t.text }]}>
              {tr('roomShop.studio.heroTitle')}
            </Text>
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
            {coinBalance != null ? (
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('roomShop.studio.coins', { n: coinBalance })}
              </Text>
            ) : null}
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              {tr('roomShop.studio.paymentHint', { n: FURNITURE_GENERATION_COIN_COST })}
            </Text>
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
                  label={tr(
                    submitting
                      ? 'roomShop.studio.sending'
                      : usesCredit
                        ? 'roomShop.studio.submit'
                        : 'roomShop.studio.submitCoins',
                    { n: FURNITURE_GENERATION_COIN_COST },
                  )}
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
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, column]} testID="studio-mine">
          {history.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="sparkles" size={28} color={t.textMuted} />
              <Text style={[Typography.body, { color: t.textMuted }]}>
                {tr('roomShop.studio.emptyMine')}
              </Text>
              <Button
                label={tr('roomShop.studio.goMake')}
                variant="secondary"
                onPress={() => setTab('make')}
              />
            </View>
          ) : null}
          {/* 실패가 있을 때만 거르기 — 없으면 '전체'만 남는 칩 줄은 소음이다. */}
          {failedCount > 0 ? (
            <View
              style={styles.filters}
              accessibilityRole="tablist"
              accessibilityLabel={tr('roomShop.studio.filterA11y')}>
              {(
                [
                  ['all', tr('roomShop.studio.filterAll', { n: history.length })],
                  ['done', tr('roomShop.studio.filterDone', { n: doneCount })],
                  ['failed', tr('roomShop.studio.filterFailed', { n: failedCount })],
                ] as const
              ).map(([key, label]) => {
                const selected = filter === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(key)}
                    style={({ pressed }) => [
                      styles.filter,
                      {
                        borderColor: selected ? t.primary : t.border,
                        backgroundColor: t.surface,
                      },
                      pressed && pressedStyle('dim', t),
                    ]}>
                    <Text
                      style={[
                        Typography.supporting,
                        { color: selected ? t.primaryText : t.textMuted },
                      ]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={styles.grid}>
            {pairs(shown).map((row) => (
              <View key={row.map((job) => job.id).join(':')} style={styles.gridRow}>
                {row.map((job) => {
                  const index = history.indexOf(job);
                  const failed = !hasFurniture(job);
                  const review = !failed && job.status !== 'SUCCEEDED';
                  return (
                    <Pressable
                      key={job.id}
                      accessibilityRole="button"
                      accessibilityLabel={tr('roomShop.studio.tileA11y', {
                        n: history.length - index,
                        status: tr(jobStatusKey(job)),
                      })}
                      onPress={() => setOpenJobId(job.id)}
                      style={({ pressed }) => [
                        styles.tile,
                        { backgroundColor: t.surface, borderColor: t.border },
                        pressed && pressedStyle('dim', t),
                      ]}>
                      <View style={[styles.tileArt, { backgroundColor: t.surfaceMuted }]}>
                        {job.assetKey ? (
                          <Image
                            source={assetSource(job.assetKey)}
                            style={styles.tileImage}
                            contentFit="contain"
                            accessible={false}
                          />
                        ) : (
                          <Icon name="sparkles" size={28} color={t.textMuted} />
                        )}
                      </View>
                      {failed || review ? (
                        <View style={[styles.badge, { backgroundColor: t.surface }]}>
                          <Text
                            style={[
                              Typography.supporting,
                              { color: failed ? t.danger : t.warningText },
                            ]}>
                            {tr(
                              failed
                                ? 'roomShop.studio.badgeFailed'
                                : 'roomShop.studio.badgeReview',
                            )}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
                {row.length === 1 ? <View style={styles.tileSpacer} /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <BottomSheet
        visible={openJob != null}
        accessibilityLabel={tr('roomShop.studio.sheetA11y')}
        onClose={() => setOpenJobId(null)}
        cardStyle={[styles.sheetCard, { backgroundColor: t.screen }]}>
        <SheetHandle />
        {openJob ? (
          <View style={styles.sheet}>
            {openJob.assetKey ? (
              <Image
                source={assetSource(openJob.assetKey)}
                style={styles.result}
                contentFit="contain"
                accessibilityLabel={tr('roomShop.studio.resultA11y')}
              />
            ) : null}
            <Text style={[Typography.label, { color: t.text }]}>{tr(jobStatusKey(openJob))}</Text>
            {openJob.status === 'FAILED' ? <FurnitureFailureNotice job={openJob} /> : null}
            {hasFurniture(openJob) ? (
              <>
                <Button
                  label={tr('roomShop.studio.placeInRoom')}
                  onPress={() => fromSheet(() => onGoToRoom?.())}
                />
                {onIssue && openJob.userItemId != null ? (
                  <Button
                    label={tr('market.issue.cta')}
                    leftIcon="shop"
                    onPress={() => {
                      const id = openJob.userItemId;
                      fromSheet(() => setIssuing(id));
                    }}
                    variant="secondary"
                  />
                ) : null}
              </>
            ) : (
              <Button
                label={tr('roomShop.studio.retryPhoto')}
                onPress={() =>
                  fromSheet(() => {
                    setTab('make');
                    onChoosePhoto?.();
                  })
                }
                disabled={!ready}
              />
            )}
            <Button
              label={tr('roomShop.studio.close')}
              variant="secondary"
              onPress={() => setOpenJobId(null)}
            />
          </View>
        ) : null}
      </BottomSheet>
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

function furnitureFailureKind(code: string | null) {
  switch (code) {
    case 'PHOTO_REJECTED':
    case 'IMAGE_GENERATION_REFUSED':
      return 'photo';
    case 'GENERATION_BUDGET_EXHAUSTED':
    case 'HARD_QA_REJECTED':
      return 'quality';
    case 'SOURCE_UPLOAD_FAILED':
    case 'SOURCE_UNAVAILABLE':
    case 'UPLOAD_EXPIRED':
      return 'upload';
    case 'QUEUE_WAIT_EXCEEDED':
    case 'EXECUTION_TIME_BUDGET_EXHAUSTED':
    case 'WORKER_INTERRUPTED':
    case 'JOB_EXPIRED':
      return 'timeout';
    default:
      return 'temporary';
  }
}

function FurnitureFailureNotice({ job }: { job: FurnitureJob }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const kind = furnitureFailureKind(job.failureCode);
  // Review details only explain photo or quality failures, not unrelated processing errors.
  const detail = ['PHOTO_REJECTED', 'GENERATION_BUDGET_EXHAUSTED'].includes(job.failureCode ?? '')
    ? job.reason?.trim()
    : null;
  return (
    <View accessibilityRole="alert" style={styles.section}>
      <Text style={[Typography.body, { color: t.text }]}>
        {detail || tr(`roomShop.studio.failure.${kind}.reason`)}
      </Text>
      {job.userItemId == null ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr(`roomShop.studio.failure.${kind}.hint`)}
        </Text>
      ) : null}
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr(
          job.userItemId != null
            ? 'roomShop.studio.failure.existingFurniture'
            : 'roomShop.studio.failure.creditReturned',
        )}
      </Text>
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
    borderCurve: 'continuous',
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
  result: { width: '100%', height: 200 },
  tabsWrap: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  tabs: { flexDirection: 'row', padding: Spacing.one, borderRadius: Radius.pill, gap: Spacing.one },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  filter: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  grid: { gap: Spacing.two },
  gridRow: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tileSpacer: { flex: 1 },
  tileArt: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  tileImage: { width: '86%', height: '86%' },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  // 다른 시트(거래소 판매 등)와 같은 카드 — 배경·윗모서리는 cardStyle로 넘긴다.
  sheetCard: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderCurve: 'continuous',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sheet: { gap: Spacing.three, paddingHorizontal: Spacing.four },
});
