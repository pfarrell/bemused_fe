// src/components/NotesSection.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotesSection from './NotesSection';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getRecallConnectUrl: () => '/api/auth/recall/connect',
    addAlbumNote: vi.fn(),
    deleteAlbumNote: vi.fn(),
    getRecallItemUrl: (id) => `https://patf.com/recall/items/${id}`,
  },
}));

const renderNotes = (props) =>
  render(
    <MemoryRouter initialEntries={['/album/10']}>
      <NotesSection albumId={10} notes={[]} isLoggedIn={true} onChange={vi.fn()} {...props} />
    </MemoryRouter>
  );

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: false } });
});

describe('NotesSection', () => {
  test('shows a Connect Recall link when the user has not connected', () => {
    renderNotes();
    expect(screen.getByText('Connect Recall to write notes')).toBeInTheDocument();
  });

  test('shows a textarea and Post button when connected', () => {
    useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: true } });
    renderNotes();
    expect(screen.getByPlaceholderText(/Write a note/)).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });

  test('posts a note and calls onChange on success', async () => {
    useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: true } });
    apiService.addAlbumNote.mockResolvedValue({ data: { id: 5, recall_item_id: 'abc' } });
    const onChange = vi.fn();

    renderNotes({ onChange });
    fireEvent.change(screen.getByPlaceholderText(/Write a note/), { target: { value: 'Great record' } });
    fireEvent.click(screen.getByText('Post'));

    await waitFor(() => expect(apiService.addAlbumNote).toHaveBeenCalledWith(10, 'Great record'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('renders Markdown content for a normal note', () => {
    renderNotes({
      notes: [{ id: 1, recall_item_id: 'abc', author: { id: 2, username: 'pat' }, created_at: '2026-07-27T00:00:00Z', title: 't', content: '**bold** text' }],
    });
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  test('renders "Note unavailable" for a note whose Recall fetch failed', () => {
    renderNotes({
      notes: [{ id: 1, author: { id: 2, username: 'pat' }, created_at: '2026-07-27T00:00:00Z', error: true }],
    });
    expect(screen.getByText('Note unavailable')).toBeInTheDocument();
  });

  test('renders without throwing when a note has a missing author', () => {
    renderNotes({
      notes: [{ id: 1, recall_item_id: 'abc', author: null, created_at: '2026-07-27T00:00:00Z', title: 't', content: 'hi' }],
    });
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  test('shows a remove link only for the note author or an admin', () => {
    renderNotes({
      notes: [{ id: 1, recall_item_id: 'abc', author: { id: 999, username: 'other' }, created_at: '2026-07-27T00:00:00Z', title: 't', content: 'hi' }],
    });
    expect(screen.queryByText('remove')).not.toBeInTheDocument();
  });

  test('shows a remove link for the note\'s own author', () => {
    useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: false } });
    renderNotes({
      notes: [{ id: 1, recall_item_id: 'abc', author: { id: 1, username: 'pat' }, created_at: '2026-07-27T00:00:00Z', title: 't', content: 'hi' }],
    });
    expect(screen.getByText('remove')).toBeInTheDocument();
  });

  test('shows a remove link for an admin viewing someone else\'s note', () => {
    useAuthStore.setState({ user: { id: 1, admin: true, recall_connected: false } });
    renderNotes({
      notes: [{ id: 1, recall_item_id: 'abc', author: { id: 999, username: 'other' }, created_at: '2026-07-27T00:00:00Z', title: 't', content: 'hi' }],
    });
    expect(screen.getByText('remove')).toBeInTheDocument();
  });

  test('shows a remove link for an error note owned by the current user', () => {
    useAuthStore.setState({ user: { id: 1, admin: false, recall_connected: false } });
    renderNotes({
      notes: [{ id: 1, author: { id: 1, username: 'pat' }, created_at: '2026-07-27T00:00:00Z', error: true }],
    });
    expect(screen.getByText('remove')).toBeInTheDocument();
  });
});
