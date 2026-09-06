import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import giftRoom from '@/assets/images/gacha/gift-room-hero-v2.webp';
import type { GachaDrawCount } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import { Icon } from '@/components/ui/icon';
import { Pictogram } from '@/components/ui/pictograms';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { GACHA_CATEGORIES, GACHA_CATEGORY_META, getGachaCategory } from '@/constants/gacha';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { hapticSelection } from '@/utils/haptics';

const CATEGORY_COPY = {
  WALLPAPER: { title: '벽에 새로운 표정을', detail: '다양한 테마의 벽지가 한 상자에 모였어요.' },
  FLOOR: { title: '포근함을 깔아볼까요', detail: '다양한 테마의 바닥으로 방의 분위기를 바꿔요.' },
  FURNITURE: { title: '마음에 쏙 드는 한 조각', detail: '다양한 테마의 가구와 소품을 만나보세요.' },
} as const;

export function GachaLobby({
  machines,
  selected,
  onSelect,
  onDraw,
  onRewards,
  canAfford,
  busy,
  error,
  topInset = 0,
  bottomInset = 0,
}: {
  machines: GachaMachine[];
  selected: GachaMachine;
  onSelect: (machine: GachaMachine) => void;
  onDraw: (count: GachaDrawCount) => void;
  onRewards?: () => void;
  canAfford: (count: GachaDrawCount) => boolean;
  busy: boolean;
  error: string;
  topInset?: number;
  bottomInset?: number;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const category = getGachaCategory(selected) ?? 'FURNITURE';
  const copy = CATEGORY_COPY[category];
  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: topInset + Spacing.three }]}>
        <View style={styles.heading}>
          <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
            오늘의 작은 설렘
          </Text>
          <Text style={[Typography.h1, { color: t.text }]}>내 방에 도착한 선물</Text>
        </View>

        <View style={[styles.categories, { backgroundColor: t.surfaceMuted }]}>
          {GACHA_CATEGORIES.map((key) => {
            const machine = machines.find((candidate) => getGachaCategory(candidate) === key);
            const active = category === key;
            const meta = GACHA_CATEGORY_META[key];
            return (
              <ScalePressable
                key={key}
                disabled={!machine || busy}
                accessibilityRole="tab"
                accessibilityLabel={`${meta.label} 뽑기`}
                accessibilityState={{ selected: active, disabled: !machine || busy }}
                onPress={() => {
                  if (machine) {
                    hapticSelection();
                    onSelect(machine);
                  }
                }}
                style={[
                  styles.category,
                  active && { backgroundColor: t.surface },
                  !machine && styles.unavailable,
                ]}>
                <Pictogram name={meta.icon} size={23} />
                <Text style={[Typography.label, { color: active ? t.primaryText : t.textMuted }]}>
                  {meta.label}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        <View style={styles.hero}>
          <Image
            source={giftRoom}
            contentFit="cover"
            style={styles.illustration}
            accessibilityLabel="햇살이 드는 방에 놓인 초록 리본 선물상자"
          />
          <View style={[styles.heroTag, { backgroundColor: t.surface }]}>
            <Text style={[Typography.supporting, emph('semibold'), { color: t.text }]}>
              {GACHA_CATEGORY_META[category].label} 상자
            </Text>
          </View>
        </View>

        <View style={styles.description}>
          <Text style={[Typography.h3, styles.center, { color: t.text }]}>{copy.title}</Text>
          <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
            {copy.detail}
          </Text>
        </View>

        {onRewards ? (
          <ScalePressable
            onPress={onRewards}
            accessibilityRole="button"
            accessibilityLabel="나올 수 있는 보상 보기"
            style={[styles.rewards, { borderColor: t.border }]}>
            <View style={[styles.rewardIcon, { backgroundColor: t.primarySoft }]}>
              <Icon name="gift" size={21} color={t.primaryText} />
            </View>
            <View style={styles.rewardCopy}>
              <Text style={[Typography.label, { color: t.text }]}>어떤 선물이 기다릴까요?</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                나올 수 있는 보상 보기
              </Text>
            </View>
            <Icon name="forward" size={17} color={t.textMuted} />
          </ScalePressable>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: t.screen,
            borderTopColor: t.border,
            paddingBottom: Math.max(bottomInset, Spacing.three),
          },
        ]}>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[Typography.supporting, styles.center, { color: t.dangerText }]}>
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {([1, 6] as const).map((count) => {
            const primary = count === 6;
            const affordable = canAfford(count);
            const cost = selected.costAmount * (primary ? 5 : 1);
            const label = primary ? '5+1회 뽑기' : '1회 뽑기';
            const ink = affordable ? (primary ? t.onPrimary : t.text) : t.textMuted;
            return (
              <ScalePressable
                key={count}
                onPress={() => onDraw(count)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                accessibilityLabel={`${label}, ${cost.toLocaleString()} ${selected.costCurrencyType === 'COIN' ? '코인' : '다이아'}`}
                style={[
                  styles.draw,
                  {
                    flex: primary ? 1.5 : 1,
                    borderColor: primary ? 'transparent' : t.border,
                    backgroundColor: !affordable ? t.disabledBg : primary ? t.primary : t.surface,
                  },
                ]}>
                <Text style={[Typography.label, { color: ink }]}>{label}</Text>
                <View style={styles.cost}>
                  <Icon
                    name={selected.costCurrencyType === 'COIN' ? 'coin' : 'diamond'}
                    size={14}
                    color={selected.costCurrencyType === 'COIN' ? t.warning : ink}
                  />
                  <Text style={[Typography.supporting, emph('semibold'), { color: ink }]}>
                    {cost.toLocaleString()}
                  </Text>
                </View>
              </ScalePressable>
            );
          })}
        </View>
        <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
          5회 가격으로 6개 · 중복 아이템은 다이아로
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  heading: { gap: Spacing.two },
  categories: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Radius.lg,
    gap: Spacing.one,
  },
  category: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    minHeight: 48,
    paddingVertical: Spacing.two,
  },
  unavailable: { opacity: 0.4 },
  hero: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', borderRadius: Radius.xl },
  illustration: { width: '100%', height: '100%' },
  heroTag: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  description: { gap: Spacing.two },
  center: { textAlign: 'center' },
  rewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rewardIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCopy: { flex: 1, gap: Spacing.one },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
  draw: {
    minHeight: 72,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
  },
  cost: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
