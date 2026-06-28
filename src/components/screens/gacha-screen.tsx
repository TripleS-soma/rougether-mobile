import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

type Rarity = '일반' | '희귀' | '전설';
const RARITY_COLOR: Record<Rarity, string> = {
  일반: '#9AA0A6',
  희귀: '#7FA8D4',
  전설: '#E8A24A',
};
const DISABLED = '#D4C4B0';
const COST = { single: 250, multi: 1250 };

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
 * Gacha screen, ported from the prototype `GachaScreen`. Box selection + single
 * / multi pull with leaf cost. The draw animation (GachaAnimation) and the real
 * furniture reward pool are deferred follow-ups — pulling reveals a result
 * inline and reports it via onObtain.
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
  const [lastResult, setLastResult] = useState<GachaItem[]>([]);

  const box = BOXES.find((b) => b.id === selectedId) ?? BOXES[0];

  const pull = (count: 1 | 10) => {
    const cost = count === 1 ? COST.single : COST.multi;
    if (leafBalance < cost || onSpendLeaves?.(cost) === false) {
      setError('잎사귀가 부족해요.');
      setLastResult([]);
      return;
    }
    setError('');
    const items = Array.from({ length: count }, (_, i) => box.pool[(i + count) % box.pool.length]);
    setLastResult(items);
    onObtain?.(items.map((it) => it.name));
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.screen }]}>
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
                  setLastResult([]);
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

          {lastResult.length > 0 ? (
            <Text style={[Typography.label, styles.center, { color: t.primary }]}>
              방금 획득: {lastResult.map((it) => `${it.icon} ${it.name}`).join(', ')}
            </Text>
          ) : null}
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
    </View>
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
});
