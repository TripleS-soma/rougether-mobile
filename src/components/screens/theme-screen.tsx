import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { DEFAULT_THEME_ID, Radius, Spacing, type ThemeId, THEME_OPTIONS } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type ThemeScreenProps = {
  /** Active brand theme; drives the selected marker + live preview. */
  themeId?: ThemeId;
  onChangeThemeId?: (id: ThemeId) => void;
  onBack?: () => void;
};

/**
 * "테마 색상" picker reached from 설정 → 테마 색상 (#459). Picking a theme applies
 * it app-wide immediately (the shell's BrandThemeProvider re-tints), so the
 * preview card and this whole screen recolor live — no separate preview tokens.
 * Pure/prop-driven; the shell persists via onChangeThemeId. Light/dark follows
 * the current mode. Fixed category dots are theme-independent by design.
 */
export function ThemeScreen({
  themeId = DEFAULT_THEME_ID,
  onChangeThemeId,
  onBack,
}: ThemeScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader title="테마 색상" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        {/* 라이브 미리보기 — 고른 테마가 즉시 적용되므로 활성 토큰을 그대로 렌더. */}
        <View style={[styles.preview, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.previewTop}>
            <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
              <Text style={styles.avatarGlyph}>🐯</Text>
            </View>
            <Text style={[Typography.label, { color: t.text }]}>준서의 방</Text>
            <View style={[styles.coinPill, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.supporting, emph('bold'), { color: t.text }]}>9999+</Text>
            </View>
          </View>

          <View style={styles.previewRow}>
            {/* 선택 원 샘플 — 달력의 선택 날짜와 같은 primary 채움. */}
            <View style={[styles.dayCircle, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>15</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: t.primarySoft }]}>
              <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
                달력
              </Text>
            </View>
            <View style={[styles.addBtn, { backgroundColor: t.primary }]}>
              <Text style={[styles.addGlyph, { color: t.onPrimary }]}>＋</Text>
            </View>
          </View>

          <View style={[styles.cta, { backgroundColor: t.primary }]}>
            <Text style={[Typography.label, { color: t.onPrimary }]}>오늘 루틴 완료하기</Text>
          </View>
        </View>

        <View style={styles.list}>
          {THEME_OPTIONS.map((opt) => {
            const selected = opt.id === themeId;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onChangeThemeId?.(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.name} 테마`}
                style={[
                  styles.optRow,
                  { backgroundColor: t.surface, borderColor: selected ? t.primary : t.border },
                  selected && styles.optRowSelected,
                ]}>
                <View
                  style={[styles.swatch, { backgroundColor: opt.swatch, borderColor: t.border }]}
                />
                <Text
                  style={[
                    Typography.body,
                    emph(selected ? 'bold' : 'normal'),
                    styles.optName,
                    { color: t.text },
                  ]}>
                  {opt.name}
                </Text>
                {selected ? <Icon name="check" size={20} color={t.primaryText} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  preview: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 18,
  },
  coinPill: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  addBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    fontSize: 22,
    lineHeight: 24,
  },
  cta: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  optRowSelected: {
    borderWidth: 2,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optName: {
    flex: 1,
  },
});
