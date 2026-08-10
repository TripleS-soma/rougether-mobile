import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import {
  type BrandFontId,
  DEFAULT_FONT_ID,
  DEFAULT_THEME_MODE,
  displayFaceFor,
  FONT_OPTIONS,
  Radius,
  Spacing,
  type ThemeMode,
  typographyFor,
} from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

const MODE_OPTIONS: { id: ThemeMode; name: string }[] = [
  { id: 'system', name: '시스템' },
  { id: 'light', name: '라이트' },
  { id: 'dark', name: '다크' },
];

/**
 * 설정 행 오른쪽의 현재 폰트 이름을 그 폰트로 그리는 스타일 (#382). 크기는
 * label 롤에서, 얼굴은 displayFaceFor에서 — 주아 혼합은 제목만 Jua라 label
 * 롤의 얼굴만으로는 무엇이 다른지 안 보인다 (#750).
 */
function fontPreviewStyle(id: BrandFontId) {
  return { ...typographyFor(id).label, ...displayFaceFor(id) };
}

type Row = { icon: IconName; label: string; onPress?: () => void };

export type SettingsScreenProps = {
  /** Light/dark preference ('system' follows the OS). */
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  /** App font choice (#382) — 행 오른쪽 현재값 표시용. */
  fontId?: BrandFontId;
  /** Opens the 폰트 picker screen (#750). */
  onOpenFont?: () => void;
  /** Opens the 테마 색상 picker screen (#459). */
  onOpenTheme?: () => void;
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  onOpenNotifications?: () => void;
  onOpenSound?: () => void;
  onOpenHelp?: () => void;
  /** 친구 초대 (#518) — 내 초대코드·코드 사용 화면. */
  onInviteFriends?: () => void;
  /** 버그 제보 화면 열기 (#496). */
  onReportBug?: () => void;
  onReplayOnboarding?: () => void;
  /** 스토어 요건 — 인앱 약관/개인정보처리방침 링크 (#545). */
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onLogout?: () => void;
  /**
   * 회원탈퇴 (#547) — 확인 다이얼로그를 통과했을 때만 호출된다. 성공/실패
   * 처리(토스트·화면 전환)는 셸 몫.
   */
  onWithdraw?: () => void;
};

/**
 * Settings screen, ported from the prototype `SettingsScreen`: dark-mode picker
 * + account / notification / misc rows. Theme tokens + type scale; vector icons
 * via the shared Icon. Each row navigates to its sub-screen via the matching
 * prop. The mode picker is prop-driven (onChangeThemeMode); the app shell wires
 * it to the global BrandThemeProvider. (The 포근/숲/한옥 brand picker was
 * removed with dark mode's arrival — cozy is the single brand theme now.)
 *
 * memo (#539 후속): 탭 페이저(#563)로 세 탭 화면이 상주하게 되면서 셸의 모든
 * 상태 변화(지갑·토스트·루틴 등)가 이 화면까지 리렌더시켰다 — 나의 방/집과
 * 같은 memo 경계로 막는다. 셸이 주는 콜백 prop은 전부 참조 고정 필수.
 */
