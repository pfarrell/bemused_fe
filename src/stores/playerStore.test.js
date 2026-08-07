import { usePlayerStore } from './playerStore';
import { describe, test, expect, beforeEach, vi } from 'vitest';

const track = (id, overrides = {}) => ({ id, title: `Track ${id}`, url: `/stream/${id}`, duration: 180, artist: { name: 'A' }, ...overrides });

const mockAudioElement = () => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  paused: true,
  src: '',
  currentTime: 0,
  duration: 0,
  readyState: 0,
});

const setActiveAudio = (audioElement, overrides = {}) =>
  usePlayerStore.setState({ audioElementA: audioElement, audioElementB: mockAudioElement(), activeSlot: 'a', ...overrides });

beforeEach(() => {
  usePlayerStore.setState({
    audioElementA: null,
    audioElementB: null,
    activeSlot: 'a',
    playlist: [],
    currentTrackIndex: -1,
    currentTrack: null,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    playlistFinished: false,
    nextTrackIndex: -1,
    playbackMode: 'off',
    shuffleHistory: [],
    drawerOpen: false,
    activityPulseToken: 0,
    recentlyAddedIndices: [],
    standbyUnlocked: false,
    pageTracks: [],
  });
});

describe('playTrackAtIndex', () => {
  test('sets currentTrack/currentTrackIndex and loads the audio element', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1), track(2)] });
    usePlayerStore.getState().playTrackAtIndex(1);
    const state = usePlayerStore.getState();
    expect(state.currentTrackIndex).toBe(1);
    expect(state.currentTrack.id).toBe(2);
    expect(audioElement.src).toBe('/stream/2');
    expect(audioElement.load).toHaveBeenCalled();
    expect(audioElement.play).toHaveBeenCalled();
  });

  test('does nothing for an out-of-range index', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1)] });
    usePlayerStore.getState().playTrackAtIndex(5);
    expect(usePlayerStore.getState().currentTrackIndex).toBe(-1);
    expect(audioElement.load).not.toHaveBeenCalled();
  });
});

describe('addTrack', () => {
  test('appends the track and starts playback when nothing is playing', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [], isPlaying: false });
    usePlayerStore.getState().addTrack(track(1));
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(1);
    expect(state.currentTrackIndex).toBe(0);
    expect(audioElement.play).toHaveBeenCalled();
  });

  test('appends without starting playback when something is already playing', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1)], currentTrackIndex: 0, isPlaying: true });
    usePlayerStore.getState().addTrack(track(2));
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(2);
    expect(state.currentTrackIndex).toBe(0); // unchanged
    expect(audioElement.play).not.toHaveBeenCalled();
  });

  test('throws on a track missing title or url', () => {
    expect(() => usePlayerStore.getState().addTrack({ id: 1 })).toThrow(/Invalid track/);
  });

  test('flashActivity bumps activityPulseToken', () => {
    setActiveAudio(mockAudioElement());
    usePlayerStore.getState().addTrack(track(1), { flashActivity: true });
    expect(usePlayerStore.getState().activityPulseToken).toBe(1);
  });
});

describe('addTracks', () => {
  test('regression (fa854a2/fe75093): auto-plays the first track of a multi-track add at its real index when paused, even with an existing playlist', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, {
      playlist: [track(101), track(102)],
      currentTrackIndex: 0,
      isPlaying: false,
    });
    usePlayerStore.getState().addTracks([track(201), track(202)], false, { flashActivity: true });
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(4);
    // First newly-added track is at index 2 (the real index), not 0 or -1.
    expect(state.currentTrackIndex).toBe(2);
    expect(audioElement.src).toBe('/stream/201');
  });

  test('playNext=true inserts immediately after the current track', () => {
    setActiveAudio(mockAudioElement(), {
      playlist: [track(1), track(2), track(3)],
      currentTrackIndex: 0,
      isPlaying: true,
    });
    usePlayerStore.getState().addTracks([track(99)], true);
    const ids = usePlayerStore.getState().playlist.map((t) => t.id);
    expect(ids).toEqual([1, 99, 2, 3]);
  });

  test('throws if tracks is not an array', () => {
    expect(() => usePlayerStore.getState().addTracks('nope')).toThrow(/must be provided as an array/);
  });
});

