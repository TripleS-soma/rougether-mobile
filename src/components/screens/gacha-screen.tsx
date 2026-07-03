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
import type { DrawResult } from '@/api/types';
import { Icon } from '@/components/ui/icon';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { hapticImpact, hapticSuccess } from '@/utils/haptics';

const RARITY_COLOR: Record<string, string> = {
  일반: '#9AA0A6',
  희귀: '#7FA8D4',
  전설: '#E8A24A',
};
const DISABLED = '#D4C4B0';

type Phase = 'idle' | 'charging' | 'reveal';

export type GachaScreenProps = {
  onBack?: () => void;
  /** Machines from the API (`GET /gacha`). */
  gachas?: GachaMachine[];
  /** True while the machine list is loading from the API. */
  loading?: boolean;
  coinBalance?: number;
  diaBalance?: number;
  /**
   * Draw once from a machine; resolves the drawn results, or null on failure.
   * Spending + dupe→dia conversion happen server-side; the wallet is updated by
   * the caller from the draw response.
   */
  onDraw?: (gachaId: number) => Promise<DrawResult[] | null>;
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pulled, setPulled] = useState<DrawResult[]>([]);

  const box = gachas.find((b) => b.id === selectedId) ?? gachas[0];
  const balanceFor = (c: 'COIN' | 'DIAMOND') => (c === 'COIN' ? coinBalance : diaBalance);
  const affordable = box ? balanceFor(box.costCurrencyType) >= box.costAmount : false;

  const pull = async () => {
    if (!box || phase !== 'idle') return;
    if (!affordable) {
      setError('잔액이 부족해요.');
      return;
    }
    setError('');
    hapticImpact();
    setPhase('charging');
    const results = await onDraw?.(box.id);
    if (!results) {
      setPhase('idle');
      setError('뽑기에 실패했어요.');
      return;
    }
    setPulled(results);
    setPhase('reveal');
    hapticSuccess();
  };

  const close = () => {
    setPhase('idle');
    setPulled([]);
  };

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>가챠</Text>
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

        {/* Machine selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boxRow}>
          {gachas.map((b) => {
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
                  { backgroundColor: b.accent, borderColor: active ? t.primary : 'transparent' },
                ]}>
                <Text style={styles.boxChipIcon}>{b.icon}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Selected machine */}
        {box ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={[styles.boxHero, { backgroundColor: box.accent }]}>
              <Text style={styles.boxHeroIcon}>{box.icon}</Text>
            </View>
            <Text style={[Typography.h3, styles.center, { color: t.text }]}>{box.name}</Text>
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              1회 뽑기에 {box.drawCount}개 획득
            </Text>

            {error ? (
              <Text style={[Typography.supporting, styles.center, { color: '#D67878' }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={pull}
              disabled={!affordable || phase !== 'idle'}
              accessibilityRole="button"
              accessibilityLabel={`뽑기, ${box.costAmount.toLocaleString()} ${
                box.costCurrencyType === 'COIN' ? '코인' : '다이아'
              }`}
              style={({ pressed }) => [
                styles.pullBtn,
                { backgroundColor: affordable ? t.primary : DISABLED },
                pressed && affordable && { backgroundColor: t.primaryActive },
              ]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>뽑기</Text>
              <View style={styles.costRow}>
                <Icon
                  name={box.costCurrencyType === 'COIN' ? 'coin' : 'dia'}
                  size={12}
                  color={t.onPrimary}
                />
                <Text style={[styles.cost, { color: t.onPrimary }]}>
                  {box.costAmount.toLocaleString()}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Pull animation overlay — a Modal so it fills the whole screen and
          centers regardless of the screen's safe-area padding. */}
      <Modal visible={phase !== 'idle'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          {phase === 'charging' ? (
            <>
              <ChargingBox icon={box?.icon ?? '🎁'} accent={box?.accent ?? '#E8DCC8'} />
              <Text style={[Typography.label, styles.overlayText]}>뽑는 중…</Text>
            </>
          ) : (
            <>
              <Text style={[Typography.h3, styles.overlayText]}>축하해요!</Text>
              <ScrollView style={styles.revealScroll} contentContainerStyle={styles.revealGrid}>
                {pulled.map((it, idx) => (
                  <RevealCard key={`${it.name ?? 'item'}-${idx}`} item={it} index={idx} />
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
function ChargingBox({ icon, accent }: { icon: string; accent: string }) {
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
        <Text style={styles.chargeIcon}>{icon}</Text>
      </Animated.View>
    </View>
  );
}

/** Reward card that pops in (scale + rotate) with a per-index stagger. */
function RevealCard({ item, index }: { item: DrawResult; index: number }) {
  const t = useTokens();
  const p = useRef(new Animated.Value(0)).current;
  const rarityColor = RARITY_COLOR[item.rarity ?? '일반'] ?? RARITY_COLOR['일반'];

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
      style={[styles.revealCard, style, { backgroundColor: t.surface, borderColor: rarityColor }]}>
      <Icon name="gift" size={34} color={rarityColor} />
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
  boxRow: { gap: Spacing.two, paddingVertical: Spacing.half },
  boxChip: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChipIcon: { fontSize: 26 },
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
  boxHeroIcon: { fontSize: 56 },
  pullBtn: {
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
  chargeIcon: { fontSize: 56 },
  revealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealCard: {
    width: 96,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
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
