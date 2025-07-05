// player.js
// Prevent redeclaration errors
if (typeof window.PLAY_SYMBOL === 'undefined') {
  window.PLAY_SYMBOL = '&#9205;';
  window.PAUSE_SYMBOL = '&#9208;';
  window.PREV_SYMBOL = '&#9194;';
  window.NEXT_SYMBOL = '&#9193;';
  window.SHUFFLE_SYMBOL = '&#128256;';
  window.DRAG_HANDLE = '&#8942;';
  window.HAMBURGER_SYMBOL = '&#9776;'; // ☰
}

const PLAY_SYMBOL = window.PLAY_SYMBOL;
const PAUSE_SYMBOL = window.PAUSE_SYMBOL;
const PREV_SYMBOL = window.PREV_SYMBOL;
const NEXT_SYMBOL = window.NEXT_SYMBOL;
const SHUFFLE_SYMBOL = window.SHUFFLE_SYMBOL;
const DRAG_HANDLE = window.DRAG_HANDLE;
const HAMBURGER_SYMBOL = window.HAMBURGER_SYMBOL;


function AudioPlayer(playlist, audioElement, containerElement, playlistElement, config = {}) {
  this.playlist = playlist || [];
  this.currentTrackIndex = -1;
  this.shuffle = config.shuffle || false;
  this.shuffleHistory = [];
  this.audioPlayer = audioElement;
  this.container = containerElement;
  this.playlistElement = playlistElement;
  this.playlistVisible = false;
  this.backdropElement = null; // Track backdrop element
  this.onTrackStart = config.onTrackStart || function() {};
  this.onFiveSecondMark = config.onFiveSecondMark || function() {};
  this.getTrackPrefix = config.getTrackPrefix || (() => '');
  this.draggedItem = null;
  this.draggedItemIndex = null;
  this.playlistFinished = false;

  if (!this.container) {
    throw new Error('Container element not found');
  }

  this.init();
}

AudioPlayer.prototype.init = function() {
  this.audioPlayer.controls = false;
  
  this.controlsContainer = document.createElement('div');
  this.controlsContainer.className = 'controls';
  this.container.appendChild(this.controlsContainer);

  this.createControls();
  
  this.trackListElement = document.createElement('ul');
  this.trackListElement.className = 'playlist';
  this.trackListElement.style.textAlign = 'left';
  this.playlistElement.appendChild(this.trackListElement);

  // Initially hide playlist
  this.playlistElement.style.display = 'none';

  this.attachAudioPlayerListeners();
  this.loadPlaylistUI();
  this.loadAndPlayTrack(this.currentTrackIndex);
};

AudioPlayer.prototype.createControls = function() {
  const controlsWrapper = document.createElement('div');
  controlsWrapper.className = 'player-controls-wrapper';

  // Create hamburger button (leftmost)
  this.hamburgerButtonElement = this.createHamburgerButton();
  
  // Create time display (left of progress bar)
  this.timeElapsedDisplay = document.createElement('span');
  this.timeElapsedDisplay.className = 'time-display elapsed';
  this.timeElapsedDisplay.textContent = '0:00';

  // Create progress bar
  const progressBarWrapper = this.createProgressBar();

  // Create total time display (right of progress bar)
  this.trackLengthDisplay = document.createElement('span');
  this.trackLengthDisplay.className = 'time-display total';
  this.trackLengthDisplay.textContent = '0:00';

  // Create transport controls
  this.prevButtonElement = this.createPrevButton();
  this.playButtonElement = this.createPlayButton();
  this.nextButtonElement = this.createNextButton();
  this.shuffleToggleElement = this.createShuffleToggle();

  // Add elements to wrapper
  controlsWrapper.appendChild(this.hamburgerButtonElement);
  controlsWrapper.appendChild(this.timeElapsedDisplay);
  controlsWrapper.appendChild(progressBarWrapper);
  controlsWrapper.appendChild(this.trackLengthDisplay);
  controlsWrapper.appendChild(this.prevButtonElement);
  controlsWrapper.appendChild(this.playButtonElement);
  controlsWrapper.appendChild(this.nextButtonElement);
  controlsWrapper.appendChild(this.shuffleToggleElement);

  this.controlsContainer.appendChild(controlsWrapper);
};

