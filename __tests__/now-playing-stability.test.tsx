import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { Station } from '@/constants/Station';

describe('now playing metadata stability', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the last track on failures and missing artwork, but resets artwork for a new track', async () => {
    const track = { title: 'Song', artist: 'Artist', largeimage: 'https://example.com/art.jpg' };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ performances: [track] }) })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ performances: [{ title: 'Song', artist: 'Artist' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ performances: [{ title: 'Next', artist: 'Artist' }] }) });
    global.fetch = fetchMock;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let latest: ReturnType<typeof useNowPlaying> | undefined;
    function Harness() {
      latest = useNowPlaying(true);
      return null;
    }
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    expect(latest?.artwork).toBe(track.largeimage);
    await act(async () => { await jest.advanceTimersByTimeAsync(30000); });
    expect(latest?.title).toBe('Song');
    expect(latest?.artwork).toBe(track.largeimage);
    expect(warning).toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(30000); });
    expect(latest?.artwork).toBe(track.largeimage);
    await act(async () => { await jest.advanceTimersByTimeAsync(30000); });
    expect(latest?.title).toBe('Next');
    expect(latest?.artwork).toBe(Station.defaultArtwork);
    await act(async () => { renderer!.unmount(); });
  });
});
