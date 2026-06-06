import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { LaunchFlow } from '@/components/launch-flow';
import { ThemeModeProvider, useThemeMode } from '@/components/theme-mode';
import { ErrorBoundary } from '@/components/error-boundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { colorScheme } = useThemeMode();

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
  useEffect(() => {
    // Capture unhandled promise rejections
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('=== UNHANDLED PROMISE REJECTION ===');
      console.error('Reason:', event.reason);
      console.error('Promise:', event.promise);
      console.error('=== END ===');
    };

    // Capture uncaught errors
    const errorHandler = (event: ErrorEvent) => {
      console.error('=== UNCAUGHT ERROR ===');
      console.error('Error:', event.error?.message);
      console.error('Stack:', event.error?.stack);
      console.error('=== END ===');
    };

    // Note: These event listeners may not work in React Native the same way as web
    // but they might catch some errors
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', unhandledRejectionHandler);
      window.addEventListener('error', errorHandler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
        window.removeEventListener('error', errorHandler);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeModeProvider>
        <RootLayoutNav />
      </ThemeModeProvider>
    </ErrorBoundary>
  );
}
