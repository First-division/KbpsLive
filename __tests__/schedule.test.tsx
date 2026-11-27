import { renderHook, waitFor } from '@testing-library/react-native';
import { bundledSchedule, parseSchedule } from '@/lib/schedule';
import { useSchedule } from '@/hooks/useSchedule';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockAbortSignal = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  scheduleCacheKey: 'schedule-test',
}));

const show = { id: 'one', name: 'Evening Music', day: 'Friday', time: '5 PM', icon: 'music' };

describe('schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ order: mockOrder, abortSignal: mockAbortSignal });
    mockAbortSignal.mockResolvedValue({ data: [show], error: null });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates remote and cached records without rejecting an empty schedule', () => {
    expect(parseSchedule([])).toEqual([]);
    expect(parseSchedule([show])).toEqual([show]);
    expect(() => parseSchedule([{ ...show, icon: 'bad' }])).toThrow();
    expect(() => parseSchedule([{ ...show, name: ' ' }])).toThrow();
    expect(() => parseSchedule(null)).toThrow();
  });

  it('fetches active shows in order and caches them', async () => {
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.shows).toEqual([show]));
    expect(mockFrom).toHaveBeenCalledWith('shows');
    expect(mockEq).toHaveBeenCalledWith('active', true);
    expect(mockOrder).toHaveBeenNthCalledWith(1, 'sort_order');
    expect(mockSetItem).toHaveBeenCalledWith('schedule-test', JSON.stringify([show]));
    expect(result.current.offline).toBe(false);
    await unmount();
  });

  it('retains the last cached schedule when the network fails', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([show]));
    mockAbortSignal.mockResolvedValue({ data: null, error: new Error('offline') });
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(result.current.shows).toEqual([show]);
    expect(mockSetItem).not.toHaveBeenCalled();
    await unmount();
  });

  it('uses the bundled schedule when cache and network are unavailable', async () => {
    mockGetItem.mockResolvedValue('{bad json');
    mockAbortSignal.mockResolvedValue({ data: null, error: new Error('offline') });
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(result.current.shows).toEqual(bundledSchedule);
    await unmount();
  });

  it('keeps an intentionally empty published schedule, including offline', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([]));
    mockAbortSignal.mockResolvedValue({ data: null, error: new Error('offline') });
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(result.current.shows).toEqual([]);
    await unmount();
  });

  it('caches an intentionally empty online schedule instead of restoring defaults', async () => {
    mockAbortSignal.mockResolvedValue({ data: [], error: null });
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(mockSetItem).toHaveBeenCalledWith('schedule-test', '[]'));
    expect(result.current.shows).toEqual([]);
    expect(result.current.offline).toBe(false);
    await unmount();
  });

  it('rejects malformed remote data without replacing the cache', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([show]));
    mockAbortSignal.mockResolvedValue({ data: [{ ...show, time: null }], error: null });
    const { result, unmount } = await renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(result.current.shows).toEqual([show]);
    expect(mockSetItem).not.toHaveBeenCalled();
    await unmount();
  });
});
