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
      console.log('[LaunchFlow] Starting launch flow...');
      
      if (didPresentRef.current) {
        console.log('[LaunchFlow] Already presented, skipping');
        return;
      }

      try {
        console.log('[LaunchFlow] Reading AsyncStorage...');
        const [welcomeCompleted, lastSeenUpdateId] = await Promise.all([
          AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.welcomeCompleted),
          AsyncStorage.getItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId),
        ]);
        console.log('[LaunchFlow] AsyncStorage read complete:', { welcomeCompleted, lastSeenUpdateId });

        if (cancelled || didPresentRef.current) {
          console.log('[LaunchFlow] Cancelled or already presented');
          return;
        }

        if (welcomeCompleted !== 'true') {
          console.log('[LaunchFlow] Welcome not completed, pushing welcome-modal');
          didPresentRef.current = true;
          router.push('/welcome-modal');
          return;
        }

        console.log('[LaunchFlow] Welcome completed, checking for updates...');
        const updates = !__DEV__ ? getOptionalUpdatesModule() : null;
        console.log('[LaunchFlow] Updates module:', updates ? 'available' : 'disabled in dev');

        if (updates?.isEnabled) {
          try {
            console.log('[LaunchFlow] Checking for updates...');
            const update = await updates.checkForUpdateAsync();
            console.log('[LaunchFlow] Update check result:', update);
            
            if (update.isAvailable) {
              console.log('[LaunchFlow] Update available, fetching...');
              await updates.fetchUpdateAsync();
              console.log('[LaunchFlow] Update fetched, reloading...');
              await updates.reloadAsync();
              console.log('[LaunchFlow] Reload triggered');
              return;
            }
          } catch (error) {
            console.error('[LaunchFlow] Update check failed:', error);
            // Fall back to the currently running bundle if update checks fail.
          }
        }

        const currentUpdateId = updates?.isEnabled ? updates.updateId : null;
        console.log('[LaunchFlow] Current update ID:', currentUpdateId, 'Last seen:', lastSeenUpdateId);
        
        if (currentUpdateId && lastSeenUpdateId !== currentUpdateId) {
          console.log('[LaunchFlow] New update detected, pushing whats-new-modal');
          didPresentRef.current = true;
          router.push('/whats-new-modal');
        }
        
        console.log('[LaunchFlow] Launch flow complete');
      } catch (error) {
        console.error('[LaunchFlow] ERROR:', error);
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