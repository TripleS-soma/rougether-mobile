import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  onLogout?: () => void;
};

/**
 * Settings screen, ported from the prototype `SettingsScreen`: theme picker +
 * account / notification / misc rows. Theme tokens + type scale; vector icons
 * via the shared Icon. The theme picker is prop-driven (onChangeTheme) — wiring it to a global
 * theme is a separate task.
 */
export function SettingsScreen({
  themeId = DEFAULT_THEME_ID,
  onChangeTheme,
  onLogout,
}: SettingsScreenProps) {
  const t = useTokens();

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: '계정',
      rows: [
        { icon: 'profile', label: '프로필 편집' },
        { icon: 'lock', label: '비밀번호 변경' },
      ],
    },
    {
      title: '알림',
      rows: [
        { icon: 'bell', label: '푸시 알림' },
        { icon: 'sound', label: '효과음' },
      ],
    },
    {
      title: '기타',
      rows: [
        { icon: 'help', label: '도움말' },
        { icon: 'leave', label: '로그아웃', onPress: onLogout },
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
});