AudioPlayer.prototype.createHamburgerButton = function() {
  const hamburgerButton = document.createElement('button');
  hamburgerButton.innerHTML = HAMBURGER_SYMBOL;
  hamburgerButton.className = 'player-btn hamburger-btn';
  hamburgerButton.title = 'Toggle Playlist';
  
  hamburgerButton.addEventListener('click', () => this.togglePlaylist());
  return hamburgerButton;
};

AudioPlayer.prototype.createPrevButton = function() {
  const prevButton = document.createElement('button');
  prevButton.innerHTML = PREV_SYMBOL;
  prevButton.className = 'player-btn prev-btn';
  prevButton.addEventListener('click', () => this.playPrevTrack());
  return prevButton;
};

AudioPlayer.prototype.createPlayButton = function() {
  const playButton = document.createElement('button');
  playButton.innerHTML = PLAY_SYMBOL;
  playButton.className = 'player-btn play-btn';
  playButton.addEventListener('click', () => {
    if (this.audioPlayer.paused) {
      if (this.playlistFinished) {
        this.playlistFinished = false;
        this.loadAndPlayTrack(0);
      } else {
        this.audioPlayer.play();
      }
    } else {
      this.audioPlayer.pause();
    }
  });
  return playButton;
};

AudioPlayer.prototype.createNextButton = function() {
  const nextButton = document.createElement('button');
  nextButton.innerHTML = NEXT_SYMBOL;
  nextButton.className = 'player-btn next-btn';
  nextButton.addEventListener('click', () => this.playNextTrack());
  return nextButton;
};

AudioPlayer.prototype.createShuffleToggle = function() {
  const shuffleToggle = document.createElement('button');
  shuffleToggle.innerHTML = SHUFFLE_SYMBOL;
  shuffleToggle.className = 'player-btn shuffle-btn';

  shuffleToggle.addEventListener('click', () => {
    this.shuffle = !this.shuffle;
    shuffleToggle.classList.toggle('active', this.shuffle);
    
    if (this.shuffle) {
      this.shuffleHistory = [];
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * this.playlist.length);
      } while (nextIndex === this.currentTrackIndex);

      this.shuffleHistory.push(nextIndex);
      this.loadAndPlayTrack(nextIndex);
    }

    this.shuffleHistory = [this.currentTrackIndex];
  });
  return shuffleToggle;
};

AudioPlayer.prototype.createBackdrop = function() {
  if (this.backdropElement) {
    return; // Already exists
  }
  
  this.backdropElement = document.createElement('div');
  this.backdropElement.className = 'playlist-backdrop';
  this.backdropElement.addEventListener('click', () => this.hidePlaylist());
  document.body.appendChild(this.backdropElement);
};

AudioPlayer.prototype.removeBackdrop = function() {
  if (this.backdropElement && this.backdropElement.parentNode) {
    this.backdropElement.parentNode.removeChild(this.backdropElement);
    this.backdropElement = null;
  }
};

AudioPlayer.prototype.togglePlaylist = function() {
  if (this.playlistVisible) {
    this.hidePlaylist();
  } else {
    this.showPlaylist();
  }
};

AudioPlayer.prototype.showPlaylist = function() {
  this.playlistVisible = true;
  this.playlistElement.style.display = 'block';
  this.hamburgerButtonElement.classList.add('active');
  this.createBackdrop();
  console.log('Playlist shown');
};

AudioPlayer.prototype.hidePlaylist = function() {
  this.playlistVisible = false;
  this.playlistElement.style.display = 'none';
  this.hamburgerButtonElement.classList.remove('active');
  this.removeBackdrop();
  console.log('Playlist hidden');
};

AudioPlayer.prototype.createProgressBar = function() {
  const progressBarWrapper = document.createElement('div');
  progressBarWrapper.className = 'progress-bar-wrapper';

  const progressBar = document.createElement('input');
  progressBar.type = 'range';
  progressBar.min = '0';
  progressBar.max = '100';
  progressBar.value = '0';
  progressBar.className = 'progress-bar';
  progressBar.addEventListener('input', (e) => {
    const percent = e.target.value / 100;
    this.audioPlayer.currentTime = percent * this.audioPlayer.duration;
  });

  progressBarWrapper.appendChild(progressBar);
  return progressBarWrapper;
};

