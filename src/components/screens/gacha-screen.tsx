import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult, GachaDrawCount, GachaRewardResponse } from '@/api';
import {
  BURST_MS,
  BurstOverlay,
  ChargingBox,
  DEFAULT_RARITY,
  FlipCard,
  MIN_CHARGE_MS,
  RevealCard,
  rarityColor,
} from '@/components/screens/gacha/draw-animation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { RewardRow } from '@/components/screens/gacha/reward-row';
import { RetryState } from '@/components/ui/retry-state';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Pictogram } from '@/components/ui/pictograms';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { track } from '@/lib/analytics';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';
import { hapticImpact, hapticSuccess } from '@/utils/haptics';

type Phase = 'idle' | 'charging' | 'burst' | 'reveal';

/** 레어도 우선순위 — 버스트 색은 뽑은 것 중 최고 레어도를 따른다. */
const bestRarity = (results: DrawResult[]): Rarity =>
  results.some((r) => r.rarity === '전설')
    ? '전설'
    : results.some((r) => r.rarity === '희귀')
      ? '희귀'
      : DEFAULT_RARITY;

/** 5+1 뽑기 (#520) — 6개 뽑고 비용은 단챠 5회분. */
const BONUS_DRAW_COUNT = 6;
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
  onDraw,
  onResultsConfirmed,
  placeableItemIds,
  onGoPlace,
  onLoadRewards,
}: GachaScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const headerInset = useHeaderInsetStyle();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pulled, setPulled] = useState<DrawResult[]>([]);
  // 버스트 연출 파라미터 (#431) — 최고 레어도의 색, 일반은 짧은 버스트.
  const [burstColor, setBurstColor] = useState(RARITY_COLORS[DEFAULT_RARITY]);
  const [burstStrong, setBurstStrong] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(revealTimer.current ?? undefined), []);
  // 보상 목록 시트 (#620) — 머신별 lazy 로드, 같은 머신 재열람은 캐시.
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewards, setRewards] = useState<GachaRewardResponse[] | null>(null);
  const rewardsForRef = useRef<number | null>(null);
  const openRewards = (gachaId: number) => {
    setRewardsOpen(true);
    if (rewardsForRef.current === gachaId && rewards) return;
    rewardsForRef.current = gachaId;
    setRewards(null);
    setRewardsLoading(true);
    void onLoadRewards?.(gachaId).then((res) => {
      // 다른 머신으로 갈아탄 뒤 도착한 응답은 버린다.
      if (rewardsForRef.current !== gachaId) return;
      setRewards(res);
      setRewardsLoading(false);
    });
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

  const box = gachas.find((b) => b.id === selectedId) ?? gachas[0];
  // Selector rows: themed furniture machines first, the character gacha below.
  const furnitureMachines = gachas.filter((b) => b.kind !== 'character');
  const characterMachines = gachas.filter((b) => b.kind === 'character');
  const balanceFor = (c: 'COIN' | 'DIAMOND') => (c === 'COIN' ? coinBalance : diamondBalance);
  const drawCost = (count: GachaDrawCount) =>
    box ? box.costAmount * (count === 1 ? 1 : BONUS_DRAW_COST_MULTIPLIER) : 0;
  const canAfford = (count: GachaDrawCount) =>
    box ? balanceFor(box.costCurrencyType) >= drawCost(count) : false;

  const pull = async (count: GachaDrawCount) => {
    if (!box || phase !== 'idle') return;
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
    hapticImpact();
    setPhase('charging');
    const started = Date.now();
    const results = await onDraw?.(box.id, count);
    if (!results) {
      setPhase('idle');
      setError('뽑기에 실패했어요.');
      return;
    }
    // The API answers fast — hold the charge build-up so the reveal lands
    // after a beat of anticipation instead of flashing by.
    const remain = MIN_CHARGE_MS - (Date.now() - started);
    if (remain > 0) await new Promise((r) => setTimeout(r, remain));
    setPulled(results);
    // 정점 버스트 (#431) — 최고 레어도 색의 광선·파티클, 전설은 햅틱 2연타.
    const best = bestRarity(results);
    setBurstColor(RARITY_COLORS[best]);
    setBurstStrong(best !== DEFAULT_RARITY);
    setPhase('burst');
    hapticSuccess();
    if (best === '전설') setTimeout(hapticSuccess, 180);
    revealTimer.current = setTimeout(() => setPhase('reveal'), BURST_MS);
  };

  const close = () => {
    clearTimeout(revealTimer.current ?? undefined);
    // 결과를 보고 닫는 경우에만 — 실패/취소 닫기에는 결과가 없다.
    if (pulled.length > 0) onResultsConfirmed?.();
    setPhase('idle');
    setPulled([]);
  };

  // '가구 배치하러 가기' (#630) — 결과 확인으로 간주(미션 타이밍 #571 동일)하고
  // 뽑은 가구 목록과 함께 꾸미기로 넘긴다.
  const goPlace = () => {
    const targets = placeablePulled;
    close();
    onGoPlace?.(targets);
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>뽑기</Text>
        <WalletPills coin={coinBalance} diamond={diamondBalance} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={t.primary} />
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              뽑기 목록 불러오는 중…
            </Text>
          </View>
        ) : null}
        {/* 로드 실패 (#549) — 빈 상태('뽑기 없음')로 위장하지 않는다. */}
        {!loading && loadError ? (
          <View style={styles.loadingBlock}>
            <RetryState message="뽑기 목록을 불러오지 못했어요." onRetry={onRetry} />
          </View>
        ) : null}
        {!loading && !loadError && gachas.length === 0 ? (
          <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
            지금은 뽑을 수 있는 뽑기가 없어요.
          </Text>
        ) : null}

        {/* Machine selector — one labeled row per machine kind. */}
        <View style={styles.selector}>
          {(
            [
              ['가구 뽑기', furnitureMachines],
              ['캐릭터 뽑기', characterMachines],
            ] as const
          ).map(([label, machines]) =>
            machines.length === 0 ? null : (
              <View key={label} style={styles.rowBlock}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.boxRow}>
                  {machines.map((b) => {
                    const active = b.id === box?.id;
                    return (
                      <ScalePressable
                        key={b.id}
                        onPress={() => {
                          setSelectedId(b.id);
                          setError('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={b.name}
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.boxChip,
                          {
                            backgroundColor: b.accent,
                            borderColor: active ? t.primary : 'transparent',
                          },
                        ]}>
                        <Pictogram name={b.icon} size={26} />
                      </ScalePressable>
                    );
                  })}
                </ScrollView>
              </View>
            ),
          )}
        </View>

        {/* Selected machine */}
        {box ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={[styles.boxHero, { backgroundColor: box.accent }]}>
              <Pictogram name={box.icon} size={56} />
            </View>
            <Text style={[Typography.h3, styles.center, { color: t.text }]}>{box.name}</Text>
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              1회 뽑기에 {box.drawCount}개 획득
            </Text>
            {/* 나올 수 있는 보상 (#620) — 뽑기 전 기대 관리. */}
            {onLoadRewards ? (
              <Pressable
                onPress={() => openRewards(box.id)}
                accessibilityRole="button"
                accessibilityLabel="나올 수 있는 보상 보기"
                style={styles.rewardsLink}>
                <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
                  나올 수 있는 보상 보기
                </Text>
                <Icon name="forward" size={12} color={t.primaryText} />
              </Pressable>
            ) : null}

            {error ? (
              <Text style={[Typography.supporting, styles.center, { color: t.danger }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.pullRow}>
              {([1, BONUS_DRAW_COUNT] as const).map((count) => {
                const affordable = canAfford(count);
                const cost = drawCost(count);
                const label = count === 1 ? '1회 뽑기' : '5+1회 뽑기';
                return (
                  <ScalePressable
                    key={count}
                    onPress={() => pull(count)}
                    disabled={phase !== 'idle'}
                    accessibilityState={{ disabled: !affordable }}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${cost.toLocaleString()} ${
                      box.costCurrencyType === 'COIN' ? '코인' : '다이아'
                    }`}
                    style={[
                      styles.pullBtn,
                      { backgroundColor: affordable ? t.primary : t.disabledBg },
                    ]}>
                    {/* onPrimary is dark in dark mode — unreadable on
                        disabledBg, so disabled text falls back to textMuted. */}
                    <Text
                      style={[Typography.label, { color: affordable ? t.onPrimary : t.textMuted }]}>
                      {label}
                    </Text>
                    <View style={styles.costRow}>
                      {/* 코인은 지갑 필과 같은 골드로 고정 (#742) — 활성/비활성
                          공통. 화폐 정체성은 색이 절반이라 버튼 틴트를 따르지
                          않는다. 다이아는 primary 버튼 배경과 겹쳐 보류. */}
                      <Icon
                        name={box.costCurrencyType === 'COIN' ? 'coin' : 'diamond'}
                        size={12}
                        color={
                          box.costCurrencyType === 'COIN'
                            ? t.warning
                            : affordable
                              ? t.onPrimary
                              : t.textMuted
                        }
                      />
                      <Text
                        style={[
                          Typography.supporting,
                          emph('semibold'),
                          { color: affordable ? t.onPrimary : t.textMuted },
                        ]}>
                        {cost.toLocaleString()}
                      </Text>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Pull animation overlay — a Modal so it fills the whole screen and
          centers regardless of the screen's safe-area padding. */}
      <Modal visible={phase !== 'idle'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          {phase === 'charging' ? (
            <>
              <ChargingBox icon={box?.icon ?? 'gift'} accent={box?.accent ?? '#E8DCC8'} />
              <Text style={[Typography.label, styles.overlayText]}>뽑는 중…</Text>
            </>
          ) : phase === 'burst' ? (
            <BurstOverlay color={burstColor} strong={burstStrong} />
          ) : (
            <>
              <Text style={[Typography.h3, styles.overlayText]}>축하해요!</Text>
              <ScrollView style={styles.revealScroll} contentContainerStyle={styles.revealGrid}>
                {pulled.length === 1 ? (
                  <RevealCard item={pulled[0]} index={0} large />
                ) : (
                  // 10연은 뒷면 카드가 깔린 뒤 순차 플립 — 탭하면 즉시 (#431).
                  pulled.map((it, idx) => (
                    <FlipCard key={`${it.name ?? 'item'}-${idx}`} item={it} index={idx} />
                  ))
                )}
              </ScrollView>
              {placeablePulled.length > 0 ? (
                <ScalePressable
                  onPress={goPlace}
                  accessibilityRole="button"
                  accessibilityLabel="가구 배치하러 가기"
                  style={[styles.goPlaceBtn, { backgroundColor: t.primary }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>가구 배치하러 가기</Text>
                </ScalePressable>
              ) : null}
              <ScalePressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="확인"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>확인</Text>
              </ScalePressable>
            </>
          )}
        </View>
      </Modal>

      {/* 나올 수 있는 보상 시트 (#620) — 등급 그룹 + 보유 배지, 확률 비노출. */}
      <BottomSheet
        visible={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        cardStyle={[styles.rewardsSheet, { backgroundColor: t.screen }]}>
        <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
        <Text style={[Typography.h3, styles.center, { color: t.text }]}>나올 수 있는 보상</Text>
        <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
          이미 가진 아이템이 나오면 다이아로 바뀌어요.
        </Text>
        {rewardsLoading ? (
          <View style={styles.rewardsBlock}>
            <ActivityIndicator color={t.primary} />
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
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- 보상 목록 시트 (#620) ---
  rewardsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  rewardsSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  rewardsBlock: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  rewardsList: {
    maxHeight: 420,
  },
  rewardsListBody: {
    paddingBottom: Spacing.two,
  },
  /** 같은 등급 안 행 사이 (구 rewardsGroup의 gap). */
  rewardGap: {
    height: Spacing.one,
  },
  rewardsGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.half,
  },
  /** 등급 사이 (구 rewardsListBody의 gap) — 첫 그룹 위에는 두지 않는다. */
  rewardsGroupGap: {
    marginTop: Spacing.three,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  screen: { flex: 1 },
  center: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.four, gap: Spacing.four },
  loadingBlock: { alignItems: 'center', paddingVertical: Spacing.six, gap: Spacing.two },
  selector: { gap: Spacing.two },
  rowBlock: { gap: Spacing.one },
  boxRow: { gap: Spacing.two, paddingVertical: Spacing.half },
  boxChip: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  boxHero: {
    height: 120,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pullRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pullBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    gap: Spacing.half,
  },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },

  // Pull animation overlay (rendered inside a full-screen Modal)
  overlay: {
    flex: 1,
    backgroundColor: Overlay.strong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  overlayText: { color: StaticWhite, textAlign: 'center' },
  revealScroll: { flexGrow: 0, maxHeight: '70%' },
  revealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    alignItems: 'center',
  },
  // 가구 배치하러 가기 (#630) — 확인 위의 주 행동 버튼.
  goPlaceBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
});
