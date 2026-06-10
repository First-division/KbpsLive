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

function hasAsyncStorage(): boolean {
  return typeof (AsyncStorage as any)?.getItem === 'function'
    && typeof (AsyncStorage as any)?.setItem === 'function';
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const FALLBACK_THEME_MODE_CONTEXT: ThemeModeContextValue = {
  colorScheme: 'dark',
  preference: 'dark',
  setPreference: () => {
    // No-op when theme provider is intentionally disabled for crash isolation.
  },
};

function normalizeSystemScheme(value: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return value === 'dark' ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
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
      if (!hasAsyncStorage()) {
        return;
      }

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

    if (hasAsyncStorage()) {
      void AsyncStorage.setItem(STORAGE_KEY, nextPreference);
    }
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
    return FALLBACK_THEME_MODE_CONTEXT;
  }
  return context;
}
