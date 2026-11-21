import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export function ModalHeader({
  title,
  closeLabel,
  onClose,
  disabled = false,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = Colors[useColorScheme()];

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), backgroundColor: theme.card }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        disabled={disabled}
        onPress={onClose}
        style={styles.closeButton}
      >
        <Text style={[styles.closeText, disabled && styles.disabled]}>Close</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  closeButton: { width: 60, paddingVertical: 8 },
  closeText: { color: '#1A73E8', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 60, backgroundColor: 'transparent' },
});
