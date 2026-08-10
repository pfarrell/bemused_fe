import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagFilterControl from './TagFilterControl';
import { useTagFilterStore } from '../stores/tagFilterStore';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

vi.mock('../services/api', () => ({
  apiService: {
    getTags: vi.fn(),
    setDefaultTag: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTagFilterStore.setState({ activeTag: null });
  apiService.getTags.mockResolvedValue({ data: [{ id: 1, name: 'jazz' }, { id: 2, name: 'blues' }] });
});

describe('TagFilterControl', () => {
  test('shows an input when no tag is active', () => {
    render(<TagFilterControl />);
    expect(screen.getByPlaceholderText('filter by tag…')).toBeInTheDocument();
  });

  test('shows the active tag and a clear button when a tag is set', () => {
    useTagFilterStore.setState({ activeTag: 'jazz' });
    render(<TagFilterControl />);
    expect(screen.getByText('#jazz')).toBeInTheDocument();
    expect(screen.getByText('clear')).toBeInTheDocument();
  });

  test('does not show "set default" unless allowSetDefault is true', () => {
    useTagFilterStore.setState({ activeTag: 'jazz' });
    render(<TagFilterControl />);
    expect(screen.queryByText('set default')).not.toBeInTheDocument();
  });

  test('shows "set default" when allowSetDefault is true', () => {
    useTagFilterStore.setState({ activeTag: 'jazz' });
    render(<TagFilterControl allowSetDefault />);
    expect(screen.getByText('set default')).toBeInTheDocument();
  });

  test('clicking "set default" saves the active tag', async () => {
    useTagFilterStore.setState({ activeTag: 'jazz' });
    apiService.setDefaultTag.mockResolvedValue({});
    render(<TagFilterControl allowSetDefault />);
    fireEvent.click(screen.getByText('set default'));
    await waitFor(() => expect(apiService.setDefaultTag).toHaveBeenCalledWith('jazz'));
    expect(toast.success).toHaveBeenCalledWith('Default tag set to #jazz');
  });

  test('clicking clear resets the active tag and calls onSelect', () => {
    useTagFilterStore.setState({ activeTag: 'jazz' });
    const onSelect = vi.fn();
    render(<TagFilterControl onSelect={onSelect} />);
    fireEvent.click(screen.getByText('clear'));
    expect(useTagFilterStore.getState().activeTag).toBeNull();
    expect(onSelect).toHaveBeenCalled();
  });

  test('typing and pressing Enter sets the tag, slugified', async () => {
    render(<TagFilterControl />);
    const input = screen.getByPlaceholderText('filter by tag…');
    await waitFor(() => expect(apiService.getTags).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: 'Hard Rock!' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useTagFilterStore.getState().activeTag).toBe('hard-rock');
  });

  test('shows autocomplete suggestions matching input', async () => {
    render(<TagFilterControl />);
    const input = screen.getByPlaceholderText('filter by tag…');
    await waitFor(() => expect(apiService.getTags).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: 'ja' } });
    expect(await screen.findByText('#jazz')).toBeInTheDocument();
    expect(screen.queryByText('#blues')).not.toBeInTheDocument();
  });

  test('clicking a suggestion selects it and calls onSelect', async () => {
    const onSelect = vi.fn();
    render(<TagFilterControl onSelect={onSelect} />);
    const input = screen.getByPlaceholderText('filter by tag…');
    await waitFor(() => expect(apiService.getTags).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: 'ja' } });
    fireEvent.click(await screen.findByText('#jazz'));
    expect(useTagFilterStore.getState().activeTag).toBe('jazz');
    expect(onSelect).toHaveBeenCalled();
  });
});
