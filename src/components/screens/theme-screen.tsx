import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
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
 * preview card (shared with the 폰트 picker) and this whole screen recolor live.
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
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="테마 색상" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <AppearancePreview />

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
