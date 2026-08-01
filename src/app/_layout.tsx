import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/app/animated-splash-overlay';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandThemeProvider, useResolvedScheme } from '@/hooks/use-tokens';
import { useWebFonts } from '@/hooks/use-web-fonts';
import { initAnalytics } from '@/lib/analytics';
import { initPushDisplay } from '@/lib/push-events';

// 포그라운드 푸시 표시 + Android 채널 (#405) — 앱 시작 시 1회, 웹은 no-op.
initPushDisplay();
initAnalytics();

// 스플래시 자동 숨김 중단 (#569) — JS 첫 프레임에 즉시 사라져 아트가 깜빡이던
// 문제. AnimatedSplashOverlay가 최소 노출 뒤 hideAsync로 걷는다. 웹은 no-op.
SplashScreen.setOptions({ duration: 250, fade: true });
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Navigation chrome follows the resolved scheme (OS scheme + the 다크 모드
 * override from settings) — must sit below BrandThemeProvider to read it.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const scheme = useResolvedScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>{children}</ThemeProvider>
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
  return (
    // RNGH 제스처(방 꾸미기 자유 배치 #327 등)의 루트 컨텍스트.
    <GestureHandlerRootView style={styles.root}>
      {/* initialMetrics: 첫 프레임부터 정확한 인셋을 동기로 준다 — 없으면 인셋이
          0에서 시작해 하단 탭바가 내비게이션 바 아래에 깔렸다가 보정된다 (#456). */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <BrandThemeProvider>
            <ToastProvider>
              <NavigationTheme>
                <AnimatedSplashOverlay />
                <Stack screenOptions={{ headerShown: false }} />
              </NavigationTheme>
            </ToastProvider>
          </BrandThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
