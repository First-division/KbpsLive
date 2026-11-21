import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

const capturedTriggers: Array<{ name?: string; children?: React.ReactNode }> = [];
const capturedTabOptions: Array<{ minimizeBehavior?: string }> = [];

jest.mock('expo-router/unstable-native-tabs', () => {
  const ReactLocal = require('react');

  const NativeTabs = ({ children, minimizeBehavior }: { children: React.ReactNode; minimizeBehavior?: string }) => {
    capturedTabOptions.push({ minimizeBehavior });
    return ReactLocal.createElement(ReactLocal.Fragment, null, children);
  };
  NativeTabs.Trigger = ({ name, children }: { name?: string; children?: React.ReactNode }) => {
    capturedTriggers.push({ name, children });
    return null;
  };

  const Icon = () => null;
  const Label = () => null;
  const VectorIcon = () => null;
  NativeTabs.Trigger.Icon = Icon;
  NativeTabs.Trigger.Label = Label;
  NativeTabs.Trigger.VectorIcon = VectorIcon;

  return { NativeTabs };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

import TabLayout from '@/app/(tabs)/_layout';

describe('Tab isolation', () => {
  beforeEach(() => {
    capturedTriggers.length = 0;
    capturedTabOptions.length = 0;
  });

  it('uses native tab triggers for the four app tabs', async () => {
    await render(<TabLayout />);

    expect(capturedTriggers.map((trigger) => trigger.name)).toEqual([
      'explore',
      'index',
      'recent',
      'settings',
    ]);
  });

  it('minimizes on scroll only on supported iOS versions', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'ios');
    const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue('26.0');
    try {
      const { rerender } = await render(<TabLayout />);
      expect(capturedTabOptions.at(-1)?.minimizeBehavior).toBe('onScrollDown');
      version.mockReturnValue('26.2.1');
      await rerender(<TabLayout />);
      expect(capturedTabOptions.at(-1)?.minimizeBehavior).toBe('onScrollDown');
      version.mockReturnValue('18.0');
      await rerender(<TabLayout />);
      expect(capturedTabOptions.at(-1)?.minimizeBehavior).toBeUndefined();
      os.replaceValue('android');
      version.mockReturnValue(36);
      await rerender(<TabLayout />);
      expect(capturedTabOptions.at(-1)?.minimizeBehavior).toBeUndefined();
    } finally {
      version.mockRestore();
      os.restore();
    }
  });
});