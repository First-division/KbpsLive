type UpdatesModule = {
  isEnabled: boolean;
  updateId: string | null;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<unknown>;
  reloadAsync: () => Promise<void>;
};

export function getOptionalUpdatesModule(): UpdatesModule | null {
  try {
    // Some runtimes may resolve the JS package but still fail when touching native-backed fields.
    // Always guard property and function access so startup cannot crash or hang on missing native bridges.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUpdates = require('expo-updates') as any;

    let isEnabled = false;
    let updateId: string | null = null;

    try {
      isEnabled = Boolean(rawUpdates?.isEnabled);
      const candidate = rawUpdates?.updateId;
      updateId = typeof candidate === 'string' ? candidate : null;
    } catch {
      return null;
    }

    return {
      isEnabled,
      updateId,
      checkForUpdateAsync: async () => {
        try {
          if (!isEnabled || typeof rawUpdates?.checkForUpdateAsync !== 'function') {
            return { isAvailable: false };
          }
          return await rawUpdates.checkForUpdateAsync();
        } catch {
          return { isAvailable: false };
        }
      },
      fetchUpdateAsync: async () => {
        try {
          if (!isEnabled || typeof rawUpdates?.fetchUpdateAsync !== 'function') {
            return null;
          }
          return await rawUpdates.fetchUpdateAsync();
        } catch {
          return null;
        }
      },
      reloadAsync: async () => {
        try {
          if (!isEnabled || typeof rawUpdates?.reloadAsync !== 'function') {
            return;
          }
          await rawUpdates.reloadAsync();
        } catch {
          // Keep current bundle running if reload is unavailable.
        }
      },
    };
  } catch {
    return null;
  }
}
