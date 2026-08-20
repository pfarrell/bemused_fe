import { render, screen, waitFor, fireEvent, createEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminCollection from './AdminCollection';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';

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

// jsdom doesn't implement scrollIntoView at all — the search panel's
// scroll-into-view effect would otherwise throw on every render where it's open.
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getCollection.mockResolvedValue({ data: collectionPayload });
  useAuthStore.setState({ isAdmin: true, user: { id: 1 } });
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

describe('AdminCollection — row context menu', () => {
  const threeRowPayload = {
    ...collectionPayload,
    albums: [
      { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
      { id: 2, title: 'B', order: 2, artist: { name: 'X' } },
    ],
    stubs: [{ id: 9, title: 'Missing', artist_name: 'Y', order: 3 }],
  };

  test('right-click opens a menu with Send to Top / Send to Bottom', async () => {
    apiService.getCollection.mockResolvedValue({ data: threeRowPayload });
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    expect(screen.queryByText('⬆ Send to Top')).not.toBeInTheDocument();

    fireEvent.contextMenu(albumARow);

    expect(screen.getByText('⬆ Send to Top')).toBeInTheDocument();
    expect(screen.getByText('⬇ Send to Bottom')).toBeInTheDocument();
  });

  test('right-clicking the Remove button does not open the row menu', async () => {
    apiService.getCollection.mockResolvedValue({ data: threeRowPayload });
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    const removeButton = albumARow.querySelector('button');
    fireEvent.contextMenu(removeButton);

    expect(screen.queryByText('⬆ Send to Top')).not.toBeInTheDocument();
  });

  test('Send to Top moves an album to the front of a mixed album/stub list', async () => {
    apiService.getCollection.mockResolvedValue({ data: threeRowPayload });
    apiService.reorderCollectionAlbums = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderAdminCollection();

    const albumBRow = (await screen.findByText('B')).closest('[draggable]');
    fireEvent.contextMenu(albumBRow);
    await user.click(screen.getByText('⬆ Send to Top'));

    const [, albumOrders, stubOrders] = apiService.reorderCollectionAlbums.mock.calls[0];
    const orderOf = (arr, key, id) => arr.find((x) => x[key] === id)?.order;
    expect(orderOf(albumOrders, 'album_id', 2)).toBe(1);
    expect(orderOf(albumOrders, 'album_id', 1)).toBeGreaterThan(1);
    expect(orderOf(stubOrders, 'stub_id', 9)).toBeGreaterThan(orderOf(albumOrders, 'album_id', 2));
  });

  test('Send to Bottom moves a stub past all albums', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 2, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 3, artist: { name: 'X' } },
        ],
        stubs: [{ id: 9, title: 'Missing', artist_name: 'Y', order: 1 }],
      },
    });
    apiService.reorderCollectionAlbums = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    renderAdminCollection();

    const stubRow = (await screen.findByText('Missing')).closest('[draggable]');
    fireEvent.contextMenu(stubRow);
    await user.click(screen.getByText('⬇ Send to Bottom'));

    const [, albumOrders, stubOrders] = apiService.reorderCollectionAlbums.mock.calls[0];
    const orderOf = (arr, key, id) => arr.find((x) => x[key] === id)?.order;
    expect(orderOf(stubOrders, 'stub_id', 9)).toBe(3);
    expect(orderOf(albumOrders, 'album_id', 1)).toBeLessThan(3);
    expect(orderOf(albumOrders, 'album_id', 2)).toBeLessThan(3);
  });

  test('a long-press also opens the row menu (mobile path)', async () => {
    apiService.getCollection.mockResolvedValue({ data: threeRowPayload });
    renderAdminCollection();
    const albumARow = (await screen.findByText('A')).closest('[draggable]');

    // Fake timers only wrap the long-press itself — findByText above needs
    // real timers to resolve its internal polling.
    vi.useFakeTimers();
    try {
      fireEvent.touchStart(albumARow, { touches: [{ clientX: 50, clientY: 50 }] });
      act(() => { vi.advanceTimersByTime(500); });
      expect(screen.getByText('⬆ Send to Top')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AdminCollection — edge auto-scroll', () => {
  test('auto-scrolls .main-content when a drag hovers the fixed header/footer overlay at the top or bottom edge', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [{ id: 1, title: 'A', order: 1, artist: { name: 'X' } }],
      },
    });

    // .app-header/.app-footer are position:fixed siblings of .main-content
    // that overlap its top/bottom edges (see index.css) — a real drag near
    // either screen edge has the cursor over one of those, not a descendant
    // of .main-content. Reproduce that by rendering into a real `.main-content`
    // container and dispatching the dragover on `document` (their actual
    // common ancestor) rather than on anything inside the container.
    const mainContentDiv = document.createElement('div');
    mainContentDiv.className = 'main-content';
    document.body.appendChild(mainContentDiv);
    mainContentDiv.getBoundingClientRect = () => ({ top: 0, bottom: 500, height: 500 });
    let scrollTopValue = 200;
    Object.defineProperty(mainContentDiv, 'scrollTop', {
      get: () => scrollTopValue,
      set: (v) => { scrollTopValue = v; },
      configurable: true,
    });

    // jsdom has no real animation-frame scheduler; capture the callback so the
    // test can step frames manually instead of relying on one being pumped.
    let rafCallback = null;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/admin/collection/7']}>
        <Routes>
          <Route path="/admin/collection/:id" element={<AdminCollection />} />
        </Routes>
      </MemoryRouter>,
      { container: mainContentDiv }
    );
    await screen.findByText('A');

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    const topEdgeDragOver = createEvent.dragOver(document, { dataTransfer });
    topEdgeDragOver.clientY = 10; // within the 60px top edge zone
    fireEvent(document, topEdgeDragOver);

    expect(rafCallback).toBeTypeOf('function');
    rafCallback();
    rafCallback();
    expect(mainContentDiv.scrollTop).toBeLessThan(200);

    const afterTopScroll = mainContentDiv.scrollTop;
    const bottomEdgeDragOver = createEvent.dragOver(document, { dataTransfer });
    bottomEdgeDragOver.clientY = 495; // within the 60px bottom edge zone
    fireEvent(document, bottomEdgeDragOver);
    rafCallback();
    rafCallback();
    expect(mainContentDiv.scrollTop).toBeGreaterThan(afterTopScroll);

    rafSpy.mockRestore();
    document.body.removeChild(mainContentDiv);
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
    // jsdom's getBoundingClientRect defaults to an all-zero rect; the drop
    // handler's before/after math needs a real rect to test against so a
    // hover in the row's upper half is unambiguous.
    albumARow.getBoundingClientRect = () => ({ top: 0, height: 100 });

    // jsdom's synthetic drag events don't provide a dataTransfer object by default;
    // the component's handlers set effectAllowed/dropEffect on it, so without this
    // fireEvent throws "Cannot set properties of undefined" instead of exercising the drop.
    // jsdom also has no DragEvent constructor at all, so fireEvent's shorthand silently
    // drops clientY (it falls back to a plain Event, which fireEvent can't extend with
    // MouseEvent-only init properties) — createEvent + a manual property assignment is
    // the reliable way to get a real clientY onto the dispatched event.
    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    const dragOverEvent = createEvent.dragOver(albumARow, { dataTransfer });
    dragOverEvent.clientY = 10;
    const dropEvent = createEvent.drop(albumARow, { dataTransfer });
    dropEvent.clientY = 10;
    // Drag the stub to where album A currently is (position 1) — hover its
    // upper half so the drop lands before it, not after.
    fireEvent.dragStart(stubRow, { dataTransfer });
    fireEvent(albumARow, dragOverEvent);
    fireEvent(albumARow, dropEvent);

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
    albumBRow.getBoundingClientRect = () => ({ top: 0, height: 100 });

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    const dragOverEvent = createEvent.dragOver(albumBRow, { dataTransfer });
    dragOverEvent.clientY = 90;
    const dropEvent = createEvent.drop(albumBRow, { dataTransfer });
    dropEvent.clientY = 90;
    // Drag album A past album B (to the end) — hover B's lower half so the
    // drop lands after it.
    fireEvent.dragStart(albumARow, { dataTransfer });
    fireEvent(albumBRow, dragOverEvent);
    fireEvent(albumBRow, dropEvent);

    const [, albumOrders, stubOrders] = apiService.reorderCollectionAlbums.mock.calls[0];
    const orderOf = (arr, key, id) => arr.find(x => x[key] === id)?.order;
    expect(orderOf(albumOrders, 'album_id', 2)).toBeLessThan(orderOf(albumOrders, 'album_id', 1));
    expect(stubOrders[0].order).toBeGreaterThan(0);
  });

  test('shows a drop indicator before the hovered row when dragging over its upper half', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 2, artist: { name: 'X' } },
        ],
      },
    });
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    const albumBRow = screen.getByText('B').closest('[draggable]');
    albumBRow.getBoundingClientRect = () => ({ top: 0, height: 100 });

    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(albumARow, { dataTransfer });
    const dragOverEvent = createEvent.dragOver(albumBRow, { dataTransfer });
    dragOverEvent.clientY = 10; // upper half of B's mocked 100px-tall rect
    fireEvent(albumBRow, dragOverEvent);

    const indicator = screen.getByTestId('drop-indicator');
    // The indicator is B's previous sibling when hovering its upper half —
    // i.e. it renders between A and B, not between B and nothing-after-it.
    expect(indicator.nextElementSibling).toBe(albumBRow);
  });

  test('shows a drop indicator after the hovered row when dragging over its lower half', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 2, artist: { name: 'X' } },
        ],
      },
    });
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    const albumBRow = screen.getByText('B').closest('[draggable]');
    albumARow.getBoundingClientRect = () => ({ top: 0, height: 100 });

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(albumBRow, { dataTransfer });
    const dragOverEvent = createEvent.dragOver(albumARow, { dataTransfer });
    dragOverEvent.clientY = 90; // lower half of A's mocked 100px-tall rect
    fireEvent(albumARow, dragOverEvent);

    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.previousElementSibling).toBe(albumARow);
  });

  test('clears the drop indicator when the drag ends', async () => {
    apiService.getCollection.mockResolvedValue({
      data: {
        ...collectionPayload,
        albums: [
          { id: 1, title: 'A', order: 1, artist: { name: 'X' } },
          { id: 2, title: 'B', order: 2, artist: { name: 'X' } },
        ],
      },
    });
    renderAdminCollection();

    const albumARow = (await screen.findByText('A')).closest('[draggable]');
    const albumBRow = screen.getByText('B').closest('[draggable]');
    albumBRow.getBoundingClientRect = () => ({ top: 0, height: 100 });

    const dataTransfer = { effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(albumARow, { dataTransfer });
    fireEvent.dragOver(albumBRow, { dataTransfer });
    expect(screen.getByTestId('drop-indicator')).toBeInTheDocument();

    fireEvent.dragEnd(albumARow, { dataTransfer });
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument();
  });
});

