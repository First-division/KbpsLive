import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { setPlaybackIndicatorArtwork, usePlaybackIndicator } from '@/hooks/useAudioStream';
import { Station } from '@/constants/Station';

type LiveActivityBridge = {
  areActivitiesEnabled: () => boolean;
  startActivity: (...args: any[]) => Promise<string> | string;
  endActivity: (...args: any[]) => Promise<string> | string;
};

function getLiveActivityBridge(): LiveActivityBridge | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    return require('react-native-widget-extension') as LiveActivityBridge;
  } catch {
    return null;
  }
}

const FALLBACK_ARTWORK_SOURCE = require('../../assets/images/icon.png');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { status, error, togglePlayPause } = useAudioStream();
  const playbackIndicator = usePlaybackIndicator();
  const isPlaying = status === 'playing';
  const isConnecting = status === 'connecting';
  const nowPlaying = useNowPlaying(isPlaying);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const lastLiveActivityKeyRef = useRef<string | null>(null);
  const playGlyphColor = colorScheme === 'dark' ? '#ffffff' : '#11181C';
  const bottomControlsPadding = Platform.OS === 'ios'
    ? Math.max(insets.bottom + 72, 88)
    : Math.max(insets.bottom + 16, 24);
  const artworkUrl = nowPlaying.artwork?.trim();
  const hasRealArtwork = Boolean(artworkUrl) && artworkUrl !== Station.defaultArtwork;
  const liveActivityArtwork = hasRealArtwork ? artworkUrl : Station.defaultArtwork;
  const waveformLevel = isPlaying
    ? Math.max(0.12, Math.round(playbackIndicator.audioLevel * 4) / 4)
    : 0.08;
  const liveActivityKey = isPlaying
    ? [
      nowPlaying.title.trim() || Station.name,
      nowPlaying.artist.trim() || Station.tagline,
      liveActivityArtwork,
      waveformLevel.toFixed(2),
    ].join('|')
    : 'inactive';

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
    if (Platform.OS !== 'ios') {
      return;
    }

    const liveActivity = getLiveActivityBridge();
    if (!liveActivity) {
      return;
    }

    let isCancelled = false;

    const syncLiveActivity = async () => {
      try {
        if (!isPlaying) {
          if (lastLiveActivityKeyRef.current !== null) {
            await liveActivity.endActivity();
            if (!isCancelled) {
              lastLiveActivityKeyRef.current = null;
            }
          }
          return;
        }

        if (!liveActivity.areActivitiesEnabled()) {
          return;
        }

        if (lastLiveActivityKeyRef.current === liveActivityKey) {
          return;
        }

        await liveActivity.startActivity(
          nowPlaying.title.trim() || Station.name,
          nowPlaying.artist.trim() || Station.tagline,
          Station.name,
          liveActivityArtwork,
          true,
          waveformLevel
        );

        if (!isCancelled) {
          lastLiveActivityKeyRef.current = liveActivityKey;
        }
      } catch {
        // Keep the radio screen working even if the Live Activity bridge fails.
      }
    };

    void syncLiveActivity();

    return () => {
      isCancelled = true;
    };
  }, [isPlaying, liveActivityArtwork, liveActivityKey, nowPlaying.artist, nowPlaying.title, waveformLevel]);

  const artworkSource = useMemo(
    () => (artworkFailed || !hasRealArtwork
      ? FALLBACK_ARTWORK_SOURCE
      : { uri: nowPlaying.artwork }),
    [artworkFailed, hasRealArtwork, nowPlaying.artwork]
  );

  const handleConnectPress = () => {
    Alert.alert(
      'Audio Output',
      Platform.OS === 'ios'
        ? 'AirPlay picker is temporarily disabled for stability. Use Control Center audio output selection for now.'
        : 'Use your system audio output picker to connect Bluetooth speakers or headphones.'
    );
  };

  const currentOutput = 'This iPhone';
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
          accessibilityLabel="Open audio output picker"
          style={({ pressed }) => [
            styles.connectButton,
            {
              backgroundColor: buttonSurface,
              borderColor: buttonBorder,
            },
            pressed && styles.connectButtonPressed,
          ]}
          onPress={() => {
            handleConnectPress();
          }}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={16}
            color={buttonGlyphColor}
            style={styles.connectIcon}
          />
          <View style={styles.connectTextWrap}>
            <Text style={[styles.connectLabel, { color: buttonGlyphColor }]}>Connect</Text>
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
