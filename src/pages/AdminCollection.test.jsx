import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    removeAlbumFromCollection: vi.fn(),
    reorderCollectionAlbums: vi.fn(),
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

  test('clicking Resolve clears a prior unrelated search so stale results are not shown', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 }] },
    });
    apiService.search = vi.fn().mockResolvedValue({
      data: { results: [{ type: 'album', data: { id: 55, title: 'Let It Be', artist: { name: 'The Beatles' } } }] },
    });
    renderAdminCollection();

    // Search for something unrelated via the normal Add Album flow first.
    await user.click(await screen.findByText('+ Add Album'));
    await user.type(screen.getByPlaceholderText('Search for albums...'), 'Let It Be');
    await user.click(screen.getByText('Search', { selector: 'button' }));
    expect(await screen.findByText('Let It Be')).toBeInTheDocument();

    // Now click Resolve on the stub without closing the search panel first.
    await user.click(screen.getByText('Resolve'));

    expect(screen.queryByText('Let It Be')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for albums...')).toHaveValue('');
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

describe('AdminCollection — interleaved drag-reorder', () => {
  test('dragging a stub between two albums saves an interleaved order', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 3, artist: { name: 'X' } },
        ],
        stubs: [{ id: 9, title: 'Missing', artist_name: 'Y', order: 2 }],
      },
    });
    apiService.reorderCollectionAlbums = vi.fn().mockResolvedValue({});
    renderAdminCollection();

    const stubRow = (await screen.findByText('Missing')).closest('[draggable]');
    const albumARow = screen.getByText('A').closest('[draggable]');

    // jsdom's synthetic drag events don't provide a dataTransfer object by default;
    // the component's handlers set effectAllowed/dropEffect on it, so without this
    // fireEvent throws "Cannot set properties of undefined" instead of exercising the drop.
    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    // Drag the stub to where album A currently is (position 1)
    fireEvent.dragStart(stubRow, { dataTransfer });
    fireEvent.dragOver(albumARow, { dataTransfer });
    fireEvent.drop(albumARow, { dataTransfer });

    expect(apiService.reorderCollectionAlbums).toHaveBeenCalledWith(
      '7',
      expect.arrayContaining([
        expect.objectContaining({ album_id: 1 }),
        expect.objectContaining({ album_id: 2 }),
      ]),
      expect.arrayContaining([expect.objectContaining({ stub_id: 9, order: 1 })])
    );
  });

  test('dragging an album past a stub updates both orders together', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 3, artist: { name: 'X' } },
        ],
        stubs: [{ id: 9, title: 'Missing', artist_name: 'Y', order: 2 }],
      },
    });
    apiService.reorderCollectionAlbums = vi.fn().mockResolvedValue({});
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    const albumBRow = screen.getByText('B').closest('[draggable]');

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    // Drag album A past album B (to the end)
    fireEvent.dragStart(albumARow, { dataTransfer });
    fireEvent.dragOver(albumBRow, { dataTransfer });
    fireEvent.drop(albumBRow, { dataTransfer });

    const [, albumOrders, stubOrders] = apiService.reorderCollectionAlbums.mock.calls[0];
    const orderOf = (arr, key, id) => arr.find(x => x[key] === id)?.order;
    expect(orderOf(albumOrders, 'album_id', 2)).toBeLessThan(orderOf(albumOrders, 'album_id', 1));
    expect(stubOrders[0].order).toBeGreaterThan(0);
  });
});

describe('AdminCollection — optimistic order for newly added/resolved albums', () => {
  // The row's position label (index + 1) is rendered right next to the title, and
  // reflects buildMergedItems()'s sort by `order` — so reading it back after an
  // optimistic update tells us what `order` the item actually landed on locally.
  const positionOf = (row) => row.querySelector('span').textContent;

  test('adding a real album via search places it after existing albums/stubs, not at the top', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 3, artist: { name: 'X' } },
        ],
        stubs: [{ id: 9, title: 'Missing', artist_name: 'Y', order: 2 }],
      },
    });
    apiService.search = vi.fn().mockResolvedValue({
      data: { results: [{ type: 'album', data: { id: 42, title: 'C', artist: { name: 'Z' } } }] },
    });
    apiService.addAlbumToCollection = vi.fn().mockResolvedValue({});
    renderAdminCollection();

    await user.click(await screen.findByText('+ Add Album'));
    await user.type(screen.getByPlaceholderText('Search for albums...'), 'C');
    await user.click(screen.getByText('Search', { selector: 'button' }));
    await user.click(await screen.findByText('Add', { selector: 'button' }));

    // Existing max order across albums (1, 3) and stubs (2) is 3, so the new
    // album should land at order 4 — last of four items — not order 0/top.
    const row = (await screen.findByText('C')).closest('[draggable]');
    expect(positionOf(row)).toBe('4');
  });

  test('resolving a stub gives the new album the stub\'s former order, preserving its position', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 3, artist: { name: 'X' } },
        ],
        stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 2 }],
      },
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

    // The stub had order 2 (between A at order 1 and B at order 3); the resolved
    // album must keep that order, landing in the middle, not at order 0/top.
    const row = (await screen.findByText('Abbey Road')).closest('[draggable]');
    expect(positionOf(row)).toBe('2');
  });
});
