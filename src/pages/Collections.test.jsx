import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Collections from './Collections';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getCollections: vi.fn(),
    getImageUrl: (path) => `http://example.com/${path}`,
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn() };
});

const renderCollections = () =>
  render(
    <MemoryRouter>
      <Collections />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useNavigate.mockReturnValue(vi.fn());
});

describe('Collections page — desktop grid', () => {
  test('clicking a collection\'s cover image navigates to it, not a zoom modal', async () => {
    const navigate = vi.fn();
    useNavigate.mockReturnValue(navigate);
    apiService.getCollections.mockResolvedValue({
      data: [{ id: 5, name: 'Road Trip Mix', image_path: 'road-trip.jpg', album_count: 3 }],
    });
    renderCollections();

    const image = await screen.findByAltText('Road Trip Mix');
    fireEvent.click(image);

    expect(navigate).toHaveBeenCalledWith('/collection/5');
    expect(screen.queryByText(/zoom/i)).not.toBeInTheDocument();
    // The old zoom modal rendered the collection name a second time as a caption.
    expect(screen.getAllByText('Road Trip Mix')).toHaveLength(1);
  });

  test('clicking the card body (not just the image) also navigates', async () => {
    const navigate = vi.fn();
    useNavigate.mockReturnValue(navigate);
    apiService.getCollections.mockResolvedValue({
      data: [{ id: 5, name: 'Road Trip Mix', image_path: null, album_count: 3 }],
    });
    renderCollections();

    fireEvent.click(await screen.findByText('Road Trip Mix'));

    expect(navigate).toHaveBeenCalledWith('/collection/5');
  });
});
