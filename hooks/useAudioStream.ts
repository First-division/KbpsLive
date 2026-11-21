import { useEffect, useCallback, useState, useRef } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
  type AudioSample,
  type AudioStatus,
} from 'expo-audio';
import { AppState, Platform } from 'react-native';
import { Station } from '@/constants/Station';

export type StreamStatus = 'idle' | 'connecting' | 'playing' | 'paused' | 'error';

type PlaybackIndicatorState = {
  isPlaying: boolean;
  artworkUri: string;
  audioLevel: number;
};

const STREAM_LOOKUP_TIMEOUT_MS = 3500;
export const NUM_BANDS = 12;
const AUDIO_SAMPLE_DECAY_MS = 900;
const AUDIO_SAMPLE_LEVEL_MULTIPLIER = 2.7;
const AUDIO_LEVEL_SMOOTHING = 0.24;
const BACKGROUND_PAUSE_GRACE_MS = 4500;

let sharedPlayer: AudioPlayer | null = null;
let lockScreenActivePlayer: AudioPlayer | null = null;
let sharedPlayerStatusSubscription: { remove: () => void } | null = null;
let sharedPlayerSampleSubscription: { remove: () => void } | null = null;
let playbackIndicatorState: PlaybackIndicatorState = {
  isPlaying: false,
  artworkUri: Station.defaultArtwork,
  audioLevel: 0,
};

let playbackBandsState = Array.from({ length: NUM_BANDS }, () => 0.04);
let playbackVisualizerInterval: ReturnType<typeof setInterval> | null = null;
let playbackVisualizerPhase = 0;
let playbackVisualizerSeed = 0.5;
let lastSampleTimestamp = 0;
let smoothedSampleLevel = 0;

let lockScreenMetadataState: AudioMetadata = {
  title: Station.name,
  artist: Station.tagline,
  artworkUrl: Station.defaultArtwork,
};

const playbackIndicatorListeners = new Set<(state: PlaybackIndicatorState) => void>();
const playbackBandsListeners = new Set<(bands: readonly number[]) => void>();

