import { create } from 'zustand';

const validateTrack = (track) => {
  if (!track || !track.title || !track.url) {
    throw new Error('Invalid track object. Must contain at least title and url properties');
  }
};

// Pure function: given the fields that decide "what plays after this," resolves the next
// playlist index (or -1 if there is none). Shuffle's pick is rolled once here and reused by
// playNext() rather than rolled again at advance time, so it's knowable ahead of time —
// required for prefetching the next track before the current one ends.
const computeNextIndex = ({ shuffle, shuffleHistory, playlist, currentTrackIndex }) => {
  if (playlist.length === 0) return -1;
  if (shuffle) {
    const remaining = playlist.map((_, i) => i).filter((i) => !shuffleHistory.includes(i));
    if (remaining.length === 0) return -1;
    return remaining[Math.floor(Math.random() * remaining.length)];
  }
  if (currentTrackIndex === playlist.length - 1) return -1;
  return currentTrackIndex + 1;
};

// A ~0-length silent WAV, used only to "unlock" the standby <audio> element for iOS Safari —
// WebKit only allows a media element's *first* play() to succeed if it's called synchronously
// inside a user gesture. The standby element is never played by a real gesture (its first
// .play() happens later, inside a timeupdate/ended handler during a gapless handoff), so we
// preemptively call play()/pause() on it here, inside the same gesture that starts the very
// first track, while we still can.
const SILENT_AUDIO_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const standbyMatchesTarget = (standby, target) => !!standby && !!target && standby.src.endsWith(target.url);

