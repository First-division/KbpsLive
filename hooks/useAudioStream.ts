import { useEffect, useCallback, useState, useRef } from 'react';
import { Audio, InterruptionModeIOS, type AVPlaybackStatus } from 'expo-av';
import { AppState, Platform } from 'react-native';
import { Station } from '@/constants/Station';

export type StreamStatus = 'idle' | 'connecting' | 'playing' | 'paused' | 'error';

type PlaybackIndicatorState = {
  isPlaying: boolean;
  artworkUri: string;
  audioLevel: number;
};

const streamUrl = Platform.OS === 'ios' ? Station.stream.hls : Station.stream.mp3;
let sharedSound: Audio.Sound | null = null;
let playbackIndicatorState: PlaybackIndicatorState = {
  isPlaying: false,
  artworkUri: Station.defaultArtwork,
  audioLevel: 0,
};
const playbackIndicatorListeners = new Set<(state: PlaybackIndicatorState) => void>();

// ─── FFT / Frequency-band analysis ────────────────────────────────────────────
const FFT_SIZE = 512;
export const NUM_BANDS = 12;

// Band bin ranges at 44 100 Hz with FFT_SIZE=512 → 86.1 Hz/bin
const BAND_BINS: ReadonlyArray<readonly [number, number]> = [
  [0,   1],    // sub-bass       0–86 Hz
  [1,   2],    // bass-low       86–172 Hz
  [2,   4],    // bass           172–344 Hz
  [4,   7],    // low-mid        344–602 Hz
  [7,   12],   // mid-low        602–1 033 Hz
  [12,  24],   // mid            1 033–2 066 Hz
  [24,  47],   // upper-mid      2 066–4 047 Hz
  [47,  70],   // presence-low   4 047–6 027 Hz
  [70,  93],   // presence-high  6 027–8 008 Hz
  [93,  140],  // brilliance     8 008–12 054 Hz
  [140, 186],  // air-low        12 054–16 023 Hz
  [186, 233],  // air-high       16 023–20 067 Hz
] as const;

const BAND_ATTACK = 0.55;  // fast rise
const BAND_DECAY  = 0.80;  // slower fall

const pcmBuffer    = new Float32Array(FFT_SIZE);
let   pcmWritePos  = 0;
const smoothedBands = new Float32Array(NUM_BANDS).fill(0.04);
let   lastSampleProcessedAt = 0;

let currentBands: readonly number[] = Object.freeze(Array.from(smoothedBands));
const bandsListeners = new Set<(bands: readonly number[]) => void>();

function emitBandsState() {
  for (const listener of bandsListeners) {
    listener(currentBands);
  }
}

export function usePlaybackBands(): readonly number[] {
  const [bands, setBands] = useState<readonly number[]>(currentBands);
  useEffect(() => {
    bandsListeners.add(setBands);
    return () => {
      bandsListeners.delete(setBands);
    };
  }, []);
  return bands;
}

function computeFFTMagnitudes(buf: Float32Array): Float32Array {
  const n = FFT_SIZE;
  const re = new Float32Array(n);
  const im = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = buf[i] * w;
  }

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) { j ^= bit; }
    j ^= bit;
    if (i < j) {
      const tR = re[i]; re[i] = re[j]; re[j] = tR;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang  = (-2 * Math.PI) / len;
    const wRe  = Math.cos(ang);
    const wIm  = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1;
      let cIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe  = re[i + j];
        const uIm  = im[i + j];
        const idx2 = i + j + half;
        const vRe  = re[idx2] * cRe - im[idx2] * cIm;
        const vIm  = re[idx2] * cIm + im[idx2] * cRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[idx2]  = uRe - vRe;
        im[idx2]  = uIm - vIm;
        const nextCRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nextCRe;
      }
    }
  }

  const half = n >> 1;
  const mags = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mags;
}

function emitPlaybackIndicatorState() {
  for (const listener of playbackIndicatorListeners) {
    listener(playbackIndicatorState);
  }
}

function setPlaybackIndicatorPlaying(isPlaying: boolean) {
  if (playbackIndicatorState.isPlaying === isPlaying) {
    return;
  }

  playbackIndicatorState = {
    ...playbackIndicatorState,
    isPlaying,
  };
  emitPlaybackIndicatorState();
}

