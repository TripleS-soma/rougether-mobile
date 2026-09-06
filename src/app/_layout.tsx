import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AppIconSync } from '@/components/app/app-icon-sync';
import { notifyAppForegroundInteraction } from '@/lib/app-icon-events';
import { AnimatedSplashOverlay } from '@/components/app/animated-splash-overlay';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandThemeProvider, useResolvedScheme } from '@/hooks/use-tokens';
import { useWebFonts } from '@/hooks/use-web-fonts';
import { initAnalytics } from '@/lib/analytics';
import { initAppOpenTracking } from '@/lib/app-open';
import { initErrorReporting } from '@/lib/error-reporting';
import { initPushDisplay } from '@/lib/push-events';
import { createQueryClient, subscribeAppStateFocus } from '@/lib/query-client';

// 포그라운드 푸시 표시 + Android 채널 (#405) — 앱 시작 시 1회, 웹은 no-op.
initPushDisplay();
initAnalytics();
// 재방문 계기 (#803) — 콜드 스타트 판정 + 포그라운드 복귀·딥링크 감시.
// 푸시 탭은 알림 핸들러가 먼저 보고한다. 한 포그라운드당 1건.
initAppOpenTracking();
// 에러 리포팅 (#801) — 분석과 별개 창구. 초기화가 실패해도 무동작으로 끝난다.
initErrorReporting();

// 스플래시 자동 숨김 중단 (#569) — JS 첫 프레임에 즉시 사라져 아트가 깜빡이던
// 문제. AnimatedSplashOverlay가 최소 노출 뒤 hideAsync로 걷는다. 웹은 no-op.
SplashScreen.setOptions({ duration: 250, fade: true });
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Navigation chrome follows the resolved scheme (OS scheme + the 다크 모드
 * override from settings) — must sit below BrandThemeProvider to read it.
 *
 * StatusBar (#755): OS 상태바는 기본으로 **시스템 테마만** 따른다 — 시스템
 * 다크 + 앱 라이트 강제면 밝은 크림 배경 위에 흰 시간·배터리가 얹혀 안
 * 보였다 (Android edge-to-edge 기본 흰 아이콘도 동일 뿌리). 앱의 resolved
 * scheme으로 명시해 라이트=검은 글자, 다크=흰 글자로 고정한다.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const scheme = useResolvedScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

/**
 * Root navigator: a Stack holding the `(tabs)` app shell plus the auth routes
 * (`/login`, `/signup`). Auth gating (redirect when signed out) and the
 * post-signup onboarding step are follow-ups.
 */
export default function RootLayout() {
  // Web-only app-font registration (#382); native embeds them at build time.
  useWebFonts();
  // 클라이언트는 앱 수명 동안 하나다 — 렌더마다 새로 만들면 캐시가 매번
  // 비워진다. useState 초기화 함수로 첫 렌더에 1회만 생성한다 (#1027).
  const [queryClient] = useState(createQueryClient);
  // RN 포커스 감지 — 없으면 refetchOnWindowFocus가 네이티브에서 영영 안 돈다.
  useEffect(subscribeAppStateFocus, []);
  return (
    // RNGH 제스처(방 꾸미기 자유 배치 #327 등)의 루트 컨텍스트.
    <GestureHandlerRootView style={styles.root} onTouchStart={notifyAppForegroundInteraction}>
      {/* initialMetrics: 첫 프레임부터 정확한 인셋을 동기로 준다 — 없으면 인셋이
          0에서 시작해 하단 탭바가 내비게이션 바 아래에 깔렸다가 보정된다 (#456). */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppIconSync />
            <BrandThemeProvider>
              <ToastProvider>
                <NavigationTheme>
                  <AnimatedSplashOverlay />
                  <Stack screenOptions={{ headerShown: false }} />
                </NavigationTheme>
              </ToastProvider>
            </BrandThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