describe('recentlyAddedIndices', () => {
  test('addTrack with flashActivity records the new entry\'s playlist position, not its id', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(99), track(98)] });
    usePlayerStore.getState().addTrack(track(5), { flashActivity: true });
    expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([2]);
  });

  test('addTrack without flashActivity does not touch recentlyAddedIndices', () => {
    setActiveAudio(mockAudioElement(), { recentlyAddedIndices: [99] });
    usePlayerStore.getState().addTrack(track(1));
    expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([99]);
  });

  test('a second flashActivity add replaces the previous batch instead of accumulating', () => {
    // Regression: queue track 2 (flash), then queue tracks 7/8 (flash) before
    // ever opening the drawer — only 7/8 (the latest batch) should remain
    // marked; track 2's earlier position should no longer be flagged even
    // though it was never seen.
    setActiveAudio(mockAudioElement(), {
      playlist: [track(1), track(2)],
      currentTrackIndex: 0,
      isPlaying: true,
      recentlyAddedIndices: [1],
    });
    usePlayerStore.getState().addTracks([track(7), track(8)], false, { flashActivity: true });
    expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([2, 3]);
  });

  test('regression: queueing a track whose id already exists elsewhere in the playlist only marks the new occurrence', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(5)], isPlaying: true });
    usePlayerStore.getState().addTrack(track(5), { flashActivity: true });
    expect(usePlayerStore.getState().playlist).toHaveLength(2);
    expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([1]);
  });

  test('clearRecentlyAdded resets the list to empty', () => {
    usePlayerStore.setState({ recentlyAddedIndices: [1, 2] });
    usePlayerStore.getState().clearRecentlyAdded();
    expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([]);
  });
});

describe('removeTrackFromPlaylist', () => {
  test('refuses to remove the currently playing track', () => {
    usePlayerStore.setState({ playlist: [track(1), track(2)], currentTrackIndex: 0 });
    usePlayerStore.getState().removeTrackFromPlaylist(0);
    expect(usePlayerStore.getState().playlist).toHaveLength(2);
  });

  test('removing a track before the current one decrements currentTrackIndex', () => {
    usePlayerStore.setState({ playlist: [track(1), track(2), track(3)], currentTrackIndex: 2 });
    usePlayerStore.getState().removeTrackFromPlaylist(0);
    const state = usePlayerStore.getState();
    expect(state.playlist.map((t) => t.id)).toEqual([2, 3]);
    expect(state.currentTrackIndex).toBe(1);
  });

  test('removing the last track resets playback state', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1)], currentTrackIndex: -1 });
    usePlayerStore.getState().removeTrackFromPlaylist(0);
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(0);
    expect(state.currentTrackIndex).toBe(-1);
    expect(audioElement.pause).toHaveBeenCalled();
  });
});

