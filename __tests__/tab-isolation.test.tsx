import React from 'react';
import { render } from '@testing-library/react-native';

const capturedTriggers: Array<{ name?: string; children?: React.ReactNode }> = [];

jest.mock('expo-router/unstable-native-tabs', () => {
  const ReactLocal = require('react');

  const NativeTabs = ({ children }: { children: React.ReactNode }) =>
    ReactLocal.createElement(ReactLocal.Fragment, null, children);
  NativeTabs.Trigger = ({ name, children }: { name?: string; children?: React.ReactNode }) => {
    capturedTriggers.push({ name, children });
    return null;
  };

  NativeTabs.Trigger.TabBar = () => null;

  const Icon = () => null;
  const Label = () => null;
  const VectorIcon = () => null;

  return { NativeTabs, Icon, Label, VectorIcon };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

import TabLayout from '@/app/(tabs)/_layout';

describe('Tab isolation', () => {
  beforeEach(() => {
    capturedTriggers.length = 0;
  });

  it('uses native tab triggers for the four app tabs', () => {
    render(<TabLayout />);

    expect(capturedTriggers.map((trigger) => trigger.name)).toEqual([
      'explore',
      'index',
      'recent',
      'settings',
    ]);
  });
});