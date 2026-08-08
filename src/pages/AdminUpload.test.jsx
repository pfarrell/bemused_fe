import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminUpload from './AdminUpload';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getUploadStatus: vi.fn().mockResolvedValue({ data: { stats: { pending: 0, processing: 0, completed: 0, failed: 0 } } }),
    getRecentUploads: vi.fn().mockResolvedValue({ data: [] }),
    searchAdminArtists: vi.fn(),
    searchAdminAlbums: vi.fn(),
    uploadTracks: vi.fn(),
    dismissUpload: vi.fn(),
    clearFailedUploads: vi.fn(),
  },
}));

vi.mock('jsmediatags', () => ({
  default: {
    read: (file, callbacks) => {
      if (file.name === 'tagged.mp3') {
        callbacks.onSuccess({ tags: { title: 'My Song', artist: 'My Artist', album: 'My Album', track: '3' } });
      } else {
        callbacks.onSuccess({ tags: {} });
      }
    },
  },
}));

const renderUpload = () =>
  render(
    <MemoryRouter>
      <AdminUpload />
    </MemoryRouter>
  );

describe('AdminUpload — ID3 preview panel', () => {
  test('shows tag data after file selection', async () => {
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'tagged.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);

    await screen.findByText('My Song');
    expect(screen.getByText('My Artist')).toBeInTheDocument();
    expect(screen.getByText('My Album')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('falls back to filename (minus extension) as title when title tag is empty', async () => {
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'no-tags.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);

    await screen.findByText('no-tags');
    const dashes = await screen.findAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  test('shows precedence note', async () => {
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'tagged.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);

    await screen.findByText(/Artist and album overrides below take precedence/i);
  });
});

describe('AdminUpload — Artist picker', () => {
  test('shows search results and selects artist as chip', async () => {
    apiService.searchAdminArtists.mockResolvedValue({
      data: [{ id: 7, name: 'Radiohead', album_count: 9 }],
    });
    const user = userEvent.setup();
    renderUpload();

    await user.type(
      screen.getByPlaceholderText('Search by name or leave blank to use ID3 tag'),
      'Radio'
    );
    await user.click(screen.getByRole('button', { name: 'Search artists' }));

    await screen.findByText('Radiohead');
    expect(screen.getByText(/9 album/)).toBeInTheDocument();

    await user.click(screen.getByText('Radiohead'));
    expect(screen.queryByRole('button', { name: 'Search artists' })).not.toBeInTheDocument();
    expect(screen.getByText('Radiohead')).toBeInTheDocument();
  });

  test('clears selected artist chip back to input', async () => {
    apiService.searchAdminArtists.mockResolvedValue({
      data: [{ id: 7, name: 'Radiohead', album_count: 9 }],
    });
    const user = userEvent.setup();
    renderUpload();

    await user.type(
      screen.getByPlaceholderText('Search by name or leave blank to use ID3 tag'),
      'Radio'
    );
    await user.click(screen.getByRole('button', { name: 'Search artists' }));
    await screen.findByText('Radiohead');
    await user.click(screen.getByText('Radiohead'));

    await user.click(screen.getByRole('button', { name: 'Clear artist' }));
    expect(screen.getByRole('button', { name: 'Search artists' })).toBeInTheDocument();
  });
});

describe('AdminUpload — Album picker', () => {
  test('shows album results with metadata and selects album as chip', async () => {
    apiService.searchAdminAlbums.mockResolvedValue({
      data: [{ id: 3, title: 'OK Computer', artist_name: 'Radiohead', release_year: '1997', track_count: 12 }],
    });
    const user = userEvent.setup();
    renderUpload();

    await user.type(
      screen.getByPlaceholderText('Search by title or leave blank to use ID3 tag'),
      'OK Co'
    );
    await user.click(screen.getByRole('button', { name: 'Search albums' }));

    await screen.findByText('OK Computer');
    expect(screen.getByText(/Radiohead/)).toBeInTheDocument();
    expect(screen.getByText(/1997/)).toBeInTheDocument();
    expect(screen.getByText(/12 track/)).toBeInTheDocument();

    await user.click(screen.getByText('OK Computer'));
    expect(screen.queryByRole('button', { name: 'Search albums' })).not.toBeInTheDocument();
  });
});

describe('AdminUpload — Various artists compilation checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('sends is_compilation=true in the upload FormData when checked', async () => {
    apiService.uploadTracks.mockResolvedValue({ data: { queued: 1 } });
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'track.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);

    await user.click(screen.getByLabelText('Various artists compilation'));
    await user.click(screen.getByRole('button', { name: 'Upload Tracks' }));

    await screen.findByText(/Successfully queued/);
    const formData = apiService.uploadTracks.mock.calls[0][0];
    expect(formData.get('is_compilation')).toBe('true');
  });

  test('defaults to is_compilation=false when unchecked', async () => {
    apiService.uploadTracks.mockResolvedValue({ data: { queued: 1 } });
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'track.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);
    await user.click(screen.getByRole('button', { name: 'Upload Tracks' }));

    await screen.findByText(/Successfully queued/);
    const formData = apiService.uploadTracks.mock.calls[0][0];
    expect(formData.get('is_compilation')).toBe('false');
  });

  test('checking the checkbox locks the artist field to Various Artists', async () => {
    const user = userEvent.setup();
    renderUpload();

    await user.click(screen.getByLabelText('Various artists compilation'));

    expect(screen.getByText('Various Artists')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear artist' })).not.toBeInTheDocument();
  });

  test('unchecking the checkbox restores the clear button', async () => {
    const user = userEvent.setup();
    renderUpload();

    const checkbox = screen.getByLabelText('Various artists compilation');
    await user.click(checkbox);
    await user.click(checkbox);

    expect(screen.getByRole('button', { name: 'Clear artist' })).toBeInTheDocument();
  });

  test('sends artist_id=161 when compilation is checked', async () => {
    apiService.uploadTracks.mockResolvedValue({ data: { queued: 1 } });
    const user = userEvent.setup();
    renderUpload();

    const file = new File([''], 'track.mp3', { type: 'audio/mpeg' });
    await user.upload(document.getElementById('file-input'), file);
    await user.click(screen.getByLabelText('Various artists compilation'));
    await user.click(screen.getByRole('button', { name: 'Upload Tracks' }));

    await screen.findByText(/Successfully queued/);
    const formData = apiService.uploadTracks.mock.calls[0][0];
    expect(formData.get('artist_id')).toBe('161');
  });
});

describe('AdminUpload — clearing failed uploads', () => {
  const failedUpload = {
    id: 42, status: 'failed', original_filename: 'bad.mp3',
    error_message: 'boom', created_at: '2026-08-01T00:00:00Z',
  };
  const processingUpload = {
    id: 43, status: 'processing', original_filename: 'working.mp3',
    error_message: null, created_at: '2026-08-01T00:00:00Z',
  };

  test('shows Dismiss only on failed rows, not processing rows', async () => {
    apiService.getRecentUploads.mockResolvedValue({ data: [failedUpload, processingUpload] });
    renderUpload();

    await screen.findByText('bad.mp3');
    const failedRow = screen.getByText('bad.mp3').closest('tr');
    const processingRow = screen.getByText('working.mp3').closest('tr');

    expect(within(failedRow).getByText('Dismiss')).toBeInTheDocument();
    expect(within(processingRow).queryByText('Dismiss')).not.toBeInTheDocument();
  });

  test('clicking Dismiss removes the row and calls apiService.dismissUpload', async () => {
    const user = userEvent.setup();
    apiService.getRecentUploads.mockResolvedValue({ data: [failedUpload] });
    apiService.dismissUpload.mockResolvedValue({ data: { success: true } });
    renderUpload();

    await screen.findByText('bad.mp3');
    await user.click(screen.getByText('Dismiss'));

    expect(apiService.dismissUpload).toHaveBeenCalledWith(42);
    expect(screen.queryByText('bad.mp3')).not.toBeInTheDocument();
  });

  test('Clear All Failed is disabled when there are no failed uploads', async () => {
    apiService.getUploadStatus.mockResolvedValue({ data: { stats: { pending: 0, processing: 0, completed: 0, failed: 0 } } });
    renderUpload();

    expect(await screen.findByText('Clear All Failed')).toBeDisabled();
  });

  test('Clear All Failed confirms, then clears and refreshes', async () => {
    const user = userEvent.setup();
    apiService.getUploadStatus.mockResolvedValue({ data: { stats: { pending: 0, processing: 0, completed: 0, failed: 1 } } });
    apiService.getRecentUploads.mockResolvedValue({ data: [failedUpload] });
    apiService.clearFailedUploads.mockResolvedValue({ data: { success: true, deleted: 1 } });
    window.confirm = vi.fn(() => true);
    renderUpload();

    await screen.findByText('bad.mp3');
    await user.click(screen.getByText('Clear All Failed'));

    expect(window.confirm).toHaveBeenCalled();
    expect(apiService.clearFailedUploads).toHaveBeenCalled();
    expect(screen.queryByText('bad.mp3')).not.toBeInTheDocument();
  });
});
