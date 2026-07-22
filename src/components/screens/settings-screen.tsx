import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import {
  Overlay,
  DEFAULT_THEME_MODE,
  Radius,
  Spacing,
  type ThemeMode,
  Typography,
} from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

const MODE_OPTIONS: { id: ThemeMode; name: string }[] = [
  { id: 'system', name: '시스템' },
  { id: 'light', name: '라이트' },
  { id: 'dark', name: '다크' },
];

type Row = { icon: IconName; label: string; onPress?: () => void };

export type SettingsScreenProps = {
  /** Light/dark preference ('system' follows the OS). */
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  onOpenNotifications?: () => void;
  onOpenSound?: () => void;
  onOpenHelp?: () => void;
  onReplayOnboarding?: () => void;
  onLogout?: () => void;
};

/**
 * Settings screen, ported from the prototype `SettingsScreen`: dark-mode picker
 * + account / notification / misc rows. Theme tokens + type scale; vector icons
 * via the shared Icon. Each row navigates to its sub-screen via the matching
 * prop. The mode picker is prop-driven (onChangeThemeMode); the app shell wires
 * it to the global BrandThemeProvider. (The 포근/숲/한옥 brand picker was
 * removed with dark mode's arrival — cozy is the single brand theme now.)
 */
export function SettingsScreen({
  themeMode = DEFAULT_THEME_MODE,
  onChangeThemeMode,
  onEditProfile,
  onChangePassword,
  onOpenNotifications,
  onOpenSound,
  onOpenHelp,
  onReplayOnboarding,
  onLogout,
}: SettingsScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
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
        { icon: 'refresh', label: '튜토리얼 다시 보기', onPress: onReplayOnboarding },
        { icon: 'leave', label: '로그아웃', onPress: () => setConfirmLogout(true) },
      ],
    },
  ];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Text style={[Typography.h2, { color: t.text }]}>설정</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>앱 환경을 관리해보세요.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textMuted }]}>디자인</Text>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={styles.designHead}>
              <View style={[styles.iconCircle, { backgroundColor: t.surfaceMuted }]}>
                <Icon name="moon" size={20} color={t.text} />
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.label, { color: t.text }]}>다크 모드</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  시스템을 따르거나 직접 골라보세요.
                </Text>
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
  confirmBackdrop: {
    flex: 1,
    backgroundColor: Overlay.dim,
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
