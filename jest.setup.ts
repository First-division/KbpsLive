import '@testing-library/jest-native/extend-expect';
import type { ReactNode } from 'react';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => null,
  requireNativeModule: () => ({}),
}));

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-airplay', () => ({
  AirplayButton: () => null,
  useAvAudioSessionRoutes: () => [{ portName: 'This iPhone' }],
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));
