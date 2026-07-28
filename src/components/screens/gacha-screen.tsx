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
import { Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';
import { hapticImpact, hapticSuccess } from '@/utils/haptics';

type Phase = 'idle' | 'charging' | 'reveal';

/** Minimum charge-phase duration — keeps the build-up on screen even when the
 * draw API answers in a few hundred ms. */
const MIN_CHARGE_MS = 1800;
const BONUS_DRAW_COUNT = 6;
const BONUS_DRAW_COST_MULTIPLIER = 5;

export type GachaScreenProps = {
  onBack?: () => void;
  /** Machines from the API (`GET /gacha`). */
  gachas?: GachaMachine[];
  /** True while the machine list is loading from the API. */
  loading?: boolean;
  coinBalance?: number;
  diaBalance?: number;
  /**
   * Draw from a machine (count: 1=단챠, 6=5+1회); resolves the drawn results, or
   * null on failure. Spending + dupe→dia conversion happen server-side; the
   * wallet is updated by the caller from the draw response.
   */
  onDraw?: (gachaId: number, count: GachaDrawCount) => Promise<DrawResult[] | null>;
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
  coinBalance = 0,
  diaBalance = 0,
  onDraw,
}: GachaScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const { show: toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pulled, setPulled] = useState<DrawResult[]>([]);

  const box = gachas.find((b) => b.id === selectedId) ?? gachas[0];
  // Selector rows: themed furniture machines first, the character gacha below.
  const furnitureMachines = gachas.filter((b) => b.kind !== 'character');
  const characterMachines = gachas.filter((b) => b.kind === 'character');
  const balanceFor = (c: 'COIN' | 'DIAMOND') => (c === 'COIN' ? coinBalance : diaBalance);
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
    setPhase('reveal');
    hapticSuccess();
  };

  const close = () => {
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
        <WalletPills coin={coinBalance} dia={diaBalance} />
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
        {!loading && gachas.length === 0 ? (
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
                      <Pressable
                        key={b.id}
                        onPress={() => {
                          setSelectedId(b.id);
                          setError('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={b.name}
                        style={[
                          styles.boxChip,
                          {
                            backgroundColor: b.accent,
                            borderColor: active ? t.primary : 'transparent',
                          },
                        ]}>
                        <Pictogram name={b.icon} size={26} />
                      </Pressable>
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
                  <Pressable
                    key={count}
                    onPress={() => pull(count)}
                    disabled={phase !== 'idle'}
                    accessibilityState={{ disabled: !affordable }}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${cost.toLocaleString()} ${
                      box.costCurrencyType === 'COIN' ? '코인' : '다이아'
                    }`}
                    style={({ pressed }) => [
                      styles.pullBtn,
                      { backgroundColor: affordable ? t.primary : t.disabledBg },
                      pressed && affordable && { backgroundColor: t.primaryActive },
                    ]}>
                    {/* onPrimary is dark in dark mode — unreadable on
                        disabledBg, so disabled text falls back to textMuted. */}
                    <Text
                      style={[Typography.label, { color: affordable ? t.onPrimary : t.textMuted }]}>
                      {label}
                    </Text>
                    <View style={styles.costRow}>
                      <Icon
                        name={box.costCurrencyType === 'COIN' ? 'coin' : 'dia'}
                        size={12}
                        color={affordable ? t.onPrimary : t.textMuted}
                      />
                      <Text
                        style={[styles.cost, { color: affordable ? t.onPrimary : t.textMuted }]}>
                        {cost.toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>
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
          ) : (
            <>
              <Text style={[Typography.h3, styles.overlayText]}>축하해요!</Text>
              <ScrollView style={styles.revealScroll} contentContainerStyle={styles.revealGrid}>
                {pulled.map((it, idx) => (
                  <RevealCard
                    key={`${it.name ?? 'item'}-${idx}`}
                    item={it}
                    index={idx}
                    large={pulled.length === 1}
                  />
                ))}
              </ScrollView>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="확인"
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>확인</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** Animated box shown during the charge phase: pulse + shake behind a glow ring. */
function ChargingBox({ icon, accent }: { icon: PictogramName; accent: string }) {
  const t = useTokens();
  const pulse = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, steps: { toValue: number; duration: number }[]) =>
      Animated.loop(
        Animated.sequence(steps.map((s) => Animated.timing(v, { ...s, useNativeDriver: true }))),
      );
    const anims = [
      loop(pulse, [
        { toValue: 1, duration: 300 },
        { toValue: 0, duration: 300 },
      ]),
      loop(shake, [
        { toValue: 1, duration: 120 },
        { toValue: -1, duration: 240 },
        { toValue: 0, duration: 120 },
      ]),
      loop(glow, [
        { toValue: 1, duration: 550 },
        { toValue: 0, duration: 550 },
      ]),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [pulse, shake, glow]);

  const boxStyle = {
    transform: [
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }) },
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

/** Reward card that pops in (scale + rotate) with a per-index stagger; a
 * single pull gets one large hero card. */
function RevealCard({ item, index, large }: { item: DrawResult; index: number; large?: boolean }) {
  const t = useTokens();
  const p = useRef(new Animated.Value(0)).current;
  const rarityColor = RARITY_COLORS[(item.rarity as Rarity) ?? '일반'] ?? RARITY_COLORS['일반'];

  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 420,
      delay: index * 120,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [p, index]);

  const style = {
    opacity: p,
    transform: [
      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
      { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.revealCard,
        large && styles.revealCardLarge,
        style,
        { backgroundColor: t.surface, borderColor: rarityColor },
      ]}>
      {isCdnKey(item.assetKey) ? (
        <Image
          source={assetSource(item.assetKey)}
          style={large ? styles.revealArtLarge : styles.revealArt}
          contentFit="contain"
          transition={120}
        />
      ) : (
        <Icon name="gift" size={large ? 72 : 34} color={rarityColor} />
      )}
      <Text style={[styles.revealBadge, { backgroundColor: rarityColor }]}>
        {item.rarity ?? '일반'}
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
  cost: { fontSize: 12, fontWeight: '600' },

  // Pull animation overlay (rendered inside a full-screen Modal)
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  overlayText: { color: '#FFFFFF', textAlign: 'center' },
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
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  convertNote: { fontSize: 10, textAlign: 'center' },
  confirmBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    alignItems: 'center',
  },
});
