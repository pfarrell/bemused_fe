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

// Continue with existing methods but update them to use CSS classes instead of inline styles

AudioPlayer.prototype.loadPlaylistUI = function() {
  this.trackListElement.innerHTML = '';

  this.playlist.forEach((track, index) => {
    const listItem = document.createElement('li');
    const prefix = this.getTrackPrefix(track, index);

    listItem.className = 'track-item';
    listItem.draggable = true;
    
    if (prefix) {
      const prefixElement = document.createElement('span');
      prefixElement.className = 'track-prefix';
      prefixElement.innerHTML = prefix;
      listItem.appendChild(prefixElement);
    }

    const dragHandle = document.createElement('span');
    dragHandle.innerHTML = DRAG_HANDLE;
    dragHandle.className = 'drag-handle';

    const trackText = document.createElement('span');
    trackText.className = 'track-text';
    trackText.textContent = `${index + 1}. ${track.title} - ${track.artist} (${track.duration})`;

    listItem.appendChild(trackText);
    listItem.appendChild(dragHandle);

    // Drag and drop event listeners
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

      // Update active track styling
      Array.from(this.trackListElement.children).forEach((item, idx) => {
        item.classList.toggle('active', idx === this.currentTrackIndex);
      });
    });

    // Click to play track
    trackText.addEventListener('click', () => {
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
    });

    this.trackListElement.appendChild(listItem);
  });
  
  Array.from(this.trackListElement.children).forEach((item, idx) => {
    item.classList.toggle('active', idx === this.currentTrackIndex);
  });
};

// Keep all your existing methods: attachAudioPlayerListeners, formatTime, updatePlayButton,
// highlightFirstTrack, loadAndPlayTrack, playNextTrack, playPrevTrack, addTrack, addTracks, clearPlaylist

AudioPlayer.prototype.attachAudioPlayerListeners = function() {
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

AudioPlayer.prototype.loadAndPlayTrack = function(index) {
  try {
    if (this.playlist.length == 0) {
      return;
    }
    if (index < 0 || index >= this.playlist.length) {
      throw new Error('Invalid track index');
    }

    if (this.currentTrackIndex !== index || this.audioPlayer.paused) {
      this.audioPlayer.src = this.playlist[index].url;
      this.currentTrackIndex = index;
      this.onTrackStart(this.playlist[index]);
      if (this.shuffle && !this.shuffleHistory.includes(index)) {
        this.shuffleHistory.push(index);
      }
    }

    this.audioPlayer.play();
    this.playlistFinished = false;

    Array.from(this.trackListElement.children).forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    this.updatePlayButton();
  } catch (error) {
    console.error('Error loading track:', error);
  }
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

// For browser environments
if (typeof window !== 'undefined') {
  window.AudioPlayer = AudioPlayer;
}

// For module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioPlayer;
  module.exports.AudioPlayer = AudioPlayer;
}