// Fix the backdrop creation to prevent click conflicts
AudioPlayer.prototype.createBackdrop = function() {
  if (this.backdropElement) {
    return; // Already exists
  }
  
  this.backdropElement = document.createElement('div');
  this.backdropElement.className = 'playlist-backdrop';
  
  // Fix backdrop click handler to prevent conflicts
  this.backdropElement.addEventListener('click', (e) => {
    // Only hide playlist if clicking the backdrop itself, not child elements
    if (e.target === this.backdropElement) {
      this.hidePlaylist();
    }
  });
  
  // Prevent backdrop from interfering with playlist scrolling on mobile
  this.backdropElement.addEventListener('touchstart', (e) => {
    // Don't prevent touch events that might be scrolling
    if (window.innerWidth <= 768) {
      e.stopPropagation();
    }
  });
  
  document.body.appendChild(this.backdropElement);
};

// Enhanced mobile detection
function isMobileDevice() {
  return window.innerWidth <= 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Enhanced mobile touch handling with proper cleanup
AudioPlayer.prototype.loadPlaylistUI = function() {
  this.trackListElement.innerHTML = '';
  const isMobile = isMobileDevice();

  this.playlist.forEach((track, index) => {
    const listItem = document.createElement('li');
    const prefix = this.getTrackPrefix(track, index);

    listItem.className = 'track-item';
    listItem.draggable = !isMobile;
    
    listItem.style.listStyle = 'none';
    listItem.style.padding = isMobile ? '1rem' : '0.75rem 1rem';
    listItem.style.cursor = 'pointer';
    listItem.style.display = 'flex';
    listItem.style.alignItems = 'center';
    listItem.style.borderBottom = '1px solid #34495e';
    listItem.style.textAlign = 'left';
    listItem.style.minHeight = isMobile ? '60px' : '48px';
    listItem.style.position = 'relative';
    listItem.style.zIndex = '1002';
    
    if (prefix) {
      const prefixElement = document.createElement('span');
      prefixElement.className = 'track-prefix';
      prefixElement.style.marginRight = '8px';
      prefixElement.style.color = 'white';
      prefixElement.innerHTML = prefix;
      listItem.appendChild(prefixElement);
    }

    const trackText = document.createElement('span');
    trackText.className = 'track-text';
    trackText.style.flex = '1';
    trackText.style.color = 'white';
    trackText.style.cursor = 'pointer';
    trackText.style.padding = isMobile ? '0.5rem 0' : '0.25rem 0';
    trackText.style.pointerEvents = 'auto';
    trackText.textContent = `${index + 1}. ${track.title} - ${track.artist.name} (${this.formatTime(track.duration)})`;

    listItem.appendChild(trackText);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'track-delete-button';
    deleteButton.innerHTML = '❌';
    deleteButton.title = 'Remove from playlist';
    deleteButton.setAttribute('aria-label', 'Remove track from playlist');
    listItem.appendChild(deleteButton);

    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent track click event
      this.removeTrackFromPlaylist(index);
    });

    if (!isMobile) {
      this.addDragAndDropListeners(listItem, index);
    }

    const handleTrackClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      this.playlistFinished = false;
      
      if (index === this.currentTrackIndex) {
        if (this.audioPlayer.paused) {
          this.audioPlayer.play();
        } else {
          this.audioPlayer.pause();
        }
      } else {
        this.loadAndPlayTrack(index);
      }
    };

    listItem.addEventListener('click', handleTrackClick);
    trackText.addEventListener('click', handleTrackClick);
    
    if (isMobile) {
      let touchStartTime = 0;
      let touchFeedbackTimeout = null;
      
      listItem.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        
        // Clear any existing timeout
        if (touchFeedbackTimeout) {
          clearTimeout(touchFeedbackTimeout);
        }
        
        // Only apply touch feedback if this isn't the active track
        if (index !== this.currentTrackIndex) {
          listItem.style.setProperty('background-color', '#4f46e5', 'important');
          listItem.style.setProperty('transform', 'scale(0.98)', 'important');
        }
      }, { passive: true });
      
      listItem.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - touchStartTime;
        
        // Clear touch feedback
        if (touchFeedbackTimeout) {
          clearTimeout(touchFeedbackTimeout);
        }
        
        // Reset visual feedback after delay, but only if it's not the active track
        touchFeedbackTimeout = setTimeout(() => {
          if (index !== this.currentTrackIndex) {
            listItem.style.setProperty('background-color', 'transparent', 'important');
            listItem.style.setProperty('transform', 'scale(1)', 'important');
          }
          // Force active track styling update
          this.updateActiveTrackStyling();
        }, 200);
        
        // Only trigger if it was a tap (not a scroll)
        if (touchDuration < 300) {
          e.preventDefault();
          e.stopPropagation();
          handleTrackClick(e);
          
          // Force immediate styling update after track change
          setTimeout(() => {
            this.updateActiveTrackStyling();
          }, 50);
        }
      }, { passive: false });
      
      listItem.addEventListener('touchcancel', () => {
        if (touchFeedbackTimeout) {
          clearTimeout(touchFeedbackTimeout);
        }
        
        // Reset styling
        if (index !== this.currentTrackIndex) {
          listItem.style.setProperty('background-color', 'transparent', 'important');
          listItem.style.setProperty('transform', 'scale(1)', 'important');
        }
      });
    }

    this.trackListElement.appendChild(listItem);
  });
  
  // Update active track styling after creating all items
  this.updateActiveTrackStyling();
};

