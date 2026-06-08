import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { getOptionalUpdatesModule } from '@/components/optional-updates';
import { endSplashHangWatchdog, updateSplashStage } from '@/components/splash-hang-reporter';

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
      console.log('[LaunchFlow] Starting launch flow...');
      updateSplashStage('launch-flow-start');
      
      if (didPresentRef.current) {
        console.log('[LaunchFlow] Already presented, skipping');
        updateSplashStage('launch-flow-already-presented');
        return;
      }

      try {
        console.log('[LaunchFlow] Reading AsyncStorage...');
        updateSplashStage('launch-flow-reading-storage');
        const [welcomeCompleted, lastSeenUpdateId] = await Promise.all([
          withTimeout(AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.welcomeCompleted), 1500, null),
          withTimeout(AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId), 1500, null),
        ]);
        console.log('[LaunchFlow] AsyncStorage read complete:', { welcomeCompleted, lastSeenUpdateId });
        updateSplashStage('launch-flow-storage-read', `welcomeCompleted=${welcomeCompleted}`);

        if (cancelled || didPresentRef.current) {
          console.log('[LaunchFlow] Cancelled or already presented');
          updateSplashStage('launch-flow-cancelled');
          return;
        }

        if (welcomeCompleted !== 'true') {
          console.log('[LaunchFlow] Welcome not completed, pushing welcome-modal');
          updateSplashStage('launch-flow-route-welcome');
          endSplashHangWatchdog('routed-welcome-modal');
          didPresentRef.current = true;
          router.push('/welcome-modal');
          return;
        }

        console.log('[LaunchFlow] Welcome completed, checking for updates...');
        updateSplashStage('launch-flow-checking-updates');
        const updates = !__DEV__ ? getOptionalUpdatesModule() : null;
        console.log('[LaunchFlow] Updates module:', updates ? 'available' : 'disabled in dev');
        updateSplashStage('launch-flow-updates-module', updates ? 'available' : 'unavailable');

        if (updates?.isEnabled) {
          try {
            console.log('[LaunchFlow] Checking for updates...');
            updateSplashStage('launch-flow-updates-check-start');
            const update = await withTimeout(
              updates.checkForUpdateAsync(),
              3500,
              { isAvailable: false }
            );
            console.log('[LaunchFlow] Update check result:', update);
            updateSplashStage('launch-flow-updates-check-result', `isAvailable=${String(update.isAvailable)}`);
            
            if (update.isAvailable) {
              console.log('[LaunchFlow] Update available, fetching...');
              updateSplashStage('launch-flow-updates-fetch-start');
              await withTimeout(updates.fetchUpdateAsync(), 6000, null);
              console.log('[LaunchFlow] Update fetched, reloading...');
              updateSplashStage('launch-flow-updates-reload-start');
              await withTimeout(updates.reloadAsync(), 2000, undefined);
              console.log('[LaunchFlow] Reload triggered');
              endSplashHangWatchdog('updates-reload-triggered');
              return;
            }
          } catch (error) {
            console.error('[LaunchFlow] Update check failed:', error);
            updateSplashStage('launch-flow-updates-check-failed');
            // Fall back to the currently running bundle if update checks fail.
          }
        }

        const currentUpdateId = updates?.isEnabled ? updates.updateId : null;
        console.log('[LaunchFlow] Current update ID:', currentUpdateId, 'Last seen:', lastSeenUpdateId);
        
        if (currentUpdateId && lastSeenUpdateId !== currentUpdateId) {
          console.log('[LaunchFlow] New update detected, pushing whats-new-modal');
          updateSplashStage('launch-flow-route-whats-new');
          endSplashHangWatchdog('routed-whats-new-modal');
          didPresentRef.current = true;
          router.push('/whats-new-modal');
          return;
        }
        
        console.log('[LaunchFlow] Launch flow complete');
        updateSplashStage('launch-flow-complete');
        endSplashHangWatchdog('launch-flow-complete');
      } catch (error) {
        console.error('[LaunchFlow] ERROR:', error);
        updateSplashStage('launch-flow-error');
        endSplashHangWatchdog('launch-flow-error');
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