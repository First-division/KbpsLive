jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

let asyncStorage: {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Startup And Crash Reporting', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.clearAllMocks();
    asyncStorage = require('@react-native-async-storage/async-storage');
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue();

    (globalThis as { fetch?: jest.Mock }).fetch = jest.fn().mockResolvedValue({ ok: true });
    delete process.env.EXPO_PUBLIC_HANG_REPORT_WEBHOOK_URL;
    delete process.env.EXPO_PUBLIC_HANG_REPORT_EMAIL;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a splash hang report after timeout', async () => {
    const reporter = require('@/components/splash-hang-reporter') as typeof import('@/components/splash-hang-reporter');

    reporter.beginSplashHangWatchdog();
    jest.advanceTimersByTime(15000);
    await flushAsyncWork();

    const hangCalls = asyncStorage.setItem.mock.calls.filter(([key]) => key === 'kbpslive:debug:lastHangReport');
    expect(hangCalls.length).toBeGreaterThan(0);

    const payload = JSON.parse(String(hangCalls[0][1]));
    expect(payload.type).toBe('splash-hang-detected');
    expect(payload.notifyEmail).toBe('Underwoodzack159@gmail.com');
    expect(payload.reason).toContain('Launch watchdog exceeded');
  });

  it('captures JS fatal errors through global handler', async () => {
    const originalHandler = jest.fn();
    let installedHandler: ((error: unknown, isFatal?: boolean) => void) | undefined;

    (globalThis as {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }).ErrorUtils = {
      getGlobalHandler: () => originalHandler,
      setGlobalHandler: (handler) => {
        installedHandler = handler;
      },
    };

    const crashReporter = require('@/components/crash-reporter') as typeof import('@/components/crash-reporter');
    crashReporter.installCrashReporter();

    expect(installedHandler).toBeDefined();

    installedHandler?.(new Error('test-fatal-crash'), true);
    await flushAsyncWork();

    const crashCalls = asyncStorage.setItem.mock.calls.filter(([key]) => key === 'kbpslive:debug:lastCrashReport');
    expect(crashCalls.length).toBeGreaterThan(0);

    const payload = JSON.parse(String(crashCalls[0][1]));
    expect(payload.type).toBe('js-fatal-error');
    expect(payload.message).toBe('test-fatal-crash');
    expect(payload.notifyEmail).toBe('Underwoodzack159@gmail.com');
    expect(originalHandler).toHaveBeenCalled();
  });
});
