import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

type Rarity = '일반' | '희귀' | '전설';
const RARITY_COLOR: Record<Rarity, string> = {
  일반: '#9AA0A6',
  희귀: '#7FA8D4',
  전설: '#E8A24A',
};
const DISABLED = '#D4C4B0';
const COST = { single: 250, multi: 1250 };
/** Charge (build-up) duration before the reward reveal. */
const CHARGE_MS = 1600;

type GachaItem = { name: string; icon: string; rarity: Rarity };
type GachaBox = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  obtained: number;
  total: number;
  pool: GachaItem[];
};

type Phase = 'idle' | 'charging' | 'reveal';

// Box metadata (web gradient/particle/animation fields dropped). The hanok pool
// uses placeholder items until the furniture system is ported.
const BOXES: GachaBox[] = [
  {
    id: 'hanok',
    name: '고즈넉 한옥 테마',
    icon: '🏯',
    accent: '#E8DCC8',
    obtained: 3,
    total: 12,
    pool: [
      { name: '청사초롱', icon: '🏮', rarity: '전설' },
      { name: '다기 세트', icon: '🍵', rarity: '희귀' },
      { name: '문창살 창문', icon: '🪟', rarity: '일반' },
      { name: '난초 화분', icon: '🪴', rarity: '일반' },
    ],
  },
  {
    id: 'forest',
    name: '숲 속 세이지 테마',
    icon: '🌿',
    accent: '#D6E4D2',
    obtained: 0,
    total: 12,
    pool: [
      { name: '작은 새 둥지', icon: '🪺', rarity: '전설' },
      { name: '그루터기 의자', icon: '🪵', rarity: '희귀' },
      { name: '버섯 조명', icon: '🍄', rarity: '희귀' },
      { name: '이끼 화분', icon: '🪴', rarity: '일반' },
    ],
  },
  {
    id: 'bakery',
    name: '작은 베이커리 아침 테마',
    icon: '🥐',
    accent: '#F7E6C8',
    obtained: 0,
    total: 12,
    pool: [
      { name: '에스프레소 머신', icon: '☕', rarity: '전설' },
      { name: '빵 진열대', icon: '🥖', rarity: '희귀' },
      { name: '구움 오븐', icon: '🔥', rarity: '희귀' },
      { name: '크루아상 바구니', icon: '🥐', rarity: '일반' },
    ],
  },
  {
    id: 'space',
    name: '포근한 우주 테마',
    icon: '🌙',
    accent: '#D8D2EC',
    obtained: 0,
    total: 12,
    pool: [
      { name: '달 무드등', icon: '🌙', rarity: '전설' },
      { name: '별자리 러그', icon: '✨', rarity: '희귀' },
      { name: '행성 모빌', icon: '🪐', rarity: '희귀' },
      { name: '구름 쿠션', icon: '☁️', rarity: '일반' },
    ],
  },
];

export type GachaScreenProps = {
  onBack?: () => void;
  leafBalance?: number;
  onSpendLeaves?: (amount: number) => boolean;
  onObtain?: (items: string[]) => void;
};

/**
 * Gacha screen, ported from the prototype `GachaScreen` + `GachaAnimation`. Box
 * selection + single / multi pull with leaf cost, and a two-phase pull animation
 * (charge build-up → staggered reward reveal). Leaves are spent on press; the
 * reward is reported via onObtain when the reveal begins. Uses the built-in
 * Animated API (no worklets) so it runs in tests without extra setup.
 */
