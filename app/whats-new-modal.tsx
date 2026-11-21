import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { ModalHeader } from '@/components/modal-header';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { LAUNCH_STORAGE_KEYS } from '@/constants/LaunchState';
import { WHATS_NEW_CONTENT } from '@/constants/whats-new';
import { getOptionalUpdatesModule } from '@/components/optional-updates';

function SectionList({ title, items }: { title: string; items: string[] }) {
  const theme = Colors[useColorScheme()];

  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}>
        {items.map((item) => (
          <View key={item} style={styles.itemRow}>
            <Ionicons name="checkmark-circle" size={20} color="#1A73E8" />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

export default function WhatsNewModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = Colors[useColorScheme()];
  const [isClosing, setIsClosing] = useState(false);
  const updates = !__DEV__ ? getOptionalUpdatesModule() : null;
  const currentUpdateId = updates?.isEnabled ? updates.updateId : null;

  const handleClose = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      if (currentUpdateId) {
        await AsyncStorage.setItem(LAUNCH_STORAGE_KEYS.lastSeenUpdateId, currentUpdateId);
      }
      router.back();
    } catch (error) {
      console.error('Unable to save the seen update:', error);
      Alert.alert('Unable to close', 'Could not save your update status. Please try again.');
      setIsClosing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ModalHeader
        title="What's New"
        closeLabel="Close what's new"
        onClose={() => void handleClose()}
        disabled={isClosing}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
        <View style={[styles.introCard, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles-outline" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{WHATS_NEW_CONTENT.title}</Text>
          <Text style={[styles.description, { color: theme.tabIconDefault }]}>
            Highlights from version {WHATS_NEW_CONTENT.releaseLabel}.
          </Text>
          <Text style={styles.itemText}>{WHATS_NEW_CONTENT.subtitle}</Text>
        </View>
        <SectionList title="New Features" items={WHATS_NEW_CONTENT.features} />
        <SectionList title="Bug Fixes" items={WHATS_NEW_CONTENT.bugFixes} />
        <Text style={styles.sectionTitle}>Guide Tip</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }]}>
          <Text style={styles.itemText}>{WHATS_NEW_CONTENT.guideTip}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  introCard: { padding: 20, borderRadius: 18, borderWidth: 1, gap: 10 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A73E8' },
  title: { fontSize: 24, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 19, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'transparent' },
  itemText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
