import { ScrollView, StyleSheet, View } from 'react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import type { CharacterId } from '@/constants/characters';
import { DEFAULT_THEME_ID, Radius, THEME_OPTIONS, type ThemeId } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens } from '@/hooks/use-tokens';

export type ThemeScreenProps = {
  /** 미리보기 카드에 그릴 내 정체성 (#899). */
  userName?: string;
  characterId?: CharacterId;
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
  userName,
  characterId,
  themeId = DEFAULT_THEME_ID,
  onChangeThemeId,
  onBack,
}: ThemeScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();

  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title="테마 색상" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          pickerStyles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <AppearancePreview userName={userName} characterId={characterId} />

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
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
