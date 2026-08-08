import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminCollection from './AdminCollection';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getCollection: vi.fn(),
    updateCollection: vi.fn(),
    search: vi.fn(),
    addStubToCollection: vi.fn(),
    removeStubFromCollection: vi.fn(),
    resolveStub: vi.fn(),
    addAlbumToCollection: vi.fn(),
    getImageUrl: () => 'http://example.com/image.jpg',
  },
}));

const collectionPayload = {
  collection: { id: 7, name: 'Road Trip Mix', image_path: null, wikipedia: null },
  albums: [],
  notes: [],
  summary: null,
};

const renderAdminCollection = () =>
  render(
    <MemoryRouter initialEntries={['/admin/collection/7']}>
      <Routes>
        <Route path="/admin/collection/:id" element={<AdminCollection />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getCollection.mockResolvedValue({ data: collectionPayload });
});

describe('AdminCollection — wikipedia field', () => {
  test('reflects the loaded wikipedia value', async () => {
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, collection: { ...collectionPayload.collection, wikipedia: 'Kind_of_Blue' } },
    });
    renderAdminCollection();
    const input = await screen.findByLabelText('Wikipedia');
    expect(input).toHaveValue('Kind_of_Blue');
  });

  test('saving sends the edited wikipedia value', async () => {
    apiService.updateCollection.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderAdminCollection();

    const input = await screen.findByLabelText('Wikipedia');
    await user.type(input, 'Kind_of_Blue');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiService.updateCollection).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ wikipedia: 'Kind_of_Blue' })
    ));
  });
});

describe('AdminCollection — placeholder stub', () => {
  test('adds a placeholder stub via the "Add a placeholder" form', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [] },
    });
    apiService.addStubToCollection = vi.fn().mockResolvedValue({
      data: { stub: { id: 1, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 } },
    });
    renderAdminCollection();

    await user.click(await screen.findByText('+ Add Album'));
    await user.click(screen.getByText(/Add a placeholder instead/i));
    await user.type(screen.getByLabelText('Title'), 'Abbey Road');
    await user.type(screen.getByLabelText('Artist'), 'The Beatles');
    await user.click(screen.getByRole('button', { name: 'Add Placeholder' }));

    expect(apiService.addStubToCollection).toHaveBeenCalledWith('7', 'Abbey Road', 'The Beatles');
    expect(await screen.findByText('Abbey Road')).toBeInTheDocument();
  });

  test('removes a stub', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Missing Album', artist_name: 'Missing Artist', order: 1 }] },
    });
    apiService.removeStubFromCollection = vi.fn().mockResolvedValue({});
    window.confirm = vi.fn(() => true);
    renderAdminCollection();

    await user.click(await screen.findByText('Remove Placeholder'));
    expect(apiService.removeStubFromCollection).toHaveBeenCalledWith('7', 9);
    expect(screen.queryByText('Missing Album')).not.toBeInTheDocument();
  });

  test('resolves a stub into a real album', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 }] },
    });
    apiService.search = vi.fn().mockResolvedValue({
      data: { results: [{ type: 'album', data: { id: 42, title: 'Abbey Road', artist: { name: 'The Beatles' } } }] },
    });
    apiService.resolveStub = vi.fn().mockResolvedValue({});
    renderAdminCollection();

    await user.click(await screen.findByText('Resolve'));
    await user.type(screen.getByPlaceholderText('Search for albums...'), 'Abbey Road');
    await user.click(screen.getByText('Search', { selector: 'button' }));
    await user.click(await screen.findByText('Add', { selector: 'button' }));

    expect(apiService.resolveStub).toHaveBeenCalledWith('7', 9, 42);
  });

  test('cancelling Resolve by closing the search panel does not leave resolve-mode active for the next add', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 }] },
    });
    apiService.search = vi.fn().mockResolvedValue({
      data: { results: [{ type: 'album', data: { id: 55, title: 'Let It Be', artist: { name: 'The Beatles' } } }] },
    });
    apiService.addAlbumToCollection = vi.fn().mockResolvedValue({});
    apiService.resolveStub = vi.fn().mockResolvedValue({});
    renderAdminCollection();

    // Enter resolve mode for the stub, then back out without picking a result.
    await user.click(await screen.findByText('Resolve'));
    await user.click(screen.getByText('Close Search'));

    // Now use the normal Add Album flow to add an unrelated album.
    await user.click(await screen.findByText('+ Add Album'));
    await user.type(screen.getByPlaceholderText('Search for albums...'), 'Let It Be');
    await user.click(screen.getByText('Search', { selector: 'button' }));
    await user.click(await screen.findByText('Add', { selector: 'button' }));

    expect(apiService.addAlbumToCollection).toHaveBeenCalledWith('7', 55);
    expect(apiService.resolveStub).not.toHaveBeenCalled();
  });
});
