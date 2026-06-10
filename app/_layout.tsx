import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { enableFreeze, enableScreens } from 'react-native-screens';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeModeProvider, useThemeMode } from '@/components/theme-mode';

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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
