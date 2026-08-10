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
    changePassword: vi.fn(),
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

describe('Account — Change Password', () => {
  test('shows a change-password form when the user has a password, not the set-password form', () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    renderAccount();
    expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Confirm password')).not.toBeInTheDocument();
  });

  test('rejects a new password under 6 characters without calling the API', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Change password'));
    await waitFor(() => expect(apiService.changePassword).not.toHaveBeenCalled());
  });

  test('rejects a mismatched confirmation without calling the API', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByText('Change password'));
    await waitFor(() => expect(apiService.changePassword).not.toHaveBeenCalled());
  });

  test('submits current and new password, then clears the form on success', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    apiService.changePassword.mockResolvedValueOnce({ data: { ok: true } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByText('Change password'));
    await waitFor(() => expect(apiService.changePassword).toHaveBeenCalledWith('oldpass', 'longenough'));
    await waitFor(() => expect(screen.getByPlaceholderText('Current password').value).toBe(''));
  });

  test('shows a server error and keeps the fields filled in on failure', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false, google_connected: false, has_password: true } });
    apiService.changePassword.mockRejectedValueOnce({ response: { data: { error: 'Current password is incorrect' } } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'wrongpass' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min 6 characters)'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByText('Change password'));
    await waitFor(() => expect(apiService.changePassword).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Current password').value).toBe('wrongpass');
  });
});
