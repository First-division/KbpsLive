import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const HANG_TIMEOUT_MS = 15000;
const STORAGE_KEY = 'kbpslive:debug:lastHangReport';
const CURRENT_LAUNCH_STATE_KEY = 'kbpslive:debug:currentLaunchState';
const WEBHOOK_URL = process.env.EXPO_PUBLIC_HANG_REPORT_WEBHOOK_URL ?? '';
const REPORT_EMAIL = process.env.EXPO_PUBLIC_HANG_REPORT_EMAIL ?? 'Underwoodzack159@gmail.com';

type HangStageEvent = {
  stage: string;
  at: string;
  details?: string;
};

type HangReport = {
  type: 'splash-hang-detected' | 'previous-launch-aborted';
  detectedAt: string;
  startedAt: string;
  elapsedMs: number;
  notifyEmail: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  runtimeVersion: string;
  stage: string;
  stageHistory: HangStageEvent[];
  reason?: string;
};

type LaunchStateSnapshot = {
  startedAt: string;
  stage: string;
  stageHistory: HangStageEvent[];
  completed: boolean;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let startedAtMs = 0;
let lastStage = 'init';
let stageHistory: HangStageEvent[] = [];
let finished = false;

async function persistLaunchState(completed: boolean) {
  const snapshot: LaunchStateSnapshot = {
    startedAt: new Date(startedAtMs || Date.now()).toISOString(),
    stage: lastStage,
    stageHistory,
    completed,
  };

  await withTimeout(
    AsyncStorage.setItem(CURRENT_LAUNCH_STATE_KEY, JSON.stringify(snapshot)),
    800,
    undefined
  );
}

async function readPreviousLaunchState(): Promise<LaunchStateSnapshot | null> {
  const raw = await withTimeout(
    AsyncStorage.getItem(CURRENT_LAUNCH_STATE_KEY),
    800,
    null
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LaunchStateSnapshot;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildRecoveredAbortReport(previous: LaunchStateSnapshot): HangReport {
  const now = Date.now();
  const startedAtMsFromPrevious = Date.parse(previous.startedAt);

  return {
    type: 'previous-launch-aborted',
    detectedAt: new Date(now).toISOString(),
    startedAt: Number.isNaN(startedAtMsFromPrevious)
      ? previous.startedAt
      : new Date(startedAtMsFromPrevious).toISOString(),
    elapsedMs: Number.isNaN(startedAtMsFromPrevious)
      ? 0
      : Math.max(0, now - startedAtMsFromPrevious),
    notifyEmail: REPORT_EMAIL,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    runtimeVersion: getRuntimeVersion(),
    stage: previous.stage,
    stageHistory: previous.stageHistory,
    reason: 'App relaunched before launch flow marked completed',
  };
}

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

function buildReport(): HangReport {
  const now = Date.now();
  return {
    type: 'splash-hang-detected',
    detectedAt: new Date(now).toISOString(),
    startedAt: new Date(startedAtMs || now).toISOString(),
    elapsedMs: Math.max(0, now - (startedAtMs || now)),
    notifyEmail: REPORT_EMAIL,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    runtimeVersion: getRuntimeVersion(),
    stage: lastStage,
    stageHistory,
    reason: `Launch watchdog exceeded ${HANG_TIMEOUT_MS}ms`,
  };
}

async function deliverHangReport(report: HangReport): Promise<void> {
  await withTimeout(
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)),
    1200,
    undefined
  );

  if (!WEBHOOK_URL) {
    return;
  }

  await withTimeout(
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    }),
    3000,
    null
  );
}

function pushStage(stage: string, details?: string) {
  lastStage = stage;
  stageHistory = [
    ...stageHistory,
    {
      stage,
      at: new Date().toISOString(),
      details,
    },
  ];

  void persistLaunchState(false);
}

export function beginSplashHangWatchdog() {
  if (timer) {
    clearTimeout(timer);
  }

  startedAtMs = Date.now();
  finished = false;
  stageHistory = [];
  pushStage('app-mounted');

  void (async () => {
    const previous = await readPreviousLaunchState();
    if (!previous || previous.completed) {
      return;
    }

    const recoveredReport = buildRecoveredAbortReport(previous);
    await deliverHangReport(recoveredReport);
  })();

  timer = setTimeout(() => {
    if (finished) {
      return;
    }

    const report = buildReport();
    void deliverHangReport(report);
  }, HANG_TIMEOUT_MS);
}

export function updateSplashStage(stage: string, details?: string) {
  if (finished) {
    return;
  }

  pushStage(stage, details);
}

export function endSplashHangWatchdog(result: string) {
  if (finished) {
    return;
  }

  finished = true;
  pushStage('watchdog-ended', result);

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  void persistLaunchState(true);
}
