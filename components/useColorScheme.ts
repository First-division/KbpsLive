import { useThemeMode } from './theme-mode';

export function useColorScheme(): 'light' | 'dark' {
  return useThemeMode().colorScheme;
}
