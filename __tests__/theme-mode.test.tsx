import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';

import { ThemeModeProvider, useThemeMode } from '@/components/theme-mode';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

function ThemeProbe() {
  const { colorScheme, preference, setPreference } = useThemeMode();

  return (
    <>
      <Text testID="theme-scheme">{colorScheme}</Text>
      <Text testID="theme-preference">{preference}</Text>
      <Pressable testID="set-light" onPress={() => setPreference('light')}>
        <Text>Set Light</Text>
      </Pressable>
    </>
  );
}

describe('Theme mode', () => {
  it('defaults to dark and updates preference through the provider', () => {
    const { getByTestId, getByText } = render(
      <ThemeModeProvider>
        <ThemeProbe />
      </ThemeModeProvider>
    );

    expect(getByTestId('theme-scheme').props.children).toBe('dark');
    expect(getByTestId('theme-preference').props.children).toBe('dark');

    fireEvent.press(getByText('Set Light'));

    expect(getByTestId('theme-scheme').props.children).toBe('light');
    expect(getByTestId('theme-preference').props.children).toBe('light');
  });
});