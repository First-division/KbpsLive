import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { ModalHeader } from '@/components/modal-header';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const GUIDE_TOPICS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tips: string[];
}[] = [
  {
    label: 'Live',
    icon: 'radio-outline',
    title: 'Listen to KBPS',
    description: 'Listen to the live station and see what is playing.',
    tips: [
      'Tap the play button to start or pause the stream.',
      'The song title, artist, and artwork appear when available.',
      'On iPhone, use AirPlay to choose an available audio output.',
      'Playback can continue while you use other apps or lock your device.',
      'On iOS, use the system Now Playing controls on the Lock Screen or Dynamic Island to control the live stream.',
    ],
  },
  {
    label: 'Recent',
    icon: 'time-outline',
    title: 'Recently played',
    description: 'Look back at tracks played on the station.',
    tips: [
      'Pull down on the list to refresh it.',
      'Tap a heart to save a song to Your Favorites. Tap it again to remove it.',
      'Favorites are saved on this device.',
    ],
  },
  {
    label: 'Explore',
    icon: 'compass-outline',
    title: 'Explore KBPS',
    description: 'Find station programming and more from KBPS.',
    tips: [
      'Browse the show schedule, news, interviews, and YouTube links.',
      'Use the song request button to call the station.',
    ],
  },
  {
    label: 'Settings',
    icon: 'settings-outline',
    title: 'Make it yours',
    description: 'Adjust the app and stay connected with the station.',
    tips: [
      'Choose a light, dark, or system appearance.',
      'Find station contact details, social links, and the donation link.',
      'Reopen this guide or check What’s New from Settings.',
    ],
  },
];

export default function AppGuide() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = Colors[useColorScheme()];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const topic = GUIDE_TOPICS[selectedIndex];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ModalHeader title="App Guide" closeLabel="Close app guide" onClose={() => router.back()} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.topicScroller}
        contentContainerStyle={styles.topics}
      >
        {GUIDE_TOPICS.map((item, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setSelectedIndex(index)}
              style={[
                styles.topicButton,
                { backgroundColor: selected ? '#1A73E8' : theme.card, borderColor: selected ? '#1A73E8' : theme.tabIconDefault },
              ]}
            >
              <Text style={[styles.topicLabel, { color: selected ? '#FFFFFF' : theme.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        <View style={[styles.introCard, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}>
          <View style={styles.iconWrap}>
            <Ionicons name={topic.icon} size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{topic.title}</Text>
          <Text style={[styles.description, { color: theme.tabIconDefault }]}>{topic.description}</Text>
        </View>
        <Text style={styles.sectionTitle}>How to use it</Text>
        <View style={[styles.tipsCard, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}>
          {topic.tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={20} color="#1A73E8" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topicScroller: { flexGrow: 0 },
  topics: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  topicButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  topicLabel: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  introCard: { padding: 20, borderRadius: 18, borderWidth: 1, gap: 10 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A73E8' },
  title: { fontSize: 24, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 19, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  tipsCard: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'transparent' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
