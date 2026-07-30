import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult, GachaDrawCount } from '@/api';
import { Icon } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Overlay, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';
import { hapticImpact, hapticSuccess } from '@/utils/haptics';

type Phase = 'idle' | 'charging' | 'burst' | 'reveal';

/** Minimum charge-phase duration — keeps the build-up on screen even when the
 * draw API answers in a few hundred ms. */
const MIN_CHARGE_MS = 1800;
/** Burst transition (#431) — flash → rays/particles, then the reveal lands. */
const BURST_MS = 650;
/** 기본 레어도 — rarity가 없는(또는 미지의) 아이템의 뱃지·색 폴백. */
const DEFAULT_RARITY: Rarity = '일반';

/** 아이템 rarity 문자열 → 뱃지/버스트 색. 미지정·미지의 값은 기본 레어도 색. */
const rarityColor = (rarity?: string) =>
  RARITY_COLORS[(rarity as Rarity) ?? DEFAULT_RARITY] ?? RARITY_COLORS[DEFAULT_RARITY];

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
};

/**
 * Gacha screen, ported from the prototype `GachaScreen` + `GachaAnimation`, now
 * API-driven: machines and rewards come from the server, and a draw shows a
 * two-phase animation (charge build-up while the request is in flight → staggered
 * reward reveal). Uses the built-in Animated API (no worklets) so it runs in
 * tests.
 */
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
                      <Icon
                        name={box.costCurrencyType === 'COIN' ? 'coin' : 'diamond'}
                        size={12}
                        color={affordable ? t.onPrimary : t.textMuted}
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
    </View>
  );
}

/**
 * Animated box shown during the charge phase (#431): the shake escalates —
 * amplitude grows while the period shrinks over MIN_CHARGE_MS, then holds an
 * intense loop until the burst. The growing tension makes the same 1.8s read
 * far more dramatic than the old uniform wobble.
 */
function ChargingBox({ icon, accent }: { icon: PictogramName; accent: string }) {
  const t = useTokens();
  const grow = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 진폭↑·주기↓ 에스컬레이션 (~1760ms) 후 최고 강도 루프 유지.
    const steps: { amp: number; dur: number; reps: number }[] = [
      { amp: 1, dur: 280, reps: 1 },
      { amp: 1.7, dur: 200, reps: 1 },
      { amp: 2.4, dur: 150, reps: 2 },
      { amp: 3, dur: 100, reps: 1 },
    ];
    const seq: Animated.CompositeAnimation[] = [];
    for (const s of steps)
      for (let i = 0; i < s.reps; i++)
        seq.push(
          Animated.timing(shake, { toValue: s.amp, duration: s.dur, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -s.amp, duration: s.dur, useNativeDriver: true }),
        );
    const intense = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 3.4, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -3.4, duration: 70, useNativeDriver: true }),
      ]),
    );
    const escalate = Animated.sequence(seq);
    escalate.start(({ finished }) => finished && intense.start());
    const growAnim = Animated.timing(grow, {
      toValue: 1,
      duration: MIN_CHARGE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    growAnim.start();
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();
    return () => {
      escalate.stop();
      intense.stop();
      growAnim.stop();
      glowLoop.stop();
    };
  }, [grow, shake, glow]);

  const boxStyle = {
    transform: [
      { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
      { rotate: shake.interpolate({ inputRange: [-3.4, 3.4], outputRange: ['-12deg', '12deg'] }) },
    ],
  };
  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
  };

  return (
    <View style={styles.chargeWrap}>
      <Animated.View style={[styles.glowRing, glowStyle, { backgroundColor: t.primary }]} />
      <Animated.View style={[styles.chargeBox, boxStyle, { backgroundColor: accent }]}>
        <Pictogram name={icon} size={56} />
      </Animated.View>
    </View>
  );
}

