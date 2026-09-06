import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult, GachaDrawCount, GachaRewardResponse } from '@/api';
import {
  CinematicRevealShell,
  CinematicRewardStage,
  FlipCard,
  rarityColor,
} from '@/components/screens/gacha/draw-animation';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { Loading } from '@/components/ui/loading';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { GachaLobby } from '@/components/screens/gacha/gacha-lobby';
import giftRoom from '@/assets/images/gacha/gift-room-hero-v2.webp';
import { RewardRow } from '@/components/screens/gacha/reward-row';
import { RetryState } from '@/components/ui/retry-state';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { track } from '@/lib/analytics';
import { getCategoryGachas, getGachaCategory } from '@/constants/gacha';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { assetSource } from '@/resources/asset';
import { hapticImpact } from '@/utils/haptics';

type Phase = 'idle' | 'charging' | 'burst' | 'reveal';

/** 5+1 뽑기 (#520) — 6개 뽑고 비용은 단챠 5회분. */
const BONUS_DRAW_COST_MULTIPLIER = 5;

export type GachaScreenProps = {
  onBack?: () => void;
  /** Machines from the API (`GET /gacha`). */
  gachas?: GachaMachine[];
  /** True while the machine list is loading from the API. */
  loading?: boolean;
  /** True when the machine-list load failed (#549) — 빈 상태와 구분해 표시. */
  loadError?: boolean;
  /** Re-run the failed load (다시 시도 button). */
  onRetry?: () => void;
  coinBalance?: number;
  diamondBalance?: number;
  /** 테스트·Dev 프리뷰에서 시스템 동작 줄이기 값을 덮어쓴다. */
  reducedMotion?: boolean;
  /**
   * Draw from a machine (count: 1=단챠, 6=5+1회); resolves the drawn results, or
   * null on failure. Spending + dupe→diamond conversion happen server-side; the
   * wallet is updated by the caller from the draw response.
   */
  onDraw?: (gachaId: number, count: GachaDrawCount) => Promise<DrawResult[] | null>;
  /**
   * 결과 화면의 확인(닫기)을 눌러 뽑기 한 판이 끝난 순간 (#571 후속) —
   * 온보딩 미션 완료 시트가 뽑기 연출을 덮지 않도록, 셸은 여기서 미션을
   * 완료시킨다.
   */
  onResultsConfirmed?: () => void;
  /** 방에 놓을 수 있는 카탈로그 가구 id 목록 (#630) — DrawResult.itemId의 문자열. */
  placeableItemIds?: string[];
  /**
   * '가구 배치하러 가기' (#630, #622 개편) — 결과를 확인 처리하고 꾸미기 화면을
   * 연다. 셸은 전달받은 결과의 아이템을 카탈로그에서 NEW로 강조한다.
   */
  onGoPlace?: (results: DrawResult[]) => void;
  /**
   * 보상 목록 로드 (#620) — `GET /gacha/{id}/rewards`. 실패는 null(시트가
   * 다시 시도를 보여준다). 없으면 '나올 수 있는 보상' 진입점을 숨긴다.
   */
  onLoadRewards?: (gachaId: number) => Promise<GachaRewardResponse[] | null>;
  /** 설정 > 효과음 토글. 리빌 영상의 짧은 스팅/우시 효과도 이 값을 따른다. */
  soundEffectsEnabled?: boolean;
};

/** 보상 시트의 등급 그룹 순서 (#620) — 미지의 등급은 맨 뒤 '기타'. */
export const REWARD_RARITY_ORDER: readonly string[] = ['전설', '희귀', '일반'];

/** 등급 → 그룹 정렬 키; 목록은 희소한 것부터 보여준다. */
export function groupRewardsByRarity(
  rewards: GachaRewardResponse[],
): { rarity: string; items: GachaRewardResponse[] }[] {
  const buckets = new Map<string, GachaRewardResponse[]>();
  for (const r of rewards) {
    const key = REWARD_RARITY_ORDER.includes(r.rarity ?? '') ? (r.rarity as string) : '기타';
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }
  return [...REWARD_RARITY_ORDER, '기타']
    .filter((rarity) => buckets.has(rarity))
    .map((rarity) => ({ rarity, items: buckets.get(rarity)! }));
}

/**
 * Gacha screen, ported from the prototype `GachaScreen` + `GachaAnimation`, now
 * API-driven: machines and rewards come from the server, and a draw shows a
 * two-phase animation (charge build-up while the request is in flight → staggered
 * reward reveal). Uses the built-in Animated API (no worklets) so it runs in
 * tests.
 */
