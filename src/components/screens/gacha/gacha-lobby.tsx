import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import giftRoom from '@/assets/images/gacha/gift-room-hero-v2.webp';
import { formatAmount } from '@/constants/currency';
import type { GachaDrawCount } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import { Icon } from '@/components/ui/icon';
import { Pictogram } from '@/components/ui/pictograms';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { CoachTarget } from '@/components/ui/coach-mark';
import { GACHA_CATEGORIES, GACHA_CATEGORY_META, getGachaCategory } from '@/constants/gacha';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { hapticSelection } from '@/utils/haptics';
import { useT } from '@/i18n';

export function GachaLobby({
  starterDrawState,
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
  starterDrawState?: 'PENDING' | 'CLAIMED';
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
  const tr = useT();
  const category = getGachaCategory(selected) ?? 'FURNITURE';
  // 온보딩 첫 뽑기(#1325)는 스피커 확정 — 카테고리 탭을 숨기고 문구를 바꾼다.
  const copy = starterDrawState
    ? {
        title: tr('roomShop.gacha.lobby.starter.title'),
        detail: tr('roomShop.gacha.lobby.starter.detail'),
      }
    : {
        title: tr(`roomShop.gacha.lobby.copy.${category}.title`),
        detail: tr(`roomShop.gacha.lobby.copy.${category}.detail`),
      };
  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: topInset + Spacing.three }]}>
        <View style={styles.heading}>
          <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
            {tr('roomShop.gacha.lobby.eyebrow')}
          </Text>
          <Text style={[Typography.h1, { color: t.text }]}>
            {tr('roomShop.gacha.lobby.heading')}
          </Text>
        </View>

        {!starterDrawState ? (
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
                  accessibilityLabel={tr('roomShop.gacha.lobby.categoryA11y', {
                    label: meta.label,
                  })}
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
        ) : null}

        <View style={styles.hero}>
          <Image
            source={giftRoom}
            contentFit="cover"
            style={styles.illustration}
            accessibilityLabel={tr('roomShop.gacha.lobby.heroA11y')}
          />
          <View style={[styles.heroTag, { backgroundColor: t.surface }]}>
            <Text style={[Typography.supporting, emph('semibold'), { color: t.text }]}>
              {tr('roomShop.gacha.lobby.boxTag', { label: GACHA_CATEGORY_META[category].label })}
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
            accessibilityLabel={tr('roomShop.gacha.lobby.rewardsA11y')}
            style={[styles.rewards, { borderColor: t.border }]}>
            <View style={[styles.rewardIcon, { backgroundColor: t.primarySoft }]}>
              <Icon name="gift" size={21} color={t.primaryText} />
            </View>
            <View style={styles.rewardCopy}>
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('roomShop.gacha.lobby.rewardsTitle')}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('roomShop.gacha.lobby.rewardsHint')}
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
          {(starterDrawState ? ([1] as const) : ([1, 6] as const)).map((count) => {
            const primary = !!starterDrawState || count === 6;
            const affordable = canAfford(count);
            const cost = selected.costAmount * (primary ? 5 : 1);
            const label = tr(
              starterDrawState === 'CLAIMED'
                ? 'roomShop.gacha.lobby.starter.claimed'
                : starterDrawState
                  ? 'roomShop.gacha.lobby.starter.drawFree'
                  : count === 6
                    ? 'roomShop.gacha.lobby.drawBonus'
                    : 'roomShop.gacha.lobby.drawOne',
            );
            const ink = affordable ? (primary ? t.onPrimary : t.text) : t.textMuted;
            return (
              <ScalePressable
                key={count}
                onPress={() => onDraw(count)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                accessibilityLabel={
                  starterDrawState
                    ? label
                    : tr('roomShop.gacha.lobby.drawA11y', {
                        label,
                        cost: formatAmount(cost),
                        currency: tr(
                          selected.costCurrencyType === 'COIN'
                            ? 'roomShop.wallet.coin'
                            : 'roomShop.wallet.diamond',
                        ),
                      })
                }
                style={[
                  styles.draw,
                  {
                    flex: primary ? 1.5 : 1,
                    borderColor: primary ? 'transparent' : t.border,
                    backgroundColor: !affordable ? t.disabledBg : primary ? t.primary : t.surface,
                  },
                ]}>
                <CoachTarget id={count === 1 ? 'gacha-draw' : `gacha-draw-${count}`}>
                  <Text style={[Typography.label, { color: ink }]}>{label}</Text>
                </CoachTarget>
                {!starterDrawState ? (
                  <View style={styles.cost}>
                    <Icon
                      name={selected.costCurrencyType === 'COIN' ? 'coin' : 'diamond'}
                      size={14}
                      color={selected.costCurrencyType === 'COIN' ? t.warning : ink}
                    />
                    <Text style={[Typography.supporting, emph('semibold'), { color: ink }]}>
                      {formatAmount(cost)}
                    </Text>
                  </View>
                ) : null}
              </ScalePressable>
            );
          })}
        </View>
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
