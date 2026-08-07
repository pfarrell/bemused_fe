// src/components/player/SavePlaylistModal.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import SavePlaylistModal from './SavePlaylistModal';
import { apiService } from '../../services/api';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  apiService: { createPlaylist: vi.fn() },
}));

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
  apiService.createPlaylist.mockReset();
});

test('renders a name input and Save/Cancel buttons', () => {
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={vi.fn()} />);
  expect(screen.getByPlaceholderText('Enter playlist name')).toBeInTheDocument();
  expect(screen.getByText('Save')).toBeInTheDocument();
  expect(screen.getByText('Cancel')).toBeInTheDocument();
});

test('rejects an empty title without calling the API', () => {
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('Save'));
  expect(toast.error).toHaveBeenCalledWith('Please enter a playlist name');
  expect(apiService.createPlaylist).not.toHaveBeenCalled();
});

test('rejects a whitespace-only title without calling the API', () => {
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Enter playlist name'), { target: { value: '   ' } });
  fireEvent.click(screen.getByText('Save'));
  expect(toast.error).toHaveBeenCalledWith('Please enter a playlist name');
  expect(apiService.createPlaylist).not.toHaveBeenCalled();
});

test('submits the trimmed name and track ids, toasts success, and closes on success', async () => {
  apiService.createPlaylist.mockResolvedValue({ data: { id: 42, name: 'Road Trip' } });
  const onClose = vi.fn();
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText('Enter playlist name'), { target: { value: '  Road Trip  ' } });
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => {
    expect(apiService.createPlaylist).toHaveBeenCalledWith('Road Trip', [1, 2, 3]);
    expect(toast.success).toHaveBeenCalledWith('Saved as "Road Trip"');
    expect(onClose).toHaveBeenCalled();
  });
});

test('pressing Enter in the input submits the form', async () => {
  apiService.createPlaylist.mockResolvedValue({ data: { id: 42, name: 'Road Trip' } });
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={vi.fn()} />);
  const input = screen.getByPlaceholderText('Enter playlist name');
  fireEvent.change(input, { target: { value: 'Road Trip' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() => expect(apiService.createPlaylist).toHaveBeenCalledWith('Road Trip', [1, 2, 3]));
});

test('on API failure, toasts an error, re-enables Save, and keeps the modal open', async () => {
  apiService.createPlaylist.mockRejectedValue(new Error('network error'));
  const onClose = vi.fn();
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText('Enter playlist name'), { target: { value: 'Road Trip' } });
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to save playlist'));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Save')).not.toBeDisabled();
});

test('disables the Save button while a save is in flight', async () => {
  let resolveCreate;
  apiService.createPlaylist.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Enter playlist name'), { target: { value: 'Road Trip' } });
  fireEvent.click(screen.getByText('Save'));

  expect(screen.getByText('Saving…')).toBeDisabled();
  resolveCreate({ data: { id: 1 } });
  await waitFor(() => expect(apiService.createPlaylist).toHaveBeenCalled());
});

test('clicking Cancel calls onClose without saving', () => {
  const onClose = vi.fn();
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={onClose} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onClose).toHaveBeenCalled();
  expect(apiService.createPlaylist).not.toHaveBeenCalled();
});

test('clicking the backdrop calls onClose', () => {
  const onClose = vi.fn();
  render(<SavePlaylistModal trackIds={[1, 2, 3]} onClose={onClose} />);
  fireEvent.click(screen.getByTestId('save-playlist-modal-backdrop'));
  expect(onClose).toHaveBeenCalled();
});
