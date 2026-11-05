import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { CoachTarget } from '@/components/ui/coach-mark';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { HousePictogram, TargetPictogram } from '@/components/ui/pictograms';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { FixedOverlay, Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 집 목표 요약 (#875) — 화면이 미션 목록에서 파생해 넘긴다. */
export type HouseMissionSummary = {
  /** 진행 중(ACTIVE) 목표 수 — 0이면 둘째 줄을 그리지 않는다. */
  active: number;
  /** 그중 오늘 기여한 수. */
  contributedToday: number;
  /** 달성해 보상을 받을 수 있는 수 — 있으면 점. */
  claimable: number;
};

export type HouseMetaPillsProps = {
  level: number;
  /** 누적 성장 포인트 — 화면엔 이번 레벨 진행분(`% 100`)만. 없으면 생략. */
  growthPoints?: number;
  memberCount: number;
  maxMembers?: number;
  missions: HouseMissionSummary;
  /** 레벨 알약 탭 → 목표 화면 (#1646). 없으면 알약은 누를 수 없는 표시다. */
  onOpenMissions?: () => void;
  /** 멤버 알약 탭 → 집 관리 (#1646). 없으면 누를 수 없는 표시다. */
  onOpenMembers?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * 집 하늘 위의 레벨·멤버 알약 (#1646).
 *
 * 오른쪽 플로팅 레일이 4개(목표·채팅·집 탐색·집 관리)로 길어 화면이 어수선했다. 상태가
 * 없는 진입점을 이미 있는 알약에 흡수해 depth를 늘리지 않고 레일을 반으로 줄였다 —
 * 레벨은 목표를 달성하면 오르니 레벨 → 목표, 인원수 → 집 관리. 보이는 글자는 숫자뿐이고
 * 문장("오늘 1/2 기여, 받을 보상 1개")은 접근성 라벨에만 담는다.
 *
 * 알약 높이(34)는 44pt에 못 미쳐 위아래 `hitSlop`으로 채운다 — 알약 사이 간격을 그만큼
 * 벌려 두 알약의 확장 영역이 겹치지 않게 했다.
 */
export function HouseMetaPills({
  level,
  growthPoints,
  memberCount,
  maxMembers,
  missions,
  onOpenMissions,
  onOpenMembers,
  style,
}: HouseMetaPillsProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const tr = useT();
  const ink = { color: t.onTint };

  const levelText = `Lv.${level}${growthPoints != null ? ` · ${growthPoints % 100}/100` : ''}`;
  const membersText = `${memberCount}${maxMembers ? ` / ${maxMembers}` : ''}`;
  const hasMissions = missions.active > 0;

  const levelA11y = [
    tr('house.screen.missionsA11yTitle'),
    hasMissions
      ? tr('house.screen.missionsA11yToday', {
          done: missions.contributedToday,
          total: missions.active,
        })
      : tr('house.screen.missionsA11yNone'),
    missions.claimable > 0
      ? tr('house.screen.missionsA11yClaimable', { n: missions.claimable })
      : null,
    levelText,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.column, style]} pointerEvents="box-none">
      <CoachTarget id="house-missions">
        <Pill
          onPress={onOpenMissions}
          accessibilityLabel={onOpenMissions ? levelA11y : levelText}
          testID="house-level-pill">
          <View style={styles.lines}>
            <View style={styles.row}>
              <HousePictogram size={12} />
              <Text style={[Typography.supporting, emph('normal'), ink]}>{levelText}</Text>
            </View>
            {onOpenMissions && hasMissions ? (
              <View style={styles.row} testID="house-level-missions">
                <TargetPictogram size={12} />
                <Text style={[Typography.supporting, emph('normal'), ink]}>
                  {`${missions.contributedToday}/${missions.active}`}
                </Text>
                {missions.claimable > 0 ? (
                  <View
                    style={[styles.dot, { backgroundColor: t.warning }]}
                    testID="house-level-claimable"
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          {onOpenMissions ? <Icon name="forward" size={14} color={t.onTint} /> : null}
        </Pill>
      </CoachTarget>
      <CoachTarget id="house-manage">
        <Pill
          onPress={onOpenMembers}
          accessibilityLabel={
            onOpenMembers
              ? tr('house.screen.manageA11y', { members: membersText })
              : tr('house.screen.members', { n: membersText })
          }
          testID="house-members-pill">
          <Icon name="members" size={14} color={t.onTint} />
          <Text style={[Typography.supporting, emph('normal'), ink]}>{membersText}</Text>
          {onOpenMembers ? <Icon name="forward" size={14} color={t.onTint} /> : null}
        </Pill>
      </CoachTarget>
    </View>
  );
}

/** 알약 하나 — onPress가 있을 때만 버튼. */
function Pill({
  onPress,
  accessibilityLabel,
  testID,
  children,
}: {
  onPress?: () => void;
  accessibilityLabel: string;
  testID: string;
  children: ReactNode;
}) {
  const face = (
    <GlassSurface
      interactive={onPress != null}
      fallbackColor={FixedOverlay.skyPill}
      style={[styles.pill, onPress ? styles.pressablePill : null]}>
      {children}
    </GlassSurface>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} testID={testID}>
        {face}
      </View>
    );
  }
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={PILL_HIT_SLOP}
      testID={testID}>
      {face}
    </ScalePressable>
  );
}

/** 34pt 알약을 44pt로 — 위아래 5씩. 간격(PILL_GAP)이 이보다 커야 겹치지 않는다. */
const PILL_HIT_SLOP = { top: 5, bottom: 5, left: Spacing.two, right: Spacing.two };
const PILL_GAP = Spacing.two + Spacing.half;

const styles = StyleSheet.create({
  column: {
    alignItems: 'flex-start',
    gap: PILL_GAP,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  // 누를 수 있는 알약 — 둘째 줄이 생겨도 모서리가 어색하지 않게 반경을 낮추고 세로를 키운다.
  pressablePill: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  lines: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
});
