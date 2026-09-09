import { renderHook, act } from '@testing-library/react';
import { usePlayerEngine } from './usePlayerEngine';
import { usePlayerStore } from '../stores/playerStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    log: vi.fn(),
    getImageUrl: vi.fn(() => 'http://example.com/art.jpg'),
  },
}));

const makeAudioRef = () => {
  const audio = document.createElement('audio');
  Object.defineProperty(audio, 'currentTime', { writable: true, value: 0 });
  Object.defineProperty(audio, 'duration', { writable: true, value: 0 });
  return { current: audio };
};

beforeEach(() => {
  usePlayerStore.setState({
    audioElementA: null, audioElementB: null, activeSlot: 'a',
    currentTrack: null, currentTime: 0, duration: 0, isPlaying: false, isBuffering: false,
    nextTrackIndex: -1, playlist: [],
  });
  vi.clearAllMocks();
});

test('binds both audio elements into the store on mount', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  expect(usePlayerStore.getState().audioElementA).toBe(audioRefA.current);
  expect(usePlayerStore.getState().audioElementB).toBe(audioRefB.current);
});

test('unbinds both audio elements on unmount', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const { unmount } = renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  unmount();
  expect(usePlayerStore.getState().audioElementA).toBeNull();
  expect(usePlayerStore.getState().audioElementB).toBeNull();
});

test('play/pause DOM events on the active element update isPlaying', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefA.current.dispatchEvent(new Event('play'));
  expect(usePlayerStore.getState().isPlaying).toBe(true);
  audioRefA.current.dispatchEvent(new Event('pause'));
  expect(usePlayerStore.getState().isPlaying).toBe(false);
});

test('play DOM events on the standby element are ignored', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefB.current.dispatchEvent(new Event('play'));
  expect(usePlayerStore.getState().isPlaying).toBe(false);
});

test('a stray play on the standby element is paused immediately, regardless of what caused it', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const pauseSpy = vi.spyOn(audioRefB.current, 'pause');
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefB.current.dispatchEvent(new Event('play'));
  expect(pauseSpy).toHaveBeenCalled();
});

test('waiting/playing DOM events on the active element toggle isBuffering', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefA.current.dispatchEvent(new Event('waiting'));
  expect(usePlayerStore.getState().isBuffering).toBe(true);
  audioRefA.current.dispatchEvent(new Event('playing'));
  expect(usePlayerStore.getState().isBuffering).toBe(false);
});

test('waiting DOM events on the standby element do not affect isBuffering', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefB.current.dispatchEvent(new Event('waiting'));
  expect(usePlayerStore.getState().isBuffering).toBe(false);
});

test('ended on the active element calls playNext', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const playNext = vi.fn();
  usePlayerStore.setState({ playNext });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefA.current.dispatchEvent(new Event('ended'));
  expect(playNext).toHaveBeenCalled();
});

test('ended on the standby element does not call playNext', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const playNext = vi.fn();
  usePlayerStore.setState({ playNext });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  audioRefB.current.dispatchEvent(new Event('ended'));
  expect(playNext).not.toHaveBeenCalled();
});

test('after activeSlot flips to b, events are read from B, not A', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  usePlayerStore.setState({ activeSlot: 'b' });
  audioRefB.current.dispatchEvent(new Event('play'));
  expect(usePlayerStore.getState().isPlaying).toBe(true);
  usePlayerStore.setState({ isPlaying: false });
  audioRefA.current.dispatchEvent(new Event('play'));
  expect(usePlayerStore.getState().isPlaying).toBe(false);
});

test('timeupdate fires apiService.log once the 5-second mark is crossed, and only once', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  usePlayerStore.setState({ currentTrack: { id: 42 } });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));

  audioRefA.current.currentTime = 3;
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(apiService.log).not.toHaveBeenCalled();

  audioRefA.current.currentTime = 6;
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(apiService.log).toHaveBeenCalledWith(42);

  audioRefA.current.currentTime = 7;
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(apiService.log).toHaveBeenCalledTimes(1);
});

test('a fresh play resets the 5-second mark so it fires again on the next track', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  usePlayerStore.setState({ currentTrack: { id: 1 } });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));

  audioRefA.current.currentTime = 6;
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(apiService.log).toHaveBeenCalledTimes(1);

  usePlayerStore.setState({ currentTrack: { id: 2 } });
  audioRefA.current.dispatchEvent(new Event('play'));
  audioRefA.current.currentTime = 6;
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(apiService.log).toHaveBeenCalledWith(2);
  expect(apiService.log).toHaveBeenCalledTimes(2);
});

test('timeupdate within the last 15s of the active track triggers a standby prefetch', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const ensureStandbyLoaded = vi.fn();
  usePlayerStore.setState({ ensureStandbyLoaded });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));

  audioRefA.current.duration = 180;
  audioRefA.current.currentTime = 170; // 10s remaining
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(ensureStandbyLoaded).toHaveBeenCalled();
});

test('timeupdate outside the last 15s does not trigger a standby prefetch', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  const ensureStandbyLoaded = vi.fn();
  usePlayerStore.setState({ ensureStandbyLoaded });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));

  audioRefA.current.duration = 180;
  audioRefA.current.currentTime = 50; // 130s remaining
  audioRefA.current.dispatchEvent(new Event('timeupdate'));
  expect(ensureStandbyLoaded).not.toHaveBeenCalled();
});

test('a nextTrackIndex change while within the prefetch window re-targets the standby load', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  audioRefA.current.duration = 180;
  audioRefA.current.currentTime = 170; // already within the last 15s
  const ensureStandbyLoaded = vi.fn();
  usePlayerStore.setState({ ensureStandbyLoaded, nextTrackIndex: 1 });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  ensureStandbyLoaded.mockClear();

  act(() => usePlayerStore.setState({ nextTrackIndex: 2 }));
  expect(ensureStandbyLoaded).toHaveBeenCalled();
});

test('a nextTrackIndex change while not yet within the prefetch window does not eagerly prefetch', () => {
  const audioRefA = makeAudioRef();
  const audioRefB = makeAudioRef();
  audioRefA.current.duration = 180;
  audioRefA.current.currentTime = 10; // far from the end
  const ensureStandbyLoaded = vi.fn();
  usePlayerStore.setState({ ensureStandbyLoaded, nextTrackIndex: 1 });
  renderHook(() => usePlayerEngine(audioRefA, audioRefB));
  ensureStandbyLoaded.mockClear();

  act(() => usePlayerStore.setState({ nextTrackIndex: 2 }));
  expect(ensureStandbyLoaded).not.toHaveBeenCalled();
});