export const usePlayerStore = create((set, get) => ({
  // DOM bridge — two raw <audio> elements, set once by usePlayerEngine on mount. activeSlot
  // says which one is currently "live"; the other is standby, used to gaplessly prefetch and
  // hand off to the next track (see Task 3).
  audioElementA: null,
  audioElementB: null,
  activeSlot: 'a',
  setAudioElement: (slot, audioElement) => set(slot === 'a' ? { audioElementA: audioElement } : { audioElementB: audioElement }),
  getActiveAudio: () => (get().activeSlot === 'a' ? get().audioElementA : get().audioElementB),
  getStandbyAudio: () => (get().activeSlot === 'a' ? get().audioElementB : get().audioElementA),

  // Playback state
  playlist: [],
  currentTrackIndex: -1,
  currentTrack: null,
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  playlistFinished: false,
  // The playlist index that will play after the current track, kept in sync by every action
  // that mutates playlist/currentTrackIndex/shuffle/shuffleHistory. -1 means there is no next track.
  nextTrackIndex: -1,
  // Whether the standby element has been unlocked for iOS. Set to true after the first playTrackAtIndex call.
  standbyUnlocked: false,

  // Tracks belonging to whatever detail page (album, etc.) is currently mounted, kept in sync
  // by that page's own effect. Lets togglePlayPause fall back to "Play Now" behavior when the
  // playlist is empty, instead of trying to resume a track that was never loaded.
  pageTracks: [],
  setPageTracks: (tracks) => set({ pageTracks: tracks || [] }),

  // Shuffle state
  shuffle: false,
  shuffleHistory: [],

  // UI state
  drawerOpen: false,
  activityPulseToken: 0,
  // Playlist positions (not track ids — the same track can legitimately
  // appear twice) from the most recent flashActivity add. Replaced wholesale
  // on each add (not merged) so only the latest batch flashes when the
  // drawer opens, and cleared by the drawer itself once shown so it doesn't
  // flash again.
  recentlyAddedIndices: [],
  clearRecentlyAdded: () => set({ recentlyAddedIndices: [] }),

  // Internal setters — called only by usePlayerEngine in response to <audio> events
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setBuffering: (isBuffering) => set({ isBuffering }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  // Internal — recomputed at the end of every action that changes what "next" resolves to.
  syncNextTrackIndex: () => set({ nextTrackIndex: computeNextIndex(get()) }),

  ensureStandbyLoaded: () => {
    const { nextTrackIndex, playlist } = get();
    const standby = get().getStandbyAudio();
    const target = nextTrackIndex === -1 ? null : playlist[nextTrackIndex];
    if (!standby || !target || standbyMatchesTarget(standby, target)) return;
    standby.src = target.url;
    standby.load();
  },

  // Transport
  playTrackAtIndex: (index) => {
    const { playlist, shuffle, shuffleHistory, standbyUnlocked } = get();
    const audioElement = get().getActiveAudio();
    if (index < 0 || index >= playlist.length || !audioElement) return;
    const track = playlist[index];
    const nextShuffleHistory = shuffle && !shuffleHistory.includes(index) ? [...shuffleHistory, index] : shuffleHistory;
    set({ currentTrackIndex: index, currentTrack: track, playlistFinished: false, shuffleHistory: nextShuffleHistory });
    audioElement.src = track.url;
    audioElement.load();
    audioElement.play().catch((error) => console.error('Playback failed:', error));
    if (!standbyUnlocked) {
      const standby = get().getStandbyAudio();
      if (standby) {
        standby.src = SILENT_AUDIO_DATA_URI;
        standby.play().then(() => standby.pause()).catch(() => {});
      }
      set({ standbyUnlocked: true });
    }
    get().syncNextTrackIndex();
  },

  togglePlayPause: () => {
    const { playlistFinished, playlist, pageTracks } = get();
    const audioElement = get().getActiveAudio();
    if (!audioElement) return;
    if (audioElement.paused) {
      if (playlist.length === 0) {
        if (pageTracks.length > 0) {
          get().addTracks(pageTracks);
        }
        return;
      }
      if (playlistFinished) {
        get().playTrackAtIndex(0);
      } else {
        audioElement.play().catch((error) => console.error('Playback failed:', error));
      }
    } else {
      audioElement.pause();
    }
  },

  seek: (time) => {
    const audioElement = get().getActiveAudio();
    if (!audioElement || !Number.isFinite(time)) return;
    audioElement.currentTime = time;
  },

  playNext: () => {
    const { shuffle, shuffleHistory, nextTrackIndex, playlist, activeSlot } = get();
    const audioElement = get().getActiveAudio();
    if (nextTrackIndex === -1) {
      set({ playlistFinished: true });
      audioElement?.pause();
      return;
    }
    if (shuffle) {
      set({ shuffleHistory: [...shuffleHistory, nextTrackIndex] });
    }

    const standby = get().getStandbyAudio();
    const target = playlist[nextTrackIndex];
    const standbyReady = standbyMatchesTarget(standby, target) && standby.readyState >= 3; // HAVE_FUTURE_DATA

    if (!standbyReady) {
      get().playTrackAtIndex(nextTrackIndex);
      return;
    }

    set({
      activeSlot: activeSlot === 'a' ? 'b' : 'a',
      currentTrackIndex: nextTrackIndex,
      currentTrack: target,
      playlistFinished: false,
      currentTime: 0,
      duration: Number.isFinite(standby.duration) ? standby.duration : 0,
    });
    standby.play().catch((error) => console.error('Playback failed:', error));
    get().syncNextTrackIndex();
  },

  playPrev: () => {
    const { shuffle, shuffleHistory, playlist, currentTrackIndex } = get();
    if (playlist.length === 0) return;
    set({ playlistFinished: false });
    if (shuffle && shuffleHistory.length > 1) {
      const newHistory = shuffleHistory.slice(0, -1);
      const prevIndex = newHistory[newHistory.length - 1];
      set({ shuffleHistory: newHistory });
      get().playTrackAtIndex(prevIndex);
      return;
    }
    const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    get().playTrackAtIndex(prevIndex);
  },

  toggleShuffle: () => {
    const { shuffle, currentTrackIndex, playlist } = get();
    if (!shuffle) {
      let nextIndex = currentTrackIndex;
      if (playlist.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * playlist.length);
        } while (nextIndex === currentTrackIndex);
      }
      set({ shuffle: true, shuffleHistory: [nextIndex] });
      get().playTrackAtIndex(nextIndex);
    } else {
      set({ shuffle: false, shuffleHistory: [get().currentTrackIndex] });
      get().syncNextTrackIndex();
    }
  },

  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  closeDrawer: () => set({ drawerOpen: false }),

  triggerActivityPulse: () => set((state) => ({ activityPulseToken: state.activityPulseToken + 1 })),

  // Queue management
  addTrack: (track, { flashActivity = false } = {}) => {
    validateTrack(track);
    const { playlist, isPlaying } = get();
    const newPlaylist = [...playlist, track];
    set({ playlist: newPlaylist });
    if (flashActivity) {
      set({ recentlyAddedIndices: [newPlaylist.length - 1] });
      get().triggerActivityPulse();
    }
    if (!isPlaying) {
      get().playTrackAtIndex(newPlaylist.length - 1);
    }
    get().syncNextTrackIndex();
  },

  addTracks: (tracks, playNext = false, { flashActivity = false } = {}) => {
    if (!Array.isArray(tracks)) {
      throw new Error('Tracks must be provided as an array');
    }
    tracks.forEach(validateTrack);
    const { playlist, currentTrackIndex, isPlaying } = get();

    let newPlaylist;
    let startIndex;
    if (playNext && currentTrackIndex >= 0) {
      startIndex = currentTrackIndex + 1;
      newPlaylist = [...playlist.slice(0, startIndex), ...tracks, ...playlist.slice(startIndex)];
    } else {
      startIndex = playlist.length;
      newPlaylist = [...playlist, ...tracks];
    }

    set({ playlist: newPlaylist });
    if (flashActivity) {
      const newIndices = tracks.map((_, i) => startIndex + i);
      set({ recentlyAddedIndices: newIndices });
      get().triggerActivityPulse();
    }
    if (!isPlaying) {
      get().playTrackAtIndex(startIndex);
    }
    get().syncNextTrackIndex();
  },

  clearPlaylist: () => {
    const audioElement = get().getActiveAudio();
    set({
      playlist: [],
      currentTrackIndex: -1,
      currentTrack: null,
      isPlaying: false,
      shuffleHistory: [],
      playlistFinished: false,
      currentTime: 0,
      duration: 0,
    });
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    get().syncNextTrackIndex();
  },

  removeTrackFromPlaylist: (index) => {
    const { playlist, currentTrackIndex, shuffle, shuffleHistory } = get();
    const audioElement = get().getActiveAudio();
    if (index < 0 || index >= playlist.length || index === currentTrackIndex) return;

    const newPlaylist = playlist.filter((_, i) => i !== index);
    let newCurrentIndex = currentTrackIndex;
    if (index < currentTrackIndex) newCurrentIndex -= 1;

    let newShuffleHistory = shuffleHistory;
    if (shuffle && shuffleHistory.includes(index)) {
      newShuffleHistory = shuffleHistory.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
    }

    set({ playlist: newPlaylist, currentTrackIndex: newCurrentIndex, shuffleHistory: newShuffleHistory });

    if (newPlaylist.length === 0) {
      set({ currentTrackIndex: -1, currentTrack: null, isPlaying: false, currentTime: 0, duration: 0 });
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    }
    get().syncNextTrackIndex();
  },

  reorderPlaylist: (fromIndex, toIndex) => {
    const { playlist, currentTrackIndex } = get();
    if (fromIndex === toIndex) return;
    const currentTrackRef = playlist[currentTrackIndex];
    const newPlaylist = [...playlist];
    const [moved] = newPlaylist.splice(fromIndex, 1);
    let insertIndex = toIndex;
    if (fromIndex < toIndex) {
      insertIndex = toIndex - 1;
    }
    newPlaylist.splice(insertIndex, 0, moved);
    const newCurrentIndex = currentTrackRef ? newPlaylist.indexOf(currentTrackRef) : -1;
    set({ playlist: newPlaylist, currentTrackIndex: newCurrentIndex });
    get().syncNextTrackIndex();
  },

  setPlaylist: (tracks) => {
    get().clearPlaylist();
    if (tracks.length > 0) {
      get().addTracks(tracks);
    }
  },
}));
