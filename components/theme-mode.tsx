import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, AppState, Platform } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeModeContextValue = {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'kbpslive.themePreference';

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function normalizeSystemScheme(value: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return value === 'dark' ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    normalizeSystemScheme(Appearance.getColorScheme())
  );

  const refreshSystemScheme = useCallback(async () => {
    let nextScheme = normalizeSystemScheme(Appearance.getColorScheme());

    setSystemScheme((previous) => (previous === nextScheme ? previous : nextScheme));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) {
          return;
        }

        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      } catch {
        // Keep default preference when storage is unavailable.
      }
    };

    void loadPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshSystemScheme();

    const appearanceSub = Appearance.addChangeListener(() => {
      void refreshSystemScheme();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      void refreshSystemScheme();
    });

    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [preference, refreshSystemScheme]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }

    void refreshSystemScheme();
  }, [preference, refreshSystemScheme]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const timer = setInterval(() => {
      void refreshSystemScheme();
    }, 2000);

    return () => clearInterval(timer);
  }, [preference, refreshSystemScheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);

    if (nextPreference === 'system') {
      void refreshSystemScheme();
    }

    void AsyncStorage.setItem(STORAGE_KEY, nextPreference);
  }, [refreshSystemScheme]);

  const colorScheme = preference === 'system' ? systemScheme : preference;

  const value = useMemo(
    () => ({ colorScheme, preference, setPreference }),
    [colorScheme, preference, setPreference]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return context;
}
