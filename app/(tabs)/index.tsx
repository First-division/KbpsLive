import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { setPlaybackIndicatorArtwork } from '@/hooks/useAudioStream';
import { Station } from '@/constants/Station';

type AirplayModule = {
  showRoutePicker: (options?: { prioritizesVideoDevices?: boolean }) => Promise<void>;
  getAvAudioSessionRoutes?: () => Array<{ portName?: string }>;
  onAvAudioSessionRoutesChanged?: (callback: (routes: Array<{ portName?: string }>) => void) => () => void;
};

function endLegacyLiveActivities() {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const bridge = require('react-native-widget-extension') as {
      endActivity: () => Promise<string>;
    };
    void bridge.endActivity().then((result) => {
      if (result.startsWith('end-error:')) {
        console.warn('[LiveActivity] Unable to end legacy activities:', result);
      }
    }).catch((error: unknown) => {
      console.warn('[LiveActivity] Unable to end legacy activities:', error);
    });
  } catch (error) {
    console.warn('[LiveActivity] Unable to load legacy activity bridge:', error);
  }
}

function getAirplayModule(): AirplayModule | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    return require('react-airplay') as AirplayModule;
  } catch {
    return null;
  }
}

const FALLBACK_ARTWORK_SOURCE = require('../../assets/images/icon.png');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { status, error, togglePlayPause, setLockScreenMetadata } = useAudioStream();
  const isPlaying = status === 'playing';
  const isConnecting = status === 'connecting';
  const nowPlaying = useNowPlaying(status === 'playing' || status === 'connecting');
  const [artworkFailed, setArtworkFailed] = useState(false);
  const playGlyphColor = colorScheme === 'dark' ? '#ffffff' : '#11181C';
  const bottomControlsPadding = Platform.OS === 'ios'
    ? Math.max(insets.bottom + 72, 88)
    : Math.max(insets.bottom + 16, 24);
  const artworkUrl = nowPlaying.artwork?.trim();
  const hasRealArtwork = Boolean(artworkUrl) && artworkUrl !== Station.defaultArtwork;
  const liveActivityArtwork = hasRealArtwork ? artworkUrl : Station.defaultArtwork;
  const [currentOutput, setCurrentOutput] = useState('This iPhone');

  const handleTogglePlayPause = useCallback(() => {
    togglePlayPause();
  }, [togglePlayPause]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [artworkUrl]);

  useEffect(() => {
    setPlaybackIndicatorArtwork(liveActivityArtwork);
  }, [liveActivityArtwork]);

  useEffect(() => {
    setLockScreenMetadata({
      title: nowPlaying.title.trim() || Station.name,
      artist: nowPlaying.artist.trim() || Station.tagline,
      artworkUrl: liveActivityArtwork,
    });
  }, [liveActivityArtwork, nowPlaying.artist, nowPlaying.title, setLockScreenMetadata]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const airplay = getAirplayModule();
    if (!airplay) return;

    const updateRoutes = (routes: Array<{ portName?: string }>) => {
      const names = routes.map((route) => route.portName?.trim()).filter(Boolean);
      setCurrentOutput(names.length ? names.join(', ') : 'This iPhone');
    };
    const refreshRoutes = () => {
      try {
        if (airplay.getAvAudioSessionRoutes) updateRoutes(airplay.getAvAudioSessionRoutes());
      } catch (error) {
        console.warn('[AirPlay] Unable to read audio output:', error);
      }
    };
    refreshRoutes();
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = airplay.onAvAudioSessionRoutesChanged?.(updateRoutes);
    } catch (error) {
      console.warn('[AirPlay] Unable to observe audio output:', error);
    }
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshRoutes();
    });
    return () => {
      unsubscribe?.();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    endLegacyLiveActivities();
  }, []);

  const artworkSource = useMemo(
    () => (artworkFailed || !hasRealArtwork
      ? FALLBACK_ARTWORK_SOURCE
      : { uri: nowPlaying.artwork }),
    [artworkFailed, hasRealArtwork, nowPlaying.artwork]
  );

  const handleConnectPress = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Audio Output',
        'Use your system audio output picker to connect Bluetooth speakers or headphones.'
      );
      return;
    }

    const airplay = getAirplayModule();
    if (!airplay) {
      Alert.alert('AirPlay Unavailable', 'AirPlay controls are not available on this device right now.');
      return;
    }

    try {
      await airplay.showRoutePicker({ prioritizesVideoDevices: false });

    } catch (error) {
      console.warn('[AirPlay] Unable to open route picker:', error);
      Alert.alert('AirPlay Error', 'Unable to open the AirPlay picker. Please try again.');
    }
  }, []);

  const buttonSurface = colorScheme === 'dark' ? theme.card : '#E8EDF3';
  const buttonBorder = colorScheme === 'dark' ? '#2A2F36' : '#D9E0E8';
  const buttonGlyphColor = theme.text;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.topPill}>
        <Text style={[styles.topPillText, { color: theme.text }]}>Live Radio</Text>
      </View>

      {/* Album Art */}
      <View style={styles.artworkContainer}>
        <Image
          source={artworkSource}
          style={styles.artwork}
          resizeMode="cover"
          onError={() => {
            setArtworkFailed(true);
          }}
        />
      </View>

      <Text style={[styles.stationName, { color: theme.text }]} numberOfLines={1}>
        {nowPlaying.title}
      </Text>
      <Text style={[styles.nowPlayingArtist, { color: theme.tabIconDefault }]} numberOfLines={1}>
        {nowPlaying.artist}
      </Text>

      {/* Status Indicator */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                status === 'playing' ? '#34C759' :
                status === 'connecting' ? '#FF9500' :
                status === 'error' ? '#FF3B30' : theme.tabIconDefault,
            },
          ]}
        />
        <Text
          style={[styles.statusText, { color: theme.tabIconDefault }]}
          testID="home-status-text"
        >
          {status === 'playing' ? 'Live' :
           status === 'connecting' ? 'Connecting...' :
           status === 'error' ? 'Connection Error' : 'Ready to Play'}
        </Text>
      </View>

      {/* Play / Pause Button */}
      <Pressable
        onPress={handleTogglePlayPause}
        testID="home-play-toggle"
        accessibilityRole="button"
        accessibilityLabel="Play or pause stream"
        style={({ pressed }) => [
          styles.playButton,
          {
            backgroundColor: buttonSurface,
            borderColor: buttonBorder,
          },
          pressed && styles.playButtonPressed,
        ]}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator size="large" color={buttonGlyphColor} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={48}
            color={buttonGlyphColor}
            style={!isPlaying ? { marginLeft: 4 } : undefined}
          />
        )}
      </Pressable>

      {/* Error Message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={[styles.footerControls, { paddingBottom: bottomControlsPadding }]}>
        <Pressable
          testID="home-connect-button"
          accessibilityRole="button"
          accessibilityLabel="Open AirPlay picker"
          style={({ pressed }) => [
            styles.connectButton,
            {
              backgroundColor: buttonSurface,
              borderColor: buttonBorder,
            },
            pressed && styles.connectButtonPressed,
          ]}
          onPress={() => {
            void handleConnectPress();
          }}
        >
          <Ionicons
            name={Platform.OS === 'ios' ? 'radio-outline' : 'phone-portrait-outline'}
            size={16}
            color={buttonGlyphColor}
            style={styles.connectIcon}
          />
          <View style={styles.connectTextWrap}>
            <Text style={[styles.connectLabel, { color: buttonGlyphColor }]}>AirPlay</Text>
            <Text style={[styles.connectDevice, { color: theme.tabIconDefault }]}>{currentOutput}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 70,
    minHeight: '100%',
    backgroundColor: 'transparent',
  },
  topPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#d1d5db',
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 24,
  },
  topPillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  artworkContainer: {
    width: 260,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  stationName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#fff',
  },
  nowPlayingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f6f8',
    marginBottom: 4,
    textAlign: 'center',
  },
  nowPlayingArtist: {
    fontSize: 15,
    color: '#a8b0bc',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#a8b0bc',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  playButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    color: '#FF3B30',
    textAlign: 'center',
  },
  footerControls: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    marginHorizontal: 12,
    maxWidth: 220,
  },
  connectButtonPressed: {
    opacity: 0.7,
  },
  connectIcon: {
    marginRight: 8,
  },
  connectTextWrap: {
    backgroundColor: 'transparent',
  },
  connectLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  connectDevice: {
    color: '#a8b0bc',
    fontSize: 11,
    lineHeight: 13,
  },
});
