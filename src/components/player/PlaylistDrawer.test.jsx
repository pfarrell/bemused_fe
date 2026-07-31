import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlaylistDrawer from './PlaylistDrawer';
import { usePlayerStore } from '../../stores/playerStore';

vi.mock('../../services/api', () => ({ apiService: { getImageUrl: () => 'http://example.com/art.jpg' } }));

const track = (id, overrides = {}) => ({ id, title: `Track ${id}`, url: `/stream/${id}`, duration: 125, artist: { name: 'Artist' }, ...overrides });

const renderDrawer = () => render(<MemoryRouter><PlaylistDrawer /></MemoryRouter>);

beforeEach(() => {
  usePlayerStore.setState({
    playlist: [track(1), track(2), track(3)],
    currentTrackIndex: 1,
    drawerOpen: true,
    recentlyAddedIndices: [],
    playTrackAtIndex: vi.fn(),
    removeTrackFromPlaylist: vi.fn(),
    reorderPlaylist: vi.fn(),
    togglePlayPause: vi.fn(),
    toggleDrawer: vi.fn(),
  });
});

test('renders nothing when the drawer is closed', () => {
  usePlayerStore.setState({ drawerOpen: false });
  renderDrawer();
  expect(document.querySelector('.music-player-playlist-container')).toBeNull();
});

test('renders every track in the playlist', () => {
  renderDrawer();
  expect(screen.getByText(/Track 1/)).toBeInTheDocument();
  expect(screen.getByText(/Track 2/)).toBeInTheDocument();
  expect(screen.getByText(/Track 3/)).toBeInTheDocument();
});

test('only flashes the track at the position recorded in recentlyAddedIndices at mount time', () => {
  usePlayerStore.setState({ recentlyAddedIndices: [2] }); // track 3 is at index 2
  renderDrawer();
  const row1 = screen.getByText(/Track 1/).closest('.track-item');
  const row3 = screen.getByText(/Track 3/).closest('.track-item');
  expect(row1.querySelector('.track-item-activity-overlay')).toBeNull();
  expect(row3.querySelector('.track-item-activity-overlay')).not.toBeNull();
});

test('clears recentlyAddedIndices after mount so a later open does not re-flash', () => {
  usePlayerStore.setState({ recentlyAddedIndices: [2] });
  renderDrawer();
  expect(usePlayerStore.getState().recentlyAddedIndices).toEqual([]);
});

test('regression: queueing a track whose id already exists elsewhere in the playlist only flashes the new occurrence', () => {
  usePlayerStore.setState({ playlist: [track(5)], currentTrackIndex: 0, isPlaying: true, recentlyAddedIndices: [] });
  renderDrawer();

  act(() => usePlayerStore.getState().addTrack(track(5), { flashActivity: true }));
  act(() => usePlayerStore.setState({ drawerOpen: false }));
  act(() => usePlayerStore.setState({ drawerOpen: true }));

  const rows = screen.getAllByText(/Track 5/).map((el) => el.closest('.track-item'));
  expect(rows).toHaveLength(2);
  expect(rows[0].querySelector('.track-item-activity-overlay')).toBeNull(); // pre-existing occurrence
  expect(rows[1].querySelector('.track-item-activity-overlay')).not.toBeNull(); // newly queued occurrence
});

test('reported scenario: only the latest add flashes, and only on its first open (component never unmounts between opens)', () => {
  // PlaylistDrawer is always rendered by MusicPlayerWrapper and only
  // internally returns null when closed — it never actually unmounts, so
  // this test renders once and drives every step through the store, exactly
  // like the real app, instead of calling render() again per step (which
  // would hide this class of bug behind a fresh mount each time).
  usePlayerStore.setState({ playlist: [track(1)], currentTrackIndex: 0, drawerOpen: false, recentlyAddedIndices: [] });
  renderDrawer();

  // Queue track 2 (flashActivity, lands at index 1), then play-next track 3
  // (flashActivity, inserted after current index 0, so also lands at index 1)
  // — neither has been viewed yet, drawer still closed.
  act(() => usePlayerStore.setState({ playlist: [track(1), track(2)], recentlyAddedIndices: [1] }));
  act(() => usePlayerStore.setState({ playlist: [track(1), track(3), track(2)], recentlyAddedIndices: [1] }));

  // First open: only track 3 (the latest batch) should flash, not track 2.
  act(() => usePlayerStore.setState({ drawerOpen: true }));
  let rows = screen.getAllByText(/Track [1-3]/).map((el) => el.closest('.track-item'));
  expect(rows[0].querySelector('.track-item-activity-overlay')).toBeNull(); // track 1
  expect(rows[1].querySelector('.track-item-activity-overlay')).not.toBeNull(); // track 3, position 2
  expect(rows[2].querySelector('.track-item-activity-overlay')).toBeNull(); // track 2

  // Close and reopen: nothing should flash now.
  act(() => usePlayerStore.setState({ drawerOpen: false }));
  act(() => usePlayerStore.setState({ drawerOpen: true }));
  rows = screen.getAllByText(/Track [1-3]/).map((el) => el.closest('.track-item'));
  rows.forEach((row) => expect(row.querySelector('.track-item-activity-overlay')).toBeNull());

  // Close, add track 4 to queue, reopen: only track 4 should flash.
  act(() => usePlayerStore.setState({ drawerOpen: false }));
  act(() => usePlayerStore.setState({ playlist: [track(1), track(3), track(2), track(4)], recentlyAddedIndices: [3] }));
  act(() => usePlayerStore.setState({ drawerOpen: true }));
  rows = screen.getAllByText(/Track [1-4]/).map((el) => el.closest('.track-item'));
  expect(rows[3].querySelector('.track-item-activity-overlay')).not.toBeNull(); // track 4, position 4
  [rows[0], rows[1], rows[2]].forEach((row) => expect(row.querySelector('.track-item-activity-overlay')).toBeNull());
});

