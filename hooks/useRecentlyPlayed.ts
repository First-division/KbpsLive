import { useCallback, useEffect, useState } from 'react';
import { Station } from '@/constants/Station';

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  playedAt: string;
}

interface ApiTrack {
  id?: number;
  title?: string;
  artist?: string;
  time?: string;
  largeimage?: string;
  mediumimage?: string;
  smallimage?: string;
}

const RECENTLY_PLAYED_URL =
  'https://api-nowplaying.amperwave.net/api/v1/prtplus/nowplaying/20/2011/nowplaying.json';

function normalizeArtworkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }

  if (trimmed.startsWith('https://')) {
    return trimmed;
  }

  return undefined;
}

export function useRecentlyPlayed() {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentlyPlayed = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(RECENTLY_PLAYED_URL, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recently played (${response.status})`);
      }

      const data = await response.json();
      const performances: ApiTrack[] = Array.isArray(data?.performances)
        ? data.performances
        : [];

      const mapped: SongItem[] = performances
        .filter((track) => track?.title || track?.artist)
        .map((track) => ({
          id: String(track.id ?? `${track.time ?? ''}-${track.artist ?? ''}-${track.title ?? ''}`),
          title: track.title || 'Unknown Title',
          artist: track.artist || 'Unknown Artist',
          artwork:
            normalizeArtworkUrl(track.largeimage) ||
            normalizeArtworkUrl(track.mediumimage) ||
            normalizeArtworkUrl(track.smallimage) ||
            Station.defaultArtwork,
          playedAt: track.time || '',
        }));

      setSongs(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load recently played songs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentlyPlayed();
    const interval = setInterval(fetchRecentlyPlayed, 60000);
    return () => clearInterval(interval);
  }, [fetchRecentlyPlayed]);

  return { songs, loading, error, refresh: fetchRecentlyPlayed };
}
