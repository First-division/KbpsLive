import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockAppStateListeners: Array<(state: 'active' | 'background' | 'inactive') => void> = [];
const mockCreateAudioPlayer = jest.fn();
const mockSetAudioModeAsync = jest.fn(async () => undefined);
const mockActivateLockScreen = jest.fn();
const mockUpdateLockScreen = jest.fn();
const mockClearLockScreen = jest.fn();
const mockSetSampling = jest.fn();
let mockStatusListener: ((status: { isLoaded: boolean; isBuffering: boolean; playing: boolean; timeControlStatus?: string }) => void) | undefined;
let mockAudioSampleListener: ((sample: unknown) => void) | undefined;

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(
      (_event: string, listener: (state: 'active' | 'background' | 'inactive') => void) => {
        mockAppStateListeners.push(listener);

        return {
          remove: () => {
            const index = mockAppStateListeners.indexOf(listener);
            if (index >= 0) {
              mockAppStateListeners.splice(index, 1);
            }
          },
        };
      }
    ),
  },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
}));

import { useAudioStream } from '@/hooks/useAudioStream';

function emitAppStateChange(state: 'active' | 'background' | 'inactive') {
  for (const listener of [...mockAppStateListeners]) {
    listener(state);
  }
}

async function waitForCondition(assertion: () => void, timeoutMs = 2000) {
  const start = Date.now();
  let lastError: unknown = null;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

describe('Audio background connection behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListeners.length = 0;
    mockStatusListener = undefined;
    mockAudioSampleListener = undefined;

    const mockPlayer = {
      volume: 1,
      setPlaybackRate: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      setActiveForLockScreen: mockActivateLockScreen,
      updateLockScreenMetadata: mockUpdateLockScreen,
      clearLockScreenControls: mockClearLockScreen,
      setAudioSamplingEnabled: mockSetSampling,
      currentStatus: {
        isLoaded: true,
        isBuffering: false,
        playing: true,
      },
      addListener: jest.fn((event: string, listener: (payload: unknown) => void) => {
        if (event === 'playbackStatusUpdate') {
          mockStatusListener = listener as (status: { isLoaded: boolean; isBuffering: boolean; playing: boolean; timeControlStatus?: string }) => void;
          listener(mockPlayer.currentStatus);
        } else if (event === 'audioSampleUpdate') {
          mockAudioSampleListener = listener;
        }
        return { remove: jest.fn() };
      }),
    };

    mockCreateAudioPlayer.mockReturnValue(mockPlayer);
    global.fetch = jest.fn().mockRejectedValue(new Error('playlist unavailable')) as jest.Mock;
  });

  it('does not re-register controls or refresh metadata for repeated playback updates', async () => {
    let latestHook: ReturnType<typeof useAudioStream> | null = null;
    function HookHarness() {
      const hookState = useAudioStream();
      useEffect(() => { latestHook = hookState; });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HookHarness />); });
    await act(async () => { latestHook?.togglePlayPause(); });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));
    expect(mockActivateLockScreen).toHaveBeenCalledTimes(1);
    expect(mockSetSampling).not.toHaveBeenCalled();

    act(() => {
      mockStatusListener?.({ isLoaded: true, isBuffering: false, playing: true });
      mockStatusListener?.({ isLoaded: true, isBuffering: false, playing: true });
    });
    expect(mockActivateLockScreen).toHaveBeenCalledTimes(1);
    expect(mockUpdateLockScreen).not.toHaveBeenCalled();

    const metadata = { title: 'New song', artist: 'Artist', artworkUrl: 'https://example.com/art.jpg' };
    act(() => {
      latestHook?.setLockScreenMetadata(metadata);
      latestHook?.setLockScreenMetadata(metadata);
    });
    expect(mockUpdateLockScreen).toHaveBeenCalledTimes(1);
    await act(async () => { renderer!.unmount(); });
  });

  it('keeps stream connected when app returns active and player is still playing', async () => {
    let latestHook: ReturnType<typeof useAudioStream> | null = null;

    function HookHarness() {
      const hookState = useAudioStream();

      useEffect(() => {
        latestHook = hookState;
      });

      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<HookHarness />);
    });

    await act(async () => {
      latestHook?.togglePlayPause();
    });

    await waitForCondition(() => {
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
      expect(latestHook?.status).toBe('playing');
    });

    act(() => {
      emitAppStateChange('background');
    });

    act(() => {
      emitAppStateChange('active');
    });

    await waitForCondition(() => {
      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
      expect(latestHook?.status).toBe('playing');
    });

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('marks playback paused when the native player stops after playing', async () => {
    let latestHook: ReturnType<typeof useAudioStream> | null = null;
    function HookHarness() {
      const hookState = useAudioStream();
      useEffect(() => { latestHook = hookState; });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HookHarness />); });
    await act(async () => { latestHook?.togglePlayPause(); });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));

    act(() => {
      mockStatusListener?.({ isLoaded: true, isBuffering: false, playing: false });
      mockStatusListener?.({ isLoaded: true, isBuffering: false, playing: false });
    });
    await waitForCondition(() => expect(latestHook?.status).toBe('paused'));
    act(() => {
      emitAppStateChange('background');
      emitAppStateChange('active');
    });
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    await act(async () => { renderer!.unmount(); });
  });

  it('recognizes a native pause even when the stream is buffering', async () => {
    let latestHook: ReturnType<typeof useAudioStream> | null = null;
    function HookHarness() {
      const hookState = useAudioStream();
      useEffect(() => { latestHook = hookState; });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HookHarness />); });
    await act(async () => { latestHook?.togglePlayPause(); });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));

    act(() => {
      mockStatusListener?.({ isLoaded: false, isBuffering: true, playing: false, timeControlStatus: 'paused' });
    });
    await waitForCondition(() => expect(latestHook?.status).toBe('paused'));
    act(() => {
      emitAppStateChange('background');
      emitAppStateChange('active');
    });
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    await act(async () => { renderer!.unmount(); });
  });

  it('ignores transient paused updates right after backgrounding on iOS', async () => {
    let latestHook: ReturnType<typeof useAudioStream> | null = null;
    function HookHarness() {
      const hookState = useAudioStream();
      useEffect(() => { latestHook = hookState; });
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HookHarness />); });
    await act(async () => { latestHook?.togglePlayPause(); });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));

    act(() => {
      emitAppStateChange('background');
      mockStatusListener?.({ isLoaded: true, isBuffering: false, playing: false, timeControlStatus: 'paused' });
    });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));

    act(() => {
      emitAppStateChange('active');
    });
    await waitForCondition(() => expect(latestHook?.status).toBe('playing'));
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    await act(async () => { renderer!.unmount(); });
  });
});