describe('reorderPlaylist', () => {
  test('moves a track and keeps currentTrackIndex pointing at the same track', () => {
    usePlayerStore.setState({ playlist: [track(1), track(2), track(3)], currentTrackIndex: 2 });
    usePlayerStore.getState().reorderPlaylist(0, 2); // move track 1 to index 2
    const state = usePlayerStore.getState();
    expect(state.playlist.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(state.currentTrackIndex).toBe(2); // track 3 is at index 2 in [2,1,3]
  });
});

describe('playNext / playback modes', () => {
  test('non-shuffle: advances to the next index', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2)], currentTrackIndex: 0, nextTrackIndex: 1 });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentTrackIndex).toBe(1);
  });

  test('non-shuffle: marks playlistFinished and pauses on the last track', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1), track(2)], currentTrackIndex: 1 });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.playlistFinished).toBe(true);
    expect(audioElement.pause).toHaveBeenCalled();
  });

  test('cyclePlaybackMode advances off -> shuffle -> repeat-all -> repeat-one -> off', () => {
    usePlayerStore.setState({ playbackMode: 'off' });
    const modes = [];
    for (let i = 0; i < 4; i++) {
      usePlayerStore.getState().cyclePlaybackMode();
      modes.push(usePlayerStore.getState().playbackMode);
    }
    expect(modes).toEqual(['shuffle', 'repeat-all', 'repeat-one', 'off']);
  });

  test('entering shuffle mode does not interrupt the currently playing track', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2), track(3)], currentTrackIndex: 1 });
    usePlayerStore.getState().cyclePlaybackMode();
    const state = usePlayerStore.getState();
    expect(state.playbackMode).toBe('shuffle');
    expect(state.currentTrackIndex).toBe(1);
    expect(state.shuffleHistory).toEqual([1]);
  });

  test('repeat-all wraps from the last track back to index 0', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2)], currentTrackIndex: 1, playbackMode: 'repeat-all', nextTrackIndex: 0 });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.currentTrackIndex).toBe(0);
    expect(state.playlistFinished).toBe(false);
  });

  test('repeat-one replays the same track on auto-advance', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2)], currentTrackIndex: 0, playbackMode: 'repeat-one', nextTrackIndex: 0 });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentTrackIndex).toBe(0);
  });

  test('repeat-one: a manual Next still advances to the real next track', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2), track(3)], currentTrackIndex: 0, playbackMode: 'repeat-one', nextTrackIndex: 0 });
    usePlayerStore.getState().playNext({ manual: true });
    expect(usePlayerStore.getState().currentTrackIndex).toBe(1);
  });

  test('repeat-one: auto-advance (no manual flag) still replays even though a real next track exists', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2), track(3)], currentTrackIndex: 0, playbackMode: 'repeat-one', nextTrackIndex: 0 });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentTrackIndex).toBe(0);
  });

  test('playPrev() on an empty playlist does not throw and leaves state sane', () => {
    setActiveAudio(mockAudioElement(), { playlist: [], currentTrackIndex: -1 });
    expect(() => usePlayerStore.getState().playPrev()).not.toThrow();
    const state = usePlayerStore.getState();
    expect(state.currentTrackIndex).toBe(-1);
    expect(state.playlist).toHaveLength(0);
  });
});

describe('clearPlaylist', () => {
  test('resets all playback state and stops the audio element', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1)], currentTrackIndex: 0, currentTrack: track(1), isPlaying: true });
    usePlayerStore.getState().clearPlaylist();
    const state = usePlayerStore.getState();
    expect(state.playlist).toEqual([]);
    expect(state.currentTrackIndex).toBe(-1);
    expect(state.currentTrack).toBeNull();
    expect(audioElement.pause).toHaveBeenCalled();
  });
});

describe('setPlaylist', () => {
  test('replaces the queue and starts playing the first track', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [track(1)], currentTrackIndex: 0, isPlaying: true });
    usePlayerStore.getState().setPlaylist([track(9), track(10)]);
    const state = usePlayerStore.getState();
    expect(state.playlist.map((t) => t.id)).toEqual([9, 10]);
    expect(state.currentTrackIndex).toBe(0);
  });
});

