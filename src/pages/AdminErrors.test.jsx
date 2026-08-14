import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminErrors from './AdminErrors';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getErrors: vi.fn(),
    dismissError: vi.fn(),
    clearErrors: vi.fn(),
  },
}));

const renderErrors = () =>
  render(
    <MemoryRouter>
      <AdminErrors />
    </MemoryRouter>
  );

const uploadError = {
  id: 1, source: 'upload', message: 'ENOENT: no such file', context: 'track07.mp3',
  created_at: '2026-08-13T00:00:00Z',
};

const httpError = {
  id: 2, source: 'http', message: 'TypeError: Cannot read properties of null', context: 'POST /admin/album/9',
  created_at: '2026-08-12T00:00:00Z',
};

describe('AdminErrors', () => {
  test('renders rows with source, message, context, and created date', async () => {
    apiService.getErrors.mockResolvedValue({
      data: { errors: [uploadError], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } },
    });
    renderErrors();

    await screen.findByText('ENOENT: no such file');
    expect(screen.getByText('upload')).toBeInTheDocument();
    expect(screen.getByText('track07.mp3')).toBeInTheDocument();
  });

  test('dismissing a row removes it and calls apiService.dismissError', async () => {
    const user = userEvent.setup();
    apiService.getErrors.mockResolvedValue({
      data: { errors: [uploadError], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } },
    });
    apiService.dismissError.mockResolvedValue({ data: { success: true } });
    renderErrors();

    await screen.findByText('ENOENT: no such file');
    const row = screen.getByText('ENOENT: no such file').closest('tr');
    await user.click(within(row).getByText('Dismiss'));

    expect(apiService.dismissError).toHaveBeenCalledWith(1);
    expect(screen.queryByText('ENOENT: no such file')).not.toBeInTheDocument();
  });

  test('shows rows from different sources with distinct badge colors', async () => {
    apiService.getErrors.mockResolvedValue({
      data: { errors: [uploadError, httpError], pagination: { page: 1, limit: 25, total: 2, totalPages: 1 } },
    });
    renderErrors();

    await screen.findByText('upload');
    const uploadBadge = screen.getByText('upload');
    const httpBadge = screen.getByText('http');
    expect(uploadBadge.style.backgroundColor).not.toBe(httpBadge.style.backgroundColor);
  });
});
