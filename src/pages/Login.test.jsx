import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const renderLogin = (initialEntries = ['/login']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Login />
    </MemoryRouter>
  );

describe('Login', () => {
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
});
