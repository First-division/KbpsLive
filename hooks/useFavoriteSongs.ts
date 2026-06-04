import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SongItem } from '@/hooks/useRecentlyPlayed';

const STORAGE_KEY = 'kbpslive:favorites:v1';

export function useFavoriteSongs() {
  const [favorites, setFavorites] = useState<SongItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (!raw) {
          setFavorites([]);
          return;
        }

        const parsed = JSON.parse(raw);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (mounted) {
          setFavorites([]);
        }
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: SongItem[]) => {
    setFavorites(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep in-memory state even if persistence fails.
    }
  }, []);

  const isFavorite = useCallback(
    (songId: string) => favorites.some((item) => item.id === songId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (song: SongItem) => {
      const exists = favorites.some((item) => item.id === song.id);
      const next = exists
        ? favorites.filter((item) => item.id !== song.id)
        : [song, ...favorites];
      await persist(next);
    },
    [favorites, persist]
  );

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  return {
    ready,
    favorites,
    favoriteIds,
    isFavorite,
    toggleFavorite,
  };
}