/** 파티클 비산 좌표 — 버스트 중심에서 바깥으로 (#431). */
const BURST_PARTICLES = [
  { dx: -84, dy: -100 },
  { dx: 88, dy: -74 },
  { dx: -100, dy: 32 },
  { dx: 96, dy: 56 },
  { dx: -44, dy: -126 },
  { dx: 52, dy: -122 },
];

/**
 * Peak-moment burst (#431): white flash → rarity-colored rays + expanding ring
 * + particles. `strong` (희귀 이상) lengthens the rays and doubles particles;
 * 일반 keeps it short so the rarity difference is felt.
 */
function BurstOverlay({ color, strong }: { color: string; strong: boolean }) {
  const t = useTokens();
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: BURST_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [p]);

  const flashStyle = {
    opacity: p.interpolate({ inputRange: [0, 0.12, 0.32, 1], outputRange: [0.95, 0.65, 0, 0] }),
  };
  const ringStyle = {
    opacity: p.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.8, 0.15, 0] }),
    transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2] }) }],
  };
  const rayOpacity = p.interpolate({
    inputRange: [0, 0.2, 0.75, 1],
    outputRange: [0, 0.95, 0.35, 0],
  });
  const rayScale = p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.1, 1, 1.15] });
  const particles = strong ? BURST_PARTICLES : BURST_PARTICLES.slice(0, 3);
  const particleColors = [color, t.warning, t.primary];

  return (
    <View style={styles.burstWrap} pointerEvents="none" testID="gacha-burst">
      <Animated.View style={[styles.flash, flashStyle]} />
      {[0, 45, 90, 135].map((deg) => (
        <Animated.View
          key={deg}
          style={[
            styles.ray,
            { height: strong ? 260 : 150, backgroundColor: color, opacity: rayOpacity },
            { transform: [{ rotate: `${deg}deg` }, { scaleY: rayScale }] },
          ]}
        />
      ))}
      <Animated.View style={[styles.burstRing, ringStyle, { borderColor: color }]} />
      {particles.map((pt, i) => (
        <Animated.View
          key={`${pt.dx}-${pt.dy}`}
          style={[
            styles.particle,
            {
              backgroundColor: particleColors[i % particleColors.length],
              opacity: p.interpolate({
                inputRange: [0, 0.15, 0.85, 1],
                outputRange: [0, 1, 0.6, 0],
              }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.dx] }) },
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.dy] }) },
                { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Single-pull hero card (#431): slams down from above with a bounce — the
 * burst's momentum carries straight into the reward landing. */
function RevealCard({ item, index, large }: { item: DrawResult; index: number; large?: boolean }) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const p = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const color = rarityColor(item.rarity);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(p, {
        toValue: 1,
        duration: 620,
        delay: index * 120,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 160,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [p, fade, index]);

  const style = {
    opacity: fade,
    transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-180, 0] }) }],
  };

  return (
    <Animated.View
      style={[
        styles.revealCard,
        large && styles.revealCardLarge,
        style,
        { backgroundColor: t.surface, borderColor: color },
      ]}>
      {isCdnKey(item.assetKey) ? (
        <Image
          source={assetSource(item.assetKey)}
          style={large ? styles.revealArtLarge : styles.revealArt}
          contentFit="contain"
          transition={120}
        />
      ) : (
        <Icon name="gift" size={large ? 72 : 34} color={color} />
      )}
      <Text style={[styles.revealBadge, emph('bold'), { backgroundColor: color }]}>
        {item.rarity ?? DEFAULT_RARITY}
      </Text>
      <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={2}>
        {item.name}
      </Text>
      {item.converted ? (
        <Text style={[styles.convertNote, { color: t.textMuted }]}>
          중복 · 다이아 +{item.refundAmount ?? 0}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** 뒷면 카드가 깔린 뒤 자동 플립되는 간격 — 탭하면 그 카드는 즉시 뒤집힌다. */
const FLIP_DEAL_MS = 300;
const FLIP_STAGGER_MS = 70;
const FLIP_AUTO_BASE_MS = 500;
const FLIP_AUTO_STEP_MS = 110;

/**
 * 10연 reveal card (#431): deals in face-down from the top-right, then flips
 * on its own (staggered) or immediately on tap. 전설 cards leak a gold glow
 * before flipping so the good pull announces itself.
 */
function FlipCard({ item, index }: { item: DrawResult; index: number }) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const deal = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.3)).current;
  const [flipped, setFlipped] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const color = rarityColor(item.rarity);
  const legend = item.rarity === '전설';

  const runFlip = () => {
    clearTimeout(autoTimer.current ?? undefined);
    setFlipped((was) => {
      if (!was)
        Animated.timing(flip, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      return true;
    });
  };

  useEffect(() => {
    Animated.timing(deal, {
      toValue: 1,
      duration: FLIP_DEAL_MS,
      delay: index * FLIP_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    autoTimer.current = setTimeout(
      runFlip,
      index * FLIP_STAGGER_MS + FLIP_DEAL_MS + FLIP_AUTO_BASE_MS + index * FLIP_AUTO_STEP_MS,
    );
    return () => clearTimeout(autoTimer.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회 딜·예약
  }, []);

  useEffect(() => {
    if (!legend || flipped) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [legend, flipped, glow]);

  const dealStyle = {
    opacity: deal,
    transform: [
      { translateX: deal.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) },
      { translateY: deal.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) },
      { rotate: deal.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '0deg'] }) },
    ],
  };
  const backStyle = {
    transform: [
      { perspective: 850 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
    ],
  };
  const frontStyle = {
    transform: [
      { perspective: 850 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) },
    ],
  };

  return (
    <Animated.View style={[styles.flipWrap, dealStyle]}>
      {legend && !flipped ? (
        <Animated.View style={[styles.flipGlow, { backgroundColor: color, opacity: glow }]} />
      ) : null}
      <Pressable
        onPress={runFlip}
        disabled={flipped}
        accessibilityRole="button"
        accessibilityLabel={flipped ? (item.name ?? '아이템') : `${index + 1}번째 카드 뒤집기`}
        style={styles.flipInner}>
        <Animated.View style={[styles.flipFace, backStyle, { backgroundColor: t.primary }]}>
          <Pictogram name="paw" size={34} />
        </Animated.View>
        <Animated.View
          style={[styles.flipFace, frontStyle, { backgroundColor: t.surface, borderColor: color }]}>
          {isCdnKey(item.assetKey) ? (
            <Image
              source={assetSource(item.assetKey)}
              style={styles.revealArt}
              contentFit="contain"
              transition={120}
            />
          ) : (
            <Icon name="gift" size={34} color={color} />
          )}
          <Text style={[styles.revealBadge, emph('bold'), { backgroundColor: color }]}>
            {item.rarity ?? DEFAULT_RARITY}
          </Text>
          <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          {item.converted ? (
            <Text style={[styles.convertNote, { color: t.textMuted }]}>
              중복 · 다이아 +{item.refundAmount ?? 0}
            </Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    gap: 2,
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
  chargeWrap: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200 },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  chargeBox: {
    width: 120,
    height: 120,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealCardLarge: {
    width: 220,
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  revealArtLarge: {
    width: 150,
    height: 150,
  },
  revealCard: {
    width: 104,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  revealArt: {
    width: 68,
    height: 68,
  },
  revealBadge: {
    color: StaticWhite,
    fontSize: 10,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  convertNote: { fontSize: 10, textAlign: 'center' },

  // Burst (#431)
  burstWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  flash: {
    ...StyleSheet.absoluteFillObject,
    top: -600,
    bottom: -600,
    left: -300,
    right: -300,
    backgroundColor: StaticWhite,
  },
  ray: { position: 'absolute', width: 5, borderRadius: 3 },
  burstRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3 },
  particle: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },

  // 10연 flip reveal (#431)
  flipWrap: { width: 104, height: 158 },
  flipInner: { flex: 1 },
  flipGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: Radius.md,
  },
  flipFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    backfaceVisibility: 'hidden',
  },
  confirmBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    alignItems: 'center',
  },
});