describe('AdminCollection — resolve/search panel scrolls into view', () => {
  test('scrolls the search panel into view when opened via "+ Add Album"', async () => {
    const user = userEvent.setup();
    renderAdminCollection();

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    await user.click(await screen.findByText('+ Add Album'));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      // 'start' (not 'nearest') so the top of a panel taller than the
      // viewport — the actual failure mode hit live — still lands the
      // search input on screen instead of showing only its tail end.
      expect.objectContaining({ block: 'start' })
    );
  });

  test('scrolls the search panel into view when opened via Resolve on a distant stub', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 }] },
    });
    renderAdminCollection();

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    await user.click(await screen.findByText('Resolve'));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  test('shows which placeholder is being resolved', async () => {
    const user = userEvent.setup();
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, stubs: [{ id: 9, title: 'Abbey Road', artist_name: 'The Beatles', order: 1 }] },
    });
    renderAdminCollection();

    expect(screen.queryByText(/Resolving placeholder/)).not.toBeInTheDocument();
    await user.click(await screen.findByText('Resolve'));

    expect(screen.getByText(/Resolving placeholder:/)).toBeInTheDocument();
    expect(screen.getByText('Abbey Road', { selector: 'strong' })).toBeInTheDocument();
  });

  test('does not show a "resolving" banner for the plain "+ Add Album" flow', async () => {
    const user = userEvent.setup();
    renderAdminCollection();

    await user.click(await screen.findByText('+ Add Album'));

    expect(screen.queryByText(/Resolving placeholder/)).not.toBeInTheDocument();
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

describe('AdminCollection — ownership', () => {
  const renderWithViewRoute = () =>
    render(
      <MemoryRouter initialEntries={['/admin/collection/7']}>
        <Routes>
          <Route path="/admin/collection/:id" element={<AdminCollection />} />
          <Route path="/collection/:id" element={<div>Collection view page</div>} />
        </Routes>
      </MemoryRouter>
    );

  test('redirects a signed-in non-owner, non-admin user to the collection view page', async () => {
    useAuthStore.setState({ isAdmin: false, user: { id: 99 } });
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, collection: { ...collectionPayload.collection, user_id: 1 } },
    });
    renderWithViewRoute();

    await waitFor(() => expect(screen.getByText('Collection view page')).toBeInTheDocument());
    expect(screen.queryByText('Edit Collection')).not.toBeInTheDocument();
  });

  test('renders the edit form for the collection owner', async () => {
    useAuthStore.setState({ isAdmin: false, user: { id: 1 } });
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, collection: { ...collectionPayload.collection, user_id: 1 } },
    });
    renderWithViewRoute();

    expect(await screen.findByText('Edit Collection')).toBeInTheDocument();
  });

  test('renders the edit form for an admin who does not own the collection', async () => {
    useAuthStore.setState({ isAdmin: true, user: { id: 99 } });
    apiService.getCollection.mockResolvedValue({
      data: { ...collectionPayload, collection: { ...collectionPayload.collection, user_id: 1 } },
    });
    renderWithViewRoute();

    expect(await screen.findByText('Edit Collection')).toBeInTheDocument();
  });
});
