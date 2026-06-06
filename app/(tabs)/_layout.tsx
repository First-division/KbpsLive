import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, StyleSheet, Text as RNText, View as RNView } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { usePlaybackIndicator } from '@/hooks/useAudioStream';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { isPlaying, artworkUri } = usePlaybackIndicator();

  const renderLabel = (label: string) => {
    return ({ focused }: { focused: boolean }) => (
      <RNView style={styles.labelWrap}>
        <RNText
          style={[
            styles.labelText,
            { color: focused ? theme.tabIconSelected : theme.tabIconDefault },
          ]}
        >
          {label}
        </RNText>
        {isPlaying && label !== 'Live' ? (
          <Image source={{ uri: artworkUri }} style={styles.labelArtwork} />
        ) : null}
      </RNView>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: 'relative',
          backgroundColor: theme.card,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: renderLabel('Explore'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
          tabBarLabel: renderLabel('Live'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recent"
        options={{
          title: 'Recent',
          tabBarLabel: renderLabel('Recent'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: renderLabel('Settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelArtwork: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
