import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { getOptionalUpdatesModule } from '@/components/optional-updates';

type GuideStep = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: string;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    icon: 'radio-outline',
    title: 'Listen live',
    body: 'Use the Live tab to start KBPS streaming, see the current track, and keep the station close at hand.',
    accent: '#4ADE80',
  },
  {
    icon: 'time-outline',
    title: 'Catch up quickly',
    body: 'Recent shows you what played most recently so you can jump back into the flow without hunting around.',
    accent: '#38BDF8',
  },
  {
    icon: 'sparkles-outline',
    title: 'Tune the experience',
    body: 'Explore and Settings let you switch appearance, check station details, and open this guide again later.',
    accent: '#F59E0B',
  },
];

export default function WelcomeModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updates = !__DEV__ ? getOptionalUpdatesModule() : null;
  const currentUpdateId = updates?.isEnabled ? updates.updateId : null;

  const handleFinish = async () => {
    const entries: Array<[string, string]> = [[LAUNCH_STORAGE_KEYS.welcomeCompleted, 'true']];

    if (currentUpdateId) {
      entries.push([LAUNCH_STORAGE_KEYS.lastSeenUpdateId, currentUpdateId]);
    }

    await Promise.all(entries.map(([key, value]) => AsyncStorage.setItem(key, value)));

    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}> 
      <View style={styles.backdrop} />
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 10, 20),
            paddingBottom: Math.max(insets.bottom + 14, 20),
          },
        ]}
      >
        <View style={styles.header}> 
          <View style={[styles.badge, { borderColor: theme.tabIconDefault, backgroundColor: theme.card }]}> 
            <Text style={[styles.badgeText, { color: theme.text }]}>Welcome to KBPS Live</Text>
          </View>
          <Text style={styles.title}>Everything you need to listen, catch up, and keep KBPS close.</Text>
          <Text style={[styles.subtitle, { color: theme.tabIconDefault }]}>This quick tour explains the parts of the app that matter most, then gets out of your way.</Text>
        </View>

        <View style={styles.steps}>
          {GUIDE_STEPS.map((step) => (
            <View key={step.title} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}> 
              <View style={[styles.iconWrap, { backgroundColor: step.accent }]}> 
                <Ionicons name={step.icon} size={22} color="#0B0B0B" />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{step.title}</Text>
                <Text style={[styles.cardBody, { color: theme.tabIconDefault }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}> 
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => void handleFinish()}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <Text style={[styles.footerNote, { color: theme.tabIconDefault }]}>You can reopen the guide from Settings any time.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: -40,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(72, 187, 120, 0.18)',
  },
  header: {
    gap: 8,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  steps: {
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    gap: 8,
    marginTop: 'auto',
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.72,
  },
});