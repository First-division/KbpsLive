export type LiveActivityBridge = {
  areActivitiesEnabled: () => boolean;
  startActivity: (
    title: string,
    subtitle: string,
    stationName: string,
    artwork: string,
    isLive: boolean,
    waveformLevel: number
  ) => Promise<string> | string;
  updateActivity?: (
    title: string,
    subtitle: string,
    isLive: boolean,
    artwork: string,
    waveformLevel: number
  ) => Promise<string> | string;
  endActivity: () => Promise<string> | string;
};

export type LiveActivityContent = {
  title: string;
  subtitle: string;
  stationName: string;
  artwork: string;
  isLive: boolean;
  waveformLevel: number;
};

export function createLiveActivityController(bridge: LiveActivityBridge) {
  let queue = Promise.resolve();
  let revision = 0;
  let previousKey: string | null = null;
  let previousWaveformBucket: number | null = null;

  const clampWaveform = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  };

  const waveformBucket = (value: number) => Math.round(clampWaveform(value) * 20);

  function setContent(content: LiveActivityContent | null) {
    const request = ++revision;
    queue = queue.then(async () => {
      if (request !== revision) return;

      if (!content) {
        const result = await bridge.endActivity();
        if (result.startsWith('end-error:')) throw new Error(result);
        previousKey = null;
        previousWaveformBucket = null;
        return;
      }

      if (!bridge.areActivitiesEnabled()) return;
      const key = JSON.stringify({
        title: content.title,
        subtitle: content.subtitle,
        stationName: content.stationName,
        artwork: content.artwork,
        isLive: content.isLive,
      });
      const clampedWaveform = clampWaveform(content.waveformLevel);
      const nextWaveformBucket = waveformBucket(clampedWaveform);

      if (key === previousKey && nextWaveformBucket === previousWaveformBucket) return;

      const startOrUpdate = async () => {
        const result = await bridge.startActivity(
          content.title,
          content.subtitle,
          content.stationName,
          content.artwork,
          content.isLive,
          clampedWaveform
        );
        if (result.startsWith('start-error:')) throw new Error(result);
      };

      if (key !== previousKey || !bridge.updateActivity) {
        await startOrUpdate();
      } else {
        const result = await bridge.updateActivity(
          content.title,
          content.subtitle,
          content.isLive,
          content.artwork,
          clampedWaveform
        );

        if (result === 'no-activity') {
          await startOrUpdate();
        } else if (result.startsWith('update-error:')) {
          throw new Error(result);
        }
      }

      previousKey = key;
      previousWaveformBucket = nextWaveformBucket;
    }).catch((error: unknown) => {
      console.warn('[LiveActivity] Unable to update activity:', error);
    });
    return queue;
  }

  return { setContent };
}
