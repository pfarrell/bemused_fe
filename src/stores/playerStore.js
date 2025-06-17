// stores/playerStore.js
import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  // Player state
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  playerInstance: null,
  
  // Actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setPlaylist: (playlist) => {
    set({ playlist });
    // Update player instance if it exists
    const { playerInstance } = get();
    if (playerInstance) {
      playerInstance.clearPlaylist();
      playerInstance.addTracks(playlist);
    }
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlayerInstance: (instance) => set({ playerInstance: instance }),
  
  // Methods that delegate to your player
  addTrack: (track) => {
    const { playerInstance, playlist } = get();
    if (playerInstance) {
      playerInstance.addTrack(track);
      set({ playlist: [...playlist, track] });
    }
  },
  
  addTracks: (tracks, playNext = false) => {
    const { playerInstance, playlist } = get();
    if (playerInstance) {
      playerInstance.addTracks(tracks, playNext);
      const newPlaylist = playNext 
        ? [...playlist.slice(0, playerInstance.currentTrackIndex + 1), ...tracks, ...playlist.slice(playerInstance.currentTrackIndex + 1)]
        : [...playlist, ...tracks];
      set({ playlist: newPlaylist });
    }
  },
  
  clearPlaylist: () => {
    const { playerInstance } = get();
    if (playerInstance) {
      playerInstance.clearPlaylist();
      set({ playlist: [], currentTrack: null, isPlaying: false });
    }
  }
}));
