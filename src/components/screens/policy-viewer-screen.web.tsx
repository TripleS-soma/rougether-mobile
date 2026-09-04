import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';

export type PolicyViewerScreenProps = {
  /** Header title (이용약관 / 개인정보처리방침). */
  title: string;
  /** Document URL rendered inside the in-app web view. */
  url: string;
  onBack?: () => void;
};

/**
 * Web variant — react-native-webview has no web support, so the document is
 * embedded in a plain iframe (the policy pages send no X-Frame-Options).
 */
export function PolicyViewerScreen({ title, url, onBack }: PolicyViewerScreenProps) {
  // 떠 있는 글래스 헤더(#1069) — iframe은 마진으로 비켜 준다.
  const headerInset = useHeaderContentInset();
  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={title} onBack={onBack} />
      <iframe title={title} src={url} style={{ ...iframeStyle, marginTop: headerInset }} />
    </View>
  );
}

const iframeStyle = { flex: 1, border: 'none', width: '100%' } as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
