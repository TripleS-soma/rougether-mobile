import { forwardRef } from 'react';
import { StyleSheet, TextInput as NativeTextInput, type TextInputProps } from 'react-native';

import { inputFontFamily } from '@/constants/input-font';

/** A native TextInput with a complete Hangul font; value/events/ref stay native. */
export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(function AppTextInput(
  { style, ...props },
  ref,
) {
  const selectedFamily = StyleSheet.flatten(style)?.fontFamily;
  const fontFamily = inputFontFamily(selectedFamily);
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={fontFamily === selectedFamily ? style : [style, { fontFamily }]}
    />
  );
});
