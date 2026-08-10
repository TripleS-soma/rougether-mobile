import { ScrollView, StyleSheet, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { DEFAULT_THEME_ID, type ThemeId, THEME_OPTIONS } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

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

  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title="테마 색상" onBack={onBack} />

      <ScrollView contentContainerStyle={pickerStyles.body}>
        <AppearancePreview />

        <View style={pickerStyles.list}>
          {THEME_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              name={opt.name}
              selected={opt.id === themeId}
              accessibilityLabel={`${opt.name} 테마`}
              onPress={() => onChangeThemeId?.(opt.id)}
              swatch={
                <View
                  style={[styles.swatch, { backgroundColor: opt.swatch, borderColor: t.border }]}
                />
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