function setPlaybackIndicatorLevel(audioLevel: number) {
  const clamped = Math.max(0, Math.min(1, audioLevel));
  if (Math.abs(playbackIndicatorState.audioLevel - clamped) < 0.01) {
    return;
  }

  playbackIndicatorState = {
    ...playbackIndicatorState,
    audioLevel: clamped,
  };
  emitPlaybackIndicatorState();
}

export function setPlaybackIndicatorArtwork(artworkUri: string) {
  const nextArtwork = artworkUri?.trim() ? artworkUri : Station.defaultArtwork;
  if (playbackIndicatorState.artworkUri === nextArtwork) {
    return;
  }

  playbackIndicatorState = {
    ...playbackIndicatorState,
    artworkUri: nextArtwork,
  };
  emitPlaybackIndicatorState();
}

export function usePlaybackIndicator() {
  const [state, setState] = useState<PlaybackIndicatorState>(playbackIndicatorState);

  useEffect(() => {
    playbackIndicatorListeners.add(setState);
    return () => {
      playbackIndicatorListeners.delete(setState);
    };
  }, []);

  return state;
}

export function useAudioStream() {
  const soundRef = useRef<Audio.Sound | null>(sharedSound);
  const lastAudioLevelSampleAtRef = useRef(0);
  const shouldResumeAfterBackgroundRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const statusRef = useRef<StreamStatus>('idle');
  const resumeAttemptTokenRef = useRef(0);
  const [status, setStatus] = useState<StreamStatus>(
    playbackIndicatorState.isPlaying ? 'playing' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handlePlaybackStatusUpdate = useCallback((playbackStatus: AVPlaybackStatus) => {
    if (!playbackStatus.isLoaded) {
      if (playbackStatus.error) {
        setError(playbackStatus.error);
        setStatus('error');
        setPlaybackIndicatorPlaying(false);
      }
      return;
    }

    if (playbackStatus.isBuffering) {
      setStatus('connecting');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0.08);
      return;
    }

    if (playbackStatus.isPlaying) {
      setStatus('playing');
      setPlaybackIndicatorPlaying(true);
      return;
    }

    setStatus('connecting');
    setPlaybackIndicatorPlaying(false);
    setPlaybackIndicatorLevel(0.08);
  }, []);

  const handleAudioSample = useCallback((sample: { channels: { frames: number[] }[] }) => {
    const now = Date.now();
    if (!sample.channels.length) {
      return;
    }

    // Accumulate all frames from channel 0 into the circular PCM buffer.
    const frames = sample.channels[0].frames;
    for (let i = 0; i < frames.length; i++) {
      pcmBuffer[pcmWritePos] = frames[i] ?? 0;
      pcmWritePos = (pcmWritePos + 1) % FFT_SIZE;
    }

    if (now - lastSampleProcessedAt < 55) {
      return;
    }
    lastSampleProcessedAt = now;

    // Build a linearised snapshot of the circular buffer.
    const linearBuf = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      linearBuf[i] = pcmBuffer[(pcmWritePos + i) % FFT_SIZE];
    }

    // RMS → single overall level (used by DI/live-activity waveform).
    let sumSq = 0;
    for (let i = 0; i < FFT_SIZE; i++) { sumSq += linearBuf[i] * linearBuf[i]; }
    const rms = Math.sqrt(sumSq / FFT_SIZE);
    setPlaybackIndicatorLevel(Math.max(0.06, Math.min(1, Math.pow(rms * 4, 0.75))));

    // FFT → per-band magnitudes.
    const mags = computeFFTMagnitudes(linearBuf);

    let changed = false;
    for (let b = 0; b < NUM_BANDS; b++) {
      const [start, end] = BAND_BINS[b];
      let energy = 0;
      let count  = 0;
      for (let k = start; k < end; k++) {
        energy += mags[k] ?? 0;
        count++;
      }
      const avg    = count > 0 ? energy / count : 0;
      const scaled = Math.min(1, Math.pow(avg / 22, 0.6));
      const prev   = smoothedBands[b];
      const next   = scaled > prev
        ? prev + (scaled - prev) * BAND_ATTACK
        : prev + (scaled - prev) * (1 - BAND_DECAY);
      if (Math.abs(next - prev) > 0.005) { changed = true; }
      smoothedBands[b] = next;
    }

    if (changed) {
      currentBands = Object.freeze(Array.from(smoothedBands));
      emitBandsState();
    }
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: false,
    });

    if (sharedSound) {
      soundRef.current = sharedSound;
      sharedSound.setOnPlaybackStatusUpdate(handlePlaybackStatusUpdate);
      sharedSound.setOnAudioSampleReceived(handleAudioSample);
      shouldResumeAfterBackgroundRef.current = true;
      setStatus(playbackIndicatorState.isPlaying ? 'playing' : 'connecting');
    }
  }, [handleAudioSample, handlePlaybackStatusUpdate]);

  const releaseSound = useCallback(async () => {
    if (!soundRef.current) {
      return;
    }

    soundRef.current.setOnPlaybackStatusUpdate(null);
    soundRef.current.setOnAudioSampleReceived(null);

    try {
      await soundRef.current.stopAsync();
    } catch {
      // Best effort stop.
    }

    try {
      await soundRef.current.unloadAsync();
    } catch {
      // Best effort unload.
    }

    soundRef.current = null;
    sharedSound = null;
    setPlaybackIndicatorLevel(0);
  }, []);

  const play = useCallback(async () => {
    try {
      setError(null);
      setStatus('connecting');
      shouldResumeAfterBackgroundRef.current = true;

      await releaseSound();

      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, volume },
        handlePlaybackStatusUpdate
      );

      sound.setOnAudioSampleReceived(handleAudioSample);

      soundRef.current = sound;
      sharedSound = sound;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to stream');
      setStatus('error');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
    }
  }, [handleAudioSample, handlePlaybackStatusUpdate, releaseSound, volume]);

  const updateVolume = useCallback(async (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolume(clamped);

    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(clamped);
      } catch {
        // Keep UI state in sync even if the native call fails.
      }
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      shouldResumeAfterBackgroundRef.current = false;
      await releaseSound();
      setStatus('idle');
      setPlaybackIndicatorPlaying(false);
      setPlaybackIndicatorLevel(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop stream');
    }
  }, [releaseSound]);

  const togglePlayPause = useCallback(() => {
    if (status === 'playing' || status === 'connecting') {
      pause();
    } else {
      play();
    }
  }, [status, play, pause]);

  useEffect(() => {
    const verifyAndRecoverPlayback = async (token: number) => {
      if (resumeAttemptTokenRef.current != token) {
        return;
      }
      if (appStateRef.current !== 'active' || !shouldResumeAfterBackgroundRef.current) {
        return;
      }

      try {
        if (soundRef.current) {
          const playbackStatus = await soundRef.current.getStatusAsync();
          if (playbackStatus.isLoaded && playbackStatus.isPlaying) {
            setStatus('playing');
            return;
          }

          if (playbackStatus.isLoaded) {
            await soundRef.current.playAsync();
            setStatus('connecting');
          }
        } else {
          await play();
        }
      } catch {
        await play();
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        shouldResumeAfterBackgroundRef.current =
          statusRef.current === 'playing' || statusRef.current === 'connecting';
        return;
      }

      const isReturningToActive = previousState === 'background' || previousState === 'inactive';
      if (!isReturningToActive || nextState !== 'active' || !shouldResumeAfterBackgroundRef.current) {
        return;
      }

      const token = Date.now();
      resumeAttemptTokenRef.current = token;

      void (async () => {
        try {
          if (soundRef.current) {
            const playbackStatus = await soundRef.current.getStatusAsync();
            if (playbackStatus.isLoaded && !playbackStatus.isPlaying) {
              await soundRef.current.playAsync();
              setStatus('connecting');
            } else if (!playbackStatus.isLoaded) {
              await play();
            }
          } else {
            await play();
          }

          // Some iOS stream states report loaded but silently fail to resume.
          // Re-check shortly after foreground and reconnect if needed.
          setTimeout(() => {
            void verifyAndRecoverPlayback(token);
          }, 1200);
        } catch {
          await play();
          setTimeout(() => {
            void verifyAndRecoverPlayback(token);
          }, 1200);
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [play]);

  return { status, error, play, pause, togglePlayPause, volume, setVolume: updateVolume };
}
