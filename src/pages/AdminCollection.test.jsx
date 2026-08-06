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
