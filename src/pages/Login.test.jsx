import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Login from './Login';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../stores/authStore';

const renderLogin = (initialEntries = ['/login']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Login />
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    // Default mock so tests that don't care about login/loading (pre-existing
    // tests below) don't have to destructure an undefined return value.
    useAuthStore.mockReturnValue({ login: vi.fn(), loading: false });
  });

  test('shows a Continue with Google link pointing at the OAuth start endpoint', () => {
    renderLogin();
    const link = screen.getByText('Continue with Google');
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
  });

  test('shows an error message when redirected back with ?error=google_failed', () => {
    renderLogin(['/login?error=google_failed']);
    expect(screen.getByText('Something went wrong connecting to Google. Please try again.')).toBeInTheDocument();
  });

  test('renders no error banner for an unrecognized error code', () => {
    renderLogin(['/login?error=<script>whatever</script>']);
    expect(screen.queryByTestId('oauth-error')).not.toBeInTheDocument();
    expect(screen.queryByText(/whatever/)).not.toBeInTheDocument();
  });

  test('renders no error banner for an inherited-property error code', () => {
    // A bare object lookup resolves ?error=constructor to an inherited function,
    // which is truthy and would render an empty red banner.
    renderLogin(['/login?error=constructor']);
    expect(screen.queryByTestId('oauth-error')).not.toBeInTheDocument();
  });

  test('navigates to return_to on successful login when it is a safe relative path', async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    useAuthStore.mockReturnValue({ login, loading: false });
    delete window.location;
    window.location = { href: '' };

    renderLogin(['/login?return_to=%2Fovertone%2Fentity%2F123']);
    await userEvent.type(screen.getByLabelText('Username'), 'pat');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(window.location.href).toBe('/overtone/entity/123');
  });

  test('ignores an unsafe return_to and falls back to normal navigation', async () => {
    const login = vi.fn().mockResolvedValue({ success: true });
    useAuthStore.mockReturnValue({ login, loading: false });
    delete window.location;
    window.location = { href: '' };

    renderLogin(['/login?return_to=%2F%2Fevil.example.com']);
    await userEvent.type(screen.getByLabelText('Username'), 'pat');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(window.location.href).toBe('');
  });
});
