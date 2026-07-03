import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandThemeProvider } from '@/hooks/use-tokens';
import { startMockServer } from '@/mocks/init';

/**
 * Root navigator: a Stack holding the `(tabs)` app shell plus the auth routes
 * (`/login`, `/signup`). Auth gating (redirect when signed out) and the
 * post-signup onboarding step are follow-ups.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    startMockServer();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BrandThemeProvider>
          <ToastProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerShown: false }} />
            </ThemeProvider>
          </ToastProvider>
        </BrandThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
