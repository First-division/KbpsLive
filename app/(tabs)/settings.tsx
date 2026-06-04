import { StyleSheet, ScrollView, Pressable, Linking, Appearance, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useThemeMode, type ThemePreference } from '@/components/theme-mode';
import Colors from '@/constants/Colors';
import { Station } from '@/constants/Station';

interface LinkRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  url: string;
}

type ThemeNativeModule = {
  getSystemColorScheme?: () => Promise<unknown> | unknown;
};

function LinkRow({ icon, iconColor = '#1a73e8', label, url }: LinkRowProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => Linking.openURL(url)}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={theme.tabIconDefault} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { preference, setPreference } = useThemeMode();
  const [nativeScheme, setNativeScheme] = useState<string>('n/a');
  const [jsScheme, setJsScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const themeNativeModule = useMemo(
    () => (Platform.OS === 'ios'
      ? requireOptionalNativeModule<ThemeNativeModule>('ReactNativeWidgetExtension')
      : null),
    []
  );

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    let mounted = true;
    const refresh = async () => {
      const nextJs = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
      if (mounted) {
        setJsScheme(nextJs);
      }

      if (!themeNativeModule?.getSystemColorScheme) {
        if (mounted) {
          setNativeScheme('missing-module');
        }
        return;
      }

      try {
        const result = await Promise.resolve(themeNativeModule.getSystemColorScheme());
        const normalized = result === 'dark' || result === 'light' ? result : 'unexpected-value';
        if (mounted) {
          setNativeScheme(normalized);
        }
      } catch {
        if (mounted) {
          setNativeScheme('call-failed');
        }
      }
    };

    void refresh();
    const appearanceSub = Appearance.addChangeListener(() => {
      void refresh();
    });
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    const timer = setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      mounted = false;
      appearanceSub.remove();
      appStateSub.remove();
      clearInterval(timer);
    };
  }, [themeNativeModule]);

  const appearanceOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 16) }]}
    >
      <View style={[styles.topPill, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
        <Text style={[styles.topPillText, { color: theme.text }]}>Settings</Text>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutName}>{Station.name}</Text>
          <Text style={styles.aboutTagline}>{Station.tagline}</Text>
          <Text style={styles.aboutDetail}>{Station.location}</Text>
          <Text style={styles.aboutDetail}>{Station.address}</Text>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={[styles.appearanceWrap, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
          {appearanceOptions.map((option) => {
            const selected = preference === option.value;
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.appearanceOption,
                  {
                    backgroundColor: selected ? theme.tint : 'transparent',
                    borderColor: selected ? theme.tint : theme.tabIconDefault,
                  },
                  pressed && styles.rowPressed,
                ]}
                onPress={() => setPreference(option.value)}
              >
                <Text
                  style={[
                    styles.appearanceOptionText,
                    { color: selected ? theme.background : theme.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {__DEV__ ? (
          <Text style={[styles.appearanceDebug, { color: theme.tabIconDefault }]}>native:{nativeScheme} js:{jsScheme} resolved:{colorScheme} pref:{preference}</Text>
        ) : null}
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => Linking.openURL(`tel:${Station.phone}`)}
        >
          <Ionicons name="call" size={22} color="#34C759" />
          <Text style={styles.rowLabel}>{Station.phoneDisplay}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.tabIconDefault} />
        </Pressable>
        <LinkRow icon="globe" label="KBPS Website" url={Station.links.website} />
      </View>

      {/* Social Media */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Media</Text>
        <LinkRow icon="logo-facebook" iconColor="#1877F2" label="Facebook" url={Station.links.facebook} />
        <LinkRow icon="logo-instagram" iconColor="#E4405F" label="Instagram" url={Station.links.instagram} />
        <LinkRow icon="logo-twitter" iconColor="#1DA1F2" label="Twitter" url={Station.links.twitter} />
        <LinkRow icon="logo-youtube" iconColor="#FF0000" label="YouTube" url={Station.links.youtube} />
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support KBPS</Text>
        <Pressable
          style={({ pressed }) => [styles.donateButton, pressed && styles.rowPressed]}
          onPress={() => Linking.openURL(Station.links.donate)}
        >
          <Ionicons name="heart" size={22} color="#fff" />
          <Text style={styles.donateText}>Donate to KBPS</Text>
        </Pressable>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.versionText}>KbpsLive v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topPill: {
    alignSelf: 'center',
    backgroundColor: '#121212',
    borderColor: '#2b2b2b',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 20,
  },
  topPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  section: {
    marginBottom: 28,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  aboutCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  aboutName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  aboutTagline: {
    fontSize: 15,
    opacity: 0.7,
    marginBottom: 12,
  },
  aboutDetail: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
  },
  appearanceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    gap: 6,
    backgroundColor: 'transparent',
  },
  appearanceOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  appearanceOptionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  appearanceDebug: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#E4405F',
    gap: 10,
  },
  donateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.4,
  },
});
