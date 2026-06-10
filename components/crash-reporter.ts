import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const STORAGE_KEY = 'kbpslive:debug:lastCrashReport';

type CrashReport = {
  type: 'js-fatal-error' | 'js-nonfatal-error';
  detectedAt: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  runtimeVersion: string;
  message: string;
  stack?: string;
  isFatal: boolean;
};

let installed = false;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getRuntimeVersion(): string {
  const runtime = Constants.expoConfig?.runtimeVersion;
  if (typeof runtime === 'string') {
    return runtime;
  }
  if (runtime && typeof runtime === 'object' && 'policy' in runtime) {
    return String(runtime.policy ?? 'unknown');
  }
  return 'unknown';
}

function buildReport(error: unknown, isFatal: boolean): CrashReport {
  const typedError = error instanceof Error ? error : new Error(String(error));

  return {
    type: isFatal ? 'js-fatal-error' : 'js-nonfatal-error',
    detectedAt: new Date().toISOString(),
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    runtimeVersion: getRuntimeVersion(),
    message: typedError.message,
    stack: typedError.stack,
    isFatal,
  };
}

async function deliverReport(report: CrashReport): Promise<void> {
  await withTimeout(
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)),
    1000,
    undefined
  );
}

export function installCrashReporter() {
  if (installed) {
    return;
  }
  installed = true;

  const globalWithErrorUtils = globalThis as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };

  const originalHandler = globalWithErrorUtils.ErrorUtils?.getGlobalHandler?.();

  globalWithErrorUtils.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    void deliverReport(buildReport(error, Boolean(isFatal)));

    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}
