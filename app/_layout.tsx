import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { enableFreeze, enableScreens } from 'react-native-screens';
import 'react-native-reanimated';

import { LaunchFlow } from '@/components/launch-flow';
import { ThemeModeProvider, useThemeMode } from '@/components/theme-mode';
import { ErrorBoundary } from '@/components/error-boundary';
import { beginSplashHangWatchdog, endSplashHangWatchdog } from '@/components/splash-hang-reporter';
import { installCrashReporter } from '@/components/crash-reporter';

// Temporary iOS crash mitigation: avoid native screen primitives during launch.
if (Platform.OS === 'ios') {
  enableScreens(false);
  enableFreeze(false);
}

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { colorScheme } = useThemeMode();

  useEffect(() => {
    installCrashReporter();
    beginSplashHangWatchdog();

    return () => {
      endSplashHangWatchdog('root-layout-unmounted');
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LaunchFlow />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'formSheet', title: 'Modal' }} />
        <Stack.Screen name="welcome-modal" options={{ presentation: 'modal', title: 'Welcome to KBPS' }} />
        <Stack.Screen name="whats-new-modal" options={{ presentation: 'modal', title: "What's New" }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeModeProvider>
        <RootLayoutNav />
      </ThemeModeProvider>
    </ErrorBoundary>
  );
}
