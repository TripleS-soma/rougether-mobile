import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FeedComposeScope } from '@/components/screens/feed/types';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const ICON_CIRCLE = 40;
const RADIO_SIZE = 22;
const RADIO_DOT = 10;
/** 집이 많은 사람도 시트가 화면을 넘지 않게 — 선택지 약 다섯 줄. */
const OPTIONS_MAX_HEIGHT = 320;

export type FeedComposeScopeProps = {
  scope: FeedComposeScope;
  /** 올리는 중 등 — 바꿀 수 없다. */
  disabled?: boolean;
};

/**
 * 작성 화면의 "올릴 곳" (집 피드) — 지금 글이 누구에게 보이는지를 화면 맨 위에 늘 보여 준다.
 *
 * - 고정(`scope.locked`, 집 피드에서 연 작성): 그 집에 올린다는 안내만. 바꿀 수 없어 실수로 전체
 *   공개에 올리는 일이 없다.
 * - 선택(공개 피드에서 연 작성): 기본은 전체 공개. 줄을 누르면 시트에서 전체 공개와 내 집들 중
 *   하나를 고른다. 집을 고르면 줄이 초록 면으로 바뀌어 공개 범위가 달라졌음이 한눈에 보인다.
 *
 * 내 집이 없으면 고를 것이 없다 — 호출부가 이 컴포넌트를 그리지 않는다.
 */
export function FeedComposeScopeRow({ scope, disabled = false }: FeedComposeScopeProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [open, setOpen] = useState(false);

  const house =
    scope.houseId == null ? null : scope.houses.find((h) => h.houseId === scope.houseId);
  // 고른 집이 목록에서 사라졌어도(나감·삭제) 집 글로 올라가는 중임은 숨기지 않는다.
  const toHouse = scope.houseId != null;
  const title = toHouse
    ? tr(scope.locked ? 'feed.scope.lockedHouse' : 'feed.scope.house', {
        name: house?.name ?? tr('feed.scope.unknownHouse'),
      })
    : tr('feed.scope.public');
  const desc = toHouse ? tr('feed.scope.houseDesc') : tr('feed.scope.publicDesc');
  const canChange = !scope.locked && !disabled && !!scope.onChange;

  const face = (
    <>
      <View style={[styles.iconCircle, { backgroundColor: t.surface }]}>
        <Icon name={toHouse ? 'house' : 'globe'} size={20} color={t.primaryText} />
      </View>
      <View style={styles.text}>
        <Text style={[Typography.labelCompact, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[Typography.caption, { color: t.textMuted }]}>{desc}</Text>
      </View>
      {scope.locked ? null : (
        <Text
          style={[Typography.labelCompact, { color: canChange ? t.primaryText : t.textDisabled }]}>
          {tr('feed.scope.change')}
        </Text>
      )}
    </>
  );
  const faceStyle = [styles.row, { backgroundColor: toHouse ? t.primarySoft : t.surfaceMuted }];

  if (scope.locked) {
    return (
      <View
        style={faceStyle}
        accessible
        accessibilityLabel={`${title}. ${desc}`}
        testID="feed-scope">
        {face}
      </View>
    );
  }

  const pick = (houseId: number | null) => {
    setOpen(false);
    if (houseId !== scope.houseId) scope.onChange?.(houseId);
  };
  const options: { houseId: number | null; label: string; desc: string }[] = [
    { houseId: null, label: tr('feed.scope.public'), desc: tr('feed.scope.publicDesc') },
    ...scope.houses.map((h) => ({
      houseId: h.houseId,
      label: h.name,
      desc: tr('feed.scope.optionHouseDesc'),
    })),
  ];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!canChange}
        accessibilityRole="button"
        accessibilityLabel={tr('feed.scope.changeA11y', { current: title })}
        accessibilityHint={desc}
        accessibilityState={{ disabled: !canChange }}
        testID="feed-scope"
        style={({ pressed }) => [faceStyle, pressed && canChange && pressedStyle('dim', t)]}>
        {face}
      </Pressable>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        accessibilityLabel={tr('feed.scope.sheetTitle')}
        dragScope="header"
        cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
        <SheetHandle />
        <Text style={[Typography.h3, { color: t.text }]}>{tr('feed.scope.sheetTitle')}</Text>
        <SheetDragExclude style={styles.optionsWrap}>
          <ScrollView contentContainerStyle={styles.options} accessibilityRole="radiogroup">
            {options.map((option) => {
              const selected = option.houseId === scope.houseId;
              return (
                <Pressable
                  key={option.houseId ?? 'public'}
                  onPress={() => pick(option.houseId)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  accessibilityLabel={`${option.label}, ${option.desc}`}
                  testID={`feed-scope-option-${option.houseId ?? 'public'}`}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: selected ? t.primarySoft : t.surfaceMuted },
                    pressed && pressedStyle('dim', t),
                  ]}>
                  <View
                    style={[styles.radio, { borderColor: selected ? t.primary : t.textDisabled }]}>
                    {selected ? (
                      <View style={[styles.radioDot, { backgroundColor: t.primary }]} />
                    ) : null}
                  </View>
                  <View style={styles.text}>
                    <Text style={[Typography.labelCompact, { color: t.text }]} numberOfLines={1}>
                      {option.label}
                    </Text>
                    <Text style={[Typography.caption, { color: t.textMuted }]}>{option.desc}</Text>
                  </View>
                  <Icon
                    name={option.houseId == null ? 'globe' : 'house'}
                    size={18}
                    color={selected ? t.primaryText : t.textMuted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </SheetDragExclude>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  optionsWrap: {
    maxHeight: OPTIONS_MAX_HEIGHT,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: Radius.pill,
  },
});
