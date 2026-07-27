// src/components/TrackNotesModal.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrackNotesModal from './TrackNotesModal';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getRecallConnectUrl: () => '/api/auth/recall/connect',
    getTrackNotes: vi.fn(),
    addTrackNote: vi.fn(),
    deleteTrackNote: vi.fn(),
    getRecallItemUrl: (id) => `https://patf.com/recall/items/${id}`,
  },
}));

const mockTrack = { id: 42, title: 'Test Track' };

const renderModal = (props) =>
  render(
    <MemoryRouter initialEntries={['/album/10']}>
      <TrackNotesModal track={mockTrack} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: true }, isAuthenticated: true });
  apiService.getTrackNotes.mockResolvedValue({ data: { notes: [] } });
});

describe('TrackNotesModal', () => {
  test('shows the track title', async () => {
    renderModal();
    expect(await screen.findByText('Test Track')).toBeInTheDocument();
  });

  test('fetches notes for the track on mount', async () => {
    renderModal();
    await waitFor(() => expect(apiService.getTrackNotes).toHaveBeenCalledWith(42));
  });

  test('shows "No notes yet" when there are none', async () => {
    renderModal();
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
  });

  test('renders Markdown content for a fetched note', async () => {
    apiService.getTrackNotes.mockResolvedValue({
      data: { notes: [{ id: 1, recall_item_id: 'abc', author: { id: 2, username: 'pat' }, created_at: '2026-07-27T00:00:00Z', title: 't', content: '**bold** text' }] },
    });
    renderModal();
    expect(await screen.findByText('bold')).toBeInTheDocument();
  });

  test('posts a note and refetches', async () => {
    apiService.addTrackNote.mockResolvedValue({ data: { id: 5, recall_item_id: 'abc' } });
    renderModal();
    await screen.findByText('No notes yet');

    fireEvent.change(screen.getByPlaceholderText(/Write a note/), { target: { value: 'Great track' } });
    fireEvent.click(screen.getByText('Post'));

    await waitFor(() => expect(apiService.addTrackNote).toHaveBeenCalledWith(42, 'Great track'));
    await waitFor(() => expect(apiService.getTrackNotes).toHaveBeenCalledTimes(2));
  });

  test('shows a Connect Recall link when the user has not connected', async () => {
    useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: false }, isAuthenticated: true });
    renderModal();
    expect(await screen.findByText('Connect Recall to write notes')).toBeInTheDocument();
  });

  test('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await screen.findByText('No notes yet');
    fireEvent.click(screen.getByTestId('track-notes-modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
