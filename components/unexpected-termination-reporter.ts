import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

const SESSION_STATE_KEY = 'kbpslive:debug:lastSessionState';
const TERMINATION_ISSUE_KEY = 'kbpslive:debug:unexpectedTerminationIssue';

type SessionState = {
  appState: AppStateStatus;
  updatedAt: string;
};

export type UnexpectedTerminationIssue = {
  type: 'unexpected-termination';
  detectedAt: string;
  lastKnownAppState: AppStateStatus;
  lastUpdatedAt: string;
  reason: string;
};

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

async function persistSessionState(appState: AppStateStatus): Promise<void> {
  const snapshot: SessionState = {
    appState,
    updatedAt: new Date().toISOString(),
  };

  await withTimeout(
    AsyncStorage.setItem(SESSION_STATE_KEY, JSON.stringify(snapshot)),
    800,
    undefined
  );
}

async function readSessionState(): Promise<SessionState | null> {
  const raw = await withTimeout(
    AsyncStorage.getItem(SESSION_STATE_KEY),
    800,
    null
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.appState !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function recordUnexpectedTerminationIfNeeded(previous: SessionState | null): Promise<void> {
  if (!previous) {
    return;
  }

  if (previous.appState !== 'active') {
    return;
  }

  const issue: UnexpectedTerminationIssue = {
    type: 'unexpected-termination',
    detectedAt: new Date().toISOString(),
    lastKnownAppState: previous.appState,
    lastUpdatedAt: previous.updatedAt,
    reason: 'Previous session ended while app state was active',
  };

  await withTimeout(
    AsyncStorage.setItem(TERMINATION_ISSUE_KEY, JSON.stringify(issue)),
    1000,
    undefined
  );
}

export function startUnexpectedTerminationMonitor() {
  void (async () => {
    const previous = await readSessionState();
    await recordUnexpectedTerminationIfNeeded(previous);
    await persistSessionState(AppState.currentState);
  })();

  const appStateSub = AppState.addEventListener('change', (nextState) => {
    void persistSessionState(nextState);
  });

  return () => {
    appStateSub.remove();
  };
}

export async function consumeUnexpectedTerminationIssue(): Promise<UnexpectedTerminationIssue | null> {
  const raw = await withTimeout(
    AsyncStorage.getItem(TERMINATION_ISSUE_KEY),
    800,
    null
  );

  if (!raw) {
    return null;
  }

  await withTimeout(
    AsyncStorage.removeItem(TERMINATION_ISSUE_KEY),
    800,
    undefined
  );

  try {
    const parsed = JSON.parse(raw) as UnexpectedTerminationIssue;
    if (!parsed || typeof parsed !== 'object' || parsed.type !== 'unexpected-termination') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
