import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Image, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AirplayButton, useAvAudioSessionRoutes } from 'react-airplay';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { setPlaybackIndicatorArtwork, useAudioStream, usePlaybackBands, usePlaybackIndicator } from '@/hooks/useAudioStream';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { Station } from '@/constants/Station';

const FALLBACK_ARTWORK_SOURCE = require('../../assets/images/icon.png');

type LiveActivityModule = {
  areActivitiesEnabled: () => boolean;
  startActivity: (...args: unknown[]) => Promise<unknown> | unknown;
  updateActivity: (...args: unknown[]) => Promise<unknown> | unknown;
  endActivity: () => Promise<unknown> | unknown;
  getActivityDebugSnapshot?: () => Promise<unknown> | unknown;
};

function getLiveActivityModule() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  return requireOptionalNativeModule<LiveActivityModule>('ReactNativeWidgetExtension');
}

async function startLiveActivity(
  liveActivityModule: LiveActivityModule,
  title: string,
  subtitle: string,
  stationName: string,
  artworkURL: string,
  isLive: boolean,
  waveformLevel: number
): Promise<string> {
  try {
    const result = await liveActivityModule.startActivity(title, subtitle, stationName, artworkURL, isLive, waveformLevel);
    return String(result ?? 'ok');
  } catch {
    // Fall through for older installed native module signatures.
  }

  try {
    const result = await liveActivityModule.startActivity(title, subtitle, stationName, artworkURL);
    return String(result ?? 'ok');
  } catch {
    // Fall through for the oldest installed native module signatures.
  }

  const result = await liveActivityModule.startActivity(title, subtitle, stationName);
  return String(result ?? 'ok');
}

