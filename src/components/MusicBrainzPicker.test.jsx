import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MusicBrainzPicker from './MusicBrainzPicker';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    searchMusicbrainzArtist: vi.fn(),
    searchMusicbrainzRelease: vi.fn(),
    searchMusicbrainzRecording: vi.fn(),
  },
}));

describe('MusicBrainzPicker', () => {
  test('shows a link and status when a value is set', () => {
    render(
      <MusicBrainzPicker
        entityType="artist"
        value="abc-123"
        mbidStatus="manual"
        searchDefault="Hamilton"
        pending={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('link', { name: 'abc-123' })).toHaveAttribute(
      'href',
      'https://musicbrainz.org/artist/abc-123'
    );
    expect(screen.getByText('Status: manually set')).toBeInTheDocument();
  });

  test('shows an Overtone link alongside the MusicBrainz link when a value is set', () => {
    render(
      <MusicBrainzPicker
        entityType="artist"
        value="abc-123"
        mbidStatus="manual"
        searchDefault="Hamilton"
        pending={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('link', { name: 'Overtone' })).toHaveAttribute(
      'href',
      'https://patf.com/overtone/entity/abc-123'
    );
  });

  test('does not show an Overtone link when there is no value', () => {
    render(
      <MusicBrainzPicker
        entityType="artist"
        value=""
        mbidStatus=""
        searchDefault="Hamilton"
        pending={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole('link', { name: 'Overtone' })).not.toBeInTheDocument();
  });

  test('rendering with a full-URL value (e.g. right after pasting, before Save) still shows a clean link with just the id', () => {
    render(
      <MusicBrainzPicker
        entityType="release"
        value="https://musicbrainz.org/release/0e8e1b3b-388f-4404-900e-db88c3b47c2a"
        mbidStatus=""
        searchDefault="Hamilton"
        pending={true}
        onChange={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: '0e8e1b3b-388f-4404-900e-db88c3b47c2a' });
    expect(link).toHaveAttribute('href', 'https://musicbrainz.org/release/0e8e1b3b-388f-4404-900e-db88c3b47c2a');
  });

  test('shows "Not yet looked up" and no Clear button when there is no value or status', () => {
    render(
      <MusicBrainzPicker
        entityType="artist"
        value=""
        mbidStatus=""
        searchDefault="Hamilton"
        pending={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Not yet looked up')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  test('pasting an ID and clicking Use calls onChange with the trimmed text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MusicBrainzPicker
        entityType="release"
        value=""
        mbidStatus=""
        searchDefault="Hamilton: An American Musical"
        pending={false}
        onChange={onChange}
      />
    );

    await user.type(
      screen.getByPlaceholderText('Paste MusicBrainz ID or URL'),
      'https://musicbrainz.org/release/0e8e1b3b-388f-4404-900e-db88c3b47c2a'
    );
    await user.click(screen.getByRole('button', { name: 'Use' }));

    expect(onChange).toHaveBeenCalledWith('https://musicbrainz.org/release/0e8e1b3b-388f-4404-900e-db88c3b47c2a');
  });

  test('searching and picking a result calls onChange with the candidate id and shows a pending confirmation', async () => {
    apiService.searchMusicbrainzRelease.mockResolvedValue({
      data: [{
        id: 'xyz-789',
        title: 'Hamilton (Original Broadway Cast Recording)',
        artist_credit: 'Original Broadway Cast of Hamilton',
        date: '2015-09-25',
      }],
    });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MusicBrainzPicker
        entityType="release"
        value=""
        mbidStatus=""
        searchDefault="Hamilton"
        pending={true}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Search MusicBrainz' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('Hamilton (Original Broadway Cast Recording)');
    await user.click(screen.getByText('Hamilton (Original Broadway Cast Recording)'));

    expect(onChange).toHaveBeenCalledWith('xyz-789');
    expect(
      screen.getByText('Pending — click Save to apply "Hamilton (Original Broadway Cast Recording)"')
    ).toBeInTheDocument();
  });

  test('shows "No matches found." when a search returns nothing', async () => {
    apiService.searchMusicbrainzArtist.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(
      <MusicBrainzPicker
        entityType="artist"
        value=""
        mbidStatus=""
        searchDefault="Hamilton"
        pending={false}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Search MusicBrainz' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('No matches found.');
  });

  test('Clear button only appears when a value is set, and calls onChange with an empty string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MusicBrainzPicker
        entityType="artist"
        value="abc-123"
        mbidStatus="manual"
        searchDefault="Hamilton"
        pending={false}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('MusicBrainzPicker recording support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the current value to the recording MusicBrainz page', () => {
    render(
      <MusicBrainzPicker
        entityType="recording"
        value="abcd1234-abcd-1234-abcd-1234567890ab"
        mbidStatus="manual"
        onChange={() => {}}
      />
    );
    const link = screen.getByRole('link', { name: 'abcd1234-abcd-1234-abcd-1234567890ab' });
    expect(link).toHaveAttribute('href', 'https://musicbrainz.org/recording/abcd1234-abcd-1234-abcd-1234567890ab');
  });

  it('searches recordings and picks a candidate', async () => {
    apiService.searchMusicbrainzRecording.mockResolvedValue({
      data: [{ id: 'rec-1', title: 'Yesterday', artistCredit: 'The Beatles', releaseTitle: 'Help!' }],
    });
    const onChange = vi.fn();
    render(<MusicBrainzPicker entityType="recording" value="" onChange={onChange} />);

    fireEvent.click(screen.getByText('Search MusicBrainz'));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Yesterday' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Yesterday')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Yesterday'));

    expect(onChange).toHaveBeenCalledWith('rec-1');
  });
});
