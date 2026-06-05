import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { getOptionalUpdatesModule } from '@/components/optional-updates';

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
          AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.welcomeCompleted),
          AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId),
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
            const update = await updates.checkForUpdateAsync();
            if (update.isAvailable) {
              await updates.fetchUpdateAsync();
              await updates.reloadAsync();
              return;
            }
          } catch {
            // Fall back to the currently running bundle if update checks fail.
          }
        }

        const currentUpdateId = updates?.isEnabled ? updates.updateId : null;
        if (currentUpdateId && lastSeenUpdateId !== currentUpdateId) {
          didPresentRef.current = true;
          router.push('/whats-new-modal');
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