// Enhanced updateActiveTrackStyling function with mobile fixes
AudioPlayer.prototype.updateActiveTrackStyling = function() {
  const isMobile = window.innerWidth <= 768;

  Array.from(this.trackListElement.children).forEach((item, idx) => {
    const isActive = idx === this.currentTrackIndex;

    // Remove all styling classes first
    item.classList.remove('active');

    if (isActive) {
      // Set active track styling
      item.classList.add('active');
      item.style.backgroundColor = '#3b82f6 !important';
      item.style.color = 'white !important';
      item.style.borderLeft = '4px solid #60a5fa';

      // Force style update on mobile
      if (isMobile) {
        item.style.setProperty('background-color', '#3b82f6', 'important');
        item.style.setProperty('color', 'white', 'important');
      }
    } else {
      // Reset inactive track styling
      item.style.backgroundColor = 'transparent';
      item.style.color = 'white';
      item.style.borderLeft = 'none';
      item.style.transform = 'scale(1)'; // Reset any touch scaling

      // Force style reset on mobile
      if (isMobile) {
        item.style.setProperty('background-color', 'transparent', 'important');
        item.style.setProperty('color', 'white', 'important');
        item.style.setProperty('transform', 'scale(1)', 'important');
      }
    }
  });
};

// Fixed drag and drop listeners (desktop only)
AudioPlayer.prototype.addDragAndDropListeners = function(listItem, index) {
  listItem.addEventListener('dragstart', (e) => {
    this.draggedItem = listItem;
    this.draggedItemIndex = index;
    listItem.style.opacity = '0.2';
    e.dataTransfer.effectAllowed = 'move';
  });

  listItem.addEventListener('dragend', () => {
    if (this.draggedItem) {
      this.draggedItem.style.opacity = '1';
      this.draggedItem = null;
      this.draggedItemIndex = null;
    }

    // Remove all drag-over effects
    const items = this.trackListElement.querySelectorAll('.track-item');
    items.forEach(item => {
      item.style.borderTop = '';
      item.style.borderBottom = '1px solid #34495e';
    });
  });

  listItem.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const boundingRect = listItem.getBoundingClientRect();
    const midpoint = boundingRect.top + boundingRect.height / 2;

    if (e.clientY < midpoint) {
      listItem.style.borderTop = '2px solid #3b82f6';
      listItem.style.borderBottom = '1px solid #34495e';
    } else {
      listItem.style.borderTop = '';
      listItem.style.borderBottom = '2px solid #3b82f6';
    }
  });

  listItem.addEventListener('dragleave', () => {
    listItem.style.borderTop = '';
    listItem.style.borderBottom = '1px solid #34495e';
  });

  listItem.addEventListener('drop', (e) => {
    e.preventDefault();
    if (this.draggedItem === listItem) return;

    const boundingRect = listItem.getBoundingClientRect();
    const midpoint = boundingRect.top + boundingRect.height / 2;
    let newIndex = index;

    if (e.clientY > midpoint) {
      newIndex++;
    }

    // Update playlist array
    const [movedTrack] = this.playlist.splice(this.draggedItemIndex, 1);
    this.playlist.splice(newIndex, 0, movedTrack);

    // Update currentTrackIndex if needed
    if (this.currentTrackIndex === this.draggedItemIndex) {
      this.currentTrackIndex = newIndex;
    } else if (this.draggedItemIndex < this.currentTrackIndex && newIndex >= this.currentTrackIndex) {
      this.currentTrackIndex--;
    } else if (this.draggedItemIndex > this.currentTrackIndex && newIndex <= this.currentTrackIndex) {
      this.currentTrackIndex++;
    }

    // Reload playlist UI
    this.loadPlaylistUI();
  });
};



