import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLogs from './AdminLogs';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getLogs: vi.fn(),
  },
}));

const renderLogs = () =>
  render(
    <MemoryRouter>
      <AdminLogs />
    </MemoryRouter>
  );

const searchRow = {
  id: 1, action: 'search', query: 'radiohead',
  track_id: null, track_title: null,
  artist_id: null, artist_name: null,
  album_id: null, album_title: null,
  ip_address: '1.2.3.4', created_at: '2026-08-13T00:00:00Z',
};

const streamRow = {
  id: 2, action: 'stream', query: null,
  track_id: 5, track_title: 'Airbag',
  artist_id: 7, artist_name: 'Radiohead',
  album_id: 3, album_title: 'OK Computer',
  ip_address: '1.2.3.4', created_at: '2026-08-13T00:05:00Z',
};

describe('AdminLogs — search entries', () => {
  test('shows the query text for a search row', async () => {
    apiService.getLogs.mockResolvedValue({
      data: { logs: [searchRow], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } },
    });
    renderLogs();

    await screen.findByText('radiohead');
    expect(screen.getByText('search')).toBeInTheDocument();
  });

  test('shows a blank Query cell for a stream row', async () => {
    apiService.getLogs.mockResolvedValue({
      data: { logs: [streamRow], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } },
    });
    renderLogs();

    await screen.findByText('Airbag');
    const row = screen.getByText('Airbag').closest('tr');
    const cells = within(row).getAllByRole('cell');
    // Columns: ID, Date/Time, Action, Query, Track, Artist, Album, IP Address
    expect(cells[3]).toHaveTextContent('-');
  });

  test('search and stream badges use different colors', async () => {
    apiService.getLogs.mockResolvedValue({
      data: { logs: [searchRow, streamRow], pagination: { page: 1, limit: 25, total: 2, totalPages: 1 } },
    });
    renderLogs();

    await screen.findByText('search');
    const searchBadge = screen.getByText('search');
    const streamBadge = screen.getByText('stream');
    expect(searchBadge.style.backgroundColor).not.toBe(streamBadge.style.backgroundColor);
  });
});