export const SettingsScreen = memo(function SettingsScreen({
  themeMode = DEFAULT_THEME_MODE,
  onChangeThemeMode,
  fontId = DEFAULT_FONT_ID,
  onOpenFont,
  onOpenTheme,
  onEditProfile,
  onChangePassword,
  onOpenNotifications,
  onOpenSound,
  onOpenHelp,
  onInviteFriends,
  onReportBug,
  onOpenTerms,
  onOpenPrivacy,
  onReplayOnboarding,
  onLogout,
  onWithdraw,
}: SettingsScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const headerInset = useHeaderInsetStyle();
  // Section captions: supporting size with a semibold face via the active font.
  const sectionTitleStyle = [Typography.supporting, emph('semibold'), styles.sectionTitle];
  // Logging out drops the session immediately, so gate it behind a confirm.
  const [confirmLogout, setConfirmLogout] = useState(false);
  // 회원탈퇴는 복구 불가 — 파괴 확인 다이얼로그 뒤에만 (#547).
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const currentFontName = FONT_OPTIONS.find((o) => o.id === fontId)?.name ?? '';

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: '계정',
      rows: [
        { icon: 'profile', label: '프로필 편집', onPress: onEditProfile },
        { icon: 'lock', label: '비밀번호 변경', onPress: onChangePassword },
        { icon: 'gift', label: '친구 초대', onPress: onInviteFriends },
      ],
    },
    {
      title: '알림',
      rows: [
        { icon: 'bell', label: '푸시 알림', onPress: onOpenNotifications },
        { icon: 'sound', label: '효과음', onPress: onOpenSound },
      ],
    },
    {
      title: '기타',
      rows: [
        { icon: 'help', label: '도움말', onPress: onOpenHelp },
        { icon: 'bug', label: '버그 제보', onPress: onReportBug },
        { icon: 'refresh', label: '튜토리얼 다시 보기', onPress: onReplayOnboarding },
        { icon: 'list', label: '이용약관', onPress: onOpenTerms },
        { icon: 'lock', label: '개인정보처리방침', onPress: onOpenPrivacy },
        { icon: 'leave', label: '로그아웃', onPress: () => setConfirmLogout(true) },
      ],
    },
  ];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Text style={[Typography.h2, { color: t.text }]}>설정</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={[...sectionTitleStyle, { color: t.textMuted }]}>디자인</Text>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={styles.designHead}>
              <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                <Icon name="moon" size={20} color={t.text} />
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>다크 모드</Text>
              </View>
            </View>
            <View style={styles.modeRow}>
              {MODE_OPTIONS.map((opt) => {
                const selected = opt.id === themeMode;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onChangeThemeMode?.(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.name}
                    style={[
                      styles.modeChip,
                      { backgroundColor: selected ? t.primary : t.surfaceMuted },
                    ]}>
                    <Text
                      style={[Typography.label, { color: selected ? t.onPrimary : t.textMuted }]}>
                      {opt.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/*
            테마 색상·폰트 — 선택지가 많고 실제로 적용해 봐야 아는 것들이라
            인라인 칩 대신 미리보기가 있는 별도 화면으로 (#459 → 폰트도 #750).
            폰트는 현재 이름을 행 오른쪽에 그 얼굴로 적어 들어가지 않고도
            확인되게 했다. 테마 색상은 화면 전체가 이미 그 색이라 생략.
          */}
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <Pressable
              onPress={onOpenTheme}
              accessibilityRole="button"
              accessibilityLabel="테마 색상"
              style={[
                styles.row,
                { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="palette" size={20} color={t.text} />
                </View>
                <Text style={[Typography.body, { color: t.text }]}>테마 색상</Text>
              </View>
              <Icon name="forward" size={16} color={t.textDisabled} />
            </Pressable>
            <Pressable
              onPress={onOpenFont}
              accessibilityRole="button"
              accessibilityLabel="폰트"
              style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                  <Icon name="edit" size={20} color={t.text} />
                </View>
                <Text style={[Typography.body, { color: t.text }]}>폰트</Text>
              </View>
              {/* 현재 폰트 이름은 그 폰트의 얼굴로 — 행 자체가 작은 견본이 된다. */}
              <Text style={[fontPreviewStyle(fontId), styles.rowValue, { color: t.textMuted }]}>
                {currentFontName}
              </Text>
              <Icon name="forward" size={16} color={t.textDisabled} />
            </Pressable>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[...sectionTitleStyle, { color: t.textMuted }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: t.surface }]}>
              {section.rows.map((row, idx) => (
                <Pressable
                  key={row.label}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  style={[
                    styles.row,
                    idx !== section.rows.length - 1 && {
                      borderBottomColor: t.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                      <Icon name={row.icon} size={20} color={t.text} />
                    </View>
                    <Text style={[Typography.body, { color: t.text }]}>{row.label}</Text>
                  </View>
                  <Icon name="forward" size={16} color={t.textDisabled} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* 회원탈퇴 (#547) — 행이 아니라 목록 밖 하단의 낮은 존재감 링크.
            실수로 닿기 어려운 자리 + 파괴 확인 다이얼로그의 2중 방어. */}
        <Pressable
          onPress={() => setConfirmWithdraw(true)}
          accessibilityRole="button"
          accessibilityLabel="회원탈퇴"
          style={styles.withdrawLink}>
          <Text style={[Typography.supporting, { color: t.textDisabled }]}>회원탈퇴</Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={confirmWithdraw}
        title="정말 탈퇴할까요?"
        body="모든 루틴·기록·프로필이 삭제되고 복구할 수 없어요. 같은 계정으로 다시 로그인해도 새 계정으로 시작하게 돼요."
        confirmLabel="탈퇴하기"
        confirmAccessibilityLabel="회원탈퇴 확인"
        destructive
        onConfirm={() => {
          setConfirmWithdraw(false);
          onWithdraw?.();
        }}
        onCancel={() => setConfirmWithdraw(false)}
      />

      <ConfirmDialog
        visible={confirmLogout}
        title="로그아웃할까요?"
        body="다시 이용하려면 로그인이 필요해요."
        confirmLabel="로그아웃"
        confirmAccessibilityLabel="로그아웃 확인"
        destructive
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout?.();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.half,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  // 회원탈퇴 링크 (#547) — 목록 아래 중앙, 낮은 존재감.
  withdrawLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  designHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowValue: {
    // 이름이 길어도 라벨을 밀지 않고 자기 자리에서 줄어든다.
    flexShrink: 1,
    marginRight: Spacing.one,
  },
});
