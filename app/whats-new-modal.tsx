import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { WHATS_NEW_CONTENT } from '@/constants/whats-new';
import { getOptionalUpdatesModule } from '@/components/optional-updates';

function SectionList({
  title,
  icon,
  items,
  accent,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  accent: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: accent }]}>
          <Ionicons name={icon} size={18} color="#0B0B0B" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.bulletList}>
        {items.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: accent }]} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function WhatsNewModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updates = !__DEV__ ? getOptionalUpdatesModule() : null;
  const currentUpdateId = updates?.isEnabled ? updates.updateId : null;

  const handleContinue = async () => {
    if (currentUpdateId) {
      await AsyncStorage.setItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId, currentUpdateId);
    }

    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}> 
      <View style={styles.topGlow} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: Math.max(insets.top + 16, 22), paddingBottom: Math.max(insets.bottom + 24, 30) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badge, { borderColor: theme.tabIconDefault, backgroundColor: theme.card }]}> 
          <Text style={[styles.badgeText, { color: theme.text }]}>Update Installed</Text>
        </View>

        <Text style={styles.title}>{WHATS_NEW_CONTENT.title}</Text>
        <Text style={[styles.subtitle, { color: theme.tabIconDefault }]}>Highlights from version {WHATS_NEW_CONTENT.releaseLabel}.</Text>

        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}> 
          <Text style={styles.summaryLabel}>{WHATS_NEW_CONTENT.subtitle}</Text>
          <Text style={[styles.summaryCopy, { color: theme.tabIconDefault }]}>The app now has a clearer first-run guide and a real update surface for new releases.</Text>
        </View>

        <SectionList
          title="New Features"
          icon="sparkles-outline"
          items={WHATS_NEW_CONTENT.features}
          accent="#4ADE80"
        />

        <SectionList
          title="Bug Fixes"
          icon="construct-outline"
          items={WHATS_NEW_CONTENT.bugFixes}
          accent="#38BDF8"
        />

        <View style={[styles.tipCard, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}> 
          <View style={[styles.tipIcon, { backgroundColor: '#F59E0B' }]}> 
            <Ionicons name="compass-outline" size={18} color="#0B0B0B" />
          </View>
          <View style={styles.tipCopy}>
            <Text style={styles.sectionTitle}>Guide Tip</Text>
            <Text style={[styles.tipText, { color: theme.tabIconDefault }]}>{WHATS_NEW_CONTENT.guideTip}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 18, 24) }]}> 
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => void handleContinue()}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
  },
  scroll: {
    flex: 1,
  },
  topGlow: {
    position: 'absolute',
    top: -60,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tipCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipCopy: {
    flex: 1,
    gap: 6,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingTop: 10,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
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
  pressed: {
    opacity: 0.72,
  },
});