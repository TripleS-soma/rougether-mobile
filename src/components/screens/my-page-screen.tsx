import { memo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { HEADER_ROW_HEIGHT } from '@/components/ui/screen-header-geometry';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius, Spacing } from '@/constants/theme';
import { useBottomNavInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

type Row = { icon: IconName; label: string; onPress?: () => void };

export type MyPageScreenProps = ScrollRestoreProps & {
  nickname?: string;
  bio?: string;
  characterId?: CharacterId;
  /** 대표 캐릭터 프레임 (있으면 아바타가 실제 스프라이트를 그린다). */
  characterFrames?: string[];
  streakDays?: number;
  coinBalance?: number;
  diamondBalance?: number;
  onEditProfile?: () => void;
  /** 헤더 우측 톱니 — 설정 서브화면 (#1088). */
  onOpenSettings?: () => void;
  /** 출석 이벤트 바로가기 (#851 → #1089) — 이벤트가 있을 때만 배선, 없으면 타일이 숨는다. */
  onOpenAttendance?: () => void;
  /** 오늘 미출석 — 타일에 빨간 점. */
  attendancePending?: boolean;
  /** 재화 내역 바로가기 (#734 → #1089). */
  onOpenWalletHistory?: () => void;
  /** 주간회고 다시 보기 (#1056) — 설정 항목에서 마이페이지 항목으로 (#1088). */
  onOpenWeeklyReport?: () => void;
  /** 친구 초대 (#518). */
  onInviteFriends?: () => void;
  onOpenHelp?: () => void;
  /** 버그 제보 (#496). */
  onReportBug?: () => void;
};

/**
 * 마이페이지 탭 (#1088) — 종전 설정 탭 자리. "보는 곳"이다: 프로필 카드
 * (대표 캐릭터·닉네임·소개), 지표 한 줄(스트릭·코인·다이아), 바로가기 타일
 * (출석 이벤트·재화 내역 — 나의 방 메뉴에서 옮겨옴, #1089), 계정·콘텐츠성
 * 항목(주간회고·친구 초대·도움말·버그 제보). "바꾸는 곳"인 설정(디자인·알림·
 * 계정 관리)은 헤더 우측 톱니 뒤의 서브화면으로 내려갔다.
 *
 * 순수/prop 기반 — 데이터와 콜백은 셸(use-settings-surface)이 넘긴다.
 * memo: 탭 페이저에 상주하므로 셸의 무관한 상태 변화에 리렌더되지 않게
 * 나의 방·집과 같은 memo 경계(#539). 셸이 주는 콜백은 전부 참조 고정 필수.
 */
export const MyPageScreen = memo(function MyPageScreen({
  nickname = '',
  bio = '',
  characterId = DEFAULT_CHARACTER_ID,
  characterFrames,
  streakDays = 0,
  coinBalance = 0,
  diamondBalance = 0,
  onEditProfile,
  onOpenSettings,
  onOpenAttendance,
  attendancePending = false,
  onOpenWalletHistory,
  onOpenWeeklyReport,
  onInviteFriends,
  onOpenHelp,
  onReportBug,
  getInitialScrollY,
  onScrollY,
}: MyPageScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 떠 있는 헤더·바텀바 밑으로 콘텐츠가 지나가도록 위아래 패딩 (#1069, #1049).
  const headerInset = useHeaderContentInset();
  const navInset = useBottomNavInset();
  // 서브화면(도움말·버그 제보 …)에 다녀와도 보던 자리로 (#763).
  const scrollRef = useRef<ScrollView>(null);
  const scrollRestore = useScrollRestore(scrollRef, { getInitialScrollY, onScrollY });

  const rows: Row[] = [
    { icon: 'list', label: '주간회고 다시 보기', onPress: onOpenWeeklyReport },
    { icon: 'gift', label: '친구 초대', onPress: onInviteFriends },
    { icon: 'help', label: '도움말', onPress: onOpenHelp },
    { icon: 'bug', label: '버그 제보', onPress: onReportBug },
  ];

  // 바로가기 타일 — 배선된 것만. 캐릭터 교체는 기능 제외 상태(#637)라 없다.
  const tiles: { icon: IconName; label: string; onPress: () => void; dot?: boolean }[] = [
    ...(onOpenAttendance
      ? [
          {
            icon: 'calendar' as const,
            label: '출석 이벤트',
            onPress: onOpenAttendance,
            dot: attendancePending,
          },
        ]
      : []),
    ...(onOpenWalletHistory
      ? [{ icon: 'coin' as const, label: '재화 내역', onPress: onOpenWalletHistory }]
      : []),
  ];

  const stats: { icon: IconName; color: string; value: string; label: string }[] = [
    { icon: 'flame', color: t.warningText, value: `${streakDays}일`, label: '연속' },
    { icon: 'coin', color: t.warning, value: coinBalance.toLocaleString(), label: '코인' },
    {
      icon: 'diamond',
      color: t.primaryText,
      value: diamondBalance.toLocaleString(),
      label: '다이아',
    },
  ];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.ambient}>
        <View style={[styles.ambientPrimary, { backgroundColor: t.primarySoft }]} />
        <View style={[styles.ambientWarm, { backgroundColor: t.warningSoft }]} />
      </View>
      <ScreenHeader
        title="마이페이지"
        right={
          // 설정은 "바꾸는 곳"이라 목록 행이 아니라 헤더 톱니 뒤로 — 보통 앱의 자리.
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="설정"
            testID="my-page-settings"
            style={styles.headerBtn}>
            <GlassSurface style={styles.headerFace} fallbackColor={t.surface}>
              <Icon name="settings" size={20} color={t.text} />
            </GlassSurface>
          </Pressable>
        }
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          navInset ? { paddingBottom: Spacing.four + navInset } : null,
        ]}
        {...scrollRestore}>
        <GlassSurface
          fallbackColor={t.surface}
          interactive={false}
          style={styles.card}
          testID="my-page-profile-card">
          <View style={styles.profile}>
            <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
              <CharacterAvatar characterId={characterId} frames={characterFrames} size={64} />
            </View>
            <View style={styles.profileText}>
              <Text style={[Typography.h3, { color: t.text }]} numberOfLines={1}>
                {nickname}
              </Text>
              <Text
                style={[Typography.body, { color: bio ? t.textMuted : t.textDisabled }]}
                numberOfLines={2}>
                {bio || '한 줄 소개를 적어보세요'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="프로필 편집"
            style={({ pressed }) => [
              styles.editBtn,
              { backgroundColor: pressed ? t.primarySoft : t.surfaceMuted },
            ]}>
            <Icon name="edit" size={16} color={t.text} />
            <Text style={[Typography.label, { color: t.text }]}>프로필 편집</Text>
          </Pressable>
        </GlassSurface>

        <GlassSurface
          fallbackColor={t.surface}
          interactive={false}
          style={styles.card}
          testID="my-page-stats">
          <View style={styles.stats}>
            {stats.map((s, idx) => (
              <View
                key={s.label}
                accessible
                accessibilityLabel={`${s.label} ${s.value}`}
                style={[
                  styles.stat,
                  idx > 0 && {
                    borderLeftColor: t.border,
                    borderLeftWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <View style={styles.statValue}>
                  <Icon name={s.icon} size={16} color={s.color} />
                  <Text style={[Typography.label, emph('semibold'), { color: t.text }]}>
                    {s.value}
                  </Text>
                </View>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </GlassSurface>

        {tiles.length > 0 ? (
          <View style={styles.tiles} testID="my-page-tiles">
            {tiles.map((tile) => (
              <Pressable
                key={tile.label}
                onPress={tile.onPress}
                accessibilityRole="button"
                accessibilityLabel={tile.dot ? `${tile.label}, 오늘 미출석` : tile.label}
                style={styles.tile}>
                <GlassSurface fallbackColor={t.surface} style={styles.tileFace}>
                  <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
                    <Icon name={tile.icon} size={20} color={t.primaryText} />
                    {tile.dot ? (
                      <View style={[styles.tileDot, { backgroundColor: t.danger }]} />
                    ) : null}
                  </View>
                  <Text style={[Typography.label, { color: t.text }]}>{tile.label}</Text>
                </GlassSurface>
              </Pressable>
            ))}
          </View>
        ) : null}

        <GlassSurface
          fallbackColor={t.surface}
          interactive={false}
          style={styles.card}
          testID="my-page-rows">
          <View style={styles.cardContent}>
            {rows.map((row, idx) => (
              <ListRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                onPress={row.onPress}
                last={idx === rows.length - 1}
              />
            ))}
          </View>
        </GlassSurface>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  ambient: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  ambientPrimary: {
    position: 'absolute',
    top: Spacing.six,
    right: -Spacing.six,
    width: Spacing.six * 4,
    height: Spacing.six * 4,
    borderRadius: Radius.pill,
  },
  ambientWarm: {
    position: 'absolute',
    top: Spacing.six * 6,
    left: -Spacing.six,
    width: Spacing.six * 3,
    height: Spacing.six * 3,
    borderRadius: Radius.pill,
  },
  // 헤더 우측 톱니 — 뒤로 가기 원(screen-header의 floatBtn)과 같은 크기·면.
  headerBtn: {
    width: HEADER_ROW_HEIGHT,
    height: HEADER_ROW_HEIGHT,
  },
  headerFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.xl,
  },
  cardContent: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileText: {
    flex: 1,
    gap: Spacing.one,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: Spacing.three,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: { flex: 1 },
  tileFace: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.xl,
  },
  // 미출석 점 — 방 메뉴 버튼에 있던 점(#1055)과 같은 결.
  tileDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  iconCircle: {
    width: Spacing.four + Spacing.three,
    height: Spacing.four + Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
