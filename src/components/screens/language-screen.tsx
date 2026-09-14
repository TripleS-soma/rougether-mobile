import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PickerRow, pickerStyles } from '@/components/screens/settings/picker-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { type AppLanguage, DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, useT } from '@/i18n';

export type LanguageScreenProps = {
  language?: AppLanguage;
  /** 고르면 바로 적용 — 미리보기가 필요한 테마·폰트와 달리 결과가 화면 전체에 즉시 보인다. */
  onSelectLanguage?: (language: AppLanguage) => void;
  onBack?: () => void;
};

/**
 * 설정 → 언어 (#893). 각 언어는 자기 이름으로 표기하고, 고르는 즉시 앱 전체에 적용된다.
 * 순수/prop 기반 — 영속화는 셸(use-language)이 맡는다.
 */
export function LanguageScreen({
  language = DEFAULT_LANGUAGE,
  onSelectLanguage,
  onBack,
}: LanguageScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  return (
    <View style={[pickerStyles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('language.title')} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          pickerStyles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>{tr('language.hint')}</Text>
        <View style={pickerStyles.list}>
          {LANGUAGE_OPTIONS.map((opt) => (
            <PickerRow
              key={opt.id}
              name={opt.name}
              selected={opt.id === language}
              accessibilityLabel={tr('language.optionA11y', { name: opt.name })}
              onPress={() => opt.id !== language && onSelectLanguage?.(opt.id)}
              swatch={
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: t.surfaceMuted, borderColor: t.border },
                  ]}>
                  <Text style={[Typography.label, { color: t.text }]}>{opt.id.toUpperCase()}</Text>
                </View>
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
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
