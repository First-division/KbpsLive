import { useEffect, useState, useRef, useCallback } from 'react';
import { Station } from '@/constants/Station';

interface NowPlaying {
  title: string;
  artist: string;
  artwork: string;
}

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

const DEFAULT_NOW_PLAYING: NowPlaying = {
  title: Station.name,
  artist: Station.tagline,
  artwork: Station.defaultArtwork,
};

// Poll the Amperwave stream metadata for now-playing info
// The direct stream returns ICY metadata headers; we try a lightweight approach
// by hitting the stream with a range request to extract metadata.
// Fallback: just show station name.

export function useNowPlaying(isPlaying: boolean) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(DEFAULT_NOW_PLAYING);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api-nowplaying.amperwave.net/api/v1/prtplus/nowplaying/1/2011/nowplaying.json`,
        { headers: { Accept: 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const track = data?.performances?.[0];
        if (track?.title || track?.artist) {
          const artworkCandidate =
            normalizeArtworkUrl(track.largeimage) ||
            normalizeArtworkUrl(track.mediumimage) ||
            normalizeArtworkUrl(track.smallimage);

          setNowPlaying({
            title: track.title || Station.name,
            artist: track.artist || '',
            artwork: artworkCandidate || Station.defaultArtwork,
          });
          return;
        }
      }
    } catch {
      // Endpoint may not exist — that's fine, use defaults
    }

    // Fallback: keep defaults
    setNowPlaying(DEFAULT_NOW_PLAYING);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      fetchMetadata();
      intervalRef.current = setInterval(fetchMetadata, 30000); // poll every 30s
    } else {
      setNowPlaying(DEFAULT_NOW_PLAYING);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, fetchMetadata]);

  return nowPlaying;
}
