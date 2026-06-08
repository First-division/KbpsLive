import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Station } from '@/constants/Station';
import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { useFavoriteSongs } from '@/hooks/useFavoriteSongs';

const FALLBACK_ARTWORK_SOURCE = require('../../assets/images/icon.png');

function formatPlayedTime(isoString: string) {
  if (!isoString) return 'Recently played';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Recently played';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RecentScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { songs, loading, error, refresh } = useRecentlyPlayed();
  const { ready, favorites, favoriteIds, toggleFavorite } = useFavoriteSongs();
  const [failedArtworkIds, setFailedArtworkIds] = useState<Set<string>>(new Set());
  const fallbackArtworkUri = useMemo(() => Station.defaultArtwork.trim(), []);

  const getArtworkSource = (id: string, artwork?: string) => {
    const normalizedArtwork = artwork?.trim();
    const hasRealArtwork =
      Boolean(normalizedArtwork) && normalizedArtwork !== fallbackArtworkUri && !failedArtworkIds.has(id);

    return hasRealArtwork ? { uri: normalizedArtwork } : FALLBACK_ARTWORK_SOURCE;
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 12, 20) }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={[styles.topPill, { backgroundColor: theme.card, borderColor: theme.tabIconDefault }] }>
        <Text style={[styles.topPillText, { color: theme.text }]}>Recent</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recently Played</Text>

        {loading && songs.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={theme.tint} />
            <Text style={styles.stateText}>Loading songs...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {songs.map((song) => {
          const favored = favoriteIds.has(song.id);

          return (
            <View key={song.id} style={styles.songCard}>
              <Image
                source={getArtworkSource(song.id, song.artwork)}
                style={styles.songArt}
                onError={() => {
                  setFailedArtworkIds((previous) => {
                    if (previous.has(song.id)) {
                      return previous;
                    }

                    const next = new Set(previous);
                    next.add(song.id);
                    return next;
                  });
                }}
              />

              <View style={styles.songMeta}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artist}
                </Text>
                <Text style={styles.songTime}>{formatPlayedTime(song.playedAt)}</Text>
              </View>

              <Pressable
                testID={`recent-favorite-${song.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Toggle favorite for ${song.title}`}
                style={({ pressed }) => [styles.favoriteButton, pressed && styles.favoriteButtonPressed]}
                onPress={() => toggleFavorite(song)}
              >
                <Ionicons
                  name={favored ? 'heart' : 'heart-outline'}
                  size={24}
                  color={favored ? '#E4405F' : theme.tabIconDefault}
                />
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Favorites</Text>
        {!ready ? (
          <Text style={styles.stateText}>Loading favorites...</Text>
        ) : favorites.length === 0 ? (
          <Text style={styles.stateText}>Tap the heart on any song to save it.</Text>
        ) : (
          favorites.map((song) => (
            <View key={`fav-${song.id}`} style={styles.favoriteRow}>
              <Ionicons name="heart" size={14} color="#E4405F" />
              <Text style={styles.favoriteText} numberOfLines={1}>
                {song.artist} - {song.title}
              </Text>
            </View>
          ))
        )}
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
  centerState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  stateText: {
    fontSize: 14,
    opacity: 0.7,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 8,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  songArt: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  songMeta: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: 'transparent',
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  songArtist: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 2,
  },
  songTime: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 2,
  },
  favoriteButton: {
    padding: 6,
  },
  favoriteButtonPressed: {
    opacity: 0.6,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  favoriteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
