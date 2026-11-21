import { useEffect, useState } from 'react';
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

export function useNowPlaying(isActive: boolean) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(DEFAULT_NOW_PLAYING);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeRequest: AbortController | undefined;

    const fetchMetadata = async () => {
      const request = new AbortController();
      activeRequest = request;
      const timeout = setTimeout(() => request.abort(), 10000);
      try {
        const response = await fetch(
          'https://api-nowplaying.amperwave.net/api/v1/prtplus/nowplaying/1/2011/nowplaying.json',
          { headers: { Accept: 'application/json' }, signal: request.signal }
        );
        if (!response.ok) throw new Error(`Metadata request failed: ${response.status}`);
        const data = await response.json();
        const track = data?.performances?.[0];
        if (!track?.title && !track?.artist) throw new Error('Metadata response has no track');
        if (cancelled) return;

        const title = track.title || Station.name;
        const artist = track.artist || '';
        const artworkCandidate =
          normalizeArtworkUrl(track.largeimage) ||
          normalizeArtworkUrl(track.mediumimage) ||
          normalizeArtworkUrl(track.smallimage);
        setNowPlaying((previous) => {
          const artwork = artworkCandidate ||
            (previous.title === title && previous.artist === artist ? previous.artwork : Station.defaultArtwork);
          if (previous.title === title && previous.artist === artist && previous.artwork === artwork) return previous;
          return { title, artist, artwork };
        });
      } catch (error) {
        if (!cancelled) console.warn('[NowPlaying] Unable to refresh metadata:', error);
      } finally {
        clearTimeout(timeout);
        if (activeRequest === request) activeRequest = undefined;
        if (!cancelled) timer = setTimeout(fetchMetadata, 30000);
      }
    };

    void fetchMetadata();
    return () => {
      cancelled = true;
      activeRequest?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [isActive]);

  return nowPlaying;
}
