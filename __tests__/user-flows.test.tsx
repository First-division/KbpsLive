import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { onAvAudioSessionRoutesChanged } from 'react-airplay';
import * as widgetExtension from 'react-native-widget-extension';

import HomeScreen from '@/app/(tabs)/index';
import ExploreScreen from '@/app/(tabs)/explore';
import RecentScreen from '@/app/(tabs)/recent';
import SettingsScreen from '@/app/(tabs)/settings';
import AppGuide from '@/app/app-guide';
import WhatsNewModal from '@/app/whats-new-modal';
import { LaunchFlow } from '@/components/launch-flow';
import { Station } from '@/constants/Station';
import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();
const mockTogglePlayPause = jest.fn();
const mockUpdatesCheck = jest.fn();
const mockSetPreference = jest.fn();
const mockToggleFavorite = jest.fn();
let mockAudioStatus = 'idle';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
  setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
}));

jest.mock('@/components/optional-updates', () => ({
  getOptionalUpdatesModule: () => ({
    isEnabled: true,
    updateId: 'new-update-id',
    checkForUpdateAsync: (...args: unknown[]) => mockUpdatesCheck(...args),
    fetchUpdateAsync: jest.fn(async () => null),
    reloadAsync: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/hooks/useAudioStream', () => ({
  useAudioStream: () => ({
    status: mockAudioStatus,
    error: null,
    togglePlayPause: mockTogglePlayPause,
    setLockScreenMetadata: jest.fn(),
  }),
  usePlaybackBands: () => [],
  usePlaybackIndicator: () => ({
    isPlaying: false,
    artworkUri: 'https://cdn.example.com/fallback.jpg',
    audioLevel: 0,
  }),
  setPlaybackIndicatorArtwork: jest.fn(),
}));

jest.mock('@/hooks/useNowPlaying', () => ({
  useNowPlaying: () => ({
    title: 'Test Song',
    artist: 'Test Artist',
    artwork: 'https://cdn.example.com/fallback.jpg',
  }),
}));

jest.mock('@/hooks/useRecentlyPlayed', () => ({
  useRecentlyPlayed: () => ({
    songs: [
      {
        id: 'song-1',
        title: 'Song One',
        artist: 'Artist One',
        artwork: 'https://cdn.example.com/fallback.jpg',
        playedAt: '2026-06-07T23:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/hooks/useFavoriteSongs', () => ({
  useFavoriteSongs: () => ({
    ready: true,
    favorites: [],
    favoriteIds: new Set<string>(),
    toggleFavorite: mockToggleFavorite,
  }),
}));

jest.mock('@/components/theme-mode', () => ({
  useThemeMode: () => ({
    preference: 'system',
    setPreference: mockSetPreference,
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('react-native-widget-extension', () => ({
  areActivitiesEnabled: jest.fn(() => false),
  startActivity: jest.fn(async () => 'requested'),
  updateActivity: jest.fn(async () => 'updated'),
  endActivity: jest.fn(async () => 'ended'),
}));

describe('User Flow Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioStatus = 'idle';
    mockAsyncStorageSetItem.mockReset();
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockUpdatesCheck.mockResolvedValue({ isAvailable: false });
    mockAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === LAUNCH_STORAGE_KEYS.welcomeCompleted) return 'true';
      if (key === LAUNCH_STORAGE_KEYS.lastSeenUpdateId) return 'new-update-id';
      return null;
    });
  });

  it('LaunchFlow routes first-time users to welcome modal', async () => {
    mockAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === LAUNCH_STORAGE_KEYS.welcomeCompleted) return null;
      return null;
    });

    await render(<LaunchFlow />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/welcome-modal');
    });
  });

  it('App Guide switches topics and closes without changing onboarding state', async () => {
    const { getByText, getByLabelText, getByRole } = await render(<AppGuide />);
    expect(getByText('Listen to KBPS')).toBeTruthy();
    await fireEvent.press(getByRole('tab', { name: 'Recent' }));
    expect(getByText('Recently played')).toBeTruthy();
    expect(getByRole('tab', { name: 'Recent' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(getByLabelText('Close app guide'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockAsyncStorageGetItem).not.toHaveBeenCalled();
  });

  it('LaunchFlow routes returning users to what\'s new on unseen update', async () => {
    const previousDevFlag = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;

    mockAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === LAUNCH_STORAGE_KEYS.welcomeCompleted) return 'true';
      if (key === LAUNCH_STORAGE_KEYS.lastSeenUpdateId) return 'older-update-id';
      return null;
    });

    await render(<LaunchFlow />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/whats-new-modal');
    });

    (global as { __DEV__?: boolean }).__DEV__ = previousDevFlag;
  });

  it('Home screen toggles playback when play button is pressed', async () => {
    const { getByLabelText } = await render(<HomeScreen />);
    await fireEvent.press(getByLabelText('Play or pause stream'));
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('Home screen displays the title and current song without a header logo', async () => {
    const { queryByTestId, getByText } = await render(<HomeScreen />);
    expect(queryByTestId('home-station-logo')).toBeNull();
    expect(getByText('Live Radio')).toBeTruthy();
    expect(getByText('Test Song')).toBeTruthy();
  });

  it('updates the audio output label when the route changes and disconnects', async () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.mocked(onAvAudioSessionRoutesChanged);
    subscribe.mockReturnValueOnce(unsubscribe);
    const { getByText, unmount } = await render(<HomeScreen />);
    expect(getByText('This iPhone')).toBeTruthy();

    const listener = subscribe.mock.calls.at(-1)?.[0];
    expect(listener).toBeDefined();
    await act(() => listener?.([{ portName: 'Living Room', portType: 'AirPlay', uid: 'speaker', hasHardwareVoiceCallProcessing: false, isSpatialAudioEnabled: false }]));
    expect(getByText('Living Room')).toBeTruthy();
    await act(() => listener?.([]));
    expect(getByText('This iPhone')).toBeTruthy();
    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ends legacy activities and does not create a duplicate during playback or buffering', async () => {
    jest.mocked(widgetExtension.areActivitiesEnabled).mockReturnValue(true);
    mockAudioStatus = 'connecting';
    const { rerender } = await render(<HomeScreen />);
    await waitFor(() => expect(widgetExtension.endActivity).toHaveBeenCalled());
    mockAudioStatus = 'playing';
    await rerender(<HomeScreen />);
    mockAudioStatus = 'connecting';
    await rerender(<HomeScreen />);
    mockAudioStatus = 'paused';
    await rerender(<HomeScreen />);
    expect(widgetExtension.startActivity).not.toHaveBeenCalled();
    expect(widgetExtension.updateActivity).not.toHaveBeenCalled();
    jest.mocked(widgetExtension.areActivitiesEnabled).mockReturnValue(false);
  });

  it('Explore opens KBPS news link', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce();

    const { getByText } = await render(<ExploreScreen />);
    await fireEvent.press(getByText('KBPS News'));

    expect(openURLSpy).toHaveBeenCalledWith(Station.links.news);
    openURLSpy.mockRestore();
  });

  it('Recent toggles favorite for a song', async () => {
    const { getByLabelText } = await render(<RecentScreen />);
    await fireEvent.press(getByLabelText('Toggle favorite for Song One'));
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('Settings applies dark appearance preference', async () => {
    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('Dark'));
    expect(mockSetPreference).toHaveBeenCalledWith('dark');
  });

  it('Settings opens app guide route', async () => {
    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('App Guide'));
    expect(mockPush).toHaveBeenCalledWith('/app-guide');
  });

  it("Settings opens What's New", async () => {
    const { getByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText("What's New"));
    expect(mockPush).toHaveBeenCalledWith('/whats-new-modal');
  });

  it("What's New saves the seen update before closing", async () => {
    const previousDevFlag = global.__DEV__;
    global.__DEV__ = false;
    try {
      const { getByLabelText, getByText } = await render(<WhatsNewModal />);
      expect(getByText('KbpsLive 1.0.0')).toBeTruthy();
      expect(getByText('New Features')).toBeTruthy();
      await fireEvent.press(getByLabelText("Close what's new"));
      await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
      expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(LAUNCH_STORAGE_KEYS.lastSeenUpdateId, 'new-update-id');
    } finally {
      global.__DEV__ = previousDevFlag;
    }
  });

  it("What's New reports a save failure and stays open", async () => {
    const previousDevFlag = global.__DEV__;
    global.__DEV__ = false;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAsyncStorageSetItem.mockRejectedValueOnce(new Error('storage unavailable'));
    try {
      const { getByLabelText } = await render(<WhatsNewModal />);
      await fireEvent.press(getByLabelText("Close what's new"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
        'Unable to close', 'Could not save your update status. Please try again.'
      ));
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      global.__DEV__ = previousDevFlag;
      alertSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
