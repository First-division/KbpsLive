import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { getOptionalUpdatesModule } from '@/components/optional-updates';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function LaunchFlow() {
  const router = useRouter();
  const didPresentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (didPresentRef.current) {
        return;
      }

      try {
        const [welcomeCompleted, lastSeenUpdateId] = await Promise.all([
          withTimeout(AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.welcomeCompleted), 1500, null),
          withTimeout(AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId), 1500, null),
        ]);

        if (cancelled || didPresentRef.current) {
          return;
        }

        if (welcomeCompleted !== 'true') {
          didPresentRef.current = true;
          router.push('/welcome-modal');
          return;
        }

        const updates = !__DEV__ ? getOptionalUpdatesModule() : null;

        if (updates?.isEnabled) {
          try {
            const update = await withTimeout(
              updates.checkForUpdateAsync(),
              3500,
              { isAvailable: false }
            );
            
            if (update.isAvailable) {
              await withTimeout(updates.fetchUpdateAsync(), 6000, null);

              // Avoid Android startup refresh loops caused by repeated reloads.
              if (Platform.OS === 'ios') {
                await withTimeout(updates.reloadAsync(), 2000, undefined);
                return;
              }
            }
          } catch {
            // Fall back to the currently running bundle if update checks fail.
          }
        }

        const currentUpdateId = updates?.isEnabled ? updates.updateId : null;
        
        if (currentUpdateId && lastSeenUpdateId !== currentUpdateId) {
          didPresentRef.current = true;
          router.push('/whats-new-modal');
          return;
        }
      } catch {
        // If launch state is unavailable, fall through to the main app.
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}