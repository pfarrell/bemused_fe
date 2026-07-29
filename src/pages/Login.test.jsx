import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Login', () => {
  test('shows a Continue with Google link pointing at the OAuth start endpoint', () => {
    renderLogin();
    const link = screen.getByText('Continue with Google');
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
  });
});
