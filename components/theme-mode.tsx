import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { EventEmitter, requireOptionalNativeModule } from 'expo-modules-core';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeModeContextValue = {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

type ThemeNativeModule = {
  getSystemColorScheme?: () => Promise<unknown> | unknown;
};

type AnyEventEmitter = {
  addListener: (eventName: string, listener: (event: Record<string, string>) => void) => { remove: () => void };
};

const STORAGE_KEY = 'kbpslive.themePreference';

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function normalizeSystemScheme(value: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return value === 'dark' ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const themeNativeModule = useMemo(
    () => (Platform.OS === 'ios'
      ? requireOptionalNativeModule<ThemeNativeModule>('ReactNativeWidgetExtension')
      : null),
    []
  );

  const nativeEmitter = useMemo((): AnyEventEmitter | null => {
    if (!themeNativeModule) {
      return null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new EventEmitter(themeNativeModule as any) as unknown as AnyEventEmitter;
    } catch {
      return null;
    }
  }, [themeNativeModule]);

  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    normalizeSystemScheme(Appearance.getColorScheme())
  );

  const refreshSystemScheme = useCallback(async () => {
    let nextScheme = normalizeSystemScheme(Appearance.getColorScheme());

    if (themeNativeModule?.getSystemColorScheme) {
      try {
        const nativeResult = await Promise.resolve(themeNativeModule.getSystemColorScheme());
        if (nativeResult === 'dark' || nativeResult === 'light') {
          nextScheme = nativeResult;
        }
      } catch {
        // Keep JS appearance snapshot as fallback.
      }
    }

    setSystemScheme((previous) => (previous === nextScheme ? previous : nextScheme));
  }, [themeNativeModule]);

  // Push-based appearance updates from native UIViewController trait observer.
  useEffect(() => {
    if (!nativeEmitter) {
      return;
    }
    const sub = nativeEmitter.addListener(
      'onAppearanceChange',
      (event: { colorScheme?: string }) => {
        const scheme: 'light' | 'dark' = event.colorScheme === 'dark' ? 'dark' : 'light';
        setSystemScheme((previous) => (previous === scheme ? previous : scheme));
      }
    );
    return () => {
      sub.remove();
    };
  }, [nativeEmitter]);

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

    setSystemScheme(normalizeSystemScheme(Appearance.getColorScheme()));

    const timer = setInterval(() => {
      void refreshSystemScheme();
    }, 750);

    return () => {
      clearInterval(timer);
    };
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
