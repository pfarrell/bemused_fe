// src/stores/playerStore.js
import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  // Player state
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  playerInstance: null,
  currentTrackIndex: -1,
  
  // Actions
  setCurrentTrack: (track) => {
    console.log('Setting current track:', track?.title);
    set({ currentTrack: track });
  },
  
  setPlaylist: (playlist) => {
    set({ playlist });
    // Update player instance if it exists
    const { playerInstance } = get();
    if (playerInstance) {
      playerInstance.clearPlaylist();
      playerInstance.addTracks(playlist);
    }
  },
  
  setIsPlaying: (isPlaying) => {
    console.log('Setting isPlaying:', isPlaying);
    set({ isPlaying });
  },
  
  setPlayerInstance: (instance) => {
    console.log('Setting player instance:', !!instance);
    set({ playerInstance: instance });
  },
  
  setCurrentTrackIndex: (index) => {
    console.log('Setting current track index:', index);
    set({ currentTrackIndex: index });
  },
  
  // Methods that delegate to your player
  addTrack: (track) => {
    const { playerInstance, playlist } = get();
    if (playerInstance) {
      playerInstance.addTrack(track);
      const newPlaylist = [...playlist, track];
      set({ playlist: newPlaylist });
      
      // If nothing is playing, start playing the added track
      if (!playerInstance.currentTrack || !playerInstance.isPlaying) {
        const trackIndex = newPlaylist.length - 1;
        setTimeout(() => {
          playerInstance.loadAndPlayTrack(trackIndex);
        }, 100); // Small delay to ensure track is added
      }
    }
  },
  
  addTracks: (tracks, playNext = false) => {
    const { playerInstance, playlist } = get();
    if (playerInstance) {
      playerInstance.addTracks(tracks, playNext);
      
      let newPlaylist;
      if (playNext && playerInstance.currentTrackIndex >= 0) {
        // Insert after current track
        const currentIndex = playerInstance.currentTrackIndex;
        newPlaylist = [
          ...playlist.slice(0, currentIndex + 1),
          ...tracks,
          ...playlist.slice(currentIndex + 1)
        ];
      } else {
        // Add to end
        newPlaylist = [...playlist, ...tracks];
      }
      
      set({ playlist: newPlaylist });
      
      // If nothing is playing, start playing the first added track
      if (!playerInstance.currentTrack || !playerInstance.isPlaying) {
        let startIndex;
        if (playNext && playerInstance.currentTrackIndex >= 0) {
          startIndex = playerInstance.currentTrackIndex + 1;
        } else {
          startIndex = playlist.length; // First track of the newly added tracks
        }
        
        setTimeout(() => {
          playerInstance.loadAndPlayTrack(startIndex);
        }, 100); // Small delay to ensure tracks are added
      }
    }
  },
  
  clearPlaylist: () => {
    const { playerInstance } = get();
    if (playerInstance) {
      playerInstance.clearPlaylist();
      set({ 
        playlist: [], 
        currentTrack: null, 
        isPlaying: false, 
        currentTrackIndex: -1 
      });
    }
  },
  
  playNow: (track) => {
    const { playerInstance } = get();
    if (playerInstance) {
      playerInstance.clearPlaylist();
      playerInstance.addTrack(track);
      playerInstance.loadAndPlayTrack(0);
      set({ playlist: [track] });
    }
  },
  
  // Helper to get current playlist state
  getPlaylistState: () => {
    const { playlist, currentTrack, currentTrackIndex } = get();
    return {
      playlist,
      currentTrack,
      currentTrackIndex,
      hasCurrentTrack: !!currentTrack
    };
  }
}));
