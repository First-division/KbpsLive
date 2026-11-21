import { createLiveActivityController, type LiveActivityBridge } from '@/components/live-activity-controller';

const content = {
  title: 'Song',
  subtitle: 'Artist',
  stationName: 'KBPS',
  artwork: 'artwork',
  isLive: true,
  waveformLevel: 0.42,
};

function createBridge(): jest.Mocked<LiveActivityBridge> {
  return {
    areActivitiesEnabled: jest.fn(() => true),
    startActivity: jest.fn(async () => 'requested'),
    updateActivity: jest.fn(async () => 'updated'),
    endActivity: jest.fn(async () => 'ended'),
  };
}

describe('Live Activity controller', () => {
  it('cleans up an existing activity on an idle launch', async () => {
    const bridge = createBridge();
    await createLiveActivityController(bridge).setContent(null);
    expect(bridge.endActivity).toHaveBeenCalledTimes(1);
  });

  it('ends immediately when playback stops and restarts for the same song', async () => {
    const bridge = createBridge();
    const controller = createLiveActivityController(bridge);
    await controller.setContent(content);
    await controller.setContent(null);
    await controller.setContent(content);
    expect(bridge.endActivity).toHaveBeenCalledTimes(1);
    expect(bridge.startActivity).toHaveBeenCalledTimes(2);
  });

  it('waits for an in-flight start before ending to avoid orphaning an activity', async () => {
    const bridge = createBridge();
    let finishStart: (value: string) => void = () => undefined;
    bridge.startActivity.mockImplementationOnce(() => new Promise((resolve) => { finishStart = resolve; }));
    const controller = createLiveActivityController(bridge);
    const start = controller.setContent(content);
    await Promise.resolve();
    const stop = controller.setContent(null);
    expect(bridge.endActivity).not.toHaveBeenCalled();
    finishStart('requested');
    await Promise.all([start, stop]);
    expect(bridge.endActivity).toHaveBeenCalledTimes(1);
  });

  it('avoids repeated updates for identical song details', async () => {
    const bridge = createBridge();
    const controller = createLiveActivityController(bridge);
    await controller.setContent(content);
    await controller.setContent(content);
    expect(bridge.startActivity).toHaveBeenCalledTimes(1);
    await controller.setContent({ ...content, title: 'Next song' });
    expect(bridge.startActivity).toHaveBeenCalledTimes(2);
  });

  it('updates waveform level without restarting the activity', async () => {
    const bridge = createBridge();
    const controller = createLiveActivityController(bridge);
    await controller.setContent(content);
    await controller.setContent({ ...content, waveformLevel: 0.9 });
    expect(bridge.startActivity).toHaveBeenCalledTimes(1);
    expect(bridge.updateActivity).toHaveBeenCalledTimes(1);
  });

  it('reports native errors and can retry', async () => {
    const bridge = createBridge();
    bridge.startActivity.mockResolvedValueOnce('start-error: denied');
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const controller = createLiveActivityController(bridge);
      await controller.setContent(content);
      expect(warning).toHaveBeenCalled();
      await controller.setContent(content);
      expect(bridge.startActivity).toHaveBeenCalledTimes(2);
    } finally {
      warning.mockRestore();
    }
  });
});
