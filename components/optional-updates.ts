type UpdatesModule = {
  isEnabled: boolean;
  updateId: string | null;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<unknown>;
  reloadAsync: () => Promise<void>;
};

export function getOptionalUpdatesModule(): UpdatesModule | null {
  try {
    // Some debug runtimes do not have the ExpoUpdates native module installed.
    const updates = require('expo-updates') as UpdatesModule;
    return updates;
  } catch {
    return null;
  }
}
