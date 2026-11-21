import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { enableFreeze, enableScreens } from 'react-native-screens';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeModeProvider, useThemeMode } from '@/components/theme-mode';
import { supportsIOSNativeTabCompaction } from '@/constants/platform';

// Keep legacy startup mitigation on older iOS while enabling native screens
// where native tab minimization relies on platform screen primitives.
if (Platform.OS === 'ios') {
  const supportsNativeTabCompaction = supportsIOSNativeTabCompaction(Platform.Version);
  enableScreens(supportsNativeTabCompaction);
  enableFreeze(supportsNativeTabCompaction);
}

export const unstable_settings = {
  anchor: '(tabs)',
  initialRouteName: '(tabs)',
};

function RootLayoutNav() {
  const { colorScheme } = useThemeMode();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="app-guide" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="welcome-modal" options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="whats-new-modal" options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }} />
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