// Keep all your existing methods: attachAudioPlayerListeners, formatTime, updatePlayButton,
// highlightFirstTrack, loadAndPlayTrack, playNextTrack, playPrevTrack, addTrack, addTracks, clearPlaylist

AudioPlayer.prototype.attachAudioPlayerListeners = function() {
  this.audioPlayer.addEventListener('loadstart', () => {
    // Update styling when a new track starts loading
    this.updateActiveTrackStyling();
  });

  this.audioPlayer.addEventListener('canplay', () => {
    // Ensure styling is correct when track is ready
    this.updateActiveTrackStyling();
  });

  this.audioPlayer.addEventListener('ended', () => {
    if (!this.shuffle && this.currentTrackIndex === this.playlist.length - 1) {
      this.playlistFinished = true;
      this.updatePlayButton();
      this.highlightFirstTrack();
    } else {
      this.playNextTrack();
    }
  });
  
  this.audioPlayer.addEventListener('timeupdate', () => {
    if (this.audioPlayer.currentTime >= 5 && !this.fiveSecondCallbackTriggered) {
      this.onFiveSecondMark(this.playlist[this.currentTrackIndex]);
      this.fiveSecondCallbackTriggered = true;
    }

    if (this.audioPlayer.duration) {
      const progressBar = this.controlsContainer.querySelector('.progress-bar');
      progressBar.value = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
      this.timeElapsedDisplay.textContent = this.formatTime(this.audioPlayer.currentTime);
      this.trackLengthDisplay.textContent = this.formatTime(this.audioPlayer.duration);
    }
  });

  this.audioPlayer.addEventListener('play', () => {
    this.fiveSecondCallbackTriggered = false;
    this.playlistFinished = false;
    this.updatePlayButton();
  });

  this.audioPlayer.addEventListener('pause', () => {
    this.updatePlayButton();
  });
};

AudioPlayer.prototype.formatTime = function(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

AudioPlayer.prototype.updatePlayButton = function() {
  this.playButtonElement.innerHTML = this.audioPlayer.paused ? PLAY_SYMBOL : PAUSE_SYMBOL;
};

AudioPlayer.prototype.highlightFirstTrack = function() {
  if (this.playlist.length > 0) {
    Array.from(this.trackListElement.children).forEach((item, idx) => {
      item.classList.toggle('active', idx === 0);
    });
  }
};

// Modified loadAndPlayTrack function to ensure styling updates
AudioPlayer.prototype.loadAndPlayTrack = function(index) {
  if (index < 0 || index >= this.playlist.length) return;
  
  const track = this.playlist[index];
  if (!track) return;

  const wasPlaying = !this.audioPlayer.paused;
  
  this.currentTrackIndex = index;
  this.audioPlayer.src = track.url;
  this.audioPlayer.load();
  
  // Update active track styling immediately after changing currentTrackIndex
  this.updateActiveTrackStyling();
  
    this.audioPlayer.play().catch(error => {
      console.error('Playback failed:', error);
    });
  
  // Force another styling update after a short delay for mobile
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      this.updateActiveTrackStyling();
    }, 100);
  }
  
  this.onTrackStart(track, index);
};