export function GachaScreen({
  onBack,
  leafBalance = 0,
  onSpendLeaves,
  onObtain,
}: GachaScreenProps) {
  const t = useTokens();
  const [selectedId, setSelectedId] = useState(BOXES[0].id);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pulled, setPulled] = useState<GachaItem[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const box = BOXES.find((b) => b.id === selectedId) ?? BOXES[0];

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const pull = (count: 1 | 10) => {
    const cost = count === 1 ? COST.single : COST.multi;
    if (leafBalance < cost || onSpendLeaves?.(cost) === false) {
      setError('잎사귀가 부족해요.');
      return;
    }
    setError('');
    const items = Array.from({ length: count }, (_, i) => box.pool[(i + count) % box.pool.length]);
    setPulled(items);
    setPhase('charging');
    clearTimer();
    timer.current = setTimeout(() => {
      setPhase('reveal');
      onObtain?.(items.map((it) => it.name));
    }, CHARGE_MS);
  };

  const close = () => {
    clearTimer();
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
          <Text style={[styles.backGlyph, { color: t.text }]}>‹</Text>
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>가챠</Text>
        <View style={[styles.leafPill, { backgroundColor: t.surfaceMuted }]}>
          <Text style={styles.leafIcon}>🍃</Text>
          <Text style={[Typography.label, { color: t.text }]}>{leafBalance.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Box selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boxRow}>
          {BOXES.map((b) => {
            const active = b.id === selectedId;
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  setSelectedId(b.id);
                  setError('');
                }}
                style={[
                  styles.boxChip,
                  { backgroundColor: b.accent, borderColor: active ? t.primary : 'transparent' },
                ]}>
                <Text style={styles.boxChipIcon}>{b.icon}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Selected box */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={[styles.boxHero, { backgroundColor: box.accent }]}>
            <Text style={styles.boxHeroIcon}>{box.icon}</Text>
          </View>
          <Text style={[Typography.h3, styles.center, { color: t.text }]}>{box.name}</Text>
          <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
            획득 {box.obtained} / {box.total}
          </Text>

          <View style={styles.poolRow}>
            {box.pool.map((it) => (
              <View key={it.name} style={[styles.poolItem, { backgroundColor: t.surfaceMuted }]}>
                <Text style={styles.poolIcon}>{it.icon}</Text>
                <Text style={[styles.rarity, { color: RARITY_COLOR[it.rarity] }]}>{it.rarity}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <Text style={[Typography.supporting, styles.center, { color: '#D67878' }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.pullRow}>
            <PullButton
              label="1회 뽑기"
              cost={COST.single}
              disabled={leafBalance < COST.single}
              onPress={() => pull(1)}
            />
            <PullButton
              label="10회 뽑기"
              cost={COST.multi}
              disabled={leafBalance < COST.multi}
              onPress={() => pull(10)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Pull animation overlay — a Modal so it fills the whole screen and
          centers regardless of the screen's safe-area padding. */}
      <Modal visible={phase !== 'idle'} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          {phase === 'charging' ? (
            <>
              <ChargingBox icon={box.icon} accent={box.accent} />
              <Text style={[Typography.label, styles.overlayText]}>뽑는 중…</Text>
            </>
          ) : (
            <>
              <Text style={[Typography.h3, styles.overlayText]}>축하해요!</Text>
              <ScrollView style={styles.revealScroll} contentContainerStyle={styles.revealGrid}>
                {pulled.map((it, idx) => (
                  <RevealCard key={`${it.name}-${idx}`} item={it} index={idx} />
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
function RevealCard({ item, index }: { item: GachaItem; index: number }) {
  const t = useTokens();
  const p = useRef(new Animated.Value(0)).current;

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
        style,
        { backgroundColor: t.surface, borderColor: RARITY_COLOR[item.rarity] },
      ]}>
      <Text style={styles.revealIcon}>{item.icon}</Text>
      <Text style={[styles.revealBadge, { backgroundColor: RARITY_COLOR[item.rarity] }]}>
        {item.rarity}
      </Text>
      <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={1}>
        {item.name}
      </Text>
    </Animated.View>
  );
}

function PullButton({
  label,
  cost,
  disabled,
  onPress,
}: {
  label: string;
  cost: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pullBtn,
        { backgroundColor: disabled ? DISABLED : t.primary },
        pressed && !disabled && { backgroundColor: t.primaryActive },
      ]}>
      <Text style={[Typography.label, { color: t.onPrimary }]}>{label}</Text>
      <Text style={[styles.cost, { color: t.onPrimary }]}>🍃 {cost.toLocaleString()}</Text>
    </Pressable>
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
  backGlyph: { fontSize: 26, lineHeight: 28 },
  leafPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  leafIcon: { fontSize: 14 },
  body: { padding: Spacing.four, gap: Spacing.four },
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
  poolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  poolItem: {
    width: 64,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
  },
  poolIcon: { fontSize: 22 },
  rarity: { fontSize: 10, fontWeight: '700' },
  pullRow: { flexDirection: 'row', gap: Spacing.two },
  pullBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    gap: 2,
  },
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
  revealIcon: { fontSize: 40 },
  revealBadge: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  confirmBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    alignItems: 'center',
  },
});
