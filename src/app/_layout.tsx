import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandThemeProvider, useResolvedScheme } from '@/hooks/use-tokens';
import { useWebFonts } from '@/hooks/use-web-fonts';

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
      <SafeAreaProvider>
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
