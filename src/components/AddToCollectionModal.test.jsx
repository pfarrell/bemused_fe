import { render, screen, waitFor } from '@testing-library/react';
import AddToCollectionModal from './AddToCollectionModal';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

vi.mock('../services/api', () => ({
  apiService: {
    getCollections: vi.fn(),
    addAlbumToCollection: vi.fn(),
    createCollection: vi.fn(),
  },
}));

const album = { id: 1, title: 'Test Album' };

const collections = [
  { id: 10, name: 'My Collection', user_id: 5 },
  { id: 11, name: "Someone Else's Collection", user_id: 99 },
];

beforeEach(() => {
  apiService.getCollections.mockResolvedValue({ data: collections });
});

test('only lists collections owned by the current user when not admin', async () => {
  useAuthStore.setState({ isAdmin: false, user: { id: 5 } });
  render(<AddToCollectionModal album={album} onClose={vi.fn()} />);

  await waitFor(() => expect(screen.getByText('My Collection')).toBeInTheDocument());
  expect(screen.queryByText("Someone Else's Collection")).not.toBeInTheDocument();
});

test('lists every collection when the current user is admin', async () => {
  useAuthStore.setState({ isAdmin: true, user: { id: 1 } });
  render(<AddToCollectionModal album={album} onClose={vi.fn()} />);

  await waitFor(() => expect(screen.getByText('My Collection')).toBeInTheDocument());
  expect(screen.getByText("Someone Else's Collection")).toBeInTheDocument();
});

test('lists no collections when logged out (no matching user)', async () => {
  useAuthStore.setState({ isAdmin: false, user: null });
  render(<AddToCollectionModal album={album} onClose={vi.fn()} />);

  await waitFor(() => expect(apiService.getCollections).toHaveBeenCalled());
  expect(screen.queryByText('My Collection')).not.toBeInTheDocument();
  expect(screen.queryByText("Someone Else's Collection")).not.toBeInTheDocument();
});