/** 같은 등급 안 행 사이 간격 (#773) — 모듈 스코프라 참조가 고정된다. */
function RewardGap() {
  return <View style={styles.rewardGap} />;
}

export function GachaScreen({
  onBack,
  gachas = [],
  loading = false,
  loadError = false,
  onRetry,
  coinBalance = 0,
  diamondBalance = 0,
  reducedMotion,
  onDraw,
  onResultsConfirmed,
  placeableItemIds,
  onGoPlace,
  onLoadRewards,
  soundEffectsEnabled = true,
}: GachaScreenProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemReducedMotion;
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const column = useResponsiveColumn(520);
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pulled, setPulled] = useState<DrawResult[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [openedCards, setOpenedCards] = useState<number[]>([]);
  const markRevealed = useCallback((index: number) => {
    setOpenedCards((current) => (current.includes(index) ? current : [...current, index]));
  }, []);
  const revealPlan = useMemo(
    () => buildRevealPlan(pulled, shouldReduceMotion),
    [pulled, shouldReduceMotion],
  );
  const skipRequested = useRef(false);
  const readyResults = useRef<DrawResult[] | null>(null);
  const drawRun = useRef(0);
  const drawBusy = useRef(false);
  // 보상 목록 시트 (#620) — 머신별 lazy 로드, 같은 머신 재열람은 캐시.
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewards, setRewards] = useState<GachaRewardResponse[] | null>(null);
  const rewardsForRef = useRef<number | null>(null);
  const rewardsRun = useRef(0);
  useEffect(
    () => () => {
      drawRun.current += 1;
      rewardsRun.current += 1;
    },
    [],
  );
  const openRewards = async (gachaId: number) => {
    setRewardsOpen(true);
    if (rewardsForRef.current === gachaId && rewards) return;
    const run = ++rewardsRun.current;
    rewardsForRef.current = gachaId;
    setRewards(null);
    setRewardsLoading(true);
    let response: GachaRewardResponse[] | null = null;
    try {
      response = (await onLoadRewards?.(gachaId)) ?? null;
    } catch {
      /* 시트에서 재시도 */
    }
    // 같은 머신을 떠났다가 다시 열어도 이전 요청이 새 결과를 덮지 않는다.
    if (rewardsForRef.current !== gachaId || rewardsRun.current !== run) return;
    setRewards(response);
    setRewardsLoading(false);
  };

  // 등급 그룹은 rewards가 바뀔 때만 재계산 (#678) — 시트가 열린 동안의
  // 무관한 리렌더(뽑기 연출 등)마다 다시 묶지 않는다.
  const rewardGroups = useMemo(() => (rewards ? groupRewardsByRarity(rewards) : []), [rewards]);
  // 등급 그룹 = 섹션 (#773) — 가상화를 위해 SectionList 형태로 옮긴다.
  const rewardSections = useMemo(
    () => rewardGroups.map((g, i) => ({ rarity: g.rarity, first: i === 0, data: g.items })),
    [rewardGroups],
  );
  const rewardKey = useCallback(
    (r: GachaRewardResponse, i: number) => `${r.rewardType}-${r.itemId ?? r.characterId ?? i}`,
    [],
  );
  const renderRaritySection = useCallback(
    ({ section }: { section: { rarity: string; first: boolean } }) => (
      <View style={[styles.rewardsGroupHead, section.first ? null : styles.rewardsGroupGap]}>
        <View style={[styles.rarityDot, { backgroundColor: rarityColor(section.rarity) }]} />
        <Text style={[Typography.supporting, emph('semibold'), { color: t.textMuted }]}>
          {section.rarity}
        </Text>
      </View>
    ),
    [Typography, emph, t.textMuted],
  );
  const renderRewardRow = useCallback(
    ({ item: r, index }: { item: GachaRewardResponse; index: number }) => (
      <RewardRow
        rowId={r.itemId ?? r.characterId ?? index}
        name={r.name}
        rarityColor={rarityColor(r.rarity)}
        assetKey={r.assetKey}
        isCharacter={r.rewardType === 'CHARACTER' || r.characterId != null}
        owned={r.owned}
      />
    ),
    [],
  );

  // 배치 가능한 신규 가구 (#630) — 있으면 리빌에 '가구 배치하러 가기'가 뜬다.
  const placeableSet = useMemo(() => new Set(placeableItemIds ?? []), [placeableItemIds]);
  const isPlaceable = (r: DrawResult) =>
    !r.converted && r.itemId != null && placeableSet.has(String(r.itemId));
  const placeablePulled = pulled.filter(isPlaceable);

  const machines = useMemo(() => getCategoryGachas(gachas), [gachas]);
  const box =
    machines.find((b) => b.id === selectedId) ??
    machines.find((b) => getGachaCategory(b) === 'FURNITURE') ??
    machines[0];
  const featuredRevealItem =
    revealPlan.items.find((item) => item.tier === revealPlan.bestTier) ?? revealPlan.items[0];
  const balanceFor = (c: 'COIN' | 'DIAMOND') => (c === 'COIN' ? coinBalance : diamondBalance);
  const drawCost = (count: GachaDrawCount) =>
    box ? box.costAmount * (count === 1 ? 1 : BONUS_DRAW_COST_MULTIPLIER) : 0;
  const canAfford = (count: GachaDrawCount) =>
    box ? balanceFor(box.costCurrencyType) >= drawCost(count) : false;

  const pull = async (count: GachaDrawCount) => {
    if (!box || drawBusy.current) return;
    // The button stays tappable when unaffordable — the tap says why.
    if (!canAfford(count)) {
      // 뽑기 앞에서 코인이 모자라 돌아서는 지점 (#799) — 퍼널의 흔한 막힘.
      track('purchase_blocked', {
        currency: box.costCurrencyType === 'DIAMOND' ? 'diamond' : 'coin',
        count,
      });
      toast('잔액이 부족해요', 'error');
      return;
    }
    setError('');
    drawBusy.current = true;
    skipRequested.current = false;
    readyResults.current = null;
    setPulled([]);
    setRevealAll(false);
    setOpenedCards([]);
    const run = ++drawRun.current;
    hapticImpact();
    setPhase('charging');
    let results: DrawResult[] | null | undefined;
    try {
      results = await onDraw?.(box.id, count);
    } catch {
      results = null;
    }
    if (run !== drawRun.current) return;
    if (!results?.length) {
      drawBusy.current = false;
      setPhase('idle');
      setError('뽑기에 실패했어요.');
      return;
    }
    // 결과 아트는 슬롯에만 꽂고, 연출 강도는 결과 중 최고 등급 프로필 하나가
    // 결정한다. 따라서 새 가구를 추가해도 화면 코드는 바뀌지 않는다.
    const plan = buildRevealPlan(results, shouldReduceMotion);
    const preloadUris = plan.items
      .map((item) =>
        item.renderKind === 'asset' && item.assetKey ? assetSource(item.assetKey).uri : null,
      )
      .filter((uri): uri is string => uri != null);
    if (preloadUris.length > 0) void Image.prefetch(preloadUris).catch(() => {});
    readyResults.current = results;
    setPulled(results);
    if (skipRequested.current || shouldReduceMotion) {
      setPhase('reveal');
      return;
    }
    // Anticipation is part of the video; network time adds no artificial charge wait.
    setPhase('burst');
  };

  const finishCinematic = useCallback(() => {
    if (drawBusy.current && readyResults.current) setPhase('reveal');
  }, []);

  const skipAnimation = () => {
    skipRequested.current = true;
    if (readyResults.current) setPhase('reveal');
  };

  const close = () => {
    if (!readyResults.current) return;
    readyResults.current = null;
    drawBusy.current = false;
    drawRun.current += 1;
    // 결과를 보고 닫는 경우에만 — 실패/취소 닫기에는 결과가 없다.
    if (pulled.length > 0) onResultsConfirmed?.();
    setPhase('idle');
    setPulled([]);
    readyResults.current = null;
    skipRequested.current = false;
  };

  // '가구 배치하러 가기' (#630) — 결과 확인으로 간주(미션 타이밍 #571 동일)하고
  // 뽑은 가구 목록과 함께 꾸미기로 넘긴다.
  const goPlace = () => {
    if (!readyResults.current) return;
    const targets = placeablePulled;
    close();
    onGoPlace?.(targets);
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader
        title="뽑기"
        onBack={onBack}
        right={<WalletPills coin={coinBalance} diamond={diamondBalance} />}
      />

      {loading ? (
        <View style={[styles.loadingBlock, { paddingTop: headerInset + Spacing.six }]}>
          <Loading />
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            뽑기 목록 불러오는 중...
          </Text>
        </View>
      ) : loadError ? (
        <View style={[styles.loadingBlock, { paddingTop: headerInset + Spacing.six }]}>
          <RetryState message="뽑기 목록을 불러오지 못했어요." onRetry={onRetry} />
        </View>
      ) : box ? (
        <View style={[styles.screen, column]}>
          <GachaLobby
            machines={machines}
            selected={box}
            onSelect={(selected) => {
              setSelectedId(selected.id);
              setError('');
              rewardsForRef.current = null;
              setRewardsOpen(false);
            }}
            onDraw={(count) => {
              void pull(count);
            }}
            onRewards={onLoadRewards ? () => openRewards(box.id) : undefined}
            canAfford={canAfford}
            busy={phase !== 'idle'}
            error={error}
            topInset={headerInset}
            bottomInset={insets.bottom}
          />
        </View>
      ) : (
        <View style={[styles.loadingBlock, { paddingTop: headerInset + Spacing.six }]}>
          <Icon name="gift" size={48} color={t.primary} />
          <Text style={[Typography.h3, { color: t.text }]}>새로운 선물을 준비하고 있어요</Text>
          <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
            벽지·바닥·가구 상자가 준비되면 여기서 만날 수 있어요.
          </Text>
          {onRetry ? (
            <ScalePressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="뽑기 목록 새로고침"
              style={styles.confirmBtn}>
              <Text style={[Typography.label, { color: t.primaryText }]}>새로고침</Text>
            </ScalePressable>
          ) : null}
        </View>
      )}

      {/* 영상·투명 아이템·결과가 동일한 전체 화면 좌표를 공유한다. */}
      <Modal
        visible={phase !== 'idle'}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType={shouldReduceMotion ? 'none' : 'fade'}
        onRequestClose={phase === 'reveal' ? close : skipAnimation}>
        <View style={[styles.overlay, { backgroundColor: t.screen }]}>
          {phase === 'charging' || phase === 'burst' ? (
            <Pressable
              onPress={skipAnimation}
              accessibilityRole="button"
              accessibilityLabel="뽑기 연출 건너뛰기"
              style={[
                styles.skipButton,
                { top: Math.max(insets.top, Spacing.three), backgroundColor: Overlay.dim },
              ]}>
              <Text style={[Typography.supporting, emph('semibold'), styles.skipText]}>
                건너뛰기
              </Text>
              <Icon name="forward" size={14} color={StaticWhite} />
            </Pressable>
          ) : null}
          {phase === 'charging' ? (
            <View style={styles.charging}>
              <Image source={giftRoom} style={styles.chargingArt} contentFit="cover" />
              <Loading />
              <Text style={[Typography.label, { color: t.text }]}>선물을 준비하고 있어요</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                잠깐만 기다려 주세요
              </Text>
            </View>
          ) : phase === 'burst' ? (
            <CinematicRevealShell
              entry={featuredRevealItem}
              profile={revealPlan.profile}
              soundEffectsEnabled={soundEffectsEnabled}
              reducedMotion={shouldReduceMotion}
              onComplete={finishCinematic}
            />
          ) : phase === 'reveal' ? (
            <>
              <CinematicRewardStage
                entry={featuredRevealItem}
                tier={revealPlan.bestTier}
                showArtwork={revealPlan.items.length === 1}
              />
              {revealPlan.items.length === 1 ? (
                <View style={styles.singleCaption} accessibilityLiveRegion="polite">
                  <Text style={[Typography.supporting, emph('semibold'), { color: t.onTint }]}>
                    {featuredRevealItem?.badgeLabel ?? '나만의 새로운 발견'}
                  </Text>
                  <Text
                    style={[Typography.h2, emph('bold'), styles.center, { color: t.onTint }]}
                    numberOfLines={2}>
                    {featuredRevealItem?.displayName}
                  </Text>
                  <Text style={[Typography.supporting, styles.center, { color: t.onTint }]}>
                    {featuredRevealItem?.conversionLabel
                      ? featuredRevealItem.conversionLabel
                      : '새로운 선물이 내 방을 기다려요'}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.multiResults,
                    { paddingTop: Math.max(insets.top, Spacing.four) + Spacing.four },
                  ]}>
                  <Text style={[Typography.supporting, emph('semibold'), { color: t.onTint }]}>
                    오늘 도착한 선물
                  </Text>
                  <Text style={[Typography.h2, emph('bold'), styles.center, { color: t.onTint }]}>
                    여섯 가지 작은 설렘
                  </Text>
                  <Text
                    style={[Typography.supporting, { color: t.onTint }]}
                    accessibilityLiveRegion="polite">
                    {openedCards.length === revealPlan.items.length
                      ? '선물을 모두 열었어요!'
                      : `카드를 눌러 열어보세요 · ${openedCards.length} / ${revealPlan.items.length}`}
                  </Text>
                  {openedCards.length < revealPlan.items.length ? (
                    <ScalePressable
                      onPress={() => setRevealAll(true)}
                      accessibilityRole="button"
                      accessibilityLabel="한 번에 열기"
                      style={[styles.openAllButton, { backgroundColor: t.surface }]}>
                      <Text style={[Typography.label, { color: t.text }]}>한 번에 열기</Text>
                    </ScalePressable>
                  ) : null}
                  <ScrollView
                    style={styles.revealScroll}
                    contentContainerStyle={styles.revealGrid}
                    showsVerticalScrollIndicator={false}>
                    {revealPlan.items.map((entry) => (
                      <FlipCard
                        key={`${entry.displayName}-${entry.index}`}
                        entry={entry}
                        reducedMotion={shouldReduceMotion}
                        revealAll={revealAll}
                        onReveal={markRevealed}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
              <View
                style={[
                  styles.resultActions,
                  { bottom: Math.max(insets.bottom, Spacing.three) + Spacing.two },
                ]}>
                {placeablePulled.length > 0 ? (
                  <ScalePressable
                    onPress={goPlace}
                    accessibilityRole="button"
                    accessibilityLabel="방 꾸미러 가기"
                    style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                    <Text style={[Typography.label, { color: t.onPrimary }]}>방 꾸미러 가기</Text>
                    <Icon name="forward" size={18} color={t.onPrimary} />
                  </ScalePressable>
                ) : null}
                <ScalePressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="확인"
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: placeablePulled.length ? t.surface : t.primary },
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      { color: placeablePulled.length ? t.text : t.onPrimary },
                    ]}>
                    확인
                  </Text>
                </ScalePressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* 나올 수 있는 보상 시트 (#620) — 등급 그룹 + 보유 배지, 확률 비노출. */}
      <BottomSheet
        visible={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        cardStyle={[styles.rewardsSheet, { backgroundColor: t.screen }]}>
        <SheetHandle />
        <Text style={[Typography.h3, styles.center, { color: t.text }]}>나올 수 있는 보상</Text>
        <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
          이미 가진 아이템이 나오면 다이아로 바뀌어요.
        </Text>
        {rewardsLoading ? (
          <View style={styles.rewardsBlock}>
            <Loading />
          </View>
        ) : rewards == null ? (
          <View style={styles.rewardsBlock}>
            <RetryState
              message="보상 목록을 불러오지 못했어요."
              onRetry={() => {
                rewardsForRef.current = null;
                if (box) openRewards(box.id);
              }}
            />
          </View>
        ) : (
          <SheetDragExclude>
            <SectionList
              style={styles.rewardsList}
              contentContainerStyle={styles.rewardsListBody}
              sections={rewardSections}
              keyExtractor={rewardKey}
              renderSectionHeader={renderRaritySection}
              renderItem={renderRewardRow}
              // 등급 안은 촘촘히, 등급 사이는 넓게 — 예전 2단 간격 구조를 유지한다
              // (#773). SectionList는 헤더·아이템을 형제로 평탄화하므로 컨테이너
              // gap 하나만 두면 그룹 경계가 사라진다.
              ItemSeparatorComponent={RewardGap}
              // iOS 기본값이 true라 그냥 두면 등급 헤더가 상단에 붙는 동작이
              // 이 플랫폼에만 새로 생긴다 — 기존 ScrollView엔 없던 동작.
              stickySectionHeadersEnabled={false}
              // 보상 풀은 머신당 수십~수백 — 시트를 여는 프레임에 전부 마운트하면
              // 원격 썸네일까지 한꺼번에 요청된다 (#773).
              initialNumToRender={12}
              windowSize={7}
              removeClippedSubviews
            />
          </SheetDragExclude>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { textAlign: 'center' },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  rewardsSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  rewardsBlock: { paddingVertical: Spacing.five, alignItems: 'center' },
  rewardsList: { maxHeight: 420 },
  rewardsListBody: { paddingBottom: Spacing.two },
  rewardGap: { height: Spacing.one },
  rewardsGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.half,
  },
  rewardsGroupGap: { marginTop: Spacing.three },
  rarityDot: { width: 8, height: 8, borderRadius: Radius.pill },
  overlay: { flex: 1 },
  charging: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  chargingArt: { width: '100%', maxWidth: 520, aspectRatio: 4 / 3 },
  skipButton: {
    position: 'absolute',
    right: Spacing.four,
    zIndex: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  skipText: { color: StaticWhite },
  singleCaption: {
    position: 'absolute',
    top: '67%',
    left: Spacing.four,
    right: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  multiResults: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 164,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  revealScroll: { marginTop: Spacing.three, width: '100%' },
  openAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  revealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    paddingBottom: Spacing.three,
  },
  resultActions: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    maxWidth: 472,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  confirmBtn: {
    minHeight: 50,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
