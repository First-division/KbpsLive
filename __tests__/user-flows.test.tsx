import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import HomeScreen from '@/app/(tabs)/index';
import ExploreScreen from '@/app/(tabs)/explore';
import RecentScreen from '@/app/(tabs)/recent';
import SettingsScreen from '@/app/(tabs)/settings';
import { LaunchFlow } from '@/components/launch-flow';
import { Station } from '@/constants/Station';
import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';

const mockPush = jest.fn();
const mockAsyncStorageGetItem = jest.fn();
const mockTogglePlayPause = jest.fn();
const mockUpdatesCheck = jest.fn();
const mockSetPreference = jest.fn();
const mockToggleFavorite = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
  setItem: jest.fn(),
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
    status: 'idle',
    error: null,
    togglePlayPause: mockTogglePlayPause,
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

describe('User Flow Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    render(<LaunchFlow />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/welcome-modal');
    });
  });

  it('LaunchFlow routes returning users to what\'s new on unseen update', async () => {
    const previousDevFlag = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;

    mockAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === LAUNCH_STORAGE_KEYS.welcomeCompleted) return 'true';
      if (key === LAUNCH_STORAGE_KEYS.lastSeenUpdateId) return 'older-update-id';
      return null;
    });

    render(<LaunchFlow />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/whats-new-modal');
    });

    (global as { __DEV__?: boolean }).__DEV__ = previousDevFlag;
  });

  it('Home screen toggles playback when play button is pressed', () => {
    const { getByLabelText } = render(<HomeScreen />);
    fireEvent.press(getByLabelText('Play or pause stream'));
    expect(mockTogglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('Explore opens KBPS news link', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce();

    const { getByText } = render(<ExploreScreen />);
    fireEvent.press(getByText('KBPS News'));

    expect(openURLSpy).toHaveBeenCalledWith(Station.links.news);
    openURLSpy.mockRestore();
  });

  it('Recent toggles favorite for a song', () => {
    const { getByLabelText } = render(<RecentScreen />);
    fireEvent.press(getByLabelText('Toggle favorite for Song One'));
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('Settings applies dark appearance preference', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Dark'));
    expect(mockSetPreference).toHaveBeenCalledWith('dark');
  });

  it('Settings opens app guide route', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('App Guide'));
    expect(mockPush).toHaveBeenCalledWith('/welcome-modal');
  });
});
