import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Account from './Account';
import { useAuthStore } from '../stores/authStore';
import { useTagFilterStore } from '../stores/tagFilterStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    getGoogleStartUrl: (returnTo, intent) => {
      const params = new URLSearchParams();
      if (returnTo) params.set('return_to', returnTo);
      if (intent) params.set('intent', intent);
      const qs = params.toString();
      return `/api/auth/google/start${qs ? `?${qs}` : ''}`;
    },
    disconnectGoogle: vi.fn(),
    setPassword: vi.fn(),
    getTags: vi.fn(() => Promise.resolve({ data: [] })),
    setDefaultTag: vi.fn(),
  },
}));

const renderAccount = (initialEntries = ['/account']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Account />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Account', () => {
  test('shows a Connect Google Account link when not connected', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    renderAccount();
    const link = screen.getByText('Connect Google Account');
    expect(link).toHaveAttribute('href', '/api/auth/google/start?return_to=%2Faccount&intent=link');
  });

  test('shows a Disconnect button when connected and a password is set', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: true, has_password: true } });
    renderAccount();
    fireEvent.click(screen.getByText('Disconnect'));
    await waitFor(() => expect(apiService.disconnectGoogle).toHaveBeenCalled());
  });

  test('hides Disconnect and explains why when connected but no password is set', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: true, has_password: false } });
    renderAccount();
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
    expect(screen.getByText('Set a password to disconnect')).toBeInTheDocument();
  });

  test('shows a set-password form when the user has no password', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: true, has_password: false } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByText('Set password'));
    await waitFor(() => expect(apiService.setPassword).toHaveBeenCalledWith('longenough'));
  });

  test('shows a linked-account banner when redirected with ?linked=google', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: true, has_password: true } });
    renderAccount(['/account?linked=google']);
    expect(screen.getByText('Google account connected.')).toBeInTheDocument();
  });
});

describe('Account — Preferences and Log Out', () => {
  test('renders the Home View toggle', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    renderAccount();
    expect(screen.getByText('Artists')).toBeInTheDocument();
    expect(screen.getByText('Albums')).toBeInTheDocument();
  });

  test('renders the Tag Filter control with set-default enabled', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    useTagFilterStore.setState({ activeTag: 'jazz' });
    renderAccount();
    expect(screen.getByText('#jazz')).toBeInTheDocument();
    expect(screen.getByText('set default')).toBeInTheDocument();
  });

  test('clicking Log Out calls logout', async () => {
    const logout = vi.fn();
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true }, logout });
    renderAccount();
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
