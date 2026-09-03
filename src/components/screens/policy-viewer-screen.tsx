import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Loading } from '@/components/ui/loading';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type PolicyViewerScreenProps = {
  /** Header title (이용약관 / 개인정보처리방침). */
  title: string;
  /** Document URL rendered inside the in-app web view. */
  url: string;
  onBack?: () => void;
};

/**
 * In-app viewer for the policy documents — replaces the external-browser hop
 * so 약관/처리방침 open without leaving the app. Native renders a WebView; the
 * `.web.tsx` variant uses an iframe. Pure/prop-driven.
 */
export function PolicyViewerScreen({ title, url, onBack }: PolicyViewerScreenProps) {
  const t = useTokens();
  // 떠 있는 글래스 헤더(#1069) — 웹뷰는 RN 스크롤이 아니라 마진으로 비켜 준다.
  const headerInset = useHeaderContentInset();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Remounting with a fresh key is the retry path — the failed WebView is
  // unmounted while RetryState shows, so there is no instance to reload().
  const [attempt, setAttempt] = useState(0);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={title} onBack={onBack} />
      {failed ? (
        <View style={styles.center}>
          <RetryState
            message="문서를 불러오지 못했어요."
            detail="네트워크 연결을 확인해 주세요."
            onRetry={() => {
              setFailed(false);
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : (
        <WebView
          key={attempt}
          testID="policy-webview"
          source={{ uri: url }}
          style={{ backgroundColor: t.screen, marginTop: headerInset }}
          onLoadEnd={() => setLoading(false)}
          // 서브 리소스(파비콘 등) 오류로 오탐하지 않게 메인 문서 요청만 실패 처리.
          onError={(e) => {
            if (!e.nativeEvent.url || e.nativeEvent.url === url) setFailed(true);
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.url === url) setFailed(true);
          }}
        />
      )}
      {loading && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <Loading size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
