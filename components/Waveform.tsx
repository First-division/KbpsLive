import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { NUM_BANDS } from '@/hooks/useAudioStream';

// Visual constants
const BAR_WIDTH    = 4;
const BAR_GAP      = 3;
const MAX_HEIGHT   = 64;
const MIN_HEIGHT   = 4;
const BAR_RADIUS   = BAR_WIDTH / 2;

interface WaveformProps {
  bands: readonly number[];
  isActive: boolean;
  color: string;
}

export function Waveform({ bands, isActive, color }: WaveformProps) {
  const animValues = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BANDS }, () => new Animated.Value(MIN_HEIGHT))
  ).current;

  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isActive ? 1 : 0.2,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isActive, opacityAnim]);

  useEffect(() => {
    if (!isActive) {
      // Animate all bars to minimum when stopped.
      animValues.forEach((av) => {
        Animated.timing(av, {
          toValue: MIN_HEIGHT,
          duration: 400,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    animValues.forEach((av, i) => {
      const targetHeight = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * Math.max(0, Math.min(1, bands[i] ?? 0));
      Animated.timing(av, {
        toValue: targetHeight,
        duration: 60,
        useNativeDriver: false,
      }).start();
    });
  }, [bands, isActive, animValues]);

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      {animValues.map((av, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              width: BAR_WIDTH,
              backgroundColor: color,
              borderRadius: BAR_RADIUS,
              height: av,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: MAX_HEIGHT,
    gap: BAR_GAP,
  },
  bar: {
    minHeight: MIN_HEIGHT,
  },
});
