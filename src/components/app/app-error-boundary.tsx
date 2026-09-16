import * as Sentry from '@sentry/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RetryState } from '@/components/ui/retry-state';
import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type AppErrorFallbackProps = {
  /** 경계를 초기화해 자식 트리를 다시 그린다. */
  onRetry: () => void;
};

/**
 * 화면 렌더 중 예외가 났을 때의 복구 화면 (#1376). 종전엔 렌더 예외가 흰 화면(웹)이나
 * 앱 종료(네이티브)로 끝났다. 에러는 경계가 Sentry로 보내고, 사용자는 "다시 시도"로
 * 트리를 새로 그린다 — 일시적 데이터 문제면 그걸로 풀린다.
 */
export function AppErrorFallback({ onRetry }: AppErrorFallbackProps) {
  const t = useTokens();
  const tr = useT();
  return (
    <View style={[styles.screen, { backgroundColor: t.screen }]} accessibilityRole="alert">
      <RetryState
        message={tr('app.errorBoundary.title')}
        detail={tr('app.errorBoundary.body')}
        onRetry={onRetry}
      />
    </View>
  );
}

/**
 * 앱 트리 경계 (#1376) — Sentry ErrorBoundary가 예외를 이벤트로 남기고(`componentStack` 포함)
 * 대체 화면을 그린다. 테마·언어 프로바이더 **안쪽**에 둬서 대체 화면도 앱 토큰·문구를 쓴다.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <AppErrorFallback onRetry={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: Spacing.six },
});
