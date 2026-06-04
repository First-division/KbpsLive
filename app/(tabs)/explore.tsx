import { StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Station } from '@/constants/Station';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  child: 'people',
  microphone: 'mic',
  star: 'star',
  music: 'musical-notes',
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 16) }]}
    >
      <View style={[styles.topPill, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
        <Text style={[styles.topPillText, { color: theme.text }]}>Explore</Text>
      </View>

      {/* Schedule Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Show Schedule</Text>
        {Station.schedule.map((show, i) => (
          <View key={i} style={styles.showCard}>
            <View style={styles.showIconContainer}>
              <Ionicons
                name={ICON_MAP[show.icon] || 'radio'}
                size={22}
                color={theme.tint}
              />
            </View>
            <View style={styles.showInfo}>
              <Text style={styles.showName}>{show.name}</Text>
              <Text style={styles.showTime}>{show.day} · {show.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* News & Content Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>News & Interviews</Text>

        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          onPress={() => Linking.openURL(Station.links.news)}
        >
          <Ionicons name="newspaper" size={22} color={theme.tint} />
          <Text style={styles.linkText}>KBPS News</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.tabIconDefault} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          onPress={() => Linking.openURL(Station.links.interviews)}
        >
          <Ionicons name="chatbubbles" size={22} color={theme.tint} />
          <Text style={styles.linkText}>Interviews</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.tabIconDefault} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          onPress={() => Linking.openURL(Station.links.youtube)}
        >
          <Ionicons name="logo-youtube" size={22} color="#FF0000" />
          <Text style={styles.linkText}>KBPS on YouTube</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.tabIconDefault} />
        </Pressable>
      </View>

      {/* Song Request */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Song Requests</Text>
        <Pressable
          style={({ pressed }) => [styles.requestCard, pressed && styles.linkCardPressed]}
          onPress={() => Linking.openURL(`tel:${Station.phone}`)}
        >
          <Ionicons name="call" size={24} color="#fff" />
          <Text style={styles.requestText}>Call {Station.phoneDisplay}</Text>
        </Pressable>
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
  showCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  showIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
  },
  showInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  showName: {
    fontSize: 16,
    fontWeight: '600',
  },
  showTime: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  linkCardPressed: {
    opacity: 0.6,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1a73e8',
    gap: 10,
  },
  requestText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