test('clicking a non-current row plays that track', () => {
  renderDrawer();
  fireEvent.click(screen.getByText(/Track 3/));
  expect(usePlayerStore.getState().playTrackAtIndex).toHaveBeenCalledWith(2);
});

test('clicking the current row toggles play/pause instead of replaying', () => {
  renderDrawer();
  fireEvent.click(screen.getByText(/Track 2/));
  expect(usePlayerStore.getState().togglePlayPause).toHaveBeenCalled();
  expect(usePlayerStore.getState().playTrackAtIndex).not.toHaveBeenCalled();
});

test('the delete button removes that track and does not also trigger a row click', () => {
  renderDrawer();
  const row = screen.getByText(/Track 3/).closest('.track-item');
  fireEvent.click(row.querySelector('.track-delete-button'));
  expect(usePlayerStore.getState().removeTrackFromPlaylist).toHaveBeenCalledWith(2);
  expect(usePlayerStore.getState().playTrackAtIndex).not.toHaveBeenCalled();
});

test('tapping the delete button on mobile removes the track instead of playing it', () => {
  const originalInnerWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });

  renderDrawer();
  const row = screen.getByText(/Track 3/).closest('.track-item');
  const deleteButton = row.querySelector('.track-delete-button');

  // A real tap on the delete button: touchstart/touchend on the button bubble
  // up to the row's own touch handlers, and the browser follows touchend with
  // a synthesized click (jsdom doesn't do this automatically, so fire it too).
  fireEvent.touchStart(deleteButton, { bubbles: true, touches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.touchEnd(deleteButton, { bubbles: true, changedTouches: [{ clientX: 50, clientY: 50 }] });
  fireEvent.click(deleteButton);

  expect(usePlayerStore.getState().playTrackAtIndex).not.toHaveBeenCalled();
  expect(usePlayerStore.getState().removeTrackFromPlaylist).toHaveBeenCalledWith(2);

  Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
});

test('clicking the backdrop closes the drawer', () => {
  renderDrawer();
  fireEvent.click(document.querySelector('.playlist-backdrop'));
  expect(usePlayerStore.getState().toggleDrawer).toHaveBeenCalled();
});

test('the currently playing row has the active class', () => {
  renderDrawer();
  expect(screen.getByText(/Track 2/).closest('.track-item')).toHaveClass('active');
});

test('drag-forward reorder: dragging track at index 0 to drop target index 3 calls reorderPlaylist with correct pre-removal index', () => {
  const mockReorderPlaylist = vi.fn();
  usePlayerStore.setState({
    playlist: [track(1), track(2), track(3), track(4)],
    currentTrackIndex: 0,
    drawerOpen: true,
    playTrackAtIndex: vi.fn(),
    removeTrackFromPlaylist: vi.fn(),
    reorderPlaylist: mockReorderPlaylist,
    togglePlayPause: vi.fn(),
    toggleDrawer: vi.fn(),
  });

  const getBoundingClientRectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  getBoundingClientRectSpy.mockReturnValue({
    top: 100,
    height: 50,
    bottom: 150,
    left: 0,
    right: 300,
    width: 300,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  });

  renderDrawer();

  const rows = screen.getAllByText(/Track [1-4]/);
  const row0 = rows[0].closest('.track-item');
  const row3 = rows[3].closest('.track-item');

  // Drag from row 0 (Track 1)
  fireEvent.dragStart(row0);

  // Drag over row 3 (must call dragOver to allow drop)
  fireEvent.dragOver(row3);

  // Drop on row 3 (Track 4) at a position below its midpoint
  // midpoint = 100 + 50/2 = 125, so clientY = 140 is below midpoint -> insert after (index + 1 = 4)
  // Create a synthetic event and manually set clientY
  const dropEvent = new Event('drop', { bubbles: true });
  Object.defineProperty(dropEvent, 'clientY', { value: 140, enumerable: true });
  Object.defineProperty(dropEvent, 'currentTarget', { value: row3, enumerable: true });
  Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn(), enumerable: true });
  row3.dispatchEvent(dropEvent);

  // Verify reorderPlaylist was called with (0, 4), not (0, 3)
  expect(mockReorderPlaylist).toHaveBeenCalledWith(0, 4);

  getBoundingClientRectSpy.mockRestore();
});