type LockScreenPlayer = AudioPlayer & {
  setActiveForLockScreen?: (active: boolean, metadata?: AudioMetadata, options?: { isLiveStream?: boolean }) => void;
  updateLockScreenMetadata?: (metadata: AudioMetadata) => void;
  clearLockScreenControls?: () => void;
  setAudioSamplingEnabled?: (enabled: boolean) => void;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function parsePlaylistUrls(playlistBody: string): string[] {
  return playlistBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http://') || line.startsWith('https://'));
}

async function resolveStreamCandidates(): Promise<string[]> {
  const fallback = [Station.stream.hls];

  try {
    const response = await withTimeout(fetch(Station.stream.mp3), STREAM_LOOKUP_TIMEOUT_MS, null);
    if (!response || !response.ok) {
      return fallback;
    }

    const playlistBody = await withTimeout(response.text(), STREAM_LOOKUP_TIMEOUT_MS, '');
    const directCandidates = parsePlaylistUrls(playlistBody);

    if (directCandidates.length > 0) {
      return [...directCandidates, ...fallback];
    }
  } catch {
    // Fallback to HLS when playlist lookup fails.
  }

  return fallback;
}

function emitPlaybackIndicatorState() {
  for (const listener of playbackIndicatorListeners) {
    listener(playbackIndicatorState);
  }
}

function emitPlaybackBandsState() {
  for (const listener of playbackBandsListeners) {
    listener(playbackBandsState);
  }
}

function setPlaybackBands(nextBands: number[]) {
  playbackBandsState = nextBands;
  emitPlaybackBandsState();
}

function getSeedFromArtwork(artworkUri: string): number {
  let hash = 0;

  for (let i = 0; i < artworkUri.length; i += 1) {
    hash = ((hash << 5) - hash + artworkUri.charCodeAt(i)) | 0;
  }

  return (Math.abs(hash) % 1000) / 1000;
}

function stopPlaybackVisualizer() {
  if (playbackVisualizerInterval) {
    clearInterval(playbackVisualizerInterval);
    playbackVisualizerInterval = null;
  }

  lastSampleTimestamp = 0;
  smoothedSampleLevel = 0;
  setPlaybackBands(Array.from({ length: NUM_BANDS }, () => 0.04));
}

function startPlaybackVisualizer() {
  if (playbackVisualizerInterval || (playbackIndicatorListeners.size === 0 && playbackBandsListeners.size === 0)) {
    return;
  }

  playbackVisualizerInterval = setInterval(() => {
    if (Date.now() - lastSampleTimestamp < AUDIO_SAMPLE_DECAY_MS) {
      return;
    }

    playbackVisualizerPhase += 0.42;
    const songBias = 0.35 + playbackVisualizerSeed * 0.5;
    const pulse = (Math.sin(playbackVisualizerPhase * (1.1 + songBias * 0.4)) + 1) / 2;
    const shimmer = (Math.sin(playbackVisualizerPhase * (2.5 + songBias * 0.8) + 1.7) + 1) / 2;
    const flicker = (Math.sin(playbackVisualizerPhase * (4.4 + songBias * 0.5) + 2.4) + 1) / 2;
    const computedLevel = Math.max(0.12, Math.min(0.98, 0.12 + pulse * 0.44 + shimmer * 0.28 + flicker * 0.14));

    const nextBands = Array.from({ length: NUM_BANDS }, (_, index) => {
      const phaseOffset = playbackVisualizerPhase + index * (0.45 + songBias * 0.08);
      const fastBand = (Math.sin(phaseOffset * (1.45 + songBias * 0.5)) + 1) / 2;
      const slowBand = (Math.sin(phaseOffset * 0.35 + songBias * 4) + 1) / 2;
      const band = (computedLevel * (0.35 + fastBand * 0.55)) * (0.72 + slowBand * 0.38);
      return Math.max(0.04, Math.min(1, band));
    });

    setPlaybackIndicatorLevel(computedLevel);
    setPlaybackBands(nextBands);
  }, 180);
}

function summarizeSampleFrames(sample: AudioSample): { level: number; bands: number[] } {
  const channels = sample.channels ?? [];
  const channelFrames = channels
    .map((channel) => channel.frames ?? [])
    .filter((frames) => frames.length > 0);

  if (channelFrames.length === 0) {
    return {
      level: 0,
      bands: Array.from({ length: NUM_BANDS }, () => 0.04),
    };
  }

  const shortestLength = channelFrames.reduce((min, frames) => Math.min(min, frames.length), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(shortestLength) || shortestLength <= 0) {
    return {
      level: 0,
      bands: Array.from({ length: NUM_BANDS }, () => 0.04),
    };
  }

  const mergedFrames: number[] = [];
  for (let index = 0; index < shortestLength; index += 1) {
    let sum = 0;
    for (const frames of channelFrames) {
      sum += Math.abs(frames[index] ?? 0);
    }
    mergedFrames.push(sum / channelFrames.length);
  }

  const averageAmplitude = mergedFrames.reduce((sum, frame) => sum + frame, 0) / mergedFrames.length;
  const boostedLevel = Math.max(0, Math.min(1, averageAmplitude * AUDIO_SAMPLE_LEVEL_MULTIPLIER));

  const bandFrames = Math.max(1, Math.floor(mergedFrames.length / NUM_BANDS));
  const bands = Array.from({ length: NUM_BANDS }, (_, bandIndex) => {
    const start = bandIndex * bandFrames;
    const end = bandIndex === NUM_BANDS - 1
      ? mergedFrames.length
      : Math.min(mergedFrames.length, start + bandFrames);
    if (start >= end) {
      return 0.04;
    }

    let chunkTotal = 0;
    for (let frame = start; frame < end; frame += 1) {
      chunkTotal += mergedFrames[frame];
    }
    const chunkAverage = chunkTotal / (end - start);
    const chunkBoosted = Math.max(0.04, Math.min(1, chunkAverage * (AUDIO_SAMPLE_LEVEL_MULTIPLIER + 0.7)));
    return chunkBoosted;
  });

  return { level: boostedLevel, bands };
}

function applyAudioSample(sample: AudioSample) {
  const { level, bands } = summarizeSampleFrames(sample);
  smoothedSampleLevel += (level - smoothedSampleLevel) * AUDIO_LEVEL_SMOOTHING;
  lastSampleTimestamp = Date.now();
  setPlaybackIndicatorLevel(smoothedSampleLevel);
  setPlaybackBands(bands);
}

function setPlaybackIndicatorPlaying(isPlaying: boolean) {
  if (playbackIndicatorState.isPlaying === isPlaying) {
    return;
  }

  playbackIndicatorState = {
    ...playbackIndicatorState,
    isPlaying,
  };

  if (isPlaying) {
    startPlaybackVisualizer();
  } else {
    stopPlaybackVisualizer();
  }

  emitPlaybackIndicatorState();
}

function setPlaybackIndicatorLevel(audioLevel: number) {
  const clamped = Math.max(0, Math.min(1, audioLevel));
  if (Math.abs(playbackIndicatorState.audioLevel - clamped) < 0.003) {
    return;
  }

  playbackIndicatorState = {
    ...playbackIndicatorState,
    audioLevel: clamped,
  };
  emitPlaybackIndicatorState();
}

function activateLockScreenControls(player: AudioPlayer | null) {
  if (!player || lockScreenActivePlayer === player) {
    return;
  }

  const lockScreenPlayer = player as LockScreenPlayer;
  try {
    lockScreenPlayer.setActiveForLockScreen?.(true, lockScreenMetadataState, {
      isLiveStream: true,
    });
    lockScreenActivePlayer = player;
  } catch (error) {
    console.warn('[Audio] Unable to activate lock-screen controls:', error);
  }
}

function refreshLockScreenMetadata(player: AudioPlayer | null) {
  if (!player || lockScreenActivePlayer !== player) {
    return;
  }

  const lockScreenPlayer = player as LockScreenPlayer;
  try {
    if (typeof lockScreenPlayer.updateLockScreenMetadata === 'function') {
      lockScreenPlayer.updateLockScreenMetadata(lockScreenMetadataState);
      return;
    }
    lockScreenPlayer.setActiveForLockScreen?.(true, lockScreenMetadataState, {
      isLiveStream: true,
    });
  } catch (error) {
    console.warn('[Audio] Unable to update lock-screen metadata:', error);
  }
}

function clearLockScreenControls(player: AudioPlayer | null) {
  if (!player || lockScreenActivePlayer !== player) {
    return;
  }

  const lockScreenPlayer = player as LockScreenPlayer;
  try {
    lockScreenPlayer.clearLockScreenControls?.();
    lockScreenActivePlayer = null;
  } catch (error) {
    console.warn('[Audio] Unable to clear lock-screen controls:', error);
  }
}

export function setLockScreenNowPlayingMetadata(metadata: AudioMetadata) {
  const nextMetadata = {
    title: metadata.title?.trim() || Station.name,
    artist: metadata.artist?.trim() || Station.tagline,
    artworkUrl: metadata.artworkUrl?.trim() || Station.defaultArtwork,
  };
  if (nextMetadata.title === lockScreenMetadataState.title &&
      nextMetadata.artist === lockScreenMetadataState.artist &&
      nextMetadata.artworkUrl === lockScreenMetadataState.artworkUrl) {
    return;
  }
  lockScreenMetadataState = nextMetadata;
  refreshLockScreenMetadata(sharedPlayer);
}

export function setPlaybackIndicatorArtwork(artworkUri: string) {
  const nextArtwork = artworkUri?.trim() ? artworkUri : Station.defaultArtwork;
  if (playbackIndicatorState.artworkUri === nextArtwork) {
    return;
  }

  playbackVisualizerSeed = getSeedFromArtwork(nextArtwork);

  playbackIndicatorState = {
    ...playbackIndicatorState,
    artworkUri: nextArtwork,
  };
  emitPlaybackIndicatorState();
}

function syncAudioSampling() {
  const player = sharedPlayer as LockScreenPlayer | null;
  const needed = playbackIndicatorListeners.size > 0 || playbackBandsListeners.size > 0;
  if (!player?.setAudioSamplingEnabled) return;

  try {
    if (needed && !sharedPlayerSampleSubscription) {
      sharedPlayerSampleSubscription = player.addListener('audioSampleUpdate', applyAudioSample);
      player.setAudioSamplingEnabled(true);
    } else if (!needed && sharedPlayerSampleSubscription) {
      player.setAudioSamplingEnabled(false);
      sharedPlayerSampleSubscription.remove();
      sharedPlayerSampleSubscription = null;
    }
  } catch (error) {
    console.warn('[Audio] Unable to change audio sampling:', error);
  }
}

export function usePlaybackIndicator() {
  const [state, setState] = useState<PlaybackIndicatorState>(playbackIndicatorState);

  useEffect(() => {
    playbackIndicatorListeners.add(setState);
    syncAudioSampling();
    if (playbackIndicatorState.isPlaying) startPlaybackVisualizer();
    return () => {
      playbackIndicatorListeners.delete(setState);
      syncAudioSampling();
      if (playbackIndicatorListeners.size === 0 && playbackBandsListeners.size === 0) stopPlaybackVisualizer();
    };
  }, []);

  return state;
}

export function usePlaybackBands(): readonly number[] {
  const [bands, setBands] = useState<readonly number[]>(playbackBandsState);

  useEffect(() => {
    playbackBandsListeners.add(setBands);
    syncAudioSampling();
    if (playbackIndicatorState.isPlaying) startPlaybackVisualizer();
    return () => {
      playbackBandsListeners.delete(setBands);
      syncAudioSampling();
      if (playbackIndicatorListeners.size === 0 && playbackBandsListeners.size === 0) stopPlaybackVisualizer();
    };
  }, []);

  return bands;
}

function detachSharedStatusListener() {
  if (!sharedPlayerStatusSubscription) {
    // Continue; the sample listener may still be attached.
  } else {
    try {
      sharedPlayerStatusSubscription.remove();
    } catch {
      // Best effort listener cleanup.
    }
    sharedPlayerStatusSubscription = null;
  }

  if (!sharedPlayerSampleSubscription) {
    return;
  }

  try {
    sharedPlayerSampleSubscription.remove();
  } catch {
    // Best effort listener cleanup.
  }

  sharedPlayerSampleSubscription = null;
}

export function useAudioStream() {
  const playerRef = useRef<AudioPlayer | null>(sharedPlayer);
  const shouldResumeAfterBackgroundRef = useRef(false);
  const hasStartedPlaybackRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const backgroundTransitionAtRef = useRef(0);
  const statusRef = useRef<StreamStatus>('idle');
  const [status, setStatus] = useState<StreamStatus>(
    playbackIndicatorState.isPlaying ? 'playing' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applyPlayerStatus = useCallback((playerStatus: AudioStatus) => {
    if (Platform.OS === 'ios' && hasStartedPlaybackRef.current && !playerStatus.playing && playerStatus.timeControlStatus === 'paused') {
      const isAppActive = appStateRef.current === 'active';
      const pausedDuringBackgroundTransition =
        !isAppActive &&
        backgroundTransitionAtRef.current > 0 &&
        Date.now() - backgroundTransitionAtRef.current < BACKGROUND_PAUSE_GRACE_MS;

      if (pausedDuringBackgroundTransition) {
        setStatus('playing');
        setPlaybackIndicatorPlaying(true);
        activateLockScreenControls(playerRef.current);
        return;
      }

      shouldResumeAfterBackgroundRef.current = false;
      setStatus('paused');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
      clearLockScreenControls(playerRef.current);
      return;
    }

    if (!playerStatus.isLoaded) {
      setStatus('connecting');
      setPlaybackIndicatorPlaying(true);
      activateLockScreenControls(playerRef.current);
      return;
    }

    if (playerStatus.isBuffering) {
      setStatus('connecting');
      setPlaybackIndicatorPlaying(true);
      activateLockScreenControls(playerRef.current);
      return;
    }

    if (playerStatus.playing) {
      hasStartedPlaybackRef.current = true;
      setStatus('playing');
      setPlaybackIndicatorPlaying(true);
      activateLockScreenControls(playerRef.current);
      return;
    }

    if (hasStartedPlaybackRef.current) {
      shouldResumeAfterBackgroundRef.current = false;
      setStatus('paused');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
      clearLockScreenControls(playerRef.current);
    } else {
      setStatus('connecting');
      setPlaybackIndicatorPlaying(true);
      activateLockScreenControls(playerRef.current);
    }
  }, []);

  const attachPlayerStatusListener = useCallback((player: AudioPlayer) => {
    detachSharedStatusListener();
    sharedPlayerStatusSubscription = player.addListener('playbackStatusUpdate', applyPlayerStatus);
    syncAudioSampling();
    applyPlayerStatus(player.currentStatus);
  }, [applyPlayerStatus]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });

    if (sharedPlayer) {
      playerRef.current = sharedPlayer;
      attachPlayerStatusListener(sharedPlayer);
      shouldResumeAfterBackgroundRef.current = true;
      setStatus(playbackIndicatorState.isPlaying ? 'playing' : 'connecting');
    }
  }, [attachPlayerStatusListener]);

  const releasePlayer = useCallback(async () => {
    if (!playerRef.current) {
      return;
    }

    detachSharedStatusListener();
    clearLockScreenControls(playerRef.current);

    try {
      playerRef.current.pause();
    } catch {
      // Best effort pause.
    }

    try {
      playerRef.current.remove();
    } catch {
      // Best effort remove.
    }

    playerRef.current = null;
    sharedPlayer = null;
    setPlaybackIndicatorLevel(0);
    setPlaybackIndicatorPlaying(false);
    stopPlaybackVisualizer();
  }, []);

  useEffect(() => {
    return () => {
      void releasePlayer();
    };
  }, [releasePlayer]);

  const play = useCallback(async () => {
    try {
      setError(null);
      hasStartedPlaybackRef.current = false;
      setStatus('connecting');
      shouldResumeAfterBackgroundRef.current = true;

      await releasePlayer();

      const candidates = await resolveStreamCandidates();
      let lastError: unknown = null;

      for (const uri of candidates) {
        try {
          const player = createAudioPlayer({ uri }, { updateInterval: 1000 });
          player.volume = volume;
          player.setPlaybackRate(1, 'medium');
          playerRef.current = player;
          sharedPlayer = player;

          attachPlayerStatusListener(player);
          activateLockScreenControls(player);
          player.play();
          return;
        } catch (candidateError) {
          lastError = candidateError;

          try {
            playerRef.current?.remove();
          } catch {
            // Best effort cleanup.
          }

          playerRef.current = null;
          sharedPlayer = null;
          detachSharedStatusListener();
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Failed to connect to stream');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to stream');
      setStatus('error');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
      clearLockScreenControls(playerRef.current);
    }
  }, [attachPlayerStatusListener, releasePlayer, volume]);

  const updateVolume = useCallback(async (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolume(clamped);

    if (playerRef.current) {
      try {
        playerRef.current.volume = clamped;
      } catch {
        // Keep UI state in sync even if the native call fails.
      }
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      shouldResumeAfterBackgroundRef.current = false;
      hasStartedPlaybackRef.current = false;
      setStatus('idle');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
      clearLockScreenControls(playerRef.current);
      await releasePlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop stream');
    }
  }, [releasePlayer]);

  const togglePlayPause = useCallback(() => {
    if (status === 'playing' || status === 'connecting') {
      void pause();
    } else {
      void play();
    }
  }, [status, play, pause]);

  const updateLockScreenMetadata = useCallback((metadata: AudioMetadata) => {
    setLockScreenNowPlayingMetadata(metadata);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTransitionAtRef.current = Date.now();
        shouldResumeAfterBackgroundRef.current =
          statusRef.current === 'playing' || statusRef.current === 'connecting';

        if (statusRef.current === 'playing') {
          setPlaybackIndicatorLevel(Math.max(playbackIndicatorState.audioLevel, 0.42));
        }

        // Keep the player alive in the background on both platforms so audio
        // continues playing. Releasing here would stop playback and force a
        // reconnect when returning to the app.
        return;
      }

      if (nextState === 'active') {
        backgroundTransitionAtRef.current = 0;
      }

      const isReturningToActive = previousState === 'background' || previousState === 'inactive';
      if (!isReturningToActive || nextState !== 'active' || !shouldResumeAfterBackgroundRef.current) {
        return;
      }

      const currentPlayerStatus = playerRef.current?.currentStatus;
      if (currentPlayerStatus?.isLoaded && (currentPlayerStatus.playing || currentPlayerStatus.isBuffering)) {
        setStatus(currentPlayerStatus.playing ? 'playing' : 'connecting');
        if (currentPlayerStatus.playing) {
          setPlaybackIndicatorPlaying(true);
        }
        return;
      }

      void play();
    });

    return () => {
      subscription.remove();
    };
  }, [play]);

  return {
    status,
    error,
    play,
    pause,
    togglePlayPause,
    volume,
    setVolume: updateVolume,
    setLockScreenMetadata: updateLockScreenMetadata,
  };
}
