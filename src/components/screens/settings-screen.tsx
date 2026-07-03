import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { DEFAULT_THEME_ID, Radius, Spacing, type ThemeId, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

type ThemeOption = { id: ThemeId; name: string; description: string };

// Theme display metadata (from the prototype design system). Kept local; extract
// to constants when a real theme switcher consumes it.
const THEME_OPTIONS: ThemeOption[] = [
  { id: 'cozy', name: '포근', description: '따뜻한 기본 테마' },
  { id: 'forest', name: '숲', description: '맑고 싱그러운 테마' },
  { id: 'hanok', name: '한옥', description: '차분한 전통 테마' },
];

type Row = { icon: IconName; label: string; onPress?: () => void };

export type SettingsScreenProps = {
  themeId?: ThemeId;
  onChangeTheme?: (id: ThemeId) => void;
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  onOpenNotifications?: () => void;
  onOpenSound?: () => void;
  onOpenHelp?: () => void;
  onReplayOnboarding?: () => void;
  onLogout?: () => void;
};

/**
 * Settings screen, ported from the prototype `SettingsScreen`: theme picker +
 * account / notification / misc rows. Theme tokens + type scale; vector icons
 * via the shared Icon. Each row navigates to its sub-screen via the matching
 * prop. The theme picker is prop-driven (onChangeTheme); the app shell wires it
 * to the global BrandThemeProvider so the whole app re-tints.
 */
export function SettingsScreen({
  themeId = DEFAULT_THEME_ID,
  onChangeTheme,
  onEditProfile,
  onChangePassword,
  onOpenNotifications,
  onOpenSound,
  onOpenHelp,
  onReplayOnboarding,
  onLogout,
}: SettingsScreenProps) {
  const t = useTokens();
  // Logging out drops the session immediately, so gate it behind a confirm.
  const [confirmLogout, setConfirmLogout] = useState(false);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: '계정',
      rows: [
        { icon: 'profile', label: '프로필 편집', onPress: onEditProfile },
        { icon: 'lock', label: '비밀번호 변경', onPress: onChangePassword },
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
        { icon: 'refresh', label: '온보딩 다시 보기', onPress: onReplayOnboarding },
        { icon: 'leave', label: '로그아웃', onPress: () => setConfirmLogout(true) },
      ],
    },
  ];

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Text style={[Typography.h2, { color: t.text }]}>설정</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>앱 환경을 관리해보세요.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textMuted }]}>디자인</Text>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={styles.designHead}>
              <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                <Icon name="palette" size={20} color={t.text} />
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>화면 스타일</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  원하는 분위기로 전체 화면을 바꿔보세요.
                </Text>
              </View>
            </View>
            <View style={styles.themeGrid}>
              {THEME_OPTIONS.map((opt) => {
                const selected = opt.id === themeId;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onChangeTheme?.(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.themeCard, { borderColor: selected ? t.primary : t.border }]}>
                    <Text style={[Typography.label, { color: t.text }]}>{opt.name}</Text>
                    <Text style={[styles.themeDesc, { color: t.textMuted }]}>
                      {opt.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.textMuted }]}>{section.title}</Text>
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
      </ScrollView>

      <Modal
        transparent
        visible={confirmLogout}
        animationType="fade"
        onRequestClose={() => setConfirmLogout(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmLogout(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>로그아웃할까요?</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              다시 이용하려면 로그인이 필요해요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConfirmLogout(false)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmLogout(false);
                  onLogout?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="로그아웃 확인"
                style={[styles.confirmBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>로그아웃</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

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
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  designHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  themeCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  themeDesc: {
    fontSize: 10,
    lineHeight: 13,
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
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