async function updateLiveActivity(
  liveActivityModule: LiveActivityModule,
  title: string,
  subtitle: string,
  stationName: string,
  artworkURL: string,
  isLive: boolean,
  waveformLevel: number
): Promise<string> {
  try {
    const result = await liveActivityModule.updateActivity(title, subtitle, isLive, artworkURL, waveformLevel);
    return String(result ?? 'ok');
  } catch {
    // Fall through for older installed native module signatures.
  }

  try {
    const result = await liveActivityModule.updateActivity(title, subtitle, isLive);
    return String(result ?? 'ok');
  } catch {
    // Fall back to start for bridges that only expose the original request method.
  }

  return startLiveActivity(liveActivityModule, title, subtitle, stationName, artworkURL, isLive, waveformLevel);
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { status, error, togglePlayPause } = useAudioStream();
  const bands = usePlaybackBands();
  const playbackIndicator = usePlaybackIndicator();
  const isPlaying = status === 'playing';
  const isConnecting = status === 'connecting';
  const nowPlaying = useNowPlaying(isPlaying);
  const routes = useAvAudioSessionRoutes();
  const [artworkFailed, setArtworkFailed] = useState(false);
  const liveActivityStartedRef = useRef(false);
  const liveActivitySyncInFlightRef = useRef(false);
  const liveActivitySyncQueuedRef = useRef(false);
  const lastLiveActivitySyncAtRef = useRef(0);
  const lastLiveActivityPayloadRef = useRef<{
    title: string;
    subtitle: string;
    artworkURL: string;
    isLive: boolean;
    waveformLevel: number;
  } | null>(null);
  const iosVersion =
    Platform.OS === 'ios' ? Number(String(Platform.Version).split('.')[0]) : 0;
  const supportsLiquidGlass = Platform.OS === 'ios' && iosVersion >= 26;
  const playButtonBlurTint = supportsLiquidGlass ? ('systemUltraThinMaterial' as any) : ('regular' as any);
  const playGlyphColor = colorScheme === 'dark' ? '#ffffff' : '#11181C';
  const bottomControlsPadding = Platform.OS === 'ios'
    ? Math.max(insets.bottom + 72, 88)
    : Math.max(insets.bottom + 16, 24);
  const [appState, setAppState] = useState<'active' | 'inactive' | 'background'>('active');
  const shouldRunLiveActivity = isPlaying;
  const artworkUrl = nowPlaying.artwork?.trim();
  const hasRealArtwork = Boolean(artworkUrl) && artworkUrl !== Station.defaultArtwork;
  const liveActivityArtworkUrl = hasRealArtwork ? nowPlaying.artwork : Station.defaultArtwork;
  const liveActivitySubtitle = nowPlaying.artist || Station.tagline;
  const [waveTick, setWaveTick] = useState(0);

  useEffect(() => {
    if (!shouldRunLiveActivity) {
      return;
    }

    const id = setInterval(() => {
      setWaveTick((prev) => prev + 1);
    }, 220);

    return () => {
      clearInterval(id);
    };
  }, [shouldRunLiveActivity]);

  const diBandLevel = useMemo(() => {
    if (!shouldRunLiveActivity || bands.length === 0) {
      return 0;
    }

    let weighted = 0;
    let totalWeight = 0;
    for (let index = 0; index < bands.length; index++) {
      const value = Math.max(0, Math.min(1, bands[index] ?? 0));
      const weight = index <= 1 ? 0.65 : index <= 4 ? 1.05 : 1.28;
      weighted += value * weight;
      totalWeight += weight;
    }

    return weighted / Math.max(totalWeight, 1);
  }, [bands, shouldRunLiveActivity]);

  const liveWaveformLevel = useMemo(() => {
    if (!shouldRunLiveActivity) {
      return 0;
    }

    const playback = Math.max(0, Math.min(1, playbackIndicator.audioLevel));
    const base = Math.max(diBandLevel, playback * 0.55);
    const mixed = base * 0.78 + playback * 0.32;
    return Math.min(1, mixed);
  }, [diBandLevel, playbackIndicator.audioLevel, shouldRunLiveActivity]);

  const liveWaveformBucket = useMemo(() => {
    if (!shouldRunLiveActivity) {
      return 0;
    }

    const boosted = Math.min(1, Math.pow(Math.max(liveWaveformLevel, 0.002), 0.5) * 1.26);
    const pulse = (Math.sin(waveTick * 1.08) + 1) / 2;
    const shimmer = (Math.sin(waveTick * 0.58 + 1.1) + 1) / 2;
    const modulated = Math.min(1, boosted * (0.56 + pulse * 0.82) + shimmer * 0.1);
    const withFloor = Math.max(0.08, modulated);
    const quantized = Math.round(withFloor * 40) / 40;
    return Number(quantized.toFixed(2));
  }, [shouldRunLiveActivity, liveWaveformLevel, waveTick]);

  const handleTogglePlayPause = useCallback(() => {
    togglePlayPause();
  }, [togglePlayPause]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [liveActivityArtworkUrl]);

  useEffect(() => {
    setPlaybackIndicatorArtwork(liveActivityArtworkUrl);
  }, [liveActivityArtworkUrl]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const normalizedState = nextState === 'background'
        ? 'background'
        : nextState === 'active'
          ? 'active'
          : 'inactive';
      setAppState(normalizedState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const supportsLiveActivity = iosVersion >= 16;
    const liveActivityModule = getLiveActivityModule();
    if (!supportsLiveActivity || !liveActivityModule) {
      return;
    }

    const sync = async () => {
      if (liveActivitySyncInFlightRef.current) {
        liveActivitySyncQueuedRef.current = true;
        return;
      }

      liveActivitySyncInFlightRef.current = true;
      try {
        do {
          liveActivitySyncQueuedRef.current = false;

          if (shouldRunLiveActivity) {
            const nextPayload = {
              title: nowPlaying.title,
              subtitle: liveActivitySubtitle,
              artworkURL: liveActivityArtworkUrl,
              isLive: true,
              waveformLevel: liveWaveformBucket,
            };

            if (!liveActivityStartedRef.current) {
              const result = await startLiveActivity(
                liveActivityModule,
                nextPayload.title,
                nextPayload.subtitle,
                Station.name,
                nextPayload.artworkURL,
                nextPayload.isLive,
                nextPayload.waveformLevel
              );
              if (result.includes('start-error') || result === 'unsupported-ios') {
                liveActivityStartedRef.current = false;
                continue;
              }
              liveActivityStartedRef.current = true;
              lastLiveActivityPayloadRef.current = nextPayload;
              lastLiveActivitySyncAtRef.current = Date.now();
              continue;
            }

            const previousPayload = lastLiveActivityPayloadRef.current;
            const waveformDelta = previousPayload
              ? Math.abs(previousPayload.waveformLevel - nextPayload.waveformLevel)
              : 1;
            const metadataChanged = !previousPayload
              || previousPayload.title !== nextPayload.title
              || previousPayload.subtitle !== nextPayload.subtitle
              || previousPayload.artworkURL !== nextPayload.artworkURL
              || previousPayload.isLive !== nextPayload.isLive;
            const now = Date.now();
            const staleSync = now - lastLiveActivitySyncAtRef.current >= 700;
            if (!metadataChanged && waveformDelta < 0.025 && !staleSync) {
              continue;
            }

            const result = await updateLiveActivity(
              liveActivityModule,
              nextPayload.title,
              nextPayload.subtitle,
              Station.name,
              nextPayload.artworkURL,
              nextPayload.isLive,
              nextPayload.waveformLevel
            );
            if (result === 'no-activity' || result.includes('update-error')) {
              liveActivityStartedRef.current = false;
              lastLiveActivityPayloadRef.current = null;
              lastLiveActivitySyncAtRef.current = 0;
              continue;
            }
            lastLiveActivityPayloadRef.current = nextPayload;
            lastLiveActivitySyncAtRef.current = now;
            continue;
          }

          if (liveActivityStartedRef.current) {
            const result = await Promise.resolve(liveActivityModule.endActivity());
            liveActivityStartedRef.current = false;
            lastLiveActivityPayloadRef.current = null;
            lastLiveActivitySyncAtRef.current = 0;
          }

        } while (liveActivitySyncQueuedRef.current);
      } finally {
        liveActivitySyncInFlightRef.current = false;
      }
    };

    void sync();
  }, [
    iosVersion,
    liveActivityArtworkUrl,
    liveActivitySubtitle,
    nowPlaying.title,
    shouldRunLiveActivity,
    liveWaveformBucket,
  ]);

  const artworkSource = useMemo(
    () => (artworkFailed || !hasRealArtwork
      ? FALLBACK_ARTWORK_SOURCE
      : { uri: nowPlaying.artwork }),
    [artworkFailed, hasRealArtwork, nowPlaying.artwork]
  );

  const handleConnectPress = () => {
    if (Platform.OS === 'ios') {
      return;
    }

    Alert.alert(
      'Audio Output',
      'Use your system audio output picker to connect Bluetooth speakers or headphones.'
    );
  };

  const currentOutput = routes[0]?.portName || 'This iPhone';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topPill, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
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

      {/* Now Playing Info */}
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
          Platform.OS === 'ios' && styles.playButtonIOS,
          pressed && styles.playButtonPressed,
        ]}
        disabled={isConnecting}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint={playButtonBlurTint} style={styles.liquidGlassButton}>
            {isConnecting ? (
              <ActivityIndicator size="large" color={playGlyphColor} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={48}
                color={playGlyphColor}
                style={!isPlaying ? { marginLeft: 4 } : undefined}
              />
            )}
          </BlurView>
        ) : (
          isConnecting ? (
            <ActivityIndicator size="large" color={playGlyphColor} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={48}
              color={playGlyphColor}
              style={!isPlaying ? { marginLeft: 4 } : undefined}
            />
          )
        )}
      </Pressable>

      {/* Error Message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={[styles.footerControls, { paddingBottom: bottomControlsPadding }]}>
        {Platform.OS === 'ios' ? (
          <View style={[styles.connectButton, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
            <Ionicons
              name="phone-portrait-outline"
              size={16}
              color={theme.text}
              style={styles.connectIcon}
            />
            <View style={styles.connectTextWrap}>
              <Text style={[styles.connectLabel, { color: theme.text }]}>Connect</Text>
              <Text style={[styles.connectDevice, { color: theme.tabIconDefault }]}>{currentOutput}</Text>
            </View>
            <AirplayButton
              style={styles.connectNativePickerFull}
              tintColor={theme.text}
              activeTintColor={theme.tint}
            />
          </View>
        ) : (
          <Pressable
            testID="home-connect-button"
            accessibilityRole="button"
            accessibilityLabel="Open audio output picker"
            style={({ pressed }) => [
              styles.connectButton,
              { backgroundColor: theme.card, borderColor: theme.tabIconDefault },
              pressed && styles.connectButtonPressed,
            ]}
            onPress={() => {
              handleConnectPress();
            }}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={16}
              color={theme.text}
              style={styles.connectIcon}
            />
            <View style={styles.connectTextWrap}>
              <Text style={[styles.connectLabel, { color: theme.text }]}>Connect</Text>
              <Text style={[styles.connectDevice, { color: theme.tabIconDefault }]}>{currentOutput}</Text>
            </View>
          </Pressable>
        )}
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
    backgroundColor: '#121212',
    borderColor: '#2b2b2b',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 24,
  },
  topPillText: {
    color: '#fff',
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
  debugText: {
    fontSize: 11,
    opacity: 0.8,
    textAlign: 'center',
  },
  debugBlock: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  playButtonIOS: {
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  liquidGlassButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.35)',
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
    backgroundColor: '#151515',
    borderColor: '#2b2b2b',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  connectDevice: {
    color: '#a8b0bc',
    fontSize: 11,
    lineHeight: 13,
  },
  connectNativePickerFull: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
    opacity: 0.02,
  },
});
