import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Signup from './Signup';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../stores/authStore';

const renderSignup = (initialEntries = ['/signup']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Signup />
    </MemoryRouter>
  );

describe('Signup', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Default mock so tests that don't care about signup/loading (pre-existing
    // test below) don't have to destructure an undefined return value.
    useAuthStore.mockReturnValue({ signup: vi.fn(), loading: false });
  });

  afterEach(() => {
    // Some tests below replace window.location with a stub to observe
    // navigation; restore the real one so later tests aren't left with a
    // half-fake location object.
    window.location = originalLocation;
  });

  test('shows a Continue with Google link pointing at the OAuth start endpoint', () => {
    renderSignup();
    const link = screen.getByText('Continue with Google');
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
  });

  test('navigates to return_to on successful signup when it is a safe relative path', async () => {
    const signup = vi.fn().mockResolvedValue({ success: true });
    useAuthStore.mockReturnValue({ signup, loading: false });
    delete window.location;
    window.location = { href: '' };

    renderSignup(['/signup?return_to=%2Fovertone%2Fentity%2F123']);
    await userEvent.type(screen.getByLabelText('Username'), 'patuser');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(window.location.href).toBe('/overtone/entity/123');
  });

  test('ignores an unsafe return_to and falls back to normal navigation', async () => {
    const signup = vi.fn().mockResolvedValue({ success: true });
    useAuthStore.mockReturnValue({ signup, loading: false });
    delete window.location;
    window.location = { href: '' };

    renderSignup(['/signup?return_to=%2F%2Fevil.example.com']);
    await userEvent.type(screen.getByLabelText('Username'), 'patuser');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(window.location.href).toBe('');
  });
});