describe('nextTrackIndex', () => {
  test('points at the following index in a non-shuffle playlist', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2), track(3)] });
    usePlayerStore.getState().playTrackAtIndex(0);
    expect(usePlayerStore.getState().nextTrackIndex).toBe(1);
  });

  test('is -1 on the last track', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2)] });
    usePlayerStore.getState().playTrackAtIndex(1);
    expect(usePlayerStore.getState().nextTrackIndex).toBe(-1);
  });

  test('is -1 on an empty playlist', () => {
    setActiveAudio(mockAudioElement(), { playlist: [] });
    usePlayerStore.getState().syncNextTrackIndex();
    expect(usePlayerStore.getState().nextTrackIndex).toBe(-1);
  });

  test('in shuffle mode, excludes everything already in shuffleHistory', () => {
    setActiveAudio(mockAudioElement(), {
      playlist: [track(1), track(2), track(3)],
      currentTrackIndex: 0,
      playbackMode: 'shuffle',
      shuffleHistory: [0],
    });
    usePlayerStore.getState().syncNextTrackIndex();
    expect([1, 2]).toContain(usePlayerStore.getState().nextTrackIndex);
  });

  test('in shuffle mode, is -1 once every track is in shuffleHistory', () => {
    usePlayerStore.setState({
      playlist: [track(1), track(2)],
      playbackMode: 'shuffle',
      shuffleHistory: [0, 1],
    });
    usePlayerStore.getState().syncNextTrackIndex();
    expect(usePlayerStore.getState().nextTrackIndex).toBe(-1);
  });

  test('playNext in shuffle mode advances to the precomputed nextTrackIndex, not a freshly-rolled one', () => {
    setActiveAudio(mockAudioElement(), {
      playlist: [track(1), track(2), track(3)],
      currentTrackIndex: 0,
      playbackMode: 'shuffle',
      shuffleHistory: [0],
      nextTrackIndex: 2,
    });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.currentTrackIndex).toBe(2);
    expect(state.shuffleHistory).toEqual([0, 2]);
  });

  test('repeat-all: nextTrackIndex wraps to 0 on the last track', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2)], playbackMode: 'repeat-all' });
    usePlayerStore.getState().playTrackAtIndex(1);
    expect(usePlayerStore.getState().nextTrackIndex).toBe(0);
  });

  test('repeat-one: nextTrackIndex is always the current index', () => {
    setActiveAudio(mockAudioElement(), { playlist: [track(1), track(2), track(3)], playbackMode: 'repeat-one' });
    usePlayerStore.getState().playTrackAtIndex(1);
    expect(usePlayerStore.getState().nextTrackIndex).toBe(1);
  });
});

describe('getActiveAudio / getStandbyAudio', () => {
  test('resolves slot A as active by default', () => {
    const a = mockAudioElement();
    const b = mockAudioElement();
    usePlayerStore.setState({ audioElementA: a, audioElementB: b, activeSlot: 'a' });
    expect(usePlayerStore.getState().getActiveAudio()).toBe(a);
    expect(usePlayerStore.getState().getStandbyAudio()).toBe(b);
  });

  test('resolves slot B as active when activeSlot is b', () => {
    const a = mockAudioElement();
    const b = mockAudioElement();
    usePlayerStore.setState({ audioElementA: a, audioElementB: b, activeSlot: 'b' });
    expect(usePlayerStore.getState().getActiveAudio()).toBe(b);
    expect(usePlayerStore.getState().getStandbyAudio()).toBe(a);
  });

  test('setAudioElement assigns into the given slot', () => {
    const a = mockAudioElement();
    usePlayerStore.getState().setAudioElement('a', a);
    expect(usePlayerStore.getState().audioElementA).toBe(a);
    const b = mockAudioElement();
    usePlayerStore.getState().setAudioElement('b', b);
    expect(usePlayerStore.getState().audioElementB).toBe(b);
  });
});

describe('ensureStandbyLoaded', () => {
  test('loads the standby element with the next track when it differs from what is already loaded', () => {
    const standby = mockAudioElement();
    usePlayerStore.setState({
      audioElementA: mockAudioElement(), audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], nextTrackIndex: 1,
    });
    usePlayerStore.getState().ensureStandbyLoaded();
    expect(standby.src).toBe('/stream/2');
    expect(standby.load).toHaveBeenCalled();
  });

  test('does nothing if the standby element is already loaded with that track', () => {
    const standby = mockAudioElement();
    standby.src = '/stream/2';
    usePlayerStore.setState({
      audioElementA: mockAudioElement(), audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], nextTrackIndex: 1,
    });
    usePlayerStore.getState().ensureStandbyLoaded();
    expect(standby.load).not.toHaveBeenCalled();
  });

  test('does nothing when there is no next track', () => {
    const standby = mockAudioElement();
    usePlayerStore.setState({
      audioElementA: mockAudioElement(), audioElementB: standby, activeSlot: 'a',
      playlist: [track(1)], nextTrackIndex: -1,
    });
    usePlayerStore.getState().ensureStandbyLoaded();
    expect(standby.load).not.toHaveBeenCalled();
  });
});

