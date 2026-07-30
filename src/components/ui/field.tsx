import { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type FieldProps = {
  value: string;
  onChangeText: (v: string) => void;
  label?: string;
  placeholder?: string;
  trailing?: ReactNode;
  error?: string;
  success?: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
};

/**
 * Shared labelled text field — extracted once the login and signup screens both
 * needed it. Theme-aware via `useTokens()`; supports optional label/error/success.
 */
export function Field({
  value,
  onChangeText,
  label,
  placeholder,
  trailing,
  error,
  success,
  ...input
}: FieldProps) {
  const t = useTokens();
  const emph = useFontEmphasis();
  const Typography = useTypography();
  const borderColor = error ? t.danger : success ? t.primary : 'transparent';

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          style={[Typography.supporting, emph('semibold'), styles.label, { color: t.textMuted }]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, { backgroundColor: t.surfaceMuted, borderColor }]}>
        <TextInput
          style={[styles.input, { color: t.text }]}
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
          value={value}
          onChangeText={onChangeText}
          {...input}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={[Typography.supporting, styles.msg, { color: t.danger }]}>{error}</Text>
      ) : null}
      {!error && success ? (
        <Text style={[Typography.supporting, styles.msg, { color: t.primaryText }]}>{success}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.half,
  },
  label: {
    marginLeft: Spacing.one,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.half,
  },
  msg: {
    marginLeft: Spacing.one,
  },
});
