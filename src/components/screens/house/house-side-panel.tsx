import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { OnlineDot } from '@/components/screens/house/online-dot';
import type { HouseMission, RoomCell } from '@/components/screens/house/types';
import { Icon } from '@/components/ui/icon';
import { CrownPictogram, HousePictogram } from '@/components/ui/pictograms';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type HouseSidePanelProps = {
  name: string;
  /** 내가 방장인 집 — 이름 앞 왕관. */
  isOwner?: boolean;
  level: number;
  /** 누적 성장 포인트 — 이번 레벨 진행분(`% 100`)만 보인다. 없으면 진행 바를 생략. */
  growthPoints?: number;
  /** 빈 자리를 뺀 실제 구성원 (`manageableMembers`). */
  members: RoomCell[];
  maxMembers?: number;
  missions: HouseMission[];
  /** 내 자리 이름은 라이브 닉네임으로 (#479). */
  userName?: string;
  chatUnread?: number;
  onOpenChat?: () => void;
  onOpenFeed?: () => void;
  onOpenSearch?: () => void;
  onOpenMissions?: () => void;
  onOpenMembers?: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * 2단 집 탭의 오른쪽 칸 — 펼친 폴더블·태블릿·데스크톱 웹. 한 칸일 때 집 그림 위에 떠 있던
 * 것들(레벨·목표 알약, 구성원 수 알약, 채팅·집 피드·집 추가 레일)을 여기로 옮겨 그림을 가리지
 * 않고, 숫자만 보이던 목표·구성원을 목록으로 펼친다. 데이터와 콜백은 전부 prop이다.
 */
export function HouseSidePanel({
  name,
  isOwner = false,
  level,
  growthPoints,
  members,
  maxMembers,
  missions,
  userName,
  chatUnread = 0,
  onOpenChat,
  onOpenFeed,
  onOpenSearch,
  onOpenMissions,
  onOpenMembers,
  style,
  contentContainerStyle,
}: HouseSidePanelProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  const levelPoints = growthPoints != null ? growthPoints % 100 : undefined;
  const levelText = `Lv.${level}${levelPoints != null ? ` · ${levelPoints}/100` : ''}`;
  const activeMissions = missions.filter((m) => m.status === 'ACTIVE');
  const membersText = `${members.length}${maxMembers ? ` / ${maxMembers}` : ''}`;
  // 내 자리를 맨 위로 — 나머지는 집의 자리 순서 그대로(sort는 안정 정렬).
  const orderedMembers = [...members].sort((a, b) => Number(!!b.isMine) - Number(!!a.isMine));

  return (
    <ScrollView
      style={[{ backgroundColor: t.screen }, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      accessibilityLabel={tr('house.sidePanel.regionA11y', { name })}
      testID="house-side-panel">
      <View style={styles.head}>
        <View
          style={styles.titleRow}
          accessible
          accessibilityRole="header"
          accessibilityLabel={name}>
          {isOwner ? <CrownPictogram size={18} /> : <HousePictogram size={18} />}
          <Text style={[Typography.h2, styles.title, { color: t.text }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={[Typography.label, { color: t.textMuted }]}>{levelText}</Text>
        {levelPoints != null ? (
          <SpringProgressBar
            progress={levelPoints / 100}
            color={t.primary}
            trackColor={t.surfaceMuted}
            height={6}
            accessibilityLabel={tr('house.sidePanel.levelA11y', { level, points: levelPoints })}
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        {onOpenChat ? (
          <ActionButton
            icon={<Icon name="chat" size={20} color={t.text} />}
            label={tr('house.chat.rail')}
            accessibilityLabel={
              chatUnread > 0
                ? tr('house.chat.railA11yUnread', { n: chatUnread })
                : tr('house.chat.railA11y')
            }
            count={chatUnread}
            onPress={onOpenChat}
          />
        ) : null}
        {onOpenFeed ? (
          <ActionButton
            icon={<Icon name="house-feed" size={20} color={t.text} />}
            label={tr('house.feed.rail')}
            accessibilityLabel={tr('house.feed.railA11y')}
            onPress={onOpenFeed}
          />
        ) : null}
        {onOpenSearch ? (
          <ActionButton
            icon={<Icon name="add" size={20} color={t.text} />}
            label={tr('house.screen.railAdd')}
            accessibilityLabel={tr('house.screen.railAdd')}
            onPress={onOpenSearch}
          />
        ) : null}
      </View>

      <Section
        title={tr('house.sidePanel.missions')}
        action={tr('house.sidePanel.missionsAll')}
        actionA11y={tr('house.sidePanel.missionsAllA11y')}
        onAction={onOpenMissions}>
        {activeMissions.length === 0 ? (
          <Text style={[Typography.label, { color: t.textMuted }]}>
            {tr('house.sidePanel.missionsEmpty')}
          </Text>
        ) : (
          activeMissions.map((m) => {
            const progress = `${m.current}/${m.target}${m.unit ?? ''}`;
            return (
              <View key={m.id} style={styles.mission} testID={`house-side-mission-${m.id}`}>
                <View style={styles.missionHead}>
                  <Text
                    style={[Typography.label, styles.flexText, { color: t.text }]}
                    numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[Typography.supporting, emph('normal'), { color: t.textMuted }]}>
                    {progress}
                  </Text>
                </View>
                <SpringProgressBar
                  progress={m.target > 0 ? m.current / m.target : 0}
                  color={t.primary}
                  trackColor={t.surfaceMuted}
                  height={6}
                  accessibilityLabel={tr('house.sidePanel.missionProgressA11y', {
                    title: m.title,
                    current: m.current,
                    target: m.target,
                    unit: m.unit ?? '',
                  })}
                />
              </View>
            );
          })
        )}
      </Section>

      <Section
        title={tr('house.sidePanel.members', { n: membersText })}
        action={tr('house.sidePanel.manage')}
        actionA11y={tr('house.sidePanel.manageA11y')}
        onAction={onOpenMembers}>
        {orderedMembers.map((m, i) => {
          const displayName = m.isMine && userName ? userName : m.name;
          const presence = m.bot
            ? tr('house.seat.bot')
            : m.online
              ? tr('house.seat.online')
              : m.lastSeenLabel
                ? tr('house.seat.lastSeen', { label: m.lastSeenLabel })
                : null;
          return (
            <View
              key={`${i}-${m.name}`}
              style={[styles.member, i > 0 && { borderTopColor: t.border }, i > 0 && styles.rule]}
              testID={`house-side-member-${i}`}>
              {m.online && !m.bot ? <OnlineDot color={t.success} /> : null}
              <Text
                style={[Typography.label, styles.flexText, { color: t.text }]}
                numberOfLines={1}>
                {m.isMine ? tr('house.seat.mine', { name: displayName }) : displayName}
              </Text>
              {m.isOwner ? (
                <View style={[styles.badge, { backgroundColor: t.surfaceMuted }]}>
                  <CrownPictogram size={12} />
                  <Text style={[Typography.caption, emph('normal'), { color: t.textMuted }]}>
                    {tr('house.sidePanel.owner')}
                  </Text>
                </View>
              ) : null}
              {presence ? (
                <Text style={[Typography.supporting, emph('normal'), { color: t.textMuted }]}>
                  {presence}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Section>
    </ScrollView>
  );
}

/** 제목 + (있으면) 오른쪽 진입 버튼이 달린 카드 한 덩이. */
function Section({
  title,
  action,
  actionA11y,
  onAction,
  children,
}: {
  title: string;
  action: string;
  actionA11y: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={[styles.section, { backgroundColor: t.surface }]}>
      <View style={styles.sectionHead}>
        <Text style={[Typography.h3, styles.flexText, { color: t.text }]}>{title}</Text>
        {onAction ? (
          <ScalePressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionA11y}
            hitSlop={Spacing.two}
            style={styles.sectionAction}>
            <Text style={[Typography.label, { color: t.primaryText }]}>{action}</Text>
            <Icon name="forward" size={14} color={t.primaryText} />
          </ScalePressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** 채팅·집 피드·집 추가 — 같은 폭으로 나란히. */
function ActionButton({
  icon,
  label,
  accessibilityLabel,
  count = 0,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  accessibilityLabel: string;
  count?: number;
  onPress: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.action, { backgroundColor: t.surface }]}>
      <View>
        {icon}
        {count > 0 ? (
          <View style={[styles.count, { backgroundColor: t.danger }]}>
            <Text style={[Typography.caption, emph('normal'), { color: t.onPrimary }]}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[Typography.supporting, emph('normal'), { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </ScalePressable>
  );
}

const MIN_TOUCH = 44;
const COUNT_SIZE = 18;

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  head: { gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: {
    flex: 1,
    minHeight: MIN_TOUCH + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  count: {
    position: 'absolute',
    top: -Spacing.two,
    right: -Spacing.three,
    minWidth: COUNT_SIZE,
    height: COUNT_SIZE,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    minHeight: MIN_TOUCH - Spacing.three,
  },
  mission: { gap: Spacing.two },
  missionHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MIN_TOUCH - Spacing.two,
  },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  flexText: { flex: 1, minWidth: 0 },
});