AudioPlayer.prototype.playNextTrack = function() {
  let nextIndex;
  
  if (this.shuffle) {
    const remainingTracks = Array.from({ length: this.playlist.length }, (_, i) => i)
      .filter(i => !this.shuffleHistory.includes(i));

    if (remainingTracks.length === 0) {
      this.playlistFinished = true;
      this.audioPlayer.pause();
      this.updatePlayButton();
      this.highlightFirstTrack();
      return;
    }

    nextIndex = remainingTracks[Math.floor(Math.random() * remainingTracks.length)];
    this.shuffleHistory.push(nextIndex);
  } else {
    if (this.currentTrackIndex === this.playlist.length - 1) {
      this.playlistFinished = true;
      this.audioPlayer.pause();
      this.updatePlayButton();
      this.highlightFirstTrack();
      return;
    }
    nextIndex = this.currentTrackIndex + 1;
  }

  this.loadAndPlayTrack(nextIndex);
};

AudioPlayer.prototype.playPrevTrack = function() {
  this.playlistFinished = false;
  
  if (this.shuffle && this.shuffleHistory.length > 1) {
    this.shuffleHistory.pop();
    const prevIndex = this.shuffleHistory[this.shuffleHistory.length - 1];
    this.loadAndPlayTrack(prevIndex);
  } else {
    const prevIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.loadAndPlayTrack(prevIndex);
  }
};

AudioPlayer.prototype.addTrack = function(track) {
  if (!track || !track.title || !track.url) {
    throw new Error('Invalid track object. Must contain at least title and url properties');
  }
  this.playlist.push(track);
  this.loadPlaylistUI();
  return this.playlist.length - 1;
};

AudioPlayer.prototype.addTracks = function(tracks, playNext=false) {
  if (!Array.isArray(tracks)) {
    throw new Error('Tracks must be provided as an array');
  }
  
  const invalidTracks = tracks.filter(track => !track || !track.title || !track.url);
  if (invalidTracks.length > 0) {
    throw new Error('One or more tracks are invalid. Each track must contain at least title and url properties');
  }
  
  const startIndex = this.playlist.length;
  if (playNext) {
    this.playlist.splice(this.currentTrackIndex+1, 0, ...tracks);
  } else {
    this.playlist.push(...tracks);
  }
  this.loadPlaylistUI();
  return { startIndex, count: tracks.length };
};

AudioPlayer.prototype.clearPlaylist = function() {
  this.playlist = [];
  this.currentTrackIndex = 0;
  this.shuffleHistory = [];
  this.playlistFinished = false;
  this.loadPlaylistUI();
  this.audioPlayer.pause();
  this.updatePlayButton();
  this.timeElapsedDisplay.textContent = '0:00';
  this.trackLengthDisplay.textContent = '0:00';
  this.audioPlayer.src = '';
};

AudioPlayer.prototype.removeTrackFromPlaylist = function(index) {
  if (index < 0 || index >= this.playlist.length) {
    console.error('Invalid track index for removal');
    return;
  }

  // Don't allow removing currently playing track
  if (index === this.currentTrackIndex) {
    console.warn('Cannot remove currently playing track');
    return;
  }

  // Remove track from playlist
  const removedTrack = this.playlist.splice(index, 1)[0];
  console.log('Removed track:', removedTrack.title);

  // Adjust currentTrackIndex if necessary
  if (index < this.currentTrackIndex) {
    this.currentTrackIndex--;
  }

  // Remove from shuffle history if present
  if (this.shuffle && this.shuffleHistory.includes(index)) {
    const historyIndex = this.shuffleHistory.indexOf(index);
    this.shuffleHistory.splice(historyIndex, 1);
    
    // Adjust remaining shuffle history indices
    this.shuffleHistory = this.shuffleHistory.map(historyIndex => 
      historyIndex > index ? historyIndex - 1 : historyIndex
    );
  }

  // Reload playlist UI
  this.loadPlaylistUI();

  // If playlist is now empty, pause and reset
  if (this.playlist.length === 0) {
    this.audioPlayer.pause();
    this.currentTrackIndex = 0;
    this.audioPlayer.src = '';
    this.timeElapsedDisplay.textContent = '0:00';
    this.trackLengthDisplay.textContent = '0:00';
    this.updatePlayButton();
  }
  
  // Update any external state management (like React stores)
  if (typeof this.onPlaylistChange === 'function') {
    this.onPlaylistChange(this.playlist);
  }
};


// For browser environments
if (typeof window !== 'undefined') {
  window.AudioPlayer = AudioPlayer;
}

// For module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioPlayer;
  module.exports.AudioPlayer = AudioPlayer;
}