describe('playNext gapless handoff', () => {
  test('flips activeSlot and plays the standby element directly when it is already loaded and ready', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement();
    standby.src = '/stream/2';
    standby.readyState = 3;
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], currentTrackIndex: 0, nextTrackIndex: 1,
    });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.activeSlot).toBe('b');
    expect(state.currentTrackIndex).toBe(1);
    expect(state.currentTrack.id).toBe(2);
    expect(standby.play).toHaveBeenCalled();
    expect(standby.load).not.toHaveBeenCalled(); // no reload — that's the whole point
  });

  test('resets duration and currentTime to the standby track values on handoff', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement();
    standby.src = '/stream/2';
    standby.readyState = 3;
    standby.duration = 200;
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], currentTrackIndex: 0, nextTrackIndex: 1,
      duration: 180, currentTime: 170,
    });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.duration).toBe(200);
    expect(state.currentTime).toBe(0);
  });

  test('falls back to a normal load on the active element when the standby is not ready', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement(); // src: '', readyState: 0 — not ready
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], currentTrackIndex: 0, nextTrackIndex: 1,
    });
    usePlayerStore.getState().playNext();
    const state = usePlayerStore.getState();
    expect(state.activeSlot).toBe('a'); // unchanged
    expect(active.src).toBe('/stream/2');
    expect(active.load).toHaveBeenCalled();
  });

  test('falls back when the standby element is loaded but for the wrong track', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement();
    standby.src = '/stream/99'; // stale — loaded for a track that's no longer next
    standby.readyState = 3;
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], currentTrackIndex: 0, nextTrackIndex: 1,
    });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().activeSlot).toBe('a');
    expect(active.src).toBe('/stream/2');
  });
});

describe('standby unlock', () => {
  test('the first playTrackAtIndex call unlocks the standby element with a muted silent clip', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement();
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1)], standbyUnlocked: false,
    });
    usePlayerStore.getState().playTrackAtIndex(0);
    expect(standby.play).toHaveBeenCalled();
    expect(usePlayerStore.getState().standbyUnlocked).toBe(true);
  });

  test('subsequent playTrackAtIndex calls do not re-unlock', () => {
    const active = mockAudioElement();
    const standby = mockAudioElement();
    usePlayerStore.setState({
      audioElementA: active, audioElementB: standby, activeSlot: 'a',
      playlist: [track(1), track(2)], standbyUnlocked: true,
    });
    usePlayerStore.getState().playTrackAtIndex(1);
    expect(standby.play).not.toHaveBeenCalled();
  });
});

describe('closeDrawer', () => {
  test('sets drawerOpen to false when it was open', () => {
    usePlayerStore.setState({ drawerOpen: true });
    usePlayerStore.getState().closeDrawer();
    expect(usePlayerStore.getState().drawerOpen).toBe(false);
  });

  test('is a no-op (stays false) when already closed', () => {
    usePlayerStore.setState({ drawerOpen: false });
    usePlayerStore.getState().closeDrawer();
    expect(usePlayerStore.getState().drawerOpen).toBe(false);
  });
});

describe('togglePlayPause with an empty playlist', () => {
  test('enqueues and plays pageTracks, same as Play Now, when the playlist is empty', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [], currentTrackIndex: -1, pageTracks: [track(1), track(2)] });
    usePlayerStore.getState().togglePlayPause();
    const state = usePlayerStore.getState();
    expect(state.playlist.map((t) => t.id)).toEqual([1, 2]);
    expect(state.currentTrackIndex).toBe(0);
    expect(audioElement.src).toBe('/stream/1');
    expect(audioElement.play).toHaveBeenCalled();
  });

  test('does nothing when the playlist is empty and there are no pageTracks to fall back to', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, { playlist: [], currentTrackIndex: -1, pageTracks: [] });
    usePlayerStore.getState().togglePlayPause();
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(0);
    expect(audioElement.play).not.toHaveBeenCalled();
  });

  test('resumes normally (ignoring pageTracks) when the playlist already has tracks', () => {
    const audioElement = mockAudioElement();
    setActiveAudio(audioElement, {
      playlist: [track(1)], currentTrackIndex: 0, playlistFinished: false, pageTracks: [track(9)],
    });
    usePlayerStore.getState().togglePlayPause();
    const state = usePlayerStore.getState();
    expect(state.playlist).toHaveLength(1);
    expect(audioElement.play).toHaveBeenCalled();
  });
});